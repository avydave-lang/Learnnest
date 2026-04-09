// ─── Subject config (colours + icons) ─────────────────────────────────────
// Keys match the exact subject names used in topics.md and content-manifest.json.
// Add new entries here whenever a new subject is added.
const SUBJECT_CONFIG = {
  // Full names (used in offline fallback files)
  'Information Technology Standard XII':                 { color: '#0f766e', bg: '#f0fdfa', icon: '💻', label: 'IT' },
  'Secretarial Practice Standard XII':                   { color: '#7c3aed', bg: '#f5f3ff', icon: '📋', label: 'Sec. Practice' },
  'Book-Keeping and Accountancy Standard XII':           { color: '#be185d', bg: '#fdf2f8', icon: '🧾', label: 'Accountancy' },
  'Economics Standard XII':                             { color: '#0891b2', bg: '#ecfeff', icon: '📈', label: 'Economics' },
  'Organisation of Commerce and Management Standard XII':{ color: '#ea580c', bg: '#fff7ed', icon: '🏢', label: 'OCM' },
  'English Yuvakbharati Standard XII':                   { color: '#16a34a', bg: '#f0fdf4', icon: '📖', label: 'English' },
  // Abbreviated names (used in Google Sheets)
  'IT':          { color: '#0f766e', bg: '#f0fdfa', icon: '💻', label: 'IT' },
  'SP':          { color: '#7c3aed', bg: '#f5f3ff', icon: '📋', label: 'Sec. Practice' },
  'Accountancy': { color: '#be185d', bg: '#fdf2f8', icon: '🧾', label: 'Accountancy' },
  'Economics':   { color: '#0891b2', bg: '#ecfeff', icon: '📈', label: 'Economics' },
  'OCM':         { color: '#ea580c', bg: '#fff7ed', icon: '🏢', label: 'OCM' },
  'English':     { color: '#16a34a', bg: '#f0fdf4', icon: '📖', label: 'English' },
  'default':     { color: '#6b7280', bg: '#f9fafb', icon: '📚', label: '' }
};

const TYPE_ICONS = {
  youtube: '▶️', video: '🎥', audio: '🎵',
  pdf: '📄',
  ppt: '📊', pptx: '📊', gslides: '📊',
  doc: '📝', docx: '📝', gdoc: '📝',
  xls: '🗂️', xlsx: '🗂️', gsheet: '🗂️',
  image: '🖼️', link: '🔗', file: '📁'
};

const STORAGE_KEYS = {
  progress:   'learnnest-progress',
  history:    'learnnest-history',
  bookmarks:  'learnnest-bookmarks',
  studyDates: 'learnnest-study-dates'
};

const REVISION_DAYS = 14;

// ─── Google Sheet IDs ──────────────────────────────────────────────────────
const SHEET_IDS = {
  content:  '1LfxDKr9vX0inr6FgahPC5wyIHwjfaeQHtPhd0oEGmy0',   // Subject/Chapter/Topic/Content
  metadata: '1ETh_n0VZLEWJFXk31bbhsb34zKZ6Q-REA7bLPHTwnKM'    // Chapter summaries
};

// ─── App state ─────────────────────────────────────────────────────────────
let appState = {
  subjects:          {},
  contentMap:        {},
  chapterMeta:       {},
  currentSubject:    '',
  currentChapter:    '',
  currentTopic:      '',
  screen:            'home',
  expandedChapters:  new Set(),
  notesOpen:         false,
  search:            '',
  progress:          loadStoredJson(STORAGE_KEYS.progress,   {}),
  history:           loadStoredJson(STORAGE_KEYS.history,    []),
  bookmarks:         loadStoredJson(STORAGE_KEYS.bookmarks,  [])
};

