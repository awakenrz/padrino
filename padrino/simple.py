def make_simple(b):
    KILL = b.declare_action(
        'kill {targets[0]}',
        'Kills a player.',
        type=b.tycon('Kill'))


    class Factions:
        TOWN = b.declare_faction('Town')

        MAFIA = b.declare_faction(
            'Mafia', membersKnown=True, actionSets=[{KILL}])


    class Actions:
        STRONGMAN_KILL= b.declare_action(
            'strongman kill {targets[0]}',
            'Kills a player, ignoring protection.',
            type=b.tycon('StrongmanKill'))

        PROTECT = b.declare_action(
            'protect {targets[0]}',
            'Protects another player.',
            type=b.tycon('Protect'))

        INVESTIGATE = b.declare_action(
            'investigate {targets[0]}',
            'Investigates a player to see if they are part of the Mafia.',
            type=b.tycon('Investigate', guiltyFactions={Factions.MAFIA}))

        ROLEBLOCK = b.declare_action(
            'roleblock {targets[0]}',
            'Stops a player from performing their action.',
            type=b.tycon('Roleblock'))

        DRIVE = b.declare_action(
            'drive {targets[0]} with {targets[1]}',
            'Make all actions targeting one player target another, and vice '
            'versa.',
            type=b.tycon('Drive'))

        REDIRECT = b.declare_action(
            'redirect {targets[0]} to {targets[1]}',
            'Make all actions that a player performs target a different '
            'player.',
            type=b.tycon('Redirect'))

        DEFLECT = b.declare_action(
            'deflect {targets[0]} to {targets[1]}',
            'Make all actions targeting a player target a different player.',
            type=b.tycon('Deflect'))

        WATCH = b.declare_action(
            'watch {targets[0]}',
            'See all players who visited a player at night.',
            type=b.tycon('Watch'))

        TRACK = b.declare_action(
            'track {targets[0]}',
            'See all players who a player visited at night.',
            type=b.tycon('Track'))

        FOLLOW = b.declare_action(
            'follow {targets[0]}',
            'See all actions a player performed at night.',
            type=b.tycon('Follow'))

        PEEP = b.declare_action(
            'peep {targets[0]}',
            'See all actions performed on a player at night.',
            type=b.tycon('Peep'))

    Actions.KILL = KILL

    class Simple:
        TOWN = [b.make_effect(
            type=b.tycon('Recruited', recruitedFaction=Factions.TOWN))]
        MAFIA = [b.make_effect(
            type=b.tycon('Recruited', recruitedFaction=Factions.MAFIA))]

        GODFATHER = [b.make_effect(
            type=b.tycon('Framed', framedFaction=Factions.TOWN))]
        STRONGMAN = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.STRONGMAN_KILL},
                         grantedSharedWithFaction=0))]
        DOCTOR = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.PROTECT},
                         grantedSharedWithFaction=None))]
        VIGILANTE = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.KILL},
                         grantedSharedWithFaction=None))]
        COP = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.INVESTIGATE},
                         grantedSharedWithFaction=None))]
        ROLEBLOCKER = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.ROLEBLOCK},
                         grantedSharedWithFaction=None))]
        BUS_DRIVER = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.DRIVE},
                         grantedSharedWithFaction=None))]
        REDIRECTOR = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.REDIRECT},
                         grantedSharedWithFaction=None))]
        DEFLECTOR = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.DEFLECT},
                         grantedSharedWithFaction=None))]
        WATCHER = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.WATCH},
                         grantedSharedWithFaction=None))]
        TRACKER = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.TRACK},
                         grantedSharedWithFaction=None))]
        FOLLOWER = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.FOLLOW},
                         grantedSharedWithFaction=None))]
        VOYEUR = [b.make_effect(
            type=b.tycon('Granted', grantedActionSet={Actions.PEEP},
                         grantedSharedWithFaction=None))]

    Simple.Actions = Actions
    Simple.Factions = Factions

    return Simple
