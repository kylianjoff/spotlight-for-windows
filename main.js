const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const FileSearcher = require('./search.js');

let mainWindow;
let searcher;

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

  // Initialiser le searcher
  searcher = new FileSearcher();

  // Lancer l'indexation en arrière-plan
  searcher.buildIndex().then(() => {
    console.log('Index prêt !');
  });

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

// Gérer les recherches
ipcMain.handle('search-files', async (event, query) => {
  if (!searcher) return [];
  return searcher.search(query, 15);
});

// Ouvrir un fichier
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});