/**
 * AI Detection Service
 * Uses Hugging Face Inference API (free tier: 30K chars/month)
 * Falls back to local heuristic analysis when API unavailable
 * Idempotent — safe to load multiple times.
 */
(function (global) {
  'use strict';

  if (global.AIDetectionService) return;

const AIDetectionService = {
  HF_API_BASE: 'https://api-inference.huggingface.co/models',

  // Best free models for AI text detection
  MODELS: {
    primary: 'Hello-SimpleAI/chatgpt-detector-roberta',
    fallback: 'openai-community/roberta-base-openai-detector'
  },

  /**
   * Analyze text using Hugging Face API
   */
  async analyzeRemote(text, token) {
    if (!token) throw new Error('No Hugging Face token');

    // Truncate to API limits
    const truncated = text.slice(0, 2000);

    const response = await fetch(`${this.HF_API_BASE}/${this.MODELS.primary}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: truncated })
    });

    if (!response.ok) {
      if (response.status === 503) {
        // Model loading - retry after delay
        await new Promise(r => setTimeout(r, 5000));
        return this.analyzeRemote(text, token);
      }
      throw new Error(`HF API error: ${response.status}`);
    }

    const result = await response.json();
    return this.parseHFResult(result);
  },

  /**
   * Parse Hugging Face response into our format
   * Response format: [[{label: 'ChatGPT', score: 0.95}, {label: 'Human', score: 0.05}]]
   */
  parseHFResult(result) {
    const scores = Array.isArray(result[0]) ? result[0] : result;
    let aiScore = 0;
    let humanScore = 0;

    scores.forEach(item => {
      const label = item.label.toLowerCase();
      if (label.includes('chatgpt') || label.includes('ai') || label.includes('fake') || label.includes('machine')) {
        aiScore = item.score;
      } else if (label.includes('human') || label.includes('real')) {
        humanScore = item.score;
      }
    });

    const aiPercent = Math.round(aiScore * 100);
    const humanPercent = 100 - aiPercent;

    return {
      aiPercent,
      humanPercent,
      source: 'huggingface',
      confidence: Math.max(aiScore, humanScore)
    };
  },

  /**
   * Local heuristic analysis (works offline, no API needed)
   */
  analyzeLocal(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    let aiScore = 0;
    let humanScore = 0;

    // AI transition words
    const aiPatterns = [
      { pattern: /\b(furthermore|moreover|additionally|consequently|therefore|thus|hence)\b/gi, weight: 8 },
      { pattern: /\b(in conclusion|to sum up|in summary|overall)\b/gi, weight: 7 },
      { pattern: /\b(it is important to note|it should be noted|it is worth mentioning)\b/gi, weight: 6 },
      { pattern: /\b(has revolutionized|has transformed|has created|has enabled)\b/gi, weight: 5 },
      { pattern: /\b(unprecedented|significant|remarkable|substantial|considerable)\b/gi, weight: 4 },
      { pattern: /\b(in today.s society|in modern society|in the modern world)\b/gi, weight: 6 },
      { pattern: /\b(comprehensive|innovative|cutting.edge|groundbreaking)\b/gi, weight: 4 },
      { pattern: /\b(harness|leverage|utilize|facilitate)\b/gi, weight: 3 },
      { pattern: /\b(numerous|various|multiple|several)\b/gi, weight: 2 }
    ];

    // Human writing patterns
    const humanPatterns = [
      { pattern: /\b(I think|I believe|in my opinion|personally)\b/gi, weight: 8 },
      { pattern: /\b(gonna|wanna|kinda|sorta|yeah|ok)\b/gi, weight: 7 },
      { pattern: /[!]{2,}/g, weight: 3 },
      { pattern: /\b(very|really|super|totally|absolutely)\b/gi, weight: 4 },
      { pattern: /\b(stuff|things|guys|people)\b/gi, weight: 3 },
      { pattern: /\b(don't|can't|won't|isn't|aren't)\b/gi, weight: 4 }
    ];

    aiPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) aiScore += matches.length * weight;
    });

    humanPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) humanScore += matches.length * weight;
    });

    // Sentence length analysis
    const avgSentenceLength = wordCount / Math.max(sentenceCount, 1);
    if (avgSentenceLength > 25) aiScore += 15;
    else if (avgSentenceLength > 18) aiScore += 8;
    else humanScore += 10;

    // Vocabulary diversity (burstiness)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const diversity = uniqueWords.size / Math.max(wordCount, 1);
    if (diversity < 0.5) aiScore += 10;
    else if (diversity > 0.8) humanScore += 8;

    // Sentence length variance (AI tends to be uniform)
    const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
    const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(sentenceLengths.length, 1);
    const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) / Math.max(sentenceLengths.length, 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev < 4) aiScore += 12;
    else if (stdDev > 8) humanScore += 10;

    // Normalize
    const totalScore = aiScore + humanScore;
    let aiPercent = totalScore > 0 ? Math.round((aiScore / totalScore) * 100) : 50;
    let humanPercent = 100 - aiPercent;

    if (wordCount < 20) {
      aiPercent = Math.min(aiPercent, 70);
      humanPercent = 100 - aiPercent;
    }

    return {
      aiPercent,
      humanPercent,
      source: 'local',
      confidence: 0.6,
      indicators: {
        vocab: Math.min(100, Math.round(diversity * 100 + 20)),
        sentence: Math.min(100, Math.round(avgSentenceLength * 3)),
        burstiness: Math.min(100, Math.round(stdDev * 5))
      }
    };
  },

  /**
   * Main analyze method - tries remote, falls back to local
   */
  async analyze(text, options = {}) {
    const { token, preferRemote = true } = options;

    if (preferRemote && token) {
      try {
        return await this.analyzeRemote(text, token);
      } catch (err) {
        console.warn('Remote AI detection failed, using local:', err.message);
      }
    }

    return this.analyzeLocal(text);
  }
};

  global.AIDetectionService = AIDetectionService;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIDetectionService };
  }
})(typeof window !== 'undefined' ? window : self);
