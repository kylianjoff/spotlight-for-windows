class I18n {
    constructor() {
        this.currentLanguage = window.settings ? window.settings.get('language') : this.detectLanguage();
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

        if(window.settings) {
            window.settings.set('language', lang);
        }
        this.updateUI();
    }

    async loadTranslations() {
        try {
            const languages = ['en', 'fr'];

            for (const lang of languages) {
                try {
                    const response = await fetch(`locales/${lang}.json`);
                    if(response.ok) {
                        const data = await response.json();

                        this.translations[lang] = this.flattenObject(data);
                        console.log(`[i18n] Langue ${lang} chargée avec succès`);
                    }
                } catch (error) {
                    console.error(`[i18n] Erreur chargement ${lang}:`, error);
                }
            }
            this.updateUI();
        } catch (error) {
            console.error('[i18n] Erreur lors du chargement des traductions:', error);
        }
    }

    flattenObject(obj, prefix = '') {
        return Object.keys(obj).reduce((acc, key) => {
            const prefixedKey = prefix ? `${prefix}.${key}` : key;

            if(typeof obj[key] == 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                Object.assign(acc, this.flattenObject(obj[key], prefixedKey));
            } else {
                acc[prefixedKey] = obj[key];
            }

            return acc;
        }, {});
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

window.i18n = new I18n();
console.log('[i18n] Langue détectée:', window.i18n.getCurrentLanguage());