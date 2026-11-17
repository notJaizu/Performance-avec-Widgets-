const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Récupère l'ensemble des métriques système en temps réel. */
  systemInfo: () => ipcRenderer.invoke('system-info'),
});
