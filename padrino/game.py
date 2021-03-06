import datetime
import functools
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
        self.actions_path = os.path.join(self.root, 'actions.yml')

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

    def get_raw_winners(self):
        return glue.run('view-winners', self.state_path)

    def is_game_over(self):
        return self.get_raw_winners() is not None

    def set_will_for(self, player_id, will):
        if self.players[player_id]['causeOfDeath'] is not None:
            raise ValueError('player is dead, cannot set will anymore')
        self.meta['players'][player_id]['will'] = will
        self.save_meta()

    def get_will(self, player_id):
        return self.meta['players'][player_id]['will']

    def get_phase_state(self, player_id):
        winners = self.get_raw_winners()

        if winners is not None:
            return {
                'phase': 'End',
                'winners': [self.meta['players'][player_id]['name']
                            for player_id in winners],
                'players': {
                    self.meta['players'][player_id]['name']: {
                        'fullRole': self.get_full_role(player_id),
                    } for player_id, player in self.players.items()
                },
                'log': self.get_game_log(),
                'planned': self.get_game_planned(),
            }

        if self.state['phase'] == 'Night':
            return {
                'phase': 'Night',
                'end': self.meta['schedule']['phase_end'],
                'deaths': self.get_current_deaths_view(),
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
                'end': self.meta['schedule']['phase_end'],
                'ballot': self.get_current_ballot(),
                'deaths': self.get_current_deaths_view(),
                'messages': self.get_current_messages_view(player_id, raw_plan),
                'plan': self.interpret_raw_plan_view(raw_plan)
            }

    @functools.lru_cache(maxsize=None)
    def get_game_history(self):
        return {
            turn: {
                phase: [{
                    'command': self.meta['actions'][act['action']]['command'],
                    'source': self.meta['players'][act['source']]['name'],
                    'targets': [self.meta['players'][target]['name']
                                for target in act['targets']],
                    'trace': act['trace'],
                } for act in acts]
                for phase, acts in phases.items()
            } for turn, phases in glue.run('view-history',
                                           self.state_path).items()}

    @functools.lru_cache(maxsize=None)
    def get_final_plan_view(self, turn, phase):
        return [{
            'command': self.meta['actions'][info['action']]['command'],
            'source': self.meta['players'][info['act']['source']]['name'],
            'targets': None if info['act'] is None else [
                self.meta['players'][target]['name']
                for target in info['act']['targets']],
            'trace': info['act']['trace'],
        } for info in self.get_raw_plan_view(turn, phase)
          if info['act'] is not None]

    def get_game_planned(self):
        planned = {
            turn: {
                'Day': self.get_final_plan_view(turn, 'day'),
                'Night': self.get_final_plan_view(turn, 'night')
            } for turn in range(1, self.state['turn'])}
        if self.state['phase'] == 'Day':
            planned[self.state['turn']] = {
                'Night': self.get_final_plan_view(self.state['turn'], 'night')
            }
        return planned

    @functools.lru_cache(maxsize=None)
    def get_game_log(self):
        # Fill game log with initial actions from the plan.
        log = {
            turn: {
                phase: {act['trace']['ActFromPlan']['planGroup']: {
                    'planned': {
                        'command': act['command'],
                        'source': act['source'],
                        'targets': act['targets'],
                    },
                    'final': None,
                    'triggers': {}
                } for act in acts}
                for phase, acts in phases.items()
            } for turn, phases in self.get_game_planned().items()
        }

        # Try to reconcile acts actually executed with the plan. There are
        # three scenarios here for planned acts:
        #
        # - the action was executed as planned: we clear the planned field and
        #   only set the final field.
        #
        # - the action was blocked: we won't encounter the entry in the history
        #   here, so only the planned field will be set.
        #
        # - the action was rewritten: both the planned field and final field
        #   will be set, but with different values.
        #
        # Additionally, we may have acts triggered by rewrite. These are
        # placed into the triggers field and they are always regarded as
        # executed, so only the final field will be set for these acts.
        for turn, phases in self.get_game_history().items():
            for phase, acts in phases.items():
                root = log[turn][phase]

                for act in acts:
                    trace_type = next(iter(act['trace'].keys()))

                    final = {
                        'command': act['command'],
                        'source': act['source'],
                        'targets': act['targets'],
                    }

                    if trace_type == 'ActFromPlan':
                        trace = act['trace']['ActFromPlan']
                        node = root[trace['planGroup']]
                        node['final'] = final

                        if node['planned'] == node['final']:
                            node['planned'] = None
                    elif trace_type == 'ActFromRewrite':
                        trace = act['trace']['ActFromRewrite']
                        trigger_path = []

                        node = root

                        while True:
                            trigger_path.append(trace['index'])

                            trace = trace['dependentTrace']
                            trace_type = next(iter(trace.keys()))

                            if trace_type == 'ActFromPlan':
                                node = root[trace['ActFromPlan']['planGroup']]
                                break

                        while trigger_path:
                            node = node['triggers'].setdefault(
                                trigger_path.pop(), {
                                    'planned': None,
                                    'final': None,
                                    'triggers': {}
                                })
                        node['final'] = final
                    else:
                        raise ValueError('unknown trace type: {}'.format(
                            trace_type))

        return log

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
            i = None
            info = self.interpret_message_info(message['info'])
            if message['associatesWithAct']:
                for i, planned in enumerate(raw_plan):
                    if planned['act'] is not None and \
                       message['actTrace'] == planned['act']['trace']:
                        break
            out.append({
                'i': i,
                'info': info
            })

        return out

    def get_post_suffix(self, phase, turn):
        if phase == 'night':
            return 'day.' + str(turn)

        if phase == 'day':
            return 'night.' + str(turn + 1)

    def get_messages_view(self, turn, phase, player_id, raw_plan):
        state_path = self.state_path + '.' + phase + '.' + str(turn)
        state_post_path = self.state_path + '.' + \
                          self.get_post_suffix(phase, turn)

        return self.interpret_messages(
            raw_plan,
            glue.run('view-messages', state_path, state_post_path)
                .get(player_id, []))

    def interpret_raw_cause(self, player_id, cause):
        mod_kill_reason = cause.get('ModKilled', {}).get('reason')
        return {
            'name': self.meta['players'][player_id]['name'],
            'fullRole': self.get_full_role(player_id),
            'lynched': next(iter(cause)) == 'Lynched',
            'modKillReason': mod_kill_reason,
            'will': self.meta['players'][player_id]['will']
                    if mod_kill_reason is None else ''
        }

    def interpret_raw_deaths(self, deaths):
        return [self.interpret_raw_cause(player_id, cause)
                for player_id, cause in deaths.items()]

    def get_current_messages_view(self, player_id, raw_plan):
        state_pre_path = self.state_path + '.' + self.state['phase'].lower() + \
                         '.' + str(self.state['turn'])
        return self.interpret_messages(
            raw_plan,
            glue.run('view-messages', state_pre_path, self.state_path)
                .get(player_id, []))

    def get_current_deaths_view(self):
        state_pre_path = self.state_path + '.' + self.state['phase'].lower() + \
                         '.' + str(self.state['turn'])
        return self.interpret_raw_deaths(glue.run('view-deaths', state_pre_path,
                                                  self.state_path))

    def get_deaths_view(self, turn, phase):
        state_path = self.state_path + '.' + phase + '.' + str(turn)
        state_post_path = self.state_path + '.' + \
                          self.get_post_suffix(phase, turn)

        return self.interpret_raw_deaths(glue.run('view-deaths', state_path,
                                                  state_post_path))

    @functools.lru_cache(maxsize=None)
    def get_night_result_view(self, turn, player_id):
        raw = self.filter_raw_plan_view(player_id,
                                        self.get_raw_plan_view(turn, 'night'))

        return {
            'deaths': self.get_deaths_view(turn, 'night'),
            'messages': self.get_messages_view(turn, 'night', player_id, raw),
            'plan': self.interpret_raw_plan_view(raw)
        }

    @functools.lru_cache(maxsize=None)
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

        if type == 'GuiltInfo':
            out['isGuilty'] = body['isGuilty']
        elif type == 'FruitInfo':
            pass
        elif type == 'PlayersInfo':
            out['players'] = [self.meta['players'][player_id]['name']
                              for player_id in body['players']]
        elif type == 'ActionsInfo':
            out['actions'] = list(set(self.meta['actions'][action_id]['command']
                                      for action_id in body['actions']))
        elif type == 'RoleInfo':
            out['role'] = self.meta['players'][body['player']]['role'] \
                          if not self.players[body['player']]['vanillaized'] \
                          else 'Vanilla'
        elif type == 'GreetingInfo':
            out['greeter'] = self.meta['players'][body['greeter']]['name']
            out['faction'] = \
                self.meta['factions'][body['greeterFaction']]['name']

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

        orig_players = glue.run('view-players',
                                self.state_path + '.day.' + str(turn))
        players = glue.run('view-players',
                           self.state_path + '.' +
                           self.get_post_suffix('day', turn))

        candidates = {player_id for player_id, player in orig_players.items()
                      if player['causeOfDeath'] is None} & \
                     {player_id for player_id, player in players.items()
                      if player['causeOfDeath'] is None or
                         next(iter(player['causeOfDeath'])) == 'Lynched'}

        return {
            'votes': {
                self.meta['players'][player_id]['name']:
                    self.meta['players'][raw[player_id]]['name']
                    if player_id in raw else None
                for player_id in candidates}
        }

    def get_current_raw_ballot(self):
        with open(self.ballot_path, 'r') as f:
            return yaml.load(f)

    def get_current_ballot(self):
        raw = self.get_current_raw_ballot()
        candidates = [player_id for player_id, player in self.players.items()
                      if player['causeOfDeath'] is None]

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
            'consensus': self.state['consensus'],
            'locale': self.meta['locale'],
            'endOnConsensusMet': self.meta['end_on_consensus_met'],
            'twilightDuration': self.meta['schedule']['twilight_duration']
        }

    def get_full_role(self, player_id):
        if self.players[player_id]['vanillaized']:
            role = 'Vanilla'
        else:
            role = self.meta['players'][player_id]['role']

        faction_meta = self.meta['factions'][self.players[player_id]['faction']]
        return faction_meta['translations'].get(
            role, faction_meta['name'] + ' ' + role)

    def get_player_state(self, player_id):
        player_meta = self.meta['players'][player_id]

        faction_id = self.players[player_id]['faction']
        faction_meta = self.meta['factions'][faction_id]

        return {
            'name': player_meta['name'],
            'fullRole': self.get_full_role(player_id),
            'abilities': player_meta['abilities'],
            'faction': faction_meta['name'],
            'factionIsPrimary': self.state['factions'][faction_id]['isPrimary'],
            'agenda': player_meta['agenda'],
            'friends': [self.meta['players'][friend]['name']
                        for friend in self.players[player_id]['friends']],
            'cohorts': [self.meta['players'][cohort]['name']
                        if cohort is not None else None
                        for cohort in self.players[player_id]['cohorts']]
        }

    def get_public_state(self):
        return {
            'turn': self.state['turn'],
            'players': self.get_player_flips()
        }

    def get_player_flips(self):
        return {
            self.meta['players'][player_id]['name']: {
                'fullRole': self.get_full_role(player_id)
            } if player['causeOfDeath'] is not None else None
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
        try:
            payload = jwt.decode(token, self.meta['secret'],
                                 algorithms=['HS256'])
        except jwt.exceptions.DecodeError:
            raise ValueError('unauthorized token')

        try:
            return payload['t']
        except KeyError:
            raise ValueError('bad token')

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

    def make_actions(self):
        glue.run('view-action-groups', self.state_path, self.actions_path)

    def edit_plan(self, action_group, action, source, targets):
        if self.state['phase'] != 'Night':
            raise ValueError('not night time')

        glue.run('plan', self.state_path, self.actions_path, self.plan_path,
                 input={
            'actionGroup': action_group,
            'action': action,
            'source': source,
            'targets': targets
        })

    def apply_impulse(self, action_group, action, source, targets):
        if self.state['phase'] != 'Day':
            raise ValueError('not day time')

        glue.run('impulse', self.state_path, self.actions_path, self.plan_path,
                 input={
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

        # check for twilight
        if time.time() > self.meta['schedule']['phase_end'] - \
                         self.meta['schedule']['twilight_duration']:
            raise ValueError('in twilight')

        return glue.run('vote', self.state_path, self.ballot_path, input={
            'source': source,
            'target': target
        })

    def modkill(self, target, reason):
        glue.run('modkill', self.state_path, self.plan_path, input={
            'target': next(player_id
                           for player_id, player in self.meta['players'].items()
                           if player['name'] == target),
            'reason': reason,
            'modifyPlan': self.state['phase'] == 'Night'
        })

        self.load_state()
        self.load_players()

    def finish_phase(self):
        if self.state['phase'] == 'Night':
            self.run_night()
        elif self.state['phase'] == 'Day':
            self.run_day()
        else:
            raise ValueError('cannot finish this phase')

        self.meta['schedule']['phase_end'] = self.get_next_end()
        self.save_meta()

    def skip_to_twilight(self):
        self.meta['schedule']['phase_end'] = \
            time.time() + self.meta['schedule']['twilight_duration']
        self.save_meta()

    def run_day(self):
        ballot_path = self.ballot_path + '.day.' + str(self.state['turn'])
        actions_path = self.actions_path + '.day.' + str(self.state['turn'])
        plan_path = self.plan_path + '.day.' + str(self.state['turn'])

        os.rename(self.ballot_path, ballot_path)
        os.rename(self.actions_path, actions_path)
        os.rename(self.plan_path, plan_path)

        glue.run('run-day', self.state_path, ballot_path)

        shutil.copy(self.state_path, self.state_path + '.night.' +
                    str(self.state['turn'] + 1))

        self.load_state()
        self.load_players()

        self.make_plan()
        self.make_actions()

    def run_night(self):
        plan_path = self.plan_path + '.night.' + str(self.state['turn'])
        actions_path = self.actions_path + '.night.' + str(self.state['turn'])

        os.rename(self.plan_path, plan_path)
        os.rename(self.actions_path, actions_path)

        glue.run('run-night', self.state_path, actions_path, plan_path)

        shutil.copy(self.state_path, self.state_path + '.day.' +
                    str(self.state['turn']))

        self.load_state()
        self.load_players()

        self.make_ballot()
        self.make_actions()
        self.make_plan()

    def start(self):
        if self.meta['schedule']['phase_end'] is None:
            logger.info("No phase end found -- this is probably your first "
                        "time running the server.")

            self.make_plan()
            self.make_actions()

            self.meta['schedule']['phase_end'] = self.get_next_end()
            self.save_meta()

        state_path = self.state_path + '.night.' + str(self.state['turn'])

        if not os.path.exists(state_path):
            logger.info("No initial night state found -- copying state.")
            shutil.copy(self.state_path, state_path)
