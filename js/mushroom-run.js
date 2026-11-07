/**
 * Running mushroom — the SVG run cycle from "Mushroom Run.html", cycling through Jinghe's Figma colourways
 * (Figma › CAI'S WEBSITE › mushroom page) while the legs keep running.
 *
 *   MushroomRun(el, { every: 1.8, fade: 0.45, fps: 30 })   // seconds per colourway, crossfade length, run speed (source is 48)
 *
 * How the colours land on a moving drawing: each frame's body is one shape, so the cap is split off with a
 * per-frame outline (precomputed in mushroom-run-data.js). As in the Figma file, the legs sit behind and the cap
 * lies on top with a smooth underside (a vector curve across the neck). Cap and legs take separate fills, and the
 * Figma details (spots, teeth, highlights, checks) ride along with the head, anchored on the eye.
 * Needs js/mushroom-run-data.js loaded first.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BODY_T = 'translate(0 1056) scale(.1 -.1)';
  const EYE0 = [499.77, 224.98];   // frame 0 eye; Figma "run 1" lines up with frame 0 at 4× + (77, 105)
  const CREAM = '#FFFCF2';

  // Colourways, in Figma order. off = this variant's Figma coords → the black-and-white one's.
  const VARIANTS = [
    { name: 'ink', legs: '#111', cap: '#111', patch: '#fff', eye: '#fff', pupil: '#111' },
    { name: 'toadstool', legs: '#F5DC6C', cap: '#E93132', patch: CREAM, eye: CREAM, pupil: '#E93132', off: [1.06, 1.03], spots: 'red' },
    { name: 'checks', patch: null, eye: null, off: [-61.33, -71.19] },
    { name: 'tangerine', legs: '#ACBD6F', cap: '#F16F33', patch: CREAM, eye: CREAM, pupil: '#F16F33', off: [0.73, 0.88], teeth: true },
    { name: 'glass', legs: 'url(#mr-glass)', cap: 'url(#mr-glass)', patch: null, eye: '#fff', pupil: '#A4B6E0', off: [-53.17, -63.54], shine: true },
  ];

  function MushroomRun(el, opts = {}) {
    const D = window.MUSHROOM_RUN; if (!D) return;
    const o = { every: 1.8, fade: 0.45, fps: 30, ...opts };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fig = off => `translate(77 105) scale(4) translate(${off[0]} ${off[1]})`;

    // The two cap spots, swept outward (bottom one down and round the brim tip, top one up): the cap stretches as it
    // runs, so the spots overshoot the edge and the outline trims them — they always reach the edge, no band of red beyond.
    const sweep = (d, dirs) => `<path d="${d}"/>` + dirs.flatMap(([ux, uy]) => [3, 6, 9, 12].map(k => `<path d="${d}" transform="translate(${(ux * k).toFixed(2)} ${(uy * k).toFixed(2)})"/>`)).join('');
    const spots = sweep(D.red[0], [[0, 1], [-0.6, 0.8], [-0.95, 0.3]]) + sweep(D.red[1], [[0, -1], [0.4, -0.9]]);
    const checks = D.checker.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w + 0.2}" height="${h + 0.2}" fill="${c}"/>`).join('');
    const layer = (v, i) => `
      <g class="mr-v" data-i="${i}" opacity="${i ? 0 : 1}" ${i ? 'style="display:none"' : ''}>
        ${v.name === 'checks'
          ? `<g clip-path="url(#mr-bodyclip)"><g class="mr-head" ><g transform="${fig(v.off)}">${checks}</g></g></g>`
          : v.legs === v.cap
            ? `<use href="#mr-body" fill="${v.cap}"/>`
            // legs only outside the cap (a little under it at the neck), so no ring of leg colour shows round the cap's edge
            : `<use href="#mr-body" fill="${v.legs}" mask="url(#mr-legs)"/><g clip-path="url(#mr-cap)"><use href="#mr-body" fill="${v.cap}"${v.spots ? ' mask="url(#mr-nospots)"' : ''}/></g>`}
        ${v.spots ? `<g clip-path="url(#mr-cap)"><g clip-path="url(#mr-bodyclip)"><g class="mr-head"><g transform="${fig(v.off)}" fill="${CREAM}" stroke="${CREAM}" stroke-width="1.2">${spots}</g></g></g></g>` : ''}
        ${v.patch ? `<use href="#mr-patch" fill="${v.patch}"/>` : ''}
        ${v.teeth ? `<g class="mr-head"><g transform="${fig([v.off[0], v.off[1] + 4])}"><path d="${D.mouth}" fill="${v.cap}"/>${D.teeth.map(d => `<path d="${d}" fill="${CREAM}"/>`).join('')}</g></g>` : ''}
        ${v.shine ? `<g class="mr-head"><g transform="${fig(v.off)}" fill="#fff"><path d="${D.blueHl}"/><ellipse cx="215.907" cy="96.6245" rx="3" ry="4" transform="rotate(-22.3969 215.907 96.6245)"/></g></g>` : ''}
        ${v.eye ? `<use href="#mr-eye" fill="${v.eye}"/><use href="#mr-pupil" fill="${v.pupil}"/>` : ''}
      </g>`;

    el.insertAdjacentHTML('beforeend', `<svg class="mushroom-run" viewBox="-24 38 980 980" role="img" aria-label="Running mushroom">
      <defs>
        <path id="mr-body" transform="${BODY_T}"/>
        <path id="mr-patch" transform="${BODY_T}"/>
        <ellipse id="mr-eye" rx="57.25" ry="48.25"/>
        <ellipse id="mr-pupil" rx="35.4" ry="28.66"/>
        <polygon id="mr-capshape"/><path id="mr-neck"/>
        <clipPath id="mr-cap"><use href="#mr-capshape"/><use href="#mr-neck"/></clipPath>
        <mask id="mr-legs" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1400">
          <rect x="-200" y="-200" width="1400" height="1400" fill="#fff"/><use href="#mr-capshape" fill="#000"/><use href="#mr-neck" fill="#000" transform="translate(0 -8)"/>
        </mask>
        <clipPath id="mr-bodyclip"><use href="#mr-body"/></clipPath>
        <!-- no cap colour under the spots (the spots' own cream stroke covers the seam), so no red line where a spot meets the outline -->
        <mask id="mr-nospots" maskUnits="userSpaceOnUse" x="-200" y="-200" width="1400" height="1400">
          <rect x="-200" y="-200" width="1400" height="1400" fill="#fff"/>
          <g class="mr-head"><g transform="${fig(VARIANTS[1].off)}" fill="#000">${spots}</g></g>
        </mask>
        <linearGradient id="mr-glass" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#A9B3E3"/><stop offset=".5" stop-color="#9AA4DA"/><stop offset="1" stop-color="#A7CBE6"/></linearGradient>
        <radialGradient id="mr-shadow"><stop offset="0" stop-color="#000" stop-opacity=".9"/><stop offset=".55" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse class="mr-shadow" fill="url(#mr-shadow)" rx="0" ry="0"/>
      ${VARIANTS.map(layer).join('')}
    </svg>`);
    const svg = el.lastElementChild;
    const $ = s => svg.querySelector(s);
    const body = $('#mr-body'), patch = $('#mr-patch'), eye = $('#mr-eye'), pupil = $('#mr-pupil'), cap = $('#mr-capshape'), neck = $('#mr-neck');
    const heads = [...svg.querySelectorAll('.mr-head')], layers = [...svg.querySelectorAll('.mr-v')];

    // A soft grey shadow on the floor, as under the mushroom in the showreel. Each frame's feet height is measured once;
    // the shadow sits on the lowest line the feet reach and swells / darkens as they come down, shrinks as they lift.
    const shadow = $('.mr-shadow'), probe = document.createElementNS(NS, 'path');
    svg.append(probe);
    const box = D.frames.map(f => { probe.setAttribute('d', f.b); return probe.getBBox(); });   // body path coords (before BODY_T)
    probe.remove();
    const foot = box.map(b => 1056 - 0.1 * b.y), mid = box.map(b => 0.1 * (b.x + b.width / 2)), wide = box.map(b => 0.1 * b.width);
    const ground = Math.max(...foot), lift = Math.max(1, ground - Math.min(...foot));
    const placeShadow = i => {
      const down = 1 - (ground - foot[i]) / lift;   // 1 = feet on the floor, 0 = highest in the stride
      const rx = wide[i] * (0.3 + 0.08 * down);
      shadow.setAttribute('cx', (mid[i] - wide[i] * 0.04).toFixed(1)); shadow.setAttribute('cy', (ground + 6).toFixed(1));
      shadow.setAttribute('rx', rx.toFixed(1)); shadow.setAttribute('ry', (rx * 0.13).toFixed(1));
      shadow.setAttribute('opacity', (0.1 + 0.08 * down).toFixed(3));
    };

    let t = 0, last = 0, cur = -1, incoming = -1;
    function tick(now) {
      if (last && !document.hidden) t += Math.min((now - last) / 1000, 0.05);
      last = now;
      const i = reduce ? 0 : Math.floor(t * o.fps) % D.frames.length, f = D.frames[i];
      if (i !== cur) {
        cur = i;
        body.setAttribute('d', f.b); patch.setAttribute('d', f.d); cap.setAttribute('points', f.c); neck.setAttribute('d', f.n);
        placeShadow(i);
        const dx = f.e[0] - EYE0[0], dy = f.e[1] - EYE0[1];
        heads.forEach(h => h.setAttribute('transform', `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`));
        eye.setAttribute('transform', `translate(${f.e[0]} ${f.e[1]}) rotate(-79.3)`);
      }
      // Pupil wanders a little, as in the original
      const px = f.e[0] - 13 + Math.sin(t * 1.8) * 8, py = f.e[1] - 6 + Math.sin(t * 1.15) * 3;
      pupil.setAttribute('transform', `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(-80.74)`);

      // Colourway crossfade
      const n = VARIANTS.length, k = reduce ? 0 : t / o.every, a = Math.floor(k) % n, b = (a + 1) % n;
      const p = Math.min(1, Math.max(0, (k % 1 - (1 - o.fade / o.every)) / (o.fade / o.every)));
      if (p > 0 && incoming !== b) { incoming = b; svg.append(layers[b]); }   // the incoming colourway fades in on top
      layers.forEach((L, j) => {
        const op = j === a ? 1 : j === b ? p : 0;
        L.style.display = op > 0 ? '' : 'none';
        if (op > 0) L.setAttribute('opacity', j === a ? 1 : op.toFixed(3));
      });
      if (!reduce) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.MushroomRun = MushroomRun;
})();
