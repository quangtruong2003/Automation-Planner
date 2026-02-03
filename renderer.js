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
});

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

  // Keyboard Shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
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
    success: '✅',
    error: '❌',
    info: 'ℹ️'
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
    takeScreenshots: true,
    actions: [
      { id: 1, type: '🖱️', details: 'Click at (120, 450) - Username field' },
      { id: 2, type: '⌨️', details: 'Type "testuser@example.com"' },
      { id: 3, type: '➡️', details: 'Tab to next field' },
      { id: 4, type: '⌨️', details: 'Type password "********"' },
      { id: 5, type: '🖱️', details: 'Click at (850, 520) - Login button' }
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
    takeScreenshots: true,
    actions: [
      { id: 1, type: '🖱️', details: 'Click at (200, 150) - Cart icon' },
      { id: 2, type: '🖱️', details: 'Click at (600, 400) - Checkout button' },
      { id: 3, type: '⌨️', details: 'Type shipping address' },
      { id: 4, type: '🖱️', details: 'Click at (700, 500) - Continue payment' }
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
    takeScreenshots: false,
    actions: [
      { id: 1, type: '🖱️', details: 'Click at (100, 100) - First field' },
      { id: 2, type: '⌨️', details: 'Type form data' }
    ],
    updatedAt: '3d ago'
  }
];

let selectedScenarioId = 1;
let scenarioCounter = 4;
let selectedIcon = '📁';

// Initialize Scenarios
function initializeScenarios() {
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
  selectedIcon = '📁';
  document.querySelectorAll('.icon-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.icon === '📁');
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
    takeScreenshots: true,
    actions: [],
    updatedAt: 'Just now'
  };

  scenarios.push(newScenario);
  renderScenarioList();
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
  document.getElementById('scenarioScreenshots').checked = scenario.takeScreenshots;

  // Render actions
  renderScenarioActions(scenario.actions);
}

