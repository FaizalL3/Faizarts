// ============================================
// CONFIG — adjust these to match your repo
// ============================================
const REPO_OWNER = 'FaizalL3';
const REPO_NAME = 'Faizalillustrations';
const REPO_BRANCH = 'main';
const IMAGES_PATH = 'images'; // folder in the repo where uploads land

// ============================================
// Admin page password gate
// NOTE: this is NOT real security. It only hides the upload UI from
// casual visitors poking around your site. Anyone who opens dev tools
// and reads admin.js can see the check below. The actual protection on
// your repo is the GitHub token itself — keep that private.
// ============================================
const ADMIN_PASSWORD = 'changeme'; // ← change this before you publish

const gate = document.getElementById('admin-gate');
const gateInput = document.getElementById('gate-input');
const gateError = document.getElementById('gate-error');
const gateForm = document.getElementById('gate-form');
const adminMain = document.getElementById('admin-main');

gateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (gateInput.value === ADMIN_PASSWORD) {
    gate.style.display = 'none';
    adminMain.classList.add('is-visible');
    if (typeof loadManageList === 'function') loadManageList();
    if (typeof refreshStatusToggle === 'function') refreshStatusToggle();
  } else {
    gateError.textContent = 'Incorrect password.';
    gateInput.value = '';
  }
});

// ============================================
// Token handling (client-side, local storage)
// ============================================
const TOKEN_KEY = 'faizal_admin_gh_token';

