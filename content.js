let isRecording = false;
let isExtensionActive = true;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    isRecording = true;
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
  }
});

// Check if extension is still active
function checkExtensionStatus() {
  if (chrome.runtime && chrome.runtime.id) {
    isExtensionActive = true;
  } else {
    isExtensionActive = false;
    removeEventListeners();
  }
}

// Capture user actions
function addEventListeners() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('mouseover', handleHover);
  document.addEventListener('dragstart', handleDragStart);
  document.addEventListener('drop', handleDrop);
}

function removeEventListeners() {
  document.removeEventListener('click', handleClick);
  document.removeEventListener('input', handleInput);
  document.removeEventListener('mouseover', handleHover);
  document.removeEventListener('dragstart', handleDragStart);
  document.removeEventListener('drop', handleDrop);
}

function handleClick(event) {
  if (!isRecording) return;
  recordAction('click', event.target);
}

function handleInput(event) {
  if (!isRecording) return;
  recordAction('input', event.target, { value: event.target.value });
}

function handleHover(event) {
  if (!isRecording) return;
  recordAction('hover', event.target);
}

function handleDragStart(event) {
  if (!isRecording) return;
  recordAction('dragStart', event.target);
}

function handleDrop(event) {
  if (!isRecording) return;
  recordAction('drop', event.target);
}

function recordAction(type, element, additionalData = {}) {
  checkExtensionStatus();
  if (!isExtensionActive) {
    console.warn('Extension context invalidated. Unable to record action.');
    return;
  }

  try {
    const action = {
      type: type,
      selector: {
        type: 'xpath',
        value: getXPath(element)
      },
      ...additionalData
    };
    chrome.runtime.sendMessage({type: 'ACTION_RECORDED', action}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error sending message:', chrome.runtime.lastError);
        isExtensionActive = false;
        removeEventListeners();
      }
    });
  } catch (error) {
    console.error('Error recording action:', error);
    if (error.message === 'Extension context invalidated.') {
      isExtensionActive = false;
      removeEventListeners();
    }
    chrome.runtime.sendMessage({type: 'RECORD_ERROR', error: error.message});
  }
}

// Helper function to get XPath of an element
function getXPath(element) {
  if (element.id !== '')
    return 'id("' + element.id + '")';
  if (element === document.body)
    return element.tagName;

  var ix = 0;
  var siblings = element.parentNode.childNodes;
  for (var i = 0; i < siblings.length; i++) {
    var sibling = siblings[i];
    if (sibling === element)
      return getXPath(element.parentNode) + '/' + element.tagName + '[' + (ix + 1) + ']';
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName)
      ix++;
  }
}

// Initialize event listeners
addEventListeners();

// Periodically check extension status
setInterval(checkExtensionStatus, 5000);