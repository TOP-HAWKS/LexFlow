/**
 * LexFlow Service Worker
 * Handles context menus, notifications, and communication between content script and popup
 */

// Install event - setup context menus
chrome.runtime.onInstalled.addListener(() => {
  console.log('LexFlow extension installed');
  
  // Remove existing context menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Context menu for capturing selected text
    chrome.contextMenus.create({
      id: "lexflow_capture_selection",
      title: "LexFlow: Capturar texto selecionado",
      contexts: ["selection"]
    });
    
    // Context menu for capturing full page
    chrome.contextMenus.create({
      id: "lexflow_capture_fullpage", 
      title: "LexFlow: Capture full page",
      contexts: ["page"]
    });
  });
});

// Handle extension icon click - open in new tab
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "lexflow_capture_selection") {
      await chrome.tabs.sendMessage(tab.id, { 
        type: "LEXFLOW_GET_SELECTION",
        data: { mode: "selection" }
      });
    } else if (info.menuItemId === "lexflow_capture_fullpage") {
      await chrome.tabs.sendMessage(tab.id, { 
        type: "LEXFLOW_GET_FULLPAGE",
        data: { mode: "fullpage" }
      });
    }
  } catch (error) {
    console.error('Failed to send message to content script:', error);
    
    // Show error notification if content script is not available
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '/assets/icon-48.png',
      title: 'LexFlow Error',
      message: 'Could not capture content from this page. Try reloading the page.'
    });
  }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LEXFLOW_CAPTURE_PAYLOAD") {
    // Handle async operation
    (async () => {
      try {
        // Store captured content
        await storeCapturedContent(message.data);
        
        // Show success notification
        const modeText = message.data.mode === 'fullpage' ? 'full page' : 'selected text';
        const charCount = message.data.text ? message.data.text.length : 0;
        const notificationMessage = `Content captured (${modeText}${charCount > 0 ? `, ${charCount} chars` : ''})`;
        
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow',
          message: notificationMessage
        });
        
        sendResponse({ success: true, mode: message.data.mode, charCount });
      } catch (error) {
        console.error('Failed to store captured content:', error);
        
        chrome.notifications?.create({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow Error',
          message: 'Failed to save captured content'
        });
        
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true; // Keep message channel open for async response
  } 
  
  if (message?.type === "LEXFLOW_CAPTURE_ERROR") {
    // Show error notification
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '/assets/icon-48.png',
      title: 'LexFlow Error',
      message: message.error || 'Failed to capture content'
    });
    
    sendResponse({ success: false, error: message.error });
    return false; // Synchronous response
  }

  if (message?.type === "GET_CAPTURED_CONTENT") {
    (async () => {
      try {
        const content = await getCapturedContent();
        sendResponse({ success: true, data: content });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
  
  if (message?.type === "UPDATE_CAPTURED_CONTENT") {
    (async () => {
      try {
        await updateCapturedContent(message.itemId, message.updates);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

/**
 * Store captured content in Chrome storage
 * @param {Object} captureData - The captured content data
 */
async function storeCapturedContent(captureData) {
  try {
    // Get existing queue items
    const result = await chrome.storage.local.get(['lexflow_queue']);
    const queueItems = result.lexflow_queue || [];
    
    // Create new queue item
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      title: captureData.title || 'Captured Content',
      url: captureData.url,
      text: captureData.text,
      mode: captureData.mode,
      jurisdiction: captureData.jurisdiction || null,
      language: captureData.language || 'pt-BR',
      source_url: captureData.url,
      version_date: new Date().toISOString().split('T')[0],
      status: 'queued',
      metadata: {
        sourceHint: captureData.sourceHint || '',
        domain: captureData.domain || '',
        selectionLength: captureData.text?.length || 0
      }
    };
    
    // Add to queue (keep last 100 items)
    queueItems.unshift(newItem);
    if (queueItems.length > 100) {
      queueItems.splice(100);
    }
    
    // Save to storage
    await chrome.storage.local.set({ lexflow_queue: queueItems });
    
    console.log('Content stored successfully:', newItem.id);
  } catch (error) {
    console.error('Error storing captured content:', error);
    throw error;
  }
}

/**
 * Get captured content from storage
 * @returns {Array} Array of captured content items
 */
async function getCapturedContent() {
  try {
    const result = await chrome.storage.local.get(['lexflow_queue']);
    return result.lexflow_queue || [];
  } catch (error) {
    console.error('Error getting captured content:', error);
    return [];
  }
}

/**
 * Update captured content item
 * @param {number} itemId - Item ID to update
 * @param {Object} updates - Updates to apply
 */
async function updateCapturedContent(itemId, updates) {
  try {
    const result = await chrome.storage.local.get(['lexflow_queue']);
    const queueItems = result.lexflow_queue || [];
    
    const itemIndex = queueItems.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      queueItems[itemIndex] = { ...queueItems[itemIndex], ...updates };
      await chrome.storage.local.set({ lexflow_queue: queueItems });
    }
  } catch (error) {
    console.error('Error updating captured content:', error);
    throw error;
  }
}

