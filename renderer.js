// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const automationToggle = document.getElementById('automationToggle');
const statusText = document.getElementById('statusText');
const statusDescription = document.getElementById('statusDescription');
const statusIcon = document.getElementById('statusIcon');
const emoji3d = document.querySelector('.emoji-3d');
const actionCount = document.getElementById('actionCount');
const durationEl = document.getElementById('duration');
const screenshotCountEl = document.getElementById('screenshotCount');
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');
const screenshotModal = document.getElementById('screenshotModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const toast = document.getElementById('toast');

// State
let isAutomationRunning = false;
let automationStartTime = null;
let durationInterval = null;
let actions = [];
let screenshots = [];
let currentPage = 1;
const itemsPerPage = 10;

// Scenario Running State
let runningScenarioId = null;
let scenarioExecutionInterval = null;
let currentActionIndex = 0;
let scenarioRepeatCount = 0;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  updateStats();
  initializeTelegramSettings();
  initializeIncomingMessages();
  initializeScenarios(); // Initialize scenarios after DOM is ready

  // Set up coordinate recording listeners
  setupCoordinateRecordingListeners();
});

// Coordinate Recording Event Listeners
function setupCoordinateRecordingListeners() {
  if (window.electronAPI && window.electronAPI.onCoordinateCaptured) {
    window.electronAPI.onCoordinateCaptured((coordinates) => {
      console.log('Coordinates captured:', coordinates);
    });
  }

  if (window.electronAPI && window.electronAPI.onCoordinateCountUpdate) {
    window.electronAPI.onCoordinateCountUpdate((count) => {
      console.log('Coordinate count:', count);
      // Update the status element if recording
      if (addActionModalState.isRecordingCoordinates) {
        const statusEl = document.getElementById(`param_x_status`);
        if (statusEl) {
          const countEl = statusEl.querySelector('.coord-count');
          if (countEl) countEl.textContent = `${count} position${count !== 1 ? 's' : ''} captured`;
        }
      }
    });
  }

  // Listen for captured coordinates when recording stops
  if (window.electronAPI && window.electronAPI.onCoordinateCaptured) {
    window.electronAPI.onCoordinateCaptured((coordinates) => {
      console.log('Coordinates captured:', coordinates);
      addActionModalState.recordedCoordinates = coordinates || [];
    });
  }

  // Listen for recording stopped by keyboard (Enter key)
  if (window.electronAPI && window.electronAPI.onCoordinateRecordingStopped) {
    window.electronAPI.onCoordinateRecordingStopped((data) => {
      console.log('Recording stopped by keyboard, coordinates:', data);
      addActionModalState.isRecordingCoordinates = false;
      addActionModalState.recordedCoordinates = data || [];

      // Update all recording buttons and their associated displays
      document.querySelectorAll('.record-coordinate-btn').forEach(btn => {
        const btnIcon = btn.querySelector('.record-icon');
        const btnText = btn.querySelector('.record-text');
        const mode = btn.dataset.mode || 'single';
        const isMulti = mode === 'multi';
        const paramKey = btn.dataset.param;

        // Reset button to not recording state
        if (btnIcon) btnIcon.textContent = '🔴';
        if (btnText) btnText.textContent = isMulti ? 'Start Recording' : 'Record';
        btn.dataset.recording = 'false';

        // Update the coordinates display
        if (paramKey && addActionModalState.recordedCoordinates.length > 0) {
          const listEl = document.getElementById(`param_${paramKey}_list`);
          const input = document.getElementById(`param_${paramKey}`);
          const clearBtn = document.querySelector(`.clear-coordinates-btn[data-param="${paramKey}"]`);

          if (isMulti && listEl) {
            // Display all recorded coordinates
            listEl.innerHTML = `<div class="coordinates-items">${addActionModalState.recordedCoordinates.map((c, i) => `<div class="coordinate-item"><span class="coord-index">${i + 1}.</span> <span class="coord-value">X: ${c.x}, Y: ${c.y}</span></div>`).join('')}</div>`;
            listEl.style.display = 'block';
            if (clearBtn) clearBtn.style.display = 'inline-flex';

            // Store as JSON string
            addActionModalState.parameters[paramKey] = JSON.stringify(addActionModalState.recordedCoordinates);
            if (input) input.value = JSON.stringify(addActionModalState.recordedCoordinates);
          } else if (!isMulti && input) {
            // Single coordinate - use the last one
            const lastCoord = addActionModalState.recordedCoordinates[addActionModalState.recordedCoordinates.length - 1];
            input.value = JSON.stringify(lastCoord);
            addActionModalState.parameters[paramKey] = JSON.stringify(lastCoord);
          }
        }
      });

      // Hide all recording status indicators
      document.querySelectorAll('.recording-status').forEach(status => {
        status.style.display = 'none';
      });

      // Update coordinate count display
      const statusEl = document.getElementById(`param_x_status`);
      if (statusEl) {
        const countEl = statusEl.querySelector('.coord-count');
        if (countEl) {
          countEl.textContent = `${addActionModalState.recordedCoordinates.length} position${addActionModalState.recordedCoordinates.length !== 1 ? 's' : ''} captured`;
        }
      }

      // Validate and update preview
      validateAddActionForm();
      updateActionPreview();

      // Show success toast
      if (addActionModalState.recordedCoordinates.length > 0) {
        showToast(`Recorded ${addActionModalState.recordedCoordinates.length} position(s)`, 'success');
      }
    });
  }
}

// Event Listeners
function initializeEventListeners() {
  // Navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Automation Toggle
  automationToggle.addEventListener('click', toggleAutomation);

  // Window Controls
  minimizeBtn.addEventListener('click', () => window.electronAPI.minimizeWindow());
  maximizeBtn.addEventListener('click', () => window.electronAPI.maximizeWindow());
  closeBtn.addEventListener('click', () => window.electronAPI.closeWindow());

  // Modal
  closeModalBtn.addEventListener('click', closeScreenshotModal);
  screenshotModal.addEventListener('click', (e) => {
    if (e.target === screenshotModal) closeScreenshotModal();
  });

  // View Screenshot Buttons
  document.querySelectorAll('.view-screenshot-btn').forEach(btn => {
    btn.addEventListener('click', () => openScreenshotModal(btn.dataset.id));
  });

  // Row Action Buttons
  document.querySelectorAll('.row-action-btn.play').forEach(btn => {
    btn.addEventListener('click', () => playAction(btn.closest('tr')));
  });

  document.querySelectorAll('.row-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => editAction(btn.closest('tr')));
  });

  document.querySelectorAll('.row-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => deleteAction(btn.closest('tr')));
  });

  // History Actions
  document.getElementById('exportBtn').addEventListener('click', exportHistory);
  document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

  // Pagination
  document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
  document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));

  // Quick Run Scenario Buttons
  initializeQuickRunScenarioListeners();

  // Keyboard Shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ===========================================
// QUICK RUN SCENARIO FUNCTIONALITY
// ===========================================

// Initialize Quick Run Scenario event listeners
function initializeQuickRunScenarioListeners() {
  const quickScenarioList = document.getElementById('quickScenarioList');
  if (!quickScenarioList) return;

  // Event delegation for run buttons
  quickScenarioList.addEventListener('click', (e) => {
    const runBtn = e.target.closest('.qs-run-btn');
    if (runBtn) {
      e.stopPropagation();
      const scenarioItem = runBtn.closest('.quick-scenario-item');
      if (scenarioItem) {
        const scenarioId = parseInt(scenarioItem.dataset.id);
        runQuickScenario(scenarioId);
      }
    }
  });

  // Event delegation for scenario item selection
  quickScenarioList.addEventListener('click', (e) => {
    const scenarioItem = e.target.closest('.quick-scenario-item');
    if (scenarioItem && !e.target.closest('.qs-run-btn')) {
      const scenarioId = parseInt(scenarioItem.dataset.id);
      // Switch to scenarios tab and select the scenario
      switchTab('scenarios');
      selectScenario(scenarioId);
    }
  });
}

// Run Quick Scenario from Quick Run section
function runQuickScenario(scenarioId) {
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) {
    showToast('Scenario not found', 'error');
    return;
  }

  if (!scenario.actions || scenario.actions.length === 0) {
    showToast('This scenario has no actions', 'warning');
    return;
  }

  // If a scenario is already running, stop it first
  if (runningScenarioId !== null) {
    showToast('Stopping current scenario...', 'info');
    stopScenarioExecution();
  }

  // Select and run the scenario
  selectedScenarioId = scenarioId;
  showToast(`Running: ${scenario.name}`, 'info');

  // Switch to scenarios tab to show running banner
  switchTab('scenarios');

  // Start scenario execution
  startScenarioExecution(scenarioId);
}

// Tab Switching
function switchTab(tabName) {
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}-tab`);
  });
}

// Automation Toggle
function toggleAutomation() {
  if (isAutomationRunning) {
    stopAutomation();
  } else {
    startAutomation();
  }
}

async function startAutomation() {
  try {
    const result = await window.electronAPI.startAutomation();
    if (result.success) {
      isAutomationRunning = true;
      automationStartTime = Date.now();

      // Update UI
      automationToggle.classList.add('stop');
      automationToggle.querySelector('.btn-icon').textContent = '⏹️';
      automationToggle.querySelector('.btn-text').textContent = 'Stop Automation';

      emoji3d.classList.add('active');
      emoji3d.textContent = '🔴';
      statusText.textContent = 'Automation is ON';
      statusDescription.textContent = 'Recording your actions...';

      // Start Duration Timer
      durationInterval = setInterval(updateDuration, 1000);

      showToast('Automation started', 'success');
    }
  } catch (error) {
    console.error('Failed to start automation:', error);
    showToast('Failed to start automation', 'error');
  }
}

async function stopAutomation() {
  try {
    const result = await window.electronAPI.stopAutomation();
    if (result.success) {
      isAutomationRunning = false;

      // Stop any running scenarios
      if (runningScenarioId) {
        stopScenarioExecution();

        // Clear telegram clipboard if processing
        if (currentTelegramMessage) {
          window.electronAPI.clearClipboard();
          currentTelegramMessage = null;
        }

        // Clear telegram message queue
        if (telegramMessageQueue.length > 0) {
          telegramMessageQueue = [];
          isProcessingTelegramQueue = false;
          showToast('Telegram message queue cleared', 'info');
        }
      }

      // Update UI
      automationToggle.classList.remove('stop');
      automationToggle.querySelector('.btn-icon').textContent = '▶️';
      automationToggle.querySelector('.btn-text').textContent = 'Start Automation';

      emoji3d.classList.remove('active');
      emoji3d.textContent = '🟢';
      statusText.textContent = 'Automation is OFF';
      statusDescription.textContent = 'Click the button below to start recording actions';

      // Stop Duration Timer
      if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
      }

      showToast('Automation stopped', 'info');
    }
  } catch (error) {
    console.error('Failed to stop automation:', error);
    showToast('Failed to stop automation', 'error');
  }
}

// Duration Timer
function updateDuration() {
  if (!automationStartTime) return;

  const elapsed = Date.now() - automationStartTime;
  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);
  durationEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Stats Update
function updateStats() {
  actionCount.textContent = actions.length;
  screenshotCountEl.textContent = screenshots.length;
}

// Modal Functions
function openScreenshotModal(id) {
  document.getElementById('modalScreenshotId').textContent = `#${id}`;
  screenshotModal.classList.add('active');
}

function closeScreenshotModal() {
  screenshotModal.classList.remove('active');
}

// Row Actions
function playAction(row) {
  const id = row.querySelector('.td-id').textContent;
  const serialId = row.querySelector('.td-serial').textContent;
  showToast(`Playing action ${serialId}`, 'info');
  // TODO: Implement play action logic
}

function editAction(row) {
  const id = row.querySelector('.td-id').textContent;
  const serialId = row.querySelector('.td-serial').textContent;
  showToast(`Editing action ${serialId}`, 'info');
  // TODO: Implement edit action logic
}

function deleteAction(row) {
  const serialId = row.querySelector('.td-serial').textContent;
  if (confirm(`Are you sure you want to delete action ${serialId}?`)) {
    row.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      row.remove();
      showToast(`Action ${serialId} deleted`, 'success');
      updateStats();
    }, 300);
  }
}

// History Actions
function exportHistory() {
  showToast('Exporting history...', 'info');
  // TODO: Implement export logic
  setTimeout(() => {
    showToast('History exported successfully', 'success');
  }, 1500);
}

