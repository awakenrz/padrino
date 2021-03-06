import datetime
import functools
import json
import jwt
import logging
import os
import re
import time
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
        self.me_id = None

    def open(self):
        token = self.get_argument('token')
        try:
            self.me_id = self.game.decode_token(token)
        except ValueError:
            self.close(4000, "Invalid token.")
            return
        self.connections.setdefault(self.me_id, set()).add(self)

        # Send root state information.
        self.write_message({
            'type': 'root',
            'body': {
                'publicState': self.game.get_public_state(),
                'playerState': self.game.get_player_state(self.me_id),
                'publicInfo': self.game.get_public_info(),
                'phaseState': self.game.get_phase_state(self.me_id),
                'will': self.game.get_will(self.me_id),
                'nightResults': self.game.get_night_result_views(self.me_id),
                'dayResults': self.game.get_day_result_views(self.me_id)
            },
            'id': self.me_id
        })

    def on_close(self):
        if self.me_id is not None:
            self.connections[self.me_id].remove(self)

    def on_impulse_message(self, body):
        if body['targets'] is None:
            return

        players = self.game.get_player_id_map()
        raw = self.game.filter_raw_plan_view(
            self.me_id, self.game.get_current_raw_plan_view())[body['i']]

        targets = [players[player_name] for player_name in body['targets']]

        old_phase_states = {player_id: self.game.get_phase_state(player_id)
                            for player_id in self.connections}

        self.game.apply_impulse(raw['actionGroup'], raw['action'], self.me_id,
                                targets)

        if self.game.is_game_over():
            self.updater.run()

        # Notify other users about our plan edit.
        for player_id, connections in self.connections.items():
            phase_state = self.game.get_phase_state(player_id)

            if phase_state == old_phase_states[player_id]:
                # Only send updated plans to users.
                continue

            public_state = self.game.get_public_state()
            player_state = self.game.get_player_state(player_id)

            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'publicState': public_state,
                        'playerState': player_state,
                        'phaseState': phase_state
                    },
                    'id': player_id
                })

    def on_plan_message(self, body):
        players = self.game.get_player_id_map()
        raw = self.game.filter_raw_plan_view(
            self.me_id, self.game.get_current_raw_plan_view())[body['i']]

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
                    },
                    'id': player_id
                })

    def on_vote_message(self, body):
        players = self.game.get_player_id_map()
        if body['target'] is None:
            target = None
        else:
            target = players[body['target']]

        # We can't compute the majority ourselves due to vote thief etc.
        consensus_met = self.game.vote(self.me_id, target)

        if self.game.meta['end_on_consensus_met'] and consensus_met:
            self.game.skip_to_twilight()
            self.updater.schedule_update()

        # Notify other users about our vote.
        for player_id, connections in self.connections.items():
            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'phaseState': self.game.get_phase_state(player_id)
                    },
                    'id': player_id
                })

    def on_will_message(self, body):
        self.game.set_will_for(self.me_id, body)
        for connection in self.connections[self.me_id]:
            connection.write_message({
                'type': 'root',
                'body': {
                    'will': self.game.get_will(self.me_id)
                },
                'id': self.me_id
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
            elif payload['type'] == 'will':
                self.on_will_message(body)
            else:
                ok = False
        except Exception:
            ok = False
            logger.exception('Oops!')

        self.write_message({
            'type': 'ack' if ok else 'rej',
            'body': payload['seqNum'],
            'id': self.me_id
        })


class PeekHandler(tornado.web.RequestHandler):
    def initialize(self, game):
        self.game = game

    def get(self):
        token = self.get_argument('token')
        if not self.game.check_poke_token(token):
            self.send_error(403)
            return

        turn = self.get_argument('turn', None)
        phase = self.get_argument('phase', None)

        if turn is None:
            raw_plan = self.game.get_current_raw_plan_view()
        else:
            raw_plan = self.game.get_raw_plan_view(int(turn), phase)

        self.set_header('Content-Type', 'text/plain')
        self.write('\n'.join(
            self.game.meta['players'][raw_plan[i]['source']]['name'] + ': ' +
            re.sub(r'\$(\d+)', lambda m: act['targets'][int(m.group(1))],
                   act['command'])
            for i, act in enumerate(self.game.interpret_raw_plan_view(raw_plan))
            if act['targets'] is not None))


class PokeHandler(tornado.web.RequestHandler):
    def initialize(self, game, updater):
        self.game = game
        self.updater = updater

    def get(self):
        token = self.get_argument('token')
        if not self.game.check_poke_token(token):
            self.send_error(403)
            return
        self.updater.unschedule_update()
        self.updater.run()
        self.finish('ok')


class ModKillHandler(tornado.web.RequestHandler):
    def initialize(self, game, updater, connections):
        self.game = game
        self.updater = updater
        self.connections = connections

    def get(self):
        token = self.get_argument('token')
        if not self.game.check_poke_token(token):
            self.send_error(403)
            return

        self.game.modkill(self.get_argument('target'),
                          self.get_argument('reason'))

        if self.game.is_game_over():
            self.updater.run()

        # Notify everyone about the modkill.
        for player_id, connections in self.connections.items():
            public_state = self.game.get_public_state()
            phase_state = self.game.get_phase_state(player_id)
            player_state = self.game.get_player_state(player_id)

            for connection in connections:
                connection.write_message({
                    'type': 'root',
                    'body': {
                        'publicState': public_state,
                        'playerState': player_state,
                        'phaseState': phase_state
                    },
                    'id': player_id
                })

        self.finish('ok')


class RefreshHandler(tornado.web.RequestHandler):
    def initialize(self, game, connections):
        self.game = game
        self.connections = connections

    def get(self):
        token = self.get_argument('token')
        if not self.game.check_poke_token(token):
            self.send_error(403)
            return
        for player_id, connections in self.connections.items():
            for connection in connections:
                connection.write_message({'type': 'refresh', 'id': player_id})
        self.finish('ok')



class Updater(object):
    def __init__(self, game, connections):
        self.game = game
        self.connections = connections
        self.schedule_handle = None

        self.keep_alive_handle = tornado.ioloop.PeriodicCallback(self.keep_alive, 30 * 1000)
        self.keep_alive_handle.start()

        self.ioloop = tornado.ioloop.IOLoop.current()

    def run(self):
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
                        'playerState': self.game.get_player_state(player_id),
                        'phaseState': self.game.get_phase_state(player_id),
                        'phase': phase,
                        'result': self.game.get_day_result_view(turn, player_id)
                                  if phase == 'Day' else
                                  self.game.get_night_result_view(turn,
                                                                  player_id)
                    },
                    'id': player_id
                })

        self.schedule_update()

    def unschedule_update(self):
        if self.schedule_handle is not None:
            self.ioloop.remove_timeout(self.schedule_handle)
            self.schedule_handle = None

    def schedule_update(self):
        self.unschedule_update()

        if self.game.is_game_over():
            logger.info("Game over!")
            return

        phase_end = self.game.meta['schedule']['phase_end']

        logger.info("Next update in: %s",
                    datetime.timedelta(seconds=phase_end - time.time()))

        self.schedule_handle = self.ioloop.call_at(phase_end, self.run)

    def keep_alive(self):
        for connections in self.connections.values():
            for connection in connections:
                connection.ping(b'')


def make_app():
    g = game.Game(tornado.options.options.game_path)

    logger.info('Poke token: %s', g.make_poke_token())

    logger.info('Tokens:\n%s', '\n'.join(
        '%10s: %s' % (name, token)
        for name, token in g.get_tokens().items()))

    g.start()

    connections = {}

    updater = Updater(g, connections)
    updater.schedule_update()

    return tornado.web.Application([
        (r'/', MainHandler),
        (r'/_modkill', ModKillHandler, {'game': g, 'updater': updater,
                                        'connections': connections}),
        (r'/_peek', PeekHandler, {'game': g}),
        (r'/_poke', PokeHandler, {'game': g, 'updater': updater}),
        (r'/_refresh', RefreshHandler, {'game': g, 'connections': connections}),
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
