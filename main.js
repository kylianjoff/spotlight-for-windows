const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    frame: false,              // Pas de bordure Windows
    transparent: true,         // Fond transparent
    alwaysOnTop: true,        // Toujours au-dessus
    skipTaskbar: true,        // Pas dans la barre des tâches
    show: false,              // Caché au démarrage
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Centrer la fenêtre
  mainWindow.center();

  // Charger l'interface
  mainWindow.loadFile('src/index.html');

  // Cacher quand on clique en dehors
  mainWindow.on('blur', () => {
    mainWindow.hide();
  });
}

app.whenReady().then(() => {
  createWindow();

  // Enregistrer le raccourci global : Windows+Alt
  const ret = globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!ret) {
    console.log('Échec enregistrement raccourci');
  }
});

// Quitter quand toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Libérer les raccourcis
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Gérer la fermeture depuis le renderer
ipcMain.on('hide-window', () => {
  mainWindow.hide();
});