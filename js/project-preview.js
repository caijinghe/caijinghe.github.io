(() => {
  function setupPreviewDialog(dialogId, triggerId, closeEventType) {
    const dialog = document.getElementById(dialogId);
    const trigger = document.getElementById(triggerId);
    if (!dialog || !trigger) return;
    const frame = dialog.querySelector('iframe');
    const expand = dialog.querySelector('.concept-gallery__expand');
    const breadcrumbs = dialog.querySelector('.concept-gallery__breadcrumbs');
    let overflow, bodyOverflow;

    // Nestify starts with a dark cover, then switches to white content.
    if (dialogId === 'nestify-dialog' && frame) {
      let pendingThemeUpdate = false;
      const updateTheme = () => {
        pendingThemeUpdate = false;
        const doc = frame.contentDocument;
        if (!doc?.body) return;
        const frameBounds = frame.getBoundingClientRect();
        const buttonBounds = expand.getBoundingClientRect();
        const x = buttonBounds.left + buttonBounds.width / 2 - frameBounds.left;
        const y = buttonBounds.top + buttonBounds.height / 2 - frameBounds.top;
        const element = doc.elementFromPoint(x, y);
        dialog.classList.toggle('project-preview--dark', !!element?.closest('.nestify-cover'));
      };
      const scheduleThemeUpdate = () => {
        if (pendingThemeUpdate) return;
        pendingThemeUpdate = true;
        requestAnimationFrame(updateTheme);
      };
      frame.addEventListener('load', () => {
        frame.contentWindow.addEventListener('scroll', scheduleThemeUpdate, { passive: true });
        frame.contentWindow.addEventListener('resize', scheduleThemeUpdate);
        // Recheck when the white loading overlay disappears.
        new MutationObserver(scheduleThemeUpdate).observe(frame.contentDocument.body, { childList: true });
        scheduleThemeUpdate();
      });
      new ResizeObserver(scheduleThemeUpdate).observe(frame);
      dialog.addEventListener('transitionend', scheduleThemeUpdate);
      trigger.addEventListener('click', scheduleThemeUpdate);
    }

    trigger.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      overflow = document.documentElement.style.overflow;
      bodyOverflow = document.body.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
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
    });
  }

  setupPreviewDialog('naivevil-dialog', 'open-naivevil', 'naivevil-close');
  setupPreviewDialog('lepal-dialog', 'open-lepal', 'lepal-close');
  setupPreviewDialog('samsung-dialog', 'open-samsung', 'samsung-close');
  setupPreviewDialog('microsoft-dialog', 'open-microsoft', 'microsoft-close');
  setupPreviewDialog('nestify-dialog', 'open-nestify', 'nestify-close');
  setupPreviewDialog('thermopal-dialog', 'open-thermopal', 'thermopal-close');
})();
