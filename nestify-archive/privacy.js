/* ============================================================
   PRIVACY — the arrival, triggered once.

   This file used to run an accordion, then a scroll scrub. Both are gone.
   All it does now is say WHEN each block has arrived; privacy.css says what
   arriving looks like.

   🔴 TIME, NOT SCROLL POSITION. This is the correction the whole file exists
   to record, because the same complaint came back three times: "why can't I
   see the animation?"

   A scroll-scrubbed move is a function of where the page is. That sounds
   like control and is actually the bug — the reader decides how fast it
   plays, and one flick of a trackpad crosses the whole range in about a
   frame. Land in the middle of the section, or arrive by anchor, and it is
   simply over before you look. Two rounds were spent moving the ramps later
   and later in the scroll, which never fixed it, because position cannot
   decide how long something takes. Only time can.

   So each block is watched, told that it is on screen, and left alone. The
   transition then plays at its own pace whatever the scroll did.

   🔴 AND IT REPLAYS. Coming back to the section plays it again — but the
   reset that makes that possible has to happen where it cannot be seen, or
   the reader watches the whole arrival run BACKWARDS on the way out, which
   is an exit animation nobody designed. Hence two observers with different
   ideas about the edge of the screen:

       IN   15% of the block showing, and the root's bottom pulled up 12%,
            so it has to be properly inside the window before it counts
       OUT  not intersecting AT ALL, against the true viewport — the block
            is fully gone before anything is undone

   and the undo itself is done with transitions suppressed (.is-reset), so
   it snaps rather than tweens. Off screen, instantly, every time.

   Two observers again on EACH of the heading and the row — four in total —
   because those two are ~130px apart, and a single trigger on the section
   would start the tiles while they were still below the fold, which is the
   older bug in a new costume.
   ============================================================ */
(function () {
  const pv = document.querySelector('.pv');
  if (!pv) return;

  const head = pv.querySelector('.pv__head');
  const row = pv.querySelector('.pv__row');
  if (!head || !row) return;

  /* 🔴 The hidden start state lives behind this class, so it is JS that
     hides things and JS that shows them again. Neither happens on the
     reduced-motion path or if this file never runs — the section is then
     simply finished, which is the correct state to fail into. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;
  pv.classList.add('pv--anim');

  /* 🔴 A threshold AND a bottom margin. The threshold alone fires the moment
     one pixel of a 414px-tall row clears the fold, which is the animation
     starting off screen all over again; pulling the root's bottom edge up
     12% means the block has to be properly inside the window before it
     counts as having arrived. */
  const ioIn = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add('is-in');
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -12% 0px' });

  /* 🔴 No rootMargin here, and that difference is the point: this one asks
     the REAL viewport whether the block has left it completely. Reusing the
     margin above would call the block "gone" while it was still 12% up the
     screen, and the reset would happen in plain sight. */
  const ioOut = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) reset(e.target);
    });
  }, { threshold: 0 });

  /* 🔴 Snap, do not tween. Removing .is-in on its own runs every transition
     in reverse; suppressing them for one forced reflow makes the undo
     instantaneous, so what the reader meets on the way back is a block that
     has simply not arrived yet. The reflow is not optional — without it the
     three class changes coalesce and the browser animates anyway. */
  function reset(el) {
    el.classList.add('is-reset');
    el.classList.remove('is-in');
    void el.offsetWidth;
    el.classList.remove('is-reset');
  }

  [head, row].forEach((el) => { ioIn.observe(el); ioOut.observe(el); });
})();