function clearHistory() {
  if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No history records found
        </td>
      </tr>
    `;
    actions = [];
    screenshots = [];
    updateStats();
    showToast('History cleared', 'success');
  }
}

// Pagination
function changePage(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= 3) { // Assuming max 3 pages for demo
    currentPage = newPage;
    document.getElementById('currentPage').textContent = currentPage;
    showToast(`Navigating to page ${currentPage}`, 'info');
  }
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
  // Ctrl/Cmd + S to start/stop automation
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    toggleAutomation();
  }

  // Escape to close modal
  if (e.key === 'Escape' && screenshotModal.classList.contains('active')) {
    closeScreenshotModal();
  }

  // Ctrl/Cmd + 1 to switch to Automation tab
  if ((e.ctrlKey || e.metaKey) && e.key === '1') {
    e.preventDefault();
    switchTab('automation');
  }

  // Ctrl/Cmd + 2 to switch to History tab
  if ((e.ctrlKey || e.metaKey) && e.key === '2') {
    e.preventDefault();
    switchTab('history');
  }
}

// Toast Notification
function showToast(message, type = 'info') {
  const toastIcon = toast.querySelector('.toast-icon');
  const toastMessage = toast.querySelector('.toast-message');

  // Set icon based on type
  const icons = {
    success: '',
    error: '',
    info: ''
  };
  toastIcon.textContent = icons[type] || icons.info;

  // Set message
  toastMessage.textContent = message;

  // Set type class
  toast.className = 'toast active ' + type;

  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// ===========================================
// SCENARIOS FUNCTIONALITY
// ===========================================

// Scenarios State
let scenarios = [
  {
    id: 1,
    icon: '🎮',
    name: 'Login Flow',
    description: 'Automated login flow for web application testing. Includes username input, password entry, and submit action.',
    repeatCount: 1,
    actionDelay: 500,
    movementSpeed: 'normal',
    loopOptions: false,
    triggerByTelegram: false,
    actions: [
      { id: 1, type: 'mouseClick', name: 'Click Username Field', parameters: { x: 120, y: 450, button: 'left', clickCount: 1 } },
      { id: 2, type: 'typeText', name: 'Type Username', parameters: { text: 'testuser@example.com', delayPerCharMs: 50 } },
      { id: 3, type: 'keyPress', name: 'Tab to Password', parameters: { key: 'Tab' } },
      { id: 4, type: 'typeText', name: 'Type Password', parameters: { text: '********', delayPerCharMs: 50 } },
      { id: 5, type: 'mouseClick', name: 'Click Login Button', parameters: { x: 850, y: 520, button: 'left', clickCount: 1 } }
    ],
    updatedAt: '2h ago'
  },
  {
    id: 2,
    icon: '🛒',
    name: 'Checkout Process',
    description: 'Complete e-commerce checkout flow with cart review and payment.',
    repeatCount: 1,
    actionDelay: 300,
    movementSpeed: 'human',
    loopOptions: false,
    triggerByTelegram: false,
    actions: [
      { id: 1, type: 'mouseClick', name: 'Click Cart Icon', parameters: { x: 200, y: 150, button: 'left', clickCount: 1 } },
      { id: 2, type: 'mouseClick', name: 'Click Checkout', parameters: { x: 600, y: 400, button: 'left', clickCount: 1 } },
      { id: 3, type: 'typeText', name: 'Type Shipping', parameters: { text: '123 Main St', delayPerCharMs: 30 } },
      { id: 4, type: 'mouseClick', name: 'Continue Payment', parameters: { x: 700, y: 500, button: 'left', clickCount: 1 } }
    ],
    updatedAt: '1d ago'
  },
  {
    id: 3,
    icon: '📝',
    name: 'Form Filling',
    description: 'Generic form filling automation for data entry tasks.',
    repeatCount: 1,
    actionDelay: 200,
    movementSpeed: 'fast',
    loopOptions: false,
    triggerByTelegram: false,
    actions: [
      { id: 1, type: 'mouseClick', name: 'Click First Field', parameters: { x: 100, y: 100, button: 'left', clickCount: 1 } },
      { id: 2, type: 'typeText', name: 'Type Form Data', parameters: { text: 'Sample data entry', delayPerCharMs: 20 } }
    ],
    updatedAt: '3d ago'
  }
];

let selectedScenarioId = 1;
let scenarioCounter = 4;
let selectedIcon = '';

// Initialize Scenarios
// ===========================================
// SCENARIO PERSISTENCE FUNCTIONS
// ===========================================

// Save scenarios to localStorage
function saveScenarios() {
  try {
    localStorage.setItem('scenarios', JSON.stringify(scenarios));
    localStorage.setItem('scenarioCounter', scenarioCounter.toString());
    console.log('Scenarios saved to localStorage');
  } catch (error) {
    console.error('Failed to save scenarios:', error);
  }
}

// Load scenarios from localStorage
function loadScenarios() {
  try {
    const savedScenarios = localStorage.getItem('scenarios');
    const savedCounter = localStorage.getItem('scenarioCounter');

    if (savedScenarios) {
      scenarios = JSON.parse(savedScenarios);
      console.log('Scenarios loaded from localStorage:', scenarios.length, 'scenarios');
    }

    if (savedCounter) {
      scenarioCounter = parseInt(savedCounter, 10);
    }
  } catch (error) {
    console.error('Failed to load scenarios:', error);
  }
}

// Render Quick Scenario List (in Automation tab)
function renderQuickScenarioList() {
  const quickScenarioList = document.getElementById('quickScenarioList');
  if (!quickScenarioList) return;

  quickScenarioList.innerHTML = scenarios.map(scenario => `
    <div class="quick-scenario-item" data-id="${scenario.id}">
      <span class="qs-icon">${scenario.icon || '📁'}</span>
      <span class="qs-name">${scenario.name}</span>
      <span class="qs-actions">${scenario.actions.length} actions</span>
      <button class="qs-run-btn">▶️ Run</button>
    </div>
  `).join('');
}

// ===========================================
// SCENARIO INITIALIZATION
// ===========================================

// ===========================================
// SCENARIO INITIALIZATION
// ===========================================

// Create default scenarios if none exist
function createDefaultScenarios() {
  const defaultScenarios = [
    {
      id: 1,
      icon: '🎮',
      name: 'Login Flow',
      description: 'Automated login flow for web application testing. Includes username input, password entry, and submit action.',
      repeatCount: 1,
      actionDelay: 500,
      movementSpeed: 'normal',
      loopOptions: false,
      triggerByTelegram: false,
      actions: [
        { id: 1, type: 'mouseClick', name: 'Click Username Field', parameters: { x: 120, y: 450, button: 'left', clickCount: 1 } },
        { id: 2, type: 'typeText', name: 'Type Username', parameters: { text: 'testuser@example.com', delayPerCharMs: 50 } },
        { id: 3, type: 'keyPress', name: 'Tab to Password', parameters: { key: 'Tab' } },
        { id: 4, type: 'typeText', name: 'Type Password', parameters: { text: '********', delayPerCharMs: 50 } },
        { id: 5, type: 'mouseClick', name: 'Click Login Button', parameters: { x: 850, y: 520, button: 'left', clickCount: 1 } }
      ],
      updatedAt: 'Just now'
    },
    {
      id: 2,
      icon: '🛒',
      name: 'Checkout Process',
      description: 'Complete e-commerce checkout flow with cart review and payment.',
      repeatCount: 1,
      actionDelay: 300,
      movementSpeed: 'human',
      loopOptions: false,
      triggerByTelegram: false,
      actions: [
        { id: 1, type: 'mouseClick', name: 'Click Cart Icon', parameters: { x: 200, y: 150, button: 'left', clickCount: 1 } },
        { id: 2, type: 'mouseClick', name: 'Click Checkout', parameters: { x: 600, y: 400, button: 'left', clickCount: 1 } },
        { id: 3, type: 'typeText', name: 'Type Shipping', parameters: { text: '123 Main St', delayPerCharMs: 30 } },
        { id: 4, type: 'mouseClick', name: 'Continue Payment', parameters: { x: 700, y: 500, button: 'left', clickCount: 1 } }
      ],
      updatedAt: 'Just now'
    },
    {
      id: 3,
      icon: '📝',
      name: 'Form Filling',
      description: 'Generic form filling automation for data entry tasks.',
      repeatCount: 1,
      actionDelay: 200,
      movementSpeed: 'fast',
      loopOptions: false,
      triggerByTelegram: false,
      actions: [
        { id: 1, type: 'mouseClick', name: 'Click First Field', parameters: { x: 100, y: 100, button: 'left', clickCount: 1 } },
        { id: 2, type: 'typeText', name: 'Type Form Data', parameters: { text: 'Sample data entry', delayPerCharMs: 20 } }
      ],
      updatedAt: 'Just now'
    }
  ];

  scenarios = defaultScenarios;
  scenarioCounter = 4;
  selectedScenarioId = 1;

  // Save to localStorage
  saveScenarios();

  // Render UI
  renderScenarioList();
  renderQuickScenarioList();
  selectScenario(1);

  console.log('Default scenarios created');
}

function initializeScenarios() {
  // Load scenarios from localStorage first
  loadScenarios();

  // Render quick scenario list in Automation tab
  renderQuickScenarioList();

  // Initialize Quick Run event listeners
  initializeQuickRunScenarioListeners();

  // Render scenario list in Scenarios tab
  renderScenarioList();

  // Select the first scenario or last selected
  if (scenarios.length > 0) {
    selectScenario(selectedScenarioId || scenarios[0].id);
  } else {
    // Create default scenarios if none exist
    createDefaultScenarios();
  }

  // Scenario list items
  document.querySelectorAll('.scenario-item').forEach(item => {
    item.addEventListener('click', () => selectScenario(parseInt(item.dataset.id)));
  });

  // Scenario Actions
  document.getElementById('newScenarioBtn').addEventListener('click', openNewScenarioModal);
  document.getElementById('closeNewScenarioModalBtn').addEventListener('click', closeNewScenarioModal);
  document.getElementById('newScenarioModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('newScenarioModal')) closeNewScenarioModal();
  });
  document.getElementById('confirmCreateScenarioBtn').addEventListener('click', confirmCreateScenario);
  document.getElementById('saveScenarioBtn').addEventListener('click', saveScenario);
  document.getElementById('duplicateScenarioBtn').addEventListener('click', duplicateScenario);
  document.getElementById('deleteScenarioBtn').addEventListener('click', deleteScenario);
  document.getElementById('runScenarioBtn').addEventListener('click', runScenario);
  document.getElementById('testRunScenarioBtn').addEventListener('click', testRunScenario);
  document.getElementById('stopScenarioBtn').addEventListener('click', stopScenario);
  document.getElementById('addActionBtn').addEventListener('click', addActionToScenario);

  // Icon picker
  document.querySelectorAll('.icon-option').forEach(option => {
    option.addEventListener('click', () => selectIcon(option));
  });

  // Scenario action buttons
  document.querySelectorAll('.scenario-action-item .row-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editScenarioAction(btn.closest('.scenario-action-item'));
    });
  });

  document.querySelectorAll('.scenario-action-item .row-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteScenarioAction(btn.closest('.scenario-action-item'));
    });
  });

  // Toggle switch event listeners for new options
  document.getElementById('loopOptions').addEventListener('change', handleLoopOptionsToggle);
  document.getElementById('triggerByTelegram').addEventListener('change', handleTriggerByTelegramToggle);

  // Setup stop running scenario button
  setupStopRunningScenarioButton();

  // Keyboard shortcuts for scenarios
  document.addEventListener('keydown', handleScenarioKeyboardShortcuts);
}

// Select Icon
function selectIcon(option) {
  document.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
  option.classList.add('selected');
  selectedIcon = option.dataset.icon;
}

// Open New Scenario Modal
function openNewScenarioModal() {
  document.getElementById('newScenarioName').value = '';
  document.getElementById('newScenarioDescription').value = '';
  selectedIcon = '';
  document.querySelectorAll('.icon-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.icon === '');
  });
  document.getElementById('newScenarioModal').classList.add('active');
}

// Close New Scenario Modal
function closeNewScenarioModal() {
  document.getElementById('newScenarioModal').classList.remove('active');
}

// Confirm Create Scenario
function confirmCreateScenario() {
  const name = document.getElementById('newScenarioName').value.trim();
  const description = document.getElementById('newScenarioDescription').value.trim();

  if (!name) {
    showToast('Please enter a scenario name', 'error');
    return;
  }

  const newId = scenarioCounter++;
  const newScenario = {
    id: newId,
    icon: selectedIcon,
    name: name,
    description: description,
    repeatCount: 1,
    actionDelay: 500,
    movementSpeed: 'normal',
    loopOptions: false,
    triggerByTelegram: false,
    actions: [],
    updatedAt: 'Just now'
  };

  scenarios.push(newScenario);

  // Save to localStorage
  saveScenarios();

  renderScenarioList();
  renderQuickScenarioList();
  selectScenario(newId);
  closeNewScenarioModal();
  showToast('Scenario created successfully', 'success');
}

// Select Scenario
function selectScenario(id) {
  selectedScenarioId = id;
  const scenario = scenarios.find(s => s.id === id);

  if (!scenario) return;

  // Update list selection
  document.querySelectorAll('.scenario-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.id) === id);
    
  });

  // Update details panel
  document.getElementById('selectedScenarioIcon').textContent = scenario.icon;
  document.getElementById('scenarioName').value = scenario.name;
  document.getElementById('selectedScenarioId').textContent = `SCN-${String(id).padStart(3, '0')}`;
  document.getElementById('scenarioDescription').value = scenario.description || '';
  document.getElementById('repeatCount').value = scenario.repeatCount;
  document.getElementById('actionDelay').value = scenario.actionDelay;
  document.getElementById('movementSpeed').value = scenario.movementSpeed;

  // Load new toggle options
  document.getElementById('loopOptions').checked = scenario.loopOptions || false;
  document.getElementById('triggerByTelegram').checked = scenario.triggerByTelegram || false;

  // Update disabled states based on telegram trigger setting
  const loopOptionsToggle = document.getElementById('loopOptions');
  const repeatCountInput = document.getElementById('repeatCount');

  if (scenario.triggerByTelegram) {
    // When telegram trigger is enabled, disable loopOptions and repeatCount
    loopOptionsToggle.checked = false;
    loopOptionsToggle.disabled = true;
    loopOptionsToggle.parentElement.classList.add('disabled');

    repeatCountInput.disabled = true;
    repeatCountInput.style.opacity = '0.5';
    repeatCountInput.style.cursor = 'not-allowed';
  } else {
    // When telegram trigger is disabled, enable loopOptions and repeatCount
    loopOptionsToggle.disabled = false;
    loopOptionsToggle.parentElement.classList.remove('disabled');

    repeatCountInput.disabled = false;
    repeatCountInput.style.opacity = '1';
    repeatCountInput.style.cursor = 'default';

    // Update repeat count input state based on loop options
    updateRepeatCountState();
  }

  // Render actions
  renderScenarioActions(scenario.actions);
}

// Render Scenario Actions
function renderScenarioActions(actions) {
  const container = document.getElementById('scenarioActionsList');

  if (!actions || actions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <span style="font-size: 48px; display: block; margin-bottom: 12px;">📋</span>
        <p>No actions yet. Click "Add Action" to create one.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = actions.map((action, index) => `
    <div class="scenario-action-item" data-action-id="${action.id}" draggable="true" data-index="${index}">
      <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
      <span class="action-order">${index + 1}</span>
      <span class="action-type">${getActionIcon(action.type)}</span>
      <span class="action-details">${action.name}</span>
      <div class="action-controls">
        <button class="row-action-btn edit" title="Edit">✏️</button>
        <button class="row-action-btn delete" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  // Re-attach event listeners
  setupActionItemEventListeners();
  setupDragAndDrop();
}

// Setup event listeners for action item buttons
function setupActionItemEventListeners() {
  document.querySelectorAll('.scenario-action-item .row-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editScenarioAction(btn.closest('.scenario-action-item'));
    });
  });

  document.querySelectorAll('.scenario-action-item .row-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteScenarioAction(btn.closest('.scenario-action-item'));
    });
  });
}

// Setup drag and drop for action items
function setupDragAndDrop() {
  const container = document.getElementById('scenarioActionsList');
  const items = container.querySelectorAll('.scenario-action-item');

  items.forEach(item => {
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragenter', handleDragEnter);
    item.addEventListener('dragleave', handleDragLeave);
  });
}

let draggedItem = null;
let draggedItemIndex = null;

