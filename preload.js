const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startAutomation: () => ipcRenderer.invoke('start-automation'),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  // Scenario execution
  executeMouseClick: (x, y) => ipcRenderer.invoke('execute-mouse-click', { x, y }),
  executeMouseMove: (x, y, speed) => ipcRenderer.invoke('execute-mouse-move', { x, y, speed }),
  executeKeyPress: (key) => ipcRenderer.invoke('execute-key-press', { key }),
  executeTypeText: (text) => ipcRenderer.invoke('execute-type-text', { text }),
  executeWait: (duration) => ipcRenderer.invoke('execute-wait', { duration }),
  takeScreenshot: (path) => ipcRenderer.invoke('take-screenshot', { path }),
  // Telegram Bot
  testTelegramConnection: (data) => ipcRenderer.invoke('test-telegram-connection', data),
  sendTelegramMessage: (data) => ipcRenderer.invoke('send-telegram-message', data),
  sendTelegramPhoto: (data) => ipcRenderer.invoke('send-telegram-photo', data),
  getTelegramUpdates: (data) => ipcRenderer.invoke('get-telegram-updates', data),
  replyTelegramMessage: (data) => ipcRenderer.invoke('reply-telegram-message', data)
});

