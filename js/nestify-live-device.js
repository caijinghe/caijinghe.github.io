/* Nestify hero：3D 机身 + 屏幕里实时运行的新版 pad UI，自动演示一圈主要交互。
   样式见 css/nestify-live-device.css。

   机身：nestify-archive 那台（nestie-unit.js），小视角透视相机正面渲染一次——和展示视频同一套
   参数，所以看得到边框的厚度和那圈高光。之后整台机器（画布 + 屏幕）一起用 CSS 3D 轻轻晃，
   机身不用每帧重画，屏幕也永远和开口对齐。

   演示：屏幕里的页面和本页同源，直接在它的 DOM 上派发点击 / 拖拽 / 滚动，旁边一个手指圆点
   标出点在哪。顺序照展示视频：控制中心 → Family 语音建事件 → Personal 语音领任务 → 勾任务
   攒金币 → Claim → Redeem 庆祝 → Rewards 浮层 → Calendar 周 / 日 + 事件详情 → Tasks 两条
   完成 → Meals 翻一翻 → 屏保。一圈完了重新载入页面（状态复位）再来。
   只看不点：iframe 不接收指针（css），演示不会被访客打断。
   整体比真实节奏快 1.25 倍：这里的等待和手指移动 × SPEED，屏幕里 proto 自己的计时器
   （小鸟听写 / 思考 / 说话那一串都是 setTimeout）在载入后也按同一倍率缩短。 */
    const SPEED = 0.8;
