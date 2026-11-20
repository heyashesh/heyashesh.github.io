(() => {
  const site = document.querySelector('#site');
  const frame = document.querySelector('#page-frame');
  const wordmark = document.createElement('a');
  wordmark.className = 'wordmark';
  wordmark.href = new URL('index.html#page-content', document.currentScript.src).href;
  wordmark.dataset.route = 'home';
  wordmark.textContent = 'ashesh';
  wordmark.setAttribute('aria-label', 'Ashesh Das, home');
  if (document.body.dataset.page === 'home') wordmark.setAttribute('aria-current', 'page');
  site.querySelector('.mast').append(wordmark);

  const navigation = [wordmark, ...site.querySelectorAll('.site-nav [data-route]')];
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

  function animateElements(elements, signal, delay = 0) {
    if (reducedMotion.matches) return;
    elements.forEach((element, index) => {
      if (element.hasAttribute('data-reveal')) {
        element.style.setProperty('--reveal-delay', (delay + index * 70) + 'ms');
        element.classList.add('revealing');
        return;
      }

      decodeLabel(element, signal, delay + index * 65);
    });
  }

  function mountProjectFeed(feed, signal) {
    const cards = [...feed.children];
    feed.classList.add('masonry');
    const styles = getComputedStyle(feed);
    const rowHeight = parseFloat(styles.gridAutoRows);

    // Each card spans enough grid rows for its content and the gap below it.
    function place(card, height, gap) {
      card.style.setProperty('--project-rows', Math.ceil((height + gap) / rowHeight));
    }

    const gap = parseFloat(styles.columnGap);
    const heights = cards.map(card => card.getBoundingClientRect().height);
    cards.forEach((card, index) => place(card, heights[index], gap));
    const observer = new ResizeObserver(entries => {
      const gap = parseFloat(styles.columnGap);
      for (const {target, borderBoxSize} of entries) place(target, borderBoxSize[0].blockSize, gap);
    });
    cards.forEach(card => observer.observe(card, {box: 'border-box'}));
    signal.addEventListener('abort', () => observer.disconnect(), {once: true});
  }

  function mountProjectDialog(feed, dialog, signal) {
    const title = dialog.querySelector('#project-detail-title');
    const summary = dialog.querySelector('.project-detail-summary');
    const source = dialog.querySelector('.project-detail-source');
    const tags = dialog.querySelector('.project-tags');
    const closeForm = dialog.querySelector('.project-detail-header form');
    feed.addEventListener('click', event => {
      const trigger = event.target.closest('.project-trigger');
      if (!trigger) return;
      const card = trigger.closest('.project');
      title.textContent = trigger.textContent.trim();
      summary.textContent = card.querySelector('p').textContent.trim();
      source.href = card.dataset.repository;
      tags.replaceChildren(...Array.from(card.querySelectorAll('.project-tags > li'), cardTag => {
        const tag = document.createElement('li');
        tag.textContent = cardTag.textContent;
        tag.setAttribute('data-decode', '');
        return tag;
      }));
      trigger.focus({preventScroll: true});
      dialog.showModal();
      dialog.scrollTop = 0;
      animateElements(dialog.querySelectorAll('[data-decode]'), signal);
    }, {signal});

    async function dismiss(event) {
      event.preventDefault();
      if (dialog.classList.contains('is-closing')) return;

      dialog.classList.add('is-closing');
      const transitions = dialog.getAnimations?.({subtree: true}) ?? [];
      await Promise.allSettled(transitions.map(transition => transition.finished));
      if (!signal.aborted) dialog.close();
      dialog.classList.remove('is-closing');
    }

    closeForm.addEventListener('submit', dismiss, {signal});
    dialog.addEventListener('cancel', dismiss, {signal});
    signal.addEventListener('abort', () => dialog.close(), {once: true});
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

    const feed = current.querySelector('.project-feed');
    if (feed) {
      mountProjectDialog(feed, current.querySelector('.project-dialog'), signal);
      if (typeof ResizeObserver === 'function') mountProjectFeed(feed, signal);
    }
    current.querySelectorAll('[data-reveal]').forEach((group, index) => {
      animateElements([group, ...group.querySelectorAll('[data-decode]')], signal, Math.min(index, 6) * 90);
    });
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
    else scrollTo({top: restoreScroll ? scroll ?? 0 : 0, behavior: 'instant'});

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
        for (const image of main.querySelectorAll('img[src]')) {
          image.src = new URL(image.getAttribute('src'), response.url).href;
        }
        page = {main, title: html.title};
        pages.set(path, page);
      }
      if (request.signal.aborted) return;
      positions.set(currentPath, scrollY);
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
    const control = event.target.closest('.site-nav a, .information a[href], .project-trigger, .project-detail-header button');
    if (!control || control.contains(event.relatedTarget) ||
        event.pointerType === 'touch' || reducedMotion.matches) return;
    const label = control.querySelector('[data-decode]') ?? control;
    if (!labelAnimations.has(label)) decodeLabel(label, pageEffects.signal);
  });

  // Native navigation, including file previews, replaces the wordmark along with the page.
  const arrival = performance.getEntriesByType('navigation')[0]?.type;
  if (arrival === 'navigate' && location.hash === '#page-content' && !reducedMotion.matches) {
    const style = getComputedStyle(wordmark);
    const from = style.getPropertyValue(current.dataset.page === 'home' ? '--compact-scale' : '--home-scale');
    arrivalResize = wordmark.animate(
      [{transform: 'scale(' + from + ')'}, {transform: style.transform}],
      {duration: parseFloat(style.transitionDuration) * 1000, easing: style.transitionTimingFunction},
    );
  }

  playOpening(site, reducedMotion, () => mountPage(pageEffects.signal, true));
})();
