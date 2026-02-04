const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1800,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');  

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();    
  });

  mainWindow.on('closed', () => {
    mainWindow = null;    
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for automation
ipcMain.handle('start-automation', async (event) => {
  // TODO: Implement automation start logic
  return { success: true, message: 'Automation started' };
});

ipcMain.handle('stop-automation', async (event) => {
  // TODO: Implement automation stop logic
  return { success: true, message: 'Automation stopped' };
});

ipcMain.handle('get-history', async (event) => {
  // TODO: Implement history retrieval logic
  return [];
});

// Scenario execution handlers
ipcMain.handle('execute-mouse-click', async (event, { x, y }) => {
  // TODO: Implement actual mouse click using robotjs or similar
  console.log(`Mouse click at (${x}, ${y})`);
  
  return { success: true };
  
});

ipcMain.handle('execute-mouse-move', async (event, { x, y, speed }) => {
  // TODO: Implement mouse movement with specified speed
  console.log(`Mouse move to (${x}, ${y}) with speed: ${speed}`);
  return { success: true };
});

ipcMain.handle('execute-key-press', async (event, { key }) => {
  // TODO: Implement key press
  console.log(`Key press: ${key}`);
  return { success: true };
});

ipcMain.handle('execute-type-text', async (event, { text }) => {
  // TODO: Implement text input
  console.log(`Type text: ${text}`);
  return { success: true };
});

ipcMain.handle('execute-wait', async (event, { duration }) => {
  // TODO: Implement wait
  console.log(`Wait: ${duration}ms`);

  await new Promise(resolve => setTimeout(resolve, duration));
  return { success: true };

  
});

ipcMain.handle('take-screenshot', async (event, { path }) => {
  // TODO: Implement screenshot capture
  console.log(`Take screenshot: ${path}`);
  return { success: true, path: path };
});

ipcMain.handle('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();    
  }
});
ipcMain.handle('close-window', () => {
  mainWindow.close();
});

// ===========================================
// TELEGRAM BOT IPC HANDLERS
// ===========================================

// Test Telegram Bot Connection
ipcMain.handle('test-telegram-connection', async (event, { token, chatId }) => {
  try {
    // Telegram Bot API URL for getMe
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);

    if (!response.ok) {
      return { success: false, error: 'Invalid bot token or connection failed' };
    }

    const botInfo = await response.json();

    if (botInfo.ok) {
      // Also verify chat access
      const chatResponse = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);

      if (!chatResponse.ok) {
        return { success: false, error: 'Cannot access this chat. Check your Chat ID.' };
      }

      return {
        success: true,
        botName: botInfo.result.first_name,
        username: botInfo.result.username
      };
    } else {
      return { success: false, error: 'Failed to get bot info' };
    }
  } catch (error) {
    console.error('Telegram connection test error:', error);
    return { success: false, error: error.message || 'Connection failed' };
  }
});

// Send Telegram Message
ipcMain.handle('send-telegram-message', async (event, { token, chatId, message }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();

    if (result.ok) {
      return { success: true, messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description || 'Failed to send message' };
    }
  } catch (error) {
    console.error('Telegram send message error:', error);
    return { success: false, error: error.message || 'Failed to send message' };

  }
});

// Send Photo to Telegram
ipcMain.handle('send-telegram-photo', async (event, { token, chatId, photoPath, caption }) => {
  try {
    // For simplicity, we'll use the sendDocument endpoint with the photo
    // In production, you'd want to properly handle file uploads
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', await fetch(photoPath).then(r => r.blob()));
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (result.ok) {
      return { success: true, messageId: result.result.message_id };
    } else {
      return { success: false, error: result.description || 'Failed to send photo' };
    }
  } catch (error) {
    console.error('Telegram send photo error:', error);
    return { success: false, error: error.message || 'Failed to send photo' };
  }
});

// Get Telegram Updates (for polling messages)
ipcMain.handle('get-telegram-updates', async (event, { token, chatId, offset = 0 }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        offset: offset,
        limit: 100,
        timeout: 30
      })
    });

    const result = await response.json();

    if (result.ok) {
      // Filter updates to only show messages from our chat
      const chatUpdates = result.result.filter(update => {
        if (!update.message) return false;
        // If chatId is specified, only return messages from that chat
        if (chatId && update.message.chat.id.toString() !== chatId.toString()) {
          return false;
        }
        return true;
      });

      // Get the latest update ID
      let latestOffset = offset;
      if (result.result.length > 0) {
        latestOffset = Math.max(...result.result.map(u => u.update_id)) + 1;
      }

      return {
        success: true,
        updates: chatUpdates.map(update => ({
          id: update.update_id,
          time: new Date(update.message.date * 1000),
          sender: update.message.from.first_name + (update.message.from.last_name ? ' ' + update.message.from.last_name : ''),
          username: update.message.from.username ? '@' + update.message.from.username : '',
          content: update.message.text || update.message.caption || '[Media Message]',
          type: getMessageType(update.message),
          chatId: update.message.chat.id
        })),
        offset: latestOffset
      };
    } else {
      return { success: false, error: result.description || 'Failed to get updates' };
    }
  } catch (error) {
    console.error('Telegram get updates error:', error);
    return { success: false, error: error.message || 'Failed to get updates' };
  }
});

// Helper function to determine message type
function getMessageType(message) {
  if (message.text) return 'text';
  if (message.document) return 'document';
  if (message.photo) return 'photo';
  if (message.sticker) return 'sticker';
  if (message.animation) return 'animation';
  if (message.voice) return 'voice';
  if (message.video) return 'video';
  if (message.contact) return 'contact';
  if (message.location) return 'location';
  return 'unknown';
}

// Reply to Telegram Message
ipcMain.handle('reply-telegram-message', async (event, { token, chatId, messageId, text }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_to_message_id: messageId,
        parse_mode: 'HTML'
      })
    });
  
    const result = await response.json();            

    if (result.ok) {
      return { success: true, messageId: result.result.message_id };
      
    } else {
      return { success: false, error: result.description || 'Failed to reply' };      
    }
  } catch (error) {
    console.error('Telegram reply error:', error);

    return { success: false, error: error.message || 'Failed to reply' };
  }
});
