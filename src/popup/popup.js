document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(tc => tc.classList.remove('active'));

      tab.classList.add('active');
      const targetTab = document.getElementById(`tab-${tab.dataset.tab}`);
      if (targetTab) {
        targetTab.classList.add('active');
      }
    });
  });

  // Play/Pause button
  const btnPlay = document.getElementById('btn-play');
  let isPlaying = false;

  btnPlay.addEventListener('click', () => {
    isPlaying = !isPlaying;
    btnPlay.innerHTML = isPlaying
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';

    if (isPlaying) {
      simulatePlayback();
    }
  });

  // Speed buttons
  const speedBtns = document.querySelectorAll('.speed-btn');
  let currentSpeed = 1;

  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = parseFloat(btn.dataset.speed);
    });
  });

  // Timeline scrubbing
  const timelineBar = document.querySelector('.timeline-bar');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineThumb = document.getElementById('timeline-thumb');

  timelineBar.addEventListener('click', (e) => {
    const rect = timelineBar.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    updateTimeline(percent);
  });

  function updateTimeline(percent) {
    percent = Math.max(0, Math.min(100, percent));
    timelineProgress.style.width = `${percent}%`;
    timelineThumb.style.left = `${percent}%`;

    const totalSeconds = 300;
    const currentSeconds = Math.floor((percent / 100) * totalSeconds);
    document.getElementById('current-time').textContent = formatTime(currentSeconds);
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function simulatePlayback() {
    if (!isPlaying) return;

    const currentWidth = parseFloat(timelineProgress.style.width) || 0;
    if (currentWidth >= 100) {
      isPlaying = false;
      btnPlay.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
      return;
    }

    const newWidth = currentWidth + (0.5 * currentSpeed);
    updateTimeline(newWidth);
    requestAnimationFrame(() => setTimeout(simulatePlayback, 50));
  }

  // Filter buttons
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Load document button
  const btnLoad = document.getElementById('btn-load');
  btnLoad.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.includes('docs.google.com/document')) {
        chrome.tabs.sendMessage(tab.id, { action: 'loadHistory' }, (response) => {
          if (chrome.runtime.lastError) {
            document.getElementById('doc-title').textContent = 'Open a Google Doc first';
            document.getElementById('doc-title').style.color = '#ef4444';
          } else if (response && response.title) {
            document.getElementById('doc-title').textContent = response.title;
            updateStats(response.stats);
          }
        });
      } else {
        document.getElementById('doc-title').textContent = 'Not a Google Doc';
        document.getElementById('doc-title').style.color = '#ef4444';
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  });

  function updateStats(stats) {
    if (!stats) return;
    document.getElementById('stat-words').textContent = stats.words || 0;
    document.getElementById('stat-deletes').textContent = stats.deletes || 0;
    document.getElementById('stat-time').textContent = stats.time || '0h 0m';
    document.getElementById('stat-edits').textContent = stats.edits || 0;
  }

  // Export stats button
  const btnExport = document.getElementById('btn-export-stats');
  btnExport.addEventListener('click', () => {
    const stats = {
      wordCount: document.getElementById('stat-words').textContent,
      deletes: document.getElementById('stat-deletes').textContent,
      timeSpent: document.getElementById('stat-time').textContent,
      edits: document.getElementById('stat-edits').textContent
    };

    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gdocs-stats.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  // Draw breakdown chart
  drawBreakdownChart();

  function drawBreakdownChart() {
    const canvas = document.getElementById('breakdown-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    const data = [32, 23, 20, 25];
    const colors = ['#3b82f6', '#60a5fa', '#93c5fd', '#1d4ed8'];
    const total = data.reduce((a, b) => a + b, 0);

    let startAngle = -Math.PI / 2;

    data.forEach((value, index) => {
      const sliceAngle = (value / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[index];
      ctx.fill();

      startAngle += sliceAngle;
    });

    // Center hole
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  // AI Detection
  const btnAnalyze = document.getElementById('btn-analyze');
  const aiResultContainer = document.getElementById('ai-result-container');
  const aiLoading = document.getElementById('ai-loading');

  btnAnalyze.addEventListener('click', async () => {
    btnAnalyze.style.display = 'none';
    aiResultContainer.style.display = 'none';
    aiLoading.style.display = 'flex';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let content = '';

      if (tab && tab.url && tab.url.includes('docs.google.com/document')) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getContent' }).catch(() => null);
        if (response && response.content) {
          content = response.content;
        }
      }

      if (!content) {
        content = generateSampleContent();
      }

      await simulateAnalysisDelay();

      const result = analyzeContent(content);
      displayResults(result);
    } catch (err) {
      const result = analyzeContent(generateSampleContent());
      displayResults(result);
    }
  });

  function generateSampleContent() {
    return `Artificial intelligence has revolutionized the way we approach complex problems in modern society. The integration of machine learning algorithms into everyday applications has created unprecedented opportunities for innovation and efficiency. Furthermore, the development of natural language processing technologies has enabled more intuitive human-computer interactions. In conclusion, the continued advancement of AI technology will undoubtedly shape the future of numerous industries and transform the way we live and work.`;
  }

  function simulateAnalysisDelay() {
    return new Promise(resolve => setTimeout(resolve, 2000));
  }

  function analyzeContent(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = sentences.length;

    let aiScore = 0;
    let humanScore = 0;

    // Check for AI-typical patterns
    const aiPatterns = [
      { pattern: /\b(furthermore|moreover|additionally|consequently|therefore|thus|hence)\b/gi, weight: 8 },
      { pattern: /\b(in conclusion|to sum up|in summary|overall)\b/gi, weight: 7 },
      { pattern: /\b(it is important to note|it should be noted|it is worth mentioning)\b/gi, weight: 6 },
      { pattern: /\b(has revolutionized|has transformed|has created|has enabled)\b/gi, weight: 5 },
      { pattern: /\b(unprecedented|significant|remarkable|substantial|considerable)\b/gi, weight: 4 },
      { pattern: /\b(in today.s society|in modern society|in the modern world)\b/gi, weight: 6 },
      { pattern: /\b(moreover|furthermore|additionally)\b/gi, weight: 5 },
      { pattern: /\b(comprehensive|innovative|cutting.edge|groundbreaking)\b/gi, weight: 4 },
      { pattern: /\b(harness|leverage|utilize|facilitate)\b/gi, weight: 3 },
      { pattern: /\b(numerous|various|multiple|several)\b/gi, weight: 2 },
    ];

    const humanPatterns = [
      { pattern: /\b(I think|I believe|in my opinion|personally)\b/gi, weight: 8 },
      { pattern: /\b(gonna|wanna|kinda|sorta|yeah|ok)\b/gi, weight: 7 },
      { pattern: /[!]{2,}/g, weight: 3 },
      { pattern: /\b(very|really|super|totally|absolutely)\b/gi, weight: 4 },
      { pattern: /\b(stuff|things|guys|people)\b/gi, weight: 3 },
      { pattern: /\b(but|however|although)\b/gi, weight: 2 },
      { pattern: /\b(like)\b/g, weight: 2 },
    ];

    aiPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        aiScore += matches.length * weight;
      }
    });

    humanPatterns.forEach(({ pattern, weight }) => {
      const matches = text.match(pattern);
      if (matches) {
        humanScore += matches.length * weight;
      }
    });

    // Sentence length analysis
    const avgSentenceLength = wordCount / Math.max(sentenceCount, 1);
    if (avgSentenceLength > 25) {
      aiScore += 15;
    } else if (avgSentenceLength > 18) {
      aiScore += 8;
    } else {
      humanScore += 10;
    }

    // Vocabulary diversity
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const diversity = uniqueWords.size / Math.max(wordCount, 1);
    if (diversity < 0.5) {
      aiScore += 10;
    } else if (diversity > 0.8) {
      humanScore += 8;
    }

    // Normalize scores
    const totalScore = aiScore + humanScore;
    let aiPercent = totalScore > 0 ? Math.round((aiScore / totalScore) * 100) : 50;
    let humanPercent = 100 - aiPercent;

    // Ensure minimum human score for very short texts
    if (wordCount < 20) {
      aiPercent = Math.min(aiPercent, 70);
      humanPercent = 100 - aiPercent;
    }

    return {
      aiPercent,
      humanPercent,
      wordCount,
      indicators: {
        vocab: Math.min(100, Math.round(diversity * 100 + 20)),
        sentence: Math.min(100, Math.round(avgSentenceLength * 3)),
      }
    };
  }

  function displayResults(result) {
    aiLoading.style.display = 'none';
    aiResultContainer.style.display = 'flex';
    aiResultContainer.style.flexDirection = 'column';
    aiResultContainer.style.gap = '16px';

    // Update score ring
    const circumference = 339.292;
    const aiOffset = circumference - (result.aiPercent / 100) * circumference;

    const aiScoreRing = document.getElementById('ai-score-ring');
    const humanScoreRing = document.getElementById('human-score-ring');

    aiScoreRing.style.strokeDashoffset = circumference;
    humanScoreRing.style.strokeDashoffset = circumference;

    setTimeout(() => {
      aiScoreRing.style.strokeDashoffset = aiOffset;
      const humanOffset = circumference - (result.humanPercent / 100) * circumference;
      humanScoreRing.style.strokeDashoffset = humanOffset;
    }, 100);

    // Update text
    document.getElementById('ai-percent-text').textContent = `${result.aiPercent}%`;
    document.getElementById('ai-legend-value').textContent = `${result.aiPercent}%`;
    document.getElementById('human-legend-value').textContent = `${result.humanPercent}%`;

    // Update verdict
    const verdictIcon = document.getElementById('verdict-icon');
    const verdictLabel = document.getElementById('verdict-label');
    const verdictDesc = document.getElementById('verdict-desc');

    verdictIcon.className = 'verdict-icon';

    if (result.aiPercent >= 70) {
      verdictIcon.classList.add('ai-verdict');
      verdictIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>`;
      verdictLabel.textContent = 'Likely AI Generated';
      verdictDesc.textContent = 'This content shows strong indicators of AI generation';
    } else if (result.humanPercent >= 70) {
      verdictIcon.classList.add('human-verdict');
      verdictIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
      verdictLabel.textContent = 'Likely Human Written';
      verdictDesc.textContent = 'This content appears to be written by a human';
    } else {
      verdictIcon.classList.add('mixed-verdict');
      verdictIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`;
      verdictLabel.textContent = 'Mixed Content';
      verdictDesc.textContent = 'This content appears to be a mix of AI and human writing';
    }

    // Update indicators
    document.getElementById('ind-vocab').style.width = `${result.indicators.vocab}%`;
    document.getElementById('ind-vocab-val').textContent = `${result.indicators.vocab}%`;

    document.getElementById('ind-sentence').style.width = `${result.indicators.sentence}%`;
    document.getElementById('ind-sentence-val').textContent = `${result.indicators.sentence}%`;

    const repetitionScore = Math.min(100, Math.round(result.aiPercent * 0.8));
    document.getElementById('ind-repetition').style.width = `${repetitionScore}%`;
    document.getElementById('ind-repetition-val').textContent = `${repetitionScore}%`;

    const naturalScore = Math.min(100, Math.round(result.humanPercent * 0.9 + 10));
    document.getElementById('ind-natural').style.width = `${naturalScore}%`;
    document.getElementById('ind-natural-val').textContent = `${naturalScore}%`;
  }

  // Real-time Tracking
  let trackingActive = true;
  let trackingStartTime = Date.now();
  let charCount = 0;
  let sessionData = [];
  let trackingInterval = null;

  const btnToggleTracking = document.getElementById('btn-toggle-tracking');
  const trackChars = document.getElementById('track-chars');
  const trackDuration = document.getElementById('track-duration');
  const trackSessions = document.getElementById('track-sessions');
  const trackSessionList = document.getElementById('track-session-list');
  const trackingCanvas = document.getElementById('tracking-canvas');
  const btnExportTracking = document.getElementById('btn-export-tracking');

  // Initialize tracking
  initTracking();

  function initTracking() {
    // Get saved tracking data from storage
    chrome.storage.local.get(['trackingData'], (result) => {
      if (result.trackingData) {
        charCount = result.trackingData.charCount || 0;
        sessionData = result.trackingData.sessions || [];
        trackingStartTime = result.trackingData.startTime || Date.now();
        trackingActive = result.trackingData.active !== false;

        updateTrackingUI();
        startTrackingInterval();
        drawTrackingChart();
      } else {
        startTrackingInterval();
        drawTrackingChart();
      }
    });

    // Toggle tracking
    btnToggleTracking.addEventListener('click', () => {
      trackingActive = !trackingActive;
      btnToggleTracking.classList.toggle('inactive', !trackingActive);
      
      const statusDot = document.querySelector('.status-dot');
      if (trackingActive) {
        statusDot.classList.add('active', 'pulse');
      } else {
        statusDot.classList.remove('active', 'pulse');
      }
      
      saveTrackingData();
    });

    // Export tracking
    btnExportTracking.addEventListener('click', () => {
      const data = {
        charCount,
        duration: Date.now() - trackingStartTime,
        sessions: sessionData,
        exportTime: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'verifie-tracking.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Listen for character updates from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'updateCharCount') {
        charCount += message.delta;
        trackChars.textContent = formatNumber(charCount);
        saveTrackingData();
      }
    });
  }

  function startTrackingInterval() {
    if (trackingInterval) clearInterval(trackingInterval);
    
    trackingInterval = setInterval(() => {
      if (trackingActive) {
        updateDuration();
      }
    }, 1000);
  }

  function updateDuration() {
    const duration = Date.now() - trackingStartTime;
    trackDuration.textContent = formatDuration(duration);
  }

  function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function updateTrackingUI() {
    trackChars.textContent = formatNumber(charCount);
    trackDuration.textContent = formatDuration(Date.now() - trackingStartTime);
    trackSessions.textContent = `${sessionData.length} session${sessionData.length !== 1 ? 's' : ''}`;
    drawTrackingChart();
    updateSessionList();
  }

  function drawTrackingChart() {
    if (!trackingCanvas) return;
    
    const ctx = trackingCanvas.getContext('2d');
    const width = trackingCanvas.width;
    const height = trackingCanvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Generate mock data for visualization
    const dataPoints = 60; // Last 60 seconds
    const data = [];
    let maxVal = 1;
    
    for (let i = 0; i < dataPoints; i++) {
      const val = Math.random() * 50;
      data.push(val);
      if (val > maxVal) maxVal = val;
    }
    
    // Draw line chart
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const xStep = width / (dataPoints - 1);
    
    data.forEach((val, i) => {
      const x = i * xStep;
      const y = height - (val / Math.max(maxVal, 1)) * (height - 20) - 10;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Draw area fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  function updateSessionList() {
    trackSessionList.innerHTML = '';
    
    if (sessionData.length === 0) {
      trackSessionList.innerHTML = `
        <div class="tracking-session-item">
          <div class="session-avatar" style="background: #3b82f6;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div class="session-info">
            <span class="session-name">You</span>
            <span class="session-details">${formatNumber(charCount)} chars • ${formatDuration(Date.now() - trackingStartTime)}</span>
          </div>
          <div class="session-status ${trackingActive ? 'active' : ''}">
            <div class="session-dot"></div>
            ${trackingActive ? 'Active' : 'Idle'}
          </div>
        </div>
      `;
      return;
    }
    
    sessionData.forEach(session => {
      const item = document.createElement('div');
      item.className = 'tracking-session-item';
      item.innerHTML = `
        <div class="session-avatar" style="background: #3b82f6;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <div class="session-info">
          <span class="session-name">${session.name}</span>
          <span class="session-details">${formatNumber(session.chars)} chars • ${formatDuration(session.duration)}</span>
        </div>
        <div class="session-status ${session.active ? 'active' : ''}">
          <div class="session-dot"></div>
          ${session.active ? 'Active' : 'Ended'}
        </div>
      `;
      trackSessionList.appendChild(item);
    });
  }

  function saveTrackingData() {
    chrome.storage.local.set({
      trackingData: {
        charCount,
        startTime: trackingStartTime,
        sessions: sessionData,
        active: trackingActive
      }
    });
  }

  // Simulate character updates for demo
  setInterval(() => {
    if (trackingActive && Math.random() > 0.7) {
      charCount += Math.floor(Math.random() * 5) + 1;
      trackChars.textContent = formatNumber(charCount);
      saveTrackingData();
    }
  }, 2000);
});
