const galleries = document.querySelectorAll('.apparel-photo-grid');

for (const gallery of galleries) {
  const dialogs = [...gallery.querySelectorAll('dialog[data-apparel-image-dialog]')];
  if (dialogs.length < 2) continue;

  for (const dialog of dialogs) {
    for (const control of dialog.querySelectorAll('[data-carousel-step]')) control.hidden = false;
  }

  const move = (dialog, step) => {
    const currentIndex = dialogs.indexOf(dialog);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + step + dialogs.length) % dialogs.length;
    const nextDialog = dialogs[nextIndex];
    dialog.close();
    nextDialog.showModal();
    nextDialog.querySelector(`[data-carousel-step="${step}"]`)?.focus({ preventScroll: true });
  };

  gallery.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest('button[data-carousel-step]');
    if (!control) return;
    const dialog = control.closest('dialog[data-apparel-image-dialog]');
    if (dialog?.open) move(dialog, Number(control.dataset.carouselStep));
  });

  for (const dialog of dialogs) {
    dialog.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step) return;
      event.preventDefault();
      move(dialog, step);
    });
  }
}
