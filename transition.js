const transitKey = 'portfolio-arrival';
const pageRoot = document.documentElement;

try {
  const arrival = JSON.parse(sessionStorage.getItem(transitKey));
  sessionStorage.removeItem(transitKey);
  if (arrival?.url === location.href && Date.now() - arrival.time < 10000 &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // This script runs in the head, before any destination content can paint.
    pageRoot.setAttribute('data-arriving', 'pending');
    addEventListener('DOMContentLoaded', () => {
      if (pageRoot.getAttribute('data-arriving') === 'pending') pageRoot.removeAttribute('data-arriving');
    }, {once: true});
  }
} catch { /* Leave the page visible when browser storage is unavailable. */ }
