const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window Management
  startAutomation: () => ipcRenderer.invoke('start-automation'),
  stopAutomation: () => ipcRenderer.invoke('stop-automation'),
  getHistory: () => ipcRenderer.invoke('get-history'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // ===========================================
  // NUT.JS ACTION HANDLERS
  // ===========================================

  // Control Flow Actions
  executeDelay: (params) => ipcRenderer.invoke('execute-delay', params),
  executeIf: (params) => ipcRenderer.invoke('execute-if', params),
  executeLoop: (params) => ipcRenderer.invoke('execute-loop', params),

  // Application / Window Actions
  executeLaunchApp: (params) => ipcRenderer.invoke('execute-launch-app', params),
  executeActivateWindow: (params) => ipcRenderer.invoke('execute-activate-window', params),

  // Mouse Actions
  executeMouseMove: (params) => ipcRenderer.invoke('execute-mouse-move', params),
  executeMouseClick: (params) => ipcRenderer.invoke('execute-mouse-click', params),

  // Keyboard Actions
  executeTypeText: (params) => ipcRenderer.invoke('execute-type-text', params),
  executeKeyPress: (params) => ipcRenderer.invoke('execute-key-press', params),
  executeHotkey: (params) => ipcRenderer.invoke('execute-hotkey', params),

  // Clipboard Actions
  executeSetClipboard: (params) => ipcRenderer.invoke('execute-set-clipboard', params),
  executeReadClipboard: (params) => ipcRenderer.invoke('execute-read-clipboard', params),

  // Wait / Sync Actions
  executeWaitClipboardChange: (params) => ipcRenderer.invoke('execute-wait-clipboard-change', params),
  executeWaitPixelColor: (params) => ipcRenderer.invoke('execute-wait-pixel-color', params),

  // Screen Capture Actions
  executeScreenshotRegion: (params) => ipcRenderer.invoke('execute-screenshot-region', params),

  // Legacy Handlers (for backward compatibility)
  executeMouseClickLegacy: (x, y) => ipcRenderer.invoke('execute-mouse-click', { x, y }),
  executeMouseMoveLegacy: (x, y) => ipcRenderer.invoke('execute-mouse-move', { x, y }),
  executeKeyPressLegacy: (key) => ipcRenderer.invoke('execute-key-press', { key }),
  executeTypeTextLegacy: (text) => ipcRenderer.invoke('execute-type-text', { text }),
  executeWaitLegacy: (duration) => ipcRenderer.invoke('execute-wait', { duration }),
  takeScreenshotLegacy: (path) => ipcRenderer.invoke('take-screenshot', { path }),

  // Clipboard operations (for FIFO message processing)
  setClipboardText: (text) => ipcRenderer.invoke('set-clipboard-text', { text }),
  clearClipboard: () => ipcRenderer.invoke('clear-clipboard'),
  readClipboard: () => ipcRenderer.invoke('read-clipboard-text'),

  // Telegram Bot
  testTelegramConnection: (data) => ipcRenderer.invoke('test-telegram-connection', data),
  sendTelegramMessage: (data) => ipcRenderer.invoke('send-telegram-message', data),
  sendTelegramPhoto: (data) => ipcRenderer.invoke('send-telegram-photo', data),
  getTelegramUpdates: (data) => ipcRenderer.invoke('get-telegram-updates', data),
  replyTelegramMessage: (data) => ipcRenderer.invoke('reply-telegram-message', data),
  executeSendMessageToTele: (data) => ipcRenderer.invoke('execute-send-message-to-tele', data),

  // Coordinate Recording
  startCoordinateRecording: () => ipcRenderer.invoke('start-coordinate-recording'),
  stopCoordinateRecording: () => ipcRenderer.invoke('stop-coordinate-recording'),
  getRecordedCoordinates: () => ipcRenderer.invoke('get-recorded-coordinates'),
  clearRecordedCoordinates: () => ipcRenderer.invoke('clear-recorded-coordinates'),
  onCoordinateCaptured: (callback) => ipcRenderer.on('coordinates-captured', (event, data) => callback(data)),
  onCoordinateCountUpdate: (callback) => ipcRenderer.on('coordinate-count-update', (event, count) => callback(count)),
  onCoordinateRecordingStopped: (callback) => ipcRenderer.on('coordinate-recording-stopped', (event, data) => callback(data))
});
