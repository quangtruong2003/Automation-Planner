# Automation Planner

A modern Electron application for planning and recording automation actions including mouse clicks, mouse movements, and screenshots.

## Features

- 🎛️ **Automation Control** - Toggle automation on/off with a visual 3D emoji indicator
- 📋 **Action History** - View recorded actions in a clean table grid
- 📸 **Screenshot Support** - Capture and view screenshots for each action
- 📁 **Scenario Manager** - Create and manage multiple automation scenarios
- 🎬 **Single Scenario Execution** - Run one scenario at a time with visual progress tracking
- ⌨️ **Keyboard Shortcuts** - Quick access to features
- 🎨 **Modern UI** - Beautiful dark theme with smooth animations
- 📊 **Statistics** - Track actions, duration, and screenshots

## Scenario Management

Each scenario contains a sequence of automation actions that can be:
- **Mouse clicks** - Click at specific coordinates
- **Mouse movement** - Move cursor to positions
- **Key presses** - Press keyboard keys
- **Text input** - Type text automatically
- **Wait delays** - Pause between actions

### Running Scenarios

- Only **one scenario runs at a time**
- Click "Run" on any scenario in the Quick Run list
- Watch progress with animated banner on the Automation tab
- Use the Stop button or `Escape` key to cancel
- Settings include repeat count, action delay, and movement speed

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Toggle Automation / Save scenario |
| `Ctrl/Cmd + 1` | Switch to Automation tab |
| `Ctrl/Cmd + 2` | Switch to History tab |
| `Ctrl/Cmd + 3` | Switch to Scenarios tab |
| `Ctrl/Cmd + N` | Create new scenario |
| `Escape` | Stop running scenario / Close modal |

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Toggle Automation |
| `Ctrl/Cmd + 1` | Switch to Automation tab |
| `Ctrl/Cmd + 2` | Switch to History tab |
| `Escape` | Close modal |

## Installation

1. Install Node.js (version 18 or higher) from [nodejs.org](https://nodejs.org/)

2. Clone or navigate to the project folder:
   ```bash
   cd BotMbCCS
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Run the application:
   ```bash
   npm start
   ```

## Project Structure

```
BotMbCCS/
├── main.js           # Electron main process
├── preload.js        # IPC bridge between main and renderer
├── index.html        # Main HTML structure
├── styles.css        # Application styles
├── renderer.js       # Frontend JavaScript
├── package.json      # Project configuration
├── assets/           # Application assets
│   └── icon.png      # App icon (optional)
└── README.md         # This file
```

## Development

### Running in Development Mode

```bash
npm start
```

### Building for Production

```bash
npm run build
```

## Technologies Used

- **Electron** - Desktop application framework
- **HTML5/CSS3** - Modern UI with CSS variables and animations
- **JavaScript (ES6+)** - Frontend logic

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 18+
- 4GB RAM minimum
- 100MB disk space

## License

MIT License

