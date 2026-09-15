/**
 * Verifie Shared Configuration & Storage
 * Manages extension settings, API keys, and data persistence
 */

const VERIFIE_CONFIG = {
  // API endpoints (configurable)
  endpoints: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    huggingFaceToken: '',
    workerUrl: ''
  },

  // Feature flags
  features: {
    cloudSync: false,
    aiDetectionRemote: false,
    realtimeTracking: false,
    googleDocsApi: false
  },

  // Default settings
  defaults: {
    trackingEnabled: true,
    trackingInterval: 2000,
    aiDetectionMode: 'local', // 'local' | 'remote'
    theme: 'blue',
    exportFormat: 'json'
  }
};

/**
 * Storage wrapper with fallback to localStorage for web dashboard
 */
const VerifieStorage = {
  isExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  async get(keys) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
      });
    }
    // Web fallback
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(key => {
      const val = localStorage.getItem(`verifie_${key}`);
      if (val !== null) {
        try { result[key] = JSON.parse(val); } catch { result[key] = val; }
      }
    });
    return result;
  },

  async set(data) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.set(data, resolve);
      });
    }
    // Web fallback
    Object.entries(data).forEach(([key, value]) => {
      localStorage.setItem(`verifie_${key}`, JSON.stringify(value));
    });
  },

  async remove(keys) {
    if (this.isExtension()) {
      return new Promise((resolve) => {
        chrome.storage.local.remove(keys, resolve);
      });
    }
    const keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(key => localStorage.removeItem(`verifie_${key}`));
  }
};

/**
 * Settings Manager
 */
const VerifieSettings = {
  async load() {
    const stored = await VerifieStorage.get(['settings']);
    return { ...VERIFIE_CONFIG.defaults, ...(stored.settings || {}) };
  },

  async save(settings) {
    await VerifieStorage.set({ settings });
    return settings;
  },

  async getEndpoints() {
    const stored = await VerifieStorage.get(['endpoints']);
    return { ...VERIFIE_CONFIG.endpoints, ...(stored.endpoints || {}) };
  },

  async saveEndpoints(endpoints) {
    await VerifieStorage.set({ endpoints });
    return endpoints;
  },

  async getFeatures() {
    const endpoints = await this.getEndpoints();
    return {
      cloudSync: !!endpoints.supabaseUrl,
      aiDetectionRemote: !!endpoints.huggingFaceToken,
      googleDocsApi: !!endpoints.workerUrl,
      realtimeTracking: !!endpoints.supabaseUrl
    };
  }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VERIFIE_CONFIG, VerifieStorage, VerifieSettings };
}
