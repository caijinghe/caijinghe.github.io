/**
 * Info Hover Popover
 * Hovering over "Info" in the header expands a vertical card showing Experience & Education,
 * aligned with the projects grid (top & right margins) with subtle background blur,
 * single-line layout and a top-left expand button.
 */
(() => {
  const popoverHTML = `
    <div id="info-hover-backdrop" class="info-hover-backdrop" aria-hidden="true"></div>
    <div id="info-hover-popover" class="info-hover-popover" role="region" aria-label="About Jinghe Cai">
      <div class="popover-inner">
        <div class="popover-header">
          <div class="popover-header-left">
            <a href="about.html" class="popover-greeting-link"><span class="popover-greeting">Hi, I'm Jinghe</span></a>
          </div>
          <div class="popover-header-right">
            <a href="about.html" class="popover-scholar-pill">View full page<svg viewBox="4.5 4.5 11 11" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 14.5 14.5 5.5M5.5 5.5h9v9"/></svg></a>
          </div>
        </div>

        <div class="exp-group">
          <div class="exp-group-label">Experience</div>
          <div class="exp-list">
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Nestify</span> <span class="exp-role">/ Product Design Engineering</span></div>
              <div class="exp-year">2026</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Microsoft</span> <span class="exp-role">/ UX Design</span></div>
              <div class="exp-year">2025</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Samsung</span> <span class="exp-role">/ Design Strategy</span></div>
              <div class="exp-year">2025</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Lepal.ai</span> <span class="exp-role">/ Product Design</span></div>
              <div class="exp-year">2024</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Author</span> <span class="exp-role">/ Two Comic Books</span></div>
              <div class="exp-year">2019–2025</div>
            </div>
          </div>
        </div>

        <div class="exp-group">
          <div class="exp-group-label">Education</div>
          <div class="exp-list">
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Savannah College of Art and Design</span> <span class="exp-role">/ M.F.A. UX Design</span></div>
              <div class="exp-year">2027</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Tsinghua University</span> <span class="exp-role">/ M.S. Computer Science</span></div>
              <div class="exp-year">2023</div>
            </div>
            <div class="exp-row">
              <div class="exp-title"><span class="exp-org">Xiamen University</span> <span class="exp-role">/ B.F.A. Fine Arts</span></div>
              <div class="exp-year">2019</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  function initInfoPopover() {
    if (!document.getElementById('info-hover-popover')) {
      const container = document.createElement('div');
      container.innerHTML = popoverHTML;
      while (container.firstChild) {
        document.body.appendChild(container.firstChild);
      }
    }

    const popover = document.getElementById('info-hover-popover');
    const backdrop = document.getElementById('info-hover-backdrop');
    if (!popover) return;

    // Find Info links in headers
    const infoLinks = document.querySelectorAll('header a[href*="about.html"], .site-header a[href*="about.html"]');
    if (!infoLinks.length) return;

    let closeTimer = null;

    function positionPopover(link) {
      popover.style.top = '48px';
      popover.style.left = 'auto';
      popover.style.right = 'var(--page-gutter, 8px)';
    }

    function openPopover(link) {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      positionPopover(link);
      popover.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
    }

    function scheduleClose(delay = 260) {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
      closeTimer = setTimeout(() => {
        popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
        closeTimer = null;
      }, delay);
    }

    infoLinks.forEach(link => {
      link.addEventListener('mouseenter', () => openPopover(link));
      link.addEventListener('mouseleave', () => scheduleClose(260));
      link.addEventListener('focus', () => openPopover(link));
      link.addEventListener('blur', () => scheduleClose(260));
      link.addEventListener('click', () => {
        popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
      });
    });

    window.addEventListener('resize', () => {
      const activeLink = [...infoLinks].find(link => link.matches(':hover'));
      if (activeLink && popover.classList.contains('is-open')) {
        positionPopover(activeLink);
      }
    });

    popover.addEventListener('mouseenter', () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
    });

    popover.addEventListener('mouseleave', () => {
      scheduleClose(180);
    });

    popover.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
      }
    });

    // Close on click outside
    document.addEventListener('pointerdown', (e) => {
      if (!popover.contains(e.target) && ![...infoLinks].some(link => link.contains(e.target))) {
        popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
      }
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popover.classList.contains('is-open')) {
        popover.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('is-open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInfoPopover);
  } else {
    initInfoPopover();
  }
})();
