const { contextBridge, ipcRenderer } = require('electron');

// Exposer des fonctions sécurisées au frontend
contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getAppIcon: (appPath) => ipcRenderer.invoke('get-app-icon', appPath)
});