const tokenInput = document.getElementById('token-input');
const tokenSave = document.getElementById('token-save');
const tokenClear = document.getElementById('token-clear');
const tokenStatus = document.getElementById('token-status');

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value) {
  localStorage.setItem(TOKEN_KEY, value);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function verifyToken(token) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

async function refreshTokenStatus() {
  const token = getToken();
  if (!token) {
    tokenStatus.textContent = 'No token saved.';
    tokenStatus.className = 'token-status';
    return;
  }
  tokenStatus.textContent = 'Checking…';
  const ok = await verifyToken(token);
  if (ok) {
    tokenStatus.textContent = 'Connected to repo.';
    tokenStatus.className = 'token-status is-connected';
  } else {
    tokenStatus.textContent = 'Token invalid or lacks access — check it and try again.';
    tokenStatus.className = 'token-status is-error';
  }
}

tokenSave.addEventListener('click', () => {
  const value = tokenInput.value.trim();
  if (!value) return;
  setToken(value);
  tokenInput.value = '';
  refreshTokenStatus();
});

tokenClear.addEventListener('click', () => {
  clearToken();
  refreshTokenStatus();
});

// run once on load (in case admin page reloads with main already visible — won't normally happen since gate resets, but harmless)
refreshTokenStatus();

// ============================================
// Drag & drop queue
// ============================================
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const queueEl = document.getElementById('queue');
const uploadAllBtn = document.getElementById('upload-all');
const logEl = document.getElementById('log');

let queue = []; // { id, file, filename, status }

function logLine(text, kind = '') {
  const line = document.createElement('div');
  line.className = `log__line ${kind}`;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${text}`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]/g, '-')
    .replace(/-+/g, '-');
}

function renderQueue() {
  queueEl.innerHTML = '';
  queue.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'queue__item';

    const isVideo = item.file.type.startsWith('video/');
    const thumb = document.createElement(isVideo ? 'video' : 'img');
    thumb.className = 'queue__thumb';
    thumb.src = item.previewUrl;
    if (isVideo) {
      thumb.muted = true;
    } else {
      thumb.alt = '';
    }

    const info = document.createElement('div');
    info.className = 'queue__info';

    const filenameRow = document.createElement('div');
    filenameRow.className = 'queue__filename-row';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = item.filename;
    nameInput.addEventListener('input', (e) => {
      item.filename = sanitizeFilename(e.target.value);
    });

    const stateSpan = document.createElement('span');
    stateSpan.className = `queue__state is-${item.status}`;
    stateSpan.textContent = labelForStatus(item.status);

    filenameRow.appendChild(nameInput);
    filenameRow.appendChild(stateSpan);

    const meta = document.createElement('div');
    meta.className = 'queue__meta';
    meta.textContent = `${(item.file.size / 1024).toFixed(0)} KB`;

    info.appendChild(filenameRow);
    info.appendChild(meta);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'queue__remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      queue = queue.filter((q) => q.id !== item.id);
      renderQueue();
    });

    row.appendChild(thumb);
    row.appendChild(info);
    if (item.status === 'pending') row.appendChild(removeBtn);

    queueEl.appendChild(row);
  });

  uploadAllBtn.disabled = queue.length === 0 || queue.every((q) => q.status !== 'pending');
}

function labelForStatus(status) {
  switch (status) {
    case 'pending': return 'Ready';
    case 'uploading': return 'Uploading…';
    case 'done': return 'Uploaded';
    case 'error': return 'Failed';
    default: return '';
  }
}

function addFilesToQueue(fileList) {
  Array.from(fileList).forEach((file) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      logLine(`Skipped "${file.name}" — not an image or video.`, 'is-error');
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    queue.push({
      id,
      file,
      filename: sanitizeFilename(file.name),
      status: 'pending',
      previewUrl: URL.createObjectURL(file),
    });
  });
  renderQueue();
}

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  addFilesToQueue(e.target.files);
  fileInput.value = '';
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) {
    addFilesToQueue(e.dataTransfer.files);
  }
});

// ============================================
// GitHub API commit
// ============================================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchCurrentSha(token, path) {
  // cache: 'no-store' plus a cache-busting query param — GitHub's API
  // shouldn't be cached by the browser, but belt-and-suspenders here
  // since a stale SHA is exactly what causes "does not match" errors.
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${REPO_BRANCH}&_=${Date.now()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha;
}

async function commitFileToRepo(token, path, base64Content, message, _isRetry) {
  const sha = await fetchCurrentSha(token, path);

  const body = {
    message,
    content: base64Content,
    branch: REPO_BRANCH,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!putRes.ok) {
    const errBody = await putRes.json().catch(() => ({}));
    const message409 = errBody.message || '';

    // A "does not match" / 409 means the SHA we sent is already stale —
    // almost always caused by two saves racing each other. Refetch the
    // real current SHA and try exactly once more before giving up.
    if (!_isRetry && (putRes.status === 409 || /does not match/i.test(message409))) {
      return commitFileToRepo(token, path, base64Content, message, true);
    }

    throw new Error(message409 || `GitHub API error (${putRes.status})`);
  }

  return putRes.json();
}

async function uploadItem(item, token) {
  item.status = 'uploading';
  renderQueue();
  logLine(`Uploading ${item.filename}…`);

  try {
    const base64 = await fileToBase64(item.file);
    const path = `${IMAGES_PATH}/${item.filename}`;
    await commitFileToRepo(token, path, base64, `Add ${item.filename} via admin upload`);
    item.status = 'done';
    logLine(`Uploaded ${item.filename} → ${path}`, 'is-success');
  } catch (err) {
    item.status = 'error';
    logLine(`Failed to upload ${item.filename}: ${err.message}`, 'is-error');
  }

  renderQueue();
}

uploadAllBtn.addEventListener('click', async () => {
  const token = getToken();
  if (!token) {
    logLine('No GitHub token saved — paste one above first.', 'is-error');
    return;
  }

  const ok = await verifyToken(token);
  if (!ok) {
    logLine('Token check failed — verify it has Contents: Read and write access to this repo.', 'is-error');
    return;
  }

  const pending = queue.filter((q) => q.status === 'pending');
  if (pending.length === 0) {
    logLine('Nothing to upload.');
    return;
  }

  uploadAllBtn.disabled = true;
  logLine(`Starting upload of ${pending.length} file(s)…`);

  // sequential, not parallel — avoids GitHub API rate/conflict issues
  for (const item of pending) {
    await uploadItem(item, token);
  }

  logLine('Batch complete.');
  uploadAllBtn.disabled = queue.every((q) => q.status !== 'pending');
});

// ============================================
// Manage / Delete existing files
// ============================================
const manageList = document.getElementById('manage-list');
const manageStatus = document.getElementById('manage-status');
const refreshManageBtn = document.getElementById('refresh-manage');

const RAW_BASE_FOR_THUMBS = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${IMAGES_PATH}`;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif)$/i;
const FEATURED_PATH = `${IMAGES_PATH}/featured.json`;
const VISIBLE_PATH = `${IMAGES_PATH}/visible.json`;
const CHIBI_PATH = `${IMAGES_PATH}/chibi.json`;
const HALFBODY_PATH = `${IMAGES_PATH}/halfbody.json`;
const FULLBODY_PATH = `${IMAGES_PATH}/fullbody.json`;
const CONTACT_PATH = `${IMAGES_PATH}/contact.json`;
const STATUS_PATH = 'status.json'; // lives at the repo root, not under /images
const MAX_FEATURED = 3; // matches the homepage preview grid size
const MAX_CATEGORY_IMAGE = 1; // one example image per price category

function baseKeyFromFilename(filename) {
  const idx = filename.lastIndexOf('.');
  const base = idx === -1 ? filename : filename.slice(0, idx);
  return base.toLowerCase();
}

async function loadKeyListFile(token, path) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${REPO_BRANCH}&_=${Date.now()}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' }
  );
  if (res.status === 404) return []; // no picks made yet — that's normal
  if (!res.ok) throw new Error(`Could not load ${path} (status ${res.status})`);
  const data = await res.json();
  try {
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(decoded);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveKeyListFile(token, path, keys, message) {
  const json = JSON.stringify(keys, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return commitFileToRepo(token, path, base64, message);
}

async function loadFeaturedKeys(token) {
  return loadKeyListFile(token, FEATURED_PATH);
}

async function saveFeaturedKeys(token, keys) {
  return saveKeyListFile(token, FEATURED_PATH, keys, 'Update featured pieces via admin panel');
}

async function loadVisibleKeys(token) {
  return loadKeyListFile(token, VISIBLE_PATH);
}

async function saveVisibleKeys(token, keys) {
  return saveKeyListFile(token, VISIBLE_PATH, keys, 'Update visible pieces via admin panel');
}

async function loadChibiKeys(token) {
  return loadKeyListFile(token, CHIBI_PATH);
}
async function saveChibiKeys(token, keys) {
  return saveKeyListFile(token, CHIBI_PATH, keys, 'Update chibi example image via admin panel');
}

async function loadHalfBodyKeys(token) {
  return loadKeyListFile(token, HALFBODY_PATH);
}
async function saveHalfBodyKeys(token, keys) {
  return saveKeyListFile(token, HALFBODY_PATH, keys, 'Update half body example image via admin panel');
}

async function loadFullBodyKeys(token) {
  return loadKeyListFile(token, FULLBODY_PATH);
}
async function saveFullBodyKeys(token, keys) {
  return saveKeyListFile(token, FULLBODY_PATH, keys, 'Update full body example image via admin panel');
}

async function loadContactKeys(token) {
  return loadKeyListFile(token, CONTACT_PATH);
}
async function saveContactKeys(token, keys) {
  return saveKeyListFile(token, CONTACT_PATH, keys, 'Update contact page image via admin panel');
}

async function loadCommissionStatus(token) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${STATUS_PATH}?ref=${REPO_BRANCH}&_=${Date.now()}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: 'no-store' }
  );
  if (res.status === 404) return true; // no file yet — default to open
  if (!res.ok) throw new Error(`Could not load status.json (status ${res.status})`);
  const data = await res.json();
  try {
    const decoded = decodeURIComponent(escape(atob(data.content)));
    const parsed = JSON.parse(decoded);
    return parsed.open !== false;
  } catch {
    return true;
  }
}

