/**
 * Test setup file for Vitest
 * Configures global test environment and mocks
 */

import { vi } from 'vitest';

function createStorageMock() {
  const store = new Map();

  const storage = {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index) => {
      const keys = Array.from(store.keys());
      return keys[index] ?? null;
    }),
    _store: store
  };

  Object.defineProperty(storage, 'length', {
    get() {
      return store.size;
    }
  });

  return storage;
}

// Mock Chrome extension APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

// Mock IndexedDB
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn()
};

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now()),
  mark: vi.fn(),
  measure: vi.fn(),
  memory: {
    usedJSHeapSize: 1000000,
    jsHeapSizeLimit: 10000000
  }
};

// Mock navigator
Object.defineProperty(global.navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock localStorage
const localStorageMock = createStorageMock();
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = createStorageMock();
global.sessionStorage = sessionStorageMock;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

// Setup DOM environment
beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Reset all mocks
  vi.clearAllMocks();
  localStorageMock._store.clear();
  sessionStorageMock._store.clear();
  
  // Reset location hash
  window.location.hash = '';
});
