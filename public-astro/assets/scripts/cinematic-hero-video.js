document.querySelectorAll('[data-cinematic-hero]').forEach(hero => {
  const video = hero.querySelector('video');
  const toggle = hero.querySelector('[data-video-toggle]');
  if (!video || !toggle) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const playLabel = toggle.dataset.playLabel || 'Play Emerald Gateway video';
  const pauseLabel = toggle.dataset.pauseLabel || 'Pause Emerald Gateway video';
  const updateControl = () => {
    const playing = !video.paused && !video.ended;
    toggle.textContent = playing ? pauseLabel : playLabel;
    toggle.setAttribute('aria-label', playing ? pauseLabel : playLabel);
    toggle.setAttribute('aria-pressed', String(playing));
  };
  let autoplayAttempted = false;
  let observer;
  const play = (autoplay = false) => {
    if (autoplay && autoplayAttempted) return;
    if (autoplay) autoplayAttempted = true;
    video.muted = true;
    video.play().catch(() => {
      video.pause();
      updateControl();
    });
  };

  toggle.hidden = false;
  video.addEventListener('play', updateControl);
  video.addEventListener('pause', updateControl);
  video.addEventListener('ended', updateControl);
  video.addEventListener('error', updateControl);
  toggle.addEventListener('click', () => {
    observer?.disconnect();
    if (video.paused || video.ended) play();
    else video.pause();
  });
  reducedMotion.addEventListener('change', event => {
    if (event.matches) {
      observer?.disconnect();
      video.pause();
    }
  });

  const connection = navigator.connection;
  if (!reducedMotion.matches && !connection?.saveData) {
    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          if (video.paused) play(true);
        }
      }, { threshold: 0.1 });
      observer.observe(hero);
    } else play(true);
  }
});
