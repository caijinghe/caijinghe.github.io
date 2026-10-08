/* ============================================================
   snap.js — 手机上按「拍」吸附（scroll-snap），只管 DOM，不懂任何时间轴

   用户 2026-09-02：「感觉整体的阻力不足够人看完某个动画…感觉不够 smooth」。

   🔴 诊断：加距离解决不了这个问题。距离只改变「一段要划几次」，不改变**一次
   划动之内**发生什么，而手机上一次划动的动量一瞬间就能走两三个视口。两段的
   失败方式还正好相反：

       hub    const p = progress()  —— 1:1 直读，没有阻尼也没有限速。
              一次快划，五句标题可以全部演完。
       meet   带阻尼，且 WORD_SPEED = 1.0 视口/秒是**硬上限**。
              划动走了 2 个视口，播放头要 2 秒才追得上，而舞台早滚过去了。
              这个滞后本身就是「不顺」的手感。

   也就是说：播放速度不由读者控制，由动量控制。吸附把模型从「擦洗」改成
   「翻页」——一次划动落在一拍的边界上，而不是任意位置。因为播放头是滚动位置
   的函数，落在边界就等于这一拍正好演完。

   🔴 proximity，不是 mandatory。整页 44 屏，强制吸附会把读者困住——想快速
   划过去的人每一拍都要被拽一下。proximity 只在停得够近时才吸。

   🔴 只在手机上。桌面由 Lenis 接管滚动（smooth.js），它会**用脚本写
   scrollTop**，跟原生吸附是两套东西抢同一个量，凑在一起会互相打架。
   Lenis 在手机上是关着的（syncTouch off，触摸交回原生），所以这里安全。

   ⚠️ 本文件**不计算任何边界**。每一段把自己的边界算好传进来，因为只有它们
   知道自己的时间轴——这个仓库已经因为「两个地方各存一份同样的数」出过事故
   （hub 的 ROOM_AT 漏了跟 range 一起换算，换墙点跑到 thesis 前面去了）。
   ============================================================ */
(function () {
  if (!matchMedia('(max-width: 767px)').matches) return;

  const jobs = [];

  /* host  —— 锚点挂在谁身上（必须是 position: relative/absolute 的定位元素）
     produce() —— 返回一组「相对 host 顶边的 px」，每个值一个吸附点 */
  window.snapAt = function (host, produce) {
    if (!host || typeof produce !== 'function') return;
    jobs.push({ host, produce });
    paint(jobs[jobs.length - 1]);
  };

  function paint(job) {
    let list;
    try { list = job.produce(); } catch (e) { return; }
    if (!list || !list.length) return;
    /* 只清自己建的，别碰段落里别的东西 */
    job.host.querySelectorAll(':scope > .snap-pt').forEach(e => e.remove());
    const frag = document.createDocumentFragment();
    for (const y of list) {
      if (!isFinite(y) || y < 0) continue;
      const i = document.createElement('i');
      i.className = 'snap-pt';
      i.setAttribute('aria-hidden', 'true');
      i.style.top = Math.round(y) + 'px';
      frag.appendChild(i);
    }
    job.host.appendChild(frag);
  }

  /* 段高会随视口变（全是 svh），所以转屏/改窗要重放一次。
     🔴 防抖：吸附点的重建会动 DOM，而 resize 在 iOS 上工具栏收放时会连发。 */
  let t = 0;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => jobs.forEach(paint), 220);
  });
})();
