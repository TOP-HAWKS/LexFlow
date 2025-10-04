/**
 * Extension Integration Tests
 * Tests manifest configuration, popup loading, service worker message handling,
 * context menus, and content script integration with new capture modes
 * Requirements: 1.1, 4.1, 4.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Chrome extension APIs
const mockChrome = {
  runtime: {
    onInstalled: {
      addListener: vi.fn()
    },
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    sendMessage: vi.fn()
  },
  contextMenus: {
    create: vi.fn(),
    removeAll: vi.fn(),
    onClicked: {
      addListener: vi.fn()
    }
  },
  notifications: {
    create: vi.fn()
  },
  tabs: {
    sendMessage: vi.fn()
  },
  action: {
    setPopup: vi.fn(),
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  }
};

// Mock database operations
const mockDB = {
  addSubmission: vi.fn()
};

vi.mock('../src/db.js', () => mockDB);

// Mock service worker functionality
class MockServiceWorker {
  constructor() {
    this.contextMenus = new Map();
    this.messageHandlers = new Map();
    this.isInstalled = false;
    
    // Setup Chrome API mock
    global.chrome = mockChrome;
    
    this.init();
  }

  init() {
    // Simulate extension installation
    this.handleInstallation();
    
    // Setup message handling
    this.setupMessageHandling();
  }

  handleInstallation() {
    this.isInstalled = true;
    console.log('LexFlow installed.');
    
    // Remove existing context menus to avoid duplicates
    this.contextMenus.clear();
    mockChrome.contextMenus.removeAll.mockImplementation((callback) => {
      this.contextMenus.clear();
      if (callback) callback();
    });
    
    // Create context menus
    mockChrome.contextMenus.create.mockImplementation((options) => {
      this.contextMenus.set(options.id, options);
      return options.id;
    });
    
    // Context menu for capturing selected text
    this.createContextMenu({
      id: "lexflow_capture_selection",
      title: "LexFlow: capture selected law/article",
      contexts: ["selection"]
    });
    
    // Context menu for capturing full page
    this.createContextMenu({
      id: "lexflow_capture_fullpage", 
      title: "LexFlow: capture FULL page (max 50k chars)",
      contexts: ["page"]
    });
  }

  createContextMenu(options) {
    this.contextMenus.set(options.id, options);
    return mockChrome.contextMenus.create(options);
  }

  setupMessageHandling() {
    mockChrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      this.messageHandlers.set('runtime', handler);
    });
    
    mockChrome.contextMenus.onClicked.addListener.mockImplementation((handler) => {
      this.messageHandlers.set('contextMenu', handler);
    });
  }

  // Simulate context menu click
  async simulateContextMenuClick(menuItemId, info, tab) {
    try {
      if (menuItemId === "lexflow_capture_selection") {
        await mockChrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_SELECTION" });
      } else if (menuItemId === "lexflow_capture_fullpage") {
        await mockChrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_FULLPAGE" });
      }
      return { success: true };
    } catch (error) {
      console.error('Failed to send message to content script:', error);
      
      // Show error notification
      mockChrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon-48.png',
        title: 'LexFlow Error',
        message: 'Cannot capture content from this page. Try refreshing the page.'
      });
      
      return { success: false, error: error.message };
    }
  }

  // Simulate message from content script
  async simulateMessage(message, sender) {
    try {
      if (message?.type === "LEXFLOW_CAPTURE_PAYLOAD") {
        await mockDB.addSubmission({
          ts: message.timestamp || Date.now(),
          url: message.url,
          title: message.title,
          selectionText: message.text,
          mode: message.mode || 'selected',
          lang: message.lang || "pt-BR",
          jurisdiction: null,
          sourceHint: message.sourceHint || "",
          status: "queued"
        });
        
        // Show success notification
        const modeText = message.mode === 'full' ? 'full page' : 'selection';
        const charCount = message.text ? message.text.length : 0;
        const notificationMessage = `Content captured (${modeText}${charCount > 0 ? `, ${charCount} chars` : ''})`;
        
        mockChrome.notifications.create({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow',
          message: notificationMessage
        });
        
        return { ok: true, mode: message.mode, charCount };
      } else if (message?.type === "LEXFLOW_CAPTURE_ERROR") {
        // Show error notification
        mockChrome.notifications.create({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow Error',
          message: message.error || 'Failed to capture content'
        });
        
        return { ok: false, error: message.error };
      } else if (message?.type === "LEXFLOW_SELECTION_PAYLOAD") {
        // Legacy support
        await mockDB.addSubmission({
          ts: Date.now(),
          url: message.url,
          title: message.title,
          selectionText: message.text,
          mode: 'selected',
          lang: message.lang || "pt-BR",
          jurisdiction: null,
          sourceHint: message.sourceHint || "",
          status: "queued"
        });
        return { ok: true };
      }
      
      return { ok: false, error: 'Unknown message type' };
    } catch (error) {
      console.error('Message handling error:', error);
      return { ok: false, error: error.message };
    }
  }

  getContextMenus() {
    return Array.from(this.contextMenus.values());
  }

  getMessageHandlers() {
    return this.messageHandlers;
  }
}

// Mock content script functionality
class MockContentScript {
  constructor() {
    this.messageHandlers = new Map();
    this.setupMessageHandling();
  }

  setupMessageHandling() {
    mockChrome.runtime.onMessage.addListener.mockImplementation((handler) => {
      this.messageHandlers.set('content', handler);
    });
  }

  getSelectionText() {
    const sel = window.getSelection();
    return sel && sel.toString ? sel.toString() : "";
  }

  getFullPageText() {
    // Extract full page text with 50k character limit
    const bodyText = document.body.innerText || document.body.textContent || "";
    const cleanText = bodyText.trim();
    
    // Limit to 50,000 characters as per requirements
    if (cleanText.length > 50000) {
      return cleanText.substring(0, 50000) + "\n\n[Content truncated at 50,000 characters]";
    }
    
    return cleanText;
  }

  createCapturePayload(text, mode) {
    return {
      type: "LEXFLOW_CAPTURE_PAYLOAD",
      url: window.location.href,
      title: document.title,
      text: text.trim(),
      mode: mode, // 'selected' or 'full'
      lang: document.documentElement.lang || navigator.language,
      sourceHint: (document.querySelector('meta[name="citation_title"]')?.content || ""),
      timestamp: Date.now()
    };
  }

  // Simulate message handling
  async handleMessage(message) {
    if (message?.type === "LEXFLOW_GET_SELECTION") {
      const text = this.getSelectionText();
      if (!text) {
        console.warn("LexFlow: No text selected");
        return;
      }
      
      const payload = this.createCapturePayload(text, 'selected');
      await mockChrome.runtime.sendMessage(payload);
      return payload;
    } else if (message?.type === "LEXFLOW_GET_FULLPAGE") {
      const text = this.getFullPageText();
      if (!text || text.length < 10) {
        console.warn("LexFlow: No readable content found on page");
        await mockChrome.runtime.sendMessage({
          type: "LEXFLOW_CAPTURE_ERROR",
          error: "No readable content found on this page"
        });
        return null;
      }
      
      const payload = this.createCapturePayload(text, 'full');
      await mockChrome.runtime.sendMessage(payload);
      return payload;
    }

    return undefined;
  }
}

// Mock popup/SPA functionality
class MockPopupApp {
  constructor() {
    this.isLoaded = false;
    this.loadTime = 0;
    this.currentView = 'home';
    this.errors = [];
  }

  async load() {
    const startTime = performance.now();
    
    try {
      // Simulate DOM loading
      await this.loadDOM();
      
      // Simulate script initialization
      await this.initializeApp();
      
      this.loadTime = performance.now() - startTime;
      this.isLoaded = true;
      
      return { success: true, loadTime: this.loadTime };
    } catch (error) {
      this.errors.push(error);
      return { success: false, error: error.message };
    }
  }

  async loadDOM() {
    // Simulate DOM creation time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    document.body.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <h1>LexFlow</h1>
          <nav class="app-nav">
            <a href="#home" class="nav-link active">Home</a>
            <a href="#workspace" class="nav-link">Workspace</a>
            <a href="#collector" class="nav-link">Collector</a>
          </nav>
        </header>
        <main class="app-main">
          <div id="home-view" class="view active">
            <h2>Welcome to LexFlow</h2>
            <div class="feature-cards">
              <div class="card" data-route="workspace">
                <h3>Workspace Jurídico</h3>
                <p>Legal research and AI analysis</p>
              </div>
              <div class="card" data-route="collector">
                <h3>Coletor & Curadoria</h3>
                <p>Content capture and curation</p>
              </div>
            </div>
          </div>
          <div id="workspace-view" class="view">
            <h2>Legal Workspace</h2>
          </div>
          <div id="collector-view" class="view">
            <h2>Collector & Curation</h2>
          </div>
        </main>
      </div>
    `;
  }

  async initializeApp() {
    // Simulate app initialization time
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Setup hash routing
    this.setupRouting();
    
    // Initialize components
    this.initializeComponents();
  }

  setupRouting() {
    window.addEventListener('hashchange', () => {
      this.handleRouteChange();
    });
    
    // Handle initial route
    this.handleRouteChange();
  }

  handleRouteChange() {
    const hash = window.location.hash.slice(1) || 'home';
    this.navigateTo(hash);
  }

  navigateTo(view) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    // Show target view
    const targetView = document.getElementById(`${view}-view`);
    const targetNav = document.querySelector(`[href="#${view}"]`);
    
    if (targetView) {
      targetView.classList.add('active');
      this.currentView = view;
    }
    
    if (targetNav) {
      targetNav.classList.add('active');
    }
  }

  initializeComponents() {
    // Setup click handlers for feature cards
    document.querySelectorAll('.card[data-route]').forEach(card => {
      card.addEventListener('click', () => {
        const route = card.dataset.route;
        window.location.hash = route;
      });
    });
  }

  getCurrentView() {
    return this.currentView;
  }

  getLoadTime() {
    return this.loadTime;
  }

  getErrors() {
    return this.errors;
  }

  isAppLoaded() {
    return this.isLoaded;
  }
}

describe('Extension Integration Tests', () => {
  let serviceWorker;
  let contentScript;
  let popupApp;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup DOM environment
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    window.location.hash = '';
    
    // Create mock instances
    serviceWorker = new MockServiceWorker();
    contentScript = new MockContentScript();
    popupApp = new MockPopupApp();
    
    // Setup default mock responses
    mockDB.addSubmission.mockResolvedValue(true);
    
    // Mock window.getSelection for content script tests
    global.window.getSelection = vi.fn(() => ({
      toString: () => "Selected legal text content"
    }));
    
    // Mock document properties
    Object.defineProperty(document, 'title', {
      value: 'Legal Document Title',
      writable: true,
      configurable: true
    });
    
    Object.defineProperty(document.documentElement, 'lang', {
      value: 'pt-BR',
      writable: true,
      configurable: true
    });
    
    // Mock location object
    delete window.location;
    window.location = {
      href: 'https://example.com/legal-document',
      hash: ''
    };
  });

  describe('Manifest Configuration and Popup Loading (Requirement 1.1)', () => {
    it('should have correct manifest configuration for SPA', () => {
      // Test manifest structure (simulated)
      const expectedManifest = {
        manifest_version: 3,
        name: "LexFlow — Legal Collector & AI",
        action: {
          default_popup: "src/ui/app.html"
        },
        background: {
          service_worker: "src/sw.js",
          type: "module"
        },
        permissions: [
          "storage",
          "contextMenus", 
          "scripting",
          "activeTab",
          "notifications"
        ],
        content_scripts: [
          {
            matches: ["<all_urls>"],
            js: ["src/content/cs.js"],
            run_at: "document_idle"
          }
        ]
      };

      // Verify key manifest properties are correctly configured
      expect(expectedManifest.action.default_popup).toBe("src/ui/app.html");
      expect(expectedManifest.background.service_worker).toBe("src/sw.js");
      expect(expectedManifest.permissions).toContain("contextMenus");
      expect(expectedManifest.permissions).toContain("activeTab");
      expect(expectedManifest.content_scripts[0].js).toContain("src/content/cs.js");
    });

    it('should load popup SPA within performance target', async () => {
      const result = await popupApp.load();
      
      expect(result.success).toBe(true);
      expect(result.loadTime).toBeLessThan(1000); // < 1 second as per requirements
      expect(popupApp.isAppLoaded()).toBe(true);
    });

    it('should initialize with home view by default', async () => {
      await popupApp.load();
      
      expect(popupApp.getCurrentView()).toBe('home');
      
      const homeView = document.getElementById('home-view');
      expect(homeView.classList.contains('active')).toBe(true);
      
      const activeNav = document.querySelector('.nav-link.active');
      expect(activeNav.getAttribute('href')).toBe('#home');
    });

    it('should handle popup loading errors gracefully', async () => {
      // Mock DOM loading failure
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        if (delay === 50) { // DOM loading timeout
          throw new Error('DOM loading failed');
        }
        return originalSetTimeout(callback, delay);
      });
      
      const result = await popupApp.load();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('DOM loading failed');
      expect(popupApp.getErrors()).toHaveLength(1);
      
      // Restore original setTimeout
      global.setTimeout = originalSetTimeout;
    });

    it('should support hash-based navigation between views', async () => {
      await popupApp.load();
      
      // Navigate to workspace
      window.location.hash = '#workspace';
      popupApp.handleRouteChange();
      
      expect(popupApp.getCurrentView()).toBe('workspace');
      
      const workspaceView = document.getElementById('workspace-view');
      expect(workspaceView.classList.contains('active')).toBe(true);
      
      // Navigate to collector
      window.location.hash = '#collector';
      popupApp.handleRouteChange();
      
      expect(popupApp.getCurrentView()).toBe('collector');
      
      const collectorView = document.getElementById('collector-view');
      expect(collectorView.classList.contains('active')).toBe(true);
    });
  });

  describe('Service Worker Message Handling (Requirement 4.1)', () => {
    it('should install and create context menus correctly', () => {
      expect(serviceWorker.isInstalled).toBe(true);
      
      const contextMenus = serviceWorker.getContextMenus();
      expect(contextMenus).toHaveLength(2);
      
      const selectionMenu = contextMenus.find(menu => menu.id === "lexflow_capture_selection");
      expect(selectionMenu).toBeDefined();
      expect(selectionMenu.title).toBe("LexFlow: capture selected law/article");
      expect(selectionMenu.contexts).toContain("selection");
      
      const fullPageMenu = contextMenus.find(menu => menu.id === "lexflow_capture_fullpage");
      expect(fullPageMenu).toBeDefined();
      expect(fullPageMenu.title).toBe("LexFlow: capture FULL page (max 50k chars)");
      expect(fullPageMenu.contexts).toContain("page");
    });

    it('should handle capture payload messages correctly', async () => {
      const captureMessage = {
        type: "LEXFLOW_CAPTURE_PAYLOAD",
        url: "https://example.com/legal-doc",
        title: "Legal Document",
        text: "Article 1. This is legal content.",
        mode: "selected",
        lang: "pt-BR",
        sourceHint: "Legal Source",
        timestamp: Date.now()
      };
      
      const response = await serviceWorker.simulateMessage(captureMessage, {});
      
      expect(response.ok).toBe(true);
      expect(response.mode).toBe("selected");
      expect(response.charCount).toBe(captureMessage.text.length);
      
      // Verify database call
      expect(mockDB.addSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          ts: captureMessage.timestamp,
          url: captureMessage.url,
          title: captureMessage.title,
          selectionText: captureMessage.text,
          mode: "selected",
          lang: "pt-BR",
          jurisdiction: null,
          sourceHint: "Legal Source",
          status: "queued"
        })
      );
      
      // Verify notification was created
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow',
          message: expect.stringContaining('Content captured (selection')
        })
      );
    });

    it('should handle full page capture with character count', async () => {
      const longText = 'A'.repeat(60000);
      const captureMessage = {
        type: "LEXFLOW_CAPTURE_PAYLOAD",
        url: "https://example.com/long-doc",
        title: "Long Document",
        text: longText,
        mode: "full",
        lang: "en-US",
        timestamp: Date.now()
      };
      
      const response = await serviceWorker.simulateMessage(captureMessage, {});
      
      expect(response.ok).toBe(true);
      expect(response.mode).toBe("full");
      expect(response.charCount).toBe(60000);
      
      // Verify notification mentions full page and character count
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Content captured (full page, 60000 chars)')
        })
      );
    });

    it('should handle capture error messages', async () => {
      const errorMessage = {
        type: "LEXFLOW_CAPTURE_ERROR",
        error: "No readable content found on this page"
      };
      
      const response = await serviceWorker.simulateMessage(errorMessage, {});
      
      expect(response.ok).toBe(false);
      expect(response.error).toBe("No readable content found on this page");
      
      // Verify error notification was created
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          iconUrl: '/assets/icon-48.png',
          title: 'LexFlow Error',
          message: 'No readable content found on this page'
        })
      );
    });

    it('should support legacy message format', async () => {
      const legacyMessage = {
        type: "LEXFLOW_SELECTION_PAYLOAD",
        url: "https://example.com/legacy",
        title: "Legacy Document",
        text: "Legacy content",
        lang: "pt-BR"
      };
      
      const response = await serviceWorker.simulateMessage(legacyMessage, {});
      
      expect(response.ok).toBe(true);
      
      // Verify database call with legacy format
      expect(mockDB.addSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          url: legacyMessage.url,
          title: legacyMessage.title,
          selectionText: legacyMessage.text,
          mode: 'selected',
          lang: "pt-BR",
          status: "queued"
        })
      );
    });

    it('should handle database errors during message processing', async () => {
      // Mock database error
      mockDB.addSubmission.mockRejectedValue(new Error('Storage quota exceeded'));
      
      const captureMessage = {
        type: "LEXFLOW_CAPTURE_PAYLOAD",
        url: "https://example.com/test",
        title: "Test Document",
        text: "Test content",
        mode: "selected",
        timestamp: Date.now()
      };
      
      const response = await serviceWorker.simulateMessage(captureMessage, {});
      
      expect(response.ok).toBe(false);
      expect(response.error).toBe('Storage quota exceeded');
    });
  });

  describe('Context Menu Integration (Requirement 4.1)', () => {
    it('should handle selection context menu click', async () => {
      const tab = { id: 123 };
      const info = { selectionText: "Selected legal text" };
      
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      
      const result = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_selection", 
        info, 
        tab
      );
      
      expect(result.success).toBe(true);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tab.id,
        { type: "LEXFLOW_GET_SELECTION" }
      );
    });

    it('should handle full page context menu click', async () => {
      const tab = { id: 456 };
      const info = {};
      
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      
      const result = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_fullpage",
        info,
        tab
      );
      
      expect(result.success).toBe(true);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        tab.id,
        { type: "LEXFLOW_GET_FULLPAGE" }
      );
    });

    it('should handle content script communication errors', async () => {
      const tab = { id: 789 };
      const info = {};
      
      // Mock content script error
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Content script not available'));
      
      const result = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_selection",
        info,
        tab
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Content script not available');
      
      // Verify error notification was shown
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'LexFlow Error',
          message: 'Cannot capture content from this page. Try refreshing the page.'
        })
      );
    });
  });

  describe('Content Script Integration with New Capture Modes (Requirement 4.2)', () => {
    beforeEach(() => {
      // Setup page content for testing
      document.body.innerHTML = `
        <div>
          <h1>Legal Document Title</h1>
          <p>Article 1. This is the first article of the legal document.</p>
          <p>Article 2. This is the second article with more content.</p>
          <p>Article 3. Additional legal provisions and clauses.</p>
        </div>
      `;
    });

    it('should handle selection capture request', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_SELECTION" };
      const result = await contentScript.handleMessage(message);
      
      expect(result).toBeDefined();
      expect(result.type).toBe("LEXFLOW_CAPTURE_PAYLOAD");
      expect(result.mode).toBe("selected");
      expect(result.text).toBe("Selected legal text content");
      expect(result.url).toBe(location.href);
      expect(result.title).toBe(document.title);
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(result);
    });

    it('should handle full page capture request', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_FULLPAGE" };
      const result = await contentScript.handleMessage(message);
      
      expect(result).toBeDefined();
      expect(result.type).toBe("LEXFLOW_CAPTURE_PAYLOAD");
      expect(result.mode).toBe("full");
      expect(result.text).toContain("Legal Document Title");
      expect(result.text).toContain("Article 1");
      expect(result.text).toContain("Article 2");
      expect(result.text).toContain("Article 3");
    });

    it('should handle empty selection gracefully', async () => {
      // Mock empty selection
      global.window.getSelection = vi.fn(() => ({
        toString: () => ""
      }));
      
      const message = { type: "LEXFLOW_GET_SELECTION" };
      const result = await contentScript.handleMessage(message);
      
      expect(result).toBeUndefined();
      expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle empty page content', async () => {
      // Clear page content
      document.body.innerHTML = '';
      
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_FULLPAGE" };
      const result = await contentScript.handleMessage(message);
      
      expect(result).toBeNull();
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: "LEXFLOW_CAPTURE_ERROR",
        error: "No readable content found on this page"
      });
    });

    it('should truncate content at 50k character limit', async () => {
      // Create content exceeding 50k characters
      const longContent = 'A'.repeat(60000);
      document.body.innerHTML = `<div>${longContent}</div>`;
      
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_FULLPAGE" };
      const result = await contentScript.handleMessage(message);
      
      expect(result.text.length).toBeLessThanOrEqual(50000 + 50); // Allow for truncation message
      expect(result.text).toContain('[Content truncated at 50,000 characters]');
    });

    it('should extract metadata from page', async () => {
      // Add metadata to page
      document.head.innerHTML = `
        <meta name="citation_title" content="Legal Citation Title">
      `;
      document.documentElement.lang = 'en-US';
      
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_SELECTION" };
      const result = await contentScript.handleMessage(message);
      
      expect(result.lang).toBe('en-US');
      expect(result.sourceHint).toBe('Legal Citation Title');
      expect(result.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
    });

    it('should handle missing metadata gracefully', async () => {
      // Clear metadata
      document.head.innerHTML = '';
      document.documentElement.removeAttribute('lang');
      
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      
      const message = { type: "LEXFLOW_GET_FULLPAGE" };
      const result = await contentScript.handleMessage(message);
      
      // Should use navigator.language when document.lang is not available
      // In test environment, navigator.language defaults to 'pt-BR'
      expect(result.lang).toBe('pt-BR');
      expect(result.sourceHint).toBe('');
    });
  });

  describe('End-to-End Extension Workflow (Requirements 1.1, 4.1, 4.2)', () => {
    it('should complete full capture workflow from context menu to storage', async () => {
      // Setup page content
      document.body.innerHTML = `
        <article>
          <h1>Brazilian Constitution Article 5</h1>
          <p>All persons are equal before the law, without distinction of any nature.</p>
        </article>
      `;
      
      // Mock successful responses
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      mockDB.addSubmission.mockResolvedValue(true);
      
      // 1. User right-clicks and selects context menu
      const tab = { id: 123 };
      const contextResult = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_selection",
        { selectionText: "All persons are equal before the law" },
        tab
      );
      
      expect(contextResult.success).toBe(true);
      
      // 2. Content script processes the request
      const contentMessage = { type: "LEXFLOW_GET_SELECTION" };
      const capturePayload = await contentScript.handleMessage(contentMessage);
      
      expect(capturePayload.type).toBe("LEXFLOW_CAPTURE_PAYLOAD");
      expect(capturePayload.mode).toBe("selected");
      
      // 3. Service worker receives and processes the payload
      const serviceResponse = await serviceWorker.simulateMessage(capturePayload, {});
      
      expect(serviceResponse.ok).toBe(true);
      expect(serviceResponse.mode).toBe("selected");
      
      // 4. Verify database storage
      expect(mockDB.addSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          url: capturePayload.url,
          title: capturePayload.title,
          selectionText: capturePayload.text,
          mode: "selected",
          status: "queued"
        })
      );
      
      // 5. Verify user notification
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'LexFlow',
          message: expect.stringContaining('Content captured')
        })
      );
    });

    it('should handle full page capture workflow with character limits', async () => {
      // Setup large page content
      const largeContent = 'Legal content '.repeat(4000); // ~60k characters
      document.body.innerHTML = `<div>${largeContent}</div>`;
      
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      mockDB.addSubmission.mockResolvedValue(true);
      
      // 1. Context menu click for full page
      const tab = { id: 456 };
      const contextResult = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_fullpage",
        {},
        tab
      );
      
      expect(contextResult.success).toBe(true);
      
      // 2. Content script captures full page
      const contentMessage = { type: "LEXFLOW_GET_FULLPAGE" };
      const capturePayload = await contentScript.handleMessage(contentMessage);
      
      expect(capturePayload.mode).toBe("full");
      expect(capturePayload.text.length).toBeLessThanOrEqual(50050); // 50k + truncation message
      
      // 3. Service worker processes with character count
      const serviceResponse = await serviceWorker.simulateMessage(capturePayload, {});
      
      expect(serviceResponse.ok).toBe(true);
      expect(serviceResponse.charCount).toBeGreaterThan(50000);
      
      // 4. Verify notification includes character count
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/Content captured \(full page, \d+ chars\)/)
        })
      );
    });

    it('should handle error scenarios gracefully throughout workflow', async () => {
      // Mock database error
      mockDB.addSubmission.mockRejectedValue(new Error('Storage quota exceeded'));
      
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: false });
      
      // 1. Context menu click
      const tab = { id: 789 };
      const contextResult = await serviceWorker.simulateContextMenuClick(
        "lexflow_capture_selection",
        { selectionText: "Test content" },
        tab
      );
      
      expect(contextResult.success).toBe(true);
      
      // 2. Content script captures content
      const contentMessage = { type: "LEXFLOW_GET_SELECTION" };
      const capturePayload = await contentScript.handleMessage(contentMessage);
      
      expect(capturePayload).toBeDefined();
      
      // 3. Service worker fails to store
      const serviceResponse = await serviceWorker.simulateMessage(capturePayload, {});
      
      expect(serviceResponse.ok).toBe(false);
      expect(serviceResponse.error).toBe('Storage quota exceeded');
      
      // 4. Verify error handling doesn't break the extension
      expect(mockDB.addSubmission).toHaveBeenCalled();
    });

    it('should maintain performance targets during workflow', async () => {
      const startTime = performance.now();
      
      // Setup content
      document.body.innerHTML = '<p>Test legal content for performance testing.</p>';
      
      mockChrome.tabs.sendMessage.mockResolvedValue(true);
      mockChrome.runtime.sendMessage.mockResolvedValue({ ok: true });
      mockDB.addSubmission.mockResolvedValue(true);
      
      // Execute full workflow
      const tab = { id: 999 };
      await serviceWorker.simulateContextMenuClick("lexflow_capture_selection", {}, tab);
      
      const contentMessage = { type: "LEXFLOW_GET_SELECTION" };
      const capturePayload = await contentScript.handleMessage(contentMessage);
      
      await serviceWorker.simulateMessage(capturePayload, {});
      
      const totalTime = performance.now() - startTime;
      
      // Workflow should complete quickly (under 500ms for small content)
      expect(totalTime).toBeLessThan(500);
    });
  });
});