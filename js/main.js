// ============================================
// Mobile nav toggle
// ============================================
const navToggle = document.querySelector('.nav__toggle');
const navLinks = document.querySelector('.nav__links');

if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('is-open');
  });

  navLinks.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => navLinks.classList.remove('is-open'));
  });
}

// ============================================
// Lightbox
// ============================================
const lightbox = document.getElementById('lightbox');
const lightboxFrame = lightbox ? lightbox.querySelector('.lightbox__frame') : null;
const lightboxClose = lightbox ? lightbox.querySelector('.lightbox__close') : null;

function buildLightboxContent(card) {
  const still = card.dataset.still;
  const timelapse = card.dataset.timelapse;
  const title = card.dataset.title || 'Untitled piece';

  lightboxFrame.innerHTML = '';

  if (!still && !timelapse) {
    lightboxFrame.innerHTML = `<span class="lightbox__placeholder">Artwork coming soon — ${title}</span>`;
    return;
  }

  if (still) {
    const img = document.createElement('img');
    img.src = still;
    img.alt = title;
    img.className = 'lightbox__media';
    lightboxFrame.appendChild(img);
  }

  if (timelapse) {
    const playBtn = document.createElement('button');
    playBtn.className = 'lightbox__play';
    playBtn.setAttribute('aria-label', `Play timelapse of ${title}`);
    playBtn.innerHTML = `
      <span class="lightbox__play-icon">
        <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
          <path d="M5 3L19 11L5 19V3Z" fill="#16151A"/>
        </svg>
      </span>
      <span class="lightbox__play-label">Play timelapse</span>
    `;

    playBtn.addEventListener('click', () => {
      const video = document.createElement('video');
      video.src = timelapse;
      video.className = 'lightbox__media';
      video.controls = true; // native controls include a working scrub bar
      video.autoplay = true;
      lightboxFrame.innerHTML = '';
      lightboxFrame.appendChild(video);
    });

    lightboxFrame.appendChild(playBtn);
  }

  const caption = document.createElement('span');
  caption.className = 'lightbox__caption';
  caption.textContent = title;
  lightboxFrame.appendChild(caption);
}

function openLightbox(card) {
  if (!lightbox) return;
  buildLightboxContent(card);
  lightbox.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove('is-open');
  document.body.style.overflow = '';
  const video = lightboxFrame.querySelector('video');
  if (video) video.pause();
}

if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}

if (lightbox) {
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// ============================================
// Art card interaction — click to open lightbox,
// hover 3s to swap the still image for the timelapse video.
//
// Exposed as a named function so gallery.js can re-run it on
// cards it builds dynamically after fetching /images from GitHub.
// ============================================
function attachArtCardBehavior(cards) {
  cards.forEach((card) => {
    // avoid double-binding if this card was already wired up
    if (card.dataset.bound === 'true') return;
    card.dataset.bound = 'true';

    card.addEventListener('click', () => openLightbox(card));

    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(card);
      }
    });

    let hoverTimer = null;

    card.addEventListener('mouseenter', () => {
      const timelapse = card.dataset.timelapse;
      if (!timelapse) return;

      hoverTimer = setTimeout(() => {
        const mediaEl = card.querySelector('.art-card__media');
        if (!mediaEl) return;

        // swap the still <img> for a <video> playing the timelapse
        if (mediaEl.tagName !== 'VIDEO') {
          const video = document.createElement('video');
          video.className = 'art-card__media is-visible';
          video.src = timelapse;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          mediaEl.replaceWith(video);
          video.play().catch(() => {});
        } else {
          mediaEl.currentTime = 0;
          mediaEl.play().catch(() => {});
        }
      }, 3000);
    });

    card.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      const mediaEl = card.querySelector('.art-card__media');
      if (mediaEl && mediaEl.tagName === 'VIDEO') {
        const still = card.dataset.still;
        if (still) {
          const img = document.createElement('img');
          img.className = 'art-card__media is-visible';
          img.src = still;
          img.alt = card.dataset.title || '';
          mediaEl.replaceWith(img);
        } else {
          mediaEl.pause();
        }
      }
    });
  });
}

// wire up any cards already present in the static HTML on load
attachArtCardBehavior(document.querySelectorAll('.art-card'));
