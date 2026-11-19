function playOpening(site, motion, onComplete) {
  const boot = document.querySelector('#boot');
  if (!boot || motion.matches) return onComplete();

  const arrival = performance.getEntriesByType('navigation')[0]?.type;
  // The home link includes an anchor for native navigation, including file previews.
  if (arrival === 'back_forward' || (location.hash && arrival !== 'reload')) return onComplete();
  try {
    const key = 'portfolio-opening-played';
    if (arrival !== 'reload' && sessionStorage.getItem(key)) return onComplete();
    sessionStorage.setItem(key, '1');
  } catch {
    // Some file previews disable browser storage.
  }

  const art = boot.querySelector('pre');
  const dots = boot.querySelector('.boot-status span');
  const mask = art.textContent.split('\n').flatMap(line => {
    const row = Array.from(line, cell => cell + cell).join('');
    return [row, row];
  });
  const columns = mask[0].length;
  const shades = '...::=+A#H@M';
  const rowOffset = .5;
  const waveWidth = columns * 2;
  const travel = columns + rowOffset * (mask.length - 1) + waveWidth;
  const waveStart = 950;
  const waveDuration = 1900;
  const listeners = new AbortController();
  const {signal} = listeners;
  let frame;
  let deadline;
  let lastTick = -1;

  function finish() {
    listeners.abort();
    cancelAnimationFrame(frame);
    clearTimeout(deadline);
    boot.hidden = true;
    site.inert = false;
    document.body.classList.remove('opening', 'opening-exit');
    onComplete();
  }

  art.textContent = mask.map(row => ' '.repeat(row.length)).join('\n');
  boot.hidden = false;
  site.inert = true;
  document.body.classList.add('opening');
  motion.addEventListener('change', finish, {signal, once: true});
  addEventListener('keydown', event => {
    if (event.key === 'Escape') finish();
  }, {signal});

  const started = performance.now();
  function draw(now) {
    const elapsed = now - started;
    const tick = Math.floor(elapsed / (1000 / 60));

    if (tick !== lastTick) {
      lastTick = tick;
      const front = (elapsed - waveStart) / waveDuration * travel;
      dots.textContent = '.'.repeat(1 + Math.floor(elapsed / 220) % 3);
      if (front >= 0) {
        // The same moving band builds and clears the letters, with the densest glyphs at its crest.
        art.textContent = mask.map((row, y) => Array.from(row, (cell, x) => {
          const phase = (front - x - y * rowOffset) / waveWidth;
          if (cell === ' ' || phase <= 0 || phase >= 1) return ' ';
          const density = 1 - Math.abs(2 * phase - 1);
          return shades[Math.round(density * (shades.length - 1))];
        }).join('')).join('\n');
      }
    }

    if (elapsed < waveStart + waveDuration + 90) {
      frame = requestAnimationFrame(draw);
      return;
    }

    document.body.classList.add('opening-exit');
    site.addEventListener('transitionend', event => {
      if (event.target === site && event.propertyName === 'transform') finish();
    }, {signal});
    deadline = setTimeout(finish, 800);
  }
  draw(started);
}
