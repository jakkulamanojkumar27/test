let isRecording = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    isRecording = true;
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
  }
});

// Debounce function
let timeout;
const debounce = (func, delay) => {
  clearTimeout(timeout);
  timeout = setTimeout(func, delay);
};

// Capture user actions
document.addEventListener('click', handleClick);
document.addEventListener('input', (event) => debounce(() => handleInput(event), 300));
document.addEventListener('mouseover', (event) => debounce(() => handleHover(event), 100));
document.addEventListener('dragstart', handleDragStart);
document.addEventListener('drop', handleDrop);
document.addEventListener('change', handleChange); // Add change event listener
document.addEventListener('keydown', handleKeyDown); // Add keydown event listener
document.addEventListener('scroll', handleScroll); // Add scroll event listener

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

function handleChange(event) {
  if (!isRecording) return;
  if (event.target.tagName === 'SELECT') {
    recordAction('select', event.target, { value: event.target.value });
  } else if (event.target.type === 'file') {
    recordAction('fileUpload', event.target, { files: event.target.files });
  }
}

function handleKeyDown(event) {
  if (!isRecording) return;
  recordAction('keyPress', event.target, { key: event.key, code: event.code });
}

function handleScroll(event) {
  if (!isRecording) return;
  recordAction('scroll', window, { x: window.scrollX, y: window.scrollY });
}

function recordAction(type, element, additionalData = {}) {
  if (!isRecording) return; // Add check for recording status
  try {
    const action = {
      type: type,
      selector: {
        type: element === window ? 'window' : 'xpath', // Special case for window
        value: element === window ? '' : getXPath(element)
      },
      ...additionalData
    };
    chrome.runtime.sendMessage({type: 'ACTION_RECORDED', action});
  } catch (error) {
    console.error('Error recording action:', error);
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