async function saveCommissionStatus(token, isOpen) {
  const json = JSON.stringify({ open: isOpen }, null, 2);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return commitFileToRepo(token, STATUS_PATH, base64, `Mark commissions ${isOpen ? 'open' : 'closed'} via admin panel`);
}

async function fetchImagesFolder(token) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${IMAGES_PATH}?ref=${REPO_BRANCH}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  if (!res.ok) {
    throw new Error(`Could not list /${IMAGES_PATH} (status ${res.status})`);
  }
  const data = await res.json();
  const metaFiles = new Set([
    '.gitkeep',
    'featured.json',
    'visible.json',
    'chibi.json',
    'halfbody.json',
    'fullbody.json',
    'contact.json',
  ]);
  return Array.isArray(data) ? data.filter((f) => f.type === 'file' && !metaFiles.has(f.name)) : [];
}

async function deleteFileFromRepo(token, path, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sha,
        branch: REPO_BRANCH,
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `GitHub API error (${res.status})`);
  }
  return res.json();
}

/**
 * Builds a labeled checkbox that toggles membership of `key` in a
 * key-list file (featured.json or visible.json), committing the
 * change immediately on click. `currentKeysRef` is a single-element
 * array used as a mutable box so every checkbox on the page shares
 * the same up-to-date list without needing a shared outer variable.
 */
