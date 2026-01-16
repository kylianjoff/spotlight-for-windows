const fs = require('fs');
const path = require('path');
const os = require('os');
const Fuse = require('fuse.js');
const { execSync } = require('child_process');
const IconExtractor = require('./icon-extractor.js');
const EventEmitter = require('events');

class FileSearcher extends EventEmitter {
  constructor() {
    super();
    this.index = [];
    this.appsIndex = [];
    this.fuse = null;
    this.appsFuse = null;
    this.isIndexing = false;
    this.iconExtractor = new IconExtractor();
  }

  // MÉTHODE 1: Utiliser le registre Windows pour trouver TOUTES les apps installées
  getInstalledAppsFromRegistry() {
    const apps = [];
    
    console.log('  → Scan du registre Windows...');
    
    try {
      // Lire les clés de registre où Windows stocke les apps installées
      const registryPaths = [
        'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
      ];

      for (const regPath of registryPaths) {
        try {
          // Lister toutes les sous-clés
          const output = execSync(`reg query "${regPath}"`, { encoding: 'utf8' });
          const subkeys = output.split('\n').filter(line => line.startsWith('HKEY'));
          
          for (const subkey of subkeys) {
            try {
              // Lire les détails de chaque app
              const details = execSync(`reg query "${subkey}" /v DisplayName /v InstallLocation /v DisplayIcon 2>nul`, 
                { encoding: 'utf8' });
              
              let displayName = null;
              let installLocation = null;
              let iconPath = null;
              
              // Parser les valeurs
              const lines = details.split('\n');
              for (const line of lines) {
                if (line.includes('DisplayName')) {
                  displayName = line.split('REG_SZ')[1]?.trim();
                }
                if (line.includes('InstallLocation')) {
                  installLocation = line.split('REG_SZ')[1]?.trim();
                }
                if (line.includes('DisplayIcon')) {
                  iconPath = line.split('REG_SZ')[1]?.trim();
                }
              }
              
              // Si on a un nom et un emplacement
              if (displayName && installLocation && fs.existsSync(installLocation)) {
                // Chercher les .exe dans le dossier
                const exeFiles = this.findExeInDirectory(installLocation, 2);
                
                for (const exePath of exeFiles.slice(0, 2)) { // Max 2 exe par app
                  apps.push({
                    path: exePath,
                    name: path.basename(exePath),
                    nameWithoutExt: path.basename(exePath, '.exe'),
                    displayName: displayName,
                    directory: path.dirname(exePath),
                    extension: '.exe',
                    type: 'application',
                    icon: '⚙️',
                    baseScore: 22,
                    size: 0,
                    modified: new Date(),
                    isPrimary: true,
                    source: 'registry'
                  });
                }
              }
            } catch (err) {
              // App sans détails, continuer
            }
          }
        } catch (err) {
          // Registre inaccessible, continuer
        }
      }
      
      console.log(`    ✓ ${apps.length} apps du registre`);
    } catch (err) {
      console.error('Erreur lecture registre:', err.message);
    }
    
    return apps;
  }

  // MÉTHODE 2: Scanner tous les disques et trouver les dossiers d'applications courants
  scanAllDrivesForApps() {
    const apps = [];
    
    console.log('  → Scan des disques...');
    
    try {
      // Détecter tous les disques disponibles
      const drives = this.getAvailableDrives();
      console.log(`    Disques trouvés: ${drives.join(', ')}`);
      
      // Dossiers communs où les apps s'installent
      const commonAppPaths = [
        'Program Files',
        'Program Files (x86)',
        'Games',
        'Steam\\steamapps\\common',
        'Epic Games',
        'GOG Games',
        'Riot Games'
      ];
      
      for (const drive of drives) {
        for (const appPath of commonAppPaths) {
          const fullPath = path.join(drive, appPath);
          
          if (fs.existsSync(fullPath)) {
            console.log(`    Scan de ${fullPath}...`);
            const foundApps = this.scanApplicationDirectory(fullPath);
            apps.push(...foundApps);
          }
        }
      }
      
      console.log(`    ✓ ${apps.length} apps des disques`);
    } catch (err) {
      console.error('Erreur scan disques:', err.message);
    }
    
    return apps;
  }

