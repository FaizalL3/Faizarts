// ============================================
// CONFIG — must match admin.js
// ============================================
const GALLERY_REPO_OWNER = 'FaizalL3';
const GALLERY_REPO_NAME = 'Faizarts';
const GALLERY_BRANCH = 'main';
const GALLERY_IMAGES_PATH = 'images';

// Raw file base — fastest way to actually serve the image bytes,
// since the GitHub Contents API itself doesn't give a direct CDN url
// for unauthenticated, no-extra-request access.
const RAW_BASE = `https://raw.githubusercontent.com/${GALLERY_REPO_OWNER}/${GALLERY_REPO_NAME}/${GALLERY_BRANCH}/${GALLERY_IMAGES_PATH}`;
const RAW_BASE_ROOT = `https://raw.githubusercontent.com/${GALLERY_REPO_OWNER}/${GALLERY_REPO_NAME}/${GALLERY_BRANCH}`;

const STILL_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov'];

function splitExt(filename) {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return { base: filename, ext: '' };
  return { base: filename.slice(0, idx), ext: filename.slice(idx + 1).toLowerCase() };
}

function titleFromBase(base) {
  // strip a trailing "-timelapse" if present (shouldn't be, but safety)
  const cleaned = base.replace(/-timelapse$/i, '');
  const spaced = cleaned.replace(/[-_]+/g, ' ').trim();
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Untitled';
}

/**
 * Fetches the /images folder listing and groups files into pieces:
 * { key, title, stillUrl, timelapseUrl, updatedAt }
 * Pairing rule: "piece1.png" is the still, "piece1-timelapse.mp4" is its timelapse.
 */
async function loadGalleryPieces() {
  const res = await fetch(
    `https://api.github.com/repos/${GALLERY_REPO_OWNER}/${GALLERY_REPO_NAME}/contents/${GALLERY_IMAGES_PATH}?ref=${GALLERY_BRANCH}`
  );

  if (!res.ok) {
    console.warn('Gallery: could not list /images folder', res.status);
    return [];
  }

  const files = await res.json();
  if (!Array.isArray(files)) return [];

  const stills = new Map(); // key -> { name, ext }
  const timelapses = new Map(); // key -> { name, ext }

  files.forEach((f) => {
    if (f.type !== 'file') return;
    const { base, ext } = splitExt(f.name);

    if (/-timelapse$/i.test(base) && VIDEO_EXTENSIONS.includes(ext)) {
      const key = base.replace(/-timelapse$/i, '').toLowerCase();
      timelapses.set(key, f.name);
    } else if (STILL_EXTENSIONS.includes(ext)) {
      const key = base.toLowerCase();
      stills.set(key, f.name);
    }
  });

  const pieces = [];
  stills.forEach((filename, key) => {
    pieces.push({
      key,
      title: titleFromBase(key),
      stillUrl: `${RAW_BASE}/${filename}`,
      timelapseUrl: timelapses.has(key) ? `${RAW_BASE}/${timelapses.get(key)}` : '',
      // GitHub's contents API doesn't return commit dates per file in this
      // endpoint, so we fall back to filename order. Pieces named with a
      // leading number (piece1, piece2...) will sort newest-last by default;
      // reverse so most recently added (highest number / latest alpha) shows first.
      sortKey: key,
    });
  });

  // best-effort "newest first" — numeric-aware sort, descending
  pieces.sort((a, b) => b.sortKey.localeCompare(a.sortKey, undefined, { numeric: true }));

  return pieces;
}

/**
 * Reads the curated picks saved from admin.html. Returns an array of
 * piece keys. Missing file (nobody's picked anything yet) or a fetch
 * error just means "no picks" — callers fall back to sensible defaults.
 */
