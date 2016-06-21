import base64
import datetime
import functools
import jwt
import os
import pytz
import random
import yaml


from padrino import glue


class Ref(object):
    def __init__(self, token, meta, traits):
        self.token = token
        self.meta = meta
        self.traits = traits


class Builder(object):
    def __init__(self, name, motd=None, night_end=datetime.time(10, 0),
                 day_end=datetime.time(12, 15), tz='Etc/UTC', rules=None):
        if rules is None:
            rules = set()

        self.state = {
            'history': [],
            'turn': 1,
            'phase': 'Night',
            'actions': {},
            'factions': {},
            'players': {},
            'rng': glue.run('new-rng')
        }

        tzinfo = pytz.timezone(tz)

        self.meta = {
            'name': name,
            'schedule': {
                'night_end': night_end.isoformat(),
                'day_end': day_end.isoformat(),
                'phase_end': None,
                'tz': tz,
            },
            'motd': motd,
            'actions': {},
            'factions': {},
            'players': {},
            'rules': rules,
            'secret': random.getrandbits(256).to_bytes(256 // 8, 'little')
        }

        self.effect_trace_index = 0
        self.action_group = 0

    def make_friends(self, players):
        for player in players:
            for friend in players:
                if player is friend:
                    continue

                player.traits.append(self.make_effect(
                    type=self.tycon('Friendship', friend=friend)))

    def make_action_group(self):
        i = self.action_group
        self.action_group += 1
        return i

    def make_grant(self, action, group, compulsion='Voluntary',
                   irrevocable=False, *args, **kwargs):
        return self.make_effect(
            type=self.tycon('Granted', grantedAction=action, grantedGroup=group,
                            grantedCompulsion=compulsion,
                            grantedIrrevocable=irrevocable),
            *args, **kwargs)

    def declare_action(self, command, description, **kwargs):
        kwargs.setdefault('ninja', False)

        ref = Ref(len(self.meta['actions']), {
            'command': command,
            'description': description
        }, kwargs)
        self.meta['actions'][ref.token] = ref.meta
        self.state['actions'][ref.token] = ref.traits
        return ref

    def declare_faction(self, name, agenda, **kwargs):
        kwargs.setdefault('winCondition', self.tycon('Primary'))
        kwargs.setdefault('inCahoots', False)

        ref = Ref(len(self.meta['factions']), {
            'name': name,
            'agenda': agenda
        }, kwargs)
        self.meta['factions'][ref.token] = ref.meta
        self.state['factions'][ref.token] = ref.traits
        return ref

    def declare_player(self, name, role, abilities, effects=None):
        if effects is None:
            effects = []

        ref = Ref(len(self.meta['players']), {
            'name': name,
            'role': role,
            'abilities': abilities
        }, effects)
        self.meta['players'][ref.token] = ref.meta
        self.state['players'][ref.token] = ref.traits
        return ref

    def make_effect(self, type, turnsLeft=None, phasesActive=None, uses=None):
        if phasesActive is None:
            phasesActive = {'Night', 'Day'}

        effect = {
            'type': type,
            'turnsLeft': turnsLeft,
            'phasesActive': phasesActive,
            'uses': uses,
            'trace': self.tycon('EffectFromStart',
                                index=self.effect_trace_index)
        }
        self.effect_trace_index += 1
        return effect

    @staticmethod
    def tycon(tag, **kwargs):
        return {tag: kwargs if kwargs else []}

    def build_state(self, stream=None):
        return yaml.dump(self.state, stream, Dumper=StateDumper)

    def build_meta(self, stream=None):
        return yaml.dump(self.meta, stream, default_flow_style=False)

    def write(self, directory):
        os.mkdir(directory)

        with open(os.path.join(directory, 'state.yml'), 'w') as f:
            self.build_state(f)

        with open(os.path.join(directory, 'meta.yml'), 'w') as f:
            self.build_meta(f)


class StateDumper(yaml.SafeDumper):
    def ignore_aliases(self, data):
        return True


@functools.partial(StateDumper.add_representer, set)
def set_representer(dumper, data):
    return dumper.represent_list(data)


@functools.partial(StateDumper.add_representer, Ref)
def ref_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:int', str(data.token))
