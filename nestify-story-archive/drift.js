/* ============================================================
   DRIFT — the cards around scene two's sentence, after lassie.ai.

   ---------- THEY ORBIT ----------
   Read out of lassie's own bundle rather than inferred. Their positioner:

       r = Math.cos(angle - 60) * radiusX - w/2 + offsetX
       a = Math.sin(angle - 60) * radiusY - h/2 + offsetY
       transform = `translate(${r}px, ${a}px) scale(${n})`

   and the scroll timeline tweens exactly ONE property per card:

       y.forEach(e => S.fromTo(e, {angle: fromAngle}, {angle: toAngle}, 0))

   with radiusX = .43 * innerWidth, radiusY = .39 * innerHeight.

   So the cards share one ELLIPSE and scroll drives each one's ANGLE around
   it. Nothing expands, nothing disperses — the field turns.

   🔴 This is why every earlier reading was wrong, and wrong in a way that
   looked like four separate problems. Measuring travel off screenshots
   gave: x and y both moving (it is an orbit), the direction not radial (it
   is tangential), four of five cards with a NEGATIVE radial dot product
   (coming round, not going out), and magnitudes varying 2.5× (the ellipse
   is far wider than tall, so an equal sweep covers more ground at the sides
   than at the top). One cause, four symptoms. No amount of tuning per-card
   vectors reproduces it, because a vector is a straight line.

   The −60° is theirs: it turns the ring so no card sits at dead top or
   dead side at rest.

   Deliberately its own file rather than more code inside intro.js: it owns
   the elements it creates and reads the intro's scroll position without
   writing anything intro.js also writes, so the two cannot fight over a
   variable. The only thing shared is the section's geometry.
   ============================================================ */
