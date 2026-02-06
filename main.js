const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// RobotJS imports for desktop automation (fallback if nut.js fork fails)
let robotjs;

// Nut.js fork imports
let nut;
let nutScreen;
let nutMouse;
let nutKeyboard;
let nutClipboard;
let nutWindow;

async function loadNut() {
  if (!nut) {
    try {
      // Try the fork first
      const nutModule = require('@nut-tree-fork/nut-js');
      nut = nutModule;
      await nut.mouse;
      await nut.keyboard;
      await nut.clipboard;
      await nut.screen;
      await nut.window;
      nutScreen = nut.screen;
      nutMouse = nut.mouse;
      nutKeyboard = nut.keyboard;
      nutClipboard = nut.clipboard;
      nutWindow = nut.window;
      console.log('Nut.js fork loaded successfully');
    } catch (error) {
      console.error('Failed to load nut.js fork:', error);
      // Fallback to robotjs
      try {
        robotjs = require('robotjs');
        console.log('RobotJS loaded as fallback');
      } catch (robotError) {
        console.error('Failed to load robotjs:', robotError);
      }
    }
  }
  return nut;
}

let mainWindow;

// Coordinate Recording State
let isRecordingCoordinates = false;
let recordedCoordinates = [];
let coordinateRecordingInterval = null;
let lastMouseState = { x: 0, y: 0, lastMoveTime: 0 };

const { uIOhook } = require('uiohook-napi');

let mouseHookStarted = false;
let keyboardHookStarted = false;

// ===========================================
// GLOBAL KEYBOARD LISTENER FOR RECORDING STOP
// ===========================================

function setupKeyboardHook() {
  if (keyboardHookStarted) {
    console.log('>>> Keyboard hook already started, skipping...');
    return;
  }
  
  console.log('>>> Setting up keyboard hook for Enter key...');
  
  uIOhook.on('keydown', async (event) => {
    console.log('>>> Keydown received, keycode:', event.keycode, 'isRecordingCoordinates:', isRecordingCoordinates);
    
    // Enter key codes: 13 (standard), 28 (Windows/nut.js), or check for key property
    const isEnterKey = event.keycode === 13 || event.keycode === 28 || event.key === 'Enter';
    
    if (isEnterKey && isRecordingCoordinates) {
      console.log('>>> ENTER pressed during recording - stopping recording...');
      
      // Stop recording
      const coordinates = stopCoordinateRecording();
      
      // Restore window
      if (mainWindow) {
        mainWindow.restore();
        mainWindow.focus();
      }
      
      
      // Notify renderer that recording was stopped via keyboard
      if (mainWindow) {
        mainWindow.webContents.send('coordinate-recording-stopped', coordinates);
      }
    }
  });
  
  uIOhook.on('keyup', (event) => {
    console.log('>>> Keyup received, keycode:', event.keycode);
  });
  
  console.log('>>> Keyboard listeners registered.');
  
  keyboardHookStarted = true;
}

async function startCoordinateRecording() {
  if (isRecordingCoordinates) return;

  isRecordingCoordinates = true;
  recordedCoordinates = [];

  console.log('Starting coordinate recording (uiohook)...');

  await loadNut();

  if (mainWindow) {
    mainWindow.minimize();
  }

  // Set up keyboard hook for Enter key to stop recording
  console.log('>>> Calling setupKeyboardHook...');
  setupKeyboardHook();
  console.log('>>> setupKeyboardHook completed. keyboardHookStarted:', keyboardHookStarted);

  if (!mouseHookStarted) {
    uIOhook.on('mousedown', async event => {
      if (!isRecordingCoordinates) return;

      // LEFT button = 1
      if (event.button === 1) {
        try {
          const pos = nutMouse
            ? await nutMouse.getPosition()
            : { x: event.x, y: event.y };

          const last = recordedCoordinates.at(-1);

          if (
            !last ||
            Math.abs(last.x - pos.x) > 10 ||
            Math.abs(last.y - pos.y) > 10
          ) {
            recordedCoordinates.push({ x: pos.x, y: pos.y });

            console.log('>>> CAPTURED CLICK at:', pos.x, pos.y);

            if (mainWindow) {
              mainWindow.webContents.send(
              
                'coordinate-count-update',
                recordedCoordinates.length
              );
            }
          }
        } catch (err) {
          console.error('Click capture error:', err);
        }
      }
    });

    console.log('>>> Starting uIOhook...');
    uIOhook.start();
    console.log('>>> uIOhook started successfully');
    
    mouseHookStarted = true;
  }
}


