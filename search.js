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

  // Scanner les applications Windows (méthode améliorée)
  scanApplications() {
    const apps = [];
    
    // 1. Applications dans Program Files
    const programPaths = [
      'C:\\Program Files',
      'C:\\Program Files (x86)'
    ];
    
    console.log('📱 Scan des applications installées...');
    
    for (const programPath of programPaths) {
      if (!fs.existsSync(programPath)) continue;

      try {
        const dirs = fs.readdirSync(programPath, { withFileTypes: true });
        
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            const appPath = path.join(programPath, dir.name);
            
            try {
              // Chercher les .exe directement dans le dossier
              const files = fs.readdirSync(appPath);
              const exeFiles = files.filter(f => f.endsWith('.exe'));
              
              for (const exe of exeFiles) {
                // Prioriser les exe qui ont le nom du dossier (exe principal)
                const isPrimary = exe.toLowerCase().replace('.exe', '') === dir.name.toLowerCase();
                
                apps.push({
                  path: path.join(appPath, exe),
                  name: exe,
                  nameWithoutExt: exe.replace('.exe', ''),
                  directory: appPath,
                  extension: '.exe',
                  type: 'application',
                  icon: '⚙️',
                  baseScore: isPrimary ? 20 : 15, // Score très élevé pour les apps
                  size: 0,
                  modified: new Date(),
                  isPrimary: isPrimary
                });
              }
            } catch (err) {
              // Ignorer les erreurs d'accès
            }
          }
        }
      } catch (err) {
        console.error(`Erreur scan ${programPath}:`, err.message);
      }
    }

    // 2. Applications du menu Démarrer (raccourcis)
    const startMenuPaths = [
      path.join(os.homedir(), 'AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs'),
      'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs'
    ];

    for (const startMenuPath of startMenuPaths) {
      if (!fs.existsSync(startMenuPath)) continue;

      try {
        this.scanStartMenu(startMenuPath, apps);
      } catch (err) {
        console.error(`Erreur scan menu démarrer:`, err.message);
      }
    }

    // 3. Applications Windows par défaut (courantes)
    const windowsApps = [
      { name: 'Notepad', path: 'C:\\Windows\\System32\\notepad.exe' },
      { name: 'Calculator', path: 'C:\\Windows\\System32\\calc.exe' },
      { name: 'Paint', path: 'C:\\Windows\\System32\\mspaint.exe' },
      { name: 'Command Prompt', path: 'C:\\Windows\\System32\\cmd.exe' },
      { name: 'PowerShell', path: 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' },
      { name: 'Task Manager', path: 'C:\\Windows\\System32\\taskmgr.exe' },
      { name: 'Explorer', path: 'C:\\Windows\\explorer.exe' },
    ];

    for (const app of windowsApps) {
      if (fs.existsSync(app.path)) {
        apps.push({
          path: app.path,
          name: app.name + '.exe',
          nameWithoutExt: app.name,
          directory: path.dirname(app.path),
          extension: '.exe',
          type: 'application',
          icon: '⚙️',
          baseScore: 25, // Score maximum pour les apps système
          size: 0,
          modified: new Date(),
          isPrimary: true
        });
      }
    }

    console.log(`  ✓ ${apps.length} applications trouvées`);
    return apps;
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
          { name: 'name', weight: 0.9 }
        ],
        threshold: 0.3,      // Plus strict pour les apps
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