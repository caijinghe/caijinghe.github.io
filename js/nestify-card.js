/**
 * Nestify Card Animation (Homepage Grid)
 * Verbatim replica of 1.49s 'pop' preset from Nestie Starting Animation v2.html
 */
(() => {
  const card = document.getElementById('open-nestify');
  const stage = document.getElementById('nestify-card-stage');
  if (!card || !stage) return;

  const group = document.getElementById('nestify-card-group');
  const birdEl = document.getElementById('nestify-card-bird');
  const lettersEl = document.getElementById('nestify-card-letters');
  const istem = document.getElementById('nestify-card-istem');
  const dotEl = document.getElementById('nestify-card-dot');

  // Geometry Constants (verified bit-exact against Flutter device build)
  const W = 1920, H = 1080;
  const WORD = 'Nestify';
  const WORD_SIZE = 120, WORD_STROKE = 2.6;
  const LETTER_DROP = 140;
  const BIRD_SIZE = 170, BIRD_GAP = 10, BIRD_FOOT_NUDGE = 49.5;
  const LOGO_NUDGE_X = -12, LOGO_NUDGE_Y = -40;
  const BIRD_HEAD_X = 0.50, BIRD_HEAD_TOP = 0.1134;
  const I_STEM_W = 0.125, I_STEM_TOP = 0.496, I_STEM_OVERSHOOT = 0.007;
  const I_DOT_W = 0.148, I_DOT_H = 0.132, I_DOT_CENTER_Y = 0.655;
  const I_GLYPH_CENTER_X = 0.127, I_BASELINE_NUDGE = 0.0853;
  const BIRD_DROP = 12, I_DROP = 8;
  const DOT_FLY_COL = [0x14, 0xAD, 0xFD], DOT_REST_COL = [0x0F, 0x17, 0x2A];

  const LINE_HEIGHT = WORD_SIZE;
  const BASELINE = WORD_SIZE * 1011 / 1364;
  const GROUND_IN_BOX = BASELINE + WORD_SIZE * I_BASELINE_NUDGE;
  const ADV = [91.760, 67.040, 60.560, 48.080, 32.600, 45.680, 65.120];
  const WORD_W = ADV.reduce((a, b) => a + b, 0);

  const PAD_BOTTOM = Math.min(Math.max(LINE_HEIGHT - GROUND_IN_BOX, 0), 60);
  const ROW_H = Math.max(BIRD_SIZE + PAD_BOTTOM, LINE_HEIGHT);
  const ROW_TOP = (H - ROW_H) / 2 + LOGO_NUDGE_Y;
  const LETTER_TOP = ROW_TOP + (ROW_H - LINE_HEIGHT);
  const BASE_Y = LETTER_TOP + GROUND_IN_BOX;
  const rowLeft = (bw) => (W - (bw + BIRD_GAP + WORD_W)) / 2 + LOGO_NUDGE_X;
  const ROW_LEFT_FINAL = rowLeft(BIRD_SIZE);
  const I_BOX_X = ROW_LEFT_FINAL + BIRD_SIZE + BIRD_GAP + ADV.slice(0, 4).reduce((a, b) => a + b, 0);
  const DOT_HOME = { x: I_BOX_X + WORD_SIZE * I_GLYPH_CENTER_X, y: BASE_Y - WORD_SIZE * I_DOT_CENTER_Y };
  const DOT_W = WORD_SIZE * I_DOT_W + WORD_STROKE;
  const DOT_H = WORD_SIZE * I_DOT_H + WORD_STROKE;

  // Cubic bezier easing generator
  const CUBIC_ERR = 0.001;
  function cubic(a, b, c, d) {
    const ev = (m, x, y) => 3 * x * (1 - m) * (1 - m) * m + 3 * y * (1 - m) * m * m + m * m * m;
    return (t) => {
      if (t <= 0 || t >= 1) return t;
      let s = 0, e = 1;
      for (;;) {
        const mid = (s + e) / 2, est = ev(mid, a, c);
        if (Math.abs(t - est) < CUBIC_ERR) return ev(mid, b, d);
        if (est < t) s = mid; else e = mid;
      }
    };
  }
  const fEaseOut      = cubic(0.0, 0.0, 0.58, 1.0);
  const fEaseOutCubic = cubic(0.215, 0.61, 0.355, 1.0);
  const fEaseOutBack  = cubic(0.175, 0.885, 0.32, 1.275);
  const dotPopEase    = cubic(0.175, 0.885, 0.32, 1.45);

  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  const inkColor = (t) => `rgb(${mix(DOT_FLY_COL[0], DOT_REST_COL[0], t)},` +
                          `${mix(DOT_FLY_COL[1], DOT_REST_COL[1], t)},` +
                          `${mix(DOT_FLY_COL[2], DOT_REST_COL[2], t)})`;

  // Pop Preset Parameters
  const P = {
    letterMode: 'pop', birdMode: 'pop', dotMode: 'beat', dotStyle: 'pop',
    letterStart: 0.05, letterStagger: 0.045, letterDur: 0.45, letterEase: fEaseOutBack,
    birdAt: 0.22, birdDur: 0.45,
    dotAt: 0.34, dotDur: 0.42,
    hitDur: 0.16, hold: 0.22, fadeDur: 0.35,
  };

  const S = {
    birdPop: 0, birdY: 0, birdScale: 1, birdAlpha: 1,
    rollIn: 0, hopUp: 0, toI: 0, dotY: 0, dotScale: 1, dotAlpha: 1,
    birdSink: 0, iSink: 0, dotInk: 0, logoFade: 1,
    wipe: 0, wordY: 0
  };
  const L = WORD.split('').map(() => ({ p: 1, fade: 1, squash: 1 }));

  const SVGNS = 'http://www.w3.org/2000/svg';
  const letterNodes = [];
  for (let i = 0; i < WORD.length; i++) {
    if (WORD[i] === 'i') {
      letterNodes.push(null);
    } else {
      let t = lettersEl ? lettersEl.querySelector(`[data-letter="${i}"]`) : null;
      if (!t) {
        t = document.createElementNS(SVGNS, 'text');
        t.textContent = WORD[i];
        t.setAttribute('font-family', 'NunitoBoot');
        t.setAttribute('font-size', WORD_SIZE);
        t.setAttribute('font-weight', '700');
        t.setAttribute('fill', '#0F172A');
        t.setAttribute('stroke', '#0F172A');
        t.setAttribute('stroke-width', WORD_STROKE);
        t.setAttribute('stroke-linejoin', 'round');
        t.setAttribute('paint-order', 'stroke fill');
        lettersEl.appendChild(t);
      }
      letterNodes.push(t);
    }
  }

  const STEM_W = WORD_SIZE * I_STEM_W + WORD_STROKE;
  const STEM_TOP = GROUND_IN_BOX - WORD_SIZE * I_STEM_TOP - WORD_STROKE / 2;
  const STEM_BOT = GROUND_IN_BOX + WORD_SIZE * I_STEM_OVERSHOOT + WORD_STROKE / 2;
  if (istem) {
    istem.setAttribute('width', STEM_W);
    istem.setAttribute('height', STEM_BOT - STEM_TOP);
    istem.setAttribute('rx', STEM_W / 2);
    istem.setAttribute('ry', STEM_W / 2);
  }
  if (dotEl) {
    dotEl.setAttribute('width', DOT_W);
    dotEl.setAttribute('height', DOT_H);
    dotEl.setAttribute('rx', DOT_H / 2);
    dotEl.setAttribute('ry', DOT_H / 2);
  }

  function render() {
    if (!group) return;
    group.setAttribute('opacity', S.logoFade);

    // Bird
    const push = P.birdMode === 'push';
    const t = S.birdPop;
    const boxW = push ? BIRD_SIZE * clamp(t, 0, 1.15) : BIRD_SIZE;
    const rl = rowLeft(boxW);
    const boxTop = ROW_TOP + BIRD_FOOT_NUDGE;
    const imgSize = push ? Math.min(boxW, BIRD_SIZE) : BIRD_SIZE;
    const bScale = push ? clamp(t, 0, 1.15) : S.birdScale;
    const bAlpha = push ? (t <= 0 ? 0 : clamp(t, 0, 1)) : S.birdAlpha;
    const cx = rl + boxW / 2, cy = boxTop + BIRD_SIZE / 2;
    const birdSink = BIRD_DROP * S.birdSink + S.birdY;
    if (birdEl) {
      birdEl.setAttribute('x', rl + (boxW - imgSize) / 2);
      birdEl.setAttribute('y', boxTop + (BIRD_SIZE - imgSize) / 2);
      birdEl.setAttribute('width', imgSize);
      birdEl.setAttribute('height', imgSize);
      birdEl.setAttribute('opacity', bAlpha);
      birdEl.setAttribute('transform',
        `translate(0 ${birdSink}) translate(${cx} ${cy}) scale(${bScale}) translate(${-cx} ${-cy})`);
    }

    // Word
    const iKnock = I_DROP * S.iSink;
    let x = rl + boxW + BIRD_GAP;

    for (let i = 0; i < WORD.length; i++) {
      const p = L[i].p;
      let dy = 0, scale = 1;
      switch (P.letterMode) {
        case 'pop': scale = p; break;
        default: break;
      }
      if (WORD[i] === 'i') dy += iKnock;
      const glyphCx = x + ADV[i] / 2;
      const sy = L[i].squash;
      const tf = (scale !== 1 || sy !== 1)
        ? `translate(${glyphCx} ${BASE_Y}) scale(${scale * (1 + (1 - sy) * 0.5)} ${scale * sy}) translate(${-glyphCx} ${-BASE_Y})`
        : '';

      if (WORD[i] === 'i') {
        if (istem) {
          istem.setAttribute('x', x + WORD_SIZE * I_GLYPH_CENTER_X - STEM_W / 2);
          istem.setAttribute('y', LETTER_TOP + STEM_TOP + dy);
          istem.setAttribute('opacity', L[i].fade);
          istem.setAttribute('transform', tf);
        }
      } else {
        const n = letterNodes[i];
        if (n) {
          n.setAttribute('x', x);
          n.setAttribute('y', BASE_Y + dy);
          n.setAttribute('opacity', L[i].fade);
          n.setAttribute('transform', tf);
        }
      }
      x += ADV[i];
    }

    // Dot (stays #14ADFD blue, rides the iKnock)
    if (dotEl) {
      const cy = DOT_HOME.y + iKnock + S.dotY;
      dotEl.setAttribute('x', DOT_HOME.x - DOT_W / 2);
      dotEl.setAttribute('y', cy - DOT_H / 2);
      dotEl.setAttribute('fill', inkColor(S.dotInk));
      dotEl.setAttribute('opacity', S.dotAlpha);
      dotEl.setAttribute('transform', S.dotScale !== 1
        ? `translate(${DOT_HOME.x} ${cy}) scale(${S.dotScale}) translate(${-DOT_HOME.x} ${-cy})`
        : '');
    }
  }

  // Set Resting State (At the last frame)
  function setRestingState() {
    if (tl) tl.kill();
    Object.assign(S, {
      birdPop: 0, birdY: 0, birdScale: 1, birdAlpha: 1,
      rollIn: 0, hopUp: 0, toI: 0, dotY: 0, dotScale: 1, dotAlpha: 1,
      birdSink: 0, iSink: 0, dotInk: 0, logoFade: 1,
      wipe: 0, wordY: 0
    });
    L.forEach(l => Object.assign(l, { p: 1, fade: 1, squash: 1 }));
    render();
  }

  // Play Pop Animation (From beginning to last frame)
  let tl = null;
  function playPop() {
    if (typeof gsap === 'undefined') {
      console.warn('GSAP not loaded');
      return;
    }
    if (tl) tl.kill();

    Object.assign(S, {
      birdPop: 0, birdY: 0, birdScale: 1, birdAlpha: 0,
      rollIn: 0, hopUp: 0, toI: 0, dotY: 0, dotScale: 1, dotAlpha: 0,
      birdSink: 0, iSink: 0, dotInk: 0, logoFade: 1,
      wipe: 0, wordY: 0
    });
    L.forEach(l => Object.assign(l, { p: 0, fade: 0, squash: 1 }));

    tl = gsap.timeline({ onUpdate: render });

    // letters cascade
    tl.to(L, { p: 1, duration: P.letterDur, ease: P.letterEase, stagger: P.letterStagger }, P.letterStart);
    tl.to(L, { fade: 1, duration: 0.001, ease: fEaseOut, stagger: P.letterStagger }, P.letterStart);

    // bird pops in mid-cascade
    S.birdScale = 0;
    tl.to(S, { birdScale: 1, duration: P.birdDur, ease: fEaseOutBack }, P.birdAt);
    tl.to(S, { birdAlpha: 1, duration: 0.001 }, P.birdAt);

    // dot pops last with overshoot and impacts stem
    const landed = P.dotAt + P.dotDur;
    tl.to(S, { dotAlpha: 1, duration: 0.001 }, P.dotAt);
    S.dotScale = 0;
    tl.to(S, { dotScale: 1, duration: P.dotDur, ease: dotPopEase }, P.dotAt);
    tl.to(S, { iSink: 1, duration: P.hitDur * 0.25, ease: fEaseOutCubic }, landed);
    tl.to(S, { iSink: 0, duration: P.hitDur * 0.75, ease: fEaseOutCubic }, landed + P.hitDur * 0.25);
  }

  // 1. Initial render at final holding frame IMMEDIATELY (no waiting)
  setRestingState();

  // 2. Re-render once fonts are ready just in case
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => render()).catch(() => {});
  }

  // Hover on card: trigger pop animation
  card.addEventListener('mouseenter', () => {
    playPop();
  });

  // Click on card: replay pop animation on card
  card.addEventListener('click', (e) => {
    e.preventDefault();
    playPop();
  });
})();
