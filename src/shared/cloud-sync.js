/**
 * Cloud Sync Service (Supabase)
 * Free tier: 500MB DB, 2GB bandwidth, Auth, Realtime
 * 
 * Setup:
 * 1. Create project at supabase.com
 * 2. Run the SQL schema (see supabase/schema.sql)
 * 3. Copy project URL + anon key to settings
 */

const CloudSyncService = {
  client: null,

  /**
   * Initialize Supabase client
   * Uses lightweight REST calls (no SDK dependency needed)
   */
  init(url, anonKey) {
    this.url = url;
    this.anonKey = anonKey;
    this.enabled = !!url && !!anonKey;
    return this.enabled;
  },

  /**
   * Generic REST request to Supabase
   */
  async request(table, method = 'GET', body = null, params = '') {
    if (!this.enabled) throw new Error('Cloud sync not configured');

    const headers = {
      'apikey': this.anonKey,
      'Authorization': `Bearer ${this.anonKey}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    };

    const url = `${this.url}/rest/v1/${table}${params}`;
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Supabase ${response.status}: ${error}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  },

  /**
   * Save document metadata
   */
  async saveDocument(doc) {
    const existing = await this.request('documents', 'GET', null,
      `?google_doc_id=eq.${doc.google_doc_id}&select=id`);

    if (existing && existing.length > 0) {
      return this.request('documents', 'PATCH', { updated_at: new Date().toISOString() },
        `?id=eq.${existing[0].id}`);
    }

    return this.request('documents', 'POST', {
      google_doc_id: doc.google_doc_id,
      title: doc.title,
      url: doc.url,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  },

  /**
   * Save revision snapshot
   */
  async saveRevision(revision) {
    return this.request('revisions', 'POST', revision);
  },

  /**
   * Save editing session
   */
  async saveSession(session) {
    return this.request('sessions', 'POST', session);
  },

  /**
   * Save AI analysis result
   */
  async saveAnalysis(analysis) {
    return this.request('ai_analysis', 'POST', analysis);
  },

  /**
   * Get document history
   */
  async getDocumentHistory(docId) {
    return this.request('revisions', 'GET', null,
      `?document_id=eq.${docId}&order=timestamp.asc`);
  },

  /**
   * Get all sessions for document
   */
  async getSessions(docId) {
    return this.request('sessions', 'GET', null,
      `?document_id=eq.${docId}&order=start_time.desc`);
  },

  /**
   * Batch sync local data to cloud
   */
  async syncBatch({ documents = [], revisions = [], sessions = [], analyses = [] }) {
    const results = { synced: 0, failed: 0 };

    for (const doc of documents) {
      try {
        await this.saveDocument(doc);
        results.synced++;
      } catch (err) {
        console.warn('Sync failed for document:', err.message);
        results.failed++;
      }
    }

    return results;
  },

  /**
   * Subscribe to realtime changes (requires supabase-js SDK)
   * This is a stub - full implementation needs the SDK
   */
  subscribeToChanges(table, filter, callback) {
    // Implementation would use Supabase Realtime WebSocket
    // For prototype, use polling fallback
    console.log(`Subscribing to ${table} with filter ${filter}`);
    return {
      unsubscribe: () => console.log('Unsubscribed')
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CloudSyncService };
}
