let isRecording = false;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    isRecording = true;
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
  }
});

// Capture user actions
document.addEventListener('click', handleClick);
document.addEventListener('input', handleInput);
document.addEventListener('mouseover', handleHover);
document.addEventListener('dragstart', handleDragStart);
document.addEventListener('drop', handleDrop);

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
  try {
    const action = {
      type: type,
      selector: {
        type: 'xpath',
        value: getXPath(element)
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