function handleDragStart(e) {
  draggedItem = this;
  draggedItemIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.actionId);
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.stopPropagation();
  this.classList.remove('drag-over');

  const droppedItem = this;
  const droppedItemIndex = parseInt(this.dataset.index);

  if (draggedItem && draggedItemIndex !== droppedItemIndex && selectedScenarioId) {
    const scenario = scenarios.find(s => s.id === selectedScenarioId);
    if (scenario && scenario.actions) {
      // Remove dragged item from array
      const [movedAction] = scenario.actions.splice(draggedItemIndex, 1);
      // Insert at new position
      scenario.actions.splice(droppedItemIndex, 0, movedAction);

      // Re-render actions list
      renderScenarioActions(scenario.actions);
      saveScenarios();

      showToast('Action order updated', 'success');
    }
  }

  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  draggedItem = null;
  draggedItemIndex = null;

  // Remove drag-over class from all items
  document.querySelectorAll('.scenario-action-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

// Create New Scenario
function createNewScenario() {
  const newId = scenarioCounter++;
  const newScenario = {
    id: newId,
    icon: '📁',
    name: 'New Scenario',
    description: '',
    repeatCount: 1,
    actionDelay: 500,
    movementSpeed: 'normal',
    loopOptions: false,
    triggerByTelegram: false,
    actions: [],
    updatedAt: 'Just now'
  };

  scenarios.push(newScenario);
  renderScenarioList();
  selectScenario(newId);
  showToast('New scenario created', 'success');
}

// Save Scenario
function saveScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  scenario.name = document.getElementById('scenarioName').value;
  scenario.description = document.getElementById('scenarioDescription').value;
  scenario.repeatCount = parseInt(document.getElementById('repeatCount').value);
  scenario.actionDelay = parseInt(document.getElementById('actionDelay').value);
  scenario.movementSpeed = document.getElementById('movementSpeed').value;

  // Handle loopOptions and triggerByTelegram relationship
  const triggerByTelegram = document.getElementById('triggerByTelegram').checked;
  scenario.triggerByTelegram = triggerByTelegram;

  // When triggerByTelegram is enabled, loopOptions must be false
  if (triggerByTelegram) {
    scenario.loopOptions = false;
  } else {
    scenario.loopOptions = document.getElementById('loopOptions').checked;
  }

  scenario.updatedAt = 'Just now';

  // Save to localStorage
  saveScenarios();

  renderScenarioList();
  renderQuickScenarioList();
  showToast('Scenario saved successfully', 'success');
}

// Duplicate Scenario
function duplicateScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const newId = scenarioCounter++;
  const newScenario = {
    ...scenario,
    id: newId,
    name: `${scenario.name} (Copy)`,
    actions: scenario.actions.map(a => ({ ...a })),
    updatedAt: 'Just now'
  };

  scenarios.push(newScenario);

  // Save to localStorage
  saveScenarios();

  renderScenarioList();
  renderQuickScenarioList();
  selectScenario(newId);
  showToast('Scenario duplicated', 'success');
}

// Delete Scenario
function deleteScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  if (scenarios.length <= 1) {
    showToast('Cannot delete the last scenario', 'error');
    return;
  }

  if (confirm(`Are you sure you want to delete "${scenario.name}"?`)) {
    scenarios = scenarios.filter(s => s.id !== selectedScenarioId);
    selectedScenarioId = scenarios[0].id;

    // Save to localStorage
    saveScenarios();

    renderScenarioList();
    renderQuickScenarioList();
    selectScenario(selectedScenarioId);
    showToast('Scenario deleted', 'success');
  }
}

// Render Scenario List
function renderScenarioList() {
  const container = document.getElementById('scenarioList');
  container.innerHTML = scenarios.map(scenario => `
    <div class="scenario-item ${scenario.id === selectedScenarioId ? 'active' : ''}" data-id="${scenario.id}">
      <span class="scenario-icon">${scenario.icon || '📁'}</span>
      <div class="scenario-info">
        <span class="scenario-name">${scenario.name}</span>
        <span class="scenario-meta">${scenario.actions.length} actions • Updated ${scenario.updatedAt}</span>
      </div>
    </div>
  `).join('');

  // Re-attach click listeners
  document.querySelectorAll('.scenario-item').forEach(item => {
    item.addEventListener('click', () => selectScenario(parseInt(item.dataset.id)));
  });
}

// ===========================================
// SCENARIO EXECUTION FUNCTIONS
// ===========================================

// Start Scenario Execution
function startScenarioExecution(scenarioId, triggeredByTelegram = false) {
  const scenario = scenarios.find(s => s.id === scenarioId);
  if (!scenario) return;

  // Check if automation is running
  if (!isAutomationRunning) {
    showToast('⚠️ Please turn ON Automation first in the main tab', 'warning');
    return;
  }

  // Check if scenario has actions
  if (!scenario.actions || scenario.actions.length === 0) {
    showToast('This scenario has no actions', 'warning');
    return;
  }

  // Check if another scenario is already running
  if (runningScenarioId && runningScenarioId !== scenarioId) {
    showToast('Another scenario is already running. Please stop it first.', 'warning');
    return;
  }

  // Set running state
  runningScenarioId = scenarioId;
  currentActionIndex = 0;
  loopIterationCount = 0;

  // Auto minimize window when starting scenario
  window.electronAPI.minimizeWindow();

  // Set repeat count (default to 1 if not set or invalid)
  totalRepeatCount = Math.max(1, parseInt(scenario.repeatCount) || 1);
  currentRepeatCount = 1;

  // Update UI to show running state
  const runBtn = document.getElementById('runScenarioBtn');
  const testBtn = document.getElementById('testRunScenarioBtn');
  const stopBtn = document.getElementById('stopScenarioBtn');

  if (runBtn) runBtn.style.display = 'none';
  if (testBtn) testBtn.style.display = 'none';
  if (stopBtn) stopBtn.style.display = 'flex';

  // Show running scenario banner in Automation tab
  showRunningScenarioBanner(scenario);

  // Update Quick Run list to show running state
  updateQuickScenarioListState(scenarioId);

  // For telegram-triggered scenarios: wait for message if not triggered by telegram yet
  if (scenario.triggerByTelegram && !triggeredByTelegram) {
    // Set waiting for message state
    scenario.isWaitingForMessage = true;
    showToast(`📨 "${scenario.name}" is waiting for Telegram message...`, 'info');

    // Don't execute actions yet - wait for message
    return;
  }

  // Clear waiting state if triggered by telegram
  if (scenario.triggerByTelegram && triggeredByTelegram) {
    scenario.isWaitingForMessage = false;
  }

  showToast(`Started: ${scenario.name}`, 'success');

  // Start executing actions
  executeNextAction();
}

// Execute Next Action in the scenario
async function executeNextAction() {
  const scenario = scenarios.find(s => s.id === runningScenarioId);
  if (!scenario) return;

  // Check if all actions have been executed
  if (currentActionIndex >= scenario.actions.length) {
    // Check if we should loop or repeat
    if (scenario.loopOptions) {
      // Infinite loop mode
      loopIterationCount++;

      // Update progress to show completion
      updateScenarioProgress(scenario.actions.length, scenario.actions.length);

      if (loopIterationCount === 1) {
        showToast(`${scenario.name} - First loop completed. Continuing...`, 'info');
      } else {
        showToast(`${scenario.name} - Loop #${loopIterationCount} completed. Continuing...`, 'info');
      }

      // Delay 1 second before next loop iteration
      await delay(1000);

      // Restart from beginning
      currentActionIndex = 0;

      // Start next iteration
      executeNextAction();
    } else if (currentRepeatCount < totalRepeatCount) {
      // Repeat mode: run scenario multiple times
      currentRepeatCount++;

      // Update progress to show completion of this repeat
      updateScenarioProgress(scenario.actions.length, scenario.actions.length);

      const remainingRepeats = totalRepeatCount - currentRepeatCount + 1;
      showToast(`${scenario.name} - Repeat ${currentRepeatCount - 1}/${totalRepeatCount - 1} completed. ${remainingRepeats} more to go...`, 'info');

      // Delay between repeats (using actionDelay or default 1 second)
      const repeatDelay = scenario.actionDelay || 1000;
      await delay(repeatDelay);

      // Restart from beginning for next repeat
      currentActionIndex = 0;

      // Start next repeat
      executeNextAction();
    } else {
      // All repeats completed
      completeScenarioExecution();
    }
    return;
  }

  const action = scenario.actions[currentActionIndex];

  // Update progress
  updateScenarioProgress(currentActionIndex, scenario.actions.length);

  // Execute action based on type
  try {
    await executeAction(action);
    currentActionIndex++;

    // Delay between actions
    setTimeout(executeNextAction, scenario.actionDelay || 500);
  } catch (error) {
    console.error('Action execution error:', error);
    showToast(`Error in action: ${action.name}`, 'error');
    stopScenarioExecution();
  }
}

// Execute a single action using nut.js
async function executeAction(action) {
  switch (action.type) {
    // ===========================================
    // CONTROL FLOW ACTIONS
    // ===========================================
    case 'delay':
      // Duration in milliseconds
      await window.electronAPI.executeDelay({
        durationMs: parseInt(action.parameters.durationMs) || 1000
      });
      break;

    case 'if':
      // Conditional execution (placeholder - would need variable system)
      const ifResult = await window.electronAPI.executeIf({
        condition: action.parameters.condition
      });
      console.log('If condition result:', ifResult);
      break;

    case 'loop':
      // Loop handling is done in executeNextAction
      await window.electronAPI.executeLoop({
        count: parseInt(action.parameters.count) || 1,
        condition: action.parameters.condition
      });
      break;

    // ===========================================
    // APPLICATION / WINDOW ACTIONS
    // ===========================================
    case 'launchApp':
      await window.electronAPI.executeLaunchApp({
        executablePath: action.parameters.executablePath,
        arguments: action.parameters.arguments
      });
      break;

    case 'activateWindow':
      await window.electronAPI.executeActivateWindow({
        titleContains: action.parameters.titleContains,
        processName: action.parameters.processName
      });
      break;

    // ===========================================
    // MOUSE ACTIONS
    // ===========================================
    case 'mouseMove':
      // Handle both old format (x, y) and new format (coordinates JSON)
      let moveCoords;
      if (action.parameters.coordinates) {
        const coords = typeof action.parameters.coordinates === 'string'
          ? JSON.parse(action.parameters.coordinates)
          : action.parameters.coordinates;
        moveCoords = Array.isArray(coords) ? coords : [coords];
      } else {
        moveCoords = [{ x: parseInt(action.parameters.x) || 0, y: parseInt(action.parameters.y) || 0 }];
      }

      // Execute move for each recorded position
      for (const coord of moveCoords) {
        await window.electronAPI.executeMouseMove({
          x: parseInt(coord.x) || 0,
          y: parseInt(coord.y) || 0,
          speed: action.parameters.speed
        });
        // Small delay between moves
        await delay(100);
      }

      // Delay after completing all moves
      if (action.parameters.delayAfterMs) {
        await delay(parseInt(action.parameters.delayAfterMs) || 0);
      }
      break;

    case 'mouseClick':
      // Handle both old format (x, y) and new format (coordinates JSON)
      let clickCoords;
      if (action.parameters.coordinates) {
        const coords = typeof action.parameters.coordinates === 'string'
          ? JSON.parse(action.parameters.coordinates)
          : action.parameters.coordinates;
        clickCoords = Array.isArray(coords) ? coords : [coords];
      } else {
        clickCoords = [{ x: parseInt(action.parameters.x) || 0, y: parseInt(action.parameters.y) || 0 }];
      }

      // Get delay between different coordinates
      const delayBetweenCoordsMs = parseInt(action.parameters.delayBetweenCoordsMs) || 200;

      // Execute click at each recorded position
      for (let i = 0; i < clickCoords.length; i++) {
        const coord = clickCoords[i];
        await window.electronAPI.executeMouseClick({
          x: parseInt(coord.x) || 0,
          y: parseInt(coord.y) || 0,
          button: action.parameters.button || 'left',
          clickCount: action.parameters.clickCount || 1
        });

        // Add delay between different coordinates (not after the last one)
        if (i < clickCoords.length - 1 && delayBetweenCoordsMs > 0) {
          await delay(delayBetweenCoordsMs);
        }
      }

      // Delay after completing all clicks
      if (action.parameters.delayAfterMs) {
        await delay(parseInt(action.parameters.delayAfterMs) || 0);
      }
      break;

    // ===========================================
    // KEYBOARD ACTIONS
    // ===========================================
    case 'typeText':
      let textToType = action.parameters.text;

      // If text is empty/null/undefined, read from clipboard
      if (!textToType || textToType.trim() === '') {
        try {
          const clipboardResult = await window.electronAPI.readClipboard();
          const clipboardContent = clipboardResult && clipboardResult.content ? clipboardResult.content : '';

          if (clipboardContent && clipboardContent.trim() !== '') {
            textToType = clipboardContent;
            console.log('TypeText: Using text from clipboard');
          } else {
            showToast('Clipboard is empty, cannot type text', 'warning');
            break;
          }
        } catch (clipboardError) {
          console.error('Failed to read clipboard:', clipboardError);
          showToast('Failed to read clipboard', 'error');
          break;
        }
      }

      await window.electronAPI.executeTypeText({
        text: textToType,
        delayPerCharMs: parseInt(action.parameters.delayPerCharMs) || 0
      });
      break;

    case 'keyPress':
      await window.electronAPI.executeKeyPress({
        key: action.parameters.key
      });
      break;

    case 'hotkey':
      await window.electronAPI.executeHotkey({
        keys: action.parameters.keys
      });
      break;

    // ===========================================
    // CLIPBOARD ACTIONS
    // ===========================================
    case 'setClipboard':
      await window.electronAPI.executeSetClipboard({
        text: action.parameters.text
      });
      break;

    case 'readClipboard':
      const readResult = await window.electronAPI.executeReadClipboard({
        saveToVariable: action.parameters.saveToVariable
      });
      console.log('Read clipboard result:', readResult);
      break;

    // ===========================================
    // WAIT / SYNCHRONIZATION ACTIONS
    // ===========================================
    case 'waitUntilClipboardChanges':
      const clipboardResult = await window.electronAPI.executeWaitClipboardChange({
        timeoutMs: parseInt(action.parameters.timeoutMs) || 10000
      });
      console.log('Clipboard change result:', clipboardResult);
      break;

    case 'waitUntilPixelColor':
      // Handle both old format (x, y) and new format (coordinate JSON)
      let pixelCoord;
      if (action.parameters.coordinate) {
        pixelCoord = typeof action.parameters.coordinate === 'string'
          ? JSON.parse(action.parameters.coordinate)
          : action.parameters.coordinate;
      } else {
        pixelCoord = { x: parseInt(action.parameters.x) || 0, y: parseInt(action.parameters.y) || 0 };
      }

      const pixelResult = await window.electronAPI.executeWaitPixelColor({
        x: parseInt(pixelCoord.x) || 0,
        y: parseInt(pixelCoord.y) || 0,
        colorHex: action.parameters.colorHex,
        timeoutMs: parseInt(action.parameters.timeoutMs) || 5000
      });
      console.log('Pixel color result:', pixelResult);
      break;

    // ===========================================
    // SCREEN CAPTURE ACTIONS
    // ===========================================
    case 'screenshotRegion':
      // Handle both old format (x, y, width, height) and new format (region JSON)
      let region;
      if (action.parameters.region) {
        region = typeof action.parameters.region === 'string'
          ? JSON.parse(action.parameters.region)
          : action.parameters.region;
      } else {
        region = {
          x: parseInt(action.parameters.x) || 0,
          y: parseInt(action.parameters.y) || 0,
          width: parseInt(action.parameters.width) || 100,
          height: parseInt(action.parameters.height) || 100
        };
      }

      // Full screen screenshot
      await window.electronAPI.executeScreenshotRegion({
        screenshotMode: 'fullscreen',
        savePath: action.parameters.savePath
      });
      break;

    // ===========================================
    // TELEGRAM ACTIONS
    // ===========================================
    case 'sendMessageToTele':
      {
        const messageType = action.parameters.messageType || 'text';
        const caption = action.parameters.caption || '';

        await window.electronAPI.executeSendMessageToTele({
          token: telegramSettings.botToken,
          chatId: telegramSettings.chatId,
          customChatId: action.parameters.chatId,
          messageType,
          text: action.parameters.text,
          caption
        });
      }
      break;

    default:
      console.log('Unknown action type:', action.type);
  }
}

