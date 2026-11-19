function enableSmoothWheel(scroller, motion, signal) {
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

  scroller.addEventListener('wheel', event => {
    if (motion.matches || event.defaultPrevented || !event.cancelable || event.ctrlKey ||
        event.shiftKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

    const unit = [1, 16, scroller.clientHeight][event.deltaMode] || 1;
    const position = scroller.scrollTop;
    const delta = event.deltaY * unit * .45;
    const start = frame && Math.sign(target - position) === Math.sign(delta) ? target : position;
    target = Math.min(scroller.scrollHeight - scroller.clientHeight, Math.max(0, start + delta));
    if (!frame && target === position) return;
    event.preventDefault();
    if (!frame) frame = requestAnimationFrame(glide);
  }, {passive: false, signal});
  scroller.addEventListener('pointerdown', stop, {signal});
  scroller.addEventListener('keydown', stop, {signal});
  motion.addEventListener('change', stop, {signal});
  signal.addEventListener('abort', stop, {once: true});
}

function initProjects(list, motion, signal) {
  const links = [...list.children];
  const titles = links.map(link => link.textContent);
  const alphabet = '#%+=:/<>[]{}01';
  const order = titles.map(title => {
    const indices = Array.from(title, (_, i) => i).filter(i => title[i] !== ' ');
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  });
  links.forEach((link, i) => link.setAttribute('aria-label', titles[i]));

  let visualScroll = list.scrollTop;
  let painting = 0;

  function paintProjects() {
    if (motion.matches) {
      links.forEach((link, i) => {
        link.textContent = titles[i];
        link.style.removeProperty('opacity');
        link.style.removeProperty('filter');
      });
      visualScroll = list.scrollTop;
      painting = 0;
      return;
    }

    const delta = list.scrollTop - visualScroll;
    visualScroll += Math.abs(delta) < .3 ? delta : delta * .2;
    const first = links[0].getBoundingClientRect();
    const center = list.getBoundingClientRect().top + list.clientHeight / 2;
    const position = (center - first.top - first.height / 2) / first.height;
    const animated = position + (visualScroll - list.scrollTop) / first.height;
    const selected = Math.max(0, Math.min(links.length - 1, Math.round(position)));

    links.forEach((link, i) => {
      const distance = Math.abs(animated - i);
      const amount = i === selected ? 0 : Math.min(1, Math.pow(Math.max(0, (distance - .5) / 1.5), 1.65));
      const chars = Array.from(titles[i]);
      const phase = amount * order[i].length;
      order[i].slice(0, Math.round(phase)).forEach((index, rank) => {
        const tick = Math.floor(phase * 3);
        chars[index] = alphabet[(index * 7 + rank + tick) % alphabet.length];
      });
      const text = chars.join('');
      if (link.textContent !== text) link.textContent = text;
      link.style.opacity = String(Math.max(.29, 1 - distance * .45));
      link.style.filter = 'blur(' + (1.7 * amount) + 'px)';
    });
    painting = visualScroll !== list.scrollTop ? requestAnimationFrame(paintProjects) : 0;
  }

  function queuePaint() {
    if (!painting) painting = requestAnimationFrame(paintProjects);
  }

  paintProjects();
  list.addEventListener('scroll', queuePaint, {passive: true, signal});
  motion.addEventListener('change', queuePaint, {signal});
  const observer = new ResizeObserver(queuePaint);
  observer.observe(list);
  signal.addEventListener('abort', () => {
    observer.disconnect();
    cancelAnimationFrame(painting);
  }, {once: true});
  enableSmoothWheel(list, motion, signal);
  list.addEventListener('focusin', event => {
    if (event.target.matches('a:focus-visible')) event.target.scrollIntoView({block: 'center'});
  }, {signal});
}
