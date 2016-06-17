import os
import subprocess
import yaml

COSANOSTRA_GLUE_BIN_DIR = os.environ['COSANOSTRA_GLUE_BIN_DIR']

class GlueError(Exception):
    pass


def run(prog, *args, input=None):
    proc = subprocess.Popen([
        os.path.join(os.environ['COSANOSTRA_GLUE_BIN_DIR'], prog)
    ] + list(args), stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    if input is not None:
        proc.stdin.write(yaml.dump(input).encode('utf-8'))
        proc.stdin.close()

    retcode = proc.wait()
    if retcode != 0:
        raise GlueError

    return yaml.load(proc.stdout)
