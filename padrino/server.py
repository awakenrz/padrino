import datetime
import functools
import json
import jwt
import logging
import os
import tornado.ioloop
import tornado.options
import tornado.web
import tornado.websocket
import yaml

from padrino import game

logger = logging.getLogger(__name__)


tornado.options.define('debug', default=False, help='debug mode')
tornado.options.define('game_path', default='game', help='path to the game')
tornado.options.define('listen_port', default=8888, help='port to listen on')
tornado.options.define('listen_host', default='127.0.0.1',
                       help='host to listen on')


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('main.html')


class GameSocketHandler(tornado.websocket.WebSocketHandler):
    def initialize(self, game, connections, updater):
        self.game = game
        self.connections = connections
        self.updater = updater

    def open(self):
        token = self.request.query.encode('utf-8')
        self.me_id = self.game.decode_token(token)
        self.connections.setdefault(self.me_id, set()).add(self)

        # Send root state information.
        self.write_message({
            'type': 'root',
            'body': {
                'publicState': self.game.get_public_state(),
                'publicInfo': self.game.get_public_info(),
                'playerInfo': self.game.get_player_info(self.me_id),
                'phaseState': self.game.get_phase_state(self.me_id),
                'nightResults': self.game.get_night_result_views(self.me_id),
                'dayResults': self.game.get_day_result_views(self.me_id)
            }
        })

    def on_close(self):
        self.connections[self.me_id].remove(self)

    def on_impulse_message(self, body):
        if body['targets'] is None:
            return

        players = self.game.get_player_id_map()
        raw = self.game.filter_raw_plan_view(
            self.game.get_current_raw_plan_view(), self.me_id)[body['i']]

        targets = [players[player_name] for player_name in body['targets']]

        old_phase_states = {player_id: self.game.get_phase_state(player_id)
                            for player_id in self.connections}

        self.game.apply_impulse(raw['actionGroup'], raw['action'], self.me_id,
                                targets)

        # Notify other users about our plan edit.
        for player_id, connections in self.connections.items():
            phase_state = self.game.get_phase_state(player_id)

            if phase_state == old_phase_states[player_id]:
                # Only send updated plans to users.
                continue

            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'publicState': self.game.get_public_state(),
                        'phaseState': phase_state
                    }
                })

    def on_plan_message(self, body):
        players = self.game.get_player_id_map()
        raw = self.game.filter_raw_plan_view(
            self.game.get_current_raw_plan_view(), self.me_id)[body['i']]

        old_phase_states = {player_id: self.game.get_phase_state(player_id)
                            for player_id in self.connections}

        if body['targets'] is None:
            targets = None
        else:
            # We have to first unplan the action before planning it.
            self.game.edit_plan(raw['actionGroup'], raw['action'], self.me_id,
                                None)
            targets = [players[player_name]
                       for player_name in body['targets']]

        self.game.edit_plan(raw['actionGroup'], raw['action'],
                            self.me_id, targets)

        # Notify other users about our plan edit.
        for player_id, connections in self.connections.items():
            phase_state = self.game.get_phase_state(player_id)

            if phase_state == old_phase_states[player_id]:
                # Only send updated plans to users.
                continue

            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'phaseState': phase_state
                    }
                })

    def on_vote_message(self, body):
        players = self.game.get_player_id_map()
        if body['target'] is None:
            target = None
        else:
            target = players[body['target']]

        if 'hammer' in self.game.meta['rules'] and \
           self.game.vote(self.me_id, target):
            self.updater.run()
            return

        # Notify other users about our vote.
        for player_id, connections in self.connections.items():
            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'phaseState': self.game.get_phase_state(player_id)
                    }
                })

    def on_message(self, msg):
        payload = json.loads(msg)
        body = payload['body']

        ok = True
        try:
            if payload['type'] == 'plan':
                self.on_plan_message(body)
            elif payload['type'] == 'vote':
                self.on_vote_message(body)
            elif payload['type'] == 'impulse':
                self.on_impulse_message(body)
            else:
                ok = False
        except Exception:
            ok = False
            logger.exception('Oops!')

        self.write_message({
            'type': 'ack' if ok else 'rej',
            'body': payload['seqNum']
        })


class PokeHandler(tornado.web.RequestHandler):
    def initialize(self, game, updater):
        self.game = game
        self.updater = updater

    def get(self):
        if not self.game.check_poke_token(self.request.query.encode('utf-8')):
            self.send_error(403)
            return
        self.updater.run()
        self.finish('ok')


class Updater(object):
    def __init__(self, game, connections):
        self.game = game
        self.connections = connections
        self.schedule_handle = None
        self.ioloop = tornado.ioloop.IOLoop.current()

    def run(self):
        if self.schedule_handle is not None:
            self.ioloop.remove_timeout(self.schedule_handle)
            self.schedule_handle = None

        logger.info("Running scheduled update.")

        turn = self.game.state['turn']
        phase = self.game.state['phase']

        self.game.finish_phase()

        for player_id, connections in self.connections.items():
            for connection in connections:
                connection.write_message({
                    'type': 'pend',
                    'body': {
                        'publicState': self.game.get_public_state(),
                        'phaseState': self.game.get_phase_state(player_id),
                        'phase': phase,
                        'result': self.game.get_day_result_view(turn, player_id)
                                  if phase == 'Day' else
                                  self.game.get_night_result_view(turn,
                                                                  player_id)
                    }
                })

        self.schedule_update()

    def schedule_update(self):
        if self.game.is_game_over():
            logger.info("Game over!")
            return

        phase_end = self.game.meta['schedule']['phase_end']

        logger.info("Scheduled next update: %s",
                    datetime.datetime.fromtimestamp(phase_end))

        self.schedule_handle = self.ioloop.call_at(phase_end, self.run)


def make_app():
    g = game.Game(tornado.options.options.game_path)

    logger.info('Poke token: %s', g.make_poke_token())

    logger.info('Tokens:\n%s', '\n'.join(
        '%10s: %s' % (name, token)
        for name, token in g.get_tokens().items()))

    g.start()

    connections = {}

    updater = Updater(g, connections)

    return tornado.web.Application([
        (r'/', MainHandler),
        (r'/_poke', PokeHandler, {'game': g, 'updater': updater}),
        (r'/ws', GameSocketHandler, {'game': g, 'connections': connections,
                                     'updater': updater}),
        (r'/static/(.*)', tornado.web.StaticFileHandler, {'path': os.path.join(
            os.path.dirname(__file__), 'static')}),
    ], debug=tornado.options.options.debug, template_path=os.path.join(
        os.path.dirname(__file__), 'templates'))


def main():
    tornado.options.parse_command_line()

    app = make_app()
    app.listen(tornado.options.options.listen_port,
               tornado.options.options.listen_host)
    logger.info("Listening: %s:%d", tornado.options.options.listen_host,
                tornado.options.options.listen_port)
    tornado.ioloop.IOLoop.current().start()


if __name__ == '__main__':
    main()
