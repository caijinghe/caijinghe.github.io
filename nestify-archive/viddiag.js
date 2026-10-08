/* ============================================================
   viddiag.js — 把 hero deck 每个 <video> 的真实状态画在屏幕上

   为什么要有这个文件：用户报「下滑不播、上滑播」报了三轮，我猜了三次
   （preload 不够 → 等 canplay → 被拒后 load()），三次都没中。而
   headless WebKit、iOS 26.3 模拟器都**播得好好的** —— 唯一能复现的机器是
   用户手上那台。猜不动了就把状态打到屏幕上，让那台机器自己说。

   这是 diag.js 那套 ?off= 的同一套路子：不带参数时整个文件是 no-op，
   一行不跑、一个元素不建。

   用法：
     ?vdiag        叠一层实时读数，自己滑，截图给我
     ?vdiag=auto   页面自己往下滚一遍 hero，滚完停住（给模拟器用）

   读数里每个视频一行：
     >0 PLAY rs4 ns1 buf 6.2 t 1.3 auto x1
      1 stop rs0 ns2 buf   - t 0.0 meta x7 ERR:NotAllowedError
      ^ ^    ^   ^   ^       ^     ^    ^  ^
      | |    |   |   |       |     |    |  最后一次 play() 被拒的原因
      | |    |   |   |       |     |    play() 被调了几次
      | |    |   |   |       |     preload 属性当前值
      | |    |   |   |       currentTime
      | |    |   |   缓冲到第几秒（- = 一个字节都没有）
      | |    |   networkState 0空 1闲 2下载中 3没源
      | |    readyState 0无 1有元数据 2有当前帧 3能播 4能播完
      | PLAY = 正在播，stop = 停着
      > = deck 认为这一张是当前张

   第一行的 own= 是 hero.js 自己的判定：own0 表示 deck 认为自己没占住屏幕，
   那样它每帧都会把所有视频 pause 掉，跟视频能不能加载完全无关。
   ============================================================ */
(function () {
  const q = new URLSearchParams(location.search);
  if (!q.has('vdiag')) return;                 // 不带参数 = 什么都不做
  window.__vdiag = true;                       // hero.js 见到它才会暴露内部判定
  const AUTO = q.get('vdiag') === 'auto';

  /* play() 的拒绝理由是这件事的核心证据，而它只在 promise 里出现一次。
     包一层把它记在元素上 —— 不改变任何行为，只是留个证。 */
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const r = nativePlay.apply(this, arguments);
    this.__playTries = (this.__playTries || 0) + 1;
    if (r && r.catch) r.catch(e => { this.__playErr = (e && e.name) || String(e); });
    return r;
  };

  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;margin:0;'
    + 'padding:6px 8px;font:11px/1.35 ui-monospace,Menlo,monospace;'
    + 'background:rgba(0,0,0,.86);color:#0f0;white-space:pre;pointer-events:none;'
    + 'max-width:100vw;text-shadow:0 0 2px #000';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(box));

  const buf = v => { try { return v.buffered.length ? v.buffered.end(v.buffered.length - 1).toFixed(1) : '-'; } catch (e) { return '?'; } };
  const errOf = v => v.error ? ' MEDIA-ERR' + v.error.code : (v.__playErr ? ' ERR:' + v.__playErr : '');

  let peak = 0;
  function render() {
    const vids = [...document.querySelectorAll('.hero__video')];
    const dots = [...document.querySelectorAll('.hero__dot')];
    const idx = dots.findIndex(d => d.classList.contains('is-active'));
    const hero = document.querySelector('.hero');
    const top = hero ? Math.round(hero.getBoundingClientRect().top) : NaN;
    peak = Math.max(peak, scrollY);
    const lines = vids.map((v, i) =>
      `${i === idx ? '>' : ' '}${i} ${v.paused ? 'stop' : 'PLAY'}`
      + ` rs${v.readyState} ns${v.networkState}`
      + ` buf${String(buf(v)).padStart(4)}`
      + ` t${v.currentTime.toFixed(1).padStart(4)}`
      + ` ${(v.getAttribute('preload') || v.preload || '-').slice(0, 4)}`
      + ` x${v.__playTries || 0}`
      + errOf(v));
    const h = window.__hero || {};
    box.textContent = `act${idx} own${h.owned ? 1 : 0} lv${h.leaving ? 1 : 0}`
      + ` top${top} y${Math.round(scrollY)}\n` + lines.join('\n');
  }
  setInterval(render, 250);

  /* 自走：给模拟器用，那边没法用手滑。一屏一屏往下挪，慢到跟真人差不多。 */
  if (AUTO) addEventListener('load', () => {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    let y = hero.offsetTop - innerHeight * 0.5;
    const stop = hero.offsetTop + hero.offsetHeight;
    (function step() {
      if (y > stop) return;
      scrollTo(0, y);
      y += innerHeight * 0.35;
      setTimeout(step, 1400);
    })();
  });
})();
