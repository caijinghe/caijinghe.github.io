/* ============================================================
   DIAG — 用 URL 参数关掉页面的某一块，用来二分定位崩溃源
   ============================================================
   起因（2026-08-30）：手机上滑过 meet 进 hub 必崩，而我这边（Mac / iOS 模拟器
   / headless）**三个环境都复现不了**——内存与显存上限和 iPhone 不是一回事。
   于是变成「我猜一刀 → 用户的手机崩一次 → 排除一个」，一晚上砍了模糊、WebGL、
   视频、合成层、perspective 六轮仍未收敛，而每一轮的代价都是真人的设备崩溃。

   这个文件把那个循环换成二分：用户改 URL 就能关掉一整块，两三次刷新定位到段。

   用法（可叠加，逗号分隔）：
     ?off=cards    meet 的 12 张卡不创建
     ?off=meet     整个 meet 段不显示
     ?off=hub      整个 hub 段不显示
     ?off=rive     Rive 小鸟不启动
     ?off=video    所有 <video> 不加载
     ?off=hero     hero deck 不显示
     例：?off=cards,video

   🔴 不带参数时**完全是 no-op**，一行都不执行——所以它可以留在生产里，
   定位完直接用就行，不需要为了诊断单独发一版。
   🔴 关掉的方式一律是「不创建 / 不显示」，不是「创建了再隐藏」——隐藏省不下
   GPU 纹理，那正是我们在找的东西。
   ============================================================ */
(function () {
  var off = new URLSearchParams(location.search).get('off');
  if (!off) return;                       // 无参数 = 完全不介入
  var set = off.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var has = function (k) { return set.indexOf(k) >= 0; };
  window.__diagOff = set;

  var css = [];
  if (has('meet'))  css.push('#meet-nestie{display:none!important}');
  if (has('hub'))   css.push('.hub{display:none!important}');
  if (has('hero'))  css.push('.hero{display:none!important}');
  if (has('cards')) css.push('.meet__cards{display:none!important}');
  if (css.length) {
    var st = document.createElement('style');
    st.textContent = css.join('\n');
    document.head.appendChild(st);
  }

  /* video：在元素进入 DOM 之前就把 src 摘掉，这样字节根本不下载、
     解码管线也不会建。用 MutationObserver 而不是等 DOMContentLoaded——
     hero.js / intro.js 都是运行时插入 <video> 的。 */
  if (has('video')) {
    var strip = function (v) {
      try { v.pause(); } catch (e) {}
      v.removeAttribute('src'); v.removeAttribute('poster');
      v.preload = 'none';
      try { v.load(); } catch (e) {}
    };
    document.querySelectorAll('video').forEach(strip);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (n.tagName === 'VIDEO') strip(n);
          else if (n.querySelectorAll) n.querySelectorAll('video').forEach(strip);
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* rive：把全局构造器换成空实现。必须在 nestie.js / meet.js 跑之前，
     所以这个文件要排在它们前面（见 index.html 的加载顺序）。 */
  if (has('rive')) {
    Object.defineProperty(window, 'rive', {
      value: { Rive: function () { return { play: function(){}, pause: function(){},
        cleanup: function(){}, resizeDrawingSurfaceToCanvas: function(){} }; } },
      writable: false, configurable: true,
    });
  }

  console.warn('[diag] 已关闭:', set.join(', '));
})();
