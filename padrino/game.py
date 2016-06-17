import base64
import datetime
import logging
import os
import jwt
import pytz
import shutil
import time
import yaml

from padrino import glue

logger = logging.getLogger(__name__)


class Game(object):
    NIGHT = 0
    DAY = 1
    OVER = 2

    def __init__(self, root):
        self.root = root

        self.state_path = os.path.join(self.root, 'state.yml')
        self.meta_path = os.path.join(self.root, 'meta.yml')

        self.night_result_path = os.path.join(self.root, 'night_result.yml')
        self.day_result_path = os.path.join(self.root, 'day_result.yml')

        self.plan_path = os.path.join(self.root, 'plan.yml')
        self.ballot_path = os.path.join(self.root, 'ballot.yml')

        self.load_state()
        self.load_meta()
        self.load_players()

    def load_state(self):
        with open(self.state_path, 'r') as f:
            self.state = yaml.load(f)

    def load_meta(self):
        with open(self.meta_path, 'r') as f:
            self.meta = yaml.load(f)

    def save_meta(self):
        with open(self.meta_path, 'w') as f:
            yaml.dump(self.meta, f, default_flow_style=False)

    def load_players(self):
        self.players = glue.run('view-players', self.state_path)

    def get_raw_fates(self):
        return glue.run('view-fates', self.state_path)

    def is_game_over(self):
        return all(fate is not None for fate in self.get_raw_fates().values())

    def get_phase_state(self, player_id):
        fates = self.get_raw_fates()

        if self.is_game_over():
            return {
                'phase': self.OVER,
                'winners': [self.meta['players'][player_id]['name']
                            for player_id, player in self.players.items()
                            if fates[player['faction']]]
            }

        if self.meta['phase'] == self.NIGHT:
            return {
                'phase': self.NIGHT,
                'plan': self.get_plan_view(player_id)
            }

        if self.meta['phase'] == self.DAY:
            return {
                'phase': self.DAY,
                'ballot': self.get_ballot()
            }

    def get_night_result_views(self, player_id):
        results = []
        for turn in range(1, self.state['turn']):
            results.append(self.get_night_result_view(turn, player_id))
        if self.meta['phase'] == self.DAY:
            results.append(self.get_night_result_view(self.state['turn'],
                                                      player_id))
        return results

    def get_day_results(self):
        results = []
        for turn in range(1, self.state['turn']):
            results.append(self.get_day_result(turn))
        return results

    def get_night_result_view(self, turn, player_id):
        with open(self.night_result_path + '.' + str(turn), 'r') as f:
            result = yaml.load(f)

        raw = self.filter_raw_plan_view(result['usedPlan'], player_id)

        messages = []
        for message in result['messages']:
            if message['recipient'] != player_id:
                continue
            for i, info in enumerate(raw):
                if info['act'] is not None and \
                   message['actTrace'] == info['act']['trace']:
                    break
            else:
                i = None
            messages.append({
                'i': i,
                'info': self.interpret_message_info(message['info'])
            })

        return {
            'deaths': [self.meta['players'][player]
                       for player in result['deaths']],
            'usedPlan': self.interpret_raw_plan_view(raw),
            'messages': messages
        }

    def get_day_result(self, turn):
        with open(self.day_result_path + '.' + str(turn), 'r') as f:
            result = yaml.load(f)

        ballot = result['usedBallot']

        return {
            'usedBallot': {
                self.meta['players'][source]['name']:
                    self.meta['players'][target]['name']
                    if target is not None else None
                for source, target in ballot.items()
            },
            'deaths': [self.meta['players'][player]
                       for player in result['deaths']],
            'lynched': self.meta['players'][result['lynched']]
                       if result['lynched'] is not None else None
        }

    def get_player_id_map(self):
        return {self.meta['players'][player_id]['name']: player_id
                for player_id in self.players}

    def get_raw_plan_view(self):
        return glue.run('view-plan', self.state_path, self.plan_path)

    def filter_raw_plan_view(self, raw, player_id):
        return [info for info in raw if info['source'] == player_id]

    def interpret_message_info(self, info):
        type = next(iter(info))
        body = info[type]

        out = {
            'type': type
        }

        if type == 'Investigation':
            out['result'] = body['result']
        elif type == 'Fruit':
            pass
        elif type == 'Players':
            out['players'] = [self.meta['players'][player_id]['name']
                              for player_id in body['players']]
        elif type == 'Actions':
            out['actions'] = list(set(self.meta['actions'][action_id]['command']
                                      for action_id in body['actions']))

        return out

    def interpret_raw_plan_view(self, raw):
        return [{
            'command': self.meta['actions'][info['action']]['command'],
            'description': self.meta['actions'][info['action']]['description'],
            'targets': None if info['act'] is None else [
                self.meta['players'][target]['name']
                for target in info['act']['targets']],
            'candidates': [[self.meta['players'][target]['name']
                            for target in targets]
                           for targets in info['candidates']],
            'available': info['available'],
            'compulsion': info['compulsion']
        } for info in raw]

    def get_plan_view(self, player_id):
        return self.interpret_raw_plan_view(
            self.filter_raw_plan_view(self.get_raw_plan_view(),
                                      player_id))

    def get_raw_ballot(self):
        with open(self.ballot_path, 'r') as f:
            return yaml.load(f)

    def get_ballot(self):
        ballot = self.get_raw_ballot()
        candidates = [player_id for player_id, player in self.players.items()
                      if not player['dead']]

        return {
            'votes': {
                self.meta['players'][player_id]['name']:
                    self.meta['players'][ballot[player_id]]['name']
                    if player_id in ballot else None
                for player_id in candidates},
            'candidates': [self.meta['players'][player_id]['name']
                           for player_id in candidates]
        }

    def get_public_info(self):
        return {
            'name': self.meta['name'],
            'motd': self.meta['motd']
        }

    def get_player_info(self, player_id):
        player_meta = self.meta['players'][player_id]

        faction_id = self.players[player_id]['faction']
        faction_meta = self.meta['factions'][faction_id]

        return {
            'name': player_meta['name'],
            'role': player_meta['role'],
            'faction': faction_meta['name'],
            'agenda': faction_meta['agenda'],
            'friends': [self.meta['players'][friend]['name']
                        for friend in self.players[player_id]['friends']]
        }

    def get_public_state(self):
        return {
            'turn': self.state['turn'],
            'phaseEnd': self.meta['schedule']['phase_end'],
            'players': self.get_player_flips()
        }

    def get_player_flips(self):
        return {
            self.meta['players'][player_id]['name']:
                self.meta['players'][player_id]['role']
                if player['dead'] else None
            for player_id, player in self.players.items()
        }

    def get_phases(self):
        # Get all turns except this one.
        for turn in range(1, self.state['turn']):
            load_plan(1)
            load_ballot(1)

    def get_tokens(self):
        return {player['name']: self.encode_token(player_id)
                for player_id, player in self.meta['players'].items()}

    def get_secret(self):
        return base64.urlsafe_b64decode(self.meta['secret'].encode('utf-8'))

    def encode_token(self, id):
        return jwt.encode({'t': id}, self.get_secret(),
                          algorithm='HS256').decode('utf-8')

    def decode_token(self, token):
        return jwt.decode(token, self.get_secret(), algorithms=['HS256'])['t']

    def get_night_end(self):
        return datetime.datetime.strptime(
            self.meta['schedule']['night_end'], '%H:%M:%S').time()

    def get_day_end(self):
        return datetime.datetime.strptime(
            self.meta['schedule']['day_end'], '%H:%M:%S').time()

    def get_tzinfo(self):
        return pytz.timezone(self.meta['schedule']['tz'])

    def get_next_end(self):
        tzinfo = self.get_tzinfo()

        if self.meta['schedule']['phase_end'] is None:
            last_day = datetime.date.today()
        else:
            last_day = datetime.datetime.fromtimestamp(
                self.meta['schedule']['phase_end'], tzinfo).date()

        if self.meta['phase'] == self.NIGHT:
            night_end = self.get_night_end()

            return int(tzinfo.localize(
                datetime.datetime.combine(last_day + datetime.timedelta(days=1),
                                          night_end)).timestamp())

        if self.meta['phase'] == self.DAY:
            day_end = self.get_day_end()

            return int(tzinfo.localize(
                datetime.datetime.combine(last_day, day_end)).timestamp())

    def make_plan(self):
        with open(self.plan_path, 'w') as f:
            yaml.dump({}, f, default_flow_style=False)

    def make_ballot(self):
        with open(self.ballot_path, 'w') as f:
            yaml.dump({}, f, default_flow_style=False)

    def edit_plan(self, action_group, action, source, targets):
        if self.meta['phase'] != self.NIGHT:
            raise ValueError('not night time')

        return glue.run('plan', self.state_path, self.plan_path, input={
            'actionGroup': action_group,
            'action': action,
            'source': source,
            'targets': targets
        })

    def vote(self, source, target):
        if self.meta['phase'] != self.DAY:
            raise ValueError('not day time')

        return glue.run('vote', self.state_path, self.ballot_path, input={
            'source': source,
            'target': target
        })

    def finish_phase(self):
        if self.meta['phase'] == self.NIGHT:
            self.meta['phase'] = self.DAY
            self.run_night()
        elif self.meta['phase'] == self.DAY:
            self.meta['phase'] = self.NIGHT
            self.run_day()
        else:
            raise ValueError('cannot finish this phase')

        self.meta['schedule']['phase_end'] = self.get_next_end()
        self.save_meta()

    def run_day(self):
        state_path = self.state_path + '.dusk.' + str(self.state['turn'])
        ballot_path = self.ballot_path + '.' + str(self.state['turn'])

        shutil.copy(self.state_path, state_path)
        shutil.copy(self.ballot_path, ballot_path)

        day_result_path = self.day_result_path + '.' + str(self.state['turn'])
        day_result = glue.run('run-day', state_path, ballot_path,
                              self.state_path)

        with open(day_result_path, 'w') as f:
            yaml.dump(day_result, f, default_flow_style=False)

        os.unlink(self.ballot_path)

        self.load_state()
        self.load_players()

        self.make_plan()

    def run_night(self):
        state_path = self.state_path + '.dawn.' + str(self.state['turn'])
        plan_path = self.plan_path + '.' + str(self.state['turn'])

        shutil.copy(self.state_path, state_path)
        shutil.copy(self.plan_path, plan_path)

        night_result_path = self.night_result_path + '.' + \
                            str(self.state['turn'])
        night_result = glue.run('run-plan', state_path, plan_path,
                                self.state_path)

        with open(night_result_path, 'w') as f:
            yaml.dump(night_result, f, default_flow_style=False)

        os.unlink(self.plan_path)

        self.load_state()
        self.load_players()

        self.make_ballot()

    def start(self):
        if self.meta['schedule']['phase_end'] is None:
            logger.info("No phase end found -- this is probably your first "
                        "time running the server.")

            self.make_plan()
            self.meta['schedule']['phase_end'] = self.get_next_end()
            self.save_meta()
