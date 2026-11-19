const list = document.querySelector('.entries');
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
  const delta = list.scrollTop - visualScroll;
  visualScroll += reduced.matches || Math.abs(delta) < .3 ? delta : delta * .2;
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
    link.classList.toggle('selected', i === selected);
    link.style.opacity = String(Math.max(.29, 1 - distance * .45));
    link.style.filter = 'blur(' + (i === selected ? 0 : 1.7 * amount) + 'px)';
  });
  painting = visualScroll !== list.scrollTop ? requestAnimationFrame(paintProjects) : 0;
}
function queuePaint() {
  if (!painting) painting = requestAnimationFrame(paintProjects);
}
paintProjects();
list.addEventListener('scroll', queuePaint, {passive:true});
new ResizeObserver(queuePaint).observe(list);
enableSmoothWheel(list, .45);
list.addEventListener('focusin', event => {
  if (event.target.matches('a:focus-visible')) event.target.scrollIntoView({block:'center'});
});
