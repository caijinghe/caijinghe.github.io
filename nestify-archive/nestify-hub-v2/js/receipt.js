// 语音回执（receipt）：小鸟完成一个创建动作后，先亮一张「Completed」回执卡给你看一眼，
// 停 2s，然后沿一条上拱的弧线飞进它在界面上对应的位置（日历里那一格 / 清单里那一行），落位时亮一圈光环。
// 时序对齐 Nestify pad：agent_card_flight.dart（hold 2000ms → flight 600ms emphasized → landing）。落地只飞条目本身、光环贴边，比 pad 更收敛。
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const HOLD = 2000, FLIGHT = 600, LAND = 250;
  const emphasized = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // easeInOutCubicEmphasized 的近似
  const wait = ms => new Promise(r => setTimeout(r, ms));

  /**
   * @param {HTMLElement} stage 1280×800 舞台
   * @param {object} o
   *   action   动作标题，如 "Event created"
   *   preview  回执卡里条目预览的 HTML（长得像它落位后的样子）
   *   details  [[icon, text], …] 细节行
   *   people   头像 HTML 数组
   *   prepare  () => Element  起飞前调用：把目标条目插进界面（先隐藏占位）、滚到可见，返回目标元素
   */
  async function flyReceipt(stage, o) {
    const scale = () => window.__stageScale || 1;
    const S = stage.getBoundingClientRect();
    const local = r => ({ x: (r.left - S.left) / scale(), y: (r.top - S.top) / scale(), w: r.width / scale(), h: r.height / scale() });

    const layer = document.createElement('div');
    layer.className = 'receipt-layer';
    layer.innerHTML = `<div class="receipt">
      <div class="rc-bg"></div>
      <div class="rc-top"><span class="rc-chip badge badge--success badge--lg"><svg viewBox="0 0 16 16"><path d="M3.5 8.4l3 3 6-6.6"/></svg>Completed</span><div class="rc-avs">${o.people.join('')}</div></div>
      <p class="rc-action">${o.action}</p>
      <div class="rc-item">${o.preview}</div>
      <div class="rc-details">${o.details.map(([i, t]) => `<p>${i}<span>${t}</span></p>`).join('')}</div>
    </div>`;
    stage.append(layer);
    const card = layer.firstElementChild;
    stage.dataset.receipt = 'hold';                      // 回执卡停留期间背景保持压暗、模糊

    // 1) 亮相 + 停留
    card.animate([{ opacity: 0, transform: 'translateY(10px) scale(0.94)' }, { opacity: 1, transform: 'none' }],
      { duration: reduce.matches ? 150 : 360, easing: 'cubic-bezier(0.2, 1.5, 0.45, 1)' });
    await wait(HOLD);

    // 2) 解析目标：插入占位、滚到可见，等两帧让布局和滚动生效
    const target = o.prepare();
    await wait(34);
    if (!target) { delete stage.dataset.receipt; card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }); setTimeout(() => layer.remove(), 200); return; }
    await wait(260);

    delete stage.dataset.receipt;                         // 起飞时背景恢复，看得清它飞去哪
    const from = local(card.getBoundingClientRect());
    const to = local(target.getBoundingClientRect());

    if (reduce.matches) {
      card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' }); setTimeout(() => layer.remove(), 150);
      target.classList.remove('rc-awaiting');
      return;
    }

    // 3) 飞行：只让中间那条「条目预览」飞过去（外壳 = 底、Completed、标题、细节在起飞时淡出），
    //    沿二次贝塞尔弧线（控制点 = 中点上抬 min(12% 距离, 64px)），缩到目标宽度，轻微倾斜
    const item = card.querySelector('.rc-item > *') || card;
    const ir = local(item.getBoundingClientRect());
    const c0 = { x: ir.x + ir.w / 2, y: ir.y + ir.h / 2 }, c1 = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const dist = Math.hypot(c1.x - c0.x, c1.y - c0.y), lift = Math.min(dist * .12, 64);
    const ctrl = { x: (c0.x + c1.x) / 2, y: (c0.y + c1.y) / 2 - lift };
    const endScale = Math.min(to.w / ir.w, to.h / ir.h, 1);
    const lean = Math.sign(c1.x - c0.x) || 1;
    const keys = Array.from({ length: 25 }, (_, i) => {
      const p = i / 24, t = emphasized(p), u = 1 - t;
      const x = u * u * c0.x + 2 * u * t * ctrl.x + t * t * c1.x, y = u * u * c0.y + 2 * u * t * ctrl.y + t * t * c1.y;
      const s = 1 + (endScale - 1) * t, rot = Math.sin(Math.PI * t) * .05 * lean;
      return { offset: p, transform: `translate(${x - c0.x}px, ${y - c0.y}px) rotate(${rot}rad) scale(${s})` };
    });
    card.style.transformOrigin = `${c0.x - from.x}px ${c0.y - from.y}px`;
    card.querySelectorAll('.rc-bg, .rc-top, .rc-action, .rc-details').forEach(el =>
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }));
    card.animate(keys, { duration: FLIGHT, fill: 'forwards' });
    await wait(FLIGHT);

    // 4) 落位：预览正好叠在目标上，交叉淡出成真实条目；光环贴着目标轮廓往外扩 5px 后消失
    target.classList.remove('rc-awaiting');
    card.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-out', fill: 'forwards' });
    setTimeout(() => card.remove(), 160);
    const ring = document.createElement('div');
    ring.className = 'rc-ring';
    // 目标可以用 data-ring="上 右 下 左 圆角" 声明光环框哪一块（比如任务行要避开底部分隔线）
    const [it, ir2, ib, il, rr] = (target.dataset.ring || '').split(' ').map(Number);
    const R = target.dataset.ring ? { x: to.x + il, y: to.y + it, w: to.w - il - ir2, h: to.h - it - ib } : to;
    const r0 = target.dataset.ring ? rr : parseFloat(getComputedStyle(target).borderTopLeftRadius) || 12;
    const box = d => ({ left: `${R.x - d}px`, top: `${R.y - d}px`, width: `${R.w + 2 * d}px`, height: `${R.h + 2 * d}px`, borderRadius: `${r0 + d}px` });
    layer.append(ring);
    ring.animate([{ ...box(0), opacity: 0 }, { ...box(2), opacity: 1, offset: .3 }, { ...box(5), opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
    await wait(520);
    layer.remove();
  }

  window.flyReceipt = flyReceipt;
})();
