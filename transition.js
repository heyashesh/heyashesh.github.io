(() => {
  const key = 'portfolio-arrival';
  const root = document.documentElement;
  const page = url => url.pathname.replace(/\/index\.html$/, '/') + url.search + url.hash;

  try {
    const arrival = JSON.parse(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);
    if (!Number.isFinite(arrival?.time) || Math.abs(Date.now() - arrival.time) >= 10000 ||
        matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const destination = new URL(arrival.url);
    if (destination.protocol !== location.protocol || destination.origin !== location.origin ||
        page(destination) !== page(location)) return;

    // Keep the destination under cover until the first complete canvas frame is ready.
    root.dataset.arriving = 'pending';
    if (Number.isInteger(arrival.seed)) root.dataset.transitionSeed = String(arrival.seed);
    addEventListener('DOMContentLoaded', () => {
      requestAnimationFrame(() => {
        if (root.dataset.arriving === 'pending' || root.dataset.arriving === 'covered') {
          delete root.dataset.arriving;
          delete root.dataset.transitionSeed;
        }
      });
    }, {once: true});
  } catch { /* Leave the page visible when browser storage is unavailable. */ }
})();
