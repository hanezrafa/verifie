/**
 * Verifie Shared Configuration & Storage
 * Idempotent — safe to load multiple times (avoids "already declared" errors)
 */
(function (global) {
  'use strict';

  if (global.VERIFIE_CONFIG) return; // already loaded

  const VERIFIE_CONFIG = {
    endpoints: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      huggingFaceToken: '',
      workerUrl: ''
    },
    features: {
      cloudSync: false,
      aiDetectionRemote: false,
      realtimeTracking: false,
      googleDocsApi: false
    },
    defaults: {
      trackingEnabled: true,
      trackingInterval: 2000,
      aiDetectionMode: 'local',
      theme: 'blue',
      exportFormat: 'json'
    }
  };

  const VerifieStorage = {
    isExtension() {
      return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    },

    async get(keys) {
      if (this.isExtension()) {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.get(keys, resolve);
          } catch {
            resolve({});
          }
        });
      }
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
          try {
            chrome.storage.local.set(data, resolve);
          } catch {
            resolve();
          }
        });
      }
      Object.entries(data).forEach(([key, value]) => {
        localStorage.setItem(`verifie_${key}`, JSON.stringify(value));
      });
    },

    async remove(keys) {
      if (this.isExtension()) {
        return new Promise((resolve) => {
          try {
            chrome.storage.local.remove(keys, resolve);
          } catch {
            resolve();
          }
        });
      }
      const keyList = Array.isArray(keys) ? keys : [keys];
      keyList.forEach(key => localStorage.removeItem(`verifie_${key}`));
    }
  };

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

  global.VERIFIE_CONFIG = VERIFIE_CONFIG;
  global.VerifieStorage = VerifieStorage;
  global.VerifieSettings = VerifieSettings;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VERIFIE_CONFIG, VerifieStorage, VerifieSettings };
  }
})(typeof window !== 'undefined' ? window : self);
