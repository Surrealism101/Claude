const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('homeworkAPI', {
  load: () => ipcRenderer.invoke('homework:load'),
  save: (data) => ipcRenderer.invoke('homework:save', data)
});
