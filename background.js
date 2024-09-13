// Initialize recording state
let isRecording = false;
let recordedActions = [];

// Listen for messages from content script and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_RECORDING':
      handleStartRecording();
      break;
    case 'STOP_RECORDING':
      handleStopRecording();
      break;
    case 'ACTION_RECORDED':
      handleActionRecorded(message.action);
      break;
    case 'GET_ACTIONS':
      sendResponse({actions: recordedActions});
      break;
    case 'UPDATE_ACTIONS':
      recordedActions = message.actions;
      break;
    case 'SIMULATE_SCRIPT':
      simulateScript();
      break;
    case 'SAVE_ACTIONS':
      saveActions(message.name);
      break;
    case 'LOAD_ACTIONS':
      loadActions(message.name);
      break;
    case 'RECORD_ERROR':
      console.error('Recording error:', message.error);
      // You might want to send this error to the side panel to display to the user
      chrome.runtime.sendMessage({type: 'RECORD_ERROR', error: message.error});
      break;
  }
});

function handleStartRecording() {
  isRecording = true;
  recordedActions = [];
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {type: 'START_RECORDING'});
  });
}

function handleStopRecording() {
  isRecording = false;
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {type: 'STOP_RECORDING'});
  });
}

function handleActionRecorded(action) {
  if (isRecording) {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
      action.screenshot = dataUrl;
      recordedActions.push(action);
      chrome.runtime.sendMessage({type: 'UPDATE_ACTIONS', actions: recordedActions});
    });
  }
}

function simulateScript() {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      function: simulateActions,
      args: [recordedActions]
    });
  });
}

function saveActions(name) {
  chrome.storage.local.set({[name]: recordedActions}, () => {
    chrome.runtime.sendMessage({type: 'ACTIONS_SAVED', name: name});
  });
}

function loadActions(name) {
  chrome.storage.local.get([name], (result) => {
    if (result[name]) {
      recordedActions = result[name];
      chrome.runtime.sendMessage({type: 'ACTIONS_LOADED', actions: recordedActions});
    } else {
      chrome.runtime.sendMessage({type: 'LOAD_ERROR', error: 'No saved actions found with this name'});
    }
  });
}

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({tabId: tab.id});
});

// Function to simulate actions (will be injected into the page)
function simulateActions(actions) {
  actions.forEach(action => {
    const element = document.evaluate(action.selector.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (element) {
      switch (action.type) {
        case 'click':
          element.click();
          break;
        case 'input':
          element.value = action.value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        case 'hover':
          element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          break;
        case 'dragStart':
          element.dispatchEvent(new MouseEvent('dragstart', { bubbles: true }));
          break;
        case 'drop':
          element.dispatchEvent(new MouseEvent('drop', { bubbles: true }));
          break;
      }
    }
  });
}