// ─── Storage helpers ───────────────────────────────────────────────────────
function loadStoredJson(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function saveStoredJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ─── Subject helpers ───────────────────────────────────────────────────────
function getSubjectCfg(subject) {
  return SUBJECT_CONFIG[subject] || SUBJECT_CONFIG['default'];
}

// ─── Text helpers ──────────────────────────────────────────────────────────
function normalizeImportedText(value) {
  return String(value ?? '')
    .replace(/Ã¢â¬â¢|â€™/g, '\u2019')
    .replace(/Ã¢â¬Ë|â€˜/g,  '\u2018')
    .replace(/Ã¢â¬Å|â€œ/g,  '\u201c')
    .replace(/Ã¢â¬Â|â€|â€"/g,'\u201d')
    .replace(/Ã¢â¬â|â€"/g,  '\u2013')
    .replace(/Ã¢â¬â|â€"/g,  '\u2014')
    .replace(/Ã¢â¬Â¦|â€¦/g, '\u2026')
    .replace(/Â/g, '')
    .replace(/\u00a0/g, ' ');
}

function cleanDetailedSummary(value, fallback = '') {
  const c = normalizeImportedText(value).trim();
  if (!c || c.startsWith('[ERROR]')) return normalizeImportedText(fallback).trim();
  return c;
}

function summarizeText(value, max = 120) {
  const c = normalizeImportedText(value).trim();
  return c.length <= max ? c : `${c.slice(0, max).trim()}\u2026`;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function formatRichText(text) {
  const c = normalizeImportedText(text).trim();
  if (!c) return '';
  return c.split(/\n\s*\n/).map(block => {
    const safe = escapeHtml(block)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
    return `<p>${safe}</p>`;
  }).join('');
}

// ─── Data loading (all parallel) ───────────────────────────────────────────
async function loadTopics() {
  const res = await fetch('topics.md');
  if (!res.ok) throw new Error('Could not load topics.md');
  const text = await res.text();
  const subjects = {};
  let curSubject = null, curChapter = 'General';

  text.split('\n').forEach(rawLine => {
    const line = normalizeImportedText(rawLine).trim();
    if (!line) return;
    if (line.startsWith('## ')) {
      curSubject = normalizeImportedText(line.replace('## ', '')).trim();
      subjects[curSubject] = subjects[curSubject] || {};
      curChapter = 'General';
      return;
    }
    if (line.startsWith('### ') && curSubject) {
      curChapter = normalizeImportedText(line.replace('### ', '')).trim() || 'General';
      subjects[curSubject][curChapter] = subjects[curSubject][curChapter] || [];
      return;
    }
    if (line.startsWith('- ') && curSubject) {
      const topic = normalizeImportedText(line.replace('- ', '')).trim();
      if (!subjects[curSubject][curChapter]) subjects[curSubject][curChapter] = [];
      subjects[curSubject][curChapter].push(topic);
    }
  });
  Object.keys(subjects).forEach(s => { if (!Object.keys(subjects[s]).length) delete subjects[s]; });
  return subjects;
}

async function loadContentManifest() {
  try {
    const res = await fetch('content/content-manifest.json');
    if (!res.ok) throw new Error('manifest missing');
    return await res.json();
  } catch { return {}; }
}

async function loadChapterMetadata() {
  try {
    const res = await fetch('content/chapter-metadata.json');
    if (!res.ok) throw new Error('chapter-metadata missing');
    const raw = await res.json();
    const cleaned = {};
    Object.entries(raw || {}).forEach(([subject, chapters]) => {
      const cs = normalizeImportedText(subject).trim();
      if (!cs) return;
      cleaned[cs] = {};
      Object.entries(chapters || {}).forEach(([chapter, info]) => {
        const cc = normalizeImportedText(chapter).trim();
        if (!cc) return;
        const summary = normalizeImportedText(info?.summary || '').trim();
        cleaned[cs][cc] = {
          summary,
          detailedSummary: cleanDetailedSummary(info?.detailedSummary || '', summary)
        };
      });
    });
    return cleaned;
  } catch { return {}; }
}

// ─── Google Sheets integration ─────────────────────────────────────────────
// Uses the gviz/tq JSON endpoint — no API key needed.
// Sheets must be "Share → Anyone with the link → Viewer".
// Data refreshes in under 60 seconds (vs 5–15 min for published CSV).

async function fetchGvizSheet(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=Sheet1&headers=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const text = await res.text();
  // Strip JSONP wrapper: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
  const json = JSON.parse(text.replace(/^[^{]*/, '').replace(/\);\s*$/, ''));
  const cols = json.table.cols.map(c => c.label);
  return json.table.rows
    .filter(r => r.c)
    .map(r => {
      const obj = {};
      r.c.forEach((cell, i) => { obj[cols[i]] = cell?.v ?? ''; });
      return obj;
    });
}

// Returns { subjects, contentMap } from the content sheet.
// subjects:    { subject → { chapter → [topic, ...] } }
// contentMap:  { subject → { chapter → { topic → [item, ...] } } }
async function loadFromContentSheet() {
  const rows = await fetchGvizSheet(SHEET_IDS.content);
  const subjects   = {};
  const contentMap = {};

  rows.forEach(row => {
    const subject = normalizeImportedText(row['Subject']).trim();
    const chapter = normalizeImportedText(row['Chapter']).trim();
    const topic   = normalizeImportedText(row['Topic']).trim();
    if (!subject || !chapter || !topic) return;

    // Build subject → chapter → topics hierarchy
    subjects[subject] = subjects[subject] || {};
    subjects[subject][chapter] = subjects[subject][chapter] || [];
    if (!subjects[subject][chapter].includes(topic)) subjects[subject][chapter].push(topic);

    // Build content items
    const type     = normalizeImportedText(row['Content Type']).trim().toLowerCase();
    const title    = normalizeImportedText(row['Title']).trim();
    const file     = String(row['file link or id'] ?? '').trim();
    const desc     = normalizeImportedText(row['Description']).trim();
    const order    = Number(row['Order']) || 999;
    const featured = String(row['Is_featured'] ?? '').toLowerCase() === 'true';

    if (type && title && file) {
      // Auto-detect URL type regardless of Content Type column
      let resolvedType = type;
      if (file.includes('youtu.be') || file.includes('youtube.com')) resolvedType = 'youtube';
      else if (file.includes('docs.google.com')) resolvedType = detectGoogleType(file) || type;
      contentMap[subject] = contentMap[subject] || {};
      contentMap[subject][chapter] = contentMap[subject][chapter] || {};
      contentMap[subject][chapter][topic] = contentMap[subject][chapter][topic] || [];
      contentMap[subject][chapter][topic].push({ type: resolvedType, title, file, description: desc, order, featured });
    }
  });

  // Sort items within each topic by Order column, then featured first
  Object.values(contentMap).forEach(chapters =>
    Object.values(chapters).forEach(topics =>
      Object.values(topics).forEach(items =>
        items.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.order - b.order)
      )
    )
  );

  return { subjects, contentMap };
}

// Returns { subject → { chapter → { summary, detailedSummary } } } from the metadata sheet.
async function loadFromMetadataSheet() {
  const rows = await fetchGvizSheet(SHEET_IDS.metadata);
  const meta = {};

  rows.forEach(row => {
    const subject  = normalizeImportedText(row['Subject']).trim();
    const chapter  = normalizeImportedText(row['Chapter']).trim();
    const summary  = normalizeImportedText(row['Summary']).trim();
    const detailed = cleanDetailedSummary(row['Detailed Summary'] || '', summary);
    if (!subject || !chapter) return;
    meta[subject] = meta[subject] || {};
    meta[subject][chapter] = { summary, detailedSummary: detailed };
  });

  return meta;
}

// ─── Data accessors ────────────────────────────────────────────────────────
function getChapters(subject) {
  return Object.keys(appState.subjects?.[subject] || {});
}
function getTopics(subject, chapter) {
  return appState.subjects?.[subject]?.[chapter] || [];
}
function getTopicKey(subject, chapter, topic) {
  return `${subject}::${chapter}::${topic}`;
}
function getTopicProgress(subject, chapter, topic) {
  return appState.progress[getTopicKey(subject, chapter, topic)] || {};
}
function getChapterMetadata(subject, chapter) {
  return appState.chapterMeta?.[subject]?.[chapter] || { summary: '', detailedSummary: '' };
}
function getItems(subject, chapter, topic) {
  const bucket = appState.contentMap?.[subject] || {};
  if (Array.isArray(bucket[topic]))              return bucket[topic];
  if (Array.isArray(bucket[chapter]?.[topic]))   return bucket[chapter][topic];
  if (Array.isArray(bucket.General?.[topic]))    return bucket.General[topic];
  return [];
}
function getAllTopics() {
  return Object.entries(appState.subjects).flatMap(([subject, chapters]) =>
    Object.entries(chapters).flatMap(([chapter, topics]) =>
      topics.map(topic => ({ subject, chapter, topic, itemCount: getItems(subject, chapter, topic).length }))
    )
  );
}
function getCompletionPercent(subject) {
  const entries = getAllTopics().filter(e => e.subject === subject);
  if (!entries.length) return 0;
  const done = entries.filter(e => getTopicProgress(e.subject, e.chapter, e.topic).completed).length;
  return Math.round((done / entries.length) * 100);
}
function isBookmarked(subject, chapter, topic) {
  return appState.bookmarks.some(b => b.subject === subject && b.topic === topic && (!b.chapter || b.chapter === chapter));
}
function matchesSearch(subject, chapter = '', topic = '') {
  if (!appState.search) return true;
  const q = appState.search.toLowerCase();
  return [subject, chapter, topic].some(v => String(v).toLowerCase().includes(q));
}
function getTopicsNeedingRevision() {
  const cutoff = Date.now() - REVISION_DAYS * 86400000;
  return getAllTopics().filter(({ subject, chapter, topic }) => {
    const p = getTopicProgress(subject, chapter, topic);
    return p.lastOpenedAt && p.lastOpenedAt < cutoff;
  }).slice(0, 5);
}
function getChapterContentTypes(subject, chapter) {
  const types = new Set();
  getTopics(subject, chapter).forEach(topic =>
    getItems(subject, chapter, topic).forEach(item => {
      if (item.type) types.add(item.type.toLowerCase());
    })
  );
  return [...types];
}

// ─── Streak ────────────────────────────────────────────────────────────────
function recordStudyToday() {
  const today = new Date().toISOString().slice(0, 10);
  const dates = loadStoredJson(STORAGE_KEYS.studyDates, []);
  if (!dates.includes(today)) {
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const kept = dates.filter(d => d >= cutoff);
    kept.push(today);
    saveStoredJson(STORAGE_KEYS.studyDates, kept);
  }
}

function getStreak() {
  const dates = [...new Set(loadStoredJson(STORAGE_KEYS.studyDates, []))].sort().reverse();
  if (!dates.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dates[0] !== today && dates[0] !== yesterday) return 0;
  let count = 0;
  let check = new Date(dates[0]);
  for (const d of dates) {
    if (d === check.toISOString().slice(0, 10)) {
      count++;
      check = new Date(check.getTime() - 86400000);
    } else { break; }
  }
  return count;
}

// ─── Toast ─────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ─── Screen navigation ─────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${name}`);
  if (target) target.classList.add('active');
  appState.screen = name;

  // Sync bottom nav active state
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const nav = btn.dataset.nav;
    const active = nav === name
      || (nav === 'subjects' && (name === 'subject' || name === 'viewer'))
      || (nav === 'progress' && name === 'progress');
    btn.classList.toggle('active', active);
  });
}

function navigateToSubject(subject) {
  appState.currentSubject = subject;
  renderSubjectScreen();
  showScreen('subject');
  document.getElementById('chapters-scroll').scrollTop = 0;
}

function navigateToViewer(subject, chapter, topic) {
  if (!subject || !chapter || !topic) return;
  appState.currentSubject = subject;
  appState.currentChapter = chapter;
  appState.currentTopic   = topic;

  // Record progress timestamp
  const key = getTopicKey(subject, chapter, topic);
  appState.progress[key] = { ...getTopicProgress(subject, chapter, topic), lastOpenedAt: Date.now() };
  saveStoredJson(STORAGE_KEYS.progress, appState.progress);

  // Update history
  appState.history = [
    { subject, chapter, topic, timestamp: Date.now() },
    ...appState.history.filter(h => !(h.subject === subject && h.topic === topic))
  ].slice(0, 8);
  saveStoredJson(STORAGE_KEYS.history, appState.history);

  recordStudyToday();
  renderViewerScreen();
  showScreen('viewer');
  document.getElementById('viewer-scroll').scrollTop = 0;
}

function navigateBack() {
  if (appState.screen === 'viewer') {
    renderSubjectScreen();
    showScreen('subject');
  } else {
    renderHomeScreen();
    showScreen('home');
  }
}

// ─── Notes drawer ──────────────────────────────────────────────────────────
function openNotes() {
  document.getElementById('notes-drawer').classList.add('open');
  document.getElementById('notes-overlay').classList.add('open');
  appState.notesOpen = true;
  const ta = document.getElementById('notes-ta');
  const p  = getTopicProgress(appState.currentSubject, appState.currentChapter, appState.currentTopic);
  ta.value = p.notes || '';
  setTimeout(() => ta.focus(), 280);
}

function closeNotes() {
  document.getElementById('notes-drawer').classList.remove('open');
  document.getElementById('notes-overlay').classList.remove('open');
  appState.notesOpen = false;
}

// ─── Topic prev/next ───────────────────────────────────────────────────────
function currentTopicIndex() {
  return getTopics(appState.currentSubject, appState.currentChapter).indexOf(appState.currentTopic);
}

function navigatePrevTopic() {
  const topics = getTopics(appState.currentSubject, appState.currentChapter);
  const idx = currentTopicIndex();
  if (idx > 0) navigateToViewer(appState.currentSubject, appState.currentChapter, topics[idx - 1]);
}

function navigateNextTopic() {
  const topics = getTopics(appState.currentSubject, appState.currentChapter);
  const idx = currentTopicIndex();
  if (idx < topics.length - 1) navigateToViewer(appState.currentSubject, appState.currentChapter, topics[idx + 1]);
}

// ─── Content card renderers ────────────────────────────────────────────────
function getYoutubeEmbedUrl(url) {
  if (!url) return '';
  try {
    const p = new URL(url);
    if (p.hostname.includes('youtu.be')) {
      const id = p.pathname.replace('/', '').trim();
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
    if (p.hostname.includes('youtube.com')) {
      if (p.pathname.includes('/embed/')) return url;
      const id = p.searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}` : '';
    }
  } catch { return ''; }
  return '';
}

function getDriveFileId(url) {
  if (!url) return '';
  // Raw file ID (no slashes or protocol — pasted directly from Drive)
  if (!url.includes('/') && !url.includes(':') && /^[A-Za-z0-9_-]{20,}$/.test(url.trim())) {
    return url.trim();
  }
  try {
    const p = new URL(url);
    if (p.hostname.includes('drive.google.com')) {
      const m = p.pathname.match(/\/file\/d\/([^/]+)/);
      if (m?.[1]) return m[1];
      return p.searchParams.get('id') || '';
    }
    // Google Docs / Sheets / Slides / Forms — path is /document/d/ID, /spreadsheets/d/ID, etc.
    if (p.hostname.includes('docs.google.com')) {
      const m = p.pathname.match(/\/d\/([^/]+)/);
      return m?.[1] || '';
    }
  } catch { return ''; }
  return '';
}

// Detect Google Workspace file type from URL when no explicit type is given
function detectGoogleType(url) {
  try {
    const p = new URL(url);
    if (!p.hostname.includes('docs.google.com')) return null;
    if (p.pathname.includes('/document/'))     return 'gdoc';
    if (p.pathname.includes('/spreadsheets/')) return 'gsheet';
    if (p.pathname.includes('/presentation/')) return 'gslides';
    if (p.pathname.includes('/forms/'))        return 'gform';
  } catch { return null; }
  return null;
}

function getRenderableUrl(url, type) {
  const id = getDriveFileId(url);
  // Google Workspace native files — use their own embed URLs
  if (type === 'gdoc')    return id ? `https://docs.google.com/document/d/${id}/preview` : url;
  if (type === 'gsheet')  return id ? `https://docs.google.com/spreadsheets/d/${id}/htmlview` : url;
  if (type === 'gslides') return id ? `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false` : url;
  if (type === 'gform')   return url; // Forms can't embed — open externally
  // Drive-hosted files (Office formats + PDF + media)
  if (!id) return url || '#';
  if (type === 'pdf' || type === 'ppt' || type === 'pptx' || type === 'doc' || type === 'docx' || type === 'xls' || type === 'xlsx') {
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  if (type === 'audio' || type === 'video') return `https://drive.google.com/uc?export=download&id=${id}`;
  if (type === 'image') return `https://drive.google.com/uc?export=view&id=${id}`;
  return `https://drive.google.com/file/d/${id}/view`;
}

function getOpenUrl(url) {
  const id = getDriveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/view` : (url || '#');
}

function sortItems(items) {
  const rank = { youtube: 0, video: 1, audio: 2, pdf: 3, ppt: 4, pptx: 4, gslides: 4, doc: 5, docx: 5, gdoc: 5, xls: 6, xlsx: 6, gsheet: 6, image: 7, link: 8, file: 9 };
  return [...items].sort((a, b) => {
    const fd = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
    if (fd !== 0) return fd;
    return (rank[(a.type||'file').toLowerCase()] ?? 99) - (rank[(b.type||'file').toLowerCase()] ?? 99);
  });
}

function renderContentCard(item) {
  const title = escapeHtml(item.title || 'Untitled');
  const type  = (item.type || 'file').toLowerCase();
  const file  = item.file || '#';
  const rUrl  = getRenderableUrl(file, type);
  const oUrl  = getOpenUrl(file);
  const meta  = escapeHtml([item.type ? item.type.toUpperCase() : 'FILE', item.duration || item.pages || item.description || ''].filter(Boolean).join(' · '));

  if (type === 'youtube') {
    const embed = getYoutubeEmbedUrl(file);
    return `<div class="content-card">
      <h4>▶️ ${title}</h4><p class="resource-meta">${meta}</p>
      ${embed ? `<iframe class="pdf-frame" src="${escapeHtml(embed)}" title="${title}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '<p style="color:var(--muted);font-size:14px">Invalid YouTube URL.</p>'}
      <a href="${escapeHtml(file)}" target="_blank" rel="noopener">Open on YouTube ↗</a></div>`;
  }
  if (type === 'video') {
    return `<div class="content-card">
      <h4>🎥 ${title}</h4><p class="resource-meta">${meta}</p>
      <video controls preload="metadata" class="media-player"><source src="${escapeHtml(rUrl)}">Your browser cannot play this video.</video>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open video ↗</a></div>`;
  }
  if (type === 'audio') {
    return `<div class="content-card">
      <h4>🎵 ${title}</h4><p class="resource-meta">${meta}</p>
      <audio controls preload="metadata" class="media-player"><source src="${escapeHtml(rUrl)}">Your browser cannot play this audio.</audio>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open audio ↗</a></div>`;
  }
  if (type === 'pdf') {
    return `<div class="content-card">
      <h4>📄 ${title}</h4><p class="resource-meta">${meta}</p>
      <iframe src="${escapeHtml(rUrl)}" class="pdf-frame" title="${title}"></iframe>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open PDF ↗</a></div>`;
  }
  if (type === 'ppt' || type === 'pptx' || type === 'gslides') {
    return `<div class="content-card">
      <h4>📊 ${title}</h4><p class="resource-meta">${meta}</p>
      <iframe src="${escapeHtml(rUrl)}" class="pdf-frame" title="${title}" allowfullscreen></iframe>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open slides ↗</a></div>`;
  }
  if (type === 'doc' || type === 'docx' || type === 'gdoc') {
    return `<div class="content-card">
      <h4>📝 ${title}</h4><p class="resource-meta">${meta}</p>
      <iframe src="${escapeHtml(rUrl)}" class="pdf-frame" title="${title}"></iframe>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open document ↗</a></div>`;
  }
  if (type === 'xls' || type === 'xlsx' || type === 'gsheet') {
    return `<div class="content-card">
      <h4>🗂️ ${title}</h4><p class="resource-meta">${meta}</p>
      <iframe src="${escapeHtml(rUrl)}" class="pdf-frame" title="${title}"></iframe>
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open spreadsheet ↗</a></div>`;
  }
  if (type === 'gform') {
    return `<div class="content-card">
      <h4>📋 ${title}</h4><p class="resource-meta">${meta}</p>
      ${desc ? `<p style="font-size:14px;color:var(--muted);margin-bottom:10px">${escapeHtml(desc)}</p>` : ''}
      <a href="${escapeHtml(file)}" target="_blank" rel="noopener">Open form ↗</a></div>`;
  }
  if (type === 'image') {
    return `<div class="content-card">
      <h4>🖼️ ${title}</h4><p class="resource-meta">${meta}</p>
      <img src="${escapeHtml(rUrl)}" alt="${title}" class="media-player" style="object-fit:contain;background:#f8fbff;">
      <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open image ↗</a></div>`;
  }
  if (type === 'link') {
    return `<div class="content-card">
      <h4>🔗 ${title}</h4><p class="resource-meta">${meta}</p>
      ${desc ? `<p style="font-size:14px;color:var(--muted);margin-bottom:10px">${escapeHtml(desc)}</p>` : ''}
      <a href="${escapeHtml(file)}" target="_blank" rel="noopener">Open link ↗</a></div>`;
  }
  return `<div class="content-card">
    <h4>📁 ${title}</h4><p class="resource-meta">${meta}</p>
    <a href="${escapeHtml(oUrl)}" target="_blank" rel="noopener">Open file ↗</a></div>`;
}

// ─── Shared list-item HTML builder ─────────────────────────────────────────
function buildListItems(items, defaultDotClass) {
  if (!items.length) return '<p class="empty-note">Nothing here yet.</p>';
  return `<div class="list-stack">${items.map(({ subject, chapter, topic }) => {
    const p   = getTopicProgress(subject, chapter, topic);
    const dot = p.completed ? 'dot-done' : defaultDotClass;
    const cnt = getItems(subject, chapter, topic).length;
    const cfg = getSubjectCfg(subject);
    return `<button class="list-item" type="button"
        data-subject="${escapeHtml(subject)}"
        data-chapter="${escapeHtml(chapter)}"
        data-topic="${escapeHtml(topic)}">
      <div class="li-dot ${dot}"></div>
      <div class="li-body">
        <div class="li-kicker" style="color:${cfg.color}">${escapeHtml(cfg.label || subject)}</div>
        <div class="li-title">${escapeHtml(topic)}</div>
        <div class="li-meta">${escapeHtml(chapter)} · ${cnt} item${cnt !== 1 ? 's' : ''}</div>
      </div>
      <span class="li-arrow">›</span>
    </button>`;
  }).join('')}</div>`;
}

function attachListEvents(container) {
  container.querySelectorAll('.list-item').forEach(btn =>
    btn.addEventListener('click', () =>
      navigateToViewer(btn.dataset.subject, btn.dataset.chapter, btn.dataset.topic))
  );
}

// ─── Home screen ───────────────────────────────────────────────────────────
function renderHomeScreen() {
  renderStreakBadge();
  renderContinueCard();
  renderFocusCard();
  renderSubjectGrid();
  renderNeedsRevision();
  renderRecentList();
}

function renderStreakBadge() {
  const badge = document.getElementById('streak-badge');
  const s = getStreak();
  badge.textContent = s > 0 ? `🔥 ${s} day${s === 1 ? '' : 's'}` : '';
  badge.style.display = s > 0 ? '' : 'none';
}

function renderContinueCard() {
  const wrap = document.getElementById('continue-card');
  const latest = appState.history[0];

  if (!latest) {
    wrap.innerHTML = `<div class="continue-card continue-card-empty">
      <div class="cc-eyebrow">Welcome to LearnNest</div>
      <div class="cc-topic">Start learning today</div>
      <div class="cc-meta">Choose a subject below to begin.</div>
    </div>`;
    return;
  }

  const { subject, chapter, topic } = latest;
  const p   = getTopicProgress(subject, chapter, topic);
  const cnt = getItems(subject, chapter, topic).length;
  const cfg = getSubjectCfg(subject);

  wrap.innerHTML = `<div class="continue-card" id="continue-card-inner" style="background:linear-gradient(135deg,${cfg.color},${cfg.color}bb)">
    <div class="cc-eyebrow">Continue learning</div>
    <div class="cc-topic">${escapeHtml(topic)}</div>
    <div class="cc-meta">${escapeHtml(cfg.label || subject)} · ${escapeHtml(chapter)} · ${cnt} item${cnt !== 1 ? 's' : ''}</div>
    <div class="cc-progress"><div class="cc-progress-fill" style="width:${p.completed ? 100 : 30}%"></div></div>
    <button class="cc-btn" type="button">Resume ›</button>
  </div>`;

  const card = document.getElementById('continue-card-inner');
  card.addEventListener('click', () => navigateToViewer(subject, chapter, topic));
}

function renderFocusCard() {
  const card = document.getElementById('focus-card');
  const subjects = Object.keys(appState.subjects);
  const withContent = subjects.filter(s => getAllTopics().some(t => t.subject === s && t.itemCount > 0));

  if (!withContent.length) { card.style.display = 'none'; return; }

  const lowestSubject = [...withContent].sort((a, b) => getCompletionPercent(a) - getCompletionPercent(b))[0];
  const pct = getCompletionPercent(lowestSubject);
  if (pct === 100) { card.style.display = 'none'; return; }

  const cfg = getSubjectCfg(lowestSubject);
  card.style.display = 'flex';
  card.innerHTML = `<div class="focus-icon">${cfg.icon}</div>
    <div class="focus-body">
      <strong>Focus on ${escapeHtml(cfg.label || lowestSubject)} today</strong>
      <span>Only ${pct}% complete — your lowest subject</span>
    </div>`;
  card.onclick = () => navigateToSubject(lowestSubject);
}

function renderSubjectGrid() {
  const grid = document.getElementById('subject-grid');
  const subjects = Object.entries(appState.subjects).filter(([s, chapters]) =>
    matchesSearch(s) || Object.entries(chapters).some(([c, topics]) =>
      matchesSearch(s, c) || topics.some(t => matchesSearch(s, c, t)))
  );

  if (!subjects.length) {
    grid.innerHTML = '<p class="empty-note">No subjects match your search.</p>';
    return;
  }

  grid.innerHTML = subjects.map(([subject, chapters]) => {
    const chapterCount = Object.keys(chapters).length;
    const topicCount   = Object.values(chapters).reduce((n, ts) => n + ts.length, 0);
    const pct = getCompletionPercent(subject);
    const cfg = getSubjectCfg(subject);

    return `<button class="subject-card" type="button" style="--sc:${cfg.color}"
        data-subject="${escapeHtml(subject)}">
      <span class="sc-icon">${cfg.icon}</span>
      <span class="sc-name">${escapeHtml(cfg.label || subject)}</span>
      <span class="sc-meta">${chapterCount} ch · ${topicCount} topic${topicCount !== 1 ? 's' : ''} · ${pct}%</span>
      <div class="sc-bar"><div class="sc-bar-fill" style="width:${pct}%"></div></div>
    </button>`;
  }).join('');

  grid.querySelectorAll('.subject-card').forEach(card =>
    card.addEventListener('click', () => navigateToSubject(card.dataset.subject))
  );
}

function renderNeedsRevision() {
  const section = document.getElementById('revision-section');
  const list    = document.getElementById('revision-list');
  const badge   = document.getElementById('revision-count');
  const items   = getTopicsNeedingRevision();

  if (!items.length) { section.style.display = 'none'; return; }
  section.style.display = '';
  badge.textContent = items.length;
  list.innerHTML = buildListItems(items, 'dot-revision');
  attachListEvents(list.parentElement);
}

function renderRecentList() {
  const el    = document.getElementById('recent-list');
  const items = appState.history.slice(0, 5).map(h => ({ subject: h.subject, chapter: h.chapter, topic: h.topic }));
  el.innerHTML = items.length
    ? buildListItems(items, 'dot-progress')
    : '<p class="empty-note">Topics you open will appear here.</p>';
  if (items.length) attachListEvents(el);
}

// ─── Subject screen ────────────────────────────────────────────────────────
function renderSubjectScreen() {
  const subject = appState.currentSubject;
  const cfg     = getSubjectCfg(subject);
  const pct     = getCompletionPercent(subject);

  document.getElementById('subject-header-icon').textContent = cfg.icon;
  document.getElementById('subject-header-name').textContent = cfg.label || subject;
  document.getElementById('subject-header-pct').textContent  = `${pct}% done`;

  const accordion = document.getElementById('chapters-accordion');
  const chapters  = getChapters(subject);

  if (!chapters.length) {
    accordion.innerHTML = '<p class="empty-note" style="padding:16px">No chapters found.</p>';
    return;
  }

  accordion.innerHTML = chapters.map((chapter, idx) => {
    const topics    = getTopics(subject, chapter);
    const meta      = getChapterMetadata(subject, chapter);
    const types     = getChapterContentTypes(subject, chapter);
    const typeStr   = types.slice(0, 4).map(t => TYPE_ICONS[t] || '').filter(Boolean).join('');
    const isOpen    = appState.expandedChapters.has(`${subject}::${chapter}`);

    const dots = topics.map(topic => {
      const p   = getTopicProgress(subject, chapter, topic);
      const cls = p.completed ? 'dot-done' : (p.lastOpenedAt ? 'dot-progress' : 'dot-empty');
      return `<span class="topic-dot ${cls}" title="${escapeHtml(topic)}"></span>`;
    }).join('');

    const topicRows = topics.map(topic => {
      const p      = getTopicProgress(subject, chapter, topic);
      const items  = getItems(subject, chapter, topic);
      const icons  = [...new Set(items.map(i => TYPE_ICONS[(i.type||'').toLowerCase()] || '').filter(Boolean))].join('');
      const dotCls = p.completed ? 'dot-done' : (p.lastOpenedAt ? 'dot-progress' : 'dot-empty');

      return `<div class="topic-row"
          data-subject="${escapeHtml(subject)}"
          data-chapter="${escapeHtml(chapter)}"
          data-topic="${escapeHtml(topic)}">
        <span class="topic-dot ${dotCls}"></span>
        <span class="topic-row-name ${p.completed ? 'done' : ''}">${escapeHtml(topic)}</span>
        <span class="topic-type-icons">${icons}</span>
        <span class="topic-row-arrow">›</span>
      </div>`;
    }).join('');

    const summaryHtml = meta.summary
      ? `<div class="ch-summary">${escapeHtml(summarizeText(meta.summary, 130))}</div>`
      : '';

    return `<div class="chapter-card ${isOpen ? 'open' : ''}" data-chapter="${escapeHtml(chapter)}">
      <div class="chapter-card-hdr">
        <div class="ch-num" style="background:${cfg.bg};color:${cfg.color}">${idx + 1}</div>
        <div class="ch-info">
          <div class="ch-name">${escapeHtml(chapter)}</div>
          <div class="ch-meta">${topics.length} topic${topics.length !== 1 ? 's' : ''}${typeStr ? ' · ' + typeStr : ''}</div>
          <div class="ch-dots">${dots}</div>
        </div>
        <div class="ch-right">
          <button class="quiz-chip" data-chapter="${escapeHtml(chapter)}" type="button">Quiz</button>
          <span class="ch-chevron">›</span>
        </div>
      </div>
      <div class="chapter-card-body">
        ${summaryHtml}
        ${topicRows}
      </div>
    </div>`;
  }).join('');

  // Accordion toggle (header click, not quiz chip)
  accordion.querySelectorAll('.chapter-card-hdr').forEach(hdr => {
    hdr.addEventListener('click', e => {
      if (e.target.closest('.quiz-chip')) return;
      const card    = hdr.closest('.chapter-card');
      const chapter = card.dataset.chapter;
      const key     = `${subject}::${chapter}`;
      if (appState.expandedChapters.has(key)) {
        appState.expandedChapters.delete(key);
        card.classList.remove('open');
      } else {
        appState.expandedChapters.add(key);
        card.classList.add('open');
      }
    });
  });

  // Topic tap
  accordion.querySelectorAll('.topic-row').forEach(row =>
    row.addEventListener('click', () =>
      navigateToViewer(row.dataset.subject, row.dataset.chapter, row.dataset.topic))
  );

  // Quiz chips (placeholder until AI is wired up)
  accordion.querySelectorAll('.quiz-chip').forEach(btn =>
    btn.addEventListener('click', e => { e.stopPropagation(); showToast('AI Quiz — coming soon!'); })
  );
}

// ─── Viewer screen ─────────────────────────────────────────────────────────
function renderViewerScreen() {
  const { currentSubject: subject, currentChapter: chapter, currentTopic: topic } = appState;
  const topics  = getTopics(subject, chapter);
  const idx     = topics.indexOf(topic);
  const items   = sortItems(getItems(subject, chapter, topic));
  const p       = getTopicProgress(subject, chapter, topic);
  const bkd     = isBookmarked(subject, chapter, topic);
  const meta    = getChapterMetadata(subject, chapter);
  const cfg     = getSubjectCfg(subject);

  // Breadcrumb
  const crumb = document.getElementById('viewer-crumb');
  crumb.querySelector('.viewer-crumb-path').textContent = `${cfg.label || subject} › ${chapter}`;
  crumb.querySelector('.viewer-crumb-topic').textContent = topic;

  // Bookmark
  const bkBtn = document.getElementById('bookmark-btn');
  bkBtn.textContent = bkd ? '★' : '☆';
  bkBtn.style.color = bkd ? '#eab308' : '';
  bkBtn.title = bkd ? 'Remove bookmark' : 'Bookmark';
  bkBtn.onclick = () => {
    if (isBookmarked(subject, chapter, topic)) {
      appState.bookmarks = appState.bookmarks.filter(b => !(b.subject === subject && b.topic === topic));
    } else {
      appState.bookmarks.unshift({ subject, chapter, topic, savedAt: Date.now() });
    }
    saveStoredJson(STORAGE_KEYS.bookmarks, appState.bookmarks);
    renderViewerScreen();
    showToast(isBookmarked(subject, chapter, topic) ? 'Bookmarked ★' : 'Bookmark removed');
  };

  // Complete button
  const compBtn = document.getElementById('complete-btn');
  compBtn.textContent = p.completed ? '✓ Done' : 'Mark done';
  compBtn.className  = `pill-btn ${p.completed ? 'pill-done' : 'pill-todo'}`;
  compBtn.onclick = () => {
    const key = getTopicKey(subject, chapter, topic);
    const cur = getTopicProgress(subject, chapter, topic);
    appState.progress[key] = { ...cur, completed: !cur.completed, lastOpenedAt: Date.now() };
    saveStoredJson(STORAGE_KEYS.progress, appState.progress);
    renderViewerScreen();
    showToast(appState.progress[key].completed ? '✓ Marked complete!' : 'Marked as not done');
  };

  // Topic nav bar
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx >= topics.length - 1;
  prevBtn.onclick  = navigatePrevTopic;
  nextBtn.onclick  = navigateNextTopic;
  document.getElementById('topic-nav-label').textContent =
    topics.length ? `${idx + 1} of ${topics.length}` : '';

  // Chapter summary
  const summaryEl = document.getElementById('viewer-summary');
  if (meta.summary) {
    const hasMore = meta.detailedSummary && meta.detailedSummary !== meta.summary;
    summaryEl.innerHTML = `<div class="summary-card">
      <h4>📘 ${escapeHtml(chapter)}</h4>
      <div class="summary-lead">${escapeHtml(meta.summary)}</div>
      ${hasMore ? `<button class="summary-more-btn" id="sum-more-btn">Read detailed summary ›</button>
        <div class="summary-expanded" id="sum-expanded" style="display:none">${formatRichText(meta.detailedSummary)}</div>` : ''}
    </div>`;
    const moreBtn = document.getElementById('sum-more-btn');
    const moreDiv = document.getElementById('sum-expanded');
    if (moreBtn && moreDiv) {
      moreBtn.addEventListener('click', () => {
        const open = moreDiv.style.display !== 'none';
        moreDiv.style.display = open ? 'none' : '';
        moreBtn.textContent   = open ? 'Read detailed summary ›' : 'Show less ‹';
      });
    }
  } else {
    summaryEl.innerHTML = '';
  }

  // Content cards
  const cardsEl = document.getElementById('viewer-cards');
  cardsEl.innerHTML = items.length
    ? items.map(renderContentCard).join('')
    : `<div class="empty-state">
        <p><strong>No content added yet for this topic.</strong></p>
        <p>Add files to:<br><code>content/${escapeHtml(subject)}/${escapeHtml(chapter)}/${escapeHtml(topic)}/</code></p>
        <p>Then list them in <code>content/content-manifest.json</code>.</p>
      </div>`;

  // Notes textarea sync
  const ta = document.getElementById('notes-ta');
  ta.value = p.notes || '';
  ta.oninput = e => {
    const key = getTopicKey(subject, chapter, topic);
    appState.progress[key] = { ...getTopicProgress(subject, chapter, topic), notes: e.target.value, lastOpenedAt: Date.now() };
    saveStoredJson(STORAGE_KEYS.progress, appState.progress);
  };
}

// ─── Progress screen ───────────────────────────────────────────────────────
function renderProgressScreen() {
  const allTopics = getAllTopics();
  const done      = allTopics.filter(t => getTopicProgress(t.subject, t.chapter, t.topic).completed).length;
  const streak    = getStreak();

  document.getElementById('progress-stats').innerHTML = [
    { label: 'Done',    value: done },
    { label: 'Topics',  value: allTopics.length },
    { label: 'Streak',  value: `${streak}d` }
  ].map(s => `<div class="stat-card">
    <span class="stat-value">${s.value}</span>
    <span class="stat-label">${s.label}</span>
  </div>`).join('');

  // Subject progress bars
  const barsEl = document.getElementById('progress-bars');
  barsEl.innerHTML = Object.keys(appState.subjects).map(subject => {
    const pct = getCompletionPercent(subject);
    const cfg = getSubjectCfg(subject);
    return `<div class="progress-bar-item">
      <div class="pbi-row">
        <div class="pbi-name">${cfg.icon} ${escapeHtml(cfg.label || subject)}</div>
        <div class="pbi-pct">${pct}%</div>
      </div>
      <div class="pbi-bar"><div class="pbi-fill" style="width:${pct}%;background:${cfg.color}"></div></div>
    </div>`;
  }).join('');

  // Needs revision
  const revItems   = getTopicsNeedingRevision();
  const revSection = document.getElementById('progress-revision-section');
  const revList    = document.getElementById('progress-revision-list');
  if (revItems.length) {
    revSection.style.display = '';
    revList.innerHTML = buildListItems(revItems, 'dot-revision');
    attachListEvents(revList);
  } else {
    revSection.style.display = 'none';
  }

  // Bookmarks
  const bkEl = document.getElementById('bookmarks-list');
  const bkItems = appState.bookmarks.slice(0, 8).map(b => ({ subject: b.subject, chapter: b.chapter, topic: b.topic }));
  bkEl.innerHTML = bkItems.length
    ? buildListItems(bkItems, 'dot-progress')
    : '<p class="empty-note">Bookmark topics for quick revision access.</p>';
  if (bkItems.length) attachListEvents(bkEl);
}

// ─── Swipe gesture (viewer only) ───────────────────────────────────────────
function initSwipeGesture() {
  let sx = 0, sy = 0;
  const el = document.getElementById('screen-viewer');
  el.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', e => {
    if (appState.notesOpen) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 55) {
      if (dx < 0) navigateNextTopic();
      else navigatePrevTopic();
    }
  }, { passive: true });
}

// ─── Bottom nav ────────────────────────────────────────────────────────────
function initBottomNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const nav = btn.dataset.nav;
      if (nav === 'ai') { showToast('AI Tutor — coming soon! 🤖'); return; }
      if (nav === 'progress') {
        renderProgressScreen();
        showScreen('progress');
        return;
      }
      if (nav === 'subjects') {
        // Go to home and scroll to subjects
        renderHomeScreen();
        showScreen('home');
        setTimeout(() => {
          const el = document.getElementById('subject-grid');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return;
      }
      // home
      renderHomeScreen();
      showScreen('home');
    });
  });
}