// Render Scenario Actions
function renderScenarioActions(actions) {
  const container = document.getElementById('scenarioActionsList');

  if (!actions || actions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-muted);">
        <span style="font-size: 48px; display: block; margin-bottom: 12px;">📭</span>
        <p>No actions yet. Click "Add Action" to create one.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = actions.map((action, index) => `
    <div class="scenario-action-item" data-action-id="${action.id}">
      <span class="action-order">${index + 1}</span>
      <span class="action-type">${action.type}</span>
      <span class="action-details">${action.details}</span>
      <div class="action-controls">
        <button class="row-action-btn edit" title="Edit">✏️</button>
        <button class="row-action-btn delete" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');

  // Re-attach event listeners
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
    takeScreenshots: true,
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
  scenario.takeScreenshots = document.getElementById('scenarioScreenshots').checked;
  scenario.updatedAt = 'Just now';

  renderScenarioList();
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
  renderScenarioList();
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
    renderScenarioList();
    selectScenario(selectedScenarioId);
    showToast('Scenario deleted', 'success');
  }
}

// Render Scenario List
function renderScenarioList() {
  const container = document.getElementById('scenarioList');
  container.innerHTML = scenarios.map(scenario => `
    <div class="scenario-item ${scenario.id === selectedScenarioId ? 'active' : ''}" data-id="${scenario.id}">
      <span class="scenario-icon">${scenario.icon}</span>
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

// Run Scenario
function runScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const runBtn = document.getElementById('runScenarioBtn');
  const testBtn = document.getElementById('testRunScenarioBtn');
  const stopBtn = document.getElementById('stopScenarioBtn');

  runBtn.style.display = 'none';
  testBtn.style.display = 'none';
  stopBtn.style.display = 'flex';

  showToast(`Running scenario: ${scenario.name}`, 'info');

  // TODO: Implement actual scenario execution
  // This would involve IPC calls to the main process to control mouse/keyboard

  // Simulate running
  setTimeout(() => {
    stopScenario();
    showToast('Scenario completed successfully', 'success');
  }, 3000);
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
  const runBtn = document.getElementById('runScenarioBtn');
  const testBtn = document.getElementById('testRunScenarioBtn');
  const stopBtn = document.getElementById('stopScenarioBtn');

  runBtn.style.display = 'flex';
  testBtn.style.display = 'flex';
  stopBtn.style.display = 'none';

  showToast('Scenario execution stopped', 'info');
}

// Add Action to Scenario
function addActionToScenario() {
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const actionTypes = [
    { icon: '🖱️', label: 'Mouse Click', prefix: 'Click at ' },
    { icon: '👆', label: 'Mouse Move', prefix: 'Move to ' },
    { icon: '➡️', label: 'Key Press', prefix: 'Press key: ' },
    { icon: '⌨️', label: 'Type Text', prefix: 'Type: ' },
    { icon: '⏱️', label: 'Wait', prefix: 'Wait ' },
    { icon: '📸', label: 'Screenshot', prefix: 'Take screenshot' }
  ];

  const newAction = {
    id: Date.now(),
    type: '🖱️',
    details: 'New action'
  };

  scenario.actions.push(newAction);
  renderScenarioActions(scenario.actions);
  renderScenarioList();
  showToast('Action added. Click edit to configure.', 'info');
}

// Edit Scenario Action
function editScenarioAction(actionItem) {
  const actionId = parseInt(actionItem.dataset.actionId);
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  const action = scenario.actions.find(a => a.id === actionId);
  if (!action) return;

  const newDetails = prompt('Edit action details:', action.details);
  if (newDetails !== null && newDetails.trim()) {
    action.details = newDetails.trim();
    renderScenarioActions(scenario.actions);
    showToast('Action updated', 'success');
  }
}

// Delete Scenario Action
function deleteScenarioAction(actionItem) {
  const actionId = parseInt(actionItem.dataset.actionId);
  const scenario = scenarios.find(s => s.id === selectedScenarioId);
  if (!scenario) return;

  if (confirm('Delete this action?')) {
    scenario.actions = scenario.actions.filter(a => a.id !== actionId);
    renderScenarioActions(scenario.actions);
    renderScenarioList();
    showToast('Action deleted', 'success');
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
        icon: '✅',
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
  btn.innerHTML = '<span>⏳</span> Testing...';

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
        icon: '✅',
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
    btn.innerHTML = '<span>🔗</span> Test Connection';
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
      icon: '👋',
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
    <div class="notification-icon">${notification.icon || '📢'}</div>
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
      icon: '📨',
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
        <td colspan="5">
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
    const messageContent = msg.content.length > 70 ? msg.content.substring(0, 70) + '...' : msg.content;
    const messageTypeIcon = getMessageTypeIcon(msg.type);

    return `
      <tr class="${msg.unread ? 'unread' : ''}" data-message-id="${msg.id}">
        <td class="td-time">
          <span class="message-time">${time}</span>
          <span class="message-date">${date}</span>
        </td>
        <td class="td-sender">
          <span class="sender-name">${escapeHtml(msg.sender)}</span>
          <span class="sender-username">${escapeHtml(msg.username || '')}</span>
        </td>
        <td class="td-content" title="${escapeHtml(msg.content)}">${escapeHtml(messageContent)}</td>
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
    case 'text': return '📝';
    case 'command': return '⚡';
    case 'photo': return '🖼️';
    case 'document': return '📄';
    default: return '❓';
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
  btn.innerHTML = '<span>⏳</span> Refreshing...';

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

// Check for new messages (real implementation)
let telegramOffset = 0;

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

      // Add new messages to the list
      const newMessages = result.updates.map(update => ({
        id: update.id,
        time: update.time,
        sender: update.sender,
        username: update.username,
        content: update.content,
        type: update.type,
        unread: true
      }));

      // Add new messages to the beginning of the list
      incomingMessages = [...newMessages, ...incomingMessages];

      // Limit total messages
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

// Delete single message
function deleteMessage(messageId) {
  if (confirm('Delete this message?')) {
    incomingMessages = incomingMessages.filter(msg => msg.id !== messageId);
    saveMessages();

    // Adjust page if necessary
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
  }, 30000);
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  updateStats();
  initializeTelegramSettings();
  initializeIncomingMessages();
});