function stopCoordinateRecording() {
  if (!isRecordingCoordinates) return null;
  
  isRecordingCoordinates = false;
  
  // Stop polling
  if (coordinateRecordingInterval) {
    clearInterval(coordinateRecordingInterval);
    coordinateRecordingInterval = null;
  }
  
  console.log('Coordinate recording stopped. Captured:', recordedCoordinates.length, 'positions');
  
  // Send recorded coordinates to renderer
  if (mainWindow) {
    mainWindow.webContents.send('coordinates-captured', recordedCoordinates);
  }
  
  const result = [...recordedCoordinates];
  recordedCoordinates = [];
  return result;
}

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

// Helper function to delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to convert key name
function getRobotKey(key) {
  const keyMap = {
    'enter': 'enter', 'escape': 'escape', 'tab': 'tab',
    'backspace': 'backspace', 'delete': 'delete',
    'up': 'up', 'down': 'down', 'left': 'left', 'right': 'right',
    'f1': 'f1', 'f2': 'f2', 'f3': 'f3', 'f4': 'f4',
    'f5': 'f5', 'f6': 'f6', 'f7': 'f7', 'f8': 'f8',
    'f9': 'f9', 'f10': 'f10', 'f11': 'f11', 'f12': 'f12',
    'space': 'space', ' ': 'space'
  };
  return keyMap[key.toLowerCase()] || key;
}

// ===========================================
// AUTOMATION IPC HANDLERS
// ===========================================

ipcMain.handle('start-automation', async (event) => {
  await loadNut();
  console.log('Automation started');
  return { success: true, message: 'Automation started' };
});

ipcMain.handle('stop-automation', async (event) => {
  console.log('Automation stopped');
  return { success: true, message: 'Automation stopped' };
});

ipcMain.handle('get-history', async (event) => {
  return [];
});

// ===========================================
// CONTROL FLOW ACTIONS
// ===========================================

// Delay Action
ipcMain.handle('execute-delay', async (event, { durationMs }) => {
  console.log(`Delay: ${durationMs}ms`);
  await delay(durationMs);
  return { success: true };
});

// If Condition
ipcMain.handle('execute-if', async (event, { condition }) => {
  console.log(`If condition: ${condition}`);
  return { success: true, conditionMet: true };
});

// Loop
ipcMain.handle('execute-loop', async (event, { count, condition }) => {
  console.log(`Loop: count=${count}, condition=${condition}`);
  return { success: true };
});

// ===========================================
// APPLICATION / WINDOW ACTIONS
// ===========================================

// Launch Application
ipcMain.handle('execute-launch-app', async (event, { executablePath, arguments: args }) => {
  try {
    console.log(`Launching app: ${executablePath} ${args || ''}`);
    const appArgs = args ? args.split(' ') : [];
    const process = spawn(executablePath, appArgs, { detached: true, stdio: 'ignore' });
    process.unref();
    return { success: true, message: `Launched ${executablePath}` };
  } catch (error) {
    console.error('Failed to launch app:', error);
    return { success: false, error: error.message };
  }
});