// ===========================================
// FIFO MESSAGE QUEUE PROCESSING (Telegram Trigger)
// ===========================================

// Add a message to the FIFO queue
function addToTelegramQueue(message) {
  telegramMessageQueue.push(message);
  showToast(`📥 Message queued (${telegramMessageQueue.length} pending)`, 'info');
}

// Process the next message from the FIFO queue
async function processNextTelegramMessage() {
  if (telegramMessageQueue.length === 0 || !runningScenarioId) {
    isProcessingTelegramQueue = false;
    currentTelegramMessage = null;
    return;
  }

  // Get the first message (FIFO)
  currentTelegramMessage = telegramMessageQueue.shift();

  if (!currentTelegramMessage) {
    return;
  }

  showToast(`📋 Processing: "${currentTelegramMessage.content.substring(0, 30)}..."`, 'info');

  // Copy message to clipboard
  await window.electronAPI.setClipboardText(currentTelegramMessage.content);

  // Clear clipboard after scenario completes (will be handled in completeScenarioExecution)
}

// Clear the clipboard after processing
async function clearTelegramClipboard() {
  try {
    await window.electronAPI.clearClipboard();
    console.log('Clipboard cleared after telegram message processing');
  } catch (error) {
    console.error('Failed to clear clipboard:', error);
  }
}

// Check if we should process telegram queue
function shouldProcessTelegramQueue() {
  if (!runningScenarioId) return false;

  const scenario = scenarios.find(s => s.id === runningScenarioId);
  return scenario && scenario.triggerByTelegram && isAutomationRunning;
}

// Handle telegram message in queue
async function handleTelegramMessageQueue() {
  if (!shouldProcessTelegramQueue()) return;

  if (!isProcessingTelegramQueue && telegramMessageQueue.length > 0) {
    isProcessingTelegramQueue = true;
    await processNextTelegramMessage();
  }
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

// Helper function to delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Complete Scenario Execution
function completeScenarioExecution() {
  const scenario = scenarios.find(s => s.id === runningScenarioId);
  if (!scenario) return;

  const isTelegramScenario = scenario.triggerByTelegram;

  // Clear clipboard if processing telegram message
  if (currentTelegramMessage) {
    clearTelegramClipboard();
    currentTelegramMessage = null;
  }

  // Reset execution state
  currentActionIndex = 0;
  loopIterationCount = 0;
  currentRepeatCount = 1;

  if (isTelegramScenario) {
    // For telegram-triggered scenarios:
    // 1. Complete execution
    // 2. Set isWaitingForMessage to true to wait for next message
    // 3. If queue has more messages, process the next one
    // 4. If queue is empty, wait for new incoming messages

    showToast(`${scenario.name} - Completed! Waiting for next message...`, 'success');

    // Reset running state but keep isWaitingForMessage = true
    runningScenarioId = null;

    // Reset isWaitingForMessage so the scenario can be triggered by new messages
    scenario.isWaitingForMessage = false;

    // DO NOT clear the message queue - let remaining messages be processed
    // Only reset processing flag
    isProcessingTelegramQueue = false;

    // If there are still messages in the queue, trigger the scenario again
    if (telegramMessageQueue.length > 0) {
      // Trigger the same scenario to process the next message
      setTimeout(async () => {
        await autoTriggerTelegramScenario(telegramMessageQueue[0]);
      }, 500);
    }

    // Reset UI - show run buttons again
    hideRunningScenarioBanner();
    updateQuickScenarioListState(null);

    const runBtn = document.getElementById('runScenarioBtn');
    const testBtn = document.getElementById('testRunScenarioBtn');
    const stopBtn = document.getElementById('stopScenarioBtn');

    if (runBtn) runBtn.style.display = 'flex';
    if (testBtn) testBtn.style.display = 'flex';
    if (stopBtn) stopBtn.style.display = 'none';

    return;
  }

  // For non-telegram scenarios
  runningScenarioId = null;
  showToast(`${scenario.name} - Completed!`, 'success');

  // Reset UI
  hideRunningScenarioBanner();
  updateQuickScenarioListState(null);

  // Show run buttons again
  const runBtn = document.getElementById('runScenarioBtn');
  const testBtn = document.getElementById('testRunScenarioBtn');
  const stopBtn = document.getElementById('stopScenarioBtn');

  if (runBtn) runBtn.style.display = 'flex';
  if (testBtn) testBtn.style.display = 'flex';
  if (stopBtn) stopBtn.style.display = 'none';
}

// Stop Scenario Execution
function stopScenarioExecution() {
  const scenario = scenarios.find(s => s.id === runningScenarioId);
  if (scenario) {
    // Reset waiting for message state
    scenario.isWaitingForMessage = false;

    showToast(`${scenario.name} - Stopped`, 'info');
  }

  // Reset UI
  hideRunningScenarioBanner();
  updateQuickScenarioListState(null);

  runningScenarioId = null;
  currentActionIndex = 0;

  // Clear telegram message queue if any
  if (telegramMessageQueue.length > 0) {
    telegramMessageQueue = [];
    isProcessingTelegramQueue = false;
  }

  // Show run buttons again
  const runBtn = document.getElementById('runScenarioBtn');
  const testBtn = document.getElementById('testRunScenarioBtn');
  const stopBtn = document.getElementById('stopScenarioBtn');

  if (runBtn) runBtn.style.display = 'flex';
  if (testBtn) testBtn.style.display = 'flex';
  if (stopBtn) stopBtn.style.display = 'none';
}

// Show Running Scenario Banner
function showRunningScenarioBanner(scenario) {
  const banner = document.getElementById('runningScenarioBanner');
  const nameEl = document.getElementById('runningScenarioName');
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('scenarioProgressFill');

  if (banner) {
    banner.style.display = 'flex';
  }

  if (nameEl) {
    if (scenario.isWaitingForMessage) {
      nameEl.innerHTML = `${scenario.icon} ${scenario.name} <span style="font-size: 12px; color: #a78bfa;">📨 WAITING FOR TELEGRAM...</span>`;
    } else if (scenario.loopOptions) {
      nameEl.innerHTML = `${scenario.icon} ${scenario.name} <span style="font-size: 12px; color: #fbbf24;">🔄 INFINITE LOOP</span>`;
    } else if (scenario.repeatCount > 1) {
      nameEl.innerHTML = `${scenario.icon} ${scenario.name} <span style="font-size: 12px; color: #60a5fa;">🔁 ${scenario.repeatCount}x REPEAT</span>`;
    } else {
      nameEl.textContent = `${scenario.icon} ${scenario.name}`;
    }
  }

  if (progressText) {
    if (scenario.isWaitingForMessage) {
      progressText.textContent = `Waiting for new Telegram message...`;
    } else {
      progressText.textContent = `0 / ${scenario.actions.length} actions`;
    }
  }

  if (progressFill) {
    progressFill.style.width = '0%';
  }
}

// Hide Running Scenario Banner
function hideRunningScenarioBanner() {
  const banner = document.getElementById('runningScenarioBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

// Update Scenario Progress
let loopIterationCount = 0;
let currentRepeatCount = 1;
let totalRepeatCount = 1;

function updateScenarioProgress(current, total) {
  const scenario = scenarios.find(s => s.id === runningScenarioId);
  const progressText = document.getElementById('progressText');
  const progressFill = document.getElementById('scenarioProgressFill');

  if (progressText) {
    if (scenario && scenario.loopOptions) {
      progressText.textContent = `🔄 Loop #${loopIterationCount + 1} - ${current + 1} / ${total} actions`;
    } else if (scenario && totalRepeatCount > 1) {
      progressText.textContent = `🔁 Repeat ${currentRepeatCount}/${totalRepeatCount} - ${current + 1} / ${total} actions`;
    } else {
      progressText.textContent = `${current + 1} / ${total} actions`;
    }
  }

  if (progressFill) {
    const percentage = ((current + 1) / total) * 100;
    progressFill.style.width = `${percentage}%`;
  }
}

// Update Quick Scenario List State
function updateQuickScenarioListState(runningId) {
  document.querySelectorAll('.quick-scenario-item').forEach(item => {
    const itemId = parseInt(item.dataset.id);
    const runBtn = item.querySelector('.qs-run-btn');

    if (itemId === runningId) {
      item.classList.add('running');
      if (runBtn) {
        runBtn.innerHTML = '⏹️ Stop';
        runBtn.disabled = false;
      }
    } else {
      item.classList.remove('running');
      if (runBtn) {
        runBtn.innerHTML = '▶️ Run';
        runBtn.disabled = runningId !== null; // Disable if another scenario is running
      }
    }
  });
}

// Stop Running Scenario Button Handler
function setupStopRunningScenarioButton() {
  const stopBtn = document.getElementById('stopRunningScenarioBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopScenarioExecution();
    });
  }
}

// ===========================================
// SCENARIO UI FUNCTIONS
// ===========================================

// Run Scenario
function runScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  if (scenario.actions.length === 0) {
    showToast('This scenario has no actions', 'warning');
    return;
  }

  // Start scenario execution
  startScenarioExecution(selectedScenarioId);
}

// Test Run Scenario
function testRunScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  showToast(`Quick test: ${scenario.name} (${scenario.actions.length} actions)`, 'info');
  // TODO: Implement quick test (faster execution, fewer screenshots)
}

// Stop Scenario
function stopScenario() {
  stopScenarioExecution();
}

// Add Action to Scenario
function addActionToScenario() {
  // Open the Add Action modal instead of adding a placeholder
  openAddActionModal();
}

// Edit Scenario Action
function editScenarioAction(actionItem) {
  const actionId = parseInt(actionItem.dataset.actionId);
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const action = scenario.actions.find(a => a.id === actionId);
  if (!action) return;

  // Open the add action modal in edit mode with pre-filled values
  openAddActionModal(action);
}

// Delete Scenario Action
function deleteScenarioAction(actionItem) {
  const actionId = parseInt(actionItem.dataset.actionId);
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const action = scenario.actions.find(a => a.id === actionId);
  if (!action) return;

  // Show action details in delete modal
  const deleteConfirmDetails = document.getElementById('deleteConfirmDetails');
  deleteConfirmDetails.innerHTML = `
    <div class="detail-row">
      <span class="detail-icon">${getActionIcon(action.type)}</span>
      <span class="detail-text">${action.name}</span>
    </div>
  `;

  // Show modal
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  deleteConfirmModal.classList.add('active');

  // Handle confirm
  const confirmBtn = document.getElementById('confirmDeleteBtn');
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener('click', () => {
    scenario.actions = scenario.actions.filter(a => a.id !== actionId);

    // Save to localStorage
    saveScenarios();

    renderScenarioActions(scenario.actions);
    renderScenarioList();
    renderQuickScenarioList();
    deleteConfirmModal.classList.remove('active');
    showToast('Action deleted', 'success');
  });

  // Handle cancel
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const newCancelBtn = cancelDeleteBtn.cloneNode(true);
  cancelDeleteBtn.parentNode.replaceChild(newCancelBtn, cancelDeleteBtn);

  newCancelBtn.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('active');
  });

  // Close on background click
  deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) {
      deleteConfirmModal.classList.remove('active');
    }
  });
}

// ===========================================
// ADD ACTION MODAL FUNCTIONALITY
// ===========================================

