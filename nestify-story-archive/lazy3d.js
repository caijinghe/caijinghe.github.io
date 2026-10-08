/* ============================================================
   lazy3d.js — 把 three.js 那条链推迟到首屏之后再下

   用户 2026-09-02：「可以做一下懒加载优化吗」。

   实测（CDP 的 encodedDataLength，不滚动、只等页面安静）：首屏之前共下 11.26MB，
   其中这条链占 853KB。它跟开场影片（hero-frugal.mp4，8.9MB，要立刻播）抢的是
   同一条带宽，所以「让开首屏」这条理由至今成立。

   🔴 但**时机的理由在 2026-09-04 的改版里翻转了**。原文写的是「它唯一的用处是
   hub 里那块 3D 机身，在 20 屏开外」——section 重排之后 hub 紧跟 intro，机身在
   **第 2 段**就要出现（intro 的翻卡直接落到墙上的那台机器上），大约 6 屏。
   而且 intro 那 4 拍是节奏锁的，读者最快 ~5s 就到。

   ⚠️ 必须整条一起推迟，不能只推迟 three.js：
       hub3d.js 在 IIFE 里就读 window.THREE，读不到就把自己永久标成
       {ok:false, why:'no-three'} 退回平面机身，之后 three 再到也不会重试。
   所以顺序照旧 three → nestie-unit → hub3d，只是整体晚一点开始。

   🔴 时机因此改成**三选一，谁先到算谁**（原来只有第一条）：

     ① load 之后的第一个空闲 —— 不滚的读者走这条，行为与改版前一致
     ② 第一次真正滚动 —— 读者已经在往 hub 走了，别再等 load
     ③ 3.5s 硬闸 —— 🔴 这条是必需的：load **要等开场影片下完**（6.7MB，
        preload="auto"），慢网上它可能比读者到达 hub 还晚。只挂 load 等于
        把「机身准时出现」押在带宽上。

   仍然不用 IntersectionObserver 盯 hub：hub3d 要建 WebGL 上下文、编译着色器、
   量 pad 尺寸，等读者滚到跟前才开始会看见机身「后长出来」——现在距离更短，
   这条只会更成立。

   降级：requestIdleCallback 不是所有引擎都有（Safari 长期没有），所以有
   setTimeout 兜底；两条只会触发一次。
   ============================================================ */
(function () {
  const CHAIN = ['vendor/three.js', 'nestie-unit.js?v=588', 'hub3d.js?v=599'];

  let started = false;
  function go() {
    if (started) return;
    started = true;
    /* 顺序加载：后一个依赖前一个已经定义好的全局。用 onload 串起来，
       不能并行——并行的话 hub3d 可能先于 three 执行。 */
    (function next(i) {
      if (i >= CHAIN.length) return;
      const s = document.createElement('script');
      s.src = CHAIN[i];
      s.onload = () => next(i + 1);
      /* 断网/被拦：链就停在这里，hub3d 不会执行，pad 保持平面——
         那正是它自己那条降级分支的效果，不需要额外处理。 */
      s.onerror = () => {};
      document.head.appendChild(s);
    })(0);
  }

  const kick = () => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 2500 });
    else setTimeout(go, 900);
  };

  /* ① load 之后的空闲 */
  if (document.readyState === 'complete') kick();
  else addEventListener('load', kick, { once: true });

  /* ② 第一次滚动就开始——读者已经在往 hub 走了。go() 自带 started 闸，
     三条触发重复调用是安全的。 */
  addEventListener('scroll', go, { once: true, passive: true });

  /* ③ 硬闸：不依赖 load，因为 load 要等 6.7MB 的开场影片下完 */
  setTimeout(go, 3500);
})();
