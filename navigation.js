const localTime = document.querySelector('.location time');
if (localTime) {
  const clock = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', hour:'2-digit', minute:'2-digit'});
  const updateClock = () => { localTime.textContent = clock.format(new Date()); };
  updateClock();
  setInterval(updateClock, 10000);
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function enableSmoothWheel(scroller, speed = 1) {
  const input = scroller === document.scrollingElement ? window : scroller;
  const frameInterval = 1000 / 60;
  let target = 0;
  let frame = 0;
  let previousTime;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = undefined;
  }

  function glide(now) {
    const position = scroller.scrollTop;
    const destination = Math.min(target, scroller.scrollHeight - scroller.clientHeight);
    const remaining = destination - position;
    if (Math.abs(remaining) < 1) {
      scroller.scrollTo({top: destination, behavior: 'instant'});
      stop();
      return;
    }
    const elapsed = now - (previousTime ?? (now - frameInterval));
    previousTime = now;
    const fraction = 1 - Math.pow(.84, elapsed / frameInterval);
    const step = Math.sign(remaining) * Math.max(1, Math.abs(remaining) * fraction);
    scroller.scrollTo({top: position + step, behavior: 'instant'});
    frame = requestAnimationFrame(glide);
  }

  input.addEventListener('wheel', event => {
    const unit = [1, 16, scroller.clientHeight][event.deltaMode] || 1;
    if (reduced.matches || event.defaultPrevented || !event.cancelable || event.ctrlKey || event.shiftKey ||
        !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const position = scroller.scrollTop;
    const delta = event.deltaY * unit * speed;
    const start = frame && Math.sign(target - position) === Math.sign(delta) ? target : position;
    target = Math.min(scroller.scrollHeight - scroller.clientHeight, Math.max(0, start + delta));
    if (!frame && target === position) return;
    event.preventDefault();
    if (!frame) frame = requestAnimationFrame(glide);
  }, {passive: false});
  input.addEventListener('pointerdown', stop);
  input.addEventListener('keydown', stop);
  reduced.addEventListener('change', stop);
}

if (document.body.classList.contains('about-page')) enableSmoothWheel(document.scrollingElement);

const transitKey = 'portfolio-arrival';
let overlay;
function scramble(entering, done) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return done();
  overlay = canvas;
  canvas.className = 'scramble-screen';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  document.body.append(canvas);
  const background = getComputedStyle(document.documentElement).backgroundColor;
  const glyphs = '#@%=+*;:/<>01';
  const cols = Math.ceil(canvas.width / 11);
  const rows = Math.ceil(canvas.height / 17);
  const total = cols * rows;
  const visited = new Uint8Array(total);
  const frontier = [];
  const cells = [];
  function infect(index) {
    if (visited[index]) return;
    visited[index] = 1;
    frontier.push(index);
    cells.push({x: index % cols * 11, y: Math.floor(index / cols) * 17,
      distance: cells.length, seed: Math.floor(Math.random() * 100)});
  }
  for (let i = 0; i < 6; i++) infect(Math.floor(Math.random() * total));
  while (frontier.length) {
    // Extend a tip for several cells, then branch from another live tip.
    const slot = Math.floor(Math.random() * frontier.length);
    let tip = frontier[slot];
    for (let step = 0; step < 12; step++) {
      const neighbors = [];
      if (tip % cols) neighbors.push(tip - 1);
      if (tip % cols < cols - 1) neighbors.push(tip + 1);
      if (tip >= cols) neighbors.push(tip - cols);
      if (tip + cols < total) neighbors.push(tip + cols);
      const free = neighbors.filter(index => !visited[index]);
      if (!free.length) {
        if (step === 0) {
          frontier[slot] = frontier[frontier.length - 1];
          frontier.pop();
        }
        break;
      }
      tip = free[Math.floor(Math.random() * free.length)];
      infect(tip);
    }
  }
  const maxDistance = total - 1;
  const started = performance.now();
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(deadline);
    done();
  }
  const deadline = setTimeout(finish, 480);
  function draw(now) {
    if (finished || !canvas.isConnected) return;
    const progress = Math.max(0, Math.min(1, (now - started) / 360));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px monospace';
    const tick = Math.floor(progress * 9);
    for (const cell of cells) {
      if ((cell.distance <= progress * maxDistance) === entering) continue;
      ctx.fillStyle = background;
      ctx.fillRect(cell.x, cell.y, 11, 17);
      ctx.fillStyle = cell.seed % 3 ? '#777' : '#ccc';
      ctx.fillText(glyphs[(cell.seed + tick) % glyphs.length], cell.x, cell.y + 13);
    }
    if (progress < 1) requestAnimationFrame(draw);
    else finish();
  }
  draw(started);
}
try {
  const arrival = JSON.parse(sessionStorage.getItem(transitKey));
  sessionStorage.removeItem(transitKey);
  if (arrival?.url === location.href && Date.now() - arrival.time < 10000 && !reduced.matches) {
    document.documentElement.setAttribute('data-arriving', '');
    scramble(true, () => { overlay?.remove(); overlay = null; });
  }
} catch { /* Direct navigation still works when browser storage is unavailable. */ }
document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link || link.protocol !== location.protocol || link.origin !== location.origin ||
      (link.pathname === location.pathname && link.search === location.search) ||
      reduced.matches || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  event.preventDefault();
  if (overlay?.isConnected) { location.assign(link.href); return; }
  scramble(false, () => {
    try { sessionStorage.setItem(transitKey, JSON.stringify({url:link.href, time:Date.now()})); } catch {}
    location.assign(link.href);
  });
});
addEventListener('pageshow', event => {
  if (event.persisted) { overlay?.remove(); overlay = null; }
});

