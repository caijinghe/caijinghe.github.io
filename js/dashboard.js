/**
 * Home dashboard — the small live pieces:
 * the intro panel's hover label, copy-email, and the bookshelf (from the Info page).
 */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // A hover label that trails the pointer over an area (the clock's "Local time / US Eastern", the intro panel's
  // "Jinghe's / Design philosophy"): each frame it closes part of the gap (more when far), leaning a little into fast
  // moves; it appears right by the pointer. Mouse only. box = the element its coordinates are measured from
  // (null: the viewport, for a position: fixed label).
  const followTip = (area, tip, box = area) => {
    const OX = 14, OY = 18;
    let tx = 0, ty = 0, x = 0, y = 0, lean = 0, last = 0, raf = 0;
    const at = e => { const r = box ? box.getBoundingClientRect() : { left: 0, top: 0 }; return [e.clientX - r.left, e.clientY - r.top]; };
    const draw = () => { tip.style.transform = `translate3d(${(x + OX).toFixed(1)}px, ${(y + OY).toFixed(1)}px, 0) rotate(${lean.toFixed(2)}deg)`; };
    const step = now => {
      const dt = Math.min(48, now - (last || now)); last = now;
      const k = reduce ? 1 : 1 - Math.exp(-dt / 70);   // ~70ms to close most of the gap, the same at any frame rate
      const dx = (tx - x) * k; x += dx; y += (ty - y) * k;
      lean += ((reduce ? 0 : Math.max(-4, Math.min(4, dx * 0.6))) - lean) * (reduce ? 1 : 1 - Math.exp(-dt / 120));
      draw();
      raf = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(lean) > 0.05 ? requestAnimationFrame(step) : 0;
    };
    const wake = () => { if (!raf) { last = 0; raf = requestAnimationFrame(step); } };
    area.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      [tx, ty] = at(e); x = tx; y = ty; lean = 0; draw(); tip.classList.add('is-on');
    });
    area.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; [tx, ty] = at(e); wake(); });
    area.addEventListener('pointerleave', () => tip.classList.remove('is-on'));
  };

  // ---- Intro: "Design philosophy" isn't printed on the panel; it's the panel's hover label (like the clock's) ----
  const idPanel = document.querySelector('.id-panel');
  if (idPanel) {
    const tip = document.createElement('span');
    tip.className = 'mc-tip hover-tip'; tip.setAttribute('aria-hidden', 'true');
    tip.innerHTML = '<span class="mc-tip-sub">Jinghe’s</span>Design philosophy';
    document.body.append(tip);   // fixed, on the body: the card's rounded clip can't cut it off
    followTip(idPanel, tip, null);
  }

  // ---- The intro types one sentence at a time: types it, holds, deletes it, then the next ----
  const typed = document.querySelector('.typed');
  if (typed && !reduce) {
    const lines = typed.dataset.lines.split('|');
    const TYPE = 75, HOLD = 3200, DEL = 35, REST = 500;   // ms: per letter, sentence up, per deleted letter, empty
    let n = 0, i = 0, del = false;
    const step = () => {
      const line = lines[n];
      typed.textContent = line.slice(0, i);
      if (!del) {
        if (i === line.length) { del = true; return setTimeout(step, HOLD); }
        i++; return setTimeout(step, TYPE);
      }
      if (i === 0) { del = false; n = (n + 1) % lines.length; return setTimeout(step, REST); }
      i--; setTimeout(step, DEL);
    };
    typed.textContent = ''; setTimeout(step, 400);
  }

  // ---- Clock: the melting clock from Figma (CAI'S WEBSITE › new homepage › "helo2", double rim), US Eastern time ----
  // (the dial names the zone, not a city; America/New_York is just the zone's ID)
  // The dial sinks into water below its 4 and 8. Static art is media/index/melt-clock.svg (behind) and
  // melt-clock-front.svg (night: the person asleep, pillow, lamp and sparkle, filled, in front of the hands) or
  // melt-clock-front-day.svg (day: standing, eyes open, the mushroom floating), each with its reflection; the hands are drawn here,
  // cut off at the waterline, and mirrored into the water as a rippling line that follows them round.
  const mc = document.querySelector('.mc');
  if (mc) {
    const svg = mc.querySelector('svg'), tz = mc.dataset.tz, CX = 243, CY = 377, W = 433.4;   // centre, waterline (Figma px)
    // [forward length, tail] as in the Figma layers
    const HOUR = [77.35, 30.4], MIN = [109, 17.15], SEC = [150.1, 0];
    const refl = (len, tail, w) => `<line x1="0" y1="${tail}" x2="0" y2="${-len}" stroke="url(#mc-refl)" stroke-width="${w}" stroke-linecap="round"/>`;
    svg.innerHTML = `
      <defs>
        <clipPath id="mc-above"><rect x="0" y="0" width="486" height="${W}"/></clipPath>
        <linearGradient id="mc-refl" gradientUnits="userSpaceOnUse" x1="0" y1="${W}" x2="0" y2="${W - 82}"><stop stop-color="#8A8165"/><stop offset=".97" stop-color="#CCC9BD"/></linearGradient>
        <linearGradient id="mc-fadeg" gradientUnits="userSpaceOnUse" x1="0" y1="${W}" x2="0" y2="${W + 150}"><stop stop-color="#fff"/><stop offset=".7" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <mask id="mc-fade" maskUnits="userSpaceOnUse" x="0" y="${W - 2}" width="486" height="200"><rect x="0" y="${W - 2}" width="486" height="200" fill="url(#mc-fadeg)"/></mask>
        <!-- ripples: sideways-only displacement from slow, horizontally stretched noise -->
        <filter id="mc-ripple" filterUnits="userSpaceOnUse" x="0" y="${W - 4}" width="486" height="210">
          <feTurbulence type="fractalNoise" baseFrequency="0.004 0.05" numOctaves="2" seed="7" result="n">
            ${reduce ? '' : '<animate attributeName="baseFrequency" values="0.004 0.05;0.005 0.058;0.004 0.05" dur="9s" repeatCount="indefinite"/>'}
          </feTurbulence>
          <feColorMatrix in="n" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 0 0 0  0 0 0 0 1" result="nx"/>
          <feDisplacementMap in="SourceGraphic" in2="nx" scale="30" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
        <!-- the same water, gentler, for the reflections of the person, lamp and sparkle (already wavy in the drawing) -->
        <filter id="mc-ripple-soft" filterUnits="userSpaceOnUse" x="0" y="${W - 4}" width="486" height="210">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.06" numOctaves="2" seed="11" result="n">
            ${reduce ? '' : '<animate attributeName="baseFrequency" values="0.006 0.06;0.008 0.07;0.006 0.06" dur="7s" repeatCount="indefinite"/>'}
          </feTurbulence>
          <feColorMatrix in="n" type="matrix" values="1 0 0 0 0  0 0 0 0 .5  0 0 0 0 0  0 0 0 0 1" result="nx"/>
          <feDisplacementMap in="SourceGraphic" in2="nx" scale="12" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
      <image href="media/index/melt-clock.svg?v=6" x="0" y="0" width="486" height="647"/>
      <g filter="url(#mc-ripple-soft)">
        <image class="mc-night" href="media/index/melt-clock-refl.svg?v=1" x="0" y="0" width="486" height="647"/>
        <image class="mc-day" href="media/index/melt-clock-refl-day.svg?v=2" x="0" y="0" width="486" height="647"/>
      </g>
      <!-- reflection: the hands mirrored in the waterline, stretched 1.5× down, rippled and fading -->
      <g mask="url(#mc-fade)"><g filter="url(#mc-ripple)"><g transform="matrix(1 0 0 -1.5 0 ${2.5 * W})"><g clip-path="url(#mc-above)">
        <g class="mc-rs" transform="translate(${CX} ${CY})">${refl(...SEC, 0.8)}</g>
        <g class="mc-rh" transform="translate(${CX} ${CY})">${refl(...HOUR, 1.2)}</g>
        <g class="mc-rm" transform="translate(${CX} ${CY})">${refl(...MIN, 1)}</g>
        <ellipse cx="${CX}" cy="${CY}" rx="7.5" ry="7.5" fill="none" stroke="url(#mc-refl)"/>
      </g></g></g></g>
      <g clip-path="url(#mc-above)">
        <g class="mc-s" transform="translate(${CX} ${CY})"><line x1="0" y1="0" x2="0" y2="${-SEC[0]}" stroke="#000" stroke-width="1" stroke-linecap="round"/></g>
        <g class="mc-h" transform="translate(${CX} ${CY})"><rect x="-1.5" y="${-HOUR[0]}" width="3" height="${HOUR[0] + HOUR[1]}" rx="1.5" fill="#000"/></g>
        <g class="mc-m" transform="translate(${CX} ${CY})"><rect x="-2" y="${-MIN[0]}" width="4" height="${MIN[0] + MIN[1]}" rx="2" fill="#FFFCF2" stroke="#000"/></g>
      </g>
      <circle cx="${CX}" cy="${CY}" r="7.5" fill="#FFFCF2" stroke="#000"/>
      <!-- the person (and at night the pillow, lamp and sparkle) sit in front: the hands sweep behind them -->
      <image class="mc-night" href="media/index/melt-clock-front.svg?v=3" x="0" y="0" width="486" height="647"/>
      <image class="mc-day" href="media/index/melt-clock-front-day.svg?v=6" x="0" y="0" width="486" height="647"/>`;
    const $ = s => svg.querySelector(s);
    const parts_ = [['.mc-h', '.mc-rh'], ['.mc-m', '.mc-rm'], ['.mc-s', '.mc-rs']].map(([a, b]) => [$(a), $(b)]);
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
    let label = '', isDay = null;
    // Day (6:00–18:00 in New York, the clock's own time): the person stands in the water, eyes open, the mushroom floats by.
    // Night: asleep on a pillow by a lamp, a sparkle on the water.
    const nightArt = [...svg.querySelectorAll('.mc-night')], dayArt = [...svg.querySelectorAll('.mc-day')];
    // to look at the other one: index.html?clock=day or ?clock=night (just the picture; the hands keep the real time)
    const forceArt = ['day', 'night'].find(v => v === new URLSearchParams(location.search).get('clock'));
    const setDay = day => {
      if (day === isDay) return; isDay = day;
      nightArt.forEach(el => el.style.display = day ? 'none' : '');
      dayArt.forEach(el => el.style.display = day ? '' : 'none');
    };
    const tip = mc.closest('.t-clock').querySelector('.mc-tip');
    if (tip) tip.innerHTML = '<span class="mc-tip-sub">Local time</span>US Eastern';   // the hover label, two lines: just the zone (the hands already tell the time)
    if (tip) followTip(mc.closest('.t-clock'), tip);
    (function tick() {
      const d = new Date(), p = Object.fromEntries(parts.formatToParts(d).map(x => [x.type, +x.value])), s = p.second + (reduce ? 0 : d.getMilliseconds() / 1000);
      const angles = [((p.hour % 12) + p.minute / 60 + s / 3600) * 30, (p.minute + s / 60) * 6, s * 6];
      parts_.forEach(([hand, ref], i) => { const t = `translate(${CX} ${CY}) rotate(${angles[i].toFixed(3)})`; hand.setAttribute('transform', t); ref.setAttribute('transform', t); });
      setDay(forceArt ? forceArt === 'day' : p.hour % 24 >= 6 && p.hour % 24 < 18);   // hour12:false can say 24 at midnight
      const hm = `${p.hour % 12 || 12}:${String(p.minute).padStart(2, '0')} ${p.hour < 12 ? 'AM' : 'PM'}`;
      const l = `Local time, ${hm}, US Eastern`;
      if (l !== label) {
        label = l; mc.closest('.t-clock').setAttribute('aria-label', l);
      }
      reduce ? setTimeout(tick, 1000 - d.getMilliseconds()) : requestAnimationFrame(tick);
    })();
  }

  // ---- Research tile: the hanging flip calendar, one identity per page, each in a face that suits it — CAI and
  // RESEARCHER on the rings, DESIGNER and Comic Artist hanging below. Any page can be torn off: grab it and it falls
  // away (grab the rings and the frontmost one goes), the page under it shows, then the torn one grows back. ----
  const calSlot = document.querySelector('.t-research .cal-slot');
  if (calSlot) fetch(calSlot.dataset.src).then(r => r.text()).then(txt => {
    calSlot.innerHTML = txt;
    const svg = calSlot.querySelector('svg');
    svg.classList.add('hang-cal'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Flip calendar: CAI, HCI researcher (multimodal interaction), AI product designer, comic artist');
    const pages = [...svg.querySelectorAll('.cal-pg')];   // back to front: Comic Artist … CAI
    const top = () => pages.filter(p => !p.dataset.gone).at(-1);

    // Lengthen to fit: on desktop the calendar's slot is taller than the drawing, so the pages (not the rings) are
    // stretched down from where they hang, up to 50% longer. The words are scaled back so they aren't pulled tall,
    // and stay as wide as drawn: a narrow calendar shrinks them with it, never crops them.
    const NS = 'http://www.w3.org/2000/svg', Y0 = 56, TOP = 18, NAT = 622;   // viewBox top is 38; pages hang from y≈56
    const body = document.createElementNS(NS, 'g'); body.setAttribute('class', 'cal-body');
    const rings = [...svg.children].filter(el => el.tagName === 'path' && el.getAttribute('stroke-width') === '2.6');
    svg.insertBefore(body, rings[0]);
    [...svg.children].forEach(el => { if (el !== body && el.tagName !== 'defs' && !rings.includes(el)) body.append(el); });
    const words = [...svg.querySelectorAll('use.cal-word')].map(u => {
      const g = document.createElementNS(NS, 'g'); u.before(g); g.append(u);
      const b = g.getBBox(); return { g, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
    });
    const slotTile = calSlot.closest('.t-research'), wide = matchMedia('(min-width: 1024px)');
    let bodyT = '';
    const lengthen = () => {
      const r = slotTile.getBoundingClientRect();
      const k = wide.matches && r.width ? Math.min(1.5, Math.max(1, (r.height / r.width * 392 - TOP) / (NAT - TOP))) : 1;
      const H = TOP + (NAT - TOP) * k, s = 1;   // words keep their drawn size relative to the page's width (a wider word would be cut at the page's edge)
      bodyT = `translate(0 ${Y0}) scale(1 ${k.toFixed(4)}) translate(0 ${-Y0})`;
      body.setAttribute('transform', bodyT);
      svg.setAttribute('viewBox', `52 38 392 ${H.toFixed(2)}`);
      slotTile.style.setProperty('--cal-h', H.toFixed(2));
      words.forEach(({ g, cx, cy }) => g.setAttribute('transform', `translate(${cx} ${cy}) scale(${s.toFixed(4)} ${(s / k).toFixed(4)}) translate(${-cx} ${-cy})`));
    };
    new ResizeObserver(lengthen).observe(slotTile); wide.addEventListener('change', lengthen); lengthen();

    const toSvg = e => new DOMPoint(e.clientX, e.clientY).matrixTransform(body.getScreenCTM().inverse());   // the pages' own (lengthened) space
    const pinOf = p => p.dataset.pin.split(' ').map(Number);
    const put = (p, s) => p.setAttribute('transform', `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${s.r.toFixed(2)} ${pinOf(p).join(' ')})`);

    // A torn page grows back: unrolls downward from where it hangs
    const regrow = p => setTimeout(() => {
      delete p.dataset.gone; p.style.display = '';
      const [px, py] = pinOf(p), t0 = performance.now(), ms = reduce ? 0 : 450;
      (function f(t) { const k = ms ? Math.min(1, (t - t0) / ms) : 1, e = 1 - Math.pow(1 - k, 3);
        p.setAttribute('transform', `translate(${px} ${py}) scale(1 ${Math.max(0.001, e).toFixed(3)}) translate(${-px} ${-py})`);
        p.style.opacity = Math.min(1, k * 2).toFixed(3); if (k < 1) requestAnimationFrame(f); })(t0);
    }, reduce ? 0 : 450);   // just long enough to see the page underneath
    // Tearing: a copy of the page comes off (in front of everything, lengthened like the pages) while the page itself
    // hides, waiting to grow back once the copy is gone.
    const detach = p => {
      const ghost = p.cloneNode(true), wrap = document.createElementNS(NS, 'g');
      wrap.setAttribute('transform', bodyT); wrap.append(ghost); svg.append(wrap); ghost.style.pointerEvents = 'none';
      p.removeAttribute('transform'); p.style.opacity = 0; p.dataset.gone = '1';
      return { p, ghost, wrap };
    };
    // A torn page drops (gravity, spin, fade) with the pull's last speed, then the page grows back
    const drop = (torn, s) => {
      regrow(torn.p);
      const done = () => torn.wrap.remove();
      if (reduce) return done();
      const t0 = performance.now();
      (function f(t) {
        s.vy += 1.1; s.x += s.vx; s.y += s.vy; s.r += s.vr; s.vr *= 0.985;
        put(torn.ghost, s); const age = t - t0;
        torn.ghost.style.opacity = Math.max(0, 1 - Math.max(0, age - 350) / 650).toFixed(3);
        age < 1000 ? requestAnimationFrame(f) : done();
      })(t0);
    };

    // Pull a page: it swings about its binding and stretches toward the pull. Pull far enough and it tears off and
    // falls at once, with the pull's speed. Let go before it tears: it springs back. A tap tears it off too.
    let drag = null;
    svg.addEventListener('pointerdown', e => {   // the page you grab comes off (the rings or blank edges: the frontmost one)
      if (drag) release();   // a pull left over from a lost let-go: settle it before grabbing anew
      const hit = e.target.closest('.cal-pg'), p = hit && !hit.dataset.gone ? hit : top(); if (!p) return;
      e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch {}   // a pointer the browser no longer tracks can't be captured
      const a = toSvg(e), pin = pinOf(p);
      drag = { p, a, last: a, lt: performance.now(), v: { x: 0, y: 0 }, a0: Math.atan2(a.y - pin[1], a.x - pin[0]), s: { x: 0, y: 0, r: 0 } };
      calSlot.classList.add('is-pulling');
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) return release();   // the button is up: the let-go was missed
      const b = toSvg(e), now = performance.now(), dt = Math.max(1, now - drag.lt), pin = pinOf(drag.p);
      drag.v = { x: (b.x - drag.last.x) / dt * 16, y: (b.y - drag.last.y) / dt * 16 }; drag.last = b; drag.lt = now;
      const turnDeg = (Math.atan2(b.y - pin[1], b.x - pin[0]) - drag.a0) * 180 / Math.PI;
      drag.s = { x: (b.x - drag.a.x) * 0.12, y: (b.y - drag.a.y) * 0.12, r: Math.max(-28, Math.min(28, turnDeg)) };
      put(drag.p, drag.s);
      if (Math.hypot(b.x - drag.a.x, b.y - drag.a.y) > 70) release(true);   // pulled far enough: it rips and falls
    });
    const release = rip => {
      if (!drag) return;
      const { p, s, v, a, last } = drag; drag = null; calSlot.classList.remove('is-pulling');
      const spin = (v.x >= 0 ? 1 : -1) * (2 + Math.random() * 2);
      if (rip === true) return drop(detach(p), { ...s, vx: v.x * 0.8, vy: Math.min(v.y * 0.8, 6), vr: spin });
      if (Math.hypot(last.x - a.x, last.y - a.y) < 4)   // a tap: off it comes, straight down
        return drop(detach(p), { ...s, vx: 3 * 0.8, vy: -2 * 0.8, vr: Math.abs(spin) });
      const s0 = { ...s }, t0 = performance.now();      // let go early: springs back
      (function f(t) { const k = Math.min(1, (t - t0) / 380), e = 1 - Math.pow(1 - k, 3) * Math.cos(k * 5);
        put(p, { x: s0.x * (1 - e), y: s0.y * (1 - e), r: s0.r * (1 - e) }); if (k < 1) requestAnimationFrame(f); })(t0);
    };
    // Let go — however it happens. A pulled page must never be left hanging, so besides the usual up / cancel, losing
    // the pointer capture, a release outside the window, the window losing focus or the tab being hidden all let go.
    svg.addEventListener('pointerup', release);
    svg.addEventListener('pointercancel', release);
    svg.addEventListener('lostpointercapture', release);
    addEventListener('pointerup', release, true);
    addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => { if (document.hidden) release(); });
  });

  // ---- Toggle switch: flips On / Off on click (the button handles Space / Enter); the look is all CSS.
  // Meant to become the dark / light mode switch — for now it's only the switch itself. ----
  // On / Off are SVG text, which scales with the switch: convert the tile labels' on-screen size into the SVG's
  // units so the words stay exactly label-sized whatever size the switch is drawn at.
  document.querySelectorAll('.sw').forEach(sw => {
    // The groove's diagonal lines get the same treatment: the pattern is scaled so they sit 5 screen px apart, 1px wide,
    // like the intro panel's.
    const lbl = sw.querySelector('.sw-label'), hatch = sw.querySelector('pattern'), fit = () => {
      const w = sw.getBoundingClientRect().width;
      if (!w) return;
      sw.style.setProperty('--sw-label', parseFloat(getComputedStyle(document.querySelector('.tile-label') || lbl).fontSize) * 200 / w + 'px');
      hatch?.setAttribute('patternTransform', `scale(${200 / w})`);
    };
    new ResizeObserver(fit).observe(sw); fit();
  });
  // ---- Toggle switch = a song: On plays it on loop, Off pauses (next On picks up where it stopped).
  // No file / blocked playback → it stays Off. ----
  document.querySelectorAll('.sw').forEach(sw => {
    const set = on => sw.setAttribute('aria-checked', on ? 'true' : 'false');
    // The file starts loading as soon as the pointer comes near (hover / touch / focus), so the click doesn't wait on
    // the download. (The track's near-silent first 2.6s are trimmed out of the file itself.)
    let song = null;
    const load = () => {
      if (song || !sw.dataset.song) return;
      song = new Audio(sw.dataset.song); song.preload = 'auto'; song.loop = true;   // keeps playing until the switch is turned off
    };
    sw.addEventListener('pointerenter', load);
    sw.addEventListener('pointerdown', load);
    sw.addEventListener('focus', load);
    sw.addEventListener('click', () => {
      if (sw.getAttribute('aria-checked') === 'true') { set(false); song?.pause(); return; }
      load();
      set(true);
      song?.play().catch(() => set(false));
    });
    // The showreel comes first: as soon as it plays (muted or not, the reel is what you came to watch), the song
    // stops and the switch goes back to Off. 'play' doesn't bubble, so listen in the capture phase on the overlay.
    const reel = document.getElementById('showreelOverlay');
    const yield_ = e => {
      if (e.target.tagName !== 'VIDEO' || !song || song.paused) return;
      song.pause(); set(false);
    };
    ['play', 'playing'].forEach(k => reel?.addEventListener(k, yield_, true));
  });
  // Dark mode (a first try, parked until the other pages have a dark version too): the switch's On swapped the
  // page's black and white. To bring it back, toggle html.is-dark here (the styles are kept in dashboard.css).
  // document.documentElement.classList.toggle('is-dark', on);

  // ---- Logo tile: the running mushroom, cycling colourways ----
  const slot = document.querySelector('.t-logo .mr-slot');
  if (slot && window.MushroomRun) MushroomRun(slot);

  // ---- Bookshelf: whole shelf at rest; hover a book to open its year, move off to close (touch / keyboard: tap / Enter toggles) ----
  // Words, line breaks (\n) and layout are the Info page's, photos are that year's. Most years sit on one side of their book;
  // A year can still have two halves (shown side by side); every year has one for now.
  const P = (y, ...n) => n.map(i => `media/photo-${y}-${i}.png`);
  // width ÷ height of each photo, so one shared photo height can be worked out before any image has downloaded
  // (the originals are ~17 MB together). Swap a photo → update its ratio here.
  const RATIO = { '2019-1': 2.484, '2020-1': 1.607, '2021-1': 1.79, '2023-2': 1.911 };   // every other photo is square
  const ratioOf = src => RATIO[src.match(/photo-(\d+-\d+)/)[1]] || 1;
  const YEARS = {
    2019: [{ text: 'I graduated from Xiamen University with a BFA in Fine Arts.\nTwelve of my paintings lined the hallway for my graduation show.\nThey were all sold on the first day.', photos: P(2019, 1, 2) }],
    2020: [{ text: 'My first comic book was published.\nA friend went to a bookstore just to find it.\nShe texted me, “I’m proud of you.”', photos: P(2020, 1, 2) }],
    2021: [{ text: 'Dove into affective computing. Days and nights blurred in the lab.\nI attended conferences and published my first first-author paper.\nIt felt like a step closer to a PhD.', photos: P(2021, 1, 2, 3) }],
    2022: [{ text: 'While publishing my papers, I kept wondering\nif research ever reached the real world.\nI wavered between staying in academia and moving toward industry.', photos: P(2022, 1, 2, 4) }],
    2023: [{ text: 'I brought my work to CHI 2023 and quietly stepped away from academia.\nIn the years after, I stayed on as a reviewer for ACM CHI and MM.\nA soft goodbye. That year, I graduated from Tsinghua University\nwith a MCS in Computer Science.', photos: P(2023, 1, 2, 3) }],
    2024: [{ text: 'I took a half-year gap to publish my second book.\nThen I came to the U.S., ready to explore design in the real world.\nNow I’m a UX Design grad student at SCAD!', photos: P(2024, 1, 2, 3) }],
    2025: [{ text: 'Years of HCI research shaped how I think and design, helping me stand out.\nI led client projects with Microsoft and Samsung, turning design into impact.\nOne apple at a time, the story continues…', photos: P(2025, 1, 2, 3, 4) }],
  };
  const tile = document.querySelector('.t-shelf');
  if (tile) {
    const shelf = tile.querySelector('.shelf'), books = [...shelf.querySelectorAll('.book')];
    const card = tile.querySelector('.year-card');
    let open = null;
    const close = () => {
      open = null;
      tile.classList.remove('is-open'); shelf.classList.remove('is-open');
      books.forEach(b => { b.classList.remove('is-on'); b.setAttribute('aria-pressed', 'false'); });
    };
    const show = y => {
      open = y;
      const halves = YEARS[y];
      card.replaceChildren(...halves.map(h => {
        const side = document.createElement('div'), pics = document.createElement('div'), p = document.createElement('p');
        side.className = 'year-side'; pics.className = 'year-photos'; p.className = 'year-text';
        pics.innerHTML = h.photos.map(src => `<img src="${src}" alt="" />`).join('');
        p.textContent = h.text;
        side.append(pics, p);
        return side;
      }));
      books.forEach(b => { const on = b.dataset.y === y; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
      // In the name's place (the name steps out while a year is open), left edge on the "Chapters" label.
      // One half: the whole width. Two halves: side by side, each up to half. Every photo is the same height in
      // every year (--photo-h in CSS).
      const roomsFor = (yr, t) => {
        const x = tile.querySelector('.shelf-label').offsetLeft, W = t.width - 2 * x;
        const g = parseFloat(getComputedStyle(card).columnGap) || 0;
        return { halves: YEARS[yr].length === 2 ? [(W - g) / 2, (W - g) / 2] : [W] };
      };
      const layout = () => {
        if (open !== y) return;
        const t = tile.getBoundingClientRect(), R = roomsFor(y, t);
        // One photo height for every year, and every year's photos in one row: the tallest height at which the
        // tightest year still fits (capped at 110px, 20% of the frame's height, never under 48px).
        const GAP = 8;
        let ph = Math.min(110, Math.max(48, t.height * 0.2));
        Object.keys(YEARS).forEach(yr => roomsFor(yr, t).halves.forEach((w, i) => {
          const ps = YEARS[yr][i].photos;
          ph = Math.min(ph, (w - GAP * (ps.length - 1)) / ps.reduce((a, src) => a + ratioOf(src), 0));
        }));
        tile.style.setProperty('--photo-h', Math.max(40, Math.floor(ph)) + 'px');
        // each half as wide as its content (photos or the Info page's lines), up to its share
        const sides = [...card.children];
        sides.forEach((sd, i) => { sd.style.width = 'fit-content'; sd.style.maxWidth = R.halves[i] + 'px'; });
        // Keep the Info page's line breaks where every line fits; where one doesn't, a hard break plus a wrap
        // leaves stubs ("stepped / away"), so that half flows instead, with no lone last word.
        sides.forEach((side, i) => {
          const p = side.querySelector('.year-text');
          p.textContent = p.dataset.text; p.classList.remove('is-flow');
          const room = Math.min(R.halves[i], parseFloat(getComputedStyle(p).maxWidth) || Infinity);   // the CSS measure cap
          p.style.whiteSpace = 'pre'; p.style.width = 'max-content'; p.style.maxWidth = 'none';
          const fits = p.getBoundingClientRect().width <= room;   // fractional widths: a line right at the edge counts
          p.style.whiteSpace = ''; p.style.width = ''; p.style.maxWidth = '';
          if (!fits) { p.textContent = p.dataset.text.replace(/\n/g, ' '); p.classList.add('is-flow'); }
        });
      };
      card.querySelectorAll('.year-text').forEach(p => { p.dataset.text = p.textContent; });
      const imgs = [...card.querySelectorAll('.year-photos img')];
      layout();   // photo widths come from their ratios: lay out again once any still loading arrive
      if (!imgs.every(i => i.complete && i.naturalWidth)) Promise.all(imgs.map(i => i.decode().catch(() => {}))).then(layout);
      tile.classList.remove('is-open'); void tile.offsetWidth;   // replay the entrance when switching years
      tile.classList.add('is-open'); shelf.classList.add('is-open');
    };
    // Mouse: hover a book to open its year, leave it to close (a short grace so a tilted book's edge doesn't flicker).
    // Touch / keyboard have no hover, so a tap / Enter still toggles.
    let leaveT = 0;
    books.forEach(b => {
      b.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(leaveT); if (open !== b.dataset.y) show(b.dataset.y); });
      b.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; clearTimeout(leaveT); leaveT = setTimeout(() => { if (open === b.dataset.y) close(); }, 120); });
      b.addEventListener('click', e => { e.stopPropagation(); if (e.pointerType === 'mouse') return; open === b.dataset.y ? close() : show(b.dataset.y); });
    });
    tile.addEventListener('click', () => { if (open) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && open) close(); });
  }

  // ---- Contact: the steam over the cup. Drawn live as a plume: a centre line rising out of the cup's mouth, with
  // bends that travel upward like rising smoke. Their length keeps changing and a second, shorter set fades in and
  // out, so sometimes it has a couple of big bends and sometimes several small ones. The outline is the centre line
  // pushed out sideways either side (so the two sides never cross) and a round head on top; every point goes through
  // a smooth curve, so the edge stays smooth. Both feet stand in the mouth.
  // The head keeps filling up; once it's too big it lets go: it pulls away from the stem on a sticky, stretching neck
  // (a metaball join) until the neck snaps, then floats off and fades. The stem's top springs shut and grows into
  // the next head. Reduced motion: the drawn curl. ----
  const steam = document.querySelector('.steam-wave');
  if (steam && !reduce) {
    const RIM = 231.9, X0 = 331.15, FOOT = 7, BODY = 8, HN = 62, P = 2 * Math.PI, PI = Math.PI, N = 26;   // FOOT: half the gap between the feet
    const wave = (t, p, ph) => Math.sin(P * t / p + ph);
    const smooth = u => u * u * (3 - 2 * u), clamp = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, k) => a + (b - a) * k;
    const polar = (c, a, r) => [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const f = v => v.toFixed(2);
    // a smooth curve through points — centripetal Catmull-Rom → cubic Béziers, which never makes a cusp or a little
    // loop where points bunch up — open or closed
    const curve = (pts, closed) => {
      const n = pts.length, q = i => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
      let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const p0 = q(i - 1), p1 = q(i), p2 = q(i + 1), p3 = q(i + 2);
        const d1 = Math.sqrt(dist(p0, p1)), d2 = Math.sqrt(dist(p1, p2)), d3 = Math.sqrt(dist(p2, p3));
        const c1 = d1 < 1e-4 || d2 < 1e-4 ? p1 : [0, 1].map(k => (d1 * d1 * p2[k] - d2 * d2 * p0[k] + (2 * d1 * d1 + 3 * d1 * d2 + d2 * d2) * p1[k]) / (3 * d1 * (d1 + d2)));
        const c2 = d3 < 1e-4 || d2 < 1e-4 ? p2 : [0, 1].map(k => (d3 * d3 * p1[k] - d2 * d2 * p3[k] + (2 * d3 * d3 + 3 * d3 * d2 + d2 * d2) * p2[k]) / (3 * d3 * (d3 + d2)));
        d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
      }
      return closed ? d + 'Z' : d;
    };
    const arc = (out, c, r, a0, a1, rf) => {   // points after angle a0, up to and including a1
      const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 0.28));
      for (let k = 1; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push(polar(c, a, rf ? rf(a) : r)); }
    };
    const PINCH = 1.1, LIFE = 2.8, CUT = 0.72;   // seconds pulling away; seconds floating; where the stem ends while it lets go
    const free = [];                              // heads that got away: { el, x, y, vx, vy, r, t0, ph }
    let st = { ph: 'grow', t0: 0, dur: 2.2, H: HN, top: 10, big: 14 }, snap = null, last = 0;
    const frame = now => {
      const t = now / 1000, dt = last ? Math.min(0.05, t - last) : 0; last = t;
      const Hh = HN + 6 * wave(t, 9.1, 0.4);                  // how tall
      const lean = 22 + 10 * wave(t, 11.7, 1.2);              // the top drifts off to the left, like the drawing
      const len = 42 + 16 * wave(t, 13.3, 2.0);               // length of the main bends → how many there are
      const fine = 0.5 + 0.5 * wave(t, 7.9, 0.3);             // the shorter bends come and go
      // half-width along the plume: narrower where it comes out of the cup, a full body (like the drawn curl), the head on top
      const widthAt = (u, top) => FOOT * (1 - u) ** 1.5 + top * u * u + BODY * Math.sin(PI * u);
      // the plume up to height H with a head of radius top (the centre line depends only on height, so a shorter
      // plume is exactly the lower part of a taller one)
      const plume = (H, top) => {
        const mid = [], wd = [];
        for (let i = 0; i <= N; i++) {
          const u = i / N, h = u * H, g = smooth(Math.min(1, h / HN * 1.6));
          mid.push([X0 - lean * (h / HN) ** 1.6 + g * (8 * Math.sin(P * (h / len - t / 3.8)) + 4.5 * fine * Math.sin(P * (h / 26 - t / 2.9) + 1.1)), RIM - h]);
          wd.push(widthAt(u, top));
        }
        return { mid, wd, C: mid[N], R: wd[N] };
      };

      let pl, head = null, force = false;
      if (st.ph === 'grow') {
        // the head fills up (and, after a let-go, the stem first grows back to full height)
        const k = clamp((t - st.t0) / st.dur, 0, 1);
        pl = plume(lerp(st.H, Hh, smooth(Math.min(1, (t - st.t0) / 1.2))), lerp(st.top, st.big, smooth(k)));
        if (k >= 1) st = { ph: 'pinch', t0: t, R: pl.R,
          dir: clamp(Math.atan2(pl.C[1] - pl.mid[N - 4][1], pl.C[0] - pl.mid[N - 4][0]), -PI / 2 - 0.5, -PI / 2 + 0.5) };
      }
      if (st.ph === 'pinch') {
        // Starts exactly as the plume was (the head is its top), then the stem's top sinks and narrows while the head
        // eases off upward; the neck between them stretches — sticky — and snaps at the end.
        const k = clamp((t - st.t0) / PINCH, 0, 1), m = smooth(Math.min(1, k / 0.75));
        const full = plume(Hh, st.R), rsT = widthAt(CUT, st.R) * 0.8;
        pl = plume(lerp(Hh, Hh * CUT, m), lerp(st.R, rsT, m));
        const hr = st.R * (1 + 0.05 * k), sEnd = Math.max(4, (rsT + hr) * 1.22 - Hh * (1 - CUT) * 0.8 + 3);
        head = { c: polar(full.C, st.dir, sEnd * (0.3 * smooth(Math.min(1, k / 0.5)) + 0.7 * Math.max(0, (k - 0.5) / 0.5) ** 1.4)), r: hr, dir: st.dir,
          waist: lerp((pl.R + hr) / 2, 0.9, smooth(k) ** 1.2),             // the neck starts as wide as the top, then thins
          wrap: smooth(clamp((k - 0.2) / 0.8, 0, 1)) };                      // …and the head rounds off underneath it
        force = k >= 1;
      }

      // outline: up the left side, over the top, down the right side
      const pts = pl.mid.map(([x, y], i) => [x - pl.wd[i], y]);
      if (head && !force) {
        // stem's sides → a waist on each side, halfway to the head (narrowing) → round the head → waist → stem's side
        // the neck runs along the actual line from the stem's top to the head (the stem keeps swaying while it lets go)
        const D = dist(pl.C, head.c), M = [(pl.C[0] + head.c[0]) / 2, (pl.C[1] + head.c[1]) / 2];
        const ax = D > 0.5 ? clamp(Math.atan2(head.c[1] - pl.C[1], head.c[0] - pl.C[0]), -PI / 2 - 0.6, -PI / 2 + 0.6) : head.dir;
        const nx = Math.cos(ax + PI / 2), ny = Math.sin(ax + PI / 2);                // to the right of it
        const under = head.wrap * Math.min(0.85, Math.asin(clamp((D / 2 - 2) / head.r, 0, 1)));   // stays above the waist
        pts.splice(-4);                                              // the stem's sides stop just short of its top, so they
        //                                                              can't poke out past the head while the stem sways under it
        // the head's sides: level with the stem's while they still overlap, turning with the lean as it pulls away
        const g = smooth(clamp(D / head.r, 0, 1)), a0 = lerp(-PI, ax - PI / 2, g) - under, a1 = lerp(0, ax + PI / 2, g) + under;
        const HL = polar(head.c, a0, head.r), HR = polar(head.c, a1, head.r);
        const EL = pts[pts.length - 1], ER = [pl.mid[N - 4][0] + pl.wd[N - 4], pl.mid[N - 4][1]];
        // the waist starts on the straight line from the stem's side to the head's, and only pulls in as the head leaves
        const w = smooth(clamp((D - 1) / head.r, 0, 1)), mix = (a, b) => [lerp(a[0], b[0], w), lerp(a[1], b[1], w)];
        pts.push(mix([(EL[0] + HL[0]) / 2, (EL[1] + HL[1]) / 2], [M[0] - nx * head.waist, M[1] - ny * head.waist]));
        pts.push(HL);
        arc(pts, head.c, head.r, a0, a1);
        pts.push(mix([(ER[0] + HR[0]) / 2, (ER[1] + HR[1]) / 2], [M[0] + nx * head.waist, M[1] + ny * head.waist]));
      } else {
        const ring = snap ? (() => { const a = t - snap.t, k = 0.35 * Math.exp(-a * 3.2) * Math.cos(a * 12);   // springs shut
          return th => pl.R * (1 + k * Math.max(0, Math.cos(th - snap.dir)) ** 4); })() : null;
        arc(pts, pl.C, pl.R, -PI, 0, ring); pts.pop();
        if (head) {                                                  // the neck has snapped: the head floats off on its own
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          el.setAttribute('class', 'steam-puff'); steam.parentNode.append(el);
          free.push({ el, x: head.c[0], y: head.c[1], vx: Math.cos(st.dir) * 46, vy: Math.sin(st.dir) * 46, r: head.r, t0: t, ph: Math.random() * P });
          snap = { t, dir: st.dir };
          st = { ph: 'grow', t0: t, dur: 1.6 + Math.random() * 1.8, H: Hh * CUT, top: pl.R, big: 12 + Math.random() * 5 };
        }
      }
      for (let i = pl.mid.length - 1 - (head && !force ? 4 : 0); i >= 0; i--) pts.push([pl.mid[i][0] + pl.wd[i], pl.mid[i][1]]);
      steam.setAttribute('d', curve(pts));

      // the heads that got away: drift up and a little left, swell, wobble soft, fade
      for (let i = free.length - 1; i >= 0; i--) {
        const p = free[i], age = (t - p.t0) / LIFE;
        if (age >= 1) { p.el.remove(); free.splice(i, 1); continue; }
        const drag = Math.exp(-1.5 * dt);
        p.vx = p.vx * drag - 5 * dt; p.vy = p.vy * drag - 20 * dt;   // keeps rising, clear of the next head
        p.x += p.vx * dt; p.y += p.vy * dt;
        const r = p.r * (1 + 0.25 * smooth(age)), w = Math.min(1, age * 4);   // the wobble eases in, so letting go is seamless
        // never overlapping the plume: if the stem or the new head reaches it, it's nudged away
        for (let k = N; k >= N / 3; k -= 2) {
          const c = pl.mid[k], dx = p.x - c[0], dy = p.y - c[1], dd = Math.hypot(dx, dy) || 1, gap = r * 1.15 + pl.wd[k] + 2.5 - dd;
          if (gap > 0) { p.x += dx / dd * gap; p.y += dy / dd * gap; }
        }
        const ring = [];
        for (let k = 0; k < 12; k++) { const a = P * k / 12;
          ring.push(polar([p.x, p.y], a, r * (1 + w * (0.07 * Math.sin(2 * a + p.ph + t * 1.7) + 0.05 * Math.sin(3 * a - t * 1.3))))); }
        p.el.setAttribute('d', curve(ring, true));
        p.el.style.opacity = (1 - smooth(clamp((age - 0.25) / 0.75, 0, 1))).toFixed(3);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- Scroll on past the bottom → Projects ----
  // Desktop: the dashboard is one screen, so any deliberate downward scroll continues to Projects.
  // Narrow screens scroll the stacked tiles first; only a NEW gesture made once you're already at the bottom
  // goes on — momentum that merely carried you to the bottom doesn't, so nobody gets thrown off the page.
  // projects.html reads the flag and slides in sideways from the right (see its <head>).
  {
    const NEXT = 'projects.html', WHEEL_NEED = 140, SWIPE_NEED = 90;
    const se = document.scrollingElement, reel = document.getElementById('showreelOverlay');
    const atBottom = () => se.scrollTop + innerHeight >= se.scrollHeight - 2;
    const busy = () => reel && !reel.classList.contains('hidden');   // showreel playing on top
    let bottomSince = Infinity, gestureT = 0, lastT = 0, sum = 0, going = false;
    const track = () => {   // when did we arrive at the bottom? (a page that can't scroll has always been there)
      if (!atBottom()) bottomSince = Infinity;
      else if (se.scrollHeight - innerHeight <= 2) bottomSince = -Infinity;
      else if (bottomSince === Infinity) bottomSince = performance.now();
    };
    const go = () => {
      if (going) return; going = true;
      try { sessionStorage.setItem('vt-from-dash', '1'); } catch {}
      location.href = NEXT;
    };
    addEventListener('scroll', track, { passive: true });
    addEventListener('wheel', e => {
      if (e.ctrlKey || busy()) return;   // ctrlKey = pinch zoom
      track();
      const now = performance.now();
      if (now - lastT > 200) { gestureT = now; sum = 0; }   // a pause starts a new gesture
      lastT = now;
      if (gestureT < bottomSince + 50) return;   // this gesture began before we were at the bottom
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      sum = dy > 0 ? sum + dy : 0;
      if (sum > WHEEL_NEED) go();
    }, { passive: true });
    let y0 = null;
    addEventListener('touchstart', e => {
      y0 = e.touches.length === 1 && atBottom() && !busy() && !e.target.closest('.hang-cal') ? e.touches[0].clientY : null;
    }, { passive: true });
    addEventListener('touchmove', e => { if (y0 !== null && y0 - e.touches[0].clientY > SWIPE_NEED) go(); }, { passive: true });
    addEventListener('pageshow', () => {   // back from Projects (bfcache): ready again
      going = false; sum = 0;
      try { sessionStorage.removeItem('vt-from-dash'); } catch {}
    });
  }

  // ---- Experience + Education: on desktop, one outline round both, pinched in where they meet (two cards stuck
  // together) with a dotted tear line. The cards keep their own layout; this draws the shape behind them.
  // Narrower layouts: two cards. ----
  const expT = document.querySelector('.t-exp'), eduT = document.querySelector('.t-edu'), dash = document.querySelector('.dash');
  if (expT && eduT && dash) {
    const wide = matchMedia('(min-width: 1024px)');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('path-join'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const perf = document.createElementNS('http://www.w3.org/2000/svg', 'path');   // the tear line across the waist: a row of dots
    perf.classList.add('path-perf');
    svg.append(path, perf); dash.prepend(svg);   // first in the dash, so the cards paint over it
    const f = v => v.toFixed(2);
    const draw = () => {
      const D = dash.getBoundingClientRect(), A = expT.getBoundingClientRect(), B = eduT.getBoundingClientRect();
      const on = wide.matches && Math.abs(A.left - B.left) < 1 && Math.abs(A.width - B.width) < 1 && B.top >= A.bottom - 1 && B.top - A.bottom < 40;
      dash.classList.toggle('is-path-joined', on);
      if (!on) return;
      const W = A.width - 1, H = B.bottom - A.top - 1, R = parseFloat(getComputedStyle(expT).borderTopLeftRadius) || 16;
      const h1 = A.height, y2 = B.top - A.top;
      const a = h1 - R, c = y2 + R, m = (h1 + y2) / 2, p = R * 0.55;   // the waist: from a to c, pinched in by p
      const k = 0.55, x0 = 0.5, x1 = W + 0.5, y0 = 0.5, yb = H + 0.5;
      svg.style.left = (A.left - D.left) + 'px'; svg.style.top = (A.top - D.top) + 'px';
      svg.setAttribute('width', W + 1); svg.setAttribute('height', H + 1);
      // one side of the waist, going down (s = +1 right side, -1 left side, mirrored)
      const waist = (x, s, down) => {
        const xi = x - s * p;
        return down
          ? `L${f(x)} ${f(a)} C${f(x)} ${f(a + (m - a) * k)} ${f(xi)} ${f(m - (m - a) * (1 - k))} ${f(xi)} ${f(m)} C${f(xi)} ${f(m + (c - m) * (1 - k))} ${f(x)} ${f(c - (c - m) * k)} ${f(x)} ${f(c)}`
          : `L${f(x)} ${f(c)} C${f(x)} ${f(c - (c - m) * k)} ${f(xi)} ${f(m + (c - m) * (1 - k))} ${f(xi)} ${f(m)} C${f(xi)} ${f(m - (m - a) * (1 - k))} ${f(x)} ${f(a + (m - a) * k)} ${f(x)} ${f(a)}`;
      };
      // a close row of round dots (round caps on zero-length dashes) from one pinch to the other, clear of the
      // outline at both ends; the step stretches a little so the row ends on a dot
      const STEP = 10, from = x0 + p + STEP, to = x1 - p - STEP, n = Math.max(1, Math.round((to - from) / STEP));
      // the line runs half a step past the last dot: a zero-length dash right at a path's end isn't drawn
      perf.setAttribute('d', `M${f(from)} ${f(m)} H${f(to + STEP / 2)}`);
      perf.setAttribute('stroke-dasharray', `0 ${f((to - from) / n)}`);
      path.setAttribute('d',
        `M${f(x0 + R)} ${f(y0)} L${f(x1 - R)} ${f(y0)} A${R} ${R} 0 0 1 ${f(x1)} ${f(y0 + R)} ` + waist(x1, 1, true) +
        ` L${f(x1)} ${f(yb - R)} A${R} ${R} 0 0 1 ${f(x1 - R)} ${f(yb)} L${f(x0 + R)} ${f(yb)} A${R} ${R} 0 0 1 ${f(x0)} ${f(yb - R)} ` +
        waist(x0, -1, false) + ` L${f(x0)} ${f(y0 + R)} A${R} ${R} 0 0 1 ${f(x0 + R)} ${f(y0)} Z`);
    };
    new ResizeObserver(draw).observe(dash);
    [expT, eduT].forEach(el => new ResizeObserver(draw).observe(el));
    wide.addEventListener('change', draw);
    draw();
  }
})();
