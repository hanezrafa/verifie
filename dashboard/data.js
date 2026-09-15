/**
 * Verifie Dashboard Data Layer
 * Reads real data from chrome.storage (extension context)
 * or falls back to demo data (web context / GitHub Pages)
 */

const DashboardData = {
  isExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  },

  /**
   * Load real data from chrome.storage
   */
  async loadReal() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        ['documents', 'revisions', 'analyses', 'trackingData', 'sessions'],
        (result) => {
          resolve({
            documents: result.documents || [],
            revisions: result.revisions || [],
            analyses: result.analyses || [],
            trackingData: result.trackingData || {},
            sessions: result.sessions || [],
            mode: 'live'
          });
        }
      );
    });
  },

  /**
   * Load demo data for web (GitHub Pages) context
   */
  loadDemo() {
    const now = Date.now();
    const day = 86400000;

    const demoSessions = [
      { id: 1, documentTitle: 'Q4 Product Roadmap', startTime: now - day * 1, duration: 5400000, charCount: 4200 },
      { id: 2, documentTitle: 'Marketing Strategy 2026', startTime: now - day * 2, duration: 3600000, charCount: 3100 },
      { id: 3, documentTitle: 'Q4 Product Roadmap', startTime: now - day * 3, duration: 2700000, charCount: 2800 },
      { id: 4, documentTitle: 'Team Notes', startTime: now - day * 4, duration: 1800000, charCount: 1500 },
      { id: 5, documentTitle: 'Marketing Strategy 2026', startTime: now - day * 5, duration: 6300000, charCount: 5100 }
    ];

    return {
      documents: [
        { id: 'd1', title: 'Q4 Product Roadmap', wordCount: 2847, charCount: 16240, lastModified: new Date(now - day).toISOString(), aiPercent: 34 },
        { id: 'd2', title: 'Marketing Strategy 2026', wordCount: 1923, charCount: 11890, lastModified: new Date(now - day * 2).toISOString(), aiPercent: 61 },
        { id: 'd3', title: 'Team Notes', wordCount: 842, charCount: 5210, lastModified: new Date(now - day * 4).toISOString(), aiPercent: 18 },
        { id: 'd4', title: 'Research Summary', wordCount: 3106, charCount: 19540, lastModified: new Date(now - day * 6).toISOString(), aiPercent: 72 }
      ],
      revisions: [],
      analyses: [
        { aiPercent: 34, timestamp: new Date(now - day).toISOString() },
        { aiPercent: 61, timestamp: new Date(now - day * 2).toISOString() },
        { aiPercent: 18, timestamp: new Date(now - day * 4).toISOString() },
        { aiPercent: 72, timestamp: new Date(now - day * 6).toISOString() }
      ],
      trackingData: {
        charCount: 52880,
        sessionDuration: 19800000,
        keystrokes: 42150,
        active: true
      },
      sessions: demoSessions,
      mode: 'demo'
    };
  },

  /**
   * Main load - picks the right source
   */
  async load() {
    if (this.isExtension()) {
      try {
        const real = await this.loadReal();
        // If no real data yet, show demo so dashboard isn't empty
        if (real.documents.length === 0 && real.sessions.length === 0) {
          const demo = this.loadDemo();
          demo.mode = 'demo';
          return demo;
        }
        return real;
      } catch (err) {
        console.warn('Failed to load real data, using demo:', err);
        return this.loadDemo();
      }
    }
    return this.loadDemo();
  },

  /**
   * Compute all statistics from loaded data
   */
  computeStats(data) {
    const docs = data.documents || [];
    const sessions = data.sessions || [];
    const revisions = data.revisions || [];

    // Documents count
    const docCount = docs.length;

    // Total characters
    const totalChars = docs.reduce((sum, d) => sum + (d.charCount || 0), 0);

    // Total editing time (from sessions)
    const totalMs = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const totalHours = totalMs / 3600000;

    // Average AI percentage
    const analyses = data.analyses || [];
    let avgAi = 0;
    if (analyses.length > 0) {
      avgAi = Math.round(analyses.reduce((sum, a) => sum + (a.aiPercent || 0), 0) / analyses.length);
    } else if (docs.some(d => d.aiPercent != null)) {
      const docsWithAi = docs.filter(d => d.aiPercent != null);
      avgAi = Math.round(docsWithAi.reduce((sum, d) => sum + d.aiPercent, 0) / docsWithAi.length);
    }

    // Total words
    const totalWords = docs.reduce((sum, d) => sum + (d.wordCount || 0), 0);

    return {
      docCount,
      totalChars,
      totalWords,
      totalHours,
      avgAi,
      sessionCount: sessions.length,
      revisionCount: revisions.length
    };
  },

  /**
   * Build activity series from real revision/session data
   * Returns last 7 days of {label, chars, minutes}
   */
  buildActivitySeries(data) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const series = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date).setHours(0, 0, 0, 0);
      const dayEnd = new Date(date).setHours(23, 59, 59, 999);

      // Chars from sessions on this day
      const daySessions = (data.sessions || []).filter(s => {
        const t = new Date(s.startTime).getTime();
        return t >= dayStart && t <= dayEnd;
      });

      const chars = daySessions.reduce((sum, s) => sum + (s.charCount || 0), 0);
      const minutes = Math.round(daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60000);

      series.push({
        label: days[date.getDay()],
        chars,
        minutes,
        date: date.toISOString().slice(0, 10)
      });
    }

    return series;
  },

  /**
   * Build hourly activity from sessions
   */
  buildHourlySeries(data) {
    const buckets = ['6a', '9a', '12p', '3p', '6p', '9p'];
    const ranges = [[6, 9], [9, 12], [12, 15], [15, 18], [18, 21], [21, 24]];
    const counts = new Array(6).fill(0);

    (data.sessions || []).forEach(s => {
      const hour = new Date(s.startTime).getHours();
      for (let i = 0; i < ranges.length; i++) {
        if (hour >= ranges[i][0] && hour < ranges[i][1]) {
          counts[i] += (s.charCount || 0);
        }
      }
    });

    return buckets.map((label, i) => ({ label, value: counts[i] }));
  },

  /**
   * Build session length distribution
   */
  buildSessionDistribution(data) {
    const buckets = ['<5m', '5-15m', '15-30m', '30-60m', '1h+'];
    const counts = new Array(5).fill(0);

    (data.sessions || []).forEach(s => {
      const min = (s.duration || 0) / 60000;
      if (min < 5) counts[0]++;
      else if (min < 15) counts[1]++;
      else if (min < 30) counts[2]++;
      else if (min < 60) counts[3]++;
      else counts[4]++;
    });

    return buckets.map((label, i) => ({ label, value: counts[i] }));
  }
};

window.DashboardData = DashboardData;