// Action Type Definitions
const ACTION_TYPES = {
  // Control Flow
  delay: {
    name: 'Delay',
    icon: '⏱️',
    description: 'Pause execution for a fixed duration',
    parameters: [
      { key: 'durationMs', label: 'Duration (milliseconds)', type: 'number', required: true, min: 0, default: 1000, help: 'Pause execution for this duration' }
    ]
  },
  if: {
    name: 'If Condition',
    icon: '🔀',
    description: 'Conditionally execute following actions',
    parameters: [
      { key: 'condition', label: 'Condition', type: 'textarea', required: true, placeholder: 'e.g., variable.name == "expected_value"', help: 'JavaScript expression that evaluates to true/false' }
    ]
  },
  loop: {
    name: 'Loop',
    icon: '🔄',
    description: 'Repeat actions',
    parameters: [
      { key: 'count', label: 'Repeat Count', type: 'number', required: false, min: 1, placeholder: 'Leave empty for infinite loop', help: 'Number of times to repeat' },
      { key: 'condition', label: 'Stop Condition', type: 'textarea', required: false, placeholder: 'e.g., counter >= 10', help: 'Optional: stop when this condition is true' }
    ]
  },
  // Application / Window
  launchApp: {
    name: 'Launch App',
    icon: '🚀',
    description: 'Launch a desktop application',
    parameters: [
      { key: 'executablePath', label: 'Executable Path', type: 'file', required: true, placeholder: 'C:\\Program Files\\App\\app.exe', accept: '.exe,.app,.bat,.sh', help: 'Path to the application executable' },
      { key: 'arguments', label: 'Arguments (Optional)', type: 'text', required: false, placeholder: '--arg1 value1 --arg2 value2', help: 'Optional command line arguments' }
    ]
  },
  activateWindow: {
    name: 'Activate Window',
    icon: '🪟',
    description: 'Bring an existing window to the foreground',
    parameters: [
      { key: 'titleContains', label: 'Window Title Contains', type: 'text', required: false, placeholder: 'e.g., Chrome - My Document', help: 'Part of the window title to match' },
      { key: 'processName', label: 'Process Name', type: 'text', required: false, placeholder: 'e.g., chrome.exe', help: 'Name of the process' }
    ],
    validate: (values) => {
      const errors = [];
      if (!values.titleContains && !values.processName) {
        errors.push('At least one of Window Title or Process Name is required');
      }
      return errors;
    }
  },
  // Mouse
  mouseMove: {
    name: 'Move Mouse',
    icon: '🎯',
    description: 'Move mouse cursor to screen coordinates',
    parameters: [
      { key: 'coordinates', label: 'Coordinates', type: 'coordinates', required: true, help: 'Click positions on screen', multi: true },
      { key: 'delayAfterMs', label: 'Delay After (ms)', type: 'number', required: false, min: 0, default: 0, help: 'Delay after moving mouse (milliseconds)' }
    ]
  },
  mouseClick: {
    name: 'Click Mouse',
    icon: '👆',
    description: 'Click mouse at screen coordinates',
    parameters: [
      { key: 'coordinates', label: 'Coordinates', type: 'coordinates', required: true, help: 'Click positions on screen', multi: true },
      { key: 'button', label: 'Mouse Button', type: 'select', required: true, options: [
        { value: 'left', label: 'Left Button' },
        { value: 'right', label: 'Right Button' },
        { value: 'middle', label: 'Middle Button' }
      ], default: 'left' },
      { key: 'clickCount', label: 'Click Count', type: 'number', required: true, min: 1, max: 10, default: 1, help: 'Number of times to click per coordinate' },
      { key: 'delayBetweenCoordsMs', label: 'Delay Between Coordinates (ms)', type: 'number', required: false, min: 0, default: 200, help: 'Delay between clicking different coordinates' },
      { key: 'delayAfterMs', label: 'Delay After (ms)', type: 'number', required: false, min: 0, default: 0, help: 'Delay after all clicks (milliseconds)' }
    ]
  },
  // Keyboard
  typeText: {
    name: 'Type Text',
    icon: '📝',
    description: 'Type text at current cursor location',
    parameters: [
      { key: 'text', label: 'Text to Type', type: 'textarea', required: false, placeholder: 'Leave empty to use clipboard content', help: 'Text to type. If empty, will use clipboard content.' },
      { key: 'delayPerCharMs', label: 'Delay per Character (ms)', type: 'number', required: false, min: 0, default: 0, help: 'Optional delay between each character' }
    ]
  },
  keyPress: {
    name: 'Press Key',
    icon: '🔘',
    description: 'Press a single keyboard key',
    parameters: [
      { key: 'key', label: 'Key', type: 'text', required: true, placeholder: 'Enter, Escape, a, 1, F5...', help: 'Key name (case-insensitive)' }
    ]
  },
  hotkey: {
    name: 'Hotkey',
    icon: '🎹',
    description: 'Press multiple keys together',
    parameters: [
      { key: 'keys', label: 'Keys Combination', type: 'text', required: true, placeholder: 'ctrl+c, alt+tab, shift+enter', help: 'Keys to press together, separated by "+"' }
    ]
  },
  // Clipboard
  setClipboard: {
    name: 'Set Clipboard',
    icon: '📥',
    description: 'Set clipboard text',
    parameters: [
      { key: 'text', label: 'Text Content', type: 'textarea', required: true, placeholder: 'Text to copy to clipboard', help: 'Text that will be copied to clipboard' }
    ]
  },
  readClipboard: {
    name: 'Read Clipboard',
    icon: '📤',
    description: 'Read clipboard and store it in a variable',
    parameters: [
      { key: 'saveToVariable', label: 'Variable Name', type: 'text', required: true, placeholder: 'clipboardContent', help: 'Name of variable to store clipboard content' }
    ]
  },
  // Wait / Synchronization
  waitUntilClipboardChanges: {
    name: 'Wait Clipboard Change',
    icon: '🔃',
    description: 'Wait until clipboard content changes',
    parameters: [
      { key: 'timeoutMs', label: 'Timeout (milliseconds)', type: 'number', required: true, min: 100, default: 10000, help: 'Maximum time to wait before timing out' }
    ]
  },
  waitUntilPixelColor: {
    name: 'Wait Pixel Color',
    icon: '🎨',
    description: 'Wait until a pixel matches a color',
    parameters: [
      { key: 'coordinate', label: 'Coordinate', type: 'coordinate', required: true, help: 'Click on the pixel to monitor' },
      { key: 'colorHex', label: 'Expected Color (Hex)', type: 'text', required: true, pattern: '^#[0-9A-Fa-f]{6}$', placeholder: '#FF5733', help: 'Hex color code (e.g., #FF5733)' },
      { key: 'timeoutMs', label: 'Timeout (milliseconds)', type: 'number', required: true, min: 100, default: 5000, help: 'Maximum time to wait' }
    ]
  },
  // Screen Capture
  screenshotRegion: {
    name: 'Screenshot',
    icon: '📷',
    description: 'Capture the screen',
    parameters: [
      { key: 'savePath', label: 'Save Path (Optional)', type: 'file', required: false, accept: '.png,.jpg,.jpeg', placeholder: 'Leave empty for auto-generated path', help: 'Path to save screenshot, or leave empty' }
    ]
  },
  // Telegram
  sendMessageToTele: {
    name: 'Send Message To Telegram',
    icon: '📨',
    description: 'Send text or photo to Telegram group',
    parameters: [
      { key: 'messageType', label: 'Message Type', type: 'select', required: true, options: [
        { value: 'text', label: '📝 Text' },
        { value: 'photo', label: '🖼️ Photo' }
      ], default: 'text', help: 'Choose whether to send text or photo' },
      { key: 'chatId', label: 'Chat ID (Optional)', type: 'text', required: false, placeholder: 'Leave empty to use default chatId', help: 'Telegram group chat ID. Uses default from Notify settings if empty.' },
      { key: 'text', label: 'Text Content', type: 'textarea', required: false, placeholder: 'Message to send', help: 'Text message to send to Telegram', showIf: { param: 'messageType', value: 'text' } },
      { key: 'caption', label: 'Caption (Optional)', type: 'text', required: false, placeholder: 'Add a caption to the photo', help: 'Optional caption for the photo', showIf: { param: 'messageType', value: 'photo' } }
    ]
  }
};

// Get action icon by type
function getActionIcon(type) {
  const actionType = ACTION_TYPES[type];
  return actionType ? actionType.icon : '❓';
}

// Get action name by type
function getActionName(type) {
  const actionType = ACTION_TYPES[type];
  return actionType ? actionType.name : type;
}

// Add Action Modal State
let addActionModalState = {
  selectedType: null,
  actionName: '',
  parameters: {},
  errors: [],
  editingActionId: null,  // Track if we're editing an existing action
  isRecordingCoordinates: false,
  recordedCoordinates: []
};