async function loadKeyListFromRaw(filename) {
  try {
    const res = await fetch(`${RAW_BASE}/${filename}`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadFeaturedKeys() {
  return loadKeyListFromRaw('featured.json');
}

function loadVisibleKeys() {
  return loadKeyListFromRaw('visible.json');
}

function buildArtCard(piece) {
  const card = document.createElement('div');
  card.className = 'art-card';
  card.dataset.still = piece.stillUrl;
  card.dataset.timelapse = piece.timelapseUrl;
  card.dataset.title = piece.title;

  card.innerHTML = `
    <img class="art-card__media is-visible" src="${piece.stillUrl}" alt="${piece.title}" />
    <div class="art-card__progress"></div>
    <div class="art-card__caption">${piece.title}</div>
  `;

  return card;
}

/**
 * Renders pieces into a grid container, capped at `limit`.
 *
 * mode controls which pieces are eligible:
 *   'featured' (homepage) — only pieces checked "Featured" in admin.html,
 *                            in the order they were picked. Falls back to
 *                            newest-first if nothing has been featured yet,
 *                            so the homepage isn't empty before you curate it.
 *   'visible'  (projects page) — only pieces checked "Visible" in admin.html.
 *                            This is opt-in: nothing shows here until you've
 *                            explicitly marked pieces visible. No fallback,
 *                            since showing un-vetted uploads by default isn't
 *                            what you asked for.
 *   'all' (default)      — every uploaded piece, newest-first. Used if this
 *                            is called without a mode.
 *
 * Falls back silently (leaves existing placeholder markup) only when NO
 * images have been uploaded at all yet, so the site never shows a broken
 * empty page before any art exists in the repo.
 */
async function renderGallery(containerSelector, limit, mode) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  let pieces;
  try {
    pieces = await loadGalleryPieces();
  } catch (err) {
    console.warn('Gallery: fetch failed, keeping placeholders', err);
    return;
  }

  if (pieces.length === 0) return; // keep static placeholder cards as-is

  let toShow;

  if (mode === 'featured') {
    const featuredKeys = await loadFeaturedKeys();
    const byKey = new Map(pieces.map((p) => [p.key, p]));
    const picked = featuredKeys.map((k) => byKey.get(k)).filter(Boolean);
    toShow = picked.length > 0 ? picked.slice(0, limit) : pieces.slice(0, limit);
  } else if (mode === 'visible') {
    const visibleKeys = await loadVisibleKeys();
    const visibleSet = new Set(visibleKeys);
    toShow = pieces.filter((p) => visibleSet.has(p.key)).slice(0, limit);
  } else {
    toShow = pieces.slice(0, limit);
  }

  container.innerHTML = '';

  if (toShow.length === 0) {
    const empty = document.createElement('p');
    empty.style.color = 'var(--muted)';
    empty.style.gridColumn = '1 / -1';
    empty.textContent = 'No pieces published yet — check back soon.';
    container.appendChild(empty);
    return;
  }

  toShow.forEach((piece) => container.appendChild(buildArtCard(piece)));

  // re-attach the same interaction behavior main.js uses
  if (typeof attachArtCardBehavior === 'function') {
    attachArtCardBehavior(container.querySelectorAll('.art-card'));
  }
}

// ============================================
// Price category example images (Prices page)
// Each category (chibi / half body / full body) has at most one
// picked image, saved from admin.html into its own JSON file.
// ============================================
async function loadCategoryKey(filename) {
  const keys = await loadKeyListFromRaw(filename);
  return keys.length > 0 ? keys[0] : null;
}

/**
 * Replaces the placeholder text in a price-card__image container with
 * the picked example image for that category, if one has been chosen.
 * Leaves the existing placeholder text alone if nothing's picked yet
 * or the image can't be found, so the Prices page never breaks.
 */
async function renderCategoryExample(containerSelector, categoryFile, fitMode = 'cover') {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  let pieces;
  try {
    pieces = await loadGalleryPieces();
  } catch (err) {
    console.warn('Category example: fetch failed, keeping placeholder', err);
    return;
  }

  const key = await loadCategoryKey(categoryFile);
  if (!key) return; // nothing picked yet — keep placeholder text

  const piece = pieces.find((p) => p.key === key);
  if (!piece) return; // picked image no longer exists — keep placeholder text

  container.innerHTML = '';
  const img = document.createElement('img');
  img.src = piece.stillUrl;
  img.alt = piece.title;

  if (fitMode === 'contain') {
    // shows the whole drawing, scaled down to fit, nothing cropped —
    // used for the Contact page since that art can be any orientation
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
  } else {
    // fills the fixed-ratio price-card box, cropping as needed
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
  }

  container.appendChild(img);
}

// ============================================
// Commission status badge (homepage)
// ============================================
async function loadCommissionStatus() {
  try {
    const res = await fetch(`${RAW_BASE_ROOT}/status.json`, { cache: 'no-store' });
    if (!res.ok) return true; // no file yet — default to open
    const data = await res.json();
    return data.open !== false;
  } catch {
    return true; // default to open if anything goes wrong
  }
}

async function renderCommissionStatus(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const isOpen = await loadCommissionStatus();
  const textEl = container.querySelector('.status-badge__text');

  container.classList.remove('status-badge--open', 'status-badge--closed');
  container.classList.add(isOpen ? 'status-badge--open' : 'status-badge--closed');
  if (textEl) textEl.textContent = isOpen ? 'Commissions Open' : 'Commissions Closed';
}
