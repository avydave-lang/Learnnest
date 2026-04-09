// LearnNest Parent Dashboard
// Reads live stats from both Google Sheets and displays them.

const PARENT_SHEET_IDS = {
  content:  '1LfxDKr9vX0inr6FgahPC5wyIHwjfaeQHtPhd0oEGmy0',
  metadata: '1ETh_n0VZLEWJFXk31bbhsb34zKZ6Q-REA7bLPHTwnKM'
};

const SUBJECT_COLORS = {
  'IT':          '#0f766e',
  'SP':          '#7c3aed',
  'Accountancy': '#be185d',
  'Economics':   '#0891b2',
  'OCM':         '#ea580c',
  'English':     '#16a34a'
};

async function fetchGvizSheet(sheetId) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=Sheet1&headers=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const text = await res.text();
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

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function loadStats() {
  const rowsEl    = document.getElementById('subject-rows');
  const errorEl   = document.getElementById('stats-error');
  const statSub   = document.getElementById('stat-subjects');
  const statCh    = document.getElementById('stat-chapters');
  const statItems = document.getElementById('stat-items');

  rowsEl.innerHTML = '<p class="loading-msg">Loading from Google Sheets…</p>';
  errorEl.style.display = 'none';
  statSub.textContent = statCh.textContent = statItems.textContent = '—';

  try {
    const [contentRows, metaRows] = await Promise.all([
      fetchGvizSheet(PARENT_SHEET_IDS.content),
      fetchGvizSheet(PARENT_SHEET_IDS.metadata)
    ]);

    // Build stats from content sheet
    const subjects = {};
    contentRows.forEach(row => {
      const subject = String(row['Subject'] ?? '').trim();
      const chapter = String(row['Chapter'] ?? '').trim();
      const topic   = String(row['Topic']   ?? '').trim();
      const type    = String(row['Content Type'] ?? '').trim();
      const file    = String(row['file link or id'] ?? '').trim();
      if (!subject) return;
      subjects[subject] = subjects[subject] || { chapters: new Set(), topics: new Set(), items: 0 };
      if (chapter) subjects[subject].chapters.add(chapter);
      if (topic)   subjects[subject].topics.add(`${chapter}::${topic}`);
      if (type && file) subjects[subject].items++;
    });

    // Count chapters from metadata sheet (authoritative)
    const metaChapters = {};
    metaRows.forEach(row => {
      const subject = String(row['Subject'] ?? '').trim();
      const chapter = String(row['Chapter'] ?? '').trim();
      if (!subject || !chapter) return;
      metaChapters[subject] = metaChapters[subject] || new Set();
      metaChapters[subject].add(chapter);
    });

    // Totals
    const allSubjects = new Set([...Object.keys(subjects), ...Object.keys(metaChapters)]);
    let totalChapters = 0;
    let totalItems    = 0;
    allSubjects.forEach(s => {
      totalChapters += (metaChapters[s]?.size || subjects[s]?.chapters.size || 0);
      totalItems    += (subjects[s]?.items || 0);
    });

    statSub.textContent   = allSubjects.size;
    statCh.textContent    = totalChapters;
    statItems.textContent = totalItems;

    // Subject rows
    const subjectOrder = ['IT', 'SP', 'Accountancy', 'Economics', 'OCM', 'English'];
    const ordered = [
      ...subjectOrder.filter(s => allSubjects.has(s)),
      ...[...allSubjects].filter(s => !subjectOrder.includes(s))
    ];

    if (!ordered.length) {
      rowsEl.innerHTML = '<p class="loading-msg">No subjects found in sheets yet.</p>';
      return;
    }

    rowsEl.innerHTML = ordered.map(subject => {
      const chapterCount = metaChapters[subject]?.size || subjects[subject]?.chapters.size || 0;
      const itemCount    = subjects[subject]?.items || 0;
      const color        = SUBJECT_COLORS[subject] || '#6b7280';
      const statusClass  = itemCount > 0 ? 'pill-ok' : 'pill-warn';
      const statusText   = itemCount > 0 ? `${itemCount} items` : 'No content yet';
      return `
        <div class="subject-row">
          <div class="subject-dot" style="background:${escapeHtml(color)}"></div>
          <div class="subject-name">${escapeHtml(subject)}</div>
          <div class="subject-counts">${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}</div>
          <span class="pill-status ${statusClass}">${escapeHtml(statusText)}</span>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('[LearnNest Parent] Stats load failed:', err);
    rowsEl.innerHTML = '';
    errorEl.style.display = 'block';
    statSub.textContent = statCh.textContent = statItems.textContent = '—';
  }
}

window.addEventListener('DOMContentLoaded', loadStats);
