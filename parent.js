const parentState = {
  rows: [],
  sourceRootHandle: null,
  contentDirHandle: null
};

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pickField(row, candidates) {
  for (const key of candidates) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function normalizeContentType(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return '';
  }
  if (raw === 'yt' || raw.includes('youtube')) {
    return 'youtube';
  }
  if (raw.includes('video')) {
    return 'video';
  }
  if (raw.includes('audio') || ['mp3', 'wav', 'm4a', 'ogg'].includes(raw)) {
    return 'audio';
  }
  if (raw.includes('ppt')) {
    return 'ppt';
  }
  if (raw.includes('pdf')) {
    return 'pdf';
  }
  if (raw.includes('image')) {
    return 'image';
  }
  return raw;
}

function looksLikeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function sanitizeSegment(value) {
  return String(value || '').trim().replace(/[<>:"/\\|?*]+/g, '_');
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      row.push(cell);
      if (row.some(value => String(value).trim() !== '')) {
        rows.push(row);
      }
      row = [];
      cell = '';
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some(value => String(value).trim() !== '')) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((values, index) => {
    const record = { __rowNumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = (values[headerIndex] || '').trim();
    });
    return record;
  });
}

function normalizeRows(records) {
  return records.map(record => {
    const subject = pickField(record, ['subject', 'subject_name']);
    const topic = pickField(record, ['topic', 'topic_name']);
    const chapter = pickField(record, ['chapter', 'chapter_name']);
    const contentType = normalizeContentType(pickField(record, ['content_type', 'type']));
    const fileOrLink = pickField(record, ['content_name_or_link', 'file_name', 'file', 'link', 'url', 'path', 'content']);
    const description = pickField(record, ['description', 'desc', 'notes']);
    const title = pickField(record, ['title', 'content_title', 'content_name']) || description || fileOrLink;
    const sourceFolder = pickField(record, ['source_folder', 'folder', 'file_folder', 'source_dir']);
    const sourcePath = pickField(record, ['source_path', 'file_path', 'filepath', 'local_path']);

    let issue = '';
    if (!subject || !topic || !contentType || !fileOrLink) {
      issue = 'Missing required field(s)';
    } else if (contentType === 'youtube' && !looksLikeUrl(fileOrLink)) {
      issue = 'Invalid YouTube URL';
    }

    return {
      rowNumber: record.__rowNumber,
      subject,
      topic,
      chapter,
      contentType,
      fileOrLink,
      description,
      title,
      sourceFolder,
      sourcePath,
      issue
    };
  }).filter(row => row.subject || row.topic || row.contentType || row.fileOrLink);
}

function deriveFileName(row) {
  const value = row.sourcePath || row.fileOrLink || row.title || '';
  if (!value) {
    return '';
  }

  if (looksLikeUrl(value)) {
    try {
      const parsed = new URL(value);
      return decodeURIComponent(parsed.pathname.split('/').pop() || '');
    } catch {
      return '';
    }
  }

  return value.split(/[\\/]/).pop().trim();
}

function splitPathSegments(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^[A-Za-z]:/, '')
    .replace(/^\/+/, '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean);
}

function hasSourceLocation(row) {
  return Boolean(row.sourcePath || row.sourceFolder || (!looksLikeUrl(row.fileOrLink) && row.fileOrLink));
}

function getSourceSegments(row) {
  let segments = [];

  if (row.sourcePath) {
    segments = splitPathSegments(row.sourcePath);
  } else if (!looksLikeUrl(row.fileOrLink) && /[\\/]/.test(row.fileOrLink)) {
    segments = splitPathSegments(row.fileOrLink);
  } else {
    segments = [...splitPathSegments(row.sourceFolder), deriveFileName(row)].filter(Boolean);
  }

  if (parentState.sourceRootHandle && segments[0]?.toLowerCase() === parentState.sourceRootHandle.name.toLowerCase()) {
    segments.shift();
  }

  return segments;
}

