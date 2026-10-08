/* ============================================================
   THE HUB'S DOCKED UNIT — the home page, at the moment the demo
   ends and the device settles onto the wall.

   🔴 IT ONLY EXISTS WHILE THE SECTION IS DOCKED, and that is the
   whole reason it can exist at all. For the length of the demo the
   pad is a LIVE DOM UI — six scenes, a rail, cards flying between
   them, all driven by hub.js across a 620svh track — and no WebGL
   canvas can hold HTML. There is no version of this that frames the
   running demo.

   But the demo ends. At `.hub.is-docked` the pad shrinks onto the
   wall photograph, the caption is dismissed, the scene stops
   changing: what is left is a small still picture of a device. THAT
   can be an object instead of a rectangle, and this swaps it.

   🔴 A CROSS-FADE, NOT A REPLACEMENT. The DOM pad stays in the
   layout and keeps its size — it is what hub.css measures the dock
   transform and the button's position against, and pulling it out
   would move both. The canvas is laid over it and the two trade
   opacity.

   🔴 The housing is nestie-unit.js, the same object the device
   page's hero builds. This file only decides where it is pointed.
   ============================================================ */
(function () {
  /* 🔴 手机上曾经整段不跑（PR #3206，为止住整机黑屏），2026-08-30 用户要求
     开回来——那个设备壳子是这一段的主体，没有它只剩一块白底加截图。

     开回来的同时把渲染分辨率压到 1×（见下面 setPixelRatio）。直接撤销那一刀
     等于把显存原样加回去，而崩溃的账还没结清；压分辨率能保住 3D 的形，同时
     把这块画布的纹理面积降到原来的 1/4。 */
  const PHONE = matchMedia('(max-width: 767px)').matches;

  const THREE = window.THREE;
  const UNITLIB = window.NestieUnit;
  const hub = document.querySelector('.hub');
  const pad = hub && hub.querySelector('.hub__pad');
  if (!hub || !pad) return;

  if (!THREE || !UNITLIB) {
    window.hub3d = { ok: false, why: THREE ? 'no-unit' : 'no-three' };
    console.warn('[hub3d] the docked pad stays flat — '
      + (THREE ? 'nestie-unit.js' : 'vendor/three.js')
      + ' did not load. Both must come BEFORE this file in index.html.');
    return;
  }

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'hub__pad-3d';
  canvas.setAttribute('aria-hidden', 'true');
  pad.appendChild(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,               // the wall photograph shows through
      powerPreference: 'high-performance',
    });
  } catch (e) {
    window.hub3d = { ok: false, why: 'no-webgl' };
    console.warn('[hub3d] the docked pad stays flat — no WebGL context: '
      + ((e && e.message) || e));
    canvas.remove();
    return;
  }
  /* 🔴 上下文丢失必须兜底（用户 2026-08-30：「那个三维模型直接变黑了」）。
     iOS 在内存紧张时会回收 WebGL 上下文，而这个文件原来没有任何处理——
     丢了之后 canvas 就是一个**永远黑着的矩形**，而且不会自己好。

     处理方式与「开机时就没有 WebGL」那条分支保持一致：把 canvas 收起来，
     露出下面 hub.css 画的那台平面 pad。降级成静态，而不是留一块黑。
     preventDefault 是为了让浏览器有机会 restore；真恢复了就把 lost 清掉，
     渲染循环下一帧自己会把画面画回来。 */
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    canvas.classList.remove('is-on');
    console.warn('[hub3d] WebGL context lost — 退回平面 pad');
  }, false);
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    console.warn('[hub3d] WebGL context restored');
  }, false);

  /* 手机与桌面都封顶 2×。这里曾为了规避 iOS 重载把手机强制成 1×，但真正占内存
     的 Flutter CanvasKit iframe 现在已在手机端停用；继续把 WebGL canvas 锁在 1×
     会让 Retina 屏把整台设备（尤其是 Light Up 里框内的 UI 纹理）放大两三倍，
     肉眼明显发糊。2× 能恢复与桌面一致的锐度，又不会承担 DPR 3 的平方级显存。 */
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.environment = UNITLIB.makeEnvironment(THREE, renderer);
  scene.add(UNITLIB.makeKey(THREE));

  const built = UNITLIB.makeUnit(THREE);
  const unit = built.unit;
  scene.add(unit);

  /* 这块纯白 mesh 是模型为「没有贴图时也像一块屏幕」准备的底板。手机段尾会再
     叠一层可翻页的 DOM 截图，两个圆角的抗锯齿不能逐像素重合，于是白底板会从
     边缘漏成一圈断续白线。轨道接管时把它隐藏；前奏仍保留它和自己的 3D 贴图。 */
  const screenMesh = PHONE ? unit.getObjectByName('screen') : null;

  /* 手机上 DOM 截图压在 3D screen 的同一块矩形上，截图与彩色外框之间仍会看到
     case 的内层。它是设备的固定暖米色表面，不属于可换色的外框：绿色、蓝色、
     木色都只落在 rim 上。克隆材质是为了不改变桌面和设备页共用的白色 case。 */
  const caseMesh = PHONE && unit.children[0] && unit.children[0].isMesh
    ? unit.children[0]
    : null;
  if (caseMesh) caseMesh.material = caseMesh.material.clone();
  const caseMat = caseMesh && caseMesh.material;
  if (caseMat) {
    /* PhysicalMaterial + ACES 会把很浅的米色和 0.9 自发光推回近乎纯白；这里用
       稍深的暖底、压低自发光，最终画面才稳定落在清楚但不发黄的米色。 */
    const fixedCream = 0xe2d2b3;
    caseMat.color.setHex(fixedCream);
    caseMat.emissive.setHex(fixedCream);
    caseMat.emissiveIntensity = 0.2;
    caseMat.needsUpdate = true;
  }

  /* ---------- the finish follows the room ----------
     The wall behind the device changes every few seconds — three rooms,
     round and round, on hub.js's clock — and the housing's rim changes with
     it: anodised blue in the first room, a painted deep green in the second,
     wood in the third. The green and the wood are extra rings over the blue
     one and the change is their opacity; see makeCoatedRim in
     nestie-unit.js for why it is not one material being re-tinted.

     🔴 A STACK, NOT THREE SLOTS, and it is the same shape hub.css uses for
     the photographs. The blue rim is the object's own and is always under
     everything; the green sits over it, wood over both. A room is a FILL
     LEVEL — room 1 turns green on, room 2 turns both on — which is what makes
     every step of the cycle ONE coat fading over a still-opaque one below.
     Give each finish its own slot instead and every change is two fades
     crossing, with the blue showing through the gap between them.

     🔴 THE SAME 1.2s THE PHOTOGRAPHS TAKE, and it has to be read off the
     CLOCK rather than counted in frames. The two fades are on different
     engines — one is a CSS transition, this one is a render loop — and the
     only thing they can agree on is elapsed time. Counting frames instead
     makes the rim finish early on a 120Hz display and late on a loaded one,
     and a rim that lands before its room reads as two events. */
  const ROOM_FADE = 1200;                 // ms — hub.css's room layers
  /* 🔴 运行时换第一层涂层的颜色。同一块涂层要在两幕里穿两种颜色（intro 的
     Meet Nestify 保持橄榄绿，hub 段尾 One screen. 第一幕换棕红），而两幕的
     data-room 都是 1，分不开——所以按幕换 albedo，不是按房间。
     调用点在 hub.js 的 onScroll，理由见 nestie-unit.js 的 COATS.sage。 */
  let coatTint = null;
  function setCoatTint(hex, allCoats) {
    const tintKey = String(hex) + ':' + (allCoats ? 'all' : 'sage');
    if (coatTint === tintKey) return;
    coatTint = tintKey;
    (allCoats ? COATS : COATS.slice(0, 1)).forEach((coat) => {
      coat.material.color.setHex(hex);
      coat.material.needsUpdate = true;
    });
    if (frame() && ready) draw();
  }

  const COATS = ['sage', 'wood'].map((c, i) => {
    const mesh = UNITLIB.makeCoatedRim(THREE, c);
    /* explicit, because these are coincident and three.js would otherwise
       sort them by distance — which for two rings at the same z is a tie
       broken by nothing in particular. Wood is over green, always. */
    mesh.renderOrder = i + 1;
    unit.add(mesh);
    return mesh;
  });

  const at = COATS.map(() => 0);          // where each coat is now, 0…1
  const to = COATS.map(() => 0);          // where it is going
  let coatLast = 0;

  function setCoat(i, t) {
    at[i] = t;
    /* smoothstep, standing in for hub.css's --ease-out
       (cubic-bezier(.4,0,.1,1)): slow off both ends, and SYMMETRIC, which
       is what makes a coat coming off the mirror of one going on rather
       than a different curve played backwards. */
    COATS[i].material.opacity = t * t * (3 - 2 * t);
  }

  function aimCoats(room) {
    /* TOP DOWN, because the cut below asks what is still above a coat and
       the answer has to be the value from before this call touched it. */
    for (let i = COATS.length - 1; i >= 0; i--) {
      to[i] = room > i ? 1 : 0;
      /* 🔴 CUT, DON'T FADE, a coat that something opaque is still sitting
         on. Wrapping from the last room back to the first is the one step
         that takes two coats off at once, and fading them together would
         show the green through the wood on the way out — a fourth finish,
         for a second, that the product does not have. Whatever is above is
         still at full when this lands, so nothing can see it go. Same rule,
         same reason, as .hub.is-room-cut in hub.css. */
      if (to[i] === 0 && at.slice(i + 1).some((v) => v === 1)) setCoat(i, 0);
    }
  }

  function stepCoats(now) {
    /* 🔴 CLAMPED. `now - coatLast` is the whole time since the last frame,
       and that is a tab left in the background or a long paint — one delta
       of 4 seconds would jump a fade to its end in a single step, which is
       the one thing a cross-fade must not do. 64ms is two frames at 30Hz:
       slow enough to survive a hitch, short enough that it cannot skip. */
    const dt = coatLast ? Math.min(64, now - coatLast) : 16;
    coatLast = now;
    const s = dt / ROOM_FADE;
    for (let i = 0; i < COATS.length; i++) {
      if (at[i] === to[i]) continue;
      setCoat(i, to[i] ? Math.min(1, at[i] + s) : Math.max(0, at[i] - s));
    }
  }

  function jumpCoats() {
    for (let i = 0; i < COATS.length; i++) if (at[i] !== to[i]) setCoat(i, to[i]);
  }

  function roomNow() {
    return Math.max(0, Math.min(COATS.length, +hub.dataset.room || 0));
  }

  let room = roomNow();
  aimCoats(room);
  jumpCoats();

  const D = UNITLIB.DIMS;

  /* 🔴 DEAD FLAT. No yaw, no pitch, no roll. This went in at 8° on the
     reasoning that a few degrees would open the rim's near edge and catch
     the light down it — which is true, and it is the wrong object to do
     it to. The device page's pair is a product shot and may turn as far
     as it likes. This one is hanging on a wall in a photograph of a room
     and is being looked at straight on, and a wall device drawn at any
     angle at all reads as a product shot pasted onto the photograph. The
     thing that gives it away is not the amount of the turn, it is that
     there IS one.

     🔴 SO WHAT IS THE 3D FOR, if nothing is turned? The lip. The rim is
     a ring extruded past the white face, so even square on it has a top
     surface catching the key, an outer wall falling away from it, and an
     inner wall dropping a hairline of shadow onto the white just inside.
     A flat CSS ring has one tone and no edges. That is the whole
     difference and it survives at zero degrees. */
  const YAW = 0;
  const PITCH = 0;

  /* 🔴 1.20, DOWN FROM 1.34, because there is no longer a swing to leave
     room for. The old figure was the housing (BODY_W / SCREEN_W = 1.12)
     plus the lip plus enough air for a corner to swing through eight
     degrees of yaw. Square on, the housing's own 1.12 and a little margin
     for the soft edge is all it needs — and a smaller canvas is less
     overdraw on a page that has a scroll-driven demo running above it. */
  const FILL = 1.20;
  const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 100);

  function frame() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    // Setting even the SAME canvas dimensions clears its drawing buffer.
    // Visibility notifications can arrive after the frame loop has painted;
    // avoid erasing that frame when the stage's size has not changed.
    const dpr = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      renderer.setSize(w, h, false);
    }
    camera.aspect = w / h;
    const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
    /* the world width the lens must show: the screen, times the canvas's
       overhang, divided by however much the yaw foreshortens it */
    const shown = (D.SCREEN_W * FILL) / Math.cos(YAW);
    camera.position.z = shown / 2 / (Math.tan(halfFov) * camera.aspect);
    camera.updateProjectionMatrix();
    return true;
  }

  /* 🔴 The pad is 16:9.6 and the unit is 16:9. They are different
     objects: the hub's SCREEN is 16:9.6 and this housing's screen is
     16:9, because the device page measured it off its own drawing. The
     canvas takes the pad's aspect and the unit is centred in it, so the
     mismatch shows as a little more housing above and below than at the
     sides — which is what a real bezel does anyway. Left alone rather
     than stretched: scaling the unit to fit would make the rim thicker
     top and bottom than at the sides, and that is a thing no moulding
     does. */

  let tick = 0;
  let running = false;

  function draw() {
    /* 🔴 THE ROOM DRIFTS, NOT THE OBJECT, and that is the only way to
       keep both things this section wants. It had a half-degree wobble on
       the unit so the highlight would crawl and the rim would read as
       metal — and a half degree is still not flat. A device screwed to a
       wall does not sway.

       Turning the environment instead moves the reflection and leaves the
       object exactly square: same crawling highlight, same reason to be
       metal, and the silhouette never moves a pixel. It is one line, and
       it is only possible because the metal is lit by an environment map
       rather than by lamps. */
    if (!REDUCED) scene.environmentRotation.y = Math.sin(tick * 0.0032) * 0.09;
    unit.rotation.set(PITCH, YAW, 0);
    renderer.render(scene, camera);
  }

  /* `now` is rAF's timestamp on every frame but the first — sync() calls
     this one by hand to start the loop — so the clock is asked directly
     that once rather than letting a zero through into the delta. */
  function loop(now) {
    if (!running) return;
    tick += 1;
    stepCoats(now || performance.now());
    draw();
    requestAnimationFrame(loop);
  }

  /* 🔴 IT RUNS ONLY WHILE DOCKED AND ON SCREEN, and both halves matter.
     Docked is most of the section's scroll but the hub is one section of
     a long page, and a WebGL loop three screenfuls away is a laptop fan
     for nothing. Reduced motion draws one frame and never loops — there
     is nothing here for the loop to do but move the light. */
  /* 🔴 DECLARED BEFORE THE OBSERVERS THAT WRITE THEM. An earlier draft
     had these below the IntersectionObserver that sets `visible`, on the
     reasoning that the callback is async so the declaration would have
     run by then. `let` in a temporal dead zone does not care about
     likelihood — it throws if the callback ever fires first, and that is
     a race decided by the browser, not by the file's order. */
  let visible = false;
  let ready = false;
  let docked = hub.classList.contains('is-docked');

  const phoneTrack = PHONE ? hub.querySelector('.hub__shots') : null;
  function syncPhoneScreenLayer() {
    if (!screenMesh) return;
    // The DOM screen fades in over .32s. Keep the calendar underneath until
    // that fade completes; hiding it at the start exposes the blank housing.
    // On the way back, restore it before the DOM screen begins fading out.
    const trackCoversScreen = phoneTrack && hub.classList.contains('hub--track-on')
      && Number(getComputedStyle(phoneTrack).opacity) >= 1;
    const show3dScreen = !trackCoversScreen;
    if (screenMesh.visible === show3dScreen) return;
    screenMesh.visible = show3dScreen;
    if (ready && visible && frame()) draw();
  }
  if (phoneTrack) {
    phoneTrack.addEventListener('transitionend', (event) => {
      if (event.target === phoneTrack && event.propertyName === 'opacity') syncPhoneScreenLayer();
    });
  }
  syncPhoneScreenLayer();

  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    /* 停循环还不等于释放 WebGL 帧缓冲。2× Retina canvas 离屏后继续保留完整
       drawing buffer，会和下一段 Meet Nestie 的图片、Rive canvas 同时占显存。
       离开 Hub 就把渲染目标缩到 1×1；回到 Hub 先按 CSS 尺寸恢复，再绘制。纹理
       和场景仍保留，所以倒滑回来不会重新下载，也不会闪一块空白。 */
    if (visible) frame();
    else renderer.setSize(1, 1, false);
    sync();
  }, { threshold: 0 });
  /* Intro brings the stage onscreen with position:fixed before the hub's
     normal-flow section arrives. Observing that section would shrink the
     visible Lights Up canvas to 1×1. Observe the stage that actually moves
     onto/off the viewport, keeping the same offscreen buffer release. */
  io.observe(hub.querySelector('.hub__stage') || hub);

  function sync() {
    /* 手机首轮是固定机身、纵向换屏：离开 legacy docked 区间时 3D 也不能撤掉。 */
    const fixedPhone = PHONE && hub.classList.contains('is-explore-unlocked');
    const active = docked || fixedPhone;
    const want = active && visible && ready;
    // Restore/paint synchronously before exposing the canvas. An already
    // running loop otherwise returns below and leaves a resized buffer blank
    // until the next animation frame (including the fixed-to-sticky handoff).
    if (want && !lost) draw();
    canvas.classList.toggle('is-on', active && ready && !lost);
    const shouldRun = want && !REDUCED;
    if (shouldRun === running) {
      if (want && REDUCED) draw();
      return;
    }
    running = shouldRun;
    if (running) loop();
    else if (want) draw();
  }

  /* 🔴 A MutationObserver, not a scroll listener. hub.js already computes
     the section's progress every frame and toggles .is-docked off the
     back of it; a second listener recomputing the same thing is a second
     answer that can disagree with the first. Watching the class it
     already writes cannot. */
  new MutationObserver(() => {
    syncPhoneScreenLayer();

    const nowDocked = hub.classList.contains('is-docked');
    if (nowDocked !== docked) {
      docked = nowDocked;
      sync();
    }

    const nowRoom = roomNow();
    if (nowRoom !== room) {
      room = nowRoom;
      aimCoats(room);
      /* 🔴 the fade starts from THIS frame. coatLast is whenever the loop
         last ran, which may be the last time the section was on screen —
         leaving it would spend the whole fade in one clamped step. */
      coatLast = 0;
      /* nothing is looping, so there is no fade to run: reduced motion, or
         the section is off screen and this is a state to be found in rather
         than a change to be watched. Land it, and let sync() decide whether
         anyone is looking. */
      if (!running) {
        jumpCoats();
        sync();
      }
    }
  }).observe(hub, { attributes: true, attributeFilter: ['class', 'data-room'] });

  new ResizeObserver(() => {
    if (visible && frame() && ready) draw();
  }).observe(canvas);

  /* 🔴 换屏用的口子。停靠态的屏幕是**一张贴图**，不是那个实时 iframe——
     `.hub__screen` 里的东西在 3D 模式下根本不参与绘制（实测：往那儿塞一个
     z-index:999 的纯红块，画面上一点变化都没有）。所以想让停靠的机器显示别的
     屏，只能换这张贴图。

     用户 2026-09-04 要的是：intro 转场 + hub 前奏这一段，机器上显示
     home|think（"Working on it"）。而段尾那几屏（"One screen."）仍该是下面
     注释说的「demo 结束时的画面」。两处状态不同，所以做成可切换。 */
  const texCache = new Map();
  function useTex(tex) {
    built.screenMat.map = tex;
    built.screenMat.needsUpdate = true;
    if (visible && frame() && ready) draw();
  }

  /* ---------- 边缘在转的那圈辉光 ----------
     🔴 用户 2026-09-04：「我都不愿意出现这个 working on it，我想出现的实际上是
     边缘有在转的那个感觉」「保留一个边缘有那个颜色扰动的、在转的那种感觉」。

     所以底图换成 **still-home-idle**（干净的 Home 面板，没有辉光也没有那颗
     "Working on it" 药丸），辉光由这里每帧画。之前做过一版「三个点依次高亮」，
     那是照着 still-home-think 里那颗药丸复原的——用户看过之后不要药丸了。

     颜色是从 still-home-think 的辉光上量的，不是配的：
       左侧 (186,192,206) 蓝灰 → (189,180,206) 偏紫 → (238,80,207) 品红
       → 右侧 (243,99,187) 粉
     所以锥形渐变就按这条链走，整条随时间转。

     做法：底图 → 沿屏幕边缘裁一圈环形（外圆角矩形减内圆角矩形，evenodd）→
     用 conic-gradient 填。canvas 的 filter:blur 让它散开，不然是一条硬边。 */
  /* 🔴 宽度和衰减都是**量原版量出来的**，不是配的。在 still-home-think 的辉光上
     从上边缘往里取样（640×360 图，x=500）：

       y  0–9   彩度 154–160   满
       y 12–18  彩度  89→23    在淡出
       y 21+    彩度   <13     没了

     所以是「10px 实 + 10px 淡出」，不是一条等宽的硬边。用户 2026-09-04：
     「靠近内部的这一边应该是渐渐渐入，而不是这种硬邦邦的」。 */
  const GLOW_SOLID = 10;     /* 贴边这一段满彩度 */
  const GLOW_FADE  = 7;      /* 往里淡出的模糊半径，实测 ±7 覆盖 10–20px 那段 */
  const GLOW_MS    = 4200;   /* 转一圈多久 */
  let liveRAF = 0, liveTex = null, liveCtx = null, liveImg = null, liveK = 1;
  let glowCv = null, glowCtx = null;
  /* 🔴 屏幕内容的显影进度，0..1。彩条不受它影响，永远满。
     用户 2026-09-04：「那个彩条能不能先出现，然后再出现那个 UI 图片？」
     所以底图铺白 → UI 按这个值淡入 → 彩条始终在最上层满强度画。 */
  let uiFade = 1;
  function setUiFade(t) { uiFade = Math.max(0, Math.min(1, t)); }

  function stopLive() {
    if (liveRAF) cancelAnimationFrame(liveRAF);
    liveRAF = 0;
  }
  function paintGlow(now) {
    liveRAF = requestAnimationFrame(paintGlow);
    if (!frame() || !ready) return;          /* 不在视野里就不画，只保住循环 */
    const k = liveK, W = liveImg.naturalWidth * k, H = liveImg.naturalHeight * k;
    const R = 10 * k;

    /* ① 底图 */
    liveCtx.setTransform(1, 0, 0, 1, 0, 0);
    liveCtx.globalCompositeOperation = 'source-over';
    liveCtx.filter = 'none';
    liveCtx.globalAlpha = 1;
    liveCtx.clearRect(0, 0, W, H);
    /* 先铺白：UI 还没显影时屏幕是亮着的白板，不是透明。少了这一步，uiFade=0
       的那几帧会看到屏幕后面的机身内壁。 */
    liveCtx.fillStyle = '#fff';
    liveCtx.fillRect(0, 0, W, H);
    liveCtx.globalAlpha = uiFade;
    liveCtx.drawImage(liveImg, 0, 0, W, H);
    liveCtx.globalAlpha = 1;

    /* ② 辉光画在自己的画布上，先铺满再**从里往外挖**。

       🔴 关键在这一步用 destination-out + blur：挖掉内部的那一刀是模糊的，
       所以靠内那一侧是渐变淡出，不是硬边。第一版是 clip('evenodd') 直接裁一个
       环——裁出来两条边都是刀切的，用户当场指出来。 */
    const g = glowCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.filter = 'none';
    g.clearRect(0, 0, W, H);
    if (g.createConicGradient) {
      const cg = g.createConicGradient((now % GLOW_MS) / GLOW_MS * Math.PI * 2, W / 2, H / 2);
      /* 色链是从原版辉光上量的：蓝灰 → 偏紫 → 品红 → 粉 */
      cg.addColorStop(0.00, 'rgba(186,192,206,.55)');
      cg.addColorStop(0.22, 'rgba(189,180,206,.80)');
      cg.addColorStop(0.45, 'rgba(238, 80,207,1)');
      cg.addColorStop(0.62, 'rgba(243, 99,187,.95)');
      cg.addColorStop(0.80, 'rgba(189,180,206,.75)');
      cg.addColorStop(1.00, 'rgba(186,192,206,.55)');
      g.fillStyle = cg;
      g.fillRect(0, 0, W, H);

      /* 🔴 用**描边**保留带子，不是用 destination-out 挖中间。

         第一版是「铺满 → destination-out 一个内缩的圆角矩形」：挖不干净，彩色
         一直糊到画面中央，连锥形渐变的中心星芒都露出来了。原因是那一刀带着
         blur，边缘的半透明区一路延伸进去，而底下是纯白，任何残留都看得见。

         现在改成 destination-in + 一条粗描边：描边跨在屏幕边界上，一半在外
         （合成时被圆角裁掉）、一半在内，内侧那一半就是带宽。blur 只软化这条
         描边自己的两边，中间是**完全没画过**的透明，不存在残留。 */
      g.globalCompositeOperation = 'destination-in';
      g.filter = 'blur(' + (GLOW_FADE * k) + 'px)';
      g.strokeStyle = '#000';
      g.lineWidth = GLOW_SOLID * k * 2;
      g.beginPath();
      g.roundRect(0, 0, W, H, R);
      g.stroke();
      g.globalCompositeOperation = 'source-over';
      g.filter = 'none';

      /* ③ 贴回底图，裁到屏幕的圆角里，免得糊到机身上 */
      liveCtx.save();
      liveCtx.beginPath();
      liveCtx.roundRect(0, 0, W, H, R);
      liveCtx.clip();
      liveCtx.drawImage(glowCv, 0, 0);
      liveCtx.restore();
    }

    liveTex.needsUpdate = true;
    draw();
  }

  function setScreen(url, animate) {
    if (!built || !built.screenMat) return;
    stopLive();
    if (!animate) {
      const hit = texCache.get(url);
      if (hit) { useTex(hit); return; }
      new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texCache.set(url, tex);
        useTex(tex);
      });
      return;
    }
    const boot = () => {
      if (!liveCtx) {
        /* 2 倍画布：屏幕在 DPR2 上约 650px 宽，贴图源只有 640，放大一档留余量 */
        liveK = 2;
        const cv = document.createElement('canvas');
        cv.width  = liveImg.naturalWidth  * liveK;
        cv.height = liveImg.naturalHeight * liveK;
        liveCtx = cv.getContext('2d');
        glowCv = document.createElement('canvas');
        glowCv.width = cv.width; glowCv.height = cv.height;
        glowCtx = glowCv.getContext('2d');
        liveTex = new THREE.CanvasTexture(cv);
        liveTex.colorSpace = THREE.SRGBColorSpace;
        liveTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
      useTex(liveTex);
      stopLive();
      liveRAF = requestAnimationFrame(paintGlow);
    };
    if (liveImg && liveImg.dataset.url === url && liveImg.complete) { boot(); return; }
    liveImg = new Image();
    liveImg.dataset.url = url;
    liveImg.onload = boot;
    liveImg.src = url;
  }

  /* the picture on it. The docked device is showing the end of the demo,
     so it shows the same screen the hero's front unit does. */
  new THREE.TextureLoader().load(
    canvas.dataset.screen || 'assets/device/device1.webp',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      built.screenMat.map = tex;
      built.screenMat.needsUpdate = true;
      if (visible) {
        if (!frame()) return;
      } else {
        renderer.setSize(1, 1, false);
      }
      /* 🔴 The upload is where file:// dies, not the fetch. The <img>
         loads perfectly well off the disk — this callback runs, the
         texture object is real — and then the first render throws
         SecurityError deep inside texImage2D. */
      try {
        draw();
        ready = true;
        /* 🔴 THE CLASS GOES ON THE SECTION THE MOMENT THIS IS KNOWN TO
           WORK, which is long before the pad docks. hub.css keys the
           black bezel off it — not off the canvas being visible — so the
           ring never grows in at all.

           Keying it off .is-on instead put a flash in: the dock adds the
           ring over 1.1s, the canvas fades in over 0.55s, and only then
           was the ring told to go. You saw a black frame appear and then
           dissolve, every time. The fix is not a shorter transition, it
           is asking the question earlier — "will the 3D work" is
           answerable as soon as the texture is on the material, and the
           answer does not change afterwards. */
        hub.classList.add('hub--3d');
        window.hub3d = { ok: true, setScreen, setUiFade, setCoatTint };
        sync();
      } catch (err) {
        built.screenMat.map = null;
        renderer.dispose();
        canvas.remove();
        window.hub3d = {
          ok: false,
          why: err && err.name === 'SecurityError' ? 'tainted' : 'render failed',
        };
        console.warn('[hub3d] the docked pad stays flat — '
          + (err && err.name === 'SecurityError'
            ? 'the screen image cannot be used as a WebGL texture from a '
              + 'file:// page. Serve it over http.'
            : (err && err.message) || err));
      }
    },
    undefined,
    () => {
      renderer.dispose();
      canvas.remove();
      window.hub3d = { ok: false, why: 'missing' };
      console.warn('[hub3d] the docked pad stays flat — the screen image '
        + 'did not load.');
    },
  );
})();
