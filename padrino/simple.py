def make_simple(b):
    KILL = b.declare_action(
        'kill $0',
        'Kills a player.',
        type=b.tycon('Kill'))

    class Factions:
        TOWN = b.declare_faction(
            'Town',
            'Eradicate all members of the mafia.')
        MAFIA = b.declare_faction(
            'Mafia',
            'Eradicate all members of the town.')

    MAFIA_ACTION_GROUP = b.make_action_group()

    class Actions:
        FRUIT_VEND = b.declare_action(
            'vend fruit to $0',
            'Give a player a piece of fruit.',
            type=b.tycon('FruitVend'))

        STRONGMAN_KILL = b.declare_action(
            'strongman kill $0',
            'Kills a player, ignoring protection.',
            type=b.tycon('StrongmanKill'))

        PROTECT = b.declare_action(
            'protect $0',
            'Protects another player.',
            type=b.tycon('Protect'))

        INVESTIGATE = b.declare_action(
            'investigate $0',
            'Investigates a player to see if they are part of the Mafia.',
            type=b.tycon('Investigate', guiltyFactions={Factions.MAFIA}))

        ROLEBLOCK = b.declare_action(
            'roleblock $0',
            'Stops a player from performing their action.',
            type=b.tycon('Roleblock'))

        DRIVE = b.declare_action(
            'drive $0 with $1',
            'Make all actions targeting one player target another, and vice '
            'versa.',
            type=b.tycon('Drive'))

        REDIRECT = b.declare_action(
            'redirect $0 to $1',
            'Make all actions that a player performs target a different '
            'player.',
            type=b.tycon('Redirect'))

        DEFLECT = b.declare_action(
            'deflect $0 to $1',
            'Make all actions targeting a player target a different player.',
            type=b.tycon('Deflect'))

        WATCH = b.declare_action(
            'watch $0',
            'See all players who visited a player at night.',
            type=b.tycon('Watch'))

        TRACK = b.declare_action(
            'track $0',
            'See all players who a player visited at night.',
            type=b.tycon('Track'))

        FOLLOW = b.declare_action(
            'follow $0',
            'See all actions a player performed at night.',
            type=b.tycon('Follow'))

        VOYEUR = b.declare_action(
            'voyeur $0',
            'See all actions performed on a player at night.',
            type=b.tycon('Voyeur'))

    Actions.KILL = KILL

    class Simple:
        TOWN = lambda: [b.make_effect(
            type=b.tycon('Recruited', recruitedFaction=Factions.TOWN))]
        MAFIA = lambda: [
            b.make_effect(
                type=b.tycon('Recruited', recruitedFaction=Factions.MAFIA)),
            b.make_effect(
                type=b.tycon('Granted', grantedAction=Actions.KILL,
                             grantedGroup=MAFIA_ACTION_GROUP))]

        GODFATHER = lambda: [b.make_effect(
            type=b.tycon('Framed', framedFaction=Factions.TOWN))]
        STRONGMAN = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.STRONGMAN_KILL,
                         grantedGroup=MAFIA_ACTION_GROUP))]
        FRUIT_VENDOR = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.FRUIT_VEND,
                         grantedGroup=b.make_action_group()))]
        DOCTOR = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.PROTECT,
                         grantedGroup=b.make_action_group()))]
        VIGILANTE = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.KILL,
                         grantedGroup=b.make_action_group()))]
        COP = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.INVESTIGATE,
                         grantedGroup=b.make_action_group()))]
        ROLEBLOCKER = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.ROLEBLOCK,
                         grantedGroup=b.make_action_group()))]
        BUS_DRIVER = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.DRIVE,
                         grantedGroup=b.make_action_group()))]
        REDIRECTOR = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.REDIRECT,
                         grantedGroup=b.make_action_group()))]
        DEFLECTOR = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.DEFLECT,
                         grantedGroup=b.make_action_group()))]
        WATCHER = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.WATCH,
                         grantedGroup=b.make_action_group()))]
        TRACKER = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.TRACK,
                         grantedGroup=b.make_action_group()))]
        FOLLOWER = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.FOLLOW,
                         grantedGroup=b.make_action_group()))]
        VOYEUR = lambda: [b.make_effect(
            type=b.tycon('Granted', grantedAction=Actions.VOYEUR,
                         grantedGroup=b.make_action_group()))]

    Simple.Actions = Actions
    Simple.Factions = Factions

    return Simple
