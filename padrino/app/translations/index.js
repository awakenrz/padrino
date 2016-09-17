import {defineMessages} from 'react-intl';

export default defineMessages({
    'action.value.true': {
        id: 'action.value.true',
        defaultMessage: 'on'
    },

    'action.value.false': {
        id: 'action.value.false',
        defaultMessage: 'off'
    },

    'action.compulsion.forced': {
        id: 'action.compulsion.forced',
        defaultMessage: '(forced)'
    },

    'action.compulsion.required': {
        id: 'action.compulsion.required',
        defaultMessage: '(compelled)'
    },

    'action.form.cancel': {
        id: 'action.form.cancel',
        defaultMessage: 'Cancel'
    },

    'placeholder.noOne': {
        id: 'placeholder.noOne',
        defaultMessage: 'no one'
    },

    'placeholder.someone': {
        id: 'placeholder.someone',
        defaultMessage: 'someone'
    },

    'message.players.title': {
        id: 'message.players.title',
        defaultMessage: 'Players',
        description: 'Title of the Players info message.'
    },

    'message.players.negative': {
        id: 'message.players.negative',
        defaultMessage: 'no players',
        description: 'Message to display if there are no players.'
    },

    'message.actions.title': {
        id: 'message.actions.title',
        defaultMessage: 'Actions',
        description: 'Title of the Actions info message.'
    },

    'message.actions.negative': {
        id: 'message.actions.negative',
        defaultMessage: 'no actions',
        description: 'Message to display if there are no actions.'
    },

    'message.role.title': {
        id: 'message.role.title',
        defaultMessage: 'Role',
        description: 'Title of the Role info message.'
    },

    'message.greeting.title': {
        id: 'message.greeting.title',
        defaultMessage: 'Greeting',
        description: 'Title of the Greeting info message.'
    },

    'message.greeting.description': {
        id: 'message.greeting.description',
        defaultMessage: '{greeter} says howdy from the {faction} faction!',
        description: 'Description of the Greeting info message.'
    },

    'message.guilt.title': {
        id: 'message.guilt.title',
        defaultMessage: 'Guilt',
        description: 'Title of the Guilt info message.'
    },

    'message.guilt.positive': {
        id: 'message.guilt.positive',
        defaultMessage: 'guilty',
        description: 'The player is guilty.'
    },

    'message.guilt.negative': {
        id: 'message.guilt.negative',
        defaultMessage: 'not guilty',
        description: 'The player is not guilty.'
    },

    'message.fruit.title': {
        id: 'message.fruit.title',
        defaultMessage: 'Fruit',
        description: 'Title of the Fruit info message.'
    },

    'message.fruit.description': {
        id: 'message.fruit.description',
        defaultMessage: 'how... generous?',
        description: 'Description of the Fruit info message.'
    },

    'phase.actions.title': {
        id: 'phase.actions.title',
        defaultMessage: 'Actions',
        description: 'Title of the actions section for a phase.'
    },

    'will.title': {
        id: 'will.title',
        defaultMessage: 'Will',
        description: 'Title of the will section for a phase.'
    },

    'will.notLeavingWill': {
        id: 'will.notLeavingWill',
        defaultMessage: 'You are currently not leaving a will.',
        description: 'Message displayed if the player is not leaving a will.'
    },

    'will.help': {
        id: 'will.help',
        defaultMessage: 'You may use {formattingHelpLink} to format your text.',
        description: 'Help message for editing the will.'
    },

    'will.form.save': {
        id: 'will.form.save',
        defaultMessage: 'Save'
    },

    'will.form.cancel': {
        id: 'will.form.cancel',
        defaultMessage: 'Cancel'
    },

    'phase.actions.instantaneous': {
        id: 'phase.actions.instantaneous',
        defaultMessage: 'The following actions are instantaneous, so choose carefully if you want to use one!'
    },

    'phase.actions.wereInstantaneous': {
        id: 'phase.actions.wereInstantaneous',
        defaultMessage: 'The following actions were instantaneous:'
    },

    'phase.actions.available': {
        id: 'phase.actions.available',
        defaultMessage: 'The following actions are available:'
    },

    'phase.actions.wereAvailable': {
        id: 'phase.actions.wereAvailable',
        defaultMessage: 'The following actions were available:'
    },

    'phase.ending.primary': {
        id: 'phase.ending.primary',
        defaultMessage: 'ends in {timeLeft}'
    },

    'phase.ending.primaryOrConsensus': {
        id: 'phase.ending.primaryOrConsensus',
        defaultMessage: 'ends in {timeLeft} or on consensus reached'
    },

    'phase.ending.twilight': {
        id: 'phase.ending.twilight',
        defaultMessage: 'twilight ends in {timeLeft}'
    },

    'phase.ending.now': {
        id: 'phase.ending.now',
        defaultMessage: 'ending...'
    },

    'phase.ending.ended': {
        id: 'phase.ending.ended',
        defaultMessage: 'ended'
    },

    'phase.title.night': {
        id: 'phase.title.night',
        defaultMessage: 'Night {turn}'
    },

    'phase.title.day': {
        id: 'phase.title.day',
        defaultMessage: 'Day {turn}'
    },

    'phase.title.start': {
        id: 'phase.title.start',
        defaultMessage: 'Start'
    },

    'phase.title.end': {
        id: 'phase.title.end',
        defaultMessage: 'End'
    },

    'vote.abstain': {
        id: 'vote.abstain',
        defaultMessage: 'abstain'
    },

    'vote.yourVote': {
        id: 'vote.yourVote',
        defaultMessage: 'Your vote:'
    },

    'vote.form.save': {
        id: 'vote.form.save',
        defaultMessage: 'Save'
    },

    'vote.form.cancel': {
        id: 'vote.form.cancel',
        defaultMessage: 'Cancel'
    },

    'vote.help': {
        id: 'vote.help',
        defaultMessage: 'Vote for a player to be lynched.'
    },

    'ballot.title': {
        id: 'ballot.title',
        defaultMessage: 'Ballot'
    },

    'ballot.votes.title': {
        id: 'ballot.votes.title',
        defaultMessage: 'Votes cast:'
    },

    'ballot.votes.against': {
        id: 'ballot.votes.against',
        defaultMessage: 'against {name}'
    },

    'ballot.votes.notAgainst': {
        id: 'ballot.votes.notAgainst',
        defaultMessage: 'No votes cast against: {names}'
    },

    'ballot.abstentions.title': {
        id: 'ballot.abstentions.title',
        defaultMessage: 'Abstentions'
    },

    'ballot.abstentions.none': {
        id: 'ballot.abstentions.none',
        defaultMessage: 'no abstensions'
    },

    'ballot.consensus.title': {
        id: 'ballot.consensus.title',
        defaultMessage: 'Consensus criteria:'
    },

    'ballot.consensus.criteria.mostVotes': {
        id: 'ballot.consensus.criteria.mostVotes',
        defaultMessage: 'The player with the most votes will be lynched.'
    },

    'ballot.consensus.criteria.strictMajority': {
        id: 'ballot.consensus.criteria.strictMajority',
        defaultMessage: 'The player for whom the strict majority of votes are for will be lynched ({numVotesRequired} required).'
    },

    'death.will.none': {
        id: 'death.will.none',
        defaultMessage: 'They did not leave a will.'
    },

    'death.will.hidden': {
        id: 'death.will.hidden',
        defaultMessage: 'They left a will.'
    },

    'death.will.showing': {
        id: 'death.will.showing',
        defaultMessage: 'They left a will (shown below).'
    },

    'death.will.modkilled': {
        id: 'death.will.modkilled',
        defaultMessage: 'Their will is not available due to their removal from the game.'
    },

    'death.will.footer': {
        id: 'death.will.footer',
        defaultMessage: 'The last will and testament of {name}'
    },

    'death.reason.noLynch': {
        id: 'death.reason.noLynch',
        defaultMessage: 'Nobody was lynched.'
    },

    'death.reason.died': {
        id: 'death.reason.died',
        defaultMessage: '{name} the {role} died.'
    },

    'death.reason.lynched': {
        id: 'death.reason.lynched',
        defaultMessage: '{name} the {role} was lynched.'
    },

    'death.reason.foundDead': {
        id: 'death.reason.foundDead',
        defaultMessage: '{name} the {role} was found dead.'
    },

    'death.reason.noneFoundDead': {
        id: 'death.reason.noneFoundDead',
        defaultMessage: 'Nobody was found dead.'
    },

    'death.reason.modkilled': {
        id: 'death.reason.modkilled',
        defaultMessage: '{name} the {role} was removed from the game.'
    },

    'agenda.primary': {
        id: 'agenda.primary',
        defaultMessage: 'Eliminate all members of all other factions.'
    },

    'profile.role': {
        id: 'profile.role',
        defaultMessage: 'Role'
    },

    'profile.faction': {
        id: 'profile.faction',
        defaultMessage: 'Faction'
    },

    'profile.abilities': {
        id: 'profile.abilities',
        defaultMessage: 'Abilities'
    },

    'profile.agenda': {
        id: 'profile.agenda',
        defaultMessage: 'Agenda'
    },

    'profile.friends': {
        id: 'profile.friends',
        defaultMessage: 'Friends'
    },

    'profile.cohorts': {
        id: 'profile.cohorts',
        defaultMessage: 'Cohorts'
    },

    'profile.players': {
        id: 'profile.players',
        defaultMessage: 'Players'
    },

    'end.result.win': {
        id: 'end.result.win',
        defaultMessage: 'Congratulations, you won!'
    },

    'end.result.loss': {
        id: 'end.result.loss',
        defaultMessage: 'Sorry, better luck next time!'
    },

    'end.winners.title': {
        id: 'end.winners.title',
        defaultMessage: 'The winners are:'
    },

    'end.winners.none': {
        id: 'end.winners.none',
        defaultMessage: 'Nobody won.'
    },

    'roles.title': {
        id: 'roles.title',
        defaultMessage: 'Roles'
    },

    'actionLog.title': {
        id: 'actionLog.title',
        defaultMessage: 'Action Log'
    },

    'actionLog.description': {
        id: 'actionLog.description',
        defaultMessage: 'This is the log of all actions performed during the game. The ordering of actions is not significant – actions that are not struck out are guaranteed to have been performed.'
    },

    'actionLog.entry.hint.altered': {
        id: 'actionLog.entry.hint.altered',
        defaultMessage: '(altered)'
    },

    'actionLog.entry.hint.blocked': {
        id: 'actionLog.entry.hint.blocked',
        defaultMessage: '(blocked)'
    },

    'actionLog.entry.caused': {
        id: 'actionLog.entry.caused',
        defaultMessage: 'caused'
    },

    'actionLog.entry.nothingHappened': {
        id: 'actionLog.entry.nothingHappened',
        defaultMessage: 'Nothing happened.'
    },

    'error.permanent': {
        id: 'error.permanent',
        defaultMessage: 'Permanently disconnected from server: {reason}'
    },

    'error.temporary': {
        id: 'error.temporary',
        defaultMessage: 'Temporarily disconnected from server. We\'ll be back shortly!'
    },

    'loading': {
        id: 'loading',
        defaultMessage: 'Loading...'
    }
});
