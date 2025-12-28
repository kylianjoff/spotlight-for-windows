const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const crypto = require('crypto');

// Cache des icônes
const iconCache = new Map();
const iconCacheDir = path.join(os.tmpdir(), 'spotlight-icons');

class IconExtractor {
  constructor() {
    // Créer le dossier de cache
    if (!fs.existsSync(iconCacheDir)) {
      fs.mkdirSync(iconCacheDir, { recursive: true });
    }
    console.log('📂 Cache icônes:', iconCacheDir);
  }

  // Extraire l'icône d'un .exe ou .lnk
  async extractIcon(filePath, appName) {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }

    // Générer clé de cache
    const cacheKey = crypto.createHash('md5').update(filePath.toLowerCase()).digest('hex');
    
    // Vérifier cache mémoire
    if (iconCache.has(cacheKey)) {
      return iconCache.get(cacheKey);
    }

    // Vérifier cache disque
    const cachedIconPath = path.join(iconCacheDir, `${cacheKey}.png`);
    if (fs.existsSync(cachedIconPath)) {
      const iconUrl = `file:///${cachedIconPath.replace(/\\/g, '/')}`;
      iconCache.set(cacheKey, iconUrl);
      return iconUrl;
    }

    // Extraire l'icône
    try {
      let targetPath = filePath;

      // Si c'est un .lnk, résoudre la cible
      if (filePath.endsWith('.lnk')) {
        targetPath = await this.resolveLnkTarget(filePath);
        if (!targetPath || !fs.existsSync(targetPath)) {
          return null;
        }
      }

      // Extraire avec PowerShell
      const success = await this.extractWithPowerShell(targetPath, cachedIconPath);
      
      if (success && fs.existsSync(cachedIconPath)) {
        const iconUrl = `file:///${cachedIconPath.replace(/\\/g, '/')}`;
        iconCache.set(cacheKey, iconUrl);
        return iconUrl;
      }
    } catch (error) {
      // Erreur silencieuse, on retournera null
    }

    return null;
  }

  // Extraire l'icône avec PowerShell
  extractWithPowerShell(exePath, outputPath) {
    return new Promise((resolve) => {
      // Échapper les chemins pour PowerShell
      const escapedExePath = exePath.replace(/'/g, "''").replace(/\\/g, '\\\\');
      const escapedOutputPath = outputPath.replace(/'/g, "''").replace(/\\/g, '\\\\');

      // Script PowerShell optimisé
      const psScript = `
        try {
          Add-Type -AssemblyName System.Drawing
          $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${escapedExePath}')
          if ($icon) {
            $bitmap = $icon.ToBitmap()
            $bitmap.Save('${escapedOutputPath}', [System.Drawing.Imaging.ImageFormat]::Png)
            $bitmap.Dispose()
            $icon.Dispose()
            exit 0
          }
          exit 1
        } catch {
          exit 1
        }
      `;

      // Encoder en base64 pour éviter les problèmes d'échappement
      const psScriptB64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const command = `powershell -NoProfile -NonInteractive -EncodedCommand ${psScriptB64}`;

      exec(command, { timeout: 3000, windowsHide: true }, (error, stdout, stderr) => {
        if (error || !fs.existsSync(outputPath)) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }

  // Résoudre la cible d'un raccourci .lnk
  resolveLnkTarget(lnkPath) {
    return new Promise((resolve) => {
      const escapedPath = lnkPath.replace(/'/g, "''").replace(/\\/g, '\\\\');
      
      const psScript = `
        try {
          $shell = New-Object -ComObject WScript.Shell
          $shortcut = $shell.CreateShortcut('${escapedPath}')
          Write-Output $shortcut.TargetPath
          exit 0
        } catch {
          exit 1
        }
      `;

      const psScriptB64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const command = `powershell -NoProfile -NonInteractive -EncodedCommand ${psScriptB64}`;

      exec(command, { timeout: 2000, windowsHide: true }, (error, stdout) => {
        if (error || !stdout) {
          resolve(null);
        } else {
          const target = stdout.trim();
          resolve(target || null);
        }
      });
    });
  }

  // Nettoyer le cache (optionnel)
  clearCache() {
    try {
      const files = fs.readdirSync(iconCacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(iconCacheDir, file));
      }
      iconCache.clear();
      console.log('✅ Cache icônes nettoyé');
    } catch (error) {
      console.error('Erreur nettoyage cache:', error);
    }
  }

  // Pré-extraire plusieurs icônes en parallèle
  async extractIconsBatch(apps, maxConcurrent = 5) {
    const results = [];
    
    for (let i = 0; i < apps.length; i += maxConcurrent) {
      const batch = apps.slice(i, i + maxConcurrent);
      const promises = batch.map(app => 
        this.extractIcon(app.path, app.displayName || app.name)
          .then(iconPath => ({ app, iconPath }))
          .catch(() => ({ app, iconPath: null }))
      );
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

module.exports = IconExtractor;