function buildToggleCheckbox({ label, key, currentKeysRef, saveFn, maxCount, onLabel, offLabel, queueRef }) {
  const wrap = document.createElement('label');
  wrap.className = 'manage-item__toggle';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '0.4rem';
  wrap.style.fontSize = '0.8rem';
  wrap.style.color = 'var(--muted)';
  wrap.style.whiteSpace = 'nowrap';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = currentKeysRef[0].includes(key);

  checkbox.addEventListener('change', () => {
    const token = getToken();
    if (!token) {
      logLine('No GitHub token saved — paste one above first.', 'is-error');
      checkbox.checked = !checkbox.checked;
      return;
    }

    // desired end state captured now, at click time
    const wantChecked = checkbox.checked;
    checkbox.disabled = true;

    // Chain onto this list's queue (shared across every checkbox for the
    // same file, e.g. all "Visible" boxes) so clicks are applied one at a
    // time, each computed from the freshest known state — not the state
    // that existed when the click happened. This is what stops a fast
    // second click from silently undoing a first click still in flight.
    queueRef[0] = queueRef[0]
      .catch(() => {}) // a prior failure shouldn't block the next toggle
      .then(async () => {
        const current = currentKeysRef[0];
        const alreadyIn = current.includes(key);

        if (wantChecked && maxCount && current.length >= maxCount && !alreadyIn) {
          logLine(`Only ${maxCount} pieces can be ${label.toLowerCase()} at once — uncheck one first.`, 'is-error');
          checkbox.checked = alreadyIn;
          checkbox.disabled = false;
          return;
        }

        const next = wantChecked ? (alreadyIn ? current : [...current, key]) : current.filter((k) => k !== key);

        try {
          await saveFn(token, next);
          currentKeysRef[0] = next;
          checkbox.checked = wantChecked;
          logLine(wantChecked ? onLabel : offLabel, 'is-success');
        } catch (err) {
          logLine(`Failed to update ${label.toLowerCase()}: ${err.message}`, 'is-error');
          checkbox.checked = alreadyIn; // revert to whatever it actually was
        } finally {
          checkbox.disabled = false;
        }
      });
  });

  wrap.appendChild(checkbox);
  wrap.appendChild(document.createTextNode(label));
  return wrap;
}