// Initialize Add Action Modal
function initializeAddActionModal() {
  const actionTypeSelect = document.getElementById('actionTypeSelect');
  const actionNameInput = document.getElementById('actionNameInput');
  const confirmAddActionBtn = document.getElementById('confirmAddActionBtn');
  const cancelAddActionBtn = document.getElementById('cancelAddActionBtn');
  const closeAddActionModalBtn = document.getElementById('closeAddActionModalBtn');
  const addActionModal = document.getElementById('addActionModal');

  // Action type change
  actionTypeSelect.addEventListener('change', (e) => {
    const selectedType = e.target.value;
    addActionModalState.selectedType = selectedType || null;
    addActionModalState.parameters = {};

    // Reset name
    actionNameInput.value = '';

    // Render parameter form
    renderActionParametersForm(selectedType);

    // Update preview
    updateActionPreview();

    // Validate
    validateAddActionForm();
  });

  // Action name input
  actionNameInput.addEventListener('input', (e) => {
    addActionModalState.actionName = e.target.value;
    updateActionPreview();
    validateAddActionForm();
  });

  // Confirm add action
  confirmAddActionBtn.addEventListener('click', confirmAddAction);

  // Cancel add action
  cancelAddActionBtn.addEventListener('click', closeAddActionModal);

  // Close modal button
  closeAddActionModalBtn.addEventListener('click', closeAddActionModal);

  // Close on background click
  addActionModal.addEventListener('click', (e) => {
    if (e.target === addActionModal) {
      closeAddActionModal();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleAddActionKeyboardShortcuts);
}

// Open Add Action Modal
function openAddActionModal(action = null) {
  // Reset state
  addActionModalState = {
    selectedType: null,
    actionName: '',
    parameters: {},
    errors: [],
    editingActionId: action ? action.id : null
  };

  // Reset form
  document.getElementById('actionTypeSelect').value = '';
  document.getElementById('actionNameInput').value = '';
  document.getElementById('actionParametersForm').innerHTML = '<p class="no-parameters-message">Select an action type to see available parameters.</p>';
  document.getElementById('actionPreviewCard').querySelector('.preview-icon').textContent = '❓';
  document.getElementById('previewType').textContent = 'No action selected';
  document.getElementById('previewName').textContent = '-';
  document.getElementById('previewParams').textContent = '-';
  document.getElementById('actionValidationErrors').classList.remove('visible');
  document.getElementById('confirmAddActionBtn').disabled = true;

  // Update modal title and button based on mode
  const modalTitle = document.querySelector('#addActionModal .modal-header h3');
  const confirmBtn = document.getElementById('confirmAddActionBtn');

  if (action) {
    // Edit mode
    modalTitle.textContent = 'Edit Action';
    confirmBtn.textContent = 'Save Changes';
    confirmBtn.disabled = false;

    // Pre-fill with existing action data
    if (action.type) {
      document.getElementById('actionTypeSelect').value = action.type;
      addActionModalState.selectedType = action.type;
      renderActionParametersForm(action.type);

      // Set parameters after form is rendered
      setTimeout(() => {
        if (action.parameters) {
          Object.keys(action.parameters).forEach(key => {
            const input = document.getElementById(`param_${key}`);
            if (input) {
              input.value = action.parameters[key];
              addActionModalState.parameters[key] = action.parameters[key];
            }
          });
        }
        updateActionPreview();
        validateAddActionForm();
      }, 50);
    }

    if (action.name) {
      document.getElementById('actionNameInput').value = action.name;
      addActionModalState.actionName = action.name;
    }
  } else {
    // Add mode
    modalTitle.textContent = 'Add New Action';
    confirmBtn.textContent = 'Add Action';
  }

  // Show modal
  document.getElementById('addActionModal').classList.add('active');

  // Focus on appropriate element
  if (action && action.type) {
    setTimeout(() => {
      document.getElementById('actionNameInput').focus();
    }, 100);
  } else {
    setTimeout(() => {
      document.getElementById('actionTypeSelect').focus();
    }, 100);
  }
}

// Close Add Action Modal
function closeAddActionModal() {
  document.getElementById('addActionModal').classList.remove('active');
}

// Update visibility of dependent parameters based on showIf conditions
function updateDependentParameterVisibility(parameters, changedParam = null, changedValue = null) {
  parameters.forEach(param => {
    if (param.showIf) {
      const { param: dependParam, value: dependValue } = param.showIf;
      const groupEl = document.querySelector(`.param-form-group[data-param="${param.key}"]`);
      if (groupEl) {
        // Get the current value of the dependent parameter
        const currentValue = changedParam === dependParam
          ? changedValue
          : addActionModalState.parameters[dependParam];
        const shouldShow = currentValue === dependValue;
        groupEl.setAttribute('data-show-if', shouldShow.toString());
        groupEl.style.display = shouldShow ? '' : 'none';
      }
    }
  });
}

// Render Action Parameters Form
function renderActionParametersForm(actionType) {
  const container = document.getElementById('actionParametersForm');

  if (!actionType) {
    container.innerHTML = '<p class="no-parameters-message">Select an action type to see available parameters.</p>';
    return;
  }

  const actionConfig = ACTION_TYPES[actionType];
  if (!actionConfig) {
    container.innerHTML = '<p class="no-parameters-message">Unknown action type.</p>';
    return;
  }

  let html = '';

  actionConfig.parameters.forEach(param => {
    const paramId = `param_${param.key}`;

    // Check if this parameter should be shown based on showIf condition
    let showIfCondition = '';
    let showIfDataAttr = '';
    let isVisible = true;

    if (param.showIf) {
      const { param: dependParam, value: dependValue } = param.showIf;
      showIfCondition = `data-show-if-param="${dependParam}" data-show-if-value="${dependValue}"`;
      showIfDataAttr = `data-show-if="true"`;
      // Set initial visibility based on current state
      const currentValue = addActionModalState.parameters[dependParam];
      isVisible = currentValue === dependValue || currentValue === undefined;
      if (!isVisible) {
        showIfDataAttr = `data-show-if="false"`;
      }
    }

    html += `<div class="param-form-group" data-param="${param.key}" ${showIfCondition} ${showIfDataAttr}>`;

    if (param.type === 'number') {
      html += `
        <label for="${paramId}">
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <input type="number" id="${paramId}"
               min="${param.min || ''}"
               max="${param.max || ''}"
               placeholder="${param.placeholder || ''}"
               value="${param.default || ''}">
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'text') {
      html += `
        <label for="${paramId}">
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <input type="text" id="${paramId}"
               placeholder="${param.placeholder || ''}"
               value="${param.default || ''}">
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'textarea') {
      html += `
        <label for="${paramId}">
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <textarea id="${paramId}"
                  rows="3"
                  placeholder="${param.placeholder || ''}">${param.default || ''}</textarea>
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'select') {
      html += `
        <label for="${paramId}">
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <select id="${paramId}">
          ${param.options.map(opt => `<option value="${opt.value}" ${opt.value === param.default ? 'selected' : ''}>${opt.label}</option>`).join('')}
        </select>
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'file') {
      html += `
        <label for="${paramId}">
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <input type="text" id="${paramId}"
               placeholder="${param.placeholder || ''}"
               value="${param.default || ''}">
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'coordinate') {
      // Single coordinate (X, Y) with recording button
      html += `
        <label>
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <div class="coordinate-input-row">
          <input type="number" id="${paramId}" readonly
                 placeholder="Click record to capture"
                 value="${param.default || ''}">
          <button type="button" class="record-coordinate-btn" data-param="${param.key}" data-mode="single">
            <span class="record-icon">🔴</span>
            <span class="record-text">Record</span>
          </button>
        </div>
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'coordinates') {
      // Multiple coordinates with recording button
      const isMulti = param.multi === true;
      html += `
        <label>
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <div class="coordinates-display" id="${paramId}_display">
          <div class="coordinates-list" id="${paramId}_list">
            <p class="no-coordinates">No coordinates recorded yet. Click "Start Recording" and click on screen.</p>
          </div>
          <div class="coordinates-input-row">
            <button type="button" class="record-coordinate-btn multi" data-param="${param.key}" data-mode="multi">
              <span class="record-icon">🔴</span>
              <span class="record-text">${isMulti ? 'Start Recording' : 'Record'}</span>
            </button>
            <button type="button" class="clear-coordinates-btn" data-param="${param.key}" style="display: none;">
              Clear All
            </button>
          </div>
          <div class="recording-status" id="${paramId}_status" style="display: none;">
            <span class="recording-indicator">⏺ Recording...</span>
            <span class="recording-hint">Click on screen to capture positions. Click "Stop" when done.</span>
          </div>
        </div>
        <input type="hidden" id="${paramId}" value="${param.default || ''}">
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    } else if (param.type === 'region') {
      // Region selection (X, Y, Width, Height) with recording button
      html += `
        <label>
          ${param.label}
          ${param.required ? '<span class="required-mark">*</span>' : ''}
        </label>
        <div class="region-display" id="${paramId}_display">
          <div class="region-preview" id="${paramId}_preview">
            <p class="no-region">No region selected. Click "Select Region" and drag on screen.</p>
          </div>
          <div class="region-inputs" id="${paramId}_inputs" style="display: none;">
            <div class="region-input-row">
              <div class="region-input-group">
                <label>X:</label>
                <input type="number" id="${paramId}_x" readonly>
              </div>
              <div class="region-input-group">
                <label>Y:</label>
                <input type="number" id="${paramId}_y" readonly>
              </div>
              <div class="region-input-group">
                <label>W:</label>
                <input type="number" id="${paramId}_width" readonly>
              </div>
              <div class="region-input-group">
                <label>H:</label>
                <input type="number" id="${paramId}_height" readonly>
              </div>
            </div>
          </div>
          <div class="region-input-row">
            <button type="button" class="record-region-btn" data-param="${param.key}">
              <span class="record-icon">🔴</span>
              <span class="record-text">Select Region</span>
            </button>
            <button type="button" class="clear-region-btn" data-param="${param.key}" style="display: none;">
              Clear
            </button>
          </div>
          <div class="recording-status" id="${paramId}_status" style="display: none;">
            <span class="recording-indicator">⏺ Select Region...</span>
            <span class="recording-hint">Click and drag on screen to select region.</span>
          </div>
        </div>
        <input type="hidden" id="${paramId}" value="">
        ${param.help ? `<span class="param-hint">${param.help}</span>` : ''}
        <span class="param-error"></span>
      `;
    }

    html += '</div>';
  });

  container.innerHTML = html;

  // Add event listeners to inputs
  actionConfig.parameters.forEach(param => {
    const input = document.getElementById(`param_${param.key}`);
    if (input) {
      input.addEventListener('input', () => {
        addActionModalState.parameters[param.key] = input.value;
        validateActionParam(param, input);
        updateActionPreview();
        validateAddActionForm();
      });

      // For select elements, also trigger visibility updates for dependent params
      if (param.type === 'select') {
        input.addEventListener('change', () => {
          addActionModalState.parameters[param.key] = input.value;
          updateDependentParameterVisibility(actionConfig.parameters, param.key, input.value);
        });
      }
    }
  });

  // Update visibility of dependent parameters based on current selections
  updateDependentParameterVisibility(actionConfig.parameters);

  // Add event listeners for coordinate recording buttons
  document.querySelectorAll('.record-coordinate-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const paramKey = btn.dataset.param;
      const mode = btn.dataset.mode || 'single';
      await handleCoordinateRecording(paramKey, mode, btn);
    });
  });

  document.querySelectorAll('.clear-coordinates-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const paramKey = btn.dataset.param;
      clearRecordedCoordinates(paramKey);
    });
  });

  document.querySelectorAll('.record-region-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const paramKey = btn.dataset.param;
      await handleRegionRecording(paramKey, btn);
    });
  });

  document.querySelectorAll('.clear-region-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const paramKey = btn.dataset.param;
      clearRecordedRegion(paramKey);
    });
  });

  // Store validation function for later use
  addActionModalState.validateFn = actionConfig.validate;
}

// Validate a single action parameter
function validateActionParam(param, input) {
  const errorEl = input.parentElement.querySelector('.param-error');
  const value = input.value.trim();
  let error = null;

  // Check required
  if (param.required && !value) {
    error = 'This field is required';
  }
  // Check number constraints
  else if (param.type === 'number') {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      error = 'Must be a valid number';
    } else if (param.min !== undefined && numValue < param.min) {
      error = `Must be at least ${param.min}`;
    } else if (param.max !== undefined && numValue > param.max) {
      error = `Must not exceed ${param.max}`;
    }
  }
  // Check pattern
  else if (param.pattern && value && !new RegExp(param.pattern).test(value)) {
    if (param.pattern === '^#[0-9A-Fa-f]{6}$') {
      error = 'Must be valid hex color (e.g., #FF5733)';
    }
  }

  // Update error display
  if (error && errorEl) {
    errorEl.textContent = error;
    errorEl.classList.add('visible');
    input.style.borderColor = 'var(--danger-color)';
  } else {
    if (errorEl) {
      errorEl.classList.remove('visible');
    }
    input.style.borderColor = '';
  }

  return error === null;
}

// ===========================================
// COORDINATE RECORDING FUNCTIONS
// ===========================================

async function handleCoordinateRecording(paramKey, mode, button) {
  const btnIcon = button.querySelector('.record-icon');
  const btnText = button.querySelector('.record-text');
  const statusEl = document.getElementById(`param_${paramKey}_status`);
  const listEl = document.getElementById(`param_${paramKey}_list`);
  const clearBtn = document.querySelector(`.clear-coordinates-btn[data-param="${paramKey}"]`);
  const input = document.getElementById(`param_${paramKey}`);

  if (!addActionModalState.isRecordingCoordinates) {
    // Start recording
    addActionModalState.isRecordingCoordinates = true;
    addActionModalState.recordedCoordinates = [];

    // Update button appearance
    btnIcon.textContent = '⏹️';
    btnText.textContent = 'Stop Recording';

    // Show status
    if (statusEl) statusEl.style.display = 'flex';

    // Start coordinate recording in main process
    try {
      await window.electronAPI.startCoordinateRecording();
    } catch (error) {
      console.error('Failed to start coordinate recording:', error);
      showToast('Failed to start recording', 'error');
      // Reset state
      addActionModalState.isRecordingCoordinates = false;
      btnIcon.textContent = '🔴';
      btnText.textContent = mode === 'multi' ? 'Start Recording' : 'Record';
      if (statusEl) statusEl.style.display = 'none';
      return;
    }

    showToast('Recording started! Click on screen to capture positions.', 'info');
  } else {
    // Stop recording
    addActionModalState.isRecordingCoordinates = false;

    try {
      const result = await window.electronAPI.stopCoordinateRecording();

      // Update button appearance
      btnIcon.textContent = '🔴';
      btnText.textContent = mode === 'multi' ? 'Start Recording' : 'Record';
      if (statusEl) statusEl.style.display = 'none';

      if (result.success && result.coordinates && result.coordinates.length > 0) {
        addActionModalState.recordedCoordinates = result.coordinates;

        // Update UI based on mode
        if (mode === 'multi') {
          // Display all recorded coordinates
          const coordsText = result.coordinates.map(c => `(${c.x}, ${c.y})`).join(' | ');
          listEl.innerHTML = `<div class="coordinates-items">${result.coordinates.map((c, i) => `<div class="coordinate-item"><span class="coord-index">${i + 1}.</span> <span class="coord-value">X: ${c.x}, Y: ${c.y}</span></div>`).join('')}</div>`;
          listEl.style.display = 'block';
          if (clearBtn) clearBtn.style.display = 'inline-flex';

          // Store as JSON string
          addActionModalState.parameters[paramKey] = JSON.stringify(result.coordinates);
          input.value = JSON.stringify(result.coordinates);
        } else {
          // Single coordinate - use the last one
          const lastCoord = result.coordinates[result.coordinates.length - 1];
          input.value = JSON.stringify(lastCoord);
          addActionModalState.parameters[paramKey] = JSON.stringify(lastCoord);
        }

        validateAddActionForm();
        updateActionPreview();

        if (mode === 'multi') {
          showToast(`Recorded ${result.coordinates.length} position(s)`, 'success');
        } else {
          showToast(`Position captured: (${lastCoord.x}, ${lastCoord.y})`, 'success');
        }
      } else {
        listEl.innerHTML = '<p class="no-coordinates">No positions recorded. Try again.</p>';
        showToast('No positions captured', 'warning');
      }
    } catch (error) {
      console.error('Failed to stop coordinate recording:', error);
      showToast('Failed to stop recording', 'error');
    }
  }
}

function clearRecordedCoordinates(paramKey) {
  const listEl = document.getElementById(`param_${paramKey}_list`);
  const clearBtn = document.querySelector(`.clear-coordinates-btn[data-param="${paramKey}"]`);
  const input = document.getElementById(`param_${paramKey}`);

  addActionModalState.recordedCoordinates = [];
  addActionModalState.parameters[paramKey] = '';

  if (listEl) {
    listEl.innerHTML = '<p class="no-coordinates">No coordinates recorded yet. Click "Start Recording" and click on screen.</p>';
  }
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';

  validateAddActionForm();
  updateActionPreview();
}

async function handleRegionRecording(paramKey, button) {
  const btnIcon = button.querySelector('.record-icon');
  const btnText = button.querySelector('.record-text');
  const statusEl = document.getElementById(`param_${paramKey}_status`);
  const inputsEl = document.getElementById(`${paramKey}_inputs`);
  const previewEl = document.getElementById(`${paramKey}_preview`);
  const clearBtn = document.querySelector(`.clear-region-btn[data-param="${paramKey}"]`);
  const inputX = document.getElementById(`${paramKey}_x`);
  const inputY = document.getElementById(`${paramKey}_y`);
  const inputW = document.getElementById(`${paramKey}_width`);
  const inputH = document.getElementById(`${paramKey}_height`);
  const input = document.getElementById(paramKey);

  if (!addActionModalState.isRecordingCoordinates) {
    // Start region recording
    addActionModalState.isRecordingCoordinates = true;

    // Update button appearance
    btnIcon.textContent = '⏹️';
    btnText.textContent = 'Cancel';

    // Show status
    if (statusEl) statusEl.style.display = 'flex';
    if (previewEl) previewEl.style.display = 'none';

    // Start coordinate recording (will use single click for first corner, then second click)
    try {
      await window.electronAPI.startCoordinateRecording();
    } catch (error) {
      console.error('Failed to start region recording:', error);
      showToast('Failed to start region selection', 'error');
      addActionModalState.isRecordingCoordinates = false;
      btnIcon.textContent = '🔴';
      btnText.textContent = 'Select Region';
      if (statusEl) statusEl.style.display = 'none';
      if (previewEl) previewEl.style.display = 'block';
      return;
    }

    showToast('Click on screen to define region: first corner, then opposite corner.', 'info');

    // We'll use the same coordinate recording but expect 2 clicks
    // The main process will handle this
  } else {
    // Stop recording
    addActionModalState.isRecordingCoordinates = false;

    try {
      const result = await window.electronAPI.stopCoordinateRecording();

      // Update button appearance
      btnIcon.textContent = '🔴';
      btnText.textContent = 'Select Region';
      if (statusEl) statusEl.style.display = 'none';

      if (result.success && result.coordinates && result.coordinates.length >= 2) {
        // Calculate region from two points
        const coords = result.coordinates;
        const x1 = coords[0].x;
        const y1 = coords[0].y;
        const x2 = coords[coords.length - 1].x;
        const y2 = coords[coords.length - 1].y;

        const regionX = Math.min(x1, x2);
        const regionY = Math.min(y1, y2);
        const regionWidth = Math.abs(x2 - x1);
        const regionHeight = Math.abs(y2 - y1);

        const regionData = {
          x: regionX,
          y: regionY,
          width: regionWidth,
          height: regionHeight
        };

        // Update UI
        if (inputX) inputX.value = regionX;
        if (inputY) inputY.value = regionY;
        if (inputW) inputW.value = regionWidth;
        if (inputH) inputH.value = regionHeight;
        if (inputsEl) inputsEl.style.display = 'flex';
        if (previewEl) {
          previewEl.innerHTML = `<p class="region-selected">Region: X:${regionX}, Y:${regionY}, W:${regionWidth}, H:${regionHeight}</p>`;
          previewEl.style.display = 'block';
        }
        if (clearBtn) clearBtn.style.display = 'inline-flex';

        // Store as JSON
        addActionModalState.parameters[paramKey] = JSON.stringify(regionData);
        input.value = JSON.stringify(regionData);

        validateAddActionForm();
        updateActionPreview();

        showToast(`Region selected: ${regionWidth}x${regionHeight} at (${regionX}, ${regionY})`, 'success');
      } else if (result.success && result.coordinates && result.coordinates.length === 1) {
        // Only one click - show single point
        const coord = result.coordinates[0];
        if (inputX) inputX.value = coord.x;
        if (inputY) inputY.value = coord.y;
        if (inputW) inputW.value = 100;
        if (inputH) inputH.value = 100;
        if (inputsEl) inputsEl.style.display = 'flex';
        if (previewEl) {
          previewEl.innerHTML = `<p class="region-selected">Point: (${coord.x}, ${coord.y}) - Default 100x100 region</p>`;
          previewEl.style.display = 'block';
        }
        if (clearBtn) clearBtn.style.display = 'inline-flex';

        const regionData = { x: coord.x, y: coord.y, width: 100, height: 100 };
        addActionModalState.parameters[paramKey] = JSON.stringify(regionData);
        input.value = JSON.stringify(regionData);

        validateAddActionForm();
        updateActionPreview();
      } else {
        if (previewEl) {
          previewEl.innerHTML = '<p class="no-region">No region selected. Click "Select Region" and drag on screen.</p>';
          previewEl.style.display = 'block';
        }
        showToast('No region captured. Please select two points.', 'warning');
      }
    } catch (error) {
      console.error('Failed to stop region recording:', error);
      showToast('Failed to capture region', 'error');
    }
  }
}

function clearRecordedRegion(paramKey) {
  const inputsEl = document.getElementById(`${paramKey}_inputs`);
  const previewEl = document.getElementById(`${paramKey}_preview`);
  const clearBtn = document.querySelector(`.clear-region-btn[data-param="${paramKey}"]`);
  const inputX = document.getElementById(`${paramKey}_x`);
  const inputY = document.getElementById(`${paramKey}_y`);
  const inputW = document.getElementById(`${paramKey}_width`);
  const inputH = document.getElementById(`${paramKey}_height`);
  const input = document.getElementById(paramKey);

  addActionModalState.parameters[paramKey] = '';

  if (inputX) inputX.value = '';
  if (inputY) inputY.value = '';
  if (inputW) inputW.value = '';
  if (inputH) inputH.value = '';
  if (inputsEl) inputsEl.style.display = 'none';
  if (previewEl) {
    previewEl.innerHTML = '<p class="no-region">No region selected. Click "Select Region" and drag on screen.</p>';
    previewEl.style.display = 'block';
  }
  if (clearBtn) clearBtn.style.display = 'none';
  if (input) input.value = '';

  validateAddActionForm();
  updateActionPreview();
}

// Update Action Preview
function updateActionPreview() {
  const previewIcon = document.getElementById('previewIcon');
  const previewType = document.getElementById('previewType');
  const previewName = document.getElementById('previewName');
  const previewParams = document.getElementById('previewParams');

  const { selectedType, actionName, parameters } = addActionModalState;

  if (!selectedType) {
    previewIcon.textContent = '❓';
    previewType.textContent = 'No action selected';
    previewName.textContent = '-';
    previewParams.textContent = '-';
    return;
  }

  const actionConfig = ACTION_TYPES[selectedType];
  previewIcon.textContent = actionConfig.icon;
  previewType.textContent = actionConfig.name;
  previewName.textContent = actionName || 'Unnamed Action';

  // Generate parameters summary
  const paramSummary = Object.entries(parameters)
    .filter(([key, value]) => value && value.trim())
    .map(([key, value]) => {
      // Format key name
      const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      // Truncate long values
      const formattedValue = value.length > 30 ? value.substring(0, 30) + '...' : value;
      return `${formattedKey}: ${formattedValue}`;
    })
    .join(' | ');

  previewParams.textContent = paramSummary || 'No parameters set';
}

// Validate Add Action Form
function validateAddActionForm() {
  const { selectedType, actionName, parameters } = addActionModalState;
  const errors = [];

  // Check action type
  if (!selectedType) {
    errors.push('Please select an action type');
  }

  // Check action name
  if (!actionName.trim()) {
    errors.push('Please enter an action name');
  } else if (actionName.length > 100) {
    errors.push('Action name must be 100 characters or less');
  }

  // Check required parameters
  if (selectedType) {
    const actionConfig = ACTION_TYPES[selectedType];
    if (actionConfig) {
      actionConfig.parameters.forEach(param => {
        if (param.required) {
          const value = parameters[param.key];
          if (!value || !value.trim()) {
            errors.push(`${param.label} is required`);
          }
        }
      });
    }
  }

  // Custom validation
  if (addActionModalState.validateFn) {
    const customErrors = addActionModalState.validateFn(parameters);
    if (customErrors && customErrors.length > 0) {
      errors.push(...customErrors);
    }
  }

  // Display errors
  const errorContainer = document.getElementById('actionValidationErrors');
  if (errors.length > 0) {
    errorContainer.innerHTML = `<ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    errorContainer.classList.add('visible');
  } else {
    errorContainer.classList.remove('visible');
  }

  // Update button state
  const confirmBtn = document.getElementById('confirmAddActionBtn');
  confirmBtn.disabled = errors.length > 0;

  addActionModalState.errors = errors;

  return errors.length === 0;
}

// Confirm Add/Edit Action
function confirmAddAction() {
  if (!validateAddActionForm()) {
    return;
  }

  const { selectedType, actionName, parameters, editingActionId } = addActionModalState;

  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  if (editingActionId) {
    // Edit existing action
    const actionIndex = scenario.actions.findIndex(a => a.id === editingActionId);
    if (actionIndex !== -1) {
      scenario.actions[actionIndex] = {
        ...scenario.actions[actionIndex],
        type: selectedType,
        name: actionName.trim(),
        parameters: { ...parameters }
      };

      // Save to localStorage
      saveScenarios();

      renderScenarioActions(scenario.actions);
      renderScenarioList();
      renderQuickScenarioList();
      closeAddActionModal();
      showToast('Action updated successfully', 'success');
    }
  } else {
    // Create new action object
    const newAction = {
      id: Date.now(),
      type: selectedType,
      name: actionName.trim(),
      parameters: { ...parameters }
    };

    // Add to current scenario
    scenario.actions.push(newAction);

    // Save to localStorage
    saveScenarios();

    renderScenarioActions(scenario.actions);
    renderScenarioList();
    renderQuickScenarioList();
    closeAddActionModal();
    showToast('Action added successfully', 'success');
  }
}

// Handle keyboard shortcuts for Add Action modal
function handleAddActionKeyboardShortcuts(e) {
  const addActionModal = document.getElementById('addActionModal');

  if (!addActionModal.classList.contains('active')) {
    return;
  }

  // Escape to close modal
  if (e.key === 'Escape') {
    e.preventDefault();
    closeAddActionModal();
  }

  // Ctrl/Cmd + Enter to confirm
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const confirmBtn = document.getElementById('confirmAddActionBtn');
    if (!confirmBtn.disabled) {
      confirmAddAction();
    }
  }
}

// Update Add Action handler in initializeScenarios
const originalInitializeScenarios = initializeScenarios;
initializeScenarios = function() {
  originalInitializeScenarios();
  initializeAddActionModal();
};

// Override addActionToScenario to open modal
const originalAddActionToScenario = addActionToScenario;
addActionToScenario = function() {
  openAddActionModal();
};

// Update Repeat Count Input State based on Loop Options
function updateRepeatCountState() {
  const loopOptionsEnabled = document.getElementById('loopOptions').checked;
  const repeatCountInput = document.getElementById('repeatCount');

  if (loopOptionsEnabled) {
    repeatCountInput.disabled = true;
    repeatCountInput.style.opacity = '0.5';
    repeatCountInput.style.cursor = 'not-allowed';
  } else {
    repeatCountInput.disabled = false;
    repeatCountInput.style.opacity = '1';
    repeatCountInput.style.cursor = 'default';
  }
}

// Handle Loop Options Toggle
function handleLoopOptionsToggle(e) {
  const loopOptionsEnabled = e.target.checked;

  // Update repeat count state
  updateRepeatCountState();

  // Show toast notification
  if (loopOptionsEnabled) {
    showToast('Loop options enabled - Repeat Count will be frozen', 'info');
  } else {
    showToast('Loop options disabled', 'info');
  }
}

// Handle Trigger By Telegram Toggle
function handleTriggerByTelegramToggle(e) {
  const triggerEnabled = e.target.checked;
  const loopOptionsToggle = document.getElementById('loopOptions');
  const repeatCountInput = document.getElementById('repeatCount');

  if (triggerEnabled) {
    // When Trigger By Telegram is enabled:
    // - Loop Options must be disabled and set to false
    // - Repeat Count must be disabled
    loopOptionsToggle.checked = false;
    loopOptionsToggle.disabled = true;
    loopOptionsToggle.parentElement.classList.add('disabled');

    repeatCountInput.disabled = true;
    repeatCountInput.style.opacity = '0.5';
    repeatCountInput.style.cursor = 'not-allowed';

    showToast('Trigger By Telegram enabled - Loop and Repeat disabled', 'info');
  } else {
    // When Trigger By Telegram is disabled:
    // - Re-enable Loop Options
    // - Re-enable Repeat Count
    loopOptionsToggle.disabled = false;
    loopOptionsToggle.parentElement.classList.remove('disabled');

    repeatCountInput.disabled = false;
    repeatCountInput.style.opacity = '1';
    repeatCountInput.style.cursor = 'default';

    showToast('Trigger By Telegram disabled', 'info');
  }
}

// Keyboard Shortcuts for Scenarios
function handleScenarioKeyboardShortcuts(e) {
  // Ctrl/Cmd + 3 to switch to Scenarios tab
  if ((e.ctrlKey || e.metaKey) && e.key === '3') {
    e.preventDefault();
    switchTab('scenarios');
  }

  // Ctrl/Cmd + N to create new scenario
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    if (document.getElementById('scenarios-tab').classList.contains('active')) {
      openNewScenarioModal();
    }
  }

  // Ctrl/Cmd + S to save scenario
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (document.getElementById('scenarios-tab').classList.contains('active')) {
      saveScenario();
    }
  }
}

// Update initializeEventListeners to include scenarios
const originalInitializeEventListeners = initializeEventListeners;
initializeEventListeners = function() {
  originalInitializeEventListeners();
  initializeScenarios();
};

// Add CSS animation for fadeOut
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(-20px); }
  }
