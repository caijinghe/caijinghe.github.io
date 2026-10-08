/* ============================================================
   THE BEAD BECOMES A BIRD — the last thing on the page.

   The footer's wordmark carries the brand's blue bead on the i. When the
   reader reaches the bottom, that bead hands over to a Rive animation of
   the bird's head (assets/bird-blink.riv).

   🔴 A HANDOVER, not a second object. The bead is a <circle> inside the
   wordmark's SVG; the canvas is placed on that circle's measured box and
   the circle is faded out underneath it. Nothing is positioned by hand, so
   the wordmark can be any size at any viewport and the bird still lands on
   the i.

   🔴 It only loads when it is needed. The runtime is ~200KB and the file
   is at the very bottom of a page most readers never finish — so the
   <script> is fetched on the first intersection, not at boot, and the
   whole thing is skipped for reduced motion.
   ============================================================ */
(function () {
  const mark = document.querySelector('.ft__mark');
  const bead = mark && mark.querySelector('.ft__bead');
  if (!mark || !bead) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const RUNTIME = 'vendor/rive.js';
  const FILE = 'assets/bird-blink.riv';

  /* the head is drawn with room around it in the artboard, so the canvas
     has to be a little bigger than the dot it replaces or the bird comes
     out the size of a full stop. Measured against the bead's diameter —
     the ink measures 67.9% of the canvas, so the head's own width is
     0.679 × this — 1.25 puts it at ~69px against an 81px bead, i.e. a head
     that sits inside the dot's footprint rather than over it. (2.6, then
     1.55, were both a head sitting ON the wordmark.) */
  const SCALE = 1.25;

  /* 🔴 The canvas is WRAPPED, and the growth goes on the wrapper. Rive
     sizes its drawing surface from the canvas's own bounding rect, and a
     transform is part of that rect — with the scale on the canvas itself
     it measured the box mid-animation (0.62 of full) and allocated a
     buffer to match, so the bird was drawn at 78px and then stretched to
     126. Measured: buffer 78×78 for a 126px box. The wrapper carries the
     transform; the canvas keeps its true size. */
  const shell = document.createElement('span');
  shell.className = 'ft__bird';
  shell.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'ft__bird-c';
  shell.appendChild(canvas);
  mark.appendChild(shell);

  /* the canvas sits on the bead's own box, in the mark's coordinate space */
  function place() {
    const b = bead.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    if (!b.width) return;
    const size = b.width * SCALE;
    shell.style.width = size.toFixed(1) + 'px';
    shell.style.height = size.toFixed(1) + 'px';
    shell.style.left = (b.left - m.left + b.width / 2 - size / 2).toFixed(1) + 'px';
    shell.style.top = (b.top - m.top + b.height / 2 - size / 2).toFixed(1) + 'px';
    /* 🔴 The backing store is set in DEVICE pixels and the CSS box in CSS
       pixels. Rive draws into the buffer it is given; leave it at the CSS
       size and the bird is soft on every retina screen. */
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }

  let rive = null;
  let loading = false;
  let ready = false;

  /* ---------- the buffer is taken at FULL size, once ----------
     🔴 Rive sizes its drawing surface from the canvas's bounding rect, and
     an ancestor's transform is part of that rect. The pop starts at 0.3, so
     a surface taken while the shell was scaled measured 30% of the box and
     the bird was drawn into a buffer a third of the size it would end up
     occupying — then upscaled for the whole arrival. That is the blur.

     So the transform is removed for the instant of the measurement and put
     straight back. Both writes happen inside one task, so no frame is ever
     painted between them: the browser sees only the end state. From there
     the CSS scale only ever makes the bird SMALLER than its buffer, and
     downscaling is sharp. */
  function sizeSurface() {
    if (!rive) return;
    const held = shell.style.transform;
    /* 🔴 The PEAK, not the resting size. The arrival overshoots — measured,
       108px against a 102px rest — so a buffer cut to the resting box is
       still being upscaled at the one moment the bird is largest and most
       looked at (ratio 1.87 where the screen wants 2.0). 1.08 covers the
       whole of easeOutBack's overshoot with a little to spare. */
    shell.style.transform = 'scale(1.08)';
    rive.resizeDrawingSurfaceToCanvas();
    shell.style.transform = held;
  }

  /* ---------- the change is the point, so it has to be SCROLLED ----------
     🔴 Not an on-intersection swap. The wordmark is deliberately cut off by
     the bottom of the page, so it intersects long before anyone is looking
     at it — the bead had already finished becoming a bird by the time the
     reader arrived, and all they got was a bird that was always there.

     So the runtime still LOADS on intersection (it has 200KB and a wasm
     blob to fetch, and that wants a head start), but the visible change is
     driven by how close the page is to its own end. The last half-screen of
     scroll is the whole animation: keep going and it happens, stop and it
     stops where you stopped. */
  const RANGE = () => Math.max(1, innerHeight * 0.5);
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!ready) return;
      const left = document.documentElement.scrollHeight - (window.scrollY + innerHeight);
      const p = Math.max(0, Math.min(1, 1 - left / RANGE()));
      mark.style.setProperty('--bird', p.toFixed(3));

      /* 🔴 Re-take the drawing surface once the growth has SETTLED. Rive
         sizes its buffer from the canvas's bounding rect, and an ancestor's
         transform is part of that rect — wrapping the canvas moved the
         scale off the element but not out of its geometry. So the surface
         taken at load is the one that fits the 0.62 starting scale:
         measured, a 125px buffer behind a 202px box, i.e. the bird drawn at
         62% and stretched. Doing it once at the end costs nothing and puts
         the sharp version where the reader actually stops. */

    });
  }
  addEventListener('scroll', onScroll, { passive: true });

  function boot() {
    rive = new window.rive.Rive({
      src: FILE,
      canvas,
      autoplay: true,
      /* whatever the artboard's own default is — the file is authored as
         one head with a blink loop, so there is nothing to choose here */
      layout: new window.rive.Layout({ fit: 'contain', alignment: 'center' }),
      onLoad: () => {
        sizeSurface();
        ready = true;
        onScroll();
      },
    });
  }

  function start() {
    if (rive || loading) return;
    loading = true;
    place();

    /* 🔴 The runtime may already BE on the page. device.html vendors it for
       the hero's device animation, and fetching the CDN copy on top of that
       is 200KB re-downloaded to redefine window.rive out from under the
       hero. If a Rive is already here, this bead uses that one. */
    if (window.rive && window.rive.Rive) { boot(); return; }

    const s = document.createElement('script');
    s.src = RUNTIME;
    s.onload = () => {
      if (!window.rive || !window.rive.Rive) return;
      boot();
    };
    /* offline, blocked, or the CDN moved: the bead simply stays a bead */
    s.onerror = () => { loading = false; };
    document.head.appendChild(s);
  }

  /* 🔴 Watch the MARK, and at a low threshold. The wordmark is deliberately
     cut off by the bottom edge of the page (see the note in index.html), so
     a large part of it is never on screen and a high threshold would never
     fire. */
  new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) start(); });
  }, { threshold: 0.05 }).observe(mark);

  addEventListener('resize', () => {
    if (!rive) return;
    place();
    sizeSurface();
  });
})();
