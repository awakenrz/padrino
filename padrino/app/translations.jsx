import {defineMessages} from 'react-intl';

export default defineMessages({
    'info.greeting.title': {
        id: 'info.greeting.title',
        defaultMessage: 'Greeting',
        description: 'Title of the Greeting info message.'
    },

    'info.greeting.description': {
        id: 'info.greeting.description',
        defaultMessage: '{greeter} says howdy from the {faction} faction!',
        description: 'Description of the Greeting info message.'
    },

    'info.guilt.title': {
        id: 'info.guilt.title',
        defaultMessage: 'Guilt',
        description: 'Title of the Guilt info message.'
    },

    'info.guilt.positive': {
        id: 'info.guilt.positive',
        defaultMessage: 'guilty',
        description: 'The player is guilty.'
    },

    'info.guilt.negative': {
        id: 'info.guilt.negative',
        defaultMessage: 'not guilty',
        description: 'The player is not guilty.'
    },

    'info.fruit.title': {
        id: 'info.fruit.title',
        defaultMessage: 'Fruit',
        description: 'Title of the Fruit info message.'
    },

    'info.fruit.description': {
        id: 'info.fruit.description',
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
    }
});