// ─── Data merge helpers (same as before) ───────────────────────────────────
function buildSubjectsFromMetadata(meta = {}) {
  const s = {};
  Object.entries(meta).forEach(([subject, chapters]) => {
    s[subject] = {};
    Object.keys(chapters || {}).forEach(ch => { s[subject][ch] = ['Overview']; });
  });
  return s;
}

function mergeSubjectMaps(primary = {}, secondary = {}) {
  const merged = JSON.parse(JSON.stringify(primary || {}));
  Object.entries(secondary || {}).forEach(([subject, chapters]) => {
    merged[subject] = merged[subject] || {};
    Object.entries(chapters || {}).forEach(([chapter, topics]) => {
      const next = Array.from(new Set([
        ...(Array.isArray(topics) ? topics : []),
        ...(merged[subject][chapter] || [])
      ].filter(Boolean)));
      merged[subject][chapter] = next.length ? next : ['Overview'];
    });
  });
  return merged;
}

// ─── Boot ──────────────────────────────────────────────────────────────────
window.onload = async () => {
  try {
    // Load from Google Sheets (parallel), fall back to local files if offline
    let topicSubjects, contentMap, chapterMeta;
    try {
      const [sheetData, meta] = await Promise.all([
        loadFromContentSheet(),
        loadFromMetadataSheet()
      ]);
      topicSubjects = sheetData.subjects;
      contentMap    = sheetData.contentMap;
      chapterMeta   = meta;
      const subjectCount = Object.keys(topicSubjects).length;
      const itemCount = Object.values(contentMap).reduce((n, ch) =>
        n + Object.values(ch).reduce((m, top) =>
          m + Object.values(top).reduce((k, items) => k + items.length, 0), 0), 0);
      console.log('[LearnNest] Sheets loaded — subjects:', subjectCount, '| content items:', itemCount, topicSubjects);
      showToast(`Loaded from Google Sheets (${subjectCount} subjects, ${itemCount} items)`);
    } catch (sheetErr) {
      console.warn('[LearnNest] Google Sheets failed, falling back to local files:', sheetErr.message);
      showToast('Using local data — check sheet sharing settings');
      [topicSubjects, contentMap, chapterMeta] = await Promise.all([
        loadTopics(),
        loadContentManifest(),
        loadChapterMetadata()
      ]);
    }

    appState.contentMap  = contentMap;
    appState.chapterMeta = chapterMeta;

    // Metadata sheet is the sole authority for which subjects + chapters exist.
    // Topics within each chapter are filled in from the content sheet.
    // Any subject/chapter not in the metadata sheet is ignored.
    const metaSubjects = buildSubjectsFromMetadata(chapterMeta);
    console.log('[LearnNest] Metadata subjects:', Object.keys(metaSubjects));
    console.log('[LearnNest] Content subjects:', Object.keys(topicSubjects));
    Object.entries(metaSubjects).forEach(([subject, chapters]) => {
      Object.keys(chapters).forEach(chapter => {
        const fromContent = topicSubjects?.[subject]?.[chapter] || [];
        if (!fromContent.length) console.warn(`[LearnNest] No topics in content sheet for: "${subject}" → "${chapter}"`);
        metaSubjects[subject][chapter] = fromContent.length ? fromContent : ['Overview'];
      });
    });
    appState.subjects = metaSubjects;

    // Restore last position
    const latest = appState.history[0];
    if (latest && getTopics(latest.subject, latest.chapter || '').includes(latest.topic)) {
      appState.currentSubject = latest.subject;
      appState.currentChapter = latest.chapter;
      appState.currentTopic   = latest.topic;
    } else {
      const first = getAllTopics()[0];
      if (first) {
        appState.currentSubject = first.subject;
        appState.currentChapter = first.chapter;
        appState.currentTopic   = first.topic;
      }
    }

    recordStudyToday();

    // Wire up controls
    initBottomNav();
    initSwipeGesture();

    // Back buttons
    document.getElementById('back-subject').addEventListener('click', navigateBack);
    document.getElementById('back-viewer').addEventListener('click', navigateBack);

    // Notes FAB
    document.getElementById('notes-fab').addEventListener('click', openNotes);
    document.getElementById('notes-close').addEventListener('click', closeNotes);
    document.getElementById('notes-overlay').addEventListener('click', closeNotes);

    // Search
    const searchToggle = document.getElementById('search-toggle');
    const searchBar    = document.getElementById('search-bar');
    const searchInput  = document.getElementById('search-input');
    const searchClear  = document.getElementById('search-clear');

    searchToggle.addEventListener('click', () => {
      const hidden = searchBar.style.display === 'none';
      searchBar.style.display = hidden ? 'flex' : 'none';
      if (hidden) setTimeout(() => searchInput.focus(), 60);
    });
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      appState.search   = '';
      searchBar.style.display = 'none';
      renderHomeScreen();
    });
    searchInput.addEventListener('input', () => {
      appState.search = searchInput.value.trim();
      renderHomeScreen();
    });

    // Render home and show app
    renderHomeScreen();
    showScreen('home');
    document.getElementById('app-loader').style.display  = 'none';
    document.getElementById('app-shell').style.display   = '';

  } catch (err) {
    console.error(err);
    document.getElementById('app-loader').innerHTML = `
      <div class="loader-logo">LearnNest</div>
      <p style="color:#fff;font-size:14px;text-align:center;max-width:280px;line-height:1.6">
        Could not load the app.<br>
        Make sure the local server is running:<br><br>
        <code style="background:rgba(255,255,255,0.15);padding:4px 8px;border-radius:6px">
          python -m http.server 8000
        </code>
      </p>`;
  }
};