async function readSourceFile(row) {
  if (!parentState.sourceRootHandle) {
    return null;
  }

  const segments = getSourceSegments(row);
  if (!segments.length) {
    return null;
  }

  try {
    let dir = parentState.sourceRootHandle;
    for (let i = 0; i < segments.length - 1; i += 1) {
      dir = await dir.getDirectoryHandle(segments[i]);
    }
    const fileHandle = await dir.getFileHandle(segments[segments.length - 1]);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

function buildRelativePath(row, fileName) {
  const segments = [sanitizeSegment(row.subject)];
  if (row.chapter) {
    segments.push(sanitizeSegment(row.chapter));
  }
  segments.push(sanitizeSegment(row.topic));
  return `content/${segments.filter(Boolean).join('/')}/${fileName}`;
}

function ensureBucket(manifest, subject, chapter, topic) {
  const chapterName = chapter || 'General';

  if (!manifest[subject]) {
    manifest[subject] = {};
  }

  if (Array.isArray(manifest[subject][topic])) {
    const legacyItems = manifest[subject][topic];
    delete manifest[subject][topic];
    manifest[subject][chapterName] = manifest[subject][chapterName] || {};
    manifest[subject][chapterName][topic] = legacyItems;
  }

  if (!manifest[subject][chapterName]) {
    manifest[subject][chapterName] = {};
  }

  if (!manifest[subject][chapterName][topic]) {
    manifest[subject][chapterName][topic] = [];
  }

  return manifest[subject][chapterName][topic];
}

function setStatus(message, tone = 'info') {
  const box = document.getElementById('status-box');
  box.className = `status-box ${tone}`;
  box.textContent = message;
}

function renderPreview() {
  const wrap = document.getElementById('preview-wrap');
  if (!parentState.rows.length) {
    wrap.innerHTML = '<p class="empty-copy">No CSV loaded yet.</p>';
    return;
  }

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Row</th>
          <th>Subject</th>
          <th>Chapter</th>
          <th>Topic</th>
          <th>Type</th>
          <th>File / link</th>
          <th>Source folder/path</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${parentState.rows.map(row => {
          const sourceInfo = row.sourcePath || row.sourceFolder || '-';
          const status = row.issue
            ? row.issue
            : row.contentType === 'youtube'
              ? 'YouTube link ready'
              : looksLikeUrl(row.fileOrLink)
                ? 'Remote file link ready'
                : parentState.sourceRootHandle
                  ? 'Ready to auto-copy from source folder'
                  : 'Connect source folder for auto-copy';

          return `
            <tr>
              <td>${row.rowNumber}</td>
              <td>${escapeHtml(row.subject)}</td>
              <td>${escapeHtml(row.chapter || 'General')}</td>
              <td>${escapeHtml(row.topic)}</td>
              <td>${escapeHtml(row.contentType)}</td>
              <td>${escapeHtml(row.fileOrLink)}</td>
              <td>${escapeHtml(sourceInfo)}</td>
              <td>${escapeHtml(status)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function renderResults(messages = []) {
  const wrap = document.getElementById('result-wrap');
  if (!messages.length) {
    wrap.innerHTML = '<p class="empty-copy">No import has been run yet.</p>';
    return;
  }

  wrap.innerHTML = `<ul class="result-list">${messages.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

async function handleCsvSelection(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = parseCsv(text);
    parentState.rows = normalizeRows(parsed);
    renderPreview();
    setStatus(`Loaded ${parentState.rows.length} CSV row(s).`, 'success');
  } catch (error) {
    setStatus('Could not read the CSV file.', 'error');
    console.error(error);
  }
}

async function connectSourceFolder() {
  if (!window.showDirectoryPicker) {
    setStatus('This browser does not support direct folder access. You can still generate a manifest file.', 'warning');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ id: 'learnnest-source-folder' });
    parentState.sourceRootHandle = handle;
    document.getElementById('source-status').textContent = `Connected source root: ${handle.name}`;
    renderPreview();
    setStatus('Source folder connected. CSV folder/path values can now be used automatically.', 'success');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setStatus('Could not connect the source folder.', 'error');
      console.error(error);
    }
  }
}

async function connectContentFolder() {
  if (!window.showDirectoryPicker) {
    setStatus('This browser does not support direct folder access. You can still generate a manifest file.', 'warning');
    return;
  }

  try {
    const handle = await window.showDirectoryPicker({ id: 'learnnest-content-folder' });
    parentState.contentDirHandle = handle;
    document.getElementById('folder-status').textContent = `Connected folder: ${handle.name}`;
    setStatus('Content folder connected. The importer can now copy files and update the manifest directly.', 'success');
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setStatus('Could not connect the content folder.', 'error');
      console.error(error);
    }
  }
}

async function readExistingManifest() {
  if (!parentState.contentDirHandle) {
    try {
      const res = await fetch('content/content-manifest.json');
      return res.ok ? await res.json() : {};
    } catch {
      return {};
    }
  }

  try {
    const fileHandle = await parentState.contentDirHandle.getFileHandle('content-manifest.json');
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch {
    return {};
  }
}

async function ensureNestedDirectory(rootHandle, segments) {
  let dir = rootHandle;
  for (const segment of segments.filter(Boolean)) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  return dir;
}

async function copyFileToContentFolder(row, sourceFile) {
  const folderParts = [sanitizeSegment(row.subject)];
  if (row.chapter) {
    folderParts.push(sanitizeSegment(row.chapter));
  }
  folderParts.push(sanitizeSegment(row.topic));

  const dir = await ensureNestedDirectory(parentState.contentDirHandle, folderParts);
  const targetName = sanitizeSegment(sourceFile.name);
  const fileHandle = await dir.getFileHandle(targetName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await sourceFile.arrayBuffer());
  await writable.close();

  return `content/${[...folderParts, targetName].join('/')}`;
}

async function writeManifest(manifest) {
  if (!parentState.contentDirHandle) {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'content-manifest.generated.json';
    anchor.click();
    URL.revokeObjectURL(url);
    return;
  }

  const fileHandle = await parentState.contentDirHandle.getFileHandle('content-manifest.json', { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(manifest, null, 2));
  await writable.close();
}

async function importRows() {
  if (!parentState.rows.length) {
    setStatus('Please choose a CSV file first.', 'error');
    return;
  }

  const validRows = parentState.rows.filter(row => !row.issue);
  if (!validRows.length) {
    setStatus('The CSV preview has only invalid rows. Please fix the file and try again.', 'error');
    return;
  }

  const manifest = await readExistingManifest();
  const results = [];
  let addedCount = 0;
  let copiedCount = 0;
  let missingSourceCount = 0;

  for (const row of validRows) {
    const chapterName = row.chapter || 'General';
    const bucket = ensureBucket(manifest, row.subject, chapterName, row.topic);
    const item = {
      title: row.title || row.fileOrLink,
      type: row.contentType,
      description: row.description || ''
    };

    let sourceFile = null;

    if (row.contentType === 'youtube') {
      item.file = row.fileOrLink;
    } else if (row.fileOrLink.startsWith('content/') || looksLikeUrl(row.fileOrLink)) {
      item.file = row.fileOrLink;
    } else {
      const fileName = sanitizeSegment(deriveFileName(row) || 'file');

      if (parentState.sourceRootHandle && hasSourceLocation(row)) {
        sourceFile = await readSourceFile(row);
      }

      if (sourceFile && parentState.contentDirHandle) {
        item.file = await copyFileToContentFolder(row, sourceFile);
        copiedCount += 1;
      } else {
        item.file = buildRelativePath(row, fileName);
        if (parentState.sourceRootHandle && hasSourceLocation(row) && !sourceFile) {
          missingSourceCount += 1;
        }
      }
    }

    const exists = bucket.some(existing => existing.type === item.type && existing.file === item.file);
    if (exists) {
      results.push(`Skipped duplicate row ${row.rowNumber} for ${row.subject} / ${chapterName} / ${row.topic}.`);
      continue;
    }

    bucket.push(item);
    addedCount += 1;

    if (row.contentType === 'youtube') {
      results.push(`Added YouTube lesson to ${row.subject} / ${chapterName} / ${row.topic}.`);
    } else if (sourceFile && parentState.contentDirHandle) {
      results.push(`Copied ${sourceFile.name} into ${row.subject} / ${chapterName} / ${row.topic}.`);
    } else if (parentState.sourceRootHandle && hasSourceLocation(row) && !sourceFile) {
      results.push(`Could not find the source file for row ${row.rowNumber}. Check source_folder or source_path in the CSV.`);
    } else if (!parentState.sourceRootHandle) {
      results.push(`Added row ${row.rowNumber}. Connect the source folder if you want automatic file copying.`);
    } else if (!parentState.contentDirHandle) {
      results.push(`Added row ${row.rowNumber}. Connect the app content folder to copy files automatically.`);
    } else {
      results.push(`Added ${row.contentType} to ${row.subject} / ${chapterName} / ${row.topic}.`);
    }
  }

  await writeManifest(manifest);

  const message = parentState.contentDirHandle
    ? `Import complete: ${addedCount} item(s) added, ${copiedCount} file(s) copied${missingSourceCount ? `, ${missingSourceCount} file(s) not found` : ''}.`
    : `Manifest generated with ${addedCount} item(s). Save the downloaded file as content/content-manifest.json.`;

  setStatus(message, 'success');
  renderResults(results);
}

function initializeParentUi() {
  document.getElementById('csv-file').addEventListener('change', handleCsvSelection);
  document.getElementById('connect-source-btn').addEventListener('click', connectSourceFolder);
  document.getElementById('connect-folder-btn').addEventListener('click', connectContentFolder);
  document.getElementById('import-btn').addEventListener('click', importRows);
}

window.addEventListener('DOMContentLoaded', initializeParentUi);
