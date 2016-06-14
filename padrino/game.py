import os
import jwt
import yaml


class Game(object):
    def __init__(self, root):
        self.root = root
        self.meta = yaml.load(os.path.join(self.root, 'meta.yml'))

    def decode_token(self, token):
        return jwt.decode(token, self.meta['secret'], algorithms=['HS256'])['t']