  // MÉTHODE 3: Scanner le menu Démarrer (tous les utilisateurs)
  scanStartMenus() {
    const apps = [];
    
    console.log('  → Scan des menus Démarrer...');
    
    const startMenuPaths = [
      path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
      path.join(os.homedir(), 'Desktop') // Bureau aussi
    ];

    for (const startMenuPath of startMenuPaths) {
      if (fs.existsSync(startMenuPath)) {
        this.scanStartMenuRecursive(startMenuPath, apps, 0, 5);
      }
    }
    
    console.log(`    ✓ ${apps.length} raccourcis trouvés`);
    return apps;
  }

  // MÉTHODE 4: Scanner AppData pour les apps portables
  scanAppData() {
    const apps = [];
    
    console.log('  → Scan AppData...');
    
    const appDataPaths = [
      path.join(os.homedir(), 'AppData\\Local'),
      path.join(os.homedir(), 'AppData\\Roaming')
    ];
    
    for (const appDataPath of appDataPaths) {
      if (!fs.existsSync(appDataPath)) continue;
      
      try {
        const folders = fs.readdirSync(appDataPath, { withFileTypes: true });
        
        for (const folder of folders) {
          if (folder.isDirectory()) {
            const folderPath = path.join(appDataPath, folder.name);
            
            // Chercher des exe dans les dossiers qui ressemblent à des apps
            if (!folder.name.startsWith('.') && 
                !['Microsoft', 'Temp', 'cache', 'Packages'].includes(folder.name)) {
              
              const exeFiles = this.findExeInDirectory(folderPath, 2);
              
              for (const exePath of exeFiles.slice(0, 1)) {
                apps.push({
                  path: exePath,
                  name: path.basename(exePath),
                  nameWithoutExt: path.basename(exePath, '.exe'),
                  displayName: folder.name,
                  directory: path.dirname(exePath),
                  extension: '.exe',
                  type: 'application',
                  icon: '📦',
                  baseScore: 19,
                  size: 0,
                  modified: new Date(),
                  isPrimary: true,
                  source: 'appdata'
                });
              }
            }
          }
        }
      } catch (err) {
        // Ignorer
      }
    }
    
    console.log(`    ✓ ${apps.length} apps AppData`);
    return apps;
  }

  // MÉTHODE PRINCIPALE: Scanner TOUTES les applications
  scanApplications() {
    console.log('📱 Découverte automatique des applications...');
    
    let allApps = [];
    
    // 1. Registre Windows (source la plus fiable)
    const registryApps = this.getInstalledAppsFromRegistry();
    allApps.push(...registryApps);
    
    // 2. Scan des disques
    const diskApps = this.scanAllDrivesForApps();
    allApps.push(...diskApps);
    
    // 3. Menu Démarrer
    const startMenuApps = this.scanStartMenus();
    allApps.push(...startMenuApps);
    
    // 4. AppData
    const appDataApps = this.scanAppData();
    allApps.push(...appDataApps);
    
    // 5. Applications système Windows importantes
    const systemApps = this.getSystemApps();
    allApps.push(...systemApps);
    
    console.log(`  📊 Total brut: ${allApps.length} applications`);
    
    // Dédupliquer intelligemment
    const uniqueApps = this.deduplicateApps(allApps);
    
    console.log(`  ✅ ${uniqueApps.length} applications uniques`);
    
    return uniqueApps;
  }

  // Détecter tous les disques disponibles
  getAvailableDrives() {
    const drives = [];
    
    try {
      // Windows: tester de A: à Z:
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':\\';
        try {
          if (fs.existsSync(drive)) {
            drives.push(drive);
          }
        } catch (err) {
          // Disque non accessible
        }
      }
    } catch (err) {
      // Fallback: au moins C:
      drives.push('C:\\');
    }
    
