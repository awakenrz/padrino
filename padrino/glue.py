import os
import shlex
import subprocess
import yaml

COSANOSTRA_GLUE_BIN_DIR = os.environ['COSANOSTRA_GLUE_BIN_DIR']
COSANOSTRA_GLUE_ARGS = shlex.split(os.environ.get('COSANOSTRA_GLUE_ARGS', ''))

class GlueError(Exception):
    pass


def run(prog, *args, input=None):
    proc = subprocess.Popen([
        os.path.join(os.environ['COSANOSTRA_GLUE_BIN_DIR'], prog),
    ] + COSANOSTRA_GLUE_ARGS + list(args),
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if input is not None:
        proc.stdin.write(yaml.dump(input).encode('utf-8'))
        proc.stdin.close()

    err = proc.stderr.read().decode('utf-8').strip()

    retcode = proc.wait()
    if retcode != 0:
        raise GlueError(err)

    return yaml.load(proc.stdout)
