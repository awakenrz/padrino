def make_simple(b):
    KILL = b.declare_action(
        'kill $0',
        'Kills a player.',
        type=b.datacons.Kill())

    class Factions:
        TOWN = b.declare_faction(
            'Town',
            'Eradicate all members of the mafia.', {
                'Vanilla': 'Vanilla Townie'
            })
        MAFIA = b.declare_faction(
            'Mafia',
            'Eradicate all members of the town.', {
                'Vanilla': 'Mafia Goon'
            })

    MAFIA_ACTION_GROUP = b.make_action_group()

    class Actions:
        FRUIT_VEND = b.declare_action(
            'vend fruit to $0',
            'Give a player a piece of fruit.',
            type=b.datacons.FruitVend())

        STRONGMAN_KILL = b.declare_action(
            'strongman kill $0',
            'Kills a player, ignoring protection.',
            type=b.datacons.StrongmanKill())

        DESPERADO_KILL = b.declare_action(
            'desperado kill $0',
            'Kills a player if they are scum, otherwise kills you.',
            type=b.datacons.DesperadoKill(killableFactions={Factions.MAFIA}))

        PROTECT = b.declare_action(
            'protect $0',
            'Protects another player from kills for one phase.',
            type=b.datacons.Protect())

        INVESTIGATE = b.declare_action(
            'investigate $0',
            'Investigates a player to see if they are part of the Mafia.',
            type=b.datacons.Investigate(guiltyFactions={Factions.MAFIA}))

        ROLE_INVESTIGATE = b.declare_action(
            "investigate $0's role",
            'Investigates a player to see their role.',
            type=b.datacons.RoleInvestigate())

        ROLEBLOCK = b.declare_action(
            'roleblock $0',
            'Stops a player from performing their action for one phase.',
            type=b.datacons.Roleblock())

        DRIVE = b.declare_action(
            'drive $0 with $1',
            'Make all actions targeting one player target another, and vice '
            'versa, for one phase.',
            type=b.datacons.Drive())

        REDIRECT = b.declare_action(
            'redirect $0 to $1',
            'Make all actions that a player performs target another player for '
            'one phase.',
            type=b.datacons.Redirect())

        DEFLECT = b.declare_action(
            'deflect $0 to $1',
            'Make all actions targeting a player target another player for one '
            'phase.',
            type=b.datacons.Deflect())

        FRAME = b.declare_action(
            'frame $0',
            'Frame someone as being part of the Mafia for one phase.',
            type=b.datacons.Frame(framedFaction=Factions.MAFIA))

        WATCH = b.declare_action(
            'watch $0',
            'See all players who visited a player at night.',
            type=b.datacons.Watch())

        TRACK = b.declare_action(
            'track $0',
            'See all players who a player visited at night.',
            type=b.datacons.Track())

        FOLLOW = b.declare_action(
            'follow $0',
            'See all actions a player performed at night.',
            type=b.datacons.Follow())

        VOYEUR = b.declare_action(
            'voyeur $0',
            'See all actions performed on a player at night.',
            type=b.datacons.Voyeur())

        FORENSIC_INVESTIGATE = b.declare_action(
            'forensic investigate $0',
            'See all players ever who targeted a dead player.',
            type=b.datacons.ForensicInvestigate())

        VETO = b.declare_action(
            'veto',
            'Stop a lynching from occurring.',
            type=b.datacons.Veto())

        SUICIDE = b.declare_action(
            'commit suicide',
            'Commit suicide.',
            type=b.datacons.Suicide())

        STEAL_VOTE = b.declare_action(
            'steal vote from $0',
            'Steal a vote from another player.',
            type=b.datacons.StealVote())

    Actions.KILL = KILL

    class Simple:
        TOWN = lambda: [b.make_effect(
            type=b.datacons.Recruited(recruitedFaction=Factions.TOWN))]
        MAFIA = lambda: [
            b.make_effect(
                type=b.datacons.Recruited(recruitedFaction=Factions.MAFIA)),
            b.make_grant(Actions.KILL, MAFIA_ACTION_GROUP,
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]

        GODFATHER = lambda: [
            b.make_effect(type=b.datacons.Framed(framedFaction=Factions.TOWN))]
        STRONGMAN = lambda: [
            b.make_grant(Actions.STRONGMAN_KILL, MAFIA_ACTION_GROUP,
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        DESPERADO = lambda: [
            b.make_grant(Actions.DESPERADO_KILL, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        FRUIT_VENDOR = lambda: [
            b.make_grant(Actions.FRUIT_VEND, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        DOCTOR = lambda: [
            b.make_grant(Actions.PROTECT, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        VIGILANTE = lambda: [
            b.make_grant(Actions.KILL, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        COP = lambda: [
            b.make_grant(Actions.INVESTIGATE, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        ROLE_COP = lambda: [
            b.make_grant(Actions.ROLE_INVESTIGATE, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        ROLEBLOCKER = lambda: [
            b.make_grant(Actions.ROLEBLOCK, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        BUS_DRIVER = lambda: [
            b.make_grant(Actions.DRIVE, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        REDIRECTOR = lambda: [
            b.make_grant(Actions.REDIRECT, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        DEFLECTOR = lambda: [
            b.make_grant(Actions.DEFLECT, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        FRAMER = lambda: [
            b.make_grant(Actions.FRAME, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        WATCHER = lambda: [
            b.make_grant(Actions.WATCH, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        TRACKER = lambda: [
            b.make_grant(Actions.TRACK, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        FOLLOWER = lambda: [
            b.make_grant(Actions.FOLLOW, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        VOYEUR = lambda: [
            b.make_grant(Actions.VOYEUR, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]
        FORENSIC_INVESTIGATOR = lambda: [
            b.make_grant(Actions.FORENSIC_INVESTIGATE, b.make_action_group(),
                         constraint=b.atom(b.datacons.DuringPhase('Night')))]

    Simple.Actions = Actions
    Simple.Factions = Factions

    return Simple
