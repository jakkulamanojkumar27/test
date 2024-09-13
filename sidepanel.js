// Initialize UI elements
const startButton = document.getElementById('startRecording');
const stopButton = document.getElementById('stopRecording');
const generateButton = document.getElementById('generateScript');
const simulateButton = document.getElementById('simulateScript');
const saveButton = document.getElementById('saveActions');
const loadButton = document.getElementById('loadActions');
const actionList = document.getElementById('actionList');
const scriptOutput = document.getElementById('scriptOutput');
const errorOutput = document.getElementById('errorOutput');

let recordedActions = [];

// Add event listeners to buttons
startButton.addEventListener('click', () => chrome.runtime.sendMessage({type: 'START_RECORDING'}));
stopButton.addEventListener('click', () => chrome.runtime.sendMessage({type: 'STOP_RECORDING'}));
generateButton.addEventListener('click', generateScript);
simulateButton.addEventListener('click', () => chrome.runtime.sendMessage({type: 'SIMULATE_SCRIPT'}));
saveButton.addEventListener('click', saveActions);
loadButton.addEventListener('click', loadActions);
resetButton.addEventListener('click', resetPanel); // Add reset button listener

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'UPDATE_ACTIONS':
      recordedActions = message.actions;
      updateActionList();
      break;
    case 'ACTIONS_SAVED':
      alert(`Actions saved as "${message.name}"`);
      break;
    case 'ACTIONS_LOADED':
      recordedActions = message.actions;
      updateActionList();
      alert('Actions loaded successfully');
      break;
    case 'LOAD_ERROR':
    case 'RECORD_ERROR':
      showError(message.error);
      break;
  }
});

function updateActionList() {
  actionList.innerHTML = '';
  recordedActions.forEach((action, index) => {
    const actionCard = createActionCard(action, index);
    actionList.appendChild(actionCard);
  });
  setupDragAndDrop();
}

function createActionCard(action, index) {
  const actionCard = document.createElement('div');
  actionCard.className = 'action-card';
  actionCard.draggable = true;
  actionCard.dataset.index = index;

  const actionText = document.createElement('p');
  actionText.textContent = `Action ${index + 1}: ${action.type}`;
  actionCard.appendChild(actionText);

  if (action.screenshot) {
    const screenshot = document.createElement('img');
    screenshot.src = action.screenshot;
    screenshot.className = 'action-screenshot';
    actionCard.appendChild(screenshot);
  }

  const editButton = document.createElement('button');
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => editAction(index));
  actionCard.appendChild(editButton);

  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteAction(index));
  actionCard.appendChild(deleteButton);

  return actionCard;
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll('.action-card');
  cards.forEach(card => {
    card.addEventListener('dragstart', dragStart);
    card.addEventListener('dragover', dragOver);
    card.addEventListener('drop', drop);
  });
}

function dragStart(e) {
  e.dataTransfer.setData('text/plain', e.target.dataset.index);
}

function dragOver(e) {
  e.preventDefault();
}

function drop(e) {
  e.preventDefault();
  const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
  const toIndex = parseInt(e.target.closest('.action-card').dataset.index);
  
  if (fromIndex !== toIndex) {
    const [removed] = recordedActions.splice(fromIndex, 1);
    recordedActions.splice(toIndex, 0, removed);
    updateActionList();
    chrome.runtime.sendMessage({type: 'UPDATE_ACTIONS', actions: recordedActions});
  }
}

function editAction(index) {
  const action = recordedActions[index];
  const newValue = prompt(`Edit action ${index + 1}:`, JSON.stringify(action));
  if (newValue) {
    try {
      recordedActions[index] = JSON.parse(newValue);
      updateActionList();
      chrome.runtime.sendMessage({type: 'UPDATE_ACTIONS', actions: recordedActions});
    } catch (error) {
      showError('Invalid JSON. Action not updated.');
    }
  }
}

function deleteAction(index) {
  if (confirm(`Delete action ${index + 1}?`)) {
    recordedActions.splice(index, 1);
    updateActionList();
    chrome.runtime.sendMessage({type: 'UPDATE_ACTIONS', actions: recordedActions});
  }
}

function generateScript() {
  const script = convertToPlaywright(recordedActions);
  scriptOutput.textContent = script;
}

function saveActions() {
  const name = prompt('Enter a name for this action sequence:');
  if (name) {
    chrome.runtime.sendMessage({type: 'SAVE_ACTIONS', name: name});
  }
}

function loadActions() {
  const name = prompt('Enter the name of the action sequence to load:');
  if (name) {
    chrome.runtime.sendMessage({type: 'LOAD_ACTIONS', name: name});
  }
}

function showError(message) {
  errorOutput.textContent = message;
  errorOutput.style.display = 'block';
  setTimeout(() => {
    errorOutput.style.display = 'none';
  }, 5000);
}

function resetPanel() {
  recordedActions = [];
  updateActionList();
  scriptOutput.textContent = '';
  chrome.runtime.sendMessage({ type: 'UPDATE_ACTIONS', actions: recordedActions });
}

function convertToPlaywright(actions) {
    let script = `const { chromium } = require('playwright');\n\n`;
    script += `(async () => {\n`;
    script += `  const browser = await chromium.launch();\n`;
    script += `  const page = await browser.newPage();\n`;
    script += `  await page.goto('${window.location.href}');\n\n`;
    
    actions.forEach(action => {
        switch (action.type) {
        case 'click':
            script += `  await page.click('${action.selector.value}');\n`;
            break;
        case 'input':
            script += `  await page.fill('${action.selector.value}', '${action.value}');\n`;
            break;
        case 'hover':
            script += `  await page.hover('${action.selector.value}');\n`;
            break;
        case 'dragStart':
            script += `  await page.dragAndDrop('${action.selector.value}', '${action.dropSelector.value}');\n`;
            break;
        case 'type':
            script += `  await page.type('${action.selector.value}', '${action.value}');\n`;
            break;
        case 'keyPress':
            script += `  await page.keyboard.press('${action.key}');\n`;
            break;
        case 'select':
            script += `  await page.selectOption('${action.selector.value}', '${action.value}');\n`;
            break;
        case 'fileUpload':
            script += `  await page.setInputFiles('${action.selector.value}', '${action.files}');\n`;
            break;
        case 'navigate':
            script += `  await page.goto('${action.url}');\n`;
            break;
        case 'back':
            script += `  await page.goBack();\n`;
            break;
        case 'forward':
            script += `  await page.goForward();\n`;
            break;
        case 'refresh':
            script += `  await page.reload();\n`;
            break;
        case 'waitForElement':
            script += `  await page.waitForSelector('${action.selector.value}');\n`;
            break;
        case 'waitForNavigation':
            script += `  await page.waitForNavigation();\n`;
            break;
        case 'waitForTimeout':
            script += `  await page.waitForTimeout(${action.duration});\n`;
            break;
        case 'assert':
            script += `  // Implement assert logic here\n`;
            break;
        case 'scroll':
            script += `  await page.evaluate(() => window.scrollTo(${action.x}, ${action.y}));\n`;
            break;
        case 'screenshot':
            script += `  await page.screenshot({ path: 'screenshot.png' });\n`;
            break;
        case 'executeJavaScript':
            script += `  await page.evaluate(\`${action.script}\`);\n`;
            break;
        default:
            script += `  // Unsupported action type: ${action.type}\n`;
        }
    });

    script += `\n  await browser.close();\n`;
    script += `})();\n`;

    return script;
}