function renderManageList(files, featuredKeys, visibleKeys, chibiKeys, halfBodyKeys, fullBodyKeys, contactKeys) {
  manageList.innerHTML = '';

  if (files.length === 0) {
    manageStatus.textContent = 'No files in /images yet.';
    manageStatus.className = 'token-status';
    return;
  }

  manageStatus.textContent = '';
  // boxed so the shared checkbox helper can update these in place
  const currentFeaturedRef = [featuredKeys.slice()];
  const currentVisibleRef = [visibleKeys.slice()];
  const currentChibiRef = [chibiKeys.slice()];
  const currentHalfBodyRef = [halfBodyKeys.slice()];
  const currentFullBodyRef = [fullBodyKeys.slice()];
  const currentContactRef = [contactKeys.slice()];
  // one promise-chain queue per list, shared by every checkbox for that list
  const featuredQueueRef = [Promise.resolve()];
  const visibleQueueRef = [Promise.resolve()];
  const chibiQueueRef = [Promise.resolve()];
  const halfBodyQueueRef = [Promise.resolve()];
  const fullBodyQueueRef = [Promise.resolve()];
  const contactQueueRef = [Promise.resolve()];

  files.forEach((file) => {
    const row = document.createElement('div');
    row.className = 'manage-item';

    const isImage = IMAGE_EXT_RE.test(file.name);
    const thumb = document.createElement(isImage ? 'img' : 'video');
    thumb.className = 'manage-item__thumb';
    thumb.src = `${RAW_BASE_FOR_THUMBS}/${file.name}`;
    if (!isImage) thumb.muted = true;

    const info = document.createElement('div');
    info.className = 'manage-item__info';

    const name = document.createElement('div');
    name.className = 'manage-item__name';
    name.textContent = file.name;

    const meta = document.createElement('div');
    meta.className = 'manage-item__meta';
    meta.textContent = file.size ? `${(file.size / 1024).toFixed(0)} KB` : '';

    info.appendChild(name);
    info.appendChild(meta);

    // Featured + Visible + the three price-category example pickers —
    // only stills get these; a timelapse video rides along with its
    // still automatically and isn't picked separately.
    //   Featured        -> homepage's 3-card preview (max 3)
    //   Visible         -> shows on the full Projects page at all (no cap;
    //                      unchecked pieces stay hidden from Projects entirely)
    //   Chibi example / Half Body example / Full Body example
    //                   -> the single sample image shown for that category
    //                      on the Prices page (max 1 each)
    let featuredLabel = null;
    let visibleLabel = null;
    let chibiLabel = null;
    let halfBodyLabel = null;
    let fullBodyLabel = null;
    let contactLabel = null;
    if (isImage) {
      const key = baseKeyFromFilename(file.name);

      featuredLabel = buildToggleCheckbox({
        label: 'Featured',
        key,
        currentKeysRef: currentFeaturedRef,
        saveFn: saveFeaturedKeys,
        maxCount: MAX_FEATURED,
        onLabel: `Featured ${file.name} on the homepage.`,
        offLabel: `Removed ${file.name} from the homepage.`,
        queueRef: featuredQueueRef,
      });

      visibleLabel = buildToggleCheckbox({
        label: 'Visible',
        key,
        currentKeysRef: currentVisibleRef,
        saveFn: saveVisibleKeys,
        maxCount: null,
        onLabel: `${file.name} is now visible on the Projects page.`,
        offLabel: `${file.name} is now hidden from the Projects page.`,
        queueRef: visibleQueueRef,
      });

      chibiLabel = buildToggleCheckbox({
        label: 'Chibi example',
        key,
        currentKeysRef: currentChibiRef,
        saveFn: saveChibiKeys,
        maxCount: MAX_CATEGORY_IMAGE,
        onLabel: `${file.name} is now the Chibi example on the Prices page.`,
        offLabel: `Removed ${file.name} as the Chibi example.`,
        queueRef: chibiQueueRef,
      });

      halfBodyLabel = buildToggleCheckbox({
        label: 'Half Body example',
        key,
        currentKeysRef: currentHalfBodyRef,
        saveFn: saveHalfBodyKeys,
        maxCount: MAX_CATEGORY_IMAGE,
        onLabel: `${file.name} is now the Half Body example on the Prices page.`,
        offLabel: `Removed ${file.name} as the Half Body example.`,
        queueRef: halfBodyQueueRef,
      });

      fullBodyLabel = buildToggleCheckbox({
        label: 'Full Body example',
        key,
        currentKeysRef: currentFullBodyRef,
        saveFn: saveFullBodyKeys,
        maxCount: MAX_CATEGORY_IMAGE,
        onLabel: `${file.name} is now the Full Body example on the Prices page.`,
        offLabel: `Removed ${file.name} as the Full Body example.`,
        queueRef: fullBodyQueueRef,
      });

      contactLabel = buildToggleCheckbox({
        label: 'Contact',
        key,
        currentKeysRef: currentContactRef,
        saveFn: saveContactKeys,
        maxCount: MAX_CATEGORY_IMAGE,
        onLabel: `${file.name} is now shown on the Contact page.`,
        offLabel: `Removed ${file.name} from the Contact page.`,
        queueRef: contactQueueRef,
      });
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'manage-item__delete';
    deleteBtn.textContent = 'Delete';

    let armed = false;
    deleteBtn.addEventListener('click', async () => {
      if (!armed) {
        armed = true;
        deleteBtn.textContent = 'Confirm delete?';
        deleteBtn.classList.add('is-confirm');
        // disarm automatically after a few seconds so it can't be
        // accidentally confirmed by a later unrelated click
        setTimeout(() => {
          if (armed) {
            armed = false;
            deleteBtn.textContent = 'Delete';
            deleteBtn.classList.remove('is-confirm');
          }
        }, 4000);
        return;
      }

      const token = getToken();
      if (!token) {
        logLine('No GitHub token saved — paste one above first.', 'is-error');
        return;
      }

      deleteBtn.classList.add('is-deleting');
      deleteBtn.textContent = 'Deleting…';
      logLine(`Deleting ${file.name}…`);

      try {
        await deleteFileFromRepo(token, file.path, file.sha, `Remove ${file.name} via admin panel`);
        logLine(`Deleted ${file.name}`, 'is-success');
        row.remove();
        if (manageList.children.length === 0) {
          manageStatus.textContent = 'No files in /images yet.';
          manageStatus.className = 'token-status';
        }

        // A deleted image can't stay marked in any of these lists — clean
        // up its key from all of them so it doesn't linger as a "ghost"
        // entry that silently counts against a checkbox's limit.
        if (isImage) {
          const deletedKey = baseKeyFromFilename(file.name);
          const listsToClean = [
            { ref: currentFeaturedRef, queueRef: featuredQueueRef, saveFn: saveFeaturedKeys, label: 'featured' },
            { ref: currentVisibleRef, queueRef: visibleQueueRef, saveFn: saveVisibleKeys, label: 'visible' },
            { ref: currentChibiRef, queueRef: chibiQueueRef, saveFn: saveChibiKeys, label: 'Chibi example' },
            { ref: currentHalfBodyRef, queueRef: halfBodyQueueRef, saveFn: saveHalfBodyKeys, label: 'Half Body example' },
            { ref: currentFullBodyRef, queueRef: fullBodyQueueRef, saveFn: saveFullBodyKeys, label: 'Full Body example' },
            { ref: currentContactRef, queueRef: contactQueueRef, saveFn: saveContactKeys, label: 'Contact' },
          ];

          listsToClean.forEach(({ ref, queueRef, saveFn, label }) => {
            if (!ref[0].includes(deletedKey)) return;
            const cleaned = ref[0].filter((k) => k !== deletedKey);
            queueRef[0] = queueRef[0]
              .catch(() => {})
              .then(() => saveFn(token, cleaned))
              .then(() => {
                ref[0] = cleaned;
              })
              .catch((err) => logLine(`Failed to clean up ${label} entry for ${file.name}: ${err.message}`, 'is-error'));
          });
        }
      } catch (err) {
        logLine(`Failed to delete ${file.name}: ${err.message}`, 'is-error');
        deleteBtn.classList.remove('is-deleting');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.remove('is-confirm');
        armed = false;
      }
    });

    row.appendChild(thumb);
    row.appendChild(info);
    if (featuredLabel) row.appendChild(featuredLabel);
    if (visibleLabel) row.appendChild(visibleLabel);
    if (chibiLabel) row.appendChild(chibiLabel);
    if (halfBodyLabel) row.appendChild(halfBodyLabel);
    if (fullBodyLabel) row.appendChild(fullBodyLabel);
    if (contactLabel) row.appendChild(contactLabel);
    row.appendChild(deleteBtn);
    manageList.appendChild(row);
  });
}

async function loadManageList() {
  const token = getToken();
  manageStatus.textContent = 'Loading…';
  manageStatus.className = 'token-status';

  const lists = [
    { load: loadFeaturedKeys, save: saveFeaturedKeys, label: 'featured' },
    { load: loadVisibleKeys, save: saveVisibleKeys, label: 'visible' },
    { load: loadChibiKeys, save: saveChibiKeys, label: 'Chibi example' },
    { load: loadHalfBodyKeys, save: saveHalfBodyKeys, label: 'Half Body example' },
    { load: loadFullBodyKeys, save: saveFullBodyKeys, label: 'Full Body example' },
    { load: loadContactKeys, save: saveContactKeys, label: 'Contact' },
  ];

  try {
    const [files, ...rawKeyLists] = await Promise.all([
      fetchImagesFolder(token),
      ...lists.map((l) => l.load(token).catch(() => [])),
    ]);

    // Self-heal: drop any stored key that no longer matches a real image
    // (e.g. left behind by a file deleted before this cleanup existed,
    // or deleted outside admin.html entirely). These "ghost" entries
    // otherwise silently count against a checkbox's limit even though
    // nothing on screen shows them checked.
    const validKeys = new Set(files.filter((f) => IMAGE_EXT_RE.test(f.name)).map((f) => baseKeyFromFilename(f.name)));

    const cleanedKeyLists = rawKeyLists.map((keys, i) => {
      const cleaned = keys.filter((k) => validKeys.has(k));
      if (token && cleaned.length !== keys.length) {
        const removed = keys.length - cleaned.length;
        const { save, label } = lists[i];
        save(token, cleaned)
          .then(() => logLine(`Cleaned up ${removed} stale ${label} entr${removed === 1 ? 'y' : 'ies'}.`, 'is-success'))
          .catch((err) => logLine(`Could not clean up stale ${label} entries: ${err.message}`, 'is-error'));
      }
      return cleaned;
    });

    renderManageList(files, ...cleanedKeyLists);
  } catch (err) {
    manageStatus.textContent = `Could not load files: ${err.message}`;
    manageStatus.className = 'token-status is-error';
  }
}

refreshManageBtn.addEventListener('click', loadManageList);

// ============================================
// Commission status toggle
// ============================================
const statusToggleBtn = document.getElementById('status-toggle');
let currentStatusOpen = true;

function updateStatusToggleUI() {
  if (!statusToggleBtn) return;
  statusToggleBtn.textContent = currentStatusOpen
    ? 'Commissions: Open (click to close)'
    : 'Commissions: Closed (click to open)';
  statusToggleBtn.style.borderColor = currentStatusOpen ? '#3fb950' : '#f85149';
  statusToggleBtn.style.color = currentStatusOpen ? '#3fb950' : '#f85149';
}

async function refreshStatusToggle() {
  if (!statusToggleBtn) return;
  const token = getToken();
  statusToggleBtn.textContent = 'Loading…';
  try {
    currentStatusOpen = await loadCommissionStatus(token);
    updateStatusToggleUI();
  } catch (err) {
    statusToggleBtn.textContent = 'Could not load status — retry';
  }
}

if (statusToggleBtn) {
  statusToggleBtn.addEventListener('click', async () => {
    const token = getToken();
    if (!token) {
      logLine('No GitHub token saved — paste one above first.', 'is-error');
      return;
    }

    const next = !currentStatusOpen;
    statusToggleBtn.disabled = true;
    statusToggleBtn.textContent = 'Saving…';

    try {
      await saveCommissionStatus(token, next);
      currentStatusOpen = next;
      updateStatusToggleUI();
      logLine(`Commissions marked ${next ? 'open' : 'closed'}.`, 'is-success');
    } catch (err) {
      logLine(`Failed to update commission status: ${err.message}`, 'is-error');
      updateStatusToggleUI(); // restore previous label/color
    } finally {
      statusToggleBtn.disabled = false;
    }
  });
}
