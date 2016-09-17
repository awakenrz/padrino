import path from 'path';
import manageTranslations from 'react-intl-translations-manager';

var BUILD_DIR = path.resolve(__dirname, 'build');
var APP_DIR = path.resolve(__dirname, 'padrino/app');

manageTranslations({
    messagesDirectory: BUILD_DIR + '/i18n/definitions',
    translationsDirectory: APP_DIR + '/translations',
    languages: ['en-US', 'en-US-alt']
});
