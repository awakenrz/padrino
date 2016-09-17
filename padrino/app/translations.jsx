import {defineMessages} from 'react-intl';

export default defineMessages({
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
