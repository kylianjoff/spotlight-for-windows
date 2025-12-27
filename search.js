const fs = require('fs');
const path = require('path');
const os = require('os');
const Fuse = require('fuse.js');

class FileSearcher {
  constructor() {
    this.index = [];
    this.fuse = null;
    this.isIndexing = false;
    this.recentFiles = new Set(); // Fichiers récemment ouverts
  }

  // Scanner récursif optimisé
  scanDirectory(dir, depth = 0, maxDepth = 3) {
    if (depth > maxDepth) return [];
    
    const files = [];
    
    // Dossiers à ignorer
    const ignoreDirs = [
      'node_modules', '.git', 'AppData', '$RECYCLE.BIN', 
      'System Volume Information', 'Windows', 'ProgramData',
      '.vscode', '.idea', '__pycache__', 'dist', 'build',
      'tmp', 'temp', 'cache'
    ];
    
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const item of items) {
        // Ignorer les fichiers/dossiers cachés et système
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
              // Score de pertinence initial basé sur la localisation
              baseScore: this.getLocationScore(dir)
            });
          } else if (item.isDirectory() && depth < maxDepth) {
            // Ignorer certains dossiers
            if (!ignoreDirs.includes(item.name)) {
              files.push(...this.scanDirectory(fullPath, depth + 1, maxDepth));
            }
          }
        } catch (err) {
          // Ignorer les erreurs d'accès (permissions, etc.)
        }
      }
    } catch (err) {
      // Dossier inaccessible
    }
    
    return files;
  }

  // Score basé sur l'emplacement du fichier
  getLocationScore(directory) {
    const userHome = os.homedir();
    
    // Scores de priorité par emplacement
    if (directory.includes(path.join(userHome, 'Desktop'))) return 10;
    if (directory.includes(path.join(userHome, 'Documents'))) return 9;
    if (directory.includes(path.join(userHome, 'Downloads'))) return 8;
    if (directory.includes(path.join(userHome, 'Pictures'))) return 7;
    if (directory.includes(path.join(userHome, 'Videos'))) return 7;
    if (directory.includes(path.join(userHome, 'Music'))) return 7;
    if (directory.includes(userHome)) return 6; // Autres dossiers user
    if (directory.includes('C:\\Program Files')) return 5;
    
    return 3; // Par défaut
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
      
      // Dossiers principaux à indexer
      const searchPaths = [
        // Dossiers utilisateur (priorité haute)
        { path: path.join(userHome, 'Desktop'), depth: 3 },
        { path: path.join(userHome, 'Documents'), depth: 3 },
        { path: path.join(userHome, 'Downloads'), depth: 3 },
        { path: path.join(userHome, 'Pictures'), depth: 2 },
        { path: path.join(userHome, 'Videos'), depth: 2 },
        { path: path.join(userHome, 'Music'), depth: 2 },
        
        // Autres dossiers utilisateur
        { path: userHome, depth: 1 },
        
        // Applications
        { path: 'C:\\Program Files', depth: 2 },
        { path: 'C:\\Program Files (x86)', depth: 2 },
        
        // Disques supplémentaires (si existent)
        { path: 'D:\\', depth: 2 },
        { path: 'E:\\', depth: 2 },
      ];

      this.index = [];

      for (const { path: searchPath, depth } of searchPaths) {
        if (!fs.existsSync(searchPath)) {
          continue;
        }
        
        console.log(`📂 Scan de ${searchPath} (profondeur ${depth})...`);
        const files = this.scanDirectory(searchPath, 0, depth);
        console.log(`  ✓ ${files.length} fichiers trouvés`);
        this.index.push(...files);
      }

      // Ajouter les applications Windows
      console.log('⚙️ Scan des applications...');
      const apps = this.scanApplications();
      console.log(`  ✓ ${apps.length} applications trouvées`);
      this.index.push(...apps);

      // Configurer Fuse.js avec pondération avancée
      this.fuse = new Fuse(this.index, {
        keys: [
          { name: 'nameWithoutExt', weight: 1.0 },  // Nom sans extension (max priorité)
          { name: 'name', weight: 0.8 },            // Nom complet
          { name: 'directory', weight: 0.2 }        // Chemin (faible poids)
        ],
        threshold: 0.4,        // Tolérance aux erreurs
        distance: 100,         // Distance de recherche
        includeScore: true,
        minMatchCharLength: 1,
        ignoreLocation: true,  // Ne pas se fier à la position dans la chaîne
        shouldSort: true       // Trier par pertinence
      });

      const endTime = Date.now();
      console.log(`✅ Indexation terminée: ${this.index.length} éléments en ${(endTime - startTime) / 1000}s`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'indexation:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  // Scanner les applications installées
  scanApplications() {
    const apps = [];
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
              
              for (const exe of exeFiles.slice(0, 3)) { // Max 3 exe par app
                apps.push({
                  path: path.join(appPath, exe),
                  name: exe,
                  nameWithoutExt: exe.replace('.exe', ''),
                  directory: appPath,
                  extension: '.exe',
                  type: 'application',
                  icon: '⚙️',
                  baseScore: 8, // Apps ont un score élevé
                  size: 0,
                  modified: new Date()
                });
              }
            } catch (err) {
              // Ignorer
            }
          }
        }
      } catch (err) {
        // Ignorer
      }
    }

    return apps;
  }

  // Recherche intelligente avec scoring personnalisé
  search(query, limit = 15) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    if (!this.fuse) {
      console.log('⚠️ Index pas encore prêt');
      return [];
    }

    const startSearch = Date.now();
    
    // Recherche avec Fuse.js
    let results = this.fuse.search(query, { limit: limit * 3 }); // Chercher plus pour mieux trier
    
    // Calculer un score personnalisé
    results = results.map(result => {
      const item = result.item;
      let customScore = result.score; // Score Fuse (0 = parfait, 1 = mauvais)
      
      // Bonus pour les fichiers récents
      const daysSinceModified = (Date.now() - item.modified) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) {
        customScore *= 0.8; // Bonus 20%
      } else if (daysSinceModified < 30) {
        customScore *= 0.9; // Bonus 10%
      }
      
      // Bonus selon l'emplacement (baseScore élevé = meilleur)
      customScore *= (11 - item.baseScore) / 10;
      
      // Bonus pour les fichiers avec le bon type
      const queryLower = query.toLowerCase();
      if (queryLower.includes(item.type)) {
        customScore *= 0.85;
      }
      
      // Bonus si le nom commence par la query (match exact au début)
      if (item.nameWithoutExt.toLowerCase().startsWith(queryLower)) {
        customScore *= 0.6; // Gros bonus
      }
      
      // Bonus pour les extensions populaires
      const popularExts = ['.pdf', '.docx', '.xlsx', '.pptx', '.txt', '.png', '.jpg'];
      if (popularExts.includes(item.extension)) {
        customScore *= 0.95;
      }
      
      return {
        ...item,
        score: customScore,
        originalScore: result.score
      };
    });
    
    // Trier par score personnalisé
    results.sort((a, b) => a.score - b.score);
    
    // Limiter aux meilleurs résultats
    results = results.slice(0, limit);
    
    const endSearch = Date.now();
    console.log(`🔎 Recherche "${query}": ${results.length} résultats en ${endSearch - startSearch}ms`);
    
    return results;
  }

  getFileType(ext) {
    const types = {
      // Documents
      '.pdf': 'document',
      '.doc': 'document',
      '.docx': 'document',
      '.txt': 'document',
      '.md': 'document',
      '.rtf': 'document',
      '.odt': 'document',
      
      // Tableurs
      '.xlsx': 'spreadsheet',
      '.xls': 'spreadsheet',
      '.csv': 'spreadsheet',
      
      // Présentations
      '.pptx': 'presentation',
      '.ppt': 'presentation',
      
      // Images
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.webp': 'image',
      '.bmp': 'image',
      '.ico': 'image',
      
      // Vidéos
      '.mp4': 'video',
      '.avi': 'video',
      '.mkv': 'video',
      '.mov': 'video',
      '.wmv': 'video',
      '.flv': 'video',
      
      // Audio
      '.mp3': 'audio',
      '.wav': 'audio',
      '.flac': 'audio',
      '.m4a': 'audio',
      '.ogg': 'audio',
      
      // Code
      '.js': 'code',
      '.ts': 'code',
      '.tsx': 'code',
      '.jsx': 'code',
      '.py': 'code',
      '.java': 'code',
      '.cpp': 'code',
      '.c': 'code',
      '.h': 'code',
      '.cs': 'code',
      '.php': 'code',
      '.rb': 'code',
      '.go': 'code',
      '.rs': 'code',
      '.html': 'code',
      '.css': 'code',
      '.scss': 'code',
      '.json': 'code',
      '.xml': 'code',
      '.yaml': 'code',
      '.yml': 'code',
      
      // Archives
      '.zip': 'archive',
      '.rar': 'archive',
      '.7z': 'archive',
      '.tar': 'archive',
      '.gz': 'archive',
      
      // Applications
      '.exe': 'application',
      '.msi': 'application',
      '.bat': 'script',
      '.sh': 'script',
      '.ps1': 'script',
    };

    return types[ext.toLowerCase()] || 'file';
  }

  getIcon(ext) {
    const icons = {
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.txt': '📃',
      '.md': '📋',
      
      '.xlsx': '📊',
      '.xls': '📊',
      '.csv': '📊',
      
      '.pptx': '📽️',
      '.ppt': '📽️',
      
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      '.svg': '🎨',
      
      '.mp4': '🎬',
      '.avi': '🎬',
      '.mkv': '🎬',
      
      '.mp3': '🎵',
      '.wav': '🎵',
      '.flac': '🎵',
      
      '.js': '📜',
      '.ts': '📜',
      '.py': '🐍',
      '.java': '☕',
      '.cpp': '⚙️',
      '.html': '🌐',
      '.css': '🎨',
      
      '.zip': '📦',
      '.rar': '📦',
      '.7z': '📦',
      
      '.exe': '⚙️',
      '.msi': '📦',
    };

    return icons[ext.toLowerCase()] || '📄';
  }
}

module.exports = FileSearcher;