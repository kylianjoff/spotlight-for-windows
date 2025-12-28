const { app, BrowserWindow, globalShortcut, ipcMain, shell, app: electronApp } = require('electron');
const path = require('path');
const FileSearcher = require('./search.js');
const { exec } = require('child_process');

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

// Ouvrir un fichier ou application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    console.log('Ouverture de:', filePath);
    
    // Si c'est un raccourci .lnk, utiliser une méthode spéciale
    if (filePath.endsWith('.lnk')) {
      return new Promise((resolve) => {
        // Utiliser PowerShell pour ouvrir le raccourci
        exec(`powershell -command "Start-Process '${filePath}'"`, (error) => {
          if (error) {
            console.error('Erreur PowerShell:', error);
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    }
    
    // Sinon, utiliser shell.openPath normal
    const result = await shell.openPath(filePath);
    
    if (result) {
      // result contient un message d'erreur si échec
      return { success: false, error: result };
    }
    
    return { success: true };
  } catch (error) {
    console.error('Erreur ouverture:', error);
    return { success: false, error: error.message };
  }
});

// Handler pour obtenir l'icône d'une app
ipcMain.handle('get-app-icon', async (event, appPath) => {
  if (!searcher || !searcher.iconExtractor) return null;
  
  try {
    const iconPath = await searcher.iconExtractor.extractIcon(appPath, 'app');
    return iconPath;
  } catch (error) {
    return null;
  }
});

// Ouvrir une URL dans le navigateur par défaut
ipcMain.handle('open-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});