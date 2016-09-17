import {defineMessages} from 'react-intl';

export default defineMessages({
    'placeholders.noOne': {
        id: 'placeholders.noOne',
        defaultMessage: 'no one'
    },

    'placeholders.someone': {
        id: 'placeholders.someone',
        defaultMessage: 'someone'
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

    'phase.will.title': {
        id: 'phase.will.title',
        defaultMessage: 'Will',
        description: 'Title of the will section for a phase.'
    },

    'phase.will.notLeavingWill': {
        id: 'phase.will.notLeavingWill',
        defaultMessage: 'You are currently not leaving a will.',
        description: 'Message displayed if the player is not leaving a will.'
    },

    'phase.will.help': {
        id: 'phase.will.help',
        defaultMessage: 'You may use {formattingHelpLink} to format your text.',
        description: 'Help message for editing the will.'
    },

    'ballot.criteria.mostVotes': {
        id: 'ballot.criteria.mostVotes',
        defaultMessage: 'The player with the most votes will be lynched.'
    },

    'ballot.criteria.strictMajority': {
        id: 'ballot.criteria.strictMajority',
        defaultMessage: 'The player for whom the strict majority of votes are for will be lynched ({numVotesRequired} required).'
    }
});
