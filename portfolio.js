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
    const seed = pickTransitionSeed();
    scramble(false, () => {
      overlay?.remove();
      overlay = null;
      boot.hidden = true;
      scramble(true, () => {
        overlay?.remove();
        overlay = null;
        dispatchEvent(new Event('introcomplete'));
      }, seed);
    }, seed);
  }
  playIntro();
}
