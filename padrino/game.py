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
    def __init__(self, root):
        self.root = root

        self.state_path = os.path.join(self.root, 'state.yml')
        self.meta_path = os.path.join(self.root, 'meta.yml')

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
                'phase': 'End',
                'winners': [self.meta['players'][player_id]['name']
                            for player_id, player in self.players.items()
                            if fates[player['faction']]],
                'players': {
                    self.meta['players'][player_id]['name']: {
                        'role': self.meta['players'][player_id]['role'],
                        'faction': self.meta['factions'][player['faction']]['name']
                    } for player_id, player in self.players.items()
                },
                'log': self.get_game_log()
            }

        if self.state['phase'] == 'Night':
            return {
                'phase': 'Night',
                'plan': self.get_current_plan_view(player_id),
            }

        if self.state['phase'] == 'Day':
            # We need to get the plan in this way such that we can see actions
            # on their last use that are in the plan.
            raw_plan = self.filter_raw_plan_view(
                player_id,
                glue.run('view-plan',
                    self.state_path + '.day.' + str(self.state['turn']),
                    self.plan_path))

            return {
                'phase': 'Day',
                'ballot': self.get_current_ballot(),
                'deaths': self.get_current_deaths_view(),
                'messages': self.get_current_messages_view(player_id, raw_plan),
                'plan': self.interpret_raw_plan_view(raw_plan),
            }

    def get_game_log(self):
        log = []

        history = {
            turn: {
                phase: [self.interpret_log_act(act) for act in acts]
                for phase, acts in phases.items()
            } for turn, phases in glue.run('view-history',
                                           self.state_path).items()
        }

        for turn in range(1, self.state['turn']):
            turn_history = history.get(turn, {})
            log.append({
                'turn': turn,
                'phase': 'Night',
                'acts': turn_history.get('Night', [])
            })
            log.append({
                'turn': turn,
                'phase': 'Day',
                'acts': turn_history.get('Day', [])
            })
        if self.state['phase'] == 'Day':
            log.append({
                'turn': self.state['turn'],
                'phase': 'Night',
                'acts': history.get(self.state['turn'], {}).get('Night', [])
            })
        return log

    def interpret_log_act(self, act):
        return {
            'source': self.meta['players'][act['source']]['name'],
            'targets': [self.meta['players'][target]['name']
                        for target in act['targets']],
            'command': self.meta['actions'][act['action']]['command']
        }

    def get_night_result_views(self, player_id):
        results = []
        for turn in range(1, self.state['turn']):
            results.append(self.get_night_result_view(turn, player_id))
        if self.state['phase'] == 'Day':
            results.append(self.get_night_result_view(self.state['turn'],
                                                      player_id))
        return results

    def get_day_result_views(self, player_id):
        results = []
        for turn in range(1, self.state['turn']):
            results.append(self.get_day_result_view(turn, player_id))
        return results

    def interpret_messages(self, raw_plan, messages):
        out = []

        for message in messages:
            for i, info in enumerate(raw_plan):
                if info['act'] is not None and \
                   message['actTrace'] == info['act']['trace']:
                    break
            else:
                i = None
            out.append({
                'i': i,
                'info': self.interpret_message_info(message['info'])
            })

        return out

    def filter_messages(self, player_id, messages):
        return [message for message in messages
                if message['recipient'] == player_id]

    def get_messages_view(self, turn, phase, player_id, raw_plan):
        state_path = self.state_path + '.' + phase + '.' + str(turn)
        state_post_path = self.state_path + '.' + phase + '.post.' + str(turn)

        return self.interpret_messages(raw_plan, self.filter_messages(
            player_id,
            glue.run('view-messages', state_path, state_post_path)))

    def interpret_raw_deaths(self, deaths):
        return [{
            'name': self.meta['players'][player]['name'],
            'role': self.meta['players'][player]['role'],
            'lynched': cause == 'Lynched'
        } for player, cause in deaths.items()]

    def get_current_messages_view(self, player_id, raw_plan):
        state_pre_path = self.state_path + '.night.post.' + \
                         str(self.state['turn'])
        return self.interpret_messages(raw_plan, self.filter_messages(
            player_id,
            glue.run('view-messages', state_pre_path, self.state_path)))

    def get_current_deaths_view(self):
        state_pre_path = self.state_path + '.night.post.' + \
                         str(self.state['turn'])
        return self.interpret_raw_deaths(glue.run('view-deaths', state_pre_path,
                                                  self.state_path))

    def get_deaths_view(self, turn, phase):
        state_path = self.state_path + '.' + phase + '.' + str(turn)
        state_post_path = self.state_path + '.' + phase + '.post.' + str(turn)

        return self.interpret_raw_deaths(glue.run('view-deaths', state_path,
                                                  state_post_path))

    def get_night_result_view(self, turn, player_id):
        raw = self.filter_raw_plan_view(player_id,
                                        self.get_raw_plan_view(turn, 'night'))

        return {
            'deaths': self.get_deaths_view(turn, 'night'),
            'messages': self.get_messages_view(turn, 'night', player_id, raw),
            'plan': self.interpret_raw_plan_view(raw)
        }

    def get_day_result_view(self, turn, player_id):
        raw = self.filter_raw_plan_view(player_id,
                                        self.get_raw_plan_view(turn, 'day'))

        deaths = self.get_deaths_view(turn, 'day')

        return {
            'ballot': self.get_ballot(turn),
            'lynched': next((death for death in deaths
                             if death['lynched']), None),
            'deaths': [death for death in deaths if not death['lynched']],
            'messages': self.get_messages_view(turn, 'day', player_id, raw),
            'plan': self.interpret_raw_plan_view(raw)
        }

    def get_player_id_map(self):
        return {self.meta['players'][player_id]['name']: player_id
                for player_id in self.players}

    def get_current_raw_plan_view(self):
        return glue.run('view-plan', self.state_path, self.plan_path)

    def get_raw_plan_view(self, turn, phase):
        return glue.run('view-plan',
                        self.state_path + '.' + phase + '.' + str(turn),
                        self.plan_path + '.' + phase + '.' + str(turn))

    def filter_raw_plan_view(self, player_id, raw):
        return [info for info in raw if info['source'] == player_id]

    def interpret_message_info(self, info):
        type = next(iter(info))
        body = info[type]

        out = {
            'type': type
        }

        if type == 'Guilt':
            out['isGuilty'] = body['isGuilty']
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

    def get_current_plan_view(self, player_id):
        return self.interpret_raw_plan_view(
            self.filter_raw_plan_view(player_id,
                                      self.get_current_raw_plan_view()))

    def get_raw_ballot(self, turn):
        with open(self.ballot_path + '.day.' + str(turn), 'r') as f:
            return yaml.load(f)

    def get_ballot(self, turn):
        raw = self.get_raw_ballot(turn)
        players = glue.run('view-players', self.state_path + '.day.' + str(turn))
        candidates = [player_id for player_id, player in players.items()
                      if not player['dead']]

        return {
            'votes': {
                self.meta['players'][player_id]['name']:
                    self.meta['players'][raw[player_id]]['name']
                    if player_id in raw else None
                for player_id in candidates},
            'candidates': [self.meta['players'][player_id]['name']
                           for player_id in candidates]
        }

    def get_current_raw_ballot(self):
        with open(self.ballot_path, 'r') as f:
            return yaml.load(f)

    def get_current_ballot(self):
        raw = self.get_current_raw_ballot()
        candidates = [player_id for player_id, player in self.players.items()
                      if not player['dead']]

        return {
            'votes': {
                self.meta['players'][player_id]['name']:
                    self.meta['players'][raw[player_id]]['name']
                    if player_id in raw else None
                for player_id in candidates},
            'candidates': [self.meta['players'][player_id]['name']
                           for player_id in candidates]
        }

    def get_public_info(self):
        return {
            'name': self.meta['name'],
            'motd': self.meta['motd'],
            'rules': list(self.meta['rules'])
        }

    def get_player_state(self, player_id):
        player_meta = self.meta['players'][player_id]

        faction_id = self.players[player_id]['faction']
        faction_meta = self.meta['factions'][faction_id]

        return {
            'name': player_meta['name'],
            'role': player_meta['role'],
            'abilities': player_meta['abilities'],
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
            self.meta['players'][player_id]['name']: {
                'role': self.meta['players'][player_id]['role'],
                'faction': self.meta['factions'][player['faction']]['name']
            } if player['dead'] else None
            for player_id, player in self.players.items()
        }

    def get_tokens(self):
        return {player['name']: self.encode_token(player_id)
                for player_id, player in self.meta['players'].items()}

    def make_poke_token(self):
        return jwt.encode({'p': True}, self.meta['secret'],
                          algorithm='HS256').decode('utf-8')

    def check_poke_token(self, token):
        return jwt.decode(token, self.meta['secret'], algorithms=['HS256'])['p']

    def encode_token(self, id):
        return jwt.encode({'t': id}, self.meta['secret'],
                          algorithm='HS256').decode('utf-8')

    def decode_token(self, token):
        return jwt.decode(token, self.meta['secret'], algorithms=['HS256'])['t']

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

        if self.state['phase'] == 'Night':
            night_end = self.get_night_end()

            return int(tzinfo.localize(
                datetime.datetime.combine(last_day + datetime.timedelta(days=1),
                                          night_end)).timestamp())

        if self.state['phase'] == 'Day':
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
        if self.state['phase'] != 'Night':
            raise ValueError('not night time')

        glue.run('plan', self.state_path, self.plan_path, input={
            'actionGroup': action_group,
            'action': action,
            'source': source,
            'targets': targets
        })

    def apply_impulse(self, action_group, action, source, targets):
        if self.state['phase'] != 'Day':
            raise ValueError('not day time')

        glue.run('impulse', self.state_path, self.plan_path, input={
            'actionGroup': action_group,
            'action': action,
            'source': source,
            'targets': targets
        })

        self.load_state()
        self.load_players()

    def vote(self, source, target):
        if self.state['phase'] != 'Day':
            raise ValueError('not day time')

        return glue.run('vote', self.state_path, self.ballot_path, input={
            'source': source,
            'target': target
        })

    def finish_phase(self):
        if self.state['phase'] == 'Night':
            self.run_night()
        elif self.state['phase'] == 'Day':
            self.run_day()
        else:
            raise ValueError('cannot finish this phase')

        self.meta['schedule']['phase_end'] = self.get_next_end()
        self.save_meta()

    def run_day(self):
        ballot_path = self.ballot_path + '.day.' + str(self.state['turn'])
        plan_path = self.plan_path + '.day.' + str(self.state['turn'])

        shutil.copy(self.ballot_path, ballot_path)
        os.rename(self.plan_path, plan_path)

        glue.run('run-day', self.state_path, ballot_path)

        os.unlink(self.ballot_path)

        shutil.copy(self.state_path, self.state_path + '.day.post.' +
                    str(self.state['turn']))

        self.load_state()
        self.load_players()

        self.make_plan()

    def run_night(self):
        state_path = self.state_path + '.night.' + str(self.state['turn'])
        plan_path = self.plan_path + '.night.' + str(self.state['turn'])

        shutil.copy(self.state_path, state_path)
        shutil.copy(self.plan_path, plan_path)

        glue.run('run-night', self.state_path, plan_path)

        os.unlink(self.plan_path)

        shutil.copy(self.state_path, self.state_path + '.night.post.' +
                    str(self.state['turn']))
        shutil.copy(self.state_path, self.state_path + '.day.' +
                    str(self.state['turn']))

        self.load_state()
        self.load_players()

        self.make_ballot()
        self.make_plan()

    def start(self):
        if self.meta['schedule']['phase_end'] is None:
            logger.info("No phase end found -- this is probably your first "
                        "time running the server.")

            self.make_plan()
            self.meta['schedule']['phase_end'] = self.get_next_end()
            self.save_meta()
