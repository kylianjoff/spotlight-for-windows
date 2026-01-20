const { app, BrowserWindow, globalShortcut, ipcMain, shell, app: electronApp } = require('electron');
const path = require('path');
const FileSearcher = require('./search.js');
const { exec } = require('child_process');
const iconExtractor = require('./icon-extractor.js');
const UpdateManager = require('./updater.js');

if(process.platform === 'win32') {
  try {
    exec('chcp 65001', { encoding: 'utf8' });
  } catch(err) {
    // Ignorer si échec
  }
}

let mainWindow;
let splashWindow;
let searcher;
let updateManager;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const splashPath = path.join(__dirname, 'src', 'splash.html');
  console.log('[SPLASH] Création de la fenêtre...');
  console.log('[SPLASH] Chargement de:', splashPath);
  
  splashWindow.loadFile(splashPath);
  splashWindow.center();
  
  //splashWindow.webContents.openDevTools({ mode: 'detach' });

  // Logger les événements pour debug
  splashWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[SPLASH] ❌ ERREUR chargement:', errorCode, errorDescription);
  });
  
  // Le 'did-finish-load' est écouté dans app.whenReady() avec .once()
}

function enableAutoLaunch() {
  if (process.platform !== 'win32') return;

  const appPath = app.getPath('exe');
  const appName = 'SpotlightForWindows';

  const { exec } = require('child_process');

  const command = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /t REG_SZ /d "\\"${appPath}\\"" /f`;

  exec(command, (error) => {
    if(error) {
      console.error('[AutoLaunch] Erreur activation:', error);
    } else {
      console.log('[AutoLaunch] Activé avec succès');
    }
  });
}

function disableAutoLaunch() {
  if (process.platform !== 'win32') return;

  const appName = 'SpotlightForWindows';
  const { exec } = require('child_process');
  
  const command = `reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}" /f`;
  
  exec(command, (error) => {
    if (error) {
      console.error('[AutoLaunch] Erreur désactivation:', error);
    } else {
      console.log('[AutoLaunch] Désactivé avec succès');
    }
  });
}

function isAutoLaunchEnabled() {
  return new Promise((resolve) => {
    if(process.platform !== 'win32') {
      resolve(false);
      return;
    }

    const appName = 'SpotlightForWindows';
    const { exec } = require('child_process');

    const command = `reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${appName}"`;

    exec(command, (error, stdout) => {
      if(error) {
        console.log('[AutoLaunch] Non activé dans le registre');
        resolve(false);
      } else {
        const isEnabled = stdout.includes(appName);
        console.log('[AutoLaunch] Statut registre:', isEnabled);
        resolve(isEnabled);
      }
    });
  });
}

// ⚠️ NE PLUS UTILISER app.on('ready') car ça bloque l'affichage du splash
// La vérification auto-launch est maintenant dans app.whenReady() APRÈS le splash

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 500,
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

  // Quand la fenêtre est prête, fermer le splash
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[OK] Fenêtre principale chargée');
  });
}

// Fermer le splash et afficher l'app

function closeSplashAndShowApp() {
  console.log('[OK] Fermeture du splash screen');

  if(splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }

  // La fenêtre principale reste cachée jusqu'à Ctrl+Alt+Space
  console.log('[OK] Application prête (Ctrl+Alt+Space pour ouvrir)');
}

// Supprimer les logs des erreurs non critiques
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('disable-site-isolation-trials');

app.whenReady().then(async () => {
  if (process.env.NODE_ENV !== 'development') {
    app.commandLine.appendSwitch('log-level', '3');
  }

  // 1. CRÉER LE SPLASH
  createSplashWindow();
  
  // 2. ⭐ ATTENDRE QUE LE SPLASH SOIT VRAIMENT AFFICHÉ
  await new Promise((resolve) => {
    splashWindow.webContents.once('did-finish-load', () => {
      console.log('[SPLASH] Contenu chargé, affichage confirmé');
      // Attendre encore un peu pour être SÛR qu'il est visible
      setTimeout(resolve, 300);
    });
  });

  console.log('[SPLASH] ✅ Splash visible, début des opérations lourdes...');

  // 3. CRÉER LA FENÊTRE PRINCIPALE (cachée)
  createWindow();

  // 4. INITIALISER LE SEARCHER
  searcher = new FileSearcher();

  // 5. ENREGISTRER LE RACCOURCI GLOBAL
  const ret = globalShortcut.register('CommandOrControl+Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (!ret) {
    console.log('[ERROR] Échec enregistrement raccourci');
  }

  console.log('[OK] Raccourci enregistré');

  // 6. INITIALISER LE SYSTÈME DE MISE À JOUR
  updateManager = new UpdateManager(mainWindow);

  // Vérifier les mises à jour 30 secondes après le démarrage
  setTimeout(() => {
    if(!app.isPackaged) {
      console.log('[Updater] Mode développement, vérification désactivée');
      return;
    }
    updateManager.checkForUpdates();
  }, 30000);

  // 7. ⭐ MAINTENANT ON PEUT LANCER L'INDEXATION (le splash est visible)
  console.log('[INDEXATION] 🔍 Début du scan...');
  const indexingPromise = searcher.buildIndex().then(() => {
    console.log('[OK] Index prêt!');
  }).catch((error) => {
    console.error('[ERROR] Indexation:', error);
  });

  // 8. ATTENDRE L'INDEXATION (min 2 secondes, max 10 secondes)
  const minDisplayTime = new Promise(resolve => setTimeout(resolve, 2000));
  const maxDisplayTime = new Promise(resolve => setTimeout(resolve, 10000));
  
  await Promise.race([
    Promise.all([indexingPromise, minDisplayTime]),
    maxDisplayTime
  ]);
  
  closeSplashAndShowApp();

  // 9. VÉRIFIER ET ACTIVER AUTO-LAUNCH (en arrière-plan, après le splash)
  setTimeout(async () => {
    const autoLaunchStatus = await isAutoLaunchEnabled();
    if(!autoLaunchStatus) {
      console.log('[AutoLaunch] Première installation, activation du démarrage auto');
      enableAutoLaunch();
    }
  }, 500);
});

// Vérifier les mises à jour manuellement
ipcMain.handle('check-for-updates', async() => {
  if(!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }

  try {
    await updateManager.checkForUpdates();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message};
  }
});

// Obtenir le statut de mise à jour
ipcMain.handle('get-update-status', () => {
  if(!updateManager) {
    return { updateAvailable: false };
  }

  return updateManager.getStatus();
});

// Télécharger la mise à jour
ipcMain.handle('download-update', async () => {
  if (!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }

  try {
    await updateManager.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Installer et redémarrer
ipcMain.handle('install-update', () => {
  if(!updateManager) {
    return { success: false, error: 'Update manager not initialized' };
  }

  try {
    updateManager.quitAndInstall();
    return { success: true };
  } catch(error) {
    return { success: false, error: error.message };
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