`;
document.head.appendChild(style);

// ===========================================
// TELEGRAM NOTIFY FUNCTIONALITY
// ===========================================

// Telegram State
let telegramSettings = {
  botToken: '',
  chatId: '',
  botName: 'My Automation Bot',
  connected: false,
  notifications: {
    automationStart: true,
    automationStop: true,
    scenarioComplete: true,
    scenarioError: true,
    includeScreenshots: false,
    hourlySummary: false
  }
};

// Initialize Telegram Settings
function initializeTelegramSettings() {
  // Load saved settings from localStorage
  const savedSettings = localStorage.getItem('telegramSettings');
  if (savedSettings) {
    try {
      const parsed = JSON.parse(savedSettings);
      telegramSettings = { ...telegramSettings, ...parsed };
      populateTelegramForm();
    } catch (e) {
      console.error('Failed to parse saved telegram settings:', e);
    }
  }

  // Update status card
  updateTelegramStatusCard();

  // Initialize form event listeners
  initializeTelegramEventListeners();

  // Update test message preview
  updateTestMessagePreview();

  // Auto-connect if credentials are saved
  setTimeout(() => {
    autoConnectTelegram();
  }, 500);
}

// Auto-connect to Telegram bot on startup
async function autoConnectTelegram() {
  const token = telegramSettings.botToken?.trim();
  const chatId = telegramSettings.chatId?.trim();

  // Check if credentials exist
  if (!token || !chatId) {
    console.log('No saved Telegram credentials found');
    return;
  }

  console.log('Auto-connecting to Telegram bot...');

  try {
    const result = await window.electronAPI.testTelegramConnection({ token, chatId });

    if (result.success) {
      console.log('Auto-connection successful!');
      telegramSettings.connected = true;
      updateTelegramStatusCard();
      showToast('Telegram Bot reconnected automatically', 'success');

      // Add a notification to the list
      addNotificationToList({
        title: 'Auto-connected to Telegram Bot',
        icon: '',
        status: 'success'
      });
    } else {
      console.log('Auto-connection failed:', result.error);
      telegramSettings.connected = false;
      updateTelegramStatusCard();
    }
  } catch (error) {
    console.error('Auto-connection error:', error);
    telegramSettings.connected = false;
    updateTelegramStatusCard();
  }
}

// Populate form with saved settings
function populateTelegramForm() {
  document.getElementById('botToken').value = telegramSettings.botToken;
  document.getElementById('chatId').value = telegramSettings.chatId;
  document.getElementById('botName').value = telegramSettings.botName;
  document.getElementById('notifyAutomationStart').checked = telegramSettings.notifications.automationStart;
  document.getElementById('notifyAutomationStop').checked = telegramSettings.notifications.automationStop;
  document.getElementById('notifyScenarioComplete').checked = telegramSettings.notifications.scenarioComplete;
  document.getElementById('notifyScenarioError').checked = telegramSettings.notifications.scenarioError;
  document.getElementById('notifyIncludeScreenshots').checked = telegramSettings.notifications.includeScreenshots;
  document.getElementById('notifyHourlySummary').checked = telegramSettings.notifications.hourlySummary;
}

// Initialize Telegram Event Listeners
function initializeTelegramEventListeners() {
  // Bot Token input - update preview
  document.getElementById('botToken').addEventListener('input', (e) => {
    telegramSettings.botToken = e.target.value;
  });

  // Chat ID input
  document.getElementById('chatId').addEventListener('input', (e) => {
    telegramSettings.chatId = e.target.value;
  });

  // Bot Name input - update preview
  document.getElementById('botName').addEventListener('input', (e) => {
    telegramSettings.botName = e.target.value || 'My Automation Bot';
    updateTestMessagePreview();
  });

  // Notification toggles
  document.getElementById('notifyAutomationStart').addEventListener('change', (e) => {
    telegramSettings.notifications.automationStart = e.target.checked;
  });

  document.getElementById('notifyAutomationStop').addEventListener('change', (e) => {
    telegramSettings.notifications.automationStop = e.target.checked;
  });

  document.getElementById('notifyScenarioComplete').addEventListener('change', (e) => {
    telegramSettings.notifications.scenarioComplete = e.target.checked;
  });

  document.getElementById('notifyScenarioError').addEventListener('change', (e) => {
    telegramSettings.notifications.scenarioError = e.target.checked;
  });

  document.getElementById('notifyIncludeScreenshots').addEventListener('change', (e) => {
    telegramSettings.notifications.includeScreenshots = e.target.checked;
  });

  document.getElementById('notifyHourlySummary').addEventListener('change', (e) => {
    telegramSettings.notifications.hourlySummary = e.target.checked;
  });

  // Action buttons
  document.getElementById('testConnectionBtn').addEventListener('click', testTelegramConnection);
  document.getElementById('saveTelegramSettingsBtn').addEventListener('click', saveTelegramSettings);
  document.getElementById('disconnectTelegramBtn').addEventListener('click', disconnectTelegram);
}

// Update test message preview
function updateTestMessagePreview() {
  const botName = telegramSettings.botName || 'My Automation Bot';
  const testBotNameEl = document.getElementById('testBotName');
  if (testBotNameEl) {
    testBotNameEl.textContent = botName;
  }
}

// Test Telegram Connection
async function testTelegramConnection() {
  const token = document.getElementById('botToken').value.trim();
  const chatId = document.getElementById('chatId').value.trim();

  if (!token) {
    showToast('Please enter your Bot Token', 'error');
    return;
  }

  if (!chatId) {
    showToast('Please enter your Chat ID', 'error');
    return;
  }

  const btn = document.getElementById('testConnectionBtn');
  btn.disabled = true;
  btn.innerHTML = '<span></span> Testing...';

  try {
    // Test connection via IPC
    const result = await window.electronAPI.testTelegramConnection({ token, chatId });

    if (result.success) {
      showToast('Connection successful! Bot is ready.', 'success');
      telegramSettings.connected = true;
      telegramSettings.botToken = token;
      telegramSettings.chatId = chatId;

      // Save settings
      localStorage.setItem('telegramSettings', JSON.stringify(telegramSettings));

      // Update status card
      updateTelegramStatusCard();

      // Start polling for messages
      startMessagePolling();

      // Add a test notification to the list
      addNotificationToList({
        title: 'Bot connected successfully',
        icon: '',
        status: 'success'
      });
    } else {
      showToast(`Connection failed: ${result.error}`, 'error');
      telegramSettings.connected = false;
      updateTelegramStatusCard();
    }
  } catch (error) {
    console.error('Telegram connection test error:', error);
    showToast('Connection test failed', 'error');
    telegramSettings.connected = false;
    updateTelegramStatusCard();
  } finally {
    btn.disabled = false;
    btn.innerHTML = ' Test Connection';
  }
}

// Save Telegram Settings
function saveTelegramSettings() {
  const token = document.getElementById('botToken').value.trim();
  const chatId = document.getElementById('chatId').value.trim();
  const botName = document.getElementById('botName').value.trim() || 'My Automation Bot';

  if (!token || !chatId) {
    showToast('Please fill in Bot Token and Chat ID', 'error');
    return;
  }

  // Update settings
  telegramSettings.botToken = token;
  telegramSettings.chatId = chatId;
  telegramSettings.botName = botName;

  // Save to localStorage
  localStorage.setItem('telegramSettings', JSON.stringify(telegramSettings));

  showToast('Settings saved successfully', 'success');

  // If connected, start polling
  if (telegramSettings.connected) {
    startMessagePolling();
  }
}

// Disconnect Telegram
function disconnectTelegram() {
  if (confirm('Are you sure you want to disconnect the Telegram bot?')) {
    telegramSettings.connected = false;
    updateTelegramStatusCard();
    showToast('Telegram bot disconnected', 'info');

    // Add a notification
    addNotificationToList({
      title: 'Bot disconnected',
      icon: '',
      status: 'success'
    });
  }
}

// Add Notification to List
function addNotificationToList(notification) {
  const list = document.getElementById('notificationsList');
  if (!list) return;

  const emptyState = list.querySelector('.empty-notifications');

  if (emptyState) {
    emptyState.remove();
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const notificationItem = document.createElement('div');
  notificationItem.className = 'notification-item';
  notificationItem.innerHTML = `
    <div class="notification-icon">${notification.icon || ''}</div>
    <div class="notification-content">
      <div class="notification-title">${notification.title}</div>
      <div class="notification-time">${timeString}</div>
    </div>
    <span class="notification-status ${notification.status}">${notification.status}</span>
  `;

  // Insert at the top
  list.insertBefore(notificationItem, list.firstChild);

  // Limit to last 10 notifications
  const items = list.querySelectorAll('.notification-item');
  if (items.length > 10) {
    items[items.length - 1].remove();
  }
}

// Send Telegram Notification
async function sendTelegramNotification(message) {
  if (!telegramSettings.connected) return;

  try {
    await window.electronAPI.sendTelegramMessage({
      token: telegramSettings.botToken,
      chatId: telegramSettings.chatId,
      message: message
    });

    // Add to notifications list
    addNotificationToList({
      title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      icon: '',
      status: 'success'
    });
  } catch (error) {
    console.error('Failed to send telegram notification:', error);
  }
}

// ===========================================
// INCOMING MESSAGES TABLE FUNCTIONALITY
// ===========================================

// Messages State
let incomingMessages = [];
let messagePage = 1;
const messagesPerPage = 10;
let messagePollingInterval = null;

// Sample incoming messages data (for demonstration)
const sampleMessages = [
  {
    id: 1,
    time: new Date(Date.now() - 60000),
    sender: 'John Doe',
    username: '@johndoe',
    content: '/start - Start the automation',
    type: 'command',
    unread: true
  },
  {
    id: 2,
    time: new Date(Date.now() - 120000),
    sender: 'Jane Smith',
    username: '@janesmith',
    content: 'Can you run the login scenario?',
    type: 'text',
    unread: false
  },
  {
    id: 3,
    time: new Date(Date.now() - 300000),
    sender: 'Bot Admin',
    username: '@botadmin',
    content: 'Automation completed successfully - 5 actions executed',
    type: 'text',
    unread: false
  },
  {
    id: 4,
    time: new Date(Date.now() - 600000),
    sender: 'System',
    username: '@system',
    content: '/status - Check current automation status',
    type: 'command',
    unread: false
  }
];

// Initialize Incoming Messages Table
function initializeIncomingMessages() {
  // Load saved messages from localStorage
  const savedMessages = localStorage.getItem('incomingMessages');
  if (savedMessages) {
    try {
      incomingMessages = JSON.parse(savedMessages);
      // Convert time strings back to Date objects
      incomingMessages = incomingMessages.map(msg => ({
        ...msg,
        time: new Date(msg.time)
      }));
    } catch (e) {
      console.error('Failed to parse saved messages:', e);
      incomingMessages = [...sampleMessages];
    }
  } else {
    incomingMessages = [...sampleMessages];
  }

  // Initialize event listeners
  initializeMessagesEventListeners();

  // Render messages
  renderMessagesTable();

  // Start polling if connected
  if (telegramSettings.connected) {
    startMessagePolling();
  }
}

// Initialize Messages Event Listeners
function initializeMessagesEventListeners() {
  const refreshBtn = document.getElementById('refreshMessagesBtn');
  const clearBtn = document.getElementById('clearMessagesBtn');
  const prevBtn = document.getElementById('prevMessagePageBtn');
  const nextBtn = document.getElementById('nextMessagePageBtn');

  if (refreshBtn) refreshBtn.addEventListener('click', refreshMessages);
  if (clearBtn) clearBtn.addEventListener('click', clearAllMessages);
  if (prevBtn) prevBtn.addEventListener('click', () => changeMessagePage(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => changeMessagePage(1));
}

// Render Messages Table
function renderMessagesTable() {
  const tbody = document.getElementById('messagesTableBody');
  if (!tbody) return;

  // Calculate pagination
  const totalPages = Math.ceil(incomingMessages.length / messagesPerPage);
  const startIndex = (messagePage - 1) * messagesPerPage;
  const endIndex = startIndex + messagesPerPage;
  const pageMessages = incomingMessages.slice(startIndex, endIndex);

  // Update pagination info
  const currentPageEl = document.getElementById('currentMessagePage');
  const totalPagesEl = document.getElementById('totalMessagePages');
  const prevBtn = document.getElementById('prevMessagePageBtn');
  const nextBtn = document.getElementById('nextMessagePageBtn');

  if (currentPageEl) currentPageEl.textContent = messagePage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
  if (prevBtn) prevBtn.disabled = messagePage <= 1;
  if (nextBtn) nextBtn.disabled = messagePage >= totalPages;

  if (pageMessages.length === 0) {
    tbody.innerHTML = `
      <tr class="empty-table-row">
        <td colspan="6">
          <div class="empty-state">
            <span style="font-size: 48px; display: block; margin-bottom: 12px;">📭</span>
            <p>No incoming messages yet.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pageMessages.map(msg => {
    const time = new Date(msg.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const date = new Date(msg.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const messageContent = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
    const messageTypeIcon = getMessageTypeIcon(msg.type);

    return `
      <tr class="${msg.unread ? 'unread' : ''}" data-message-id="${msg.id}">
        <td class="td-id">${msg.id}</td>
        <td class="td-sender">
          <span class="sender-name">${escapeHtml(msg.sender)}</span>
          <span class="sender-username">${escapeHtml(msg.username || '')}</span>
        </td>
        <td class="td-content" title="${escapeHtml(msg.content)}">${escapeHtml(messageContent)}</td>
        <td class="td-time">
          <span class="message-time">${time}</span>
          <span class="message-date">${date}</span>
        </td>
        <td class="td-type">
          <span class="message-type-badge ${msg.type}">
            ${messageTypeIcon} ${msg.type}
          </span>
        </td>
        <td class="td-actions">
          <button class="row-action-btn reply-message-btn" title="Reply" onclick="replyToMessage(${msg.id})">💬</button>
          <button class="row-action-btn delete-message-btn" title="Delete" onclick="deleteMessage(${msg.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Get Message Type Icon
function getMessageTypeIcon(type) {
  switch (type) {
    case 'text': return '';
    case 'command': return 'G';
    case 'photo': return '+n+';
    case 'document': return '';
    default: return 'G';
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Change message page
function changeMessagePage(delta) {
  const totalPages = Math.ceil(incomingMessages.length / messagesPerPage);
  const newPage = messagePage + delta;

  if (newPage >= 1 && newPage <= totalPages) {
    messagePage = newPage;
    renderMessagesTable();
  }
}

// Refresh messages
async function refreshMessages() {
  const btn = document.getElementById('refreshMessagesBtn');
  if (!btn) return;

  btn.disabled = true;
  const originalContent = btn.innerHTML;
  btn.innerHTML = '<span>G</span> Refreshing...';

  try {
    // In a real implementation, this would poll the Telegram API
    if (telegramSettings.connected) {
      await checkForNewMessages();
    }

    renderMessagesTable();
    showToast('Messages refreshed', 'success');
  } catch (error) {
    console.error('Failed to refresh messages:', error);
    showToast('Failed to refresh messages', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalContent;
  }
}

// FIFO Message Queue for Telegram Trigger
let telegramMessageQueue = [];
let isProcessingTelegramQueue = false;
let currentTelegramMessage = null;
let telegramOffset = 0;

// Auto-trigger telegram-enabled scenario when new message arrives
async function autoTriggerTelegramScenario(message) {
  // Find any scenario with triggerByTelegram enabled and is waiting for message
  const telegramScenario = scenarios.find(s =>
    s.triggerByTelegram &&
    s.isWaitingForMessage &&
    s.actions &&
    s.actions.length > 0
  );

  if (!telegramScenario) {
    console.log('No telegram-triggered scenario found waiting for message');
    return false;
  }

  // Check if automation is running
  if (!isAutomationRunning) {
    console.log('Automation is not running, cannot trigger scenario');
    return false;
  }

  // Check if another scenario is already running
  if (runningScenarioId && runningScenarioId !== telegramScenario.id) {
    console.log('Another scenario is already running, message queued');
    telegramMessageQueue.push(message);
    return false;
  }

  // Set current message for clipboard processing
  currentTelegramMessage = message;

  // Copy message content to clipboard for the scenario to use
  try {
    await window.electronAPI.setClipboardText(message.content);
    console.log('Message content copied to clipboard:', message.content);
  } catch (error) {
    console.error('Failed to copy message to clipboard:', error);
  }

  // Show notification
  showToast(`📨 "${telegramScenario.name}" received message! Executing...`, 'info');
  console.log(`Auto-triggering telegram scenario: ${telegramScenario.name}`);

  // Start the scenario (triggered by telegram)
  await startScenarioExecution(telegramScenario.id, true);

  // After scenario starts, add this message to the queue for tracking
  // It will be shifted out when processed
  telegramMessageQueue.push(message);

  return true;
}

async function checkForNewMessages() {
  if (!telegramSettings.connected || !telegramSettings.botToken || !telegramSettings.chatId) {
    return;
  }

  try {
    const result = await window.electronAPI.getTelegramUpdates({
      token: telegramSettings.botToken,
      chatId: telegramSettings.chatId,
      offset: telegramOffset
    });

    if (result.success && result.updates && result.updates.length > 0) {
      // Update offset for next poll
      telegramOffset = result.offset;

      // Only accept text messages
      const newMessages = result.updates
        .filter(update => update.type === 'text' || update.text)
        .map(update => ({
          id: update.id,
          time: update.time,
          sender: update.sender,
          username: update.username,
          content: update.text || update.content,
          type: 'text',
          unread: true
        }));

      // Only add if there are new text messages
      if (newMessages.length > 0) {
        // Add to incoming messages for display
        incomingMessages = [...newMessages, ...incomingMessages];

        // Auto-trigger telegram-enabled scenario waiting for message
        // Track if triggering was successful to avoid duplicate queue additions
        let triggeringSuccessful = false;
        if (newMessages.length > 0) {
          triggeringSuccessful = await autoTriggerTelegramScenario(newMessages[0]);
        }

        // FIFO Queue Processing: Add messages to queue for telegram-triggered scenarios
        // Skip the first message if triggering was successful (it was already added)
        const startIndex = triggeringSuccessful ? 1 : 0;
        for (let i = startIndex; i < newMessages.length; i++) {
          addToTelegramQueue(newMessages[i]);
        }

        // Trigger queue processing if scenario is running with telegram trigger
        if (runningScenarioId) {
          const scenario = scenarios.find(s => s.id === runningScenarioId);
          if (scenario && scenario.triggerByTelegram) {
            handleTelegramMessageQueue();
          }
        }
      }

      if (incomingMessages.length > 100) {
        incomingMessages = incomingMessages.slice(0, 100);
      }

      saveMessages();
    }
  } catch (error) {
    console.error('Failed to check for new messages:', error);
  }
}

// Clear all messages
function clearAllMessages() {
  if (confirm('Are you sure you want to clear all messages?')) {
    incomingMessages = [];
    messagePage = 1;
    saveMessages();
    renderMessagesTable();    
    showToast('All messages cleared', 'success');
  }
}

function deleteMessage(messageId) {
  if (confirm('Delete this message?')) {
    incomingMessages = incomingMessages.filter(msg => msg.id !== messageId);
    saveMessages();

    const totalPages = Math.ceil(incomingMessages.length / messagesPerPage);
    if (messagePage > totalPages && totalPages > 0) {
      messagePage = totalPages;
    }

    renderMessagesTable();

    showToast('Message deleted', 'success');
  }
}

// Reply to message
function replyToMessage(messageId) {
  const msg = incomingMessages.find(m => m.id === messageId);
  if (!msg) return;

  const replyText = prompt(`Reply to ${msg.sender} (${msg.username}):`, '');
  if (replyText !== null && replyText.trim()) {
    showToast('Reply sent!', 'success');
  }
}

// Save messages to localStorage
function saveMessages() {
  // Limit to last 100 messages
  const messagesToSave = incomingMessages.slice(0, 100);
  localStorage.setItem('incomingMessages', JSON.stringify(messagesToSave));
}

// Start message polling
function startMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
  }

  // Poll every 30 seconds
  messagePollingInterval = setInterval(async () => {
    if (telegramSettings.connected) {
      await checkForNewMessages();
      renderMessagesTable();
    }
  }, 5000);
}

// Stop message polling
function stopMessagePolling() {
  if (messagePollingInterval) {
    clearInterval(messagePollingInterval);
    messagePollingInterval = null;
  }
}

// Update Telegram Status Card
function updateTelegramStatusCard() {
  const card = document.getElementById('telegramStatusCard');
  if (!card) return;

  const statusText = document.getElementById('telegramStatusText');
  const statusDesc = document.getElementById('telegramStatusDescription');
  const badge = document.getElementById('telegramStatusBadge');

  // Remove all status classes
  card.classList.remove('connected', 'error');

  if (telegramSettings.connected) {
    card.classList.add('connected');
    if (statusText) statusText.textContent = 'Telegram Bot Connected';
    if (statusDesc) statusDesc.textContent = `Connected as ${telegramSettings.botName}`;
    if (badge) badge.innerHTML = '<span class="status-badge-text">ONLINE</span>';
    // Start polling for messages
    startMessagePolling();
  } else {
    if (statusText) statusText.textContent = 'Telegram Bot Disconnected';
    if (statusDesc) statusDesc.textContent = 'Configure your Telegram bot to receive notifications';
    if (badge) badge.innerHTML = '<span class="status-badge-text">OFFLINE</span>';
    // Stop polling
    stopMessagePolling();
  }
}

// Make functions available globally
window.replyToMessage = replyToMessage;
window.deleteMessage = deleteMessage;