(function () {
  const intro = document.querySelector('.intro');
  const stage = intro && intro.querySelector('.intro__stage');
  if (!stage) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  /* the copy is uncovered around .28 of the intro's track (intro.js's
     COPY_FROM), so the ring comes up with it rather than before it */
  const FADE_FROM = 0.28, FADE_TO = 0.42;
  const SPIN_FROM = 0.24, SPIN_TO = 1.0;   // the window the orbit turns over
  /* the sentence's tail cycles: parent → kid → family. 落点见下方 SWAP_AT——
     放在那里是因为它必须跟 intro.js 的 FLIP_FROM 一起读才有意义。 */

  /* 🔴 OFF. The orbiting cards are parked, not deleted — flip this to true
     and everything below comes back exactly as it was. The tail-of-the-
     sentence swap lives in this same file and is NOT gated by it, which is
     why the cards are switched off here rather than by commenting out the
     <script>: that would take the words with them. */
  const CARDS_ON = false;

  const RX = 0.43, RY = 0.39;   // ellipse radii, as a share of the stage — theirs
  const TILT = -60;             // degrees, theirs

  /* ---------- their layout, card for card ----------
     Six, not eight, and every number below is theirs — the angles and the
     per-card pixel offsets straight out of the bundle's config table, the
     sizes off the rendered markup (their rem is 10px):

       #  fromAngle  toAngle  sweep  offset      size      what it is
       0    -174      -74     +100   (  0,   0)  236×261   photo
       1    -120      -74      +46   (-80,  10)  340×152   a status card
       2    -125       35     +160   (-25, -60)  273×277   photo
       3       5      105     +100   (-50,  40)  238×228   photo
       4      95      195     +100   (  0,   0)  236×261   photo
       5      30      105      +75   ( 50,-100)  340×196   a status card

     🔴 All six sweep the SAME WAY. An earlier pass here had two of them
     running backwards, on the reasoning that a uniform direction reads as
     one wheel turning — that was invented, and it is wrong. What stops it
     reading as a wheel is the SWEEP LENGTHS: 46 to 160, a 3.5× spread, so
     the cards pull apart and bunch up as they go round even though every
     one of them is travelling the same way.

     🔴 And they are not all one shape. Three are near-square photographs,
     two are wide status cards. That mix is doing as much work as the motion
     — a ring of identical squares is a pattern, not a scatter. */
  const CARDS = [
    { w: 236, h: 261, from: -174, to: -74, ox:   0, oy:    0 },
    { w: 340, h: 152, from: -120, to: -74, ox: -80, oy:   10 },
    { w: 273, h: 277, from: -125, to:  35, ox: -25, oy:  -60 },
    { w: 238, h: 228, from:    5, to: 105, ox: -50, oy:   40 },
    { w: 236, h: 261, from:   95, to: 195, ox:   0, oy:    0 },
    { w: 340, h: 196, from:   30, to: 105, ox:  50, oy: -100 },
  ];


  /* three readings in one slot — see the note in drift.css */
  const swap = intro.querySelector('.intro__swap');
  const readings = swap ? [...swap.children] : [];

  /* ---------- the readings are TYPED, not rolled ----------
     🔴 This was an odometer: one vertical strip per letter position, all
     of them sliding a row at each swap. It is a good mechanism and it is
     the wrong one here — a roll says "this value changed", which is what a
     clock does, while the sentence wants to say "someone is still deciding
     what this is". So the blue dot leads a caret instead: it types a
     reading out, takes it back, and types the next.

     The original readings stay in the DOM, emptied of their text: they are
     what the reveal below toggles is-on against, and what a reader with no
     CSS gets. */
  const lead = intro.querySelector('.intro__lead');
  const WORDS = readings.map((r) => r.textContent);

  let typed = '', typeTimer = 0;

  let typeEl = null;
  if (readings.length) {
    typeEl = document.createElement('span');
    typeEl.className = 'intro__type';
    readings.forEach((r) => { r.textContent = ''; });
    swap.appendChild(typeEl);
    /* in the markup from the first frame, so it is simply part of the line */
    typed = WORDS[0];
    [...typed].forEach((c) => {
      const ch = document.createElement('i');
      ch.textContent = c;
      ch.className = 'is-set';
      typeEl.appendChild(ch);
    });
  }

  // Words cycle on their own clock while the sentence is visible.
  const TYPE_MS = 42;            // per character, going on
  const WIPE_MS = 22;            // per character, coming off — faster

  let want = 0;
  let autoActive = false, holdTimer = 0;
  const HOLD_MS = 1800;

  /* 🔴 One element per character, added and removed at the tail — not a
     textContent rewrite. A whole-string write repaints every letter, so
     there is nothing to hang an arrival on and the word lands with a thud:
     each glyph simply exists on the next frame. Per character, the new one
     can come in with a lift of its own (see .intro__type i in drift.css),
     which is the difference between letters appearing and someone writing.

     🔴 Compare the CHARACTERS, not just how many there are. Reconciling on
     length alone is right while typing — the tail is the only thing that
     moves — but it silently does nothing when one reading is replaced by
     another of the same length. "family" and "parent" are both six, so a
     jump straight between them would have left the wrong word standing. */
  function paintTyped(settled) {
    if (!typeEl) return;
    const now = typeEl.childElementCount;
    for (let i = 0; i < Math.min(now, typed.length); i++) {
      const el = typeEl.children[i];
      if (el.textContent !== typed[i]) {
        el.textContent = typed[i];
        el.className = settled ? 'is-set' : '';
      } else if (settled && !el.classList.contains('is-set')) {
        el.className = 'is-set';
      }
    }
    if (now === typed.length) return;
    for (let i = now; i > typed.length; i--) typeEl.lastElementChild.remove();
    for (let i = now; i < typed.length; i++) {
      const ch = document.createElement('i');
      ch.textContent = typed[i];
      if (settled) ch.className = 'is-set';
      typeEl.appendChild(ch);
    }
    /* the dot is measured off this span's right edge by intro.js, and that
       runs on scroll — which is not happening while this types */
    dispatchEvent(new CustomEvent('intro:typed'));
  }


  function pump() {
    const target = WORDS[want] || '';
    if (typed === target) {
      typeTimer = 0;
      if (autoActive && !holdTimer) holdTimer = setTimeout(() => {
        holdTimer = 0;
        wantWord((want + 1) % WORDS.length);
      }, HOLD_MS);
      return;
    }
    /* delete while what is on screen is not a prefix of what is wanted,
       then type the rest — which for two unrelated words is "take it all
       back, then write the new one", and for a correction is only the
       characters that actually differ */
    if (!target.startsWith(typed)) {
      typed = typed.slice(0, -1);
      paintTyped();
      typeTimer = setTimeout(pump, WIPE_MS);
      return;
    }
    typed = target.slice(0, typed.length + 1);
    paintTyped();
    typeTimer = setTimeout(pump, TYPE_MS);
  }

  function wantWord(i) {
    if (i === want) return;
    want = i;
    if (!typeTimer) pump();      // already running? it will pick the new target up
  }

  function syncWordClock() {
    if (!typeEl || REDUCED) return;
    const copy = intro.querySelector('.intro__copy');
    const rect = typeEl.getBoundingClientRect();
    const active = !document.hidden && copy?.style.getPropertyValue('--lit') === '1'
      && Number(getComputedStyle(copy).opacity) > .5
      && rect.bottom > 0 && rect.top < innerHeight;
    if (active === autoActive) return;
    autoActive = active;
    if (active) pump();
    else {
      clearTimeout(typeTimer); clearTimeout(holdTimer);
      typeTimer = 0; holdTimer = 0;
    }
  }
  document.addEventListener('visibilitychange', syncWordClock);
  if (typeEl) new IntersectionObserver(syncWordClock).observe(typeEl);

  const layer = document.createElement('div');
  layer.className = 'intro__drift';
  layer.setAttribute('aria-hidden', 'true');

  const cards = !CARDS_ON ? [] : CARDS.map((c) => {
    const el = document.createElement('i');
    el.className = 'intro__drift-card';
    /* no content — these hold the composition. See the tint note in
       drift.css. */
    layer.appendChild(el);
    return el;
  });

  /* 🔴 First child of the stage. The stage's layers are ordered by z-index
     and this one has to sit under both the copy and the film — a card in
     front of the sentence is not a background. */
  if (CARDS_ON) stage.insertBefore(layer, stage.firstChild);

  function frame(p) {
    const gate = ease(clamp((p - FADE_FROM) / (FADE_TO - FADE_FROM)));
    const q = clamp((p - SPIN_FROM) / (SPIN_TO - SPIN_FROM));
    /* 🔴 Measured off the STAGE, not the window. This section is sticky, so
       the stage is the frame the ring has to stay inside; on a short window
       the two are not the same box. */
    const rx = stage.clientWidth * RX;
    const ry = stage.clientHeight * RY;

    /* their sizes are authored against a 1440 stage; below that everything
       shrinks together rather than the ring closing on a fixed-size card */
    const k = Math.min(1, stage.clientWidth / 1440);

    cards.forEach((el, i) => {
      const c = CARDS[i];
      const deg = c.from + (c.to - c.from) * q + TILT;
      const rad = deg * Math.PI / 180;
      el.style.setProperty('--w', (c.w * k).toFixed(0) + 'px');
      el.style.setProperty('--h', (c.h * k).toFixed(0) + 'px');
      el.style.setProperty('--ox', (Math.cos(rad) * rx + c.ox * k).toFixed(1) + 'px');
      el.style.setProperty('--oy', (Math.sin(rad) * ry + c.oy * k).toFixed(1) + 'px');
      el.style.setProperty('--o', gate.toFixed(3));
    });

    syncWordClock();

  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const range = Math.max(1, intro.offsetHeight - window.innerHeight);
      frame(clamp((window.scrollY - intro.offsetTop) / range));
    });
  }

  if (REDUCED) {
    frame(0.5);
    cards.forEach((el) => el.style.setProperty('--o', '1'));
  } else {
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
  }
})();
