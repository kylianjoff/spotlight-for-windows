const { contextBridge, ipcRenderer } = require('electron');

// Exposer des fonctions sécurisées au frontend
contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  searchFiles: (query) => {
    // Ici tu pourras appeler des fonctions de recherche Node.js
    return ['Résultat 1', 'Résultat 2', 'Résultat 3'];
  }
});