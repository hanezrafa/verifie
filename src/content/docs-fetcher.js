/**
 * Google Docs Text Fetcher
 * Fetches the REAL document text using Google's export endpoint.
 *
 * Why: Modern Google Docs renders text on <canvas>, so the DOM contains
 * no readable text. The export endpoint returns the actual plain text.
 *
 * Endpoint: https://docs.google.com/document/d/{ID}/export?format=txt
 * - Same-origin when called from a docs.google.com content script
 * - Uses the user's existing cookies (no OAuth needed)
 *
 * Idempotent.
 */
(function (global) {
  'use strict';

  if (global.GoogleDocsTextFetcher) return;

  const GoogleDocsTextFetcher = {
    lastFetch: 0,
    lastText: '',
    minInterval: 3000, // don't hammer the endpoint
    inflight: false,

    getDocumentId(url) {
      const m = (url || window.location.href).match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
      return m ? m[1] : null;
    },

    /**
     * Fetch plain text of the document.
     * Returns { text, ok, error }
     */
    async fetch(force = false) {
      const docId = this.getDocumentId();
      if (!docId) return { text: '', ok: false, error: 'no-doc-id' };

      const now = Date.now();
      if (!force && (now - this.lastFetch) < this.minInterval) {
        return { text: this.lastText, ok: !!this.lastText, cached: true };
      }
      if (this.inflight) return { text: this.lastText, ok: !!this.lastText, inflight: true };

      this.inflight = true;
      try {
        const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
        const res = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'text/plain' }
        });

        if (!res.ok) {
          this.inflight = false;
          return { text: this.lastText, ok: false, error: `http-${res.status}` };
        }

        const text = await res.text();
        this.lastFetch = now;
        this.lastText = text;
        this.inflight = false;
        return { text, ok: true };
      } catch (e) {
        this.inflight = false;
        return { text: this.lastText, ok: false, error: e.message };
      }
    }
  };

  global.GoogleDocsTextFetcher = GoogleDocsTextFetcher;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GoogleDocsTextFetcher };
  }
})(typeof window !== 'undefined' ? window : self);
