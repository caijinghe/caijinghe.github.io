/* All case-study previews use the original main LePal canvas and resize ratio. */
(() => {
  if (window.parent === window || !new URLSearchParams(location.search).has('preview')) return;
  const canvasWidth = 1100;
  document.body.classList.add('is-preview');
  function resizePreview() {
    const scale = Math.min(1, window.innerWidth / canvasWidth);
    document.documentElement.style.setProperty('--project-preview-scale', scale);
    document.body.style.width = `${window.innerWidth / scale}px`;
    document.body.style.minHeight = `${window.innerHeight / scale}px`;
    document.body.style.zoom = scale;
  }
  resizePreview();
  window.addEventListener('resize', resizePreview);
})();
