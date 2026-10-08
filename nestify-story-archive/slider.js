// Deck animation — verbatim from wisprflow.ai's inline [testimonials] embed.
// Cards ride a cylinder: each pitches on rotateX around a pivot pushed ORBIT_CARD_PCT
// behind it, and horizontal spacing is integrated so the perspective shrink never
// changes the on-screen gap. Native page scroll drives the deck head.

  (function () {
var SEL_HEIGHT = '.testiv2_height';
var SEL_TRACK = '.testiv2_wrap';
var SEL_CARD = '.testiv2_card';

var GAP_PCT = 14;
var GAP_GROW_PCT = 0;
var GAP_FROM_PX = 1920;
var GAP_PCT_MOBILE = 22;
var GAP_MIN_PX = 32;
var GAP_MAX_PX = 160;
var GAP_PER_PAIR = false;
var SPACING_MODE = 'pitch';
var EXIT_PAD_PCT = 12;
var SCROLL_RATIO = 0.85;
var SET_HEIGHT = true;

var ORBIT_CARD_PCT = 65;
var ORBIT_MIN_PX = 220;
var PERSP_CARD_PCT = 260;
var ROT_IN = -50;
var ROT_OUT = 50;
var ROT_EASE = 'power1.inOut';
var ROT_SPAN_PCT = 210;

var DECK_SCALE_GROW = 0.55;
var DECK_FROM_PX = 1920;
var DECK_SCALE_MAX = 2;

var CENTER_VH = 50;
var CENTER_VH_MOBILE = 50;
var MIN_W = 768;
var LEAD_TRIM = true;

function attr(el, name) {
  var host = el.closest('[' + name + ']');
  if (!host) {
    return null;
  }
  var v = parseFloat(host.getAttribute(name));
  return isNaN(v) ? null : v;
}

function init() {
  if (typeof window.gsap === 'undefined') {
    console.warn('[testimonials] GSAP required before this script.');
    return;
  }

  var wrap = document.querySelector(SEL_HEIGHT);
  var track = wrap && wrap.querySelector(SEL_TRACK);
  if (!wrap || !track) {
    console.warn('[testimonials] need ' + SEL_HEIGHT + ' with a ' + SEL_TRACK + ' inside');
    return;
  }
  var cards = Array.prototype.slice.call(track.querySelectorAll(SEL_CARD));
  if (!cards.length) {
    console.warn('[testimonials] no ' + SEL_CARD + ' children inside ' + SEL_TRACK);
    return;
  }

  var paintFromScroll = function () {};

  function build() {
    var vw = window.innerWidth;
    var mobile = vw < MIN_W;
    var gapPct = attr(wrap, mobile ? 'data-gap-mobile' : 'data-gap');
    if (gapPct == null) {
      gapPct = mobile ? GAP_PCT_MOBILE : GAP_PCT;
    }
    var gapGrow = attr(wrap, 'data-gap-grow');
    if (gapGrow == null) {
      gapGrow = GAP_GROW_PCT;
    }
    var centerVh = attr(wrap, mobile ? 'data-center-mobile' : 'data-center');
    if (centerVh == null) {
      centerVh = mobile ? CENTER_VH_MOBILE : CENTER_VH;
    }
    var scrollRatio = attr(wrap, 'data-scroll-ratio');
    if (scrollRatio == null) {
      scrollRatio = SCROLL_RATIO;
    }
    var orbitPct = attr(wrap, 'data-orbit');
    if (orbitPct == null) {
      orbitPct = ORBIT_CARD_PCT;
    }
    var modeHost = wrap.closest('[data-spacing]');
    var mode = modeHost ? modeHost.getAttribute('data-spacing') : SPACING_MODE;

    cards.forEach(function (card) {
      card.style.position = 'absolute';
      card.style.left = '50%';
      card.style.top = centerVh + 'vh';
      // 🔴 NEITHER backface-visibility: hidden NOR transform-style: preserve-3d.
      // Between them they are what turned every card's rounded corners black.
      // Both force this subtree onto its own composited layer, and the corner
      // the child's border-radius clips away is then cleared to BLACK rather
      // than to transparent, because the layer is rasterised as opaque — no
      // alpha channel to clear to. Chrome only needed backface-visibility gone;
      // WebKit trips on preserve-3d as well, which is why the corners survived
      // the first pass in Safari.
      //
      // Neither was doing any work:
      //   · backface — the cards pitch between ROT_IN and ROT_OUT, -50°..+50°,
      //     so a backface never faces the viewer.
      //   · preserve-3d — it only means "lay my CHILDREN out in my 3D space",
      //     and this card has no such children. Probed every descendant of a
      //     .testiv2_card: not one has a transform that uses the third
      //     dimension. The card's OWN rotateX is unaffected — that is projected
      //     by the `perspective` on .testiv2_wrap, its parent, which is
      //     untouched here.
      //
      // The layer promotion both were really there for is on the line below,
      // which is the property that actually means it.
      /* 🔴 手机上不设 will-change（用户 2026-08-30 的崩溃排查）。它是**内联**
         设的，所以 CSS 里的媒体查询压不住，只能在这里分流。
         will-change 会强制合成器预先给每张卡建一层，而这六张卡在手机上被排到
         最大 1263×304——按 DPR 3 估算六张合计约 39MB GPU 纹理，且它们多数时间
         并不在动。去掉只是去掉一个提示，动画照常。桌面保留。 */
      if (!matchMedia('(max-width: 767px)').matches) card.style.willChange = 'transform';
      card.style.margin = '0';
    });

    var scaleGrow = attr(wrap, 'data-deck-grow');
    if (scaleGrow == null) {
      scaleGrow = DECK_SCALE_GROW;
    }
    var deckScale = mobile ? 1 : Math.min(DECK_SCALE_MAX, Math.max(1, 1 + (vw / DECK_FROM_PX - 1) * scaleGrow));

    // offsetWidth, not getBoundingClientRect: a rotated card's rect is its projected bbox.
    var widths = cards.map(function (c) {
      return (c.offsetWidth || 1) * deckScale;
    });
    var maxW = Math.max.apply(null, widths);
    var sorted = widths.slice().sort(function (a, b) {
      return a - b;
    });
    var medW = sorted[Math.floor(sorted.length / 2)];

    var wideBonus = (Math.max(0, vw - GAP_FROM_PX) * gapGrow) / 100;
    function gapFor(w) {
      return Math.min(GAP_MAX_PX, Math.max(GAP_MIN_PX, (w * gapPct) / 100 + wideBonus));
    }
    var gapPx = gapFor(medW);
    var offsets = [0];
    for (var i = 1; i < cards.length; i++) {
      var pairW = (widths[i - 1] + widths[i]) / 2;
      var gap = GAP_PER_PAIR ? gapFor(pairW) : gapPx;
      offsets[i] = offsets[i - 1] + pairW + gap;
    }
    var spanPx = offsets[offsets.length - 1];

    var travelHalf = (vw + maxW) / 2 + (maxW * EXIT_PAD_PCT) / 100;

    var orbitPx = Math.max(ORBIT_MIN_PX, (medW * orbitPct) / 100);
    var perspPx = (medW * PERSP_CARD_PCT) / 100;
    track.style.perspective = perspPx + 'px';
    gsap.set(cards, {
      xPercent: -50,
      yPercent: -50,
      scale: deckScale,
      transformOrigin: '50% 50% -' + orbitPx + 'px',
      force3D: true,
    });

    var rotEase = gsap.parseEase(ROT_EASE);
    var RAD = Math.PI / 180;
    var raw = mode === 'off';

    var rotSpanPct = attr(wrap, 'data-rot-span');
    if (rotSpanPct == null) {
      rotSpanPct = ROT_SPAN_PCT;
    }
    var rotHalf = rotSpanPct ? (medW * rotSpanPct) / 100 : travelHalf;
    function rotAt(sx) {
      var p = (sx + rotHalf) / (rotHalf * 2);
      p = p < 0 ? 0 : p > 1 ? 1 : p;
      return ROT_IN + (ROT_OUT - ROT_IN) * rotEase(p);
    }
    function shrinkAt(sx) {
      var depth = orbitPx * (1 - Math.cos(rotAt(sx) * RAD));
      return perspPx / (perspPx + depth);
    }
    function stretchAt(sx) {
      var f = shrinkAt(sx);
      if (mode === 'gap') {
        return (medW * f + gapPx) / (medW + gapPx);
      }
      if (mode === 'scale') {
        return f;
      }
      return 1;
    }

    var STEP = 4;
    var LIMIT = travelHalf * 1.2;
    function integrate(dir) {
      var tbl = [0],
        s = 0,
        guard = 0;
      while (Math.abs(s) < LIMIT && guard++ < 20000) {
        s += dir * STEP * stretchAt(s);
        tbl.push(s);
      }
      return tbl;
    }
    var sPos = integrate(1);
    var sNeg = integrate(-1);
    function screenAt(u) {
      var tbl = u >= 0 ? sPos : sNeg;
      var k = Math.abs(u) / STEP;
      var i0 = Math.floor(k);
      if (i0 >= tbl.length - 1) {
        var last = tbl.length - 1;
        var slope = (tbl[last] - tbl[last - 1]) / STEP;
        return tbl[last] + (Math.abs(u) - last * STEP) * slope;
      }
      return tbl[i0] + (tbl[i0 + 1] - tbl[i0]) * (k - i0);
    }

    function render(head) {
      for (var j = 0; j < cards.length; j++) {
        var u = head - offsets[j];
        var sx = raw ? u : screenAt(u);
        var rot = rotAt(sx);
        var f = shrinkAt(sx);
        cards[j]._x = sx;
        cards[j]._f = f;
        cards[j]._r = rot;
        gsap.set(cards[j], { x: raw ? u : sx / f, rotateX: rot });
      }
      restack();
    }

    function restack() {
      var order = cards.slice().sort(function (a, b) {
        return Math.abs(a._x) - Math.abs(b._x);
      });
      order.forEach(function (card, rank) {
        card.style.zIndex = order.length - rank;
      });
    }

    var headStart = LEAD_TRIM ? 0 : -travelHalf;
    var headEnd = LEAD_TRIM ? Math.max(1, spanPx) : spanPx + travelHalf;

    if (SET_HEIGHT) {
      var trackH = track.offsetHeight || window.innerHeight;
      wrap.style.height = Math.round(trackH + (headEnd - headStart) * scrollRatio) + 'px';
    }

    /* Lenis already smooths native scroll. Derive the head from the current
       position on every scroll, including jumps across the entire track.
       This also keeps rebuilds at the footer on the final card. */
    var lastHead = NaN;
    paintFromScroll = function () {
      var room = Math.max(1, wrap.offsetHeight - window.innerHeight);
      var p = Math.max(0, Math.min(1, -wrap.getBoundingClientRect().top / room));
      var head = headStart + (headEnd - headStart) * p;
      if (Math.abs(head - lastHead) < 0.25) return;
      lastHead = head;
      render(head);
    };
    paintFromScroll();
    wrap.__testiInfo = { mode: mode, gapPx: Math.round(gapPx), medW: Math.round(medW), orbit: Math.round(orbitPx), scale: deckScale };
  }

  wrap.__testiRebuild = build;
  build();
  window.addEventListener('scroll', function () { paintFromScroll(); }, { passive: true });

  var lastW = window.innerWidth,
    rebuildTimer = null;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) {
      return;
    }
    lastW = window.innerWidth;
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(function () {
      build();
    }, 200);
  });

  function relayout() {
    build();
  }
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(relayout);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
  })();
