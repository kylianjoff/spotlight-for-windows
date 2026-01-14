class Settings {
    constructor() {
        this.storageKey = 'spotlight-settings';
        this.defaultSettings = {
            language: this.detectLanguage(),
            autoLaunch: true,
            hotkey: 'CommandOrControl+Alt+Space',
            theme: 'dark'
        };
    }

    detectLanguage() {
        const systemLang = navigator.language || navigator.userLanguage;
        return systemLang.startsWith('fr') ? 'fr' : 'en';
    }

    load() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const settings = JSON.parse(stored);
                console.log('[Settings] Chargés:', settings);
                return { ...this.defaultSettings, ...settings };
            }
        } catch (e) {
            console.error('[Settings] Erreur chargement:', e);
        }
        console.log('[Settings] Utilisation des défauts');
        return this.defaultSettings;
    }

    save(settings) {
        try {
            const toSave = { ...this.load(), ...settings };
            localStorage.setItem(this.storageKey, JSON.stringify(toSave));
            console.log('[Settings] Sauvegardés:', toSave);
            return true;
        } catch (e) {
            console.error('[Settings] Erreur sauvegarde:', e);
            return false;
        }
    }

    get(key) {
        const settings = this.load();
        return settings[key];
    }

    set(key, value) {
        const settings = this.load();
        settings[key] = value;
        return this.save(settings);
    }
}

window.settings = new Settings();
console.log('[Settings] Module chargé');