(() => {
    const root = document.querySelector('.nestify-live');
    if (!root) return;
    const canvas = root.querySelector('.nestify-live__gl');
    const screen = root.querySelector('.nestify-live__screen');
    const app = root.querySelector('.nestify-live__app');
    const poster = root.querySelector('.nestify-live__poster');
    const THREE = window.THREE, U = window.NestieUnit;
    const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 几何：容器 = 机身外扩一点（留给透视下边框的厚度和高光） ---------- */
    const D = U ? U.DIMS : { SCREEN_W: 1.6, SCREEN_H: 1, SCREEN_R: 0.0352, BODY_W: 1.792, BODY_H: 1.192, FRONT: 0.06 };
    const PAD_X = 1.05, PAD_Y = 1.075;
    const VIEW_W = D.BODY_W * PAD_X, VIEW_H = D.BODY_H * PAD_Y;
    root.style.setProperty('--body-ar', (VIEW_W / VIEW_H).toFixed(4));
    root.style.setProperty('--scr-l', ((VIEW_W - D.SCREEN_W) / 2 / VIEW_W * 100).toFixed(3) + '%');
    root.style.setProperty('--scr-t', ((VIEW_H - D.SCREEN_H) / 2 / VIEW_H * 100).toFixed(3) + '%');
    root.style.setProperty('--scr-w', (D.SCREEN_W / VIEW_W * 100).toFixed(3) + '%');
    root.style.setProperty('--scr-h', (D.SCREEN_H / VIEW_H * 100).toFixed(3) + '%');

    let ready3d = !THREE || !U, readyPoster = false;
    const maybeIn = () => {
        if (ready3d && readyPoster) requestAnimationFrame(() => root.classList.add('is-in'));
    };
    if (poster.complete) readyPoster = true; else poster.addEventListener('load', () => { readyPoster = true; maybeIn(); });

    /* ---------- 机身 ---------- */
    let draw = () => {};
    if (THREE && U) {
        try {
            const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.04;
            renderer.outputColorSpace = THREE.SRGBColorSpace;
            const scene = new THREE.Scene();
            scene.environment = U.makeEnvironment(THREE, renderer);
            scene.add(U.makeKey(THREE));
            scene.add(U.makeUnit(THREE).unit);
            /* 18° 视角，屏幕所在平面（z = FRONT）恰好铺满 VIEW_H——屏幕开口因此正好落在上面算的百分比上 */
            const FOV = 18;
            const camera = new THREE.PerspectiveCamera(FOV, VIEW_W / VIEW_H, 0.01, 50);
            camera.position.set(0, 0, D.FRONT + VIEW_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
            draw = () => {
                const w = canvas.clientWidth, h = canvas.clientHeight;
                if (!w || !h) return;
                renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
                renderer.setSize(w, h, false);
                renderer.render(scene, camera);
                if (!ready3d) { ready3d = true; maybeIn(); }
            };
        } catch (e) {
            ready3d = true;
            console.warn('[nestify-live] no WebGL — showing the screen without the 3D housing', e);
        }
    }

    /* ---------- 屏幕缩放 ---------- */
    let K = 0.5;   // iframe px → 屏幕 px
    const fit = () => {
        const w = screen.clientWidth;
        if (!w) return;
        K = w / 1920;
        root.style.setProperty('--app-k', K.toFixed(5));
        // 圆角略小于机身开口（×0.8），把开口边缘那圈深色缝盖住
        root.style.setProperty('--scr-r', (D.SCREEN_R / D.SCREEN_W * w * 0.8).toFixed(2) + 'px');
        draw();
    };
    new ResizeObserver(fit).observe(root);
    fit();
    maybeIn();

    /* ---------- 手指 ---------- */
    const dot = document.createElement('div');
    dot.className = 'nestify-live__finger';
    dot.innerHTML = '<i></i>';
    screen.appendChild(dot);
    let fx = 0.5 * 1920, fy = 1.2 * 1200;   // iframe px

    /* ---------- 演示 ---------- */
    let win = null, doc = null, P = null;
    let run = 0;            // 每一轮一个编号；暂停 / 重来时旧的那一轮自己退出
    let visible = true;
    const alive = id => id === run;
    async function wait(ms, id) {
        const end = performance.now() + ms * SPEED;
        // 滚出视野 / 切走标签页时停在这里，回来接着演
        while (performance.now() < end || !visible || document.hidden) {
            if (!alive(id)) throw 0;
            await new Promise(r => setTimeout(r, 50));
        }
        if (!alive(id)) throw 0;
    }
    const $ = (sel, i = 0) => doc.querySelectorAll(sel)[i] || null;
    const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    const place = (x, y, on) => {
        fx = x; fy = y;
        dot.style.transform = `translate(${x * K}px, ${y * K}px)`;
        dot.classList.toggle('is-on', on);
    };
    async function moveTo(x, y, id, ms = 420) {
        ms *= SPEED;
        const x0 = fx, y0 = fy, t0 = performance.now();
        dot.classList.add('is-on');
        while (true) {
            const u = Math.min(1, (performance.now() - t0) / ms), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            place(x0 + (x - x0) * e, y0 + (y - y0) * e, true);
            if (u >= 1) break;
            await new Promise(r => requestAnimationFrame(r));
            if (!alive(id)) throw 0;
        }
    }
    const fire = (el, type, x, y, Ctor = win.PointerEvent || win.MouseEvent) =>
        el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true, view: win }));
    async function tap(target, id, opts = {}) {
        const el = typeof target === 'string' ? $(target, opts.nth || 0) : target;
        if (!el) return;
        const [x, y] = center(el);
        await moveTo(x + (opts.dx || 0), y + (opts.dy || 0), id, opts.ms);
        dot.classList.remove('is-tap'); void dot.offsetWidth; dot.classList.add('is-tap');
        fire(el, 'pointerdown', x, y);
        await wait(70, id);
        fire(el, 'pointerup', x, y);
        fire(el, 'click', x, y, win.MouseEvent);
    }
    const hide = () => dot.classList.remove('is-on');
    async function scrollEl(el, by, id, ms = 900) {
        if (!el) return;
        ms *= SPEED;
        const [x, y] = center(el);
        await moveTo(x, y, id, 300);
        const s0 = el.scrollTop, t0 = performance.now();
        while (true) {
            const u = Math.min(1, (performance.now() - t0) / ms), e = 1 - Math.pow(1 - u, 3);
            el.scrollTop = s0 + by * e;
            place(x, y - 60 * e, true);
            if (u >= 1) break;
            await new Promise(r => requestAnimationFrame(r));
            if (!alive(id)) throw 0;
        }
    }
    const go = sid => doc.querySelector(`.switcher button[data-to="${sid}"]`)?.click();
    async function voiceDone(id, extra) {
        const n = P.voices.nestie;
        await wait(600, id);
        while (n && n.state !== 'idle') await wait(150, id);
        await wait(extra, id);
    }
    async function pullControlCenter(id) {
        const stage = doc.getElementById('stage');
        const x = 960, y = 18;
        await moveTo(x, y, id);
        fire(stage, 'pointerdown', x, y);
        for (let i = 1; i <= 20; i++) {
            fire(stage, 'pointermove', x, y + i * 24);
            place(x, y + i * 24, true);
            await wait(16, id);
        }
        fire(stage, 'pointerup', x, y + 480);
        hide();
        await wait(1900, id);
        await tap('.cc-scrim', id, { dy: 360 });
        hide();
    }

    async function tour(id) {
        await wait(1500, id);
        // Family：控制中心 → 语音建一个事件，回执卡飞进日历
        await pullControlCenter(id);
        await wait(600, id);
        await tap('.nestie', id); hide();
        await voiceDone(id, 3000);
        // Personal：语音领任务 → 勾任务攒金币 → Claim → Redeem → Rewards 浮层
        go('s2');
        await wait(1300, id);
        await tap('.nestie', id); hide();
        await voiceDone(id, 3000);
        await tap('#s2 .checklist li:not(.done) .check', id); await wait(900, id);
        await tap('#s2 .checklist li:not(.done) .check', id); await wait(1000, id);
        await tap('#s2 .grabs .grab .pill-btn', id); await wait(1000, id);
        await tap('#s2 .reward[data-id="ice-cream"] .redeem', id); hide();
        await wait(2600, id);
        await tap('.celebrate', id, { dy: -260 }); hide();
        await wait(600, id);
        await tap('#s2 .rewards .card-title', id); hide();
        await wait(1200, id);
        await scrollEl($('.rw-modal .rw-body'), 360, id);
        await wait(300, id);
        await tap('.rw-modal .rw-seg button[data-cat="fun"]', id);
        await wait(1100, id);
        await tap('.rw-collapse', id); hide();
        await wait(800, id);
        // Calendar：周视图点一个事件 → 切到日视图再点一个 → 回到周
        await tap('#s2 .nav[aria-label="Calendar"]', id); hide();
        await wait(1300, id);
        await tap('#s3 .cp-grid-in:last-child .cp-ev', id, { nth: 5 });
        await wait(1700, id);
        await tap('#s3 .cp-seg button[data-view="day"]', id);
        await wait(1300, id);
        await tap('#s3 .cp-grid-in:last-child .cp-ev', id, { nth: 2 });
        await wait(1700, id);
        await tap('#s3 .cp-seg button[data-view="week"]', id); hide();
        await wait(1000, id);
        // Tasks：两条点开、标记完成
        await tap('#s3 .nav[aria-label="Tasks"]', id); hide();
        await wait(1400, id);
        await tap('#s4 .tk-row:not(.done)', id); await wait(1000, id);
        await tap('#s4 .tk-pop-btn', id); await wait(1000, id);
        await tap('#s4 .tk-row:not(.done)', id, { nth: 2 }); await wait(1000, id);
        await tap('#s4 .tk-pop-btn', id); hide();
        await wait(1100, id);
        // Meals：两栏各滑一下
        await tap('#s4 .nav[aria-label="Meals"]', id); hide();
        await wait(1300, id);
        await scrollEl($('#s7 .ml-grid'), 520, id, 1300);
        await wait(300, id);
        await scrollEl($('#s7 .ml-list'), 360, id, 1000); hide();
        await wait(900, id);
        // 屏保
        go('s6');
        await wait(4500, id);
    }

    /* 每一轮从干净的页面开始：先让静图盖住，重新载入，载好了淡入再演 */
    function restart() {
        const id = ++run;
        hide();
        root.classList.remove('is-live');
        setTimeout(() => {
            if (!alive(id)) return;
            app.addEventListener('load', () => {
                if (!alive(id)) return;
                win = app.contentWindow; doc = app.contentDocument; P = win.__proto;
                // 小鸟说话时保留 proto 原样的虚化压暗（Archive 那块屏关掉了，见 hub-v2-embed.css）
                doc.documentElement.classList.add('keep-voice-dim');
                // proto 的计时器同样快 1.25 倍
                const st = win.setTimeout.bind(win), si = win.setInterval.bind(win);
                win.setTimeout = (fn, ms, ...a) => st(fn, (ms || 0) * SPEED, ...a);
                win.setInterval = (fn, ms, ...a) => si(fn, (ms || 0) * SPEED, ...a);
                setTimeout(() => {
                    if (!alive(id)) return;
                    root.classList.add('is-live');
                    if (!P || REDUCED) return;      // 减弱动效：只放实时 UI，不自动演示
                    tour(id).then(() => alive(id) && restart(), () => {});
                }, 500);
            }, { once: true });
            app.src = app.dataset.src;
        }, root.classList.contains('is-live') ? 650 : 0);
    }

    new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.15 }).observe(root);

    const boot = () => setTimeout(restart, 300);
    if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
})();
