const boot = document.querySelector('#boot');
if (!document.documentElement.hasAttribute('data-arriving') && !location.hash && !reduced.matches) {
  const word = boot.querySelector('pre');
  const name = brandText;
  const symbols = '#@%&+/*=<>[]{}01λΣΔΩπφψξθμ';
  const noise = () => symbols[Math.floor(Math.random() * symbols.length)];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  boot.hidden = false;

  async function playIntro() {
    const pending = Array.from(name, (_, index) => index);
    const locked = new Set();
    while (pending.length) {
      for (let frame = 0; frame < 4; frame++) {
        word.textContent = Array.from(name, (_, i) => locked.has(i) ? name[i] : noise()).join('');
        await pause(32);
      }
      const slot = Math.floor(Math.random() * pending.length);
      locked.add(pending.splice(slot, 1)[0]);
    }
    word.textContent = name;
    await pause(1050);
    for (let count = name.length - 1; count >= 0; count--) {
      word.textContent = (name.slice(0, count) + noise()).padEnd(name.length);
      await pause(52);
    }
    word.textContent = '';
    await pause(450);

    const verse = document.createElement('p');
    verse.className = 'verse';
    const line = '“Just take each step you’re able to manage, persevere little by little, and build it up that way.”';
    verse.setAttribute('aria-label', line);
    let nextGlyph = 0;
    function writeText(parent, text) {
      for (const token of text.split(/(\s+)/)) {
        if (!token.trim()) { parent.append(token); continue; }
        const group = document.createElement('span');
        group.setAttribute('aria-hidden', 'true');
        for (const letter of token) {
          const glyph = document.createElement('i');
          glyph.textContent = letter;
          glyph.style.animationDelay = nextGlyph + 'ms';
          nextGlyph += 36;
          group.append(glyph);
        }
        parent.append(group);
      }
    }
    writeText(verse, line);
    nextGlyph += 560 - 36;
    const credit = document.createElement('cite');
    const author = document.createElement('span');
    author.setAttribute('aria-label', 'Sugaru Miaki');
    writeText(author, '― Sugaru Miaki, ');
    const book = document.createElement('a');
    book.href = 'https://www.goodreads.com/work/quotes/52364681';
    const title = 'Three Days of Happiness';
    book.setAttribute('aria-label', title);
    writeText(book, title);
    credit.append(author, book);
    const quotation = document.createElement('blockquote');
    quotation.append(verse, credit);
    boot.removeAttribute('aria-hidden');
    boot.replaceChildren(quotation);

    book.addEventListener('animationend', event => {
      if (event.target === book.querySelector('span:last-child i:last-child')) book.textContent = title;
    });
    const settled = nextGlyph - 36 + 560;
    setTimeout(() => scramble(false, () => {
      overlay?.remove();
      overlay = null;
      boot.hidden = true;
      dispatchEvent(new Event('introcomplete'));
      scramble(true, () => { overlay?.remove(); overlay = null; });
    }), settled + 4800);
  }
  playIntro();
}
