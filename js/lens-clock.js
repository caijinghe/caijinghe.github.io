/**
 * Spiral clock — numerals 1–12 on a ring, distorted like Jinghe's reference: the numeral the hand points at
 * is huge and sheared, and sizes fall away clockwise around the dial, each with its own squash
 * (tall-thin, flat-wide, edge-on) — a spiral, not a symmetric lens. The biggest pushes past the edge.
 *
 *   LensClock(el, { tz, drive: 'hour' | 'minute' | 'second' | 'pointer' | 'fixed', angle, intensity, seconds })
 *   drive 'pointer': follows the cursor's angle while hovering, otherwise the minute hand.
 *   drive 'fixed': lens held at `angle` (30 = pointing at 1, the reference pose).
 * Returns { set(opts) } so the lab page can tune it live.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function LensClock(el, opts = {}) {
    const o = { tz: 'America/New_York', drive: 'minute', angle: 30, intensity: 1, seconds: false, ...opts };
    // Measured from the reference (focus on "1"), stepping clockwise:
    // [height, width, extra slant°, angle after the focus°, distance from centre (viewBox units)]
    // The big numerals take up more of the dial, so the ones after them bunch up (11 and 12 nearly touch).
    const SHAPE = [
      [5.5, 6.2, -26,   0, 119], [5.3, 2.0, -6,  60, 123], [1.9, 3.6, -4, 107, 126], [0.55, 3.3, -8, 148, 135],
      [1.7, 2.6, -4,  176, 131], [2.3, 1.3,  0, 202, 133], [2.5, 0.3,  0, 226, 137], [2.0, 0.9,  0, 248, 139],
      [1.7, 1.4,  0,  265, 136], [1.1, 1.0,  0, 286, 141], [0.75, 1.0, -4, 307, 134], [0.35, 0.95, -10, 310, 141],
    ];
    const C = 150, BASE = 28;   // viewBox 300 × 300, base numeral size

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 300 300');
    svg.setAttribute('role', 'img');
    svg.classList.add('lens-clock');
    el.append(svg);

    const layer = document.createElementNS(NS, 'g');
    svg.append(layer);
    const nums = Array.from({ length: 12 }, (_, i) => {
      const t = document.createElementNS(NS, 'text');
      t.textContent = i + 1;
      t.setAttribute('class', 'lc-num');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('font-size', BASE);
      layer.append(t);
      return { t, a: ((i + 1) % 12) * 30, s: 1 };
    });

    const hand = (cls, len, back) => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('class', cls);
      l.setAttribute('x1', C); l.setAttribute('y1', C + back);
      l.setAttribute('x2', C); l.setAttribute('y2', C - len);
      svg.append(l);
      return l;
    };
    const hh = hand('lc-hand lc-h', 34, 5), mh = hand('lc-hand lc-m', 52, 6), sh = hand('lc-hand lc-s', 64, 12);   // short, like the reference
    const pin = document.createElementNS(NS, 'circle');
    pin.setAttribute('cx', C); pin.setAttribute('cy', C); pin.setAttribute('r', 3.2); pin.setAttribute('class', 'lc-pin');
    svg.append(pin);

    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: o.tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });

    // Pointer angle (degrees from 12, clockwise) while hovering
    let pointer = null;
    el.addEventListener('pointermove', e => {
      if (o.drive !== 'pointer') return;
      const r = svg.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      pointer = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
    });
    el.addEventListener('pointerleave', () => { pointer = null; });

    let lens = null;   // the angle the lens sits at (eased toward its target)
    let top = -1;
    
    function frame() {
      const now = new Date();
      const p = Object.fromEntries(fmt.formatToParts(now).map(x => [x.type, +x.value]));
      const sec = p.second + (reduce ? 0 : now.getMilliseconds() / 1000);
      const aS = sec * 6, aM = (p.minute + sec / 60) * 6, aH = ((p.hour % 12) + p.minute / 60 + sec / 3600) * 30;
      hh.setAttribute('transform', `rotate(${aH} ${C} ${C})`);
      mh.setAttribute('transform', `rotate(${aM} ${C} ${C})`);
      sh.setAttribute('transform', `rotate(${aS} ${C} ${C})`);
      sh.style.display = o.seconds || o.drive === 'second' ? '' : 'none';

      const target = o.drive === 'fixed' ? o.angle : o.drive === 'hour' ? aH : o.drive === 'second' ? aS : o.drive === 'pointer' && pointer != null ? pointer : aM;
      if (lens == null || reduce) lens = target;
      else { let d = ((target - lens + 540) % 360) - 180; lens = (lens + d * (o.drive === 'second' && pointer == null ? 1 : 0.14) + 360) % 360; }

      let best = 0;
      nums.forEach((n, i) => {
        // Clockwise steps from the focus (0 = pointed at), fractional; shape interpolates between table rows
        const k = (((n.a - lens) / 30) % 12 + 12) % 12, k0 = Math.floor(k) % 12, k1 = (k0 + 1) % 12;
        let f = k - Math.floor(k);
        // Just passed by the hand (between the smallest and the biggest shape): collapse quickly,
        // so only one numeral is ever huge
        if (k0 === 11) { const u = Math.min(1, Math.max(0, (f - 0.85) / 0.15)); f = u * u * (3 - 2 * u); }
        const lerp = j => { const a = SHAPE[k0][j], b = j === 3 && k1 === 0 ? 360 : SHAPE[k1][j]; return a + (b - a) * f; };
        const amp = v => 1 + (v - 1) * o.intensity;
        const sy = amp(lerp(0)), sx = amp(lerp(1)), slant = lerp(2) * o.intensity;
        n.s = (sy + sx) / 2;
        const r = lerp(4);
        const rad = (lens + lerp(3)) * Math.PI / 180;           // position comes from the table, not the numeral's own hour
        const x = C + Math.sin(rad) * r, y = C - Math.cos(rad) * r;
        const t = Math.tan(slant * Math.PI / 180);
        // scale, then shear horizontally (glyph stays upright; the slant adds to the italic)
        n.t.setAttribute('transform', `matrix(${sx.toFixed(4)} 0 ${(t * sy).toFixed(4)} ${sy.toFixed(4)} ${x.toFixed(2)} ${y.toFixed(2)})`);
        n.t.setAttribute('x', 0); n.t.setAttribute('y', 0);
        if (n.s > nums[best].s) best = i;
      });
      if (best !== top) {   // biggest numeral draws last (on top)
        top = best;
        [...nums].sort((a, b) => a.s - b.s).forEach(n => layer.append(n.t));
      }
      el.setAttribute('aria-label', `${p.hour % 12 || 12}:${String(p.minute).padStart(2, '0')}`);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    return { set(next) { Object.assign(o, next); top = -1; } };
  }

  window.LensClock = LensClock;
})();
