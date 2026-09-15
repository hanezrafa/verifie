/**
 * Google Docs Content Reader
 * Robustly extracts real-time content from Google Docs DOM
 * 
 * Google Docs renders content in a complex structure:
 * - .kix-page-content-wrapper contains pages
 * - .kix-paragraphrenderer / .kix-lineview contain text
 * - Text is in spans with specific classes
 */

class GoogleDocsReader {
  constructor() {
    this.selectors = {
      title: [
        '[aria-label="Document title"]',
        '.kix-document-title',
        'input[aria-label="Document title"]',
        '#docs-title-input'
      ],
      content: [
        '.kix-page-content-wrapper',
        '.kix-appview-editor',
        '[role="document"]',
        '.docs-texteventtarget-iframe'
      ],
      paragraphs: [
        '.kix-paragraphrenderer',
        '.kix-lineview',
        '[class*="paragraph"]'
      ]
    };
  }

  /**
   * Get document title
   */
  getTitle() {
    for (const sel of this.selectors.title) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.value || el.textContent || el.innerText;
        if (text && text.trim()) return text.trim();
      }
    }
    return document.title.replace(' - Google Docs', '').trim() || 'Untitled Document';
  }

  /**
   * Get document ID from URL
   */
  getDocumentId() {
    const match = window.location.href.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Find the main content container
   */
  getContentElement() {
    for (const sel of this.selectors.content) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  /**
   * Extract plain text using multiple strategies
   */
  getText() {
    // Strategy 1: Use the DOM text content (most reliable for rendered text)
    const contentEl = this.getContentElement();
    if (contentEl) {
      const text = contentEl.innerText || contentEl.textContent || '';
      if (text.trim()) return this.normalizeText(text);
    }

    // Strategy 2: Extract paragraph by paragraph
    const paragraphs = this.getParagraphs();
    if (paragraphs.length > 0) {
      return paragraphs.join('\n');
    }

    return '';
  }

  /**
   * Extract text paragraph by paragraph
   */
  getParagraphs() {
    const result = [];
    for (const sel of this.selectors.paragraphs) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) {
        elements.forEach(el => {
          const text = el.innerText || el.textContent || '';
          if (text.trim()) result.push(text.trim());
        });
        break;
      }
    }
    return result;
  }

  /**
   * Normalize whitespace without destroying structure
   */
  normalizeText(text) {
    return text
      .replace(/\u00A0/g, ' ')       // non-breaking spaces
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')    // collapse excessive newlines
      .trim();
  }

  /**
   * Get full content snapshot with rich metadata
   */
  getSnapshot() {
    const text = this.getText();
    const words = text.split(/\s+/).filter(w => w.length > 0);

    return {
      text,
      title: this.getTitle(),
      documentId: this.getDocumentId(),
      url: window.location.href,
      wordCount: words.length,
      charCount: text.length,
      charCountNoSpaces: text.replace(/\s/g, '').length,
      paragraphCount: text.split('\n').filter(l => l.trim()).length,
      sentenceCount: text.split(/[.!?]+/).filter(s => s.trim()).length,
      timestamp: Date.now(),
      readingTimeMinutes: Math.ceil(words.length / 200),
      hash: this.hashCode(text)
    };
  }

  /**
   * Simple string hash for change detection
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if content element is available yet
   */
  isReady() {
    return !!this.getContentElement();
  }
}

window.GoogleDocsReader = GoogleDocsReader;
