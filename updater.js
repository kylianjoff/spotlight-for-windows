const { autoUpdater } = require('electron-updater');
const { dialog } = require('electron');

class UpdateManager {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.updateAvailable = false;
        this.updateInfo = null;

        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = false;

        this.setupListeners();
    }

    setupListeners() {
        autoUpdater.on('update-available', (info) => {
            console.log('[Updater] Mise à jour disponible:', info.version);
            this.updateAvailable = true;
            this.updateInfo = info;

            if(this.mainWindow) {
                this.mainWindow.webContents.send('update-available', {
                    version: info.version,
                    currentVersion: autoUpdater.currentVersion.version
                });
            }
        });

        autoUpdater.on('update-not-available', () => {
            console.log('[Updater] Application à jour');
            this.updateAvailable = false;

            if(this.mainWindow) {
                this.mainWindow.webContents.send('update-not-available');
            }
        });

        autoUpdater.on('error', (error) => {
            console.error('[Updater] Erreur:', error);

            if(this.mainWindow) {
                this.mainWindow.webContents.send('update-error', error.message);
            }
        });

        autoUpdater.on('download-progress', (progressObj) => {
            console.log(`[Updater] Téléchargement: ${Math.round(progressObj.percent)}%`);

            if(this.mainWindow) {
                this.mainWindow.webContents.send('download-progress', {
                    percent: Math.round(progressObj.percent),
                    transferred: progressObj.transferred,
                    total: progressObj.total
                });
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('[Updater] Mise à jour téléchargée');

            if(this.mainWindow) {
                this.mainWindow.webContents.send('update-downloaded', {
                    version: info.version
                });
            }
        });
    }

    async checkForUpdates() {
        console.log('[Updater] Vérification des mises à jour...');
        try {
            const result = await autoUpdater.checkForUpdates();
            return result;
        } catch(error) {
            console.error('[Updater] Erreur vérification:', error);
            return null;
        }
    }

    async downloadUpdate() {
        console.log('[Updater] Téléchargement de la mise à jour ...');
        try {
            await autoUpdater.downloadUpdate();
        } catch(error) {
            console.error('[Updater] Erreur téléchargement:', error);
            throw error;
        }
    }

    quitAndInstall() {
        console.log('[Updater] Installation et redémarrage...');
        autoUpdater.quitAndInstall(false, true);
    }

    getStatus() {
        return {
            updateAvailable: this.updateAvailable,
            updateInfo: this.updateInfo
        };
    }
}

module.exports = UpdateManager;