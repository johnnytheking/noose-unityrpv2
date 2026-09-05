(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-navigation');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const closeMenu = () => {
    navigation.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navLinks.forEach(link => link.addEventListener('click', () => {
    closeMenu();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
  window.matchMedia('(min-width: 801px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let scheduled = false;
  const updateActive = () => {
    let current = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 145) current = section;
    }
    for (const link of navLinks) {
      const active = link.getAttribute('href') === '#' + current.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
    scheduled = false;
  };
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateActive); }
  }, { passive: true });
  updateActive();
  let printState;
  window.addEventListener('beforeprint', () => {
    printState = [...document.querySelectorAll('.mission')].map(item => ({ item, open: item.open }));
    printState.forEach(({ item }) => { item.open = true; });
  });
  window.addEventListener('afterprint', () => {
    if (printState) printState.forEach(({ item, open }) => { item.open = open; });
  });
})();