// Activate Window
ipcMain.handle('execute-activate-window', async (event, { titleContains, processName }) => {
  try {
    await loadNut();
    console.log(`Activating window: titleContains=${titleContains}, processName=${processName}`);
    const windows = await nutWindow.getWindows();
    let targetWindow = null;
    for (const win of windows) {
      const title = await win.title;
      if (titleContains && title.toLowerCase().includes(titleContains.toLowerCase())) {
        targetWindow = win;
        break;
      }
      if (processName && title.toLowerCase().includes(processName.toLowerCase())) {
        targetWindow = win;
        break;
      }
    }
    if (targetWindow) {
      await targetWindow.focus();
      return { success: true, message: `Activated window: ${await targetWindow.title}` };
    } else {
      return { success: false, error: 'Window not found' };
    }
  } catch (error) {
    console.error('Failed to activate window:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// MOUSE ACTIONS
// ===========================================

// Mouse Move
ipcMain.handle('execute-mouse-move', async (event, { x, y, speed }) => {
  try {
    // Try nut.js first
    if (nut) {
      await loadNut();
      console.log(`Nut.js: Mouse move to (${x}, ${y})`);
      await nut.mouse.move(new nut.Point(x, y));
      return { success: true };
    }
    // Fallback to robotjs
    if (robotjs) {
      console.log(`RobotJS: Mouse move to (${x}, ${y})`);
      robotjs.moveMouse(x, y);
      return { success: true };
    }
    return { success: false, error: 'No automation library available' };
  } catch (error) {
    console.error('Failed to move mouse:', error);
    return { success: false, error: error.message };
  }
});

// Mouse Click
ipcMain.handle('execute-mouse-click', async (event, { x, y, button, clickCount }) => {
  try {
    const clicks = clickCount || 1;
    const mouseButton = button === 'right' ? 'right' : button === 'middle' ? 'middle' : 'left';

    // Try nut.js first
    if (nut) {
      await loadNut();
      console.log(`Nut.js: Mouse click at (${x}, ${y}) button: ${mouseButton} count: ${clicks}`);
      await nut.mouse.move(new nut.Point(x, y));
      const nutButton = mouseButton === 'right' ? nut.Button.RIGHT :
                        mouseButton === 'middle' ? nut.Button.MIDDLE :
                        nut.Button.LEFT;
      for (let i = 0; i < clicks; i++) {
        await nut.mouse.click(nutButton);
      }
      return { success: true };
    }
    // Fallback to robotjs
    if (robotjs) {
      console.log(`RobotJS: Mouse click at (${x}, ${y}) button: ${mouseButton} count: ${clicks}`);
      robotjs.moveMouse(x, y);
      for (let i = 0; i < clicks; i++) {
        robotjs.mouseClick(mouseButton);
      }
      return { success: true };
    }
    return { success: false, error: 'No automation library available' };
  } catch (error) {
    console.error('Failed to click mouse:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// KEYBOARD ACTIONS
// ===========================================

// Type Text
ipcMain.handle('execute-type-text', async (event, { text, delayPerCharMs }) => {
  try {
    // Try nut.js first
    if (nut) {
      await loadNut();
      console.log(`Nut.js: Typing text: "${text}"`);
      if (delayPerCharMs && delayPerCharMs > 0) {
        await nutKeyboard.type(text, { delay: delayPerCharMs });
      } else {
        await nutKeyboard.type(text);
      }
      return { success: true };
    }
    // Fallback to robotjs
    if (robotjs) {
      console.log(`RobotJS: Typing text: "${text}"`);
      if (delayPerCharMs && delayPerCharMs > 0) {
        robotjs.typeStringDelayed(text, delayPerCharMs);
      } else {
        robotjs.typeString(text);
      }
      return { success: true };
    }
    return { success: false, error: 'No automation library available' };
  } catch (error) {
    console.error('Failed to type text:', error);
    return { success: false, error: error.message };
  }
});

// Key Press
ipcMain.handle('execute-key-press', async (event, { key }) => {
  try {
    const robotKey = getRobotKey(key);

    // Try nut.js first
    if (nut) {
      await loadNut();
      
      console.log(`Nut.js: Key press: ${key}`);

      // Key mapping for nut.js
      const nutKeyMap = {
        'enter': nutKeyboard.Key.Enter, 'escape': nutKeyboard.Key.Escape,
        'tab': nutKeyboard.Key.Tab, 'backspace': nutKeyboard.Key.Backspace,
        'delete': nutKeyboard.Key.Delete, 'insert': nutKeyboard.Key.Insert,
        'home': nutKeyboard.Key.Home, 'end': nutKeyboard.Key.End,
        'up': nutKeyboard.Key.Up, 'down': nutKeyboard.Key.Down,
        'left': nutKeyboard.Key.Left, 'right': nutKeyboard.Key.Right,
        'f1': nutKeyboard.Key.F1, 'f2': nutKeyboard.Key.F2,
        'f3': nutKeyboard.Key.F3, 'f4': nutKeyboard.Key.F4,
        'f5': nutKeyboard.Key.F5, 'f6': nutKeyboard.Key.F6,
        'f7': nutKeyboard.Key.F7, 'f8': nutKeyboard.Key.F8,
        'f9': nutKeyboard.Key.F9, 'f10': nutKeyboard.Key.F10,
        'f11': nutKeyboard.Key.F11, 'f12': nutKeyboard.Key.F12,
        'space': nutKeyboard.Key.Space
      };

      let nutKey = nutKeyMap[key.toLowerCase()] || key;
      await nutKeyboard.pressKey(nutKey);
      await nutKeyboard.releaseKey(nutKey);
      return { success: true };
    }
    // Fallback to robotjs
    if (robotjs) {
      console.log(`RobotJS: Key press: ${key}`);
      robotjs.keyTap(robotKey);
      return { success: true };
    }
    return { success: false, error: 'No automation library available' };
  } catch (error) {
    console.error('Failed to press key:', error);
    return { success: false, error: error.message };
  }
});

// Hotkey (multiple keys together)
ipcMain.handle('execute-hotkey', async (event, { keys }) => {
  try {
    console.log(`Hotkey: ${keys.join(' + ')}`);

    // Try nut.js first
    if (nut) {
      await loadNut();
      const nutKeyMap = {
        'ctrl': nutKeyboard.Key.LeftControl, 'control': nutKeyboard.Key.LeftControl,
        'alt': nutKeyboard.Key.LeftAlt, 'shift': nutKeyboard.Key.LeftShift,
        'win': nutKeyboard.Key.LeftSuper
      };

      const nutKeys = keys.map(k => nutKeyMap[k.toLowerCase()] || k);

      for (const key of nutKeys) {
        await nutKeyboard.pressKey(key);
      }
      for (const key of nutKeys.reverse()) {
        await nutKeyboard.releaseKey(key);
      }
      return { success: true };
    }
    // Fallback to robotjs
    if (robotjs) {
      const robotKeys = keys.map(k => k.toLowerCase());
      robotjs.keyTap(robotKeys[robotKeys.length - 1], robotKeys.slice(0, -1));
      return { success: true };
    }
    return { success: false, error: 'No automation library available' };
  } catch (error) {
    console.error('Failed to execute hotkey:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// CLIPBOARD ACTIONS
// ===========================================

// Set Clipboard
ipcMain.handle('execute-set-clipboard', async (event, { text }) => {
  try {
    console.log(`Set clipboard: "${text}"`);
    clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('Failed to set clipboard:', error);
    return { success: false, error: error.message };
  }
});

// Read Clipboard
ipcMain.handle('execute-read-clipboard', async (event, { saveToVariable }) => {
  try {
    const text = clipboard.readText();
    console.log(`Read clipboard to variable "${saveToVariable}": "${text}"`);
    return { success: true, content: text };
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// WAIT / SYNCHRONIZATION ACTIONS
// ===========================================

// Wait Until Clipboard Changes
ipcMain.handle('execute-wait-clipboard-change', async (event, { timeoutMs }) => {
  try {
    console.log(`Waiting for clipboard change (timeout: ${timeoutMs}ms)`);
    const startContent = clipboard.readText();
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      await delay(100);
      const currentContent = clipboard.readText();
      if (currentContent !== startContent) {
        console.log('Clipboard changed!');
        return { success: true, changed: true, content: currentContent };
      }
    }
    console.log('Clipboard change timeout');
    return { success: true, changed: false };
  } catch (error) {
    console.error('Failed to wait for clipboard change:', error);
    return { success: false, error: error.message };
  }
});

// Wait Until Pixel Color
ipcMain.handle('execute-wait-pixel-color', async (event, { x, y, colorHex, timeoutMs }) => {
  try {
    await loadNut();
    console.log(`Waiting for pixel color at (${x}, ${y}) to be ${colorHex} (timeout: ${timeoutMs}ms)`);
    const targetColor = hexToRgb(colorHex);
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const pixel = await nutScreen.pixel(x, y);
      if (colorsMatch(pixel, targetColor)) {
        console.log('Pixel color matched!');
        return { success: true, matched: true };
      }
      await delay(100);
    }
    console.log('Pixel color match timeout');
    
    return { success: true, matched: false };
  } catch (error) {
    console.error('Failed to wait for pixel color:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// SCREEN CAPTURE ACTIONS
// ===========================================

// Screenshot Region
ipcMain.handle('execute-screenshot-region', async (event, { x, y, width, height, savePath, screenshotMode }) => {
  try {
    await loadNut();
   console.log('dirname:'+__dirname);
   const dirname=__dirname;
    // Generate auto path if savePath is empty
    let finalPath = savePath && savePath.trim() !== ''
      ? savePath
      : path.join(dirname, `screenshot_${Date.now()}.png`);

    const fs = require('fs');
    const directory = path.dirname(finalPath);

    if (!fs.existsSync(directory)) {     fs.mkdirSync(directory, { recursive: true, mode: 0o777 });
 }

    if (screenshotMode === 'fullscreen') {
      // Full screen screenshot - pass path directly
      console.log('Taking full screen screenshot to:', finalPath);
      const image =await nutScreen.capture(finalPath);
    } else {
      // Region screenshot (default)
      console.log(`Taking screenshot region: (${x}, ${y}) ${width}x${height}`);
      const image = await nutScreen.captureRegion(x, y, width, height);
      await image.toFile(finalPath);
    }

    console.log(`Screenshot saved to: ${finalPath}`);

    // Copy screenshot to clipboard as image if savePath was not provided
    if (!savePath || savePath.trim() === '') {
       const { clipboard } = require('electron');
       clipboard.writeText(finalPath);
    }

    return { success: true, path: finalPath };
  } catch (error) {
    console.error('Failed to take screenshot:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// WINDOW MANAGEMENT
// ===========================================

ipcMain.handle('minimize-window', () => mainWindow.minimize());



ipcMain.handle('maximize-window', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('close-window', () => mainWindow.close());
// ===========================================
// CLIPBOARD IPC HANDLERS (for FIFO message processing)
// ===========================================

ipcMain.handle('set-clipboard-text', async (event, { text }) => {
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('clear-clipboard', async (event) => {
  clipboard.clear();
  return { success: true };
});

// Read clipboard text
ipcMain.handle('read-clipboard-text', async (event) => {
  try {
    const text = clipboard.readText();
    return { success: true, content: text };
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    return { success: false, error: error.message };
  }
});

// ===========================================
// COORDINATE RECORDING IPC HANDLERS
// ===========================================

ipcMain.handle('start-coordinate-recording', async (event) => {
  try {
    await loadNut();
    startCoordinateRecording();
    
    // Minimize window to let user click on screen
    if (mainWindow) {
      mainWindow.minimize();
    }
    
    return { success: true, message: 'Recording started. Click on screen to capture coordinates.' };
  } catch (error) {
    console.error('Failed to start coordinate recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-coordinate-recording', async (event) => {
  try {
    // Restore window
    if (mainWindow) {
      mainWindow.restore();
      mainWindow.focus();
    }
    
    const coordinates = stopCoordinateRecording();
    return { success: true, coordinates };
  } catch (error) {
    console.error('Failed to stop coordinate recording:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-recorded-coordinates', async (event) => {
  return { success: true, coordinates: recordedCoordinates };
});

ipcMain.handle('clear-recorded-coordinates', async (event) => {
  recordedCoordinates = [];
  return { success: true };
});

// ===========================================
// TELEGRAM BOT IPC HANDLERS
// ===========================================

ipcMain.handle('test-telegram-connection', async (event, { token, chatId }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!response.ok) return { success: false, error: 'Invalid bot token' };
    const botInfo = await response.json();
    if (botInfo.ok) {
      const chatResponse = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${chatId}`);
      if (!chatResponse.ok) return { success: false, error: 'Cannot access this chat' };
      return { success: true, botName: botInfo.result.first_name, username: botInfo.result.username };
    }
    return { success: false, error: 'Failed to get bot info' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-telegram-message', async (event, { token, chatId, message }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    const result = await response.json();
    if (result.ok) return { success: true, messageId: result.result.message_id };
    return { success: false, error: result.description };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-telegram-photo', async (event, { token, chatId, photoPath, caption }) => {
  try {
  console.log("Send photo to tele");
const fs = require("fs");
   if (!fs.existsSync(imagePath)) {
    throw new Error("Image file does not exist");
  }
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('photo', fs.createReadStream(photoPath));
    if (caption) formData.append('caption', caption);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formData });
    const result = await response.json();
    if (result.ok) return { success: true, messageId: result.result.message_id };
    return { success: false, error: result.description };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-telegram-updates', async (event, { token, chatId, offset = 0 }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offset, limit: 100, timeout: 30 })
    });
    const result = await response.json();
    if (result.ok) {
      const chatUpdates = result.result.filter(update => {
        if (!update.message) return false;
        if (chatId && update.message.chat.id.toString() !== chatId.toString()) return false;
        return true;
      });
      let latestOffset = offset;
      if (result.result.length > 0) latestOffset = Math.max(...result.result.map(u => u.update_id)) + 1;
      return { success: true, updates: chatUpdates.map(update => ({
        id: update.update_id, time: new Date(update.message.date * 1000),
        sender: update.message.from.first_name + (update.message.from.last_name ? ' ' + update.message.from.last_name : ''),
        username: update.message.from.username ? '@' + update.message.from.username : '',
        content: update.message.text || update.message.caption || '[Media Message]',
        type: getMessageType(update.message), chatId: update.message.chat.id
      })), offset: latestOffset };
    }
    return { success: false, error: result.description };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('reply-telegram-message', async (event, { token, chatId, messageId, text }) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_to_message_id: messageId, parse_mode: 'HTML' })
    });
    const result = await response.json();
    if (result.ok) return { success: true, messageId: result.result.message_id };
    return { success: false, error: result.description };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Action: Send Message To Telegram
ipcMain.handle('execute-send-message-to-tele', async (event, { token, chatId, customChatId, messageType, text, caption }) => {
  try {
    // Use customChatId if provided, otherwise use default chatId
    console.log("in this chat tele");
    const targetChatId = customChatId && customChatId.trim() !== '' ? customChatId : chatId;

    if (!token || !targetChatId) {

    console.log("here");
      return { success: false, error: 'Telegram bot not connected or chat ID not set' };
    }

    const { clipboard } = require('electron');
    const fs = require('fs');
    let result;

    if (messageType === 'photo') {
      // Read photo path from clipboard
      const photoPath = clipboard.readText();

      console.log("in this chatid:"+targetChatId);

      console.log("in this chat tele path:"+photoPath);

      if (!photoPath || photoPath.trim() === '') {
        return { success: false, error: 'Photo path is empty in clipboard' };
      }

      // Check if file exists
      if (!fs.existsSync(photoPath)) {
        console.log("Path not exist:"+photoPath);
        return { success: false, error: 'Photo file not found: ' + photoPath };
      }

      console.log(`Sending photo to Telegram: ${photoPath}`);

      // Read file as Buffer and convert to Blob
      const fileBuffer = fs.readFileSync(photoPath);
      const contentType = getMimeType(photoPath);
      const blob = new Blob([fileBuffer], { type: contentType });

      const formData = new FormData();
      formData.append('chat_id', targetChatId);
      formData.append('photo', blob, 'photo' + getFileExtension(photoPath));
      if (caption && caption.trim() !== '') {
        formData.append('caption', caption);
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      result = await response.json();
      if (result.ok) {
        console.log('Photo sent to Telegram successfully');
        // Delete the local image file after successful send
        try {
          fs.unlinkSync(photoPath);
          console.log('Image deleted successfully:', photoPath);
        } catch (deleteError) {
          console.error('Failed to delete image:', deleteError.message);
        }
        return { success: true, messageId: result.result.message_id };
      } else {
        console.log('Photo sent to Telegram failed:'+result.description);
        return { success: false, error: result.description };
      }

    } else {
      // Send text (default) - Read text from clipboard if not provided
      const message = text || clipboard.readText();

      if (!message || message.trim() === '') {
        return { success: false, error: 'Message content is empty' };
      }

      console.log(`Sending text to Telegram: ${message.substring(0, 50)}...`);

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetChatId, text: message, parse_mode: 'HTML' })
      });

      result = await response.json();
      if (result.ok) {
        console.log('Text sent to Telegram successfully');
        return { success: true, messageId: result.result.message_id };
      }
      return { success: false, error: result.description };
    }
  } catch (error) {
    console.error('Failed to send message to Telegram:', error);
    return { success: false, error: error.message };
  }
});

// Helper function to get MIME type from file path
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Helper function to get file extension
function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase() || '.jpg';
}

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

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function colorsMatch(pixel, target, tolerance = 10) {
  if (!pixel || !target) return false;
  return Math.abs(pixel.r - target.r) <= tolerance &&
         Math.abs(pixel.g - target.g) <= tolerance &&
         Math.abs(pixel.b - target.b) <= tolerance;
}
