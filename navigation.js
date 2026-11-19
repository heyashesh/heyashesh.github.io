(() => {
  const site = document.querySelector('#site');
  const frame = document.querySelector('#page-frame');
  const wordmark = site.querySelector('.wordmark');
  const navigation = [...site.querySelectorAll('.mast [data-route], .site-nav [data-route]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const pagePath = url => new URL(url).pathname.replace(/\/index\.html$/, '/');
  const routes = new Map(navigation.map(link => {
    const href = link.href;
    // Keep the shared links anchored to this document when pushState changes its URL.
    link.href = href;
    return [pagePath(href), link.dataset.route];
  }));

  let current = frame.querySelector('main');
  let currentPath = pagePath(location.href);
  let pendingNavigation;
  let arrivalResize;
  let pageEffects = new AbortController();
  const pages = new Map([[currentPath, {main: current.cloneNode(true), title: document.title}]]);
  const positions = new Map();
  const labelAnimations = new WeakMap();

  function decodeLabel(element, signal, delay = 0) {
    labelAnimations.get(element)?.();
    const label = element.textContent;
    const glyphs = '#%+=01';
    const start = performance.now() + delay;
    let frameId;
    let previousTick = -1;

    function clear() {
      cancelAnimationFrame(frameId);
      element.classList.remove('decoding');
      delete element.dataset.glyphs;
      labelAnimations.delete(element);
      signal.removeEventListener('abort', clear);
    }

    function draw(now) {
      const tick = Math.max(0, Math.floor((now - start) / 40));
      if (tick >= 8 || reducedMotion.matches) return clear();
      if (tick !== previousTick) {
        previousTick = tick;
        element.dataset.glyphs = Array.from(label, (char, i) =>
          /\s/.test(char) || i * 5 % 8 <= tick ? char : glyphs[(i + tick) % glyphs.length]
        ).join('');
      }
      frameId = requestAnimationFrame(draw);
    }

    labelAnimations.set(element, clear);
    signal.addEventListener('abort', clear, {once: true});
    element.classList.add('decoding');
    draw(performance.now());
  }

  function animateElements(elements, signal) {
    if (reducedMotion.matches) return;
    elements.forEach((element, index) => {
      if (element.hasAttribute('data-reveal')) {
        element.style.setProperty('--reveal-delay', index * 70 + 'ms');
        element.classList.add('revealing');
        return;
      }

      decodeLabel(element, signal, index * 65);
    });
  }

  function mountPage(signal, animateNavigation = false) {
    const clock = current.querySelector('.location time');
    if (clock) {
      const format = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit',
      });
      const update = () => { clock.textContent = format.format(new Date()); };
      update();
      const timer = setInterval(update, 10000);
      signal.addEventListener('abort', () => clearInterval(timer), {once: true});
    }

    const projects = current.querySelector('.entries');
    if (projects) initProjects(projects, reducedMotion, signal);
    animateElements([...current.querySelectorAll('[data-reveal], [data-decode]')], signal);
    if (animateNavigation) animateElements(navigation.filter(link => link.hasAttribute('data-decode')), signal);
  }

  function removeLeavingPage() {
    frame.querySelector('.page-leaving')?.remove();
  }

  function showPage(page, url, restoreScroll) {
    removeLeavingPage();
    pageEffects.abort();
    arrivalResize?.cancel();
    pageEffects = new AbortController();
    const outgoing = current;
    const scroll = positions.get(pagePath(url.href));

    current = page.main.cloneNode(true);
    currentPath = pagePath(url.href);
    document.title = page.title;
    document.body.dataset.page = current.dataset.page;

    for (const link of navigation) {
      if (link.dataset.route === current.dataset.page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    if (reducedMotion.matches) {
      outgoing.replaceWith(current);
    } else {
      outgoing.removeAttribute('id');
      outgoing.inert = true;
      outgoing.setAttribute('aria-hidden', 'true');
      outgoing.style.setProperty('--exit-top', -scrollY + 'px');
      outgoing.classList.remove('page-entering');
      outgoing.classList.add('page-leaving');
      outgoing.addEventListener('animationend', event => {
        if (event.target === outgoing && event.animationName === 'page-out') outgoing.remove();
      });
      outgoing.addEventListener('animationcancel', event => {
        if (event.target === outgoing && event.animationName === 'page-out') outgoing.remove();
      });
      pageEffects.signal.addEventListener('abort', () => outgoing.remove(), {once: true});
      current.classList.add('page-entering');
      frame.append(current);
      current.addEventListener('animationend', event => {
        if (event.target === current && event.animationName === 'page-in') current.classList.remove('page-entering');
      });
    }

    const fragment = url.hash.slice(1);
    const anchor = fragment && document.getElementById(fragment);
    if (anchor) anchor.scrollIntoView();
    else scrollTo({top: restoreScroll ? scroll?.window ?? 0 : 0, behavior: 'instant'});
    if (restoreScroll && scroll?.projects) {
      const entries = current.querySelector('.entries');
      if (entries) entries.scrollTop = scroll.projects;
    }

    current.focus({preventScroll: true});
    mountPage(pageEffects.signal);
  }

  async function navigate(url, fromHistory = false) {
    pendingNavigation?.abort();
    const path = pagePath(url.href);
    if (path === currentPath) return;

    const request = new AbortController();
    pendingNavigation = request;

    try {
      let page = pages.get(path);
      if (!page) {
        const response = await fetch(url, {cache: 'no-cache', signal: request.signal});
        if (!response.ok) throw new Error('Page could not be loaded.');
        const html = new DOMParser().parseFromString(await response.text(), 'text/html');
        const main = html.querySelector('#page-content');
        if (main?.dataset.page !== routes.get(path)) throw new Error('Page layout was not found.');
        page = {main, title: html.title};
        pages.set(path, page);
      }
      if (request.signal.aborted) return;
      positions.set(currentPath, {window: scrollY, projects: current.querySelector('.entries')?.scrollTop});
      if (!fromHistory) {
        const destination = new URL(url);
        if (destination.hash === '#page-content') destination.hash = '';
        history.pushState(null, '', destination);
      }
      showPage(page, url, fromHistory);
    } catch {
      if (!request.signal.aborted) {
        if (fromHistory) location.reload();
        else location.assign(url);
      }
    } finally {
      if (pendingNavigation === request) pendingNavigation = null;
    }
  }

  if (location.protocol === 'http:' || location.protocol === 'https:') {
    history.scrollRestoration = 'manual';
    site.addEventListener('click', event => {
      const link = event.target.closest('a[data-route]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
          event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || !routes.has(pagePath(url.href))) return;
      url.pathname = pagePath(url.href);
      event.preventDefault();
      navigate(url);
    });
    addEventListener('popstate', () => {
      const url = new URL(location.href);
      if (routes.has(pagePath(url.href))) navigate(url, true);
    });
  }

  site.addEventListener('pointerover', event => {
    const label = event.target.closest('.site-nav a, .information a[href]');
    if (!label || label.contains(event.relatedTarget) || labelAnimations.has(label) ||
        event.pointerType === 'touch' || reducedMotion.matches) return;
    decodeLabel(label, pageEffects.signal);
  });

  // Native navigation, including file previews, replaces the wordmark along with the page.
  const arrival = performance.getEntriesByType('navigation')[0]?.type;
  if (arrival === 'navigate' && location.hash === '#page-content' && !reducedMotion.matches) {
    const style = getComputedStyle(wordmark);
    const from = current.dataset.page === 'home' ? style.getPropertyValue('--compact-scale') : 1;
    arrivalResize = wordmark.animate(
      [{transform: 'scale(' + from + ')'}, {transform: style.transform}],
      {duration: parseFloat(style.transitionDuration) * 1000, easing: style.transitionTimingFunction},
    );
  }

  playOpening(site, reducedMotion, () => mountPage(pageEffects.signal, true));
})();
