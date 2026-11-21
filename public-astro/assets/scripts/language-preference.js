const storageKey = 'tropical-trance-language';
const languageFor = value => {
  const base = String(value || '').toLowerCase().split('-')[0];
  return base === 'es' ? 'es' : base === 'en' ? 'en' : null;
};

document.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest('[data-language-choice]');
  if (!link) return;
  if (link.dataset.languageChoice === 'en') {
    const destination = new URL(link.href, location.href);
    if (destination.pathname === '/') {
      // The fragment survives navigation but is never sent to static hosting.
      // It records explicit intent even when browser storage is blocked.
      destination.hash = 'manual-en';
      link.href = destination.href;
    }
  }
  try { localStorage.setItem(storageKey, link.dataset.languageChoice === 'es' ? 'es' : 'en'); } catch {}
});

if (location.pathname === '/') {
  const manualEnglish = location.hash === '#manual-en';
  if (manualEnglish) history.replaceState(null, '', location.pathname + location.search);

  let saved;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'en' || stored === 'es') saved = stored;
  } catch {}

  const preferences = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  const preferred = preferences.map(languageFor).find(Boolean) || 'en';
  const destination = manualEnglish ? 'en' : saved || preferred;
  if (destination === 'es') location.replace('/es/');
}
