class I18n {
    constructor() {
        this.currentLanguage = this.getStoredLanguage() || this.detectLanguage();
        this.translations = {};
        this.loadTranslations();
    }

    detectLanguage() {
        const systemLang = navigator.language || navigator.userLanguage;

        if(systemLang.startsWith('fr')) {
            return 'fr';
        }
        return 'en';
    }

    getStoredLanguage() {
        return localStorage.getItem('spotlight-language');
    }

    setLanguage(lang) {
        this.currentLanguage = lang;
        localStorage.setItem('spotlight-language', lang);
        this.updateUI();
    }

    loadTranslations() {
        this.translations = {
            en: {
                // Search
                'search.placeholder': 'Search applications, files, web...',
                'search.loading': 'Searching...',
                'search.noResults': 'No results found',
                'search.error': 'Error',

                // Sections
                'section.applications': 'Applications',
                'section.files': 'Files',
                'section.web': 'Web Search',

                // Result types
                'type.application': 'Application',
                'type.document': 'Document',
                'type.spreadsheet': 'Spreadsheet',
                'type.presentation': 'Presentation',
                'type.image': 'Image',
                'type.video': 'Video',
                'type.audio': 'Audio',
                'type.code': 'Code',
                'type.archive': 'Archive',
                'type.file': 'File',

                // Sources
                'source.steam': 'Steam',
                'source.epic': 'Epic',
                'source.store': 'Store',
                'source.installed': 'Installed',
                'source.system': 'System',

                // Web search
                'web.searchOn': 'Search "{query}" on {engine}',
                'web.google': 'Google',
                'web.wikipedia': 'Wikipedia',

                // Actions
                'action.open': 'Open',
                'action.openInBrowser': 'Open in browser',

                // Settings
                'settings.title': 'Settings',
                'settings.language': 'Language',
                'settings.theme': 'Theme',
                'settings.hotkey': 'Hotkey',
                'settings.autolaunch': 'Launch at startup',
            },

            fr: {
                // Search
                'search.placeholder': 'Rechercher applications, fichiers, web...',
                'search.loading': 'Recherche...',
                'search.noResults': 'Aucun résultat trouvé',
                'search.error': 'Erreur',

                // Sections
                'section.applications': 'Applications',
                'section.files': 'Fichiers',
                'section.web': 'Recherche Web',

                // Result types
                'type.application': 'Application',
                'type.document': 'Document',
                'type.spreadsheet': 'Tableur',
                'type.presentation': 'Présentation',
                'type.image': 'Image',
                'type.video': 'Vidéo',
                'type.audio': 'Audio',
                'type.code': 'Code',
                'type.archive': 'Archive',
                'type.file': 'Fichier',

                // Sources
                'source.steam': 'Steam',
                'source.epic': 'Epic',
                'source.store': 'Store',
                'source.installed': 'Installé',
                'source.system': 'Système',

                // Web search
                'web.searchOn': 'Rechercher "{query}" sur {engine}',
                'web.google': 'Google',
                'web.wikipedia': 'Wikipedia',

                // Actions
                'action.open': 'Ouvrir',
                'action.openInBrowser': 'Ouvrir dans le navigateur',

                // Settings
                'settings.title': 'Paramètres',
                'settings.language': 'Langue',
                'settings.theme': 'Thème',
                'settings.hotkey': 'Raccourci clavier',
                'settings.autolaunch': 'Lancer au démarrage',
            }
        };
    }

    t(key, params = {}) {
        let translation = this.translations[this.currentLanguage]?.[key] || key;

        // Remplacer les paramètres {variable}
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{${param}}`, params[param]);
        });

        return translation;
    }

    updateUI() {
        // Mettre à jour les éléments avec data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });

        // Mettre à jour les placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        // Emettre un événement pour que le code puisse réagir
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: this.currentLanguage }
        }));
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return [
            { code: 'en', name: 'English', nativeName: 'English' },
            { code: 'fr', name: 'French', nativeName: 'Français' }
        ];
    }
}

const i18n = new I18n();