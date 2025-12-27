const fs = require('fs');
const path = require('path');
const os = require('os');
const Fuse = require('fuse.js');

class FileSearcher {
  constructor() {
    this.index = [];
    this.appsIndex = []; // Index séparé pour les applications
    this.fuse = null;
    this.appsFuse = null;
    this.isIndexing = false;
  }

  // Scanner TOUTES les applications Windows
    scanApplications() {
    const apps = [];
    
    console.log('📱 Scan des applications...');
    
    // 1. Program Files classiques
    console.log('  → Program Files...');
    const programPaths = [
        'C:\\Program Files',
        'C:\\Program Files (x86)'
    ];
    
    for (const programPath of programPaths) {
        if (!fs.existsSync(programPath)) continue;

        try {
        const dirs = fs.readdirSync(programPath, { withFileTypes: true });
        
        for (const dir of dirs) {
            if (dir.isDirectory()) {
            const appPath = path.join(programPath, dir.name);
            
            try {
                const files = fs.readdirSync(appPath);
                const exeFiles = files.filter(f => f.endsWith('.exe'));
                
                for (const exe of exeFiles) {
                const isPrimary = exe.toLowerCase().replace('.exe', '') === dir.name.toLowerCase();
                
                apps.push({
                    path: path.join(appPath, exe),
                    name: exe,
                    nameWithoutExt: exe.replace('.exe', ''),
                    directory: appPath,
                    extension: '.exe',
                    type: 'application',
                    icon: '⚙️',
                    baseScore: isPrimary ? 20 : 15,
                    size: 0,
                    modified: new Date(),
                    isPrimary: isPrimary,
                    source: 'program_files'
                });
                }
            } catch (err) {
                // Ignorer
            }
            }
        }
        } catch (err) {
        console.error(`Erreur scan ${programPath}`);
        }
    }

    // 2. Applications Microsoft Store / UWP
    console.log('  → Microsoft Store Apps...');
    const windowsAppsPath = 'C:\\Program Files\\WindowsApps';
    
    if (fs.existsSync(windowsAppsPath)) {
        try {
        const dirs = fs.readdirSync(windowsAppsPath, { withFileTypes: true });
        
        for (const dir of dirs) {
            if (dir.isDirectory()) {
            const appPath = path.join(windowsAppsPath, dir.name);
            
            try {
                const files = fs.readdirSync(appPath);
                const exeFiles = files.filter(f => f.endsWith('.exe'));
                
                for (const exe of exeFiles) {
                // Extraire le nom de l'app depuis le nom du dossier
                // Format: Microsoft.MinecraftUWP_1.20.1501.0_x64__8wekyb3d8bbwe
                const appName = dir.name.split('_')[0].replace(/\./g, ' ');
                
                apps.push({
                    path: path.join(appPath, exe),
                    name: exe,
                    nameWithoutExt: exe.replace('.exe', ''),
                    displayName: appName, // Nom affiché plus propre
                    directory: appPath,
                    extension: '.exe',
                    type: 'application',
                    icon: '📦',
                    baseScore: 22,
                    size: 0,
                    modified: new Date(),
                    isPrimary: true,
                    source: 'windows_store'
                });
                }
            } catch (err) {
                // Permission denied - normal pour certaines apps Store
            }
            }
        }
        } catch (err) {
        console.log('    ⚠️  Accès WindowsApps refusé (normal)');
        }
    }

    // 3. Menu Démarrer (raccourcis .lnk)
    console.log('  → Menu Démarrer...');
    const startMenuPaths = [
        path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
        'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
    ];

    for (const startMenuPath of startMenuPaths) {
        if (!fs.existsSync(startMenuPath)) continue;
        this.scanStartMenu(startMenuPath, apps);
    }

    // 4. Applications dans le dossier utilisateur local
    console.log('  → AppData Local...');
    const localAppsPath = path.join(os.homedir(), 'AppData\\Local');
    
    if (fs.existsSync(localAppsPath)) {
        try {
        const commonAppFolders = [
            'Discord', 'Spotify', 'Slack', 'Teams', 'Zoom',
            'Google\\Chrome\\Application', 'Microsoft\\Edge\\Application',
            'Programs' // Certaines apps s'installent ici
        ];
        
        for (const folder of commonAppFolders) {
            const folderPath = path.join(localAppsPath, folder);
            
            if (fs.existsSync(folderPath)) {
            try {
                const files = fs.readdirSync(folderPath);
                const exeFiles = files.filter(f => f.endsWith('.exe'));
                
                for (const exe of exeFiles) {
                apps.push({
                    path: path.join(folderPath, exe),
                    name: exe,
                    nameWithoutExt: exe.replace('.exe', ''),
                    directory: folderPath,
                    extension: '.exe',
                    type: 'application',
                    icon: '🎮',
                    baseScore: 20,
                    size: 0,
                    modified: new Date(),
                    isPrimary: true,
                    source: 'appdata_local'
                });
                }
            } catch (err) {
                // Ignorer
            }
            }
        }
        } catch (err) {
        console.error('Erreur scan AppData Local');
        }
    }

    // 5. Steam (si installé)
    console.log('  → Steam...');
    const steamPaths = [
        'C:\\Program Files (x86)\\Steam\\steamapps\\common',
        'C:\\Program Files\\Steam\\steamapps\\common',
        path.join(os.homedir(), 'Steam\\steamapps\\common')
    ];

    for (const steamPath of steamPaths) {
        if (!fs.existsSync(steamPath)) continue;

        try {
        const games = fs.readdirSync(steamPath, { withFileTypes: true });
        
        for (const game of games) {
            if (game.isDirectory()) {
            const gamePath = path.join(steamPath, game.name);
            
            try {
                const files = fs.readdirSync(gamePath);
                const exeFiles = files.filter(f => f.endsWith('.exe'));
                
                // Prendre le exe principal (souvent le nom du dossier)
                const mainExe = exeFiles.find(exe => 
                exe.toLowerCase().includes(game.name.toLowerCase().substring(0, 5))
                ) || exeFiles[0];
                
                if (mainExe) {
                apps.push({
                    path: path.join(gamePath, mainExe),
                    name: mainExe,
                    nameWithoutExt: mainExe.replace('.exe', ''),
                    displayName: game.name, // Nom du jeu propre
                    directory: gamePath,
                    extension: '.exe',
                    type: 'application',
                    icon: '🎮',
                    baseScore: 23,
                    size: 0,
                    modified: new Date(),
                    isPrimary: true,
                    source: 'steam'
                });
                }
            } catch (err) {
                // Ignorer
            }
            }
        }
        } catch (err) {
        console.error('Erreur scan Steam');
        }
    }

    // 6. Epic Games (si installé)
    console.log('  → Epic Games...');
    const epicPath = 'C:\\Program Files\\Epic Games';
    
    if (fs.existsSync(epicPath)) {
        try {
        const games = fs.readdirSync(epicPath, { withFileTypes: true });
        
        for (const game of games) {
            if (game.isDirectory() && game.name !== 'Launcher') {
            const gamePath = path.join(epicPath, game.name);
            
            try {
                // Chercher récursivement les .exe (max 2 niveaux)
                const exeFiles = this.findExeInDirectory(gamePath, 2);
                
                if (exeFiles.length > 0) {
                apps.push({
                    path: exeFiles[0],
                    name: path.basename(exeFiles[0]),
                    nameWithoutExt: path.basename(exeFiles[0], '.exe'),
                    displayName: game.name,
                    directory: path.dirname(exeFiles[0]),
                    extension: '.exe',
                    type: 'application',
                    icon: '🎮',
                    baseScore: 23,
                    size: 0,
                    modified: new Date(),
                    isPrimary: true,
                    source: 'epic_games'
                });
                }
            } catch (err) {
                // Ignorer
            }
            }
        }
        } catch (err) {
        console.error('Erreur scan Epic Games');
        }
    }

    // 7. Applications système Windows importantes
    console.log('  → Apps système...');
    const windowsApps = [
        { name: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe', icon: '📝' },
        { name: 'Calculator', path: 'C:\\Windows\\System32\\calc.exe', icon: '🔢' },
        { name: 'Paint', path: 'C:\\Windows\\System32\\mspaint.exe', icon: '🎨' },
        { name: 'Command Prompt', path: 'C:\\Windows\\System32\\cmd.exe', icon: '⌨️' },
        { name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', icon: '💻' },
        { name: 'Task Manager', path: 'C:\\Windows\\System32\\taskmgr.exe', icon: '📊' },
        { name: 'Explorer', path: 'C:\\Windows\\explorer.exe', icon: '📁' },
        { name: 'Control Panel', path: 'C:\\Windows\\System32\\control.exe', icon: '⚙️' },
        { name: 'Registry Editor', path: 'C:\\Windows\\regedit.exe', icon: '📋' },
    ];

    for (const app of windowsApps) {
        if (fs.existsSync(app.path)) {
        apps.push({
            path: app.path,
            name: app.name,
            nameWithoutExt: app.name,
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

    console.log(`  ✅ ${apps.length} applications trouvées`);
    
    // Dédupliquer par nom (garder la meilleure version)
    const uniqueApps = [];
    const seen = new Set();
    
    for (const app of apps) {
        const key = app.nameWithoutExt.toLowerCase();
        if (!seen.has(key)) {
        seen.add(key);
        uniqueApps.push(app);
        }
    }
    
    console.log(`  📌 ${uniqueApps.length} apps uniques après déduplication`);
    
    return uniqueApps;
    }

    // Fonction auxiliaire pour chercher les .exe récursivement
    findExeInDirectory(dir, maxDepth = 2, currentDepth = 0) {
    if (currentDepth > maxDepth) return [];
    
    const exeFiles = [];
    
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isFile() && item.name.endsWith('.exe')) {
            exeFiles.push(fullPath);
        } else if (item.isDirectory() && currentDepth < maxDepth) {
            exeFiles.push(...this.findExeInDirectory(fullPath, maxDepth, currentDepth + 1));
        }
        }
    } catch (err) {
        // Ignorer
    }
    
    return exeFiles;
    }

  // Scanner le menu démarrer pour les raccourcis .lnk
  scanStartMenu(dir, apps, depth = 0) {
    if (depth > 2) return;

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          this.scanStartMenu(fullPath, apps, depth + 1);
        } else if (item.name.endsWith('.lnk')) {
          // Raccourci trouvé
          const appName = item.name.replace('.lnk', '');
          
          apps.push({
            path: fullPath,
            name: appName,
            nameWithoutExt: appName,
            directory: dir,
            extension: '.lnk',
            type: 'application',
            icon: '🔗',
            baseScore: 18,
            size: 0,
            modified: new Date(),
            isPrimary: true,
            isShortcut: true
          });
        }
      }
    } catch (err) {
      // Ignorer
    }
  }

