const { app, BrowserWindow, globalShortcut, ipcMain, shell, app: electronApp } = require('electron');
const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');
const { exec } = require('child_process');
const IconExtractor = require('./icon-extractor.js');
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
let searchWorker;
let workerRequestId = 0;
const workerPending = new Map();
let searchSequence = 0;
let iconExtractorInstance;
let updateManager;

function startSearchWorker() {
  const workerPath = path.join(__dirname, 'search-worker.js');
  searchWorker = new Worker(workerPath);

  searchWorker.on('message', (message) => {
    if (message && message.type === 'ready') {
      return;
    }

    const { id, result, error } = message || {};
    const pending = workerPending.get(id);
    if (!pending) return;

    workerPending.delete(id);
    if (error) {
      pending.reject(new Error(error));
    } else {
      pending.resolve(result);
    }
  });

  searchWorker.on('error', (error) => {
    console.error('[Worker] Erreur:', error);
    for (const pending of workerPending.values()) {
      pending.reject(error);
    }
    workerPending.clear();
  });

  searchWorker.on('exit', (code) => {
    console.error('[Worker] Quitte avec code', code);
  });
}

function callWorker(type, payload) {
  if (!searchWorker) {
    return Promise.reject(new Error('Worker non initialise'));
  }

  const id = ++workerRequestId;
  return new Promise((resolve, reject) => {
    workerPending.set(id, { resolve, reject });
    searchWorker.postMessage({ id, type, payload });
  });
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'), // ✅ Icône de l'app
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
      
      // Envoyer la version au splash
      const version = app.getVersion();
      splashWindow.webContents.executeJavaScript(`
        document.getElementById('version').textContent = 'v${version}';
      `);
      console.log('[SPLASH] Version affichée:', version);
      
      // Attendre encore un peu pour être SÛR qu'il est visible
      setTimeout(resolve, 300);
    });
  });

  console.log('[SPLASH] ✅ Splash visible, début des opérations lourdes...');

  // 3. CRÉER LA FENÊTRE PRINCIPALE (cachée)
  createWindow();

  // 4. INITIALISER LE WORKER DE RECHERCHE + EXTRACTION ICONES
  startSearchWorker();
  iconExtractorInstance = new IconExtractor();

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
  const indexingPromise = callWorker('build-index').then(() => {
    console.log('[OK] Index prêt!');
  }).catch((error) => {
    console.error('[ERROR] Indexation:', error);
  });

  // 8. ATTENDRE L'INDEXATION (min 2 secondes, max 10 secondes)
  const minDisplayTime = new Promise(resolve => setTimeout(resolve, 2000));
  const maxDisplayTime = new Promise(resolve => setTimeout(resolve, 10000));
  
  try {
    await Promise.race([
      Promise.all([indexingPromise, minDisplayTime]),
      maxDisplayTime
    ]);
  } catch (error) {
    console.error('[ERROR] Indexation (race):', error);
  } finally {
    closeSplashAndShowApp();
  }

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
  if (searchWorker) {
    searchWorker.terminate();
  }
});

// Gérer la fermeture depuis le renderer
ipcMain.on('hide-window', () => {
  mainWindow.hide();
});

// Gérer les recherches
ipcMain.handle('search-files', async (event, query) => {
  if (!searchWorker) return [];
  searchSequence += 1;
  const searchId = searchSequence;
  return await callWorker('search', { query, limit: 15, searchId });
});

// Ouvrir un fichier ou application
ipcMain.handle('open-file', async (event, filePath) => {
  try {
    console.log('Ouverture de:', filePath);

    if (filePath.startsWith('shell:AppsFolder\\')) {
      await shell.openExternal(filePath);
      return { success: true };
    }

    // Nettoyer les guillemets résiduels et développer les variables d'env
    let resolvedPath = filePath.trim().replace(/^"|"$/g, '');
    resolvedPath = resolvedPath.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`);

    if (!fs.existsSync(resolvedPath)) {
      console.error('Fichier introuvable:', resolvedPath);
      return { success: false, error: 'not_found' };
    }

    const ext = resolvedPath.toLowerCase();

    // Pour les .exe, utiliser start pour un lancement détaché
    if (ext.endsWith('.exe')) {
      return new Promise((resolve) => {
        const escaped = resolvedPath.replace(/"/g, '\\"');
        exec(`start "" "${escaped}"`, { shell: true }, (error) => {
          if (error) {
            console.error('Erreur lancement exe:', error);
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        });
      });
    }

    // Pour les .lnk, PowerShell avec échappement des apostrophes
    if (ext.endsWith('.lnk')) {
      return new Promise((resolve) => {
        const escaped = resolvedPath.replace(/'/g, "''");
        exec(`powershell -NonInteractive -Command "Start-Process '${escaped}'"`, (error) => {
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
    const result = await shell.openPath(resolvedPath);

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
  if (!iconExtractorInstance) return null;
  
  try {
    const iconPath = await iconExtractorInstance.extractIcon(appPath, 'app');
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

// ========================================
// HANDLERS AUTO-LAUNCH
// ========================================

ipcMain.handle('get-autolaunch-status', async () => {
  try {
    const status = await isAutoLaunchEnabled();
    return status;
  } catch (error) {
    console.error('[AutoLaunch] Erreur get status:', error);
    return false;
  }
});

ipcMain.handle('set-autolaunch', async (event, enabled) => {
  try {
    if (enabled) {
      enableAutoLaunch();
    } else {
      disableAutoLaunch();
    }
    
    // Vérifier que ça a marché
    await new Promise(resolve => setTimeout(resolve, 200));
    const newStatus = await isAutoLaunchEnabled();
    
    return { success: true, status: newStatus };
  } catch (error) {
    console.error('[AutoLaunch] Erreur set:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// HANDLER QUIT APP
// ========================================

ipcMain.handle('quit-app', () => {
  console.log('[QUIT] Fermeture de l\'application demandée');
  app.quit();
});