/* ============================================================
   SMOOTH SCROLL — Lenis, the second half of the zipline answer.

   The first half was distance: a slide costs three viewports of scroll
   (see --slide-span in hero.css), measured off their 10800px pin-spacer.
   This is the other lever they pull. A macOS trackpad does not send you a
   scroll POSITION, it sends a flick and then a long decaying tail of
   momentum events that the browser applies at full weight. Lenis eats the
   raw wheel input and plays the page toward a target instead, so the tail
   is damped rather than obeyed.

   🔴 It stays on the NATIVE scroll position — Lenis writes window.scrollTo
   each frame rather than transforming a wrapper the way Locomotive does.
   That is the whole reason it is safe here: this page is built out of
   position:sticky stages and IntersectionObservers, and both of those read
   the real scroll. A transform-based smoother would have silently broken
   every one of them.

   Loaded FIRST, before the section scripts, so window.lenis exists by the
   time their glide() helpers look for it.
   ============================================================ */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.Lenis) return;   // CDN blocked / offline — the page still works

  const lenis = new Lenis({
    /* 🔴 曾经是「一律用默认值」，理由写在下面，仍然成立、仍然要读：
       Lenis 默认 duration 1.2s + expo-out，那是 zipline 的手感；把它调"跟手"
       很容易一路调回原生的失重感。这是**只治滚轮**的处理，touch 不碰
       （syncTouch 关着）——手机自己的滚动物理已经很好，跟它较劲读起来就是卡。

       🔴 但 1.2s 的尾巴确实太长。用户 2026-09-04 两次提到同一件事：「感觉阻尼
       有点重哦」「那几个屏要多轻快一点」。两次都是在长滚动段（intro / hub）里
       提的——那些段每一屏都要滚很久，1.2s 的缓出叠在一起就成了拖泥带水。

       0.9 是折中：缓出还在（不会回到原生的失重），但尾巴短了四分之一。
       这是**全站**参数，不是只影响那几屏——Lenis 没有分段配置。要再轻就继续
       往下调，但 0.6 以下就基本等于没有平滑了。 */
    smoothWheel: true,
    duration: 0.9,
  });

  window.lenis = lenis;

  (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
})();