  // Scanner récursif pour les fichiers normaux
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
        if (item.name.startsWith('.') || item.name.startsWith('$')) {
          continue;
        }
        
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
    if (directory.includes(path.join(userHome, 'Pictures'))) return 7;
    if (directory.includes(path.join(userHome, 'Videos'))) return 7;
    if (directory.includes(path.join(userHome, 'Music'))) return 7;
    if (directory.includes(userHome)) return 6;
    
    return 3;
  }

  async buildIndex() {
    if (this.isIndexing) {
      console.log('Indexation déjà en cours...');
      return;
    }
    
    this.isIndexing = true;
    console.log('🔍 Début de l\'indexation globale...');
    const startTime = Date.now();

    try {
      const userHome = os.homedir();
      
      // 1. D'abord indexer les APPLICATIONS (priorité absolue)
      this.appsIndex = this.scanApplications();
      
      // 2. Ensuite les fichiers
      const searchPaths = [
        { path: path.join(userHome, 'Desktop'), depth: 3 },
        { path: path.join(userHome, 'Documents'), depth: 3 },
        { path: path.join(userHome, 'Downloads'), depth: 3 },
        { path: path.join(userHome, 'Pictures'), depth: 2 },
        { path: path.join(userHome, 'Videos'), depth: 2 },
        { path: path.join(userHome, 'Music'), depth: 2 },
        { path: userHome, depth: 1 },
        { path: 'D:\\', depth: 2 },
        { path: 'E:\\', depth: 2 },
      ];

      this.index = [];

      for (const { path: searchPath, depth } of searchPaths) {
        if (!fs.existsSync(searchPath)) continue;
        
        console.log(`📂 Scan de ${searchPath}...`);
        const files = this.scanDirectory(searchPath, 0, depth);
        console.log(`  ✓ ${files.length} fichiers`);
        this.index.push(...files);
      }

      // Configurer Fuse.js SÉPARÉ pour les applications
        this.appsFuse = new Fuse(this.appsIndex, {
        keys: [
            { name: 'nameWithoutExt', weight: 1.0 },
            { name: 'displayName', weight: 1.2 },  // NOUVEAU: Chercher aussi dans displayName
            { name: 'name', weight: 0.9 }
        ],
        threshold: 0.3,
        distance: 50,
        includeScore: true,
        minMatchCharLength: 1,
        ignoreLocation: true,
        shouldSort: true
        });

      // Configurer Fuse.js pour les fichiers
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

  // Recherche intelligente avec APPLICATIONS EN PRIORITÉ
  search(query, limit = 15) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    if (!this.appsFuse || !this.fuse) {
      console.log('⚠️ Index pas encore prêt');
      return [];
    }

    const startSearch = Date.now();
    
    // 1. CHERCHER D'ABORD DANS LES APPLICATIONS
    let appResults = this.appsFuse.search(query, { limit: 8 });
    
    // 2. CHERCHER DANS LES FICHIERS
    let fileResults = this.fuse.search(query, { limit: limit * 2 });
    
    // 3. Scoring personnalisé pour les apps
    appResults = appResults.map(result => {
      const item = result.item;
      let customScore = result.score * 0.3; // Apps ont un énorme bonus (x0.3)
      
      // Super bonus si c'est l'app principale
      if (item.isPrimary) {
        customScore *= 0.5;
      }
      
      // Bonus si le nom commence par la query
      if (item.nameWithoutExt.toLowerCase().startsWith(query.toLowerCase())) {
        customScore *= 0.4;
      }
      
      return {
        ...item,
        score: customScore,
        isApp: true
      };
    });
    
    // 4. Scoring pour les fichiers
    fileResults = fileResults.map(result => {
      const item = result.item;
      let customScore = result.score;
      
      // Bonus pour fichiers récents
      const daysSinceModified = (Date.now() - item.modified) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) customScore *= 0.8;
      else if (daysSinceModified < 30) customScore *= 0.9;
      
      // Bonus selon l'emplacement
      customScore *= (11 - item.baseScore) / 10;
      
      // Bonus si match au début
      if (item.nameWithoutExt.toLowerCase().startsWith(query.toLowerCase())) {
        customScore *= 0.6;
      }
      
      return {
        ...item,
        score: customScore,
        isApp: false
      };
    });
    
    // 5. COMBINER : Apps d'abord, puis fichiers
    const allResults = [...appResults, ...fileResults];
    
    // Trier par score
    allResults.sort((a, b) => a.score - b.score);
    
    // Limiter
    const finalResults = allResults.slice(0, limit);
    
    const endSearch = Date.now();
    console.log(`🔎 "${query}": ${appResults.length} apps, ${fileResults.length} fichiers -> ${finalResults.length} résultats (${endSearch - startSearch}ms)`);
    
    return finalResults;
  }

  getFileType(ext) {
    const types = {
      '.pdf': 'document', '.doc': 'document', '.docx': 'document',
      '.txt': 'document', '.md': 'document', '.rtf': 'document',
      '.xlsx': 'spreadsheet', '.xls': 'spreadsheet', '.csv': 'spreadsheet',
      '.pptx': 'presentation', '.ppt': 'presentation',
      '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
      '.svg': 'image', '.webp': 'image',
      '.mp4': 'video', '.avi': 'video', '.mkv': 'video', '.mov': 'video',
      '.mp3': 'audio', '.wav': 'audio', '.flac': 'audio',
      '.js': 'code', '.ts': 'code', '.py': 'code', '.java': 'code',
      '.cpp': 'code', '.c': 'code', '.html': 'code', '.css': 'code',
      '.json': 'code', '.xml': 'code',
      '.zip': 'archive', '.rar': 'archive', '.7z': 'archive',
      '.exe': 'application', '.msi': 'application',
      '.lnk': 'shortcut',
    };
    return types[ext.toLowerCase()] || 'file';
  }

  getIcon(ext) {
    const icons = {
      '.pdf': '📄', '.doc': '📝', '.docx': '📝', '.txt': '📃',
      '.xlsx': '📊', '.xls': '📊', '.pptx': '📽️',
      '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
      '.mp4': '🎬', '.avi': '🎬', '.mp3': '🎵',
      '.js': '📜', '.py': '🐍', '.java': '☕', '.html': '🌐',
      '.zip': '📦', '.exe': '⚙️', '.lnk': '🔗',
    };
    return icons[ext.toLowerCase()] || '📄';
  }
}

module.exports = FileSearcher;