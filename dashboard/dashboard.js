/**
 * Verifie Dashboard Logic
 * Uses DashboardData layer to read real data (extension) or demo (web)
 */

document.addEventListener('DOMContentLoaded', async () => {
  let appData = { documents: [], revisions: [], analyses: [], sessions: [], trackingData: {}, mode: 'demo' };

  // === Navigation ===
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');

  const viewMeta = {
    overview: { title: 'Overview', subtitle: 'Your document analytics at a glance' },
    documents: { title: 'Documents', subtitle: 'All tracked documents' },
    analytics: { title: 'Analytics', subtitle: 'Writing patterns and trends' },
    'ai-detection': { title: 'AI Detection', subtitle: 'Analyze content authenticity' },
    sessions: { title: 'Sessions', subtitle: 'Editing session history' },
    settings: { title: 'Settings', subtitle: 'Configure integrations and data' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      item.classList.add('active');
      const view = document.getElementById(`view-${item.dataset.view}`);
      if (view) view.classList.add('active');

      const meta = viewMeta[item.dataset.view];
      if (meta) {
        viewTitle.textContent = meta.title;
        viewSubtitle.textContent = meta.subtitle;
      }

      renderView(item.dataset.view);
    });
  });

  // === Data loading ===
  async function loadData() {
    appData = await DashboardData.load();
    updateModeIndicator();
  }

  function updateModeIndicator() {
    const statusEl = document.getElementById('connection-status');
    if (!statusEl) return;
    const isLive = appData.mode === 'live';
    statusEl.classList.toggle('connected', isLive);
    statusEl.querySelector('span').textContent = isLive ? 'Live Data' : 'Demo Data';

    // Show a banner if demo
    let banner = document.getElementById('demo-banner');
    if (appData.mode === 'demo') {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'demo-banner';
        banner.style.cssText = `
          background:#fffbeb;border:1px solid #fde68a;color:#92400e;
          padding:10px 16px;border-radius:10px;font-size:13px;
          margin-bottom:16px;display:flex;align-items:center;gap:8px;
        `;
        banner.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Showing demo data. Install the Verifie extension and open a Google Doc to see your real analytics.</span>
        `;
        const content = document.querySelector('.content');
        content.insertBefore(banner, content.firstChild);
      }
    } else if (banner) {
      banner.remove();
    }
  }

  // === Render ===
  function renderView(viewName) {
    switch (viewName) {
      case 'overview':
        updateOverview();
        drawActivityChart();
        drawAiDonut();
        break;
      case 'documents':
        renderDocuments();
        break;
      case 'analytics':
        drawVelocityChart();
        drawHoursChart();
        drawSessionChart();
        break;
      case 'ai-detection':
        drawAiHistoryChart();
        break;
      case 'sessions':
        renderSessions();
        break;
    }
  }

  function updateOverview() {
    const stats = DashboardData.computeStats(appData);
    document.getElementById('overview-docs').textContent = stats.docCount;
    document.getElementById('overview-chars').textContent = formatNumber(stats.totalChars);
    document.getElementById('overview-time').textContent = `${stats.totalHours.toFixed(1)}h`;
    document.getElementById('overview-ai').textContent = `${stats.avgAi}%`;
    document.getElementById('donut-ai-value').textContent = `${stats.avgAi}%`;

    renderRecentDocs();
  }

  function renderRecentDocs() {
    const container = document.getElementById('recent-docs');
    if (appData.documents.length === 0) return;

    container.innerHTML = '';
    appData.documents
      .slice()
      .sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0))
      .slice(0, 5)
      .forEach(doc => {
        const item = document.createElement('div');
        item.className = 'doc-item';
        item.innerHTML = `
          <div class="doc-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="doc-item-info">
            <div class="doc-item-title">${escapeHtml(doc.title || 'Untitled')}</div>
            <div class="doc-item-meta">${formatNumber(doc.wordCount || 0)} words • ${formatDate(doc.lastModified)}</div>
          </div>
        `;
        container.appendChild(item);
      });
  }

  function renderDocuments() {
    const grid = document.getElementById('doc-grid');
    if (appData.documents.length === 0) return; // keep empty state

    grid.innerHTML = '';
    appData.documents.forEach(doc => {
      const card = document.createElement('div');
      card.className = 'chart-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="doc-item" style="background:transparent;padding:0;">
          <div class="doc-item-icon" style="width:44px;height:44px;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </div>
          <div class="doc-item-info">
            <div class="doc-item-title" style="font-size:14px;">${escapeHtml(doc.title || 'Untitled')}</div>
            <div class="doc-item-meta">Updated ${formatDate(doc.lastModified)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;">
          <div>
            <div style="font-size:11px;color:#64748b;">Words</div>
            <div style="font-size:16px;font-weight:700;color:#1e293b;">${formatNumber(doc.wordCount || 0)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:#64748b;">Characters</div>
            <div style="font-size:16px;font-weight:700;color:#1e293b;">${formatNumber(doc.charCount || 0)}</div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function renderSessions() {
    const container = document.getElementById('session-timeline');
    const sessions = appData.sessions || [];

    document.getElementById('session-count').textContent = `${sessions.length} sessions`;

    if (sessions.length === 0) return;

    container.innerHTML = '';
    sessions
      .slice()
      .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
      .slice(0, 20)
      .forEach(s => {
        const item = document.createElement('div');
        item.className = 'doc-item';
        item.innerHTML = `
          <div class="doc-item-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div class="doc-item-info">
            <div class="doc-item-title">${escapeHtml(s.documentTitle || 'Document')}</div>
            <div class="doc-item-meta">${formatDuration(s.duration || 0)} • ${formatNumber(s.charCount || 0)} chars • ${formatDate(s.startTime)}</div>
          </div>
        `;
        container.appendChild(item);
      });
  }

  // === Charts ===

  function drawActivityChart() {
    const canvas = document.getElementById('activity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    const series = DashboardData.buildActivitySeries(appData);

    if (series.every(s => s.chars === 0 && s.minutes === 0)) {
      drawEmptyChart(ctx, w, h, 'No activity data yet — start editing a Google Doc');
      return;
    }

    const maxChars = Math.max(...series.map(s => s.chars), 1);
    const maxMin = Math.max(...series.map(s => s.minutes), 1);
    const chartW = w - 50;
    const stepX = chartW / (series.length - 1 || 1);

    // Minutes bars
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    series.forEach((s, i) => {
      const barH = (s.minutes / maxMin) * (h - 50);
      ctx.fillRect(40 + i * stepX - 14, h - 24 - barH, 28, barH);
    });

    // Chars line
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    series.forEach((s, i) => {
      const x = 40 + i * stepX;
      const y = h - 24 - (s.chars / maxChars) * (h - 50);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    series.forEach((s, i) => {
      const x = 40 + i * stepX;
      const y = h - 24 - (s.chars / maxChars) * (h - 50);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#3b82f6';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    series.forEach((s, i) => {
      ctx.fillText(s.label, 40 + i * stepX, h - 6);
    });
  }

  function drawAiDonut() {
    const canvas = document.getElementById('ai-donut');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(cx, cy) - 20;
    ctx.clearRect(0, 0, w, h);

    const stats = DashboardData.computeStats(appData);
    const aiPercent = stats.avgAi / 100;

    // Background (human = green)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 28;
    ctx.stroke();

    // AI arc (blue)
    if (aiPercent > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * aiPercent));
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 28;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  function drawVelocityChart() {
    const canvas = document.getElementById('velocity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Use sessions sorted by time for velocity trend
    const sessions = (appData.sessions || []).slice().sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    if (sessions.length === 0) {
      drawEmptyChart(ctx, w, h, 'No velocity data yet');
      return;
    }

    const data = sessions.slice(-20).map(s => {
      const min = (s.duration || 0) / 60000;
      return min > 0 ? Math.round((s.charCount || 0) / min) : 0;
    });
    const maxVal = Math.max(...data, 1);

    // Area
    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((val, i) => {
      const x = (w / (data.length - 1 || 1)) * i;
      const y = h - (val / maxVal) * (h - 30) - 10;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    data.forEach((val, i) => {
      const x = (w / (data.length - 1 || 1)) * i;
      const y = h - (val / maxVal) * (h - 30) - 10;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function drawHoursChart() {
    const canvas = document.getElementById('hours-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const series = DashboardData.buildHourlySeries(appData);
    if (series.every(s => s.value === 0)) {
      drawEmptyChart(ctx, w, h, 'No activity data yet');
      return;
    }

    const maxVal = Math.max(...series.map(s => s.value), 1);
    const barW = (w - 40) / series.length - 10;

    series.forEach((s, i) => {
      const barH = (s.value / maxVal) * (h - 40);
      const x = 20 + i * ((w - 40) / series.length);
      const y = h - 24 - barH;

      const grad = ctx.createLinearGradient(0, y, 0, h - 24);
      grad.addColorStop(0, '#3b82f6');
      grad.addColorStop(1, '#60a5fa');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, barH, 6);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, x + barW / 2, h - 8);
    });
  }

  function drawSessionChart() {
    const canvas = document.getElementById('session-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const series = DashboardData.buildSessionDistribution(appData);
    if (series.every(s => s.value === 0)) {
      drawEmptyChart(ctx, w, h, 'No session data yet');
      return;
    }

    const maxVal = Math.max(...series.map(s => s.value), 1);
    const barW = (w - 60) / series.length - 20;

    series.forEach((s, i) => {
      const barH = (s.value / maxVal) * (h - 50);
      const x = 30 + i * ((w - 60) / series.length);
      const y = h - 30 - barH;

      const grad = ctx.createLinearGradient(0, y, 0, h - 30);
      grad.addColorStop(0, '#1d4ed8');
      grad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, barW, barH, 6);
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, x + barW / 2, h - 10);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(s.value, x + barW / 2, y - 6);
    });
  }

  function drawAiHistoryChart() {
    const canvas = document.getElementById('ai-history-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const analyses = appData.analyses || [];
    if (analyses.length === 0) {
      drawEmptyChart(ctx, w, h, 'No analyses yet — run AI detection from the extension');
      return;
    }

    const data = analyses.slice(-10).map(a => a.aiPercent || 0);
    const stepX = (w - 40) / Math.max(data.length - 1, 1);

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    data.forEach((val, i) => {
      const x = 20 + i * stepX;
      const y = h - 20 - (val / 100) * (h - 40);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // === Helpers ===
  function drawEmptyChart(ctx, w, h, message) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(message, w / 2, h / 2);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < r) r = h;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  function formatDuration(ms) {
    const totalMin = Math.round(ms / 60000);
    if (totalMin < 60) return `${totalMin}m`;
    const hours = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return `${hours}h ${mins}m`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Settings / Buttons ===
  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    await loadData();
    renderView(document.querySelector('.nav-item.active')?.dataset.view || 'overview');
  });

  document.getElementById('btn-connect')?.addEventListener('click', () => {
    const settingsNav = document.querySelector('[data-view="settings"]');
    if (settingsNav) settingsNav.click();
  });

  document.getElementById('btn-export-data')?.addEventListener('click', async () => {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verifie-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-export-all')?.addEventListener('click', () => {
    document.getElementById('btn-export-data')?.click();
  });

  document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
    if (!confirm('Clear all local data? This cannot be undone.')) return;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.clear(() => location.reload());
    } else {
      alert('Clearing data is only available in the extension.');
    }
  });

  document.getElementById('search-docs')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#doc-grid > .chart-card').forEach(card => {
      const title = card.querySelector('.doc-item-title')?.textContent.toLowerCase() || '';
      card.style.display = title.includes(q) ? '' : 'none';
    });
  });

  // === Live updates (extension only) ===
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.documents || changes.sessions || changes.trackingData || changes.revisions) {
        loadData().then(() => {
          renderView(document.querySelector('.nav-item.active')?.dataset.view || 'overview');
        });
      }
    });
  }

  // === Init ===
  await loadData();
  updateOverview();
  drawActivityChart();
  drawAiDonut();

  window.addEventListener('resize', () => {
    renderView(document.querySelector('.nav-item.active')?.dataset.view || 'overview');
  });
});