// Preserve the real text for layout and assistive technology throughout decoding.
if (!reduced.matches) {
  const aboutPage = document.body.classList.contains('about-page');
  let nextStart = 0;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries.sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)) {
      if (!entry.isIntersecting) continue;
      const element = entry.target;
      observer.unobserve(element);
      const now = performance.now();
      const earliest = overlay ? 320 : 0;
      const delay = Math.max(earliest, nextStart - now);
      nextStart = now + delay + 175;
      element.classList.add('decode-pending');
      setTimeout(() => {
        element.classList.remove('decode-pending');
        if (reduced.matches) return;
        if (element.hasAttribute('data-reveal')) {
          element.classList.add('revealing');
          return;
        }
        const original = element.textContent;
        element.classList.add('decoding');
        const glyphs = 'Aλx=ΣvᵀI';
        const start = performance.now();
        function decode(now) {
          const frame = Math.floor((now - start) / 45);
          if (frame >= 12 || reduced.matches) {
            element.classList.remove('decoding');
            delete element.dataset.decode;
            return;
          }
          element.dataset.decode = Array.from(original, (char, i) =>
            /\s/.test(char) || (i * 7 % 13) <= frame ? char : glyphs[(i + frame) % glyphs.length]
          ).join('');
          requestAnimationFrame(decode);
        }
        decode(start);
      }, delay);
    }
  });
  addEventListener('DOMContentLoaded', () => {
    const shared = '.wordmark, nav > a, nav > span, .mast-action';
    const targets = document.querySelectorAll(aboutPage
      ? `${shared}, nav > button, [data-reveal], .about-intro, .about-section h2,
         .about-section-copy > p, .contact-grid h2, .contact-grid a, .back-to-top`
      : shared);
    if (aboutPage) targets.forEach(element => element.classList.add('decode-pending'));
    const observePage = () => targets.forEach(element => observer.observe(element));
    if (document.querySelector('#boot:not([hidden])')) addEventListener('introcomplete', observePage, {once:true});
    else observePage();
  });
}

const brand = document.querySelector('.wordmark');
const brandText = brand.textContent;
function scheduleWordmark() {
  setTimeout(() => {
    if (!document.hidden && !reduced.matches && !brand.matches('.decode-pending, .decoding')) {
      let step = 0;
      const burst = setInterval(() => {
        if (++step >= 6 || reduced.matches || document.hidden) {
          clearInterval(burst);
          brand.textContent = brandText;
          return;
        }
        const i = Math.floor(Math.random() * brandText.length);
        brand.textContent = brandText.slice(0,i) + 'λΣΔ01'[step % 5] + brandText.slice(i + 1);
      }, 55);
    }
    scheduleWordmark();
  }, 4200 + Math.random() * 5500);
}
scheduleWordmark();

// Overlay just the label so icons, link names and the scroll-selected title stay intact.
let endHover = () => {};
document.addEventListener('pointerover', event => {
  const link = event.target.closest('a[href], button:enabled');
  if (!link || link.matches('.decode-pending, .decoding') || link.contains(event.relatedTarget) ||
      reduced.matches || event.pointerType === 'touch') return;
  endHover();
  const label = [...link.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
  if (!label) return;
  const range = document.createRange();
  range.selectNodeContents(label);
  const rect = range.getBoundingClientRect();
  const style = getComputedStyle(link);
  const ghost = document.createElement('span');
  ghost.className = 'hover-scramble';
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    backgroundColor: style.getPropertyValue('--link-surface').trim(),
    color: style.color,
    left: rect.left + 'px', top: rect.top + 'px', height: rect.height + 'px',
    width: rect.width + 'px', fontFamily: style.fontFamily, fontSize: style.fontSize,
    fontWeight: style.fontWeight, fontStyle: style.fontStyle, lineHeight: rect.height + 'px',
    letterSpacing: style.letterSpacing, textTransform: style.textTransform, opacity: style.opacity
  });
  const original = label.textContent;
  const positions = Array.from(original, (char, i) => i).filter(i => original[i].trim());
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const start = performance.now();
  let timer;
  endHover = () => {
    clearTimeout(timer);
    ghost.remove();
    link.removeEventListener('pointerleave', endHover);
    endHover = () => {};
  };
  link.addEventListener('pointerleave', endHover);
  function tick() {
    const progress = Math.max(0, (performance.now() - start - 55) / 240);
    if (progress >= 1 || reduced.matches || !link.isConnected) return endHover();
    const count = Math.round(Math.sin(progress * Math.PI) * Math.ceil(positions.length * .45));
    const chars = Array.from(original);
    for (const i of positions.slice(0, count)) chars[i] = 'Σ01λ+#'[Math.floor(Math.random() * 6)];
    ghost.textContent = chars.join('');
    if (count && !ghost.isConnected) document.body.append(ghost);
    timer = setTimeout(tick, 22);
  }
  tick();
});
addEventListener('scroll', () => endHover(), true);
