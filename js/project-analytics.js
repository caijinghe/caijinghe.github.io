// Page views come from each page's Google tag. This separate event also
// measures galleries and repeat preview opens without duplicating page views.
(() => {
  const projects = {
    'nestify.html': 'Nestify',
    'samsung.html': 'Samsung',
    'lepal.html': 'Lepal.ai',
    'microsoft.html': 'Microsoft',
    'thermopal.html': 'ThermoPal',
    'naivevil.html': 'Naivevil',
    'bibf.html': 'BIBF',
    'redwing.html': 'Red Wing',
    'wander.html': 'Wander'
  };

  document.addEventListener('click', event => {
    const link = event.target.closest('a.work-item[href]');
    if (!link || event.button !== 0 || typeof window.gtag !== 'function') return;
    const url = new URL(link.href, location.href);
    const projectName = projects[url.pathname.split('/').pop()];
    if (url.origin !== location.origin || !projectName) return;
    window.gtag('event', 'project_open', {
      project_name: projectName,
      project_path: url.pathname,
      transport_type: 'beacon'
    });
  });
})();
