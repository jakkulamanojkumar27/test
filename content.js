let dragStartElement = null;

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
  dragStartElement = event.target;
  recordAction('dragStart', event.target);
}

function handleDrop(event) {
  if (!isRecording || !dragStartElement) return;
  recordAction('drop', event.target, { dropSelector: getSelector(dragStartElement) });
  dragStartElement = null;
}

function handleChange(event) {
  if (!isRecording) return;
  if (event.target.tagName === 'SELECT') {
    recordAction('select', event.target, { value: event.target.value });
  } else if (event.target.type === 'file') {
    recordAction('fileUpload', event.target, { files: Array.from(event.target.files).map(file => ({ name: file.name, type: file.type })) });
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
      selector: getSelector(element),
      ...additionalData
    };
    chrome.runtime.sendMessage({ type: 'ACTION_RECORDED', action });
  } catch (error) {
    console.error('Error recording action:', error);
    chrome.runtime.sendMessage({ type: 'RECORD_ERROR', error: error.message });
  }
}

function getSelector(element) {
  if (element === window) {
    return { type: 'window', value: '' };
  }

  if (element.id) {
    return { type: 'css', value: `#${element.id}` };
  }

  let xpath = getXPath(element);
  if (isUniqueXPath(xpath)) {
    return { type: 'xpath', value: xpath };
  }

  // Try to find a unique CSS selector
  let cssSelector = getCssSelector(element);
  if (cssSelector && isUniqueCssSelector(cssSelector)) {
    return { type: 'css', value: cssSelector };
  }

  // Fallback to XPath if no unique CSS selector found
  return { type: 'xpath', value: xpath };
}

function isUniqueXPath(xpath) {
  return document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength === 1;
}

function isUniqueCssSelector(selector) {
  return document.querySelectorAll(selector).length === 1;
}

// Helper function to get XPath of an element
function getXPath(element) {
  if (element.id !== '') {
    return `//*[@id="${element.id}"]`;
  }

  if (element === document.body) {
    return '/html/body';
  }

  let ix = 0;
  const siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      return getXPath(element.parentNode) + '/' + element.tagName.toLowerCase() + '[' + (ix + 1) + ']';
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
}

// Helper function to generate a CSS selector for an element
function getCssSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const path = [];
  while (element.nodeType === Node.ELEMENT_NODE) {
    let selector = element.nodeName.toLowerCase();
    if (element.id) {
      selector += `#${element.id}`;
      path.unshift(selector);
      break;
    } else {
      let sibCount = 0;
      let sibIndex = 0;
      for (let i = 0; i < element.parentNode.childNodes.length; i++) {
        const sib = element.parentNode.childNodes[i];
        if (sib.nodeType === Node.ELEMENT_NODE) {
          sibCount++;
          if (sib === element) {
            sibIndex = sibCount;
          }
        }
      }
      if (sibCount > 1) {
        selector += `:nth-child(${sibIndex})`;
      }
    }
    path.unshift(selector);
    element = element.parentNode;
  }
  return path.join(' > ');
}
