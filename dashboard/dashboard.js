/**
 * Verifie Dashboard Logic
 * Reads data from localStorage / Supabase and renders analytics
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation
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

      // Redraw charts when switching views
      renderView(item.dataset.view);
    });
  });

  // Load data
  let appData = {
    documents: [],
    sessions: [],
    analyses: [],
    settings: {},
    endpoints: {}
  };

  async function loadData() {
    const stored = await VerifieStorage.get([
      'documents', 'sessions', 'analyses', 'trackingData', 'settings', 'endpoints'
    ]);

    appData.documents = stored.documents || [];
    appData.sessions = stored.sessions || [];
    appData.analyses = stored.analyses || [];
    appData.settings = { ...VERIFIE_CONFIG.defaults, ...(stored.settings || {}) };
    appData.endpoints = { ...VERIFIE_CONFIG.endpoints, ...(stored.endpoints || {}) };

    // Include tracking data as a pseudo-session
    if (stored.trackingData) {
      appData.trackingData = stored.trackingData;
    }
  }

  function computeStats() {
    const docs = appData.documents;
    const sessions = appData.sessions;

    const totalChars = appData.trackingData?.charCount || 0;
    const totalTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 1000 || 0;
    const avgAi = appData.analyses.length
      ? Math.round(appData.analyses.reduce((sum, a) => sum + (a.aiPercent || 0), 0) / appData.analyses.length)
      : 0;

    return {
      docs: docs.length,
      chars: totalChars,
      hours: (totalTime / 3600).toFixed(1),
      avgAi
    };
  }

  function updateOverview() {
    const stats = computeStats();
    document.getElementById('overview-docs').textContent = stats.docs;
    document.getElementById('overview-chars').textContent = formatNumber(stats.chars);
    document.getElementById('overview-time').textContent = `${stats.hours}h`;
    document.getElementById('overview-ai').textContent = `${stats.avgAi}%`;
    document.getElementById('donut-ai-value').textContent = `${stats.avgAi}%`;

    renderRecentDocs();
  }

  function renderRecentDocs() {
    const container = document.getElementById('recent-docs');
    if (appData.documents.length === 0) return; // Keep empty state

    container.innerHTML = '';
    appData.documents.slice(0, 5).forEach(doc => {
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
          <div class="doc-item-meta">${doc.wordCount || 0} words • ${formatDate(doc.lastModified)}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // === Chart Rendering ===

  function renderView(viewName) {
    switch (viewName) {
      case 'overview':
        updateOverview();
        drawActivityChart();
        drawAiDonut();
        break;
      case 'analytics':
        drawVelocityChart();
        drawHoursChart();
        drawSessionChart();
        break;
      case 'ai-detection':
        drawAiHistoryChart();
        break;
    }
  }

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

    // Sample data (replace with real data when available)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const chars = appData.documents.length ? generateSampleSeries(7, 100, 800) : [];
    const time = appData.documents.length ? generateSampleSeries(7, 20, 180) : [];

    if (chars.length === 0) {
      drawEmptyChart(ctx, w, h, 'No activity data yet');
      return;
    }

    const maxVal = Math.max(...chars, ...time, 1);
    const chartW = w - 50;
    const stepX = chartW / (days.length - 1);

    // Time bars
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    time.forEach((val, i) => {
      const barH = (val / maxVal) * (h - 40);
      ctx.fillRect(40 + i * stepX - 12, h - 20 - barH, 24, barH);
    });

    // Chars line
    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    chars.forEach((val, i) => {
      const x = 40 + i * stepX;
      const y = h - 20 - (val / maxVal) * (h - 40);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Points
    chars.forEach((val, i) => {
      const x = 40 + i * stepX;
      const y = h - 20 - (val / maxVal) * (h - 40);
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
    days.forEach((day, i) => {
      ctx.fillText(day, 40 + i * stepX, h - 4);
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

    const stats = computeStats();
    const aiPercent = stats.avgAi / 100;

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 28;
    ctx.stroke();

    // AI arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * aiPercent));
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function drawVelocityChart() {
    const canvas = document.getElementById('velocity-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (appData.documents.length === 0 && !appData.trackingData) {
      drawEmptyChart(ctx, w, h, 'No velocity data yet');
      return;
    }

    const data = generateSampleSeries(20, 10, 80);
    const maxVal = Math.max(...data, 1);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    data.forEach((val, i) => {
      const x = (w / (data.length - 1)) * i;
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
    ctx.lineJoin = 'round';
    data.forEach((val, i) => {
      const x = (w / (data.length - 1)) * i;
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

    if (appData.documents.length === 0 && !appData.trackingData) {
      drawEmptyChart(ctx, w, h, 'No activity data yet');
      return;
    }

    const hours = ['6a', '9a', '12p', '3p', '6p', '9p'];
    const data = generateSampleSeries(6, 10, 100);
    const maxVal = Math.max(...data, 1);
    const barW = (w - 40) / hours.length - 10;

    data.forEach((val, i) => {
      const barH = (val / maxVal) * (h - 40);
      const x = 20 + i * ((w - 40) / hours.length);
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
      ctx.fillText(hours[i], x + barW / 2, h - 8);
    });
  }

  function drawSessionChart() {
    const canvas = document.getElementById('session-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (appData.sessions.length === 0 && !appData.trackingData) {
      drawEmptyChart(ctx, w, h, 'No session data yet');
      return;
    }

    const buckets = ['<5m', '5-15m', '15-30m', '30-60m', '1h+'];
    const data = generateSampleSeries(5, 2, 20);
    const maxVal = Math.max(...data, 1);
    const barW = (w - 60) / buckets.length - 20;

    data.forEach((val, i) => {
      const barH = (val / maxVal) * (h - 50);
      const x = 30 + i * ((w - 60) / buckets.length);
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
      ctx.fillText(buckets[i], x + barW / 2, h - 10);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(val, x + barW / 2, y - 6);
    });
  }

  function drawAiHistoryChart() {
    const canvas = document.getElementById('ai-history-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (appData.analyses.length === 0) {
      drawEmptyChart(ctx, w, h, 'No analyses yet');
      return;
    }

    const data = appData.analyses.slice(-10).map(a => a.aiPercent);
    const maxVal = 100;
    const stepX = (w - 40) / Math.max(data.length - 1, 1);

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    data.forEach((val, i) => {
      const x = 20 + i * stepX;
      const y = h - 20 - (val / maxVal) * (h - 40);
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

  function generateSampleSeries(count, min, max) {
    return Array.from({ length: count }, () => Math.floor(Math.random() * (max - min)) + min);
  }

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 3600) return 'Just now';
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // === Settings Handlers ===

  document.getElementById('btn-save-supabase').addEventListener('click', async () => {
    const url = document.getElementById('input-supabase-url').value.trim();
    const key = document.getElementById('input-supabase-key').value.trim();
    await VerifieSettings.saveEndpoints({ ...appData.endpoints, supabaseUrl: url, supabaseAnonKey: key });
    appData.endpoints.supabaseUrl = url;
    appData.endpoints.supabaseAnonKey = key;
    updateConnectionStatus();
    alert('Supabase settings saved!');
  });

  document.getElementById('btn-save-hf').addEventListener('click', async () => {
    const token = document.getElementById('input-hf-token').value.trim();
    await VerifieSettings.saveEndpoints({ ...appData.endpoints, huggingFaceToken: token });
    appData.endpoints.huggingFaceToken = token;
    document.getElementById('hf-badge-2').textContent = token ? 'Configured' : 'Not configured';
    document.getElementById('hf-badge-2').className = token ? 'badge success' : 'badge';
    document.getElementById('hf-badge').textContent = token ? 'Configured' : 'Not configured';
    document.getElementById('hf-badge').className = token ? 'badge success' : 'badge';
    alert('Hugging Face token saved!');
  });

  document.getElementById('btn-save-worker').addEventListener('click', async () => {
    const url = document.getElementById('input-worker-url').value.trim();
    await VerifieSettings.saveEndpoints({ ...appData.endpoints, workerUrl: url });
    appData.endpoints.workerUrl = url;
    document.getElementById('gdocs-badge').textContent = url ? 'Configured' : 'Not configured';
    document.getElementById('gdocs-badge').className = url ? 'badge success' : 'badge';
    alert('Worker URL saved!');
  });

  document.getElementById('btn-export-data').addEventListener('click', async () => {
    const data = await VerifieStorage.get(['documents', 'sessions', 'analyses', 'trackingData']);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verifie-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-clear-data').addEventListener('click', async () => {
    if (confirm('Clear all local data? This cannot be undone.')) {
      await VerifieStorage.remove(['documents', 'sessions', 'analyses', 'trackingData']);
      appData.documents = [];
      appData.sessions = [];
      appData.analyses = [];
      updateOverview();
      alert('Local data cleared.');
    }
  });

  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await loadData();
    updateOverview();
    alert('Data refreshed.');
  });

  document.getElementById('btn-connect').addEventListener('click', () => {
    document.querySelector('[data-view="settings"]').click();
  });

  function updateConnectionStatus() {
    const statusEl = document.getElementById('connection-status');
    const hasCloud = !!appData.endpoints.supabaseUrl;
    statusEl.classList.toggle('connected', hasCloud);
    statusEl.querySelector('span').textContent = hasCloud ? 'Cloud Connected' : 'Local Mode';
    document.getElementById('supabase-badge').textContent = hasCloud ? 'Configured' : 'Not configured';
    document.getElementById('supabase-badge').className = hasCloud ? 'badge success' : 'badge';
  }

  // AI mode toggle
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      appData.settings.aiDetectionMode = btn.dataset.mode;
      VerifieSettings.save(appData.settings);
    });
  });

  // Init
  await loadData();
  updateOverview();
  updateConnectionStatus();

  // Restore settings inputs
  document.getElementById('input-supabase-url').value = appData.endpoints.supabaseUrl || '';
  document.getElementById('input-hf-token').value = appData.endpoints.huggingFaceToken ? '••••••••' : '';
  document.getElementById('input-worker-url').value = appData.endpoints.workerUrl || '';

  if (appData.endpoints.huggingFaceToken) {
    document.getElementById('hf-badge').textContent = 'Configured';
    document.getElementById('hf-badge').className = 'badge success';
    document.getElementById('hf-badge-2').textContent = 'Configured';
    document.getElementById('hf-badge-2').className = 'badge success';
  }
  if (appData.endpoints.workerUrl) {
    document.getElementById('gdocs-badge').textContent = 'Configured';
    document.getElementById('gdocs-badge').className = 'badge success';
  }

  // Draw initial charts
  drawActivityChart();
  drawAiDonut();

  // Redraw on resize
  window.addEventListener('resize', () => {
    renderView(document.querySelector('.nav-item.active')?.dataset.view || 'overview');
  });
});