    return drives;
  }

  // Scanner un dossier d'applications
  scanApplicationDirectory(dir, depth = 0, maxDepth = 2) {
    if (depth > maxDepth) return [];
    
    const apps = [];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory()) {
          const appPath = path.join(dir, item.name);
          
          try {
            // Chercher des .exe dans ce dossier
            const exeFiles = this.findExeInDirectory(appPath, 2);
            
            if (exeFiles.length > 0) {
              // Prioriser l'exe principal (nom du dossier)
              const mainExe = exeFiles.find(exe => 
                path.basename(exe, '.exe').toLowerCase() === item.name.toLowerCase()
              ) || exeFiles[0];
              
              apps.push({
                path: mainExe,
                name: path.basename(mainExe),
                nameWithoutExt: path.basename(mainExe, '.exe'),
                displayName: item.name,
                directory: path.dirname(mainExe),
                extension: '.exe',
                type: 'application',
                icon: this.getIconForApp(item.name),
                baseScore: 20,
                size: 0,
                modified: new Date(),
                isPrimary: true,
                source: 'disk_scan'
              });
            }
          } catch (err) {
            // Ignorer
          }
        }
      }
    } catch (err) {
      // Dossier inaccessible
    }
    
    return apps;
  }

  // Scanner récursivement le menu Démarrer
  scanStartMenuRecursive(dir, apps, depth = 0, maxDepth = 5) {
    if (depth > maxDepth) return;
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          this.scanStartMenuRecursive(fullPath, apps, depth + 1, maxDepth);
        } else if (item.name.endsWith('.lnk')) {
          const appName = item.name.replace('.lnk', '');
          
          apps.push({
            path: fullPath,
            name: appName,
            nameWithoutExt: appName,
            displayName: appName,
            directory: dir,
            extension: '.lnk',
            type: 'application',
            icon: '🔗',
            baseScore: 21,
            size: 0,
            modified: new Date(),
            isPrimary: true,
            isShortcut: true,
            source: 'start_menu'
          });
        }
      }
    } catch (err) {
      // Ignorer
    }
  }

  // Trouver les .exe dans un dossier (récursif limité)
  findExeInDirectory(dir, maxDepth = 2, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    
    const exeFiles = [];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isFile() && item.name.endsWith('.exe')) {
          // Ignorer les exe de désinstallation
          if (!item.name.toLowerCase().includes('unins') && 
              !item.name.toLowerCase().includes('setup')) {
            exeFiles.push(fullPath);
          }
        } else if (item.isDirectory() && currentDepth < maxDepth) {
          // Éviter certains dossiers inutiles
          if (!['cache', 'temp', 'logs', 'data'].includes(item.name.toLowerCase())) {
            exeFiles.push(...this.findExeInDirectory(fullPath, maxDepth, currentDepth + 1));
          }
        }
      }
    } catch (err) {
      // Ignorer
    }
    
    return exeFiles;
  }

  // Applications système Windows
  getSystemApps() {
    const systemApps = [
      { name: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe', icon: '📝' },
      { name: 'Calculator', path: 'C:\\Windows\\System32\\calc.exe', icon: '🔢' },
      { name: 'Paint', path: 'C:\\Windows\\System32\\mspaint.exe', icon: '🎨' },
      { name: 'Snipping Tool', path: 'C:\\Windows\\System32\\SnippingTool.exe', icon: '✂️' },
      { name: 'Command Prompt', path: 'C:\\Windows\\System32\\cmd.exe', icon: '⌨️' },
      { name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', icon: '💻' },
      { name: 'Task Manager', path: 'C:\\Windows\\System32\\taskmgr.exe', icon: '📊' },
      { name: 'Explorer', path: 'C:\\Windows\\explorer.exe', icon: '📁' },
      { name: 'Control Panel', path: 'C:\\Windows\\System32\\control.exe', icon: '⚙️' },
      { name: 'Registry Editor', path: 'C:\\Windows\\regedit.exe', icon: '📋' },
      { name: 'Settings', path: 'C:\\Windows\\ImmersiveControlPanel\\SystemSettings.exe', icon: '⚙️' },
    ];

    const apps = [];
    
    for (const app of systemApps) {
      if (fs.existsSync(app.path)) {
        apps.push({
          path: app.path,
          name: app.name,
          nameWithoutExt: app.name,
          displayName: app.name,
          directory: path.dirname(app.path),
          extension: '.exe',
          type: 'application',
          icon: app.icon,
          baseScore: 25,
          size: 0,
          modified: new Date(),
          isPrimary: true,
          source: 'windows_system'
        });
      }
    }
    
    return apps;
  }

  // Icône intelligente selon le nom
  getIconForApp(name) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('game') || nameLower.includes('steam') || 
        nameLower.includes('minecraft') || nameLower.includes('fortnite')) {
      return '🎮';
    }
    if (nameLower.includes('chrome') || nameLower.includes('firefox') || 
        nameLower.includes('edge') || nameLower.includes('browser')) {
      return '🌐';
    }
    if (nameLower.includes('code') || nameLower.includes('visual studio')) {
      return '💻';
    }
    if (nameLower.includes('office') || nameLower.includes('word') || 
        nameLower.includes('excel') || nameLower.includes('powerpoint')) {
      return '📄';
    }
    if (nameLower.includes('discord') || nameLower.includes('slack') || 
        nameLower.includes('teams')) {
      return '💬';
    }
    if (nameLower.includes('spotify') || nameLower.includes('music')) {
      return '🎵';
    }
    if (nameLower.includes('photoshop') || nameLower.includes('paint')) {
      return '🎨';
    }
    
    return '⚙️';
  }

  // Déduplication intelligente
  deduplicateApps(apps) {
    const uniqueMap = new Map();
    
    for (const app of apps) {
      const key = app.nameWithoutExt.toLowerCase().trim();
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, app);
      } else {
        // Garder la meilleure version (priorité au registre et exe direct)
        const existing = uniqueMap.get(key);
        
        // Priorité: registry > disk_scan > start_menu > appdata
        const sourcePriority = {
          'registry': 5,
          'disk_scan': 4,
          'windows_system': 6,
          'start_menu': 3,
          'appdata': 2
        };
        
        const existingPriority = sourcePriority[existing.source] || 1;
        const newPriority = sourcePriority[app.source] || 1;
        
        // Préférer .exe à .lnk
        const existingIsExe = existing.extension === '.exe';
        const newIsExe = app.extension === '.exe';
        
        if (newPriority > existingPriority || (newPriority === existingPriority && newIsExe && !existingIsExe)) {
          uniqueMap.set(key, app);
        }
      }
    }
    
    return Array.from(uniqueMap.values());
  }

  // RESTE DU CODE (buildIndex, search, etc.) IDENTIQUE À AVANT...
  // Je te mets juste buildIndex mis à jour

  async buildIndex() {
  if (this.isIndexing) {
    console.log('Indexation déjà en cours...');
    return;
  }
  
  this.isIndexing = true;
  console.log('🔍 Début de l\'indexation UNIVERSELLE...');
  const startTime = Date.now();

  try {
    const userHome = os.homedir();
    
    // 1. APPLICATIONS (découverte automatique)
    this.appsIndex = this.scanApplications();
    
    // 2. EXTRACTION DES ICÔNES (en arrière-plan)
    console.log('🎨 Extraction des icônes...');
    this.extractIconsInBackground();
    
    // 3. FICHIERS
    const searchPaths = [
      { path: path.join(userHome, 'Desktop'), depth: 3 },
      { path: path.join(userHome, 'Documents'), depth: 3 },
      { path: path.join(userHome, 'Downloads'), depth: 3 },
      { path: path.join(userHome, 'Pictures'), depth: 2 },
      { path: path.join(userHome, 'Videos'), depth: 2 },
      { path: path.join(userHome, 'Music'), depth: 2 },
    ];

    this.index = [];

    this.emit('progress', { step: 'applications', message: 'Scanning applications...' });
    this.appsIndex = this.scanApplications();

    this.emit('progress', { step: 'icons', message: 'Extracting icons...'});

    this.extractIconsInBackground();

    for (const { path: searchPath, depth } of searchPaths) {
      if (!fs.existsSync(searchPath)) continue;
      
      this.emit('progress', { step: 'files', message: `Scanning ${path.basename(searchPath)}...` });
      console.log(`📂 Scan de ${searchPath}...`);
      const files = this.scanDirectory(searchPath, 0, depth);
      console.log(`  ✓ ${files.length} fichiers`);
      this.index.push(...files);
    }

    this.emit('progress', { step: 'index', message: 'Building search index...' });

    // Configurer Fuse.js...
    this.appsFuse = new Fuse(this.appsIndex, {
      keys: [
        { name: 'displayName', weight: 1.2 },
        { name: 'nameWithoutExt', weight: 1.0 },
        { name: 'name', weight: 0.9 }
      ],
      threshold: 0.3,
      distance: 50,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
      shouldSort: true
    });

    this.fuse = new Fuse(this.index, {
      keys: [
        { name: 'nameWithoutExt', weight: 1.0 },
        { name: 'name', weight: 0.8 },
        { name: 'directory', weight: 0.2 }
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
      shouldSort: true
    });

    const endTime = Date.now();
    console.log(`✅ Indexation terminée:`);
    console.log(`   📱 ${this.appsIndex.length} applications`);
    console.log(`   📄 ${this.index.length} fichiers`);
    console.log(`   ⏱️  ${(endTime - startTime) / 1000}s`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'indexation:', error);
  } finally {
    this.isIndexing = false;
  }
}

// Extraire les icônes en arrière-plan
async extractIconsInBackground() {
  // Extraire les icônes des 50 premières apps (les plus importantes)
  const topApps = this.appsIndex.slice(0, 50);
  
  let extracted = 0;
  for (const app of topApps) {
    try {
      const iconPath = await this.iconExtractor.extractIcon(app.path, app.displayName || app.name);
      if (iconPath) {
        app.iconPath = iconPath;
        extracted++;
      }
    } catch (error) {
      // Continuer même si extraction échoue
    }
  }
  
  console.log(`  ✓ ${extracted} icônes extraites`);
}

  // Scanner fichiers (identique à avant)
  scanDirectory(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return [];
    
    const files = [];
    const ignoreDirs = [
      'node_modules', '.git', 'AppData', '$RECYCLE.BIN', 
      'System Volume Information', 'Windows', 'ProgramData',
      '.vscode', '.idea', '__pycache__', 'dist', 'build',
      'tmp', 'temp', 'cache', 'Program Files', 'Program Files (x86)'
    ];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        if (item.name.startsWith('.') || item.name.startsWith('$')) continue;
        
        const fullPath = path.join(dir, item.name);
        
        try {
          if (item.isFile()) {
            const ext = path.extname(item.name);
            const stats = fs.statSync(fullPath);
            
            files.push({
              path: fullPath,
              name: item.name,
              nameWithoutExt: path.basename(item.name, ext),
              directory: dir,
              extension: ext,
              type: this.getFileType(ext),
              icon: this.getIcon(ext),
              size: stats.size,
              modified: stats.mtime,
              baseScore: this.getLocationScore(dir)
            });
          } else if (item.isDirectory() && depth < maxDepth) {
            if (!ignoreDirs.includes(item.name)) {
              files.push(...this.scanDirectory(fullPath, depth + 1, maxDepth));
            }
          }
        } catch (err) {
          // Ignorer
        }
      }
    } catch (err) {
      // Ignorer
    }
    
    return files;
  }

  getLocationScore(directory) {
    const userHome = os.homedir();
    if (directory.includes(path.join(userHome, 'Desktop'))) return 10;
    if (directory.includes(path.join(userHome, 'Documents'))) return 9;
    if (directory.includes(path.join(userHome, 'Downloads'))) return 8;
    if (directory.includes(userHome)) return 6;
    return 3;
  }

  // Recherche (identique)
  search(query, limit = 15) {
    if (!query || query.trim().length === 0) return [];
    if (!this.appsFuse || !this.fuse) return [];

    const startSearch = Date.now();
    
    let appResults = this.appsFuse.search(query, { limit: 8 });
    let fileResults = this.fuse.search(query, { limit: limit * 2 });
    
    appResults = appResults.map(result => {
      const item = result.item;
      let customScore = result.score * 0.3;
      if (item.isPrimary) customScore *= 0.5;
      if (item.displayName?.toLowerCase().startsWith(query.toLowerCase())) customScore *= 0.4;
      return { ...item, score: customScore, isApp: true };
    });
    
    fileResults = fileResults.map(result => {
      const item = result.item;
      let customScore = result.score;
      const daysSinceModified = (Date.now() - item.modified) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) customScore *= 0.8;
      customScore *= (11 - item.baseScore) / 10;
      if (item.nameWithoutExt.toLowerCase().startsWith(query.toLowerCase())) customScore *= 0.6;
      return { ...item, score: customScore, isApp: false };
    });
    
    const allResults = [...appResults, ...fileResults];
    allResults.sort((a, b) => a.score - b.score);
    
    const finalResults = allResults.slice(0, limit);
    const endSearch = Date.now();
    console.log(`🔎 "${query}": ${finalResults.length} résultats (${endSearch - startSearch}ms)`);
    
    return finalResults;
  }

  getFileType(ext) {
    const types = {
      '.pdf': 'document', '.doc': 'document', '.docx': 'document', '.txt': 'document',
      '.xlsx': 'spreadsheet', '.pptx': 'presentation',
      '.jpg': 'image', '.png': 'image', '.gif': 'image',
      '.mp4': 'video', '.mp3': 'audio',
      '.js': 'code', '.py': 'code', '.html': 'code',
      '.zip': 'archive', '.exe': 'application',
    };
    return types[ext.toLowerCase()] || 'file';
  }

  getIcon(ext) {
    const icons = {
      '.pdf': '📄', '.docx': '📝', '.txt': '📃',
      '.xlsx': '📊', '.pptx': '📽️',
      '.jpg': '🖼️', '.png': '🖼️',
      '.mp4': '🎬', '.mp3': '🎵',
      '.js': '📜', '.py': '🐍',
      '.zip': '📦', '.exe': '⚙️',
    };
    return icons[ext.toLowerCase()] || '📄';
  }
}

module.exports = FileSearcher;