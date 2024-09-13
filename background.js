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
async function simulateActions(actions) {
  for (const action of actions) {
    let element;
    if (action.selector.type === 'xpath') {
      element = document.evaluate(action.selector.value, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } else if (action.selector.type === 'window') {
      element = window;
    }

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
        case 'dragStart':
          const dragStartElement = getSimulateElement(action);
          const dropElement = getSimulateElement(action.dropSelector);
          if (dragStartElement && dropElement) {
            const dragStartRect = dragStartElement.getBoundingClientRect();
            const dropRect = dropElement.getBoundingClientRect();
            const dragStartX = dragStartRect.left + dragStartRect.width / 2;
            const dragStartY = dragStartRect.top + dragStartRect.height / 2;
            const dropX = dropRect.left + dropRect.width / 2;
            const dropY = dropRect.top + dropRect.height / 2;
            dragStartElement.dispatchEvent(new MouseEvent('mousedown', { clientX: dragStartX, clientY: dragStartY, bubbles: true }));
            document.dispatchEvent(new MouseEvent('mousemove', { clientX: dropX, clientY: dropY, bubbles: true }));
            dropElement.dispatchEvent(new MouseEvent('mouseup', { clientX: dropX, clientY: dropY, bubbles: true }));
          }
          break;
        case 'select':
          element.value = action.value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        case 'fileUpload':
        case 'fileUpload':
          const fileUploadElement = getSimulateElement(action);
          if (fileUploadElement) {
            const files = action.files.map(file => new File([""], file.name, { type: file.type }));
            const dataTransfer = new DataTransfer();
            files.forEach(file => dataTransfer.items.add(file));
            fileUploadElement.files = dataTransfer.files;
            fileUploadElement.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        case 'navigate':
          window.location.href = action.url;
          break;
        case 'back':
          window.history.back();
          break;
        case 'forward':
          window.history.forward();
          break;
        case 'refresh':
          window.location.reload();
          break;
        case 'waitForElement':
        case 'waitForElement':
          await new Promise(resolve => {
            const interval = setInterval(() => {
              const waitForElement = getSimulateElement(action);
              if (waitForElement) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
          });
          break;
        case 'waitForNavigation':
        case 'waitForNavigation':
          await new Promise(resolve => {
            window.addEventListener('load', () => {
              resolve();
            }, { once: true });
          });
          break;
        case 'waitForTimeout':
          await new Promise(resolve => setTimeout(resolve, action.duration));
          break;
        case 'assert':
        case 'assert':
          if (action.assertionType === 'elementExists') {
            const assertElement = getSimulateElement(action);
            if (!assertElement) {
              throw new Error(`Assertion failed: Element with selector "${action.selector.value}" does not exist.`);
            }
          } else if (action.assertionType === 'elementVisible') {
            const assertElement = getSimulateElement(action);
            if (!assertElement || !isVisible(assertElement)) {
              throw new Error(`Assertion failed: Element with selector "${action.selector.value}" is not visible.`);
            }
          } else if (action.assertionType === 'textEquals') {
            const assertElement = getSimulateElement(action);
            if (!assertElement || assertElement.textContent !== action.expectedText) {
              throw new Error(`Assertion failed: Text content of element with selector "${action.selector.value}" does not equal "${action.expectedText}".`);
            }
          }
          break;
        case 'scroll':
          window.scrollTo(action.x, action.y);
          break;
        case 'screenshot':
        case 'screenshot':
          // This is a placeholder, as taking screenshots from the background script is complex
          console.log('Screenshot action simulated (not implemented)');
          break;
        case 'executeJavaScript':
          eval(action.script);
          break;
        case 'keyPress':
          element.dispatchEvent(new KeyboardEvent('keydown', { key: action.key, code: action.code, bubbles: true }));
          break;
      }
    }
  }
}
