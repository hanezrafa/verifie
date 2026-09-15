/**
 * Google Docs API Service Layer
 * Handles authentication and document/revision fetching
 * 
 * Free tier limits:
 * - 60 requests/minute/user
 * - 1,000,000 requests/day
 * 
 * Setup:
 * 1. Create project at console.cloud.google.com
 * 2. Enable Google Docs API + Google Drive API
 * 3. Create OAuth 2.0 credentials
 * 4. Add redirect URI: https://<extension-id>.chromiumapp.org/
 */

const GoogleDocsService = {
  SCOPES: [
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.metadata.readonly'
  ],

  CLIENT_ID: '', // Set via settings
  API_BASE: 'https://docs.googleapis.com/v1',
  DRIVE_BASE: 'https://www.googleapis.com/drive/v3',

  /**
   * Get OAuth token using Chrome Identity API
   */
  async getAuthToken(interactive = true) {
    if (typeof chrome === 'undefined' || !chrome.identity) {
      throw new Error('Chrome Identity API not available');
    }

    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (!token) {
          reject(new Error('No token received'));
        } else {
          resolve(token);
        }
      });
    });
  },

  /**
   * Remove cached token (for logout)
   */
  async removeAuthToken(token) {
    return new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token }, resolve);
    });
  },

  /**
   * Fetch with auth header and error handling
   */
  async fetchWithAuth(url, token) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // Token expired - remove and retry
      await this.removeAuthToken(token);
      throw new Error('TOKEN_EXPIRED');
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    return response.json();
  },

  /**
   * Extract document ID from Google Docs URL
   */
  extractDocumentId(url) {
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  },

  /**
   * Fetch document content and structure
   */
  async getDocument(documentId) {
    const token = await this.getAuthToken();
    const url = `${this.API_BASE}/documents/${documentId}`;
    return this.fetchWithAuth(url, token);
  },

  /**
   * Get revision list from Drive API
   */
  async getRevisions(documentId, pageSize = 100) {
    const token = await this.getAuthToken();
    const fields = 'revisions(id,modifiedTime,lastModifyingUser(displayName,emailAddress,photoLink),exportLinks,size)';
    const url = `${this.DRIVE_BASE}/files/${documentId}/revisions?fields=${encodeURIComponent(fields)}&pageSize=${pageSize}`;
    return this.fetchWithAuth(url, token);
  },

  /**
   * Get content of specific revision
   */
  async getRevisionContent(documentId, revisionId) {
    const token = await this.getAuthToken();
    const url = `${this.DRIVE_BASE}/files/${documentId}/revisions/${revisionId}?alt=media`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`Failed to fetch revision: ${response.status}`);
    return response.text();
  },

  /**
   * Get file metadata
   */
  async getFileMetadata(documentId) {
    const token = await this.getAuthToken();
    const fields = 'id,name,description,mimeType,createdTime,modifiedTime,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress,photoLink),shared,collaborators';
    const url = `${this.DRIVE_BASE}/files/${documentId}?fields=${encodeURIComponent(fields)}`;
    return this.fetchWithAuth(url, token);
  },

  /**
   * Extract plain text from Docs API response
   */
  extractText(doc) {
    if (!doc || !doc.body || !doc.body.content) return '';
    
    let text = '';
    const walk = (elements) => {
      elements.forEach(el => {
        if (el.paragraph) {
          el.paragraph.elements.forEach(pe => {
            if (pe.textRun && pe.textRun.content) {
              text += pe.textRun.content;
            }
          });
        } else if (el.table) {
          el.table.tableRows.forEach(row => {
            row.tableCells.forEach(cell => {
              if (cell.content) walk(cell.content);
            });
          });
        }
      });
    };
    walk(doc.body.content);
    return text;
  },

  /**
   * Build edit history from revisions
   */
  async buildEditHistory(documentId) {
    const revisions = await this.getRevisions(documentId);
    const history = [];

    for (const rev of revisions.revisions || []) {
      history.push({
        id: rev.id,
        timestamp: rev.modifiedTime,
        author: rev.lastModifyingUser?.displayName || 'Unknown',
        authorEmail: rev.lastModifyingUser?.emailAddress || '',
        authorPhoto: rev.lastModifyingUser?.photoLink || '',
        size: parseInt(rev.size) || 0
      });
    }

    return history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GoogleDocsService };
}
