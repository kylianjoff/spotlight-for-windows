const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow: () => ipcRenderer.send('hide-window'),
  searchFiles: (query) => ipcRenderer.invoke('search-files', query),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getAppIcon: (appPath) => ipcRenderer.invoke('get-app-icon', appPath),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),

  // Auto-launch
  getAutoLaunchStatus: () => ipcRenderer.invoke('get-autolaunch-status'),
  setAutoLaunch: (enabled) => ipcRenderer.invoke('set-autolaunch', enabled),

  // Mises à jour
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Ecouter les événements de mise à jour
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_, data) => callback(data)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', () => callback()),
  onDwnloadProgress: (callback) => ipcRenderer.on('download-progress', (_, data) => callback(data)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_, data) => callback(data)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_, error) => callback(error))
});