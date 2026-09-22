(() => {
  function setupPreviewDialog(dialogId, triggerId, closeEventType) {
    const dialog = document.getElementById(dialogId);
    const trigger = document.getElementById(triggerId);
    if (!dialog || !trigger) return;
    const frame = dialog.querySelector('iframe');
    const expand = dialog.querySelector('.concept-gallery__expand');
    const breadcrumbs = dialog.querySelector('.concept-gallery__breadcrumbs');
    const loading = dialogId === 'naivevil-dialog' ? document.createElement('div') : null;
    if (loading) {
      loading.className = 'concept-gallery__loading';
      loading.setAttribute('aria-label', 'Loading project');
      loading.innerHTML = '<div class="concept-gallery__loading-dots" aria-hidden="true"><span></span><span></span><span></span></div>';
      dialog.appendChild(loading);
    }
    let overflow, bodyOverflow;

    trigger.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      overflow = document.documentElement.style.overflow;
      bodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      loading?.classList.remove('is-hidden');
      if (frame && loading) {
        frame.addEventListener('load', () => loading.classList.add('is-hidden'), { once: true });
        setTimeout(() => loading.classList.add('is-hidden'), 1800);
      }
      if (frame && !frame.getAttribute('src')) frame.src = frame.dataset.src;
      dialog.showModal();
    });

    if (expand) {
      expand.addEventListener('click', () => {
        const expanded = dialog.classList.toggle('concept-gallery--expanded');
        dialog.classList.add('is-resizing');
        setTimeout(() => dialog.classList.remove('is-resizing'), 440);

        expand.setAttribute('aria-pressed', String(expanded));
        expand.setAttribute('aria-label', expanded ? 'Restore project size' : 'Expand project');
        if (breadcrumbs) breadcrumbs.inert = !expanded;
      });
    }

    dialog.querySelector('.concept-gallery__back')?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });

    window.addEventListener('message', event => {
      if (event.origin === location.origin && event.source === frame?.contentWindow &&
          (event.data?.type === closeEventType || event.data?.type === 'project-preview-close') &&
          dialog.open) {
        dialog.close();
      }
    });

    dialog.addEventListener('close', () => {
      document.documentElement.style.overflow = overflow;
      document.body.style.overflow = bodyOverflow;
      dialog.classList.remove('concept-gallery--expanded');
      if (expand) {
        expand.setAttribute('aria-pressed', 'false');
        expand.setAttribute('aria-label', 'Expand project');
      }
      if (breadcrumbs) breadcrumbs.inert = true;
      trigger.focus({ preventScroll: true });
      loading?.classList.remove('is-hidden');
    });
  }

  setupPreviewDialog('naivevil-dialog', 'open-naivevil', 'naivevil-close');
  setupPreviewDialog('lepal-dialog', 'open-lepal', 'lepal-close');
  setupPreviewDialog('samsung-dialog', 'open-samsung', 'samsung-close');
  setupPreviewDialog('microsoft-dialog', 'open-microsoft', 'microsoft-close');
  setupPreviewDialog('thermopal-dialog', 'open-thermopal', 'thermopal-close');
})();
