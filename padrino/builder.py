import functools
import jwt
import os
import random
import subprocess
import yaml


class Ref(object):
    def __init__(self, token, meta, traits):
        self.token = token
        self.meta = meta
        self.traits = traits


class Builder(object):
    def __init__(self, name, motd=None):
        self.state = {
            'history': [],
            'turn': 1,
            'actions': {},
            'factions': {},
            'players': {},
            'rng': self.make_rng_state()
        }

        self.meta = {
            'name': name,
            'motd': motd,
            'actions': {},
            'factions': {},
            'players': {},
            'secret': random.getrandbits(256).to_bytes(256 // 8, 'little')
        }

        self.effect_trace_index = 0

    @staticmethod
    def make_rng_state():
        return subprocess.check_output([
            '%s/new-rng' % os.environ['COSANOSTRA_BIN_DIR']
        ]).strip().decode('utf-8')

    def declare_action(self, command, description, **kwargs):
        kwargs.setdefault('compulsion', 'Voluntary')
        kwargs.setdefault('ninja', False)
        kwargs.setdefault('weakTo', set())

        ref = Ref(len(self.meta['actions']), {
            'command': command,
            'description': description
        }, kwargs)
        self.meta['actions'][ref.token] = ref.meta
        self.state['actions'][ref.token] = ref.traits
        return ref

    def declare_faction(self, name, **kwargs):
        kwargs.setdefault('winCondition', self.tycon('Primary'))
        kwargs.setdefault('membersKnown', False)
        kwargs.setdefault('actionSets', [])

        ref = Ref(len(self.meta['factions']), {
            'name': name
        }, kwargs)
        self.meta['factions'][ref.token] = ref.meta
        self.state['factions'][ref.token] = ref.traits
        return ref

    def declare_player(self, name, role, effects=None):
        if effects is None:
            effects = []

        ref = Ref(len(self.meta['players']), {
            'name': name,
            'role': role
        }, effects)
        self.meta['players'][ref.token] = ref.meta
        self.state['players'][ref.token] = ref.traits
        return ref

    def make_effect(self, type, turns=None, uses=None, affectsDay=True):
        effect = {
            'type': type,
            'turns': turns,
            'uses': uses,
            'affectsDay': affectsDay,
            'trace': {
                'index': self.effect_trace_index,
                'origin': self.tycon('EffectFromStart')
            }
        }
        self.effect_trace_index += 1
        return effect

    @staticmethod
    def tycon(tag, **kwargs):
        return {tag: kwargs if kwargs else []}

    def build_state(self, stream=None):
        return yaml.dump(self.state, stream, Dumper=Dumper)

    def build_meta(self, stream=None):
        return yaml.dump(self.meta, stream, Dumper=Dumper)

    def write(self, directory):
        with open(os.path.join(directory, 'state.yml'), 'w') as f:
            self.build_state(f)

        with open(os.path.join(directory, 'meta.yml'), 'w') as f:
            self.build_meta(f)

    def encode_token(self, who):
        return jwt.encode({'t': who.token}, self.meta['secret'],
                          algorithm='HS256')


class Dumper(yaml.SafeDumper):
    def ignore_aliases(self, data):
        return True


@functools.partial(Dumper.add_representer, set)
def set_representer(dumper, data):
    return dumper.represent_list(data)


@functools.partial(Dumper.add_representer, Ref)
def ref_representer(dumper, data):
    return dumper.represent_scalar('tag:yaml.org,2002:int', str(data.token))
