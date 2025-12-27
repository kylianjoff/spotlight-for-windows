const fs = require('fs');
const path = require('path');
const os = require('os');
const fg = require('fast-glob');
const Fuse = require('fuse.js');

class FileSearcher {
  constructor() {
    this.index = [];
    this.fuse = null;
    this.isIndexing = false;
  }

  // Indexer les fichiers au démarrage
  async buildIndex() {
    if (this.isIndexing) return;
    this.isIndexing = true;
    
    console.log('Début de l\'indexation...');
    const startTime = Date.now();

    try {
      // Dossiers à indexer
      const userHome = os.homedir();
      const searchPaths = [
        path.join(userHome, 'Desktop'),
        path.join(userHome, 'Documents'),
        path.join(userHome, 'Downloads'),
        path.join(userHome, 'Pictures'),
        // Ajoute d'autres dossiers si besoin
      ];

      const allFiles = [];

      for (const searchPath of searchPaths) {
        if (!fs.existsSync(searchPath)) continue;

        try {
          // Rechercher tous les fichiers (max depth 3 pour la perf)
          const files = await fg([
            `${searchPath}/**/*`,
          ], {
            onlyFiles: true,
            deep: 3,
            ignore: [
              '**/node_modules/**',
              '**/.git/**',
              '**/AppData/**',
              '**/$RECYCLE.BIN/**'
            ]
          });

          allFiles.push(...files);
        } catch (err) {
          console.error(`Erreur lors du scan de ${searchPath}:`, err.message);
        }
      }

      // Ajouter les applications Windows courantes
      const programFiles = 'C:\\Program Files';
      const programFilesX86 = 'C:\\Program Files (x86)';
      
      const apps = this.scanApplications([programFiles, programFilesX86]);
      
      // Créer l'index avec métadonnées
      this.index = allFiles.map(filePath => {
        const stats = fs.statSync(filePath);
        const fileName = path.basename(filePath);
        const ext = path.extname(filePath);
        
        return {
          path: filePath,
          name: fileName,
          nameWithoutExt: path.basename(filePath, ext),
          directory: path.dirname(filePath),
          extension: ext,
          type: this.getFileType(ext),
          size: stats.size,
          modified: stats.mtime,
          icon: this.getIcon(ext)
        };
      });

      // Ajouter les applications
      this.index.push(...apps);

      // Configurer Fuse.js pour la recherche floue
      this.fuse = new Fuse(this.index, {
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'nameWithoutExt', weight: 0.8 },
          { name: 'directory', weight: 0.2 }
        ],
        threshold: 0.4, // 0 = exact, 1 = tout match
        distance: 100,
        includeScore: true,
        minMatchCharLength: 2
      });

      const endTime = Date.now();
      console.log(`Indexation terminée: ${this.index.length} fichiers en ${endTime - startTime}ms`);
    } catch (error) {
      console.error('Erreur lors de l\'indexation:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  // Scanner les applications
  scanApplications(programPaths) {
    const apps = [];
    
    for (const programPath of programPaths) {
      if (!fs.existsSync(programPath)) continue;

      try {
        const dirs = fs.readdirSync(programPath, { withFileTypes: true });
        
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            const appPath = path.join(programPath, dir.name);
            
            // Chercher les .exe dans le dossier
            try {
              const files = fs.readdirSync(appPath);
              const exeFiles = files.filter(f => f.endsWith('.exe'));
              
              for (const exe of exeFiles) {
                apps.push({
                  path: path.join(appPath, exe),
                  name: exe,
                  nameWithoutExt: exe.replace('.exe', ''),
                  directory: appPath,
                  extension: '.exe',
                  type: 'application',
                  icon: '⚙️'
                });
              }
            } catch (err) {
              // Ignorer les erreurs d'accès
            }
          }
        }
      } catch (err) {
        console.error(`Erreur scan apps ${programPath}:`, err.message);
      }
    }

    return apps;
  }

  // Rechercher dans l'index
  search(query, limit = 10) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    if (!this.fuse) {
      return [];
    }

    // Recherche floue avec Fuse.js
    const results = this.fuse.search(query, { limit });
    
    // Retourner les résultats formatés
    return results.map(result => ({
      ...result.item,
      score: result.score
    }));
  }

  // Déterminer le type de fichier
  getFileType(ext) {
    const types = {
      // Documents
      '.pdf': 'document',
      '.doc': 'document',
      '.docx': 'document',
      '.txt': 'document',
      '.md': 'document',
      
      // Images
      '.jpg': 'image',
      '.jpeg': 'image',
      '.png': 'image',
      '.gif': 'image',
      '.svg': 'image',
      '.webp': 'image',
      
      // Vidéos
      '.mp4': 'video',
      '.avi': 'video',
      '.mkv': 'video',
      '.mov': 'video',
      
      // Audio
      '.mp3': 'audio',
      '.wav': 'audio',
      '.flac': 'audio',
      
      // Code
      '.js': 'code',
      '.ts': 'code',
      '.py': 'code',
      '.java': 'code',
      '.cpp': 'code',
      '.c': 'code',
      '.html': 'code',
      '.css': 'code',
      
      // Archives
      '.zip': 'archive',
      '.rar': 'archive',
      '.7z': 'archive',
      
      // Applications
      '.exe': 'application',
      '.msi': 'application',
    };

    return types[ext.toLowerCase()] || 'file';
  }

  // Obtenir l'icône selon le type
  getIcon(ext) {
    const icons = {
      '.pdf': '📄',
      '.doc': '📝',
      '.docx': '📝',
      '.txt': '📃',
      '.md': '📋',
      
      '.jpg': '🖼️',
      '.jpeg': '🖼️',
      '.png': '🖼️',
      '.gif': '🖼️',
      
      '.mp4': '🎬',
      '.avi': '🎬',
      '.mkv': '🎬',
      
      '.mp3': '🎵',
      '.wav': '🎵',
      
      '.js': '📜',
      '.ts': '📜',
      '.py': '🐍',
      '.java': '☕',
      
      '.zip': '📦',
      '.rar': '📦',
      
      '.exe': '⚙️',
      
      'folder': '📁',
    };

    return icons[ext.toLowerCase()] || '📄';
  }

  // Formater la taille du fichier
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = FileSearcher;