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

        DESPERADO_KILL = b.declare_action(
            'desperado kill $0',
            'Kills a player if they are scum, otherwise kills you.',
            type=b.tycon('Weak',
                weakFaction=Factions.TOWN,
                realActionType=b.tycon('Kill'),
                weakKillAction=KILL,
                blocksAction=True))

        PROTECT = b.declare_action(
            'protect $0',
            'Protects another player from kills for one phase.',
            type=b.tycon('Protect'))

        INVESTIGATE = b.declare_action(
            'investigate $0',
            'Investigates a player to see if they are part of the Mafia.',
            type=b.tycon('Investigate', guiltyFactions={Factions.MAFIA}))

        ROLE_INVESTIGATE = b.declare_action(
            "investigate $0's role",
            'Investigates a player to see their role.',
            type=b.tycon('RoleInvestigate'))

        ROLEBLOCK = b.declare_action(
            'roleblock $0',
            'Stops a player from performing their action for one phase.',
            type=b.tycon('Roleblock'))

        DRIVE = b.declare_action(
            'drive $0 with $1',
            'Make all actions targeting one player target another, and vice '
            'versa, for one phase.',
            type=b.tycon('Drive'))

        REDIRECT = b.declare_action(
            'redirect $0 to $1',
            'Make all actions that a player performs target another player for '
            'one phase.',
            type=b.tycon('Redirect'))

        DEFLECT = b.declare_action(
            'deflect $0 to $1',
            'Make all actions targeting a player target another player for one '
            'phase.',
            type=b.tycon('Deflect'))

        FRAME = b.declare_action(
            'frame $0',
            'Frame someone as being part of the Mafia for one phase.',
            type=b.tycon('Frame', framedFaction=Factions.MAFIA))

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

        AUTOPSY = b.declare_action(
            'autopsy $0',
            'See all players ever who targeted a dead player.',
            type=b.tycon('Autopsy'))

        VETO = b.declare_action(
            'veto',
            'Stop a lynching from occurring.',
            type=b.tycon('Veto'))

        SUICIDE = b.declare_action(
            'commit suicide',
            'Commit suicide.',
            type=b.tycon('Suicide'))

        STEAL_VOTE = b.declare_action(
            'steal vote from $0',
            'Steal a vote from another player.',
            type=b.tycon('StealVote'))

    Actions.KILL = KILL

    class Simple:
        TOWN = lambda: [b.make_effect(
            type=b.tycon('Recruited', recruitedFaction=Factions.TOWN))]
        MAFIA = lambda: [
            b.make_effect(type=b.tycon('Recruited',
                                       recruitedFaction=Factions.MAFIA)),
            b.make_grant(Actions.KILL, MAFIA_ACTION_GROUP,
                         phasesActive={'Night'})]

        GODFATHER = lambda: [
            b.make_effect(type=b.tycon('Framed',
                                       framedFaction=Factions.TOWN))]
        STRONGMAN = lambda: [
            b.make_grant(Actions.STRONGMAN_KILL, MAFIA_ACTION_GROUP,
                         phasesActive={'Night'})]
        DESPERADO = lambda: [
            b.make_grant(Actions.DESPERADO_KILL, b.make_action_group(),
                         phasesActive={'Night'})]
        FRUIT_VENDOR = lambda: [
            b.make_grant(Actions.FRUIT_VEND, b.make_action_group(),
                         phasesActive={'Night'})]
        DOCTOR = lambda: [
            b.make_grant(Actions.PROTECT, b.make_action_group(),
                         phasesActive={'Night'})]
        VIGILANTE = lambda: [
            b.make_grant(Actions.KILL, b.make_action_group(),
                         phasesActive={'Night'})]
        COP = lambda: [
            b.make_grant(Actions.INVESTIGATE, b.make_action_group(),
                         phasesActive={'Night'})]
        ROLE_COP = lambda: [
            b.make_grant(Actions.ROLE_INVESTIGATE, b.make_action_group(),
                         phasesActive={'Night'})]
        ROLEBLOCKER = lambda: [
            b.make_grant(Actions.ROLEBLOCK, b.make_action_group(),
                         phasesActive={'Night'})]
        BUS_DRIVER = lambda: [
            b.make_grant(Actions.DRIVE, b.make_action_group(),
                         phasesActive={'Night'})]
        REDIRECTOR = lambda: [
            b.make_grant(Actions.REDIRECT, b.make_action_group(),
                         phasesActive={'Night'})]
        DEFLECTOR = lambda: [
            b.make_grant(Actions.DEFLECT, b.make_action_group(),
                         phasesActive={'Night'})]
        FRAMER = lambda: [
            b.make_grant(Actions.FRAME, b.make_action_group(),
                         phasesActive={'Night'})]
        WATCHER = lambda: [
            b.make_grant(Actions.WATCH, b.make_action_group(),
                         phasesActive={'Night'})]
        TRACKER = lambda: [
            b.make_grant(Actions.TRACK, b.make_action_group(),
                         phasesActive={'Night'})]
        FOLLOWER = lambda: [
            b.make_grant(Actions.FOLLOW, b.make_action_group(),
                         phasesActive={'Night'})]
        VOYEUR = lambda: [
            b.make_grant(Actions.VOYEUR, b.make_action_group(),
                         phasesActive={'Night'})]
        FORENSIC_INVESTIGATOR = lambda: [
            b.make_grant(Actions.AUTOPSY, b.make_action_group(),
                         phasesActive={'Night'})]

    Simple.Actions = Actions
    Simple.Factions = Factions

    return Simple
