# Padrino

## Installing

1. Make sure you have a copy of [cosanostra](https://github.com/rfw/cosanostra)
   checked out.

2. Set the `COSANOSTRA_GLUE_BIN_DIR` environment variable to something sensible,
   e.g.

   ```
   export COSANOSTRA_GLUE_BIN_DIR=~/glue_bin
   ```

3. Inside the cosanostra directory, run:

   ```
   stack install --local-bin-path=$COSANOSTRA_GLUE_BIN_DIR
   ```

4. Inside the padrino directory, run:

   ```
   pip3 install -r requirements.txt
   ```

## Starting a game

1. You will need to write a game builder script in Python. Here is an example:

   ```
   from padrino import builder
   from padrino import simple

   b = builder.Builder('My Mafia Game', """
   Here is a description of my mafia game.

   Good luck everybody!
   """, tz='America/Los_Angeles')

   s = simple.make_simple(b)

   alice = b.declare_player('Alice', 'Town Doctor', s.TOWN() + s.DOCTOR())
   bob = b.declare_player('Bob', 'Vanilla Townie', s.TOWN())
   eve = b.declare_player('Eve', 'Mafia Goon', s.MAFIA())
   mallory = b.declare_godfather('Mallory', 'Mafia Godfather', s.MAFIA() + s.GODFATHER())

   b.make_friends([eve, mallory])

   b.write('game')
   ```

2. Start the game.

   ```
   python -m padrino.server --game_path <path to your game>
   ```

   If all is well, you will receive a token for each player. Distribute these
   tokens securely.
