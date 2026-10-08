/* ============================================================
   HERO deck — geometric mask transitions (ported from labs-clone)
   driven by vertical page scroll instead of prev/next buttons.

   One viewport of scroll per slide. The stage is sticky, so the
   page keeps moving normally: scroll down → slides advance →
   after the last one the hero releases and the page continues.
   ============================================================ */
(function () {
  /* 🔴 声明在 IIFE 最顶上。它在下面幻灯片模板（~230 行）里就要用，而
     REDUCED 那一组在 340 行 —— 放到那边会命中 TDZ，实测报
     `Cannot access 'PHONE' before initialization`，整个 deck 建不出来。 */
  const PHONE = matchMedia('(max-width: 767px)').matches;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* The four marks live in shapes.css, as --shape-*, because the intro's
     tiles are cut out of the same four and a shape that exists twice will
     eventually only get edited once.

     🔴 They are still data: URLs, for the same reason intro.css inlines
     the wordmark: a file:// page cannot load a sibling SVG as a mask
     (opaque origin), and it also cannot read one back out of a canvas —
     measureCoverScale() below does exactly that, and a tainted canvas
     would throw inside the image's onload where nothing can catch it,
     leaving --mask-end unset. A data: URL is same-origin everywhere, and
     getPropertyValue hands it back as `url("data:...")`, which is exactly
     what the regex down there already expects. */
  const ROOT_CS = getComputedStyle(document.documentElement);
  const SHAPE = (n) => ROOT_CS.getPropertyValue('--shape-' + n).trim();

  /* perceived lightness of a #rrggbb, 0..1 — Rec. 709 weights, because a
     flat average calls #00ff00 dark and it is the brightest thing here */
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  }

  /* Flat grounds only — the four card colours the testimonials section
     below already uses (styles.css .testi_card.is-*), so the
     hero reads as the same palette instead of an invented dark one. */
  /* Flat grounds, one per slide — the day is told by the clock, not by the
     sky. (A pass here turned these into dawn/noon/dusk/night with a
     full-bleed glow behind them; the ground is meant to stay a plain
     colour, so that was reverted.) */
  const C = {
    sky:   '#dbeafc',   /* --nes-sky   */
    blue:  '#2497f0',   /* --nes-blue  */
    amber: '#fbbf24',   /* --nes-amber */
    cream: '#f5f4f0',   /* --nes-cream */
    ink:   '#1a1a1a',   /* --nes-ink   */
  };

  /* One shape per dimension — see the table at the top of shapes.css for
     why each one. They were circle / circle / squircle / hexagon, which is
     how two of the four ended up identical and the whole deck read as
     geometry rather than as anything to do with a family.

     (The note that used to sit here said slide one had to stay a circle to
     match the intro's blue bead. That bead was removed with the old fluid
     opener — there is nothing left to match, so the slot is free.) */
  /* ---------- no ground of its own ----------
     🔴 This was #efeadd, the "warm cream stage" token. Against its two
     neighbours it is the only WARM one — the intro above is --nes-sand
     #f4f2ea and the hub below is --nes-cream #f5f4f0, which differ from
     each other by one step per channel, i.e. not at all. #efeadd is 14
     steps of yellow away from both, so the deck read as a tinted band cut
     into an otherwise continuous page. It takes the intro's ground now,
     so the seam under scene two disappears. */
  const GROUND = ROOT_CS.getPropertyValue('--page-bg').trim() || '#f4f2ea';

  /* 🔴 NO FULL STOPS. The four titles are headlines, not sentences —
     the slide is the sentence and the picture is the rest of it. A period
     closes a line that the next slide is about to continue. */

  /* ---------- FOUR FILMS ----------
     🔴 `vid:` IS BACK, and it cost one key per slide exactly as the note it
     replaces predicted: the builder below already knew how to do both.
     `--slide-img` goes on the slide and .hero__inner paints it (cover,
     centred, hero.css); the <video> element is only written when `vid` is
     set. Nothing else in the deck had to be touched.

     🔴 BOTH KEYS ON A FILM SLIDE, not one or the other. `img` is that film's
     OWN FRAME ZERO (assets/hero/*-poster.jpg, cut from the mp4 with ffmpeg,
     so it is the same picture by construction rather than by resemblance),
     and it sits on .hero__inner UNDER the <video>. It is what the box paints
     while the film is still fetching, and — for slide one — it is what the
     opener's flip card turns onto. Pointing `img` at a DIFFERENT picture than
     `vid` is the one mistake this pairing exists to prevent: the card would
     land on one photograph and cut to another.

     🔴 EVERY FILM-DRIVING PATH IS LIVE AGAIN. syncFilm() plays the active
     slide's <video> and pauses the rest; startClock() rewinds it on arrival;
     barLoop() reads currentTime/duration so the rail is the film's own
     length. All four slides now carry one, so SLIDE_MS is inert again —
     the "slide with no film" branch is reachable but nothing reaches it.
     Leave it: it is what makes putting a still back a one-key move, and it
     is the only thing standing between a failed video load and a rail that
     never fills. Dwell time is therefore per-slide and comes from the cut,
     not from a number typed here: 8.4s / 7.1s / 7.5s / 7.3s.

     🔴 THE MP4s ARE RE-ENCODED, NOT COPIED. The masters are 1080×1080 at
     10–12 Mbps with an audio track — 47MB for the four, for a box that is
     at most 720 CSS px wide and is muted. libx264 CRF 23 + `-an` +
     `-movflags +faststart` brings them to ~2MB each; faststart matters more
     than the size here, since the moov atom has to arrive before the browser
     can paint a frame of slide one.

     🔴 NAMED FOR WHAT THEY SHOW, not for their position. The mp4s were once
     hero1..hero4 and the deck has already been reordered once — hero4 was
     the THIRD slide, see the note below — so the numbers had stopped meaning
     anything. A reorder now moves the lines, the films and the posters
     together with nothing to renumber. */

  /* ---------- one number for everything in assets/hero/ ----------
     🔴 THE FILENAMES DO NOT CHANGE WHEN THE FILM DOES. A re-render of the
     same cut lands on the same path, so nothing in the URL moves and the
     browser goes on serving the take it already has — which looks exactly
     like "you didn't change anything". The same trap as the scripts in
     index.html, one level down, and it cost a round when only the css and
     js carried a version.

     ⚠️ THREE PLACES, ONE NUMBER: here, the same literal in intro.js (the
     flip card names slide one's film too, and a mismatch is the same file
     fetched twice under two URLs), and the ?v= on the stylesheets and
     scripts in index.html. Bump all three whenever anything in assets/hero/
     is replaced. */
  const ASSET_V = '?v=434';

  const SLIDES = [
    {
      mask: 'hexagon',
      vid: 'assets/hero/hero-one-place.mp4',
      img: 'assets/hero/hero-one-place-poster.jpg',
      bg: GROUND,
      fg: '#1a1a1a',
      eyebrow: 'Family information hub',
      /* 🔴 `carry` is the word the section above hands down. The intro's
         sentence ends on "family"; this headline contains the same word,
         and the handover flies THAT word from one to the other, so the two
         screens read as one thought continuing rather than as two separate
         headlines. Only the slide the reader lands on can have it — see
         the carrier in intro.js.

         🔴 KEEP "family" IN THE TITLE. The headline has been rewritten
         once already ("All that family know, all in one place.") and the
         word survived by luck rather than by rule: carry looks for it in
         the title string, and a rewrite that drops it leaves the carrier
         with nothing to fly. */
      carry: 'family',
      title: 'Your whole family,<br> <em>in one place</em>',
    },
    {
      mask: 'clover',
      vid: 'assets/hero/hero-know-better.mp4',
      img: 'assets/hero/hero-know-better-poster.jpg',
      bg: GROUND,
      fg: '#1a1a1a',
      eyebrow: 'Family relationships',
      title: 'Know your family <em>better</em>',
    },
    /* 🔴 THIRD, and it used to be fourth. The deck's order is an
       argument, not a list: the hub, then what it understands, then
       what it takes off the parents, and the kids LAST — the deck ends
       on the child rather than on the adult, which is the note the
       section is meant to leave you on. The film and the mask travelled
       with the copy; they are the same subject. */
    {
      mask: 'heart',
      spin: 360,
      vid: 'assets/hero/hero-less-to-carry.mp4',
      img: 'assets/hero/hero-less-to-carry-poster.jpg',
      bg: GROUND,
      fg: '#1a1a1a',
      eyebrow: 'Parent mental health',
      title: 'Less to <em>carry</em>',
    },
    {
      mask: 'star',
      vid: 'assets/hero/hero-grow-into-themselves.mp4',
      img: 'assets/hero/hero-grow-into-themselves-poster.jpg',
      bg: GROUND,
      fg: '#1a1a1a',
      eyebrow: 'Kids&rsquo; development',
      title: 'Help them grow <em>into themselves</em>',
    },
  ];

  const track = $('.hero');
  const stack = $('#heroStack');
  const rail = $('#heroProgress');
  if (!track || !stack) return;

  track.style.setProperty('--hero-slides', SLIDES.length);

  SLIDES.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero__slide';
    slide.style.setProperty('--mask-shape', SHAPE(s.mask));
    slide.style.setProperty('--slide-bg', s.bg);
    /* --slide-img is .hero__inner's background. On a film slide it is that
       film's poster and lives UNDER the <video>; on a still-only slide it IS
       the picture. Either way one key, one paint. */
    /* 🔴 只有第 0 张（以及没有影片、海报本身就是内容的那种）立刻挂海报。
       其余三张先把地址存在 data-img 上，等 syncFilm 预热到它时再挂。

       四张海报合计约 420KB，而首屏只看得见第 0 张——它们跟开场影片（要立刻播）
       抢的是同一条带宽。实测 load 之前共 9.72MB，这是其中能干净摘掉的一块。

       ⚠️ 判据带 `|| !s.vid`：没有影片的幻灯，海报**就是**那张图（见下一段
       --slide-img 的注释），推迟它等于推迟内容本身。现在四张都有影片，但这条
       守卫得留着，不然以后加一张纯图幻灯就会白一下。 */
    if (s.img && (i === 0 || !s.vid)) slide.style.setProperty('--slide-img', `url("${s.img + ASSET_V}")`);
    else if (s.img) slide.dataset.img = s.img + ASSET_V;
    slide.style.setProperty('--slide-fg', s.fg);
    slide.setAttribute('aria-hidden', 'true');
    slide.innerHTML = `
      <div class="hero__inner">
        ${s.vid ? '<video src="' + s.vid + ASSET_V + '" class="hero__video" playsinline muted disablePictureInPicture'
          /* 🔴 preload="auto" ON SLIDE 0 ONLY. It is the one the intro's
             flip hands over to, and that handover is a swap of two
             elements showing the same frame: the flipper's back face holds
             hero-one-place's frame zero (see intro.js) and this element has
             to be able to paint frame zero the instant it is revealed. With
             the default hint it has bytes and no decoded picture, so the card
             lands and the film is a black rectangle for a beat.
             (The poster on .hero__inner underneath is the belt to this
             braces — it holds the same frame, so a slow decode shows the
             right picture rather than a hole. It is not a substitute: a
             still under a <video> that has painted nothing is still a still,
             and the film has to start ON TIME, not merely start.)
             Every other slide is reached by scrolling and has a whole
             glide to get ready in — preloading all four would be four
             films fetched to watch one. */
          /* 🔴 手机上给其余三张显式 preload="none"。不写属性时浏览器自己决定，
             而 iOS Safari 在 Wi-Fi 下会把四支片子都缓冲起来 —— 实测手机上
             8 个 <video> 常驻、传输 6.9MB，是整页第二大的一块，而 iPhone 12
             mini（4GB）上整页会被 iOS 杀掉重载（用户 2026-08-29）。
             桌面不动：那边缓冲得起，而且 barLoop 读 v.duration 当进度条时钟，
             preload="none" 会让它先回落到 SLIDE_MS 直到片子真正加载。 */
          /* 🔴 metadata，不是 none（用户 2026-08-30：「手机版怎么不能自动播放」）。
             none 意味着**要等它成为当前张才开始下载**，而每支片子 1.3–2.0MB：
             真机上那是 1–4 秒的静止 poster，而且 duration 拿不到，进度条只能
             退回 SLIDE_MS 的 5 秒计时——很可能片子还没下完就翻页了。
             metadata 只取文件头（几 KB），duration 立刻就有，省内存的初衷不变；
             真正的字节由 syncFilm 里的「预热下一张」提前拿。
             ⚠️ 这条 headless 与模拟器都复现不了：localhost 上 none 也是瞬间完成。 */
          + (i === 0 ? ' preload="auto"' : (PHONE ? ' preload="metadata"' : '')) + '></video>' : ''}
      </div>
      <div class="hero__content">
        <h1 class="hero__title"><span class="hero__mask"><span>${
          s.carry ? s.title.replace(s.carry, '<i class="hero__carry">' + s.carry + '</i>') : s.title
        }</span></span></h1>
        <p class="hero__eyebrow">${s.eyebrow}</p>
      </div>`;
    stack.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = 'hero__dot';
    dot.setAttribute('aria-label', `Slide ${i + 1}`);
    dot.innerHTML = '<i></i>';
    dot.addEventListener('click', () => scrollToSlide(i));
    rail.appendChild(dot);
  });

  const slides = $$('.hero__slide', stack);
  const dots = $$('.hero__dot', rail);
  const N = slides.length;
  let idx = 0;
  /* Desktop is a gallery from the first frame. Phone keeps the original
     stacked-card presentation and its own nearest-card selection. */
  let galleryDone = !PHONE;

  /* 🔴 active, but NOT is-copy-in. The first slide is the deck's resting
     state from load; its copy waits for the intro's flip to deliver it. */
  /* 🔴 2026-09-04：文案的隐藏起始态只在 JS 真的跑起来之后才生效。
     见 hero.css 的 .hero--anim 那段——没有这行，hero.js 挂掉时整段标题
     会被 clip-path 永久裁没。照 privacy.js:56 的 pv--anim 同一个做法。 */
  const heroRoot = $('.hero');
  if (heroRoot) heroRoot.classList.add('hero--anim');

  slides[0].classList.add('is-active');
  slides[0].setAttribute('aria-hidden', 'false');
  dots[0].classList.add('is-active');

  /* rail + scroll hint live outside the slides, so hand them the
     current slide's ink instead of a fixed white */


  const halo = document.documentElement;
  let caught = false;   // has the falling dot been taken over yet?


  function paintChrome(i) {
    track.style.setProperty('--ui-fg', SLIDES[i].fg);
    track.style.setProperty('--stage-bg', SLIDES[i].bg);
    /* 🔴 Ask the GROUND how dark it is, don't compare the ink to a literal.
       This tested `fg === '#ffffff'`, which was true for exactly one slide
       and silently false for the night one the day it arrived (its ink is
       #eef1f7) — so the bar would have kept its dark type on a navy sky.
       Luminance can't go stale when a colour is retuned. */
    track.dataset.tone = luminance(SLIDES[i].bg) < 0.45 ? 'dark' : 'light';
    const R = document.documentElement.style;

    dispatchEvent(new CustomEvent('hero:tone'));
  }
  paintChrome(0);

  /* ---------- the transition itself (unchanged from the original) ---------- */
  function goHero(next) {
    next = Math.max(0, Math.min(N - 1, next));
    if (next === idx) return;

    const cur = slides[idx], to = slides[next];
    const curVid = cur.querySelector('.hero__video');
    if (curVid) curVid.pause();

    /* In the desktop exhibition the old 800ms outgoing latch would leave
       two neighbouring cards bright at once while the rail is being
       scrubbed. Selection changes immediately; opacity supplies the soft
       hand-off between the centred card and its neighbours. */
    if (!PHONE && galleryDone) {
      cur.classList.remove('is-active', 'is-out', 'is-copy-in');
      cur.classList.remove('is-border-drawing');
      cur.setAttribute('aria-hidden', 'true');
      to.classList.remove('is-out');
      to.classList.add('is-active');
      to.setAttribute('aria-hidden', 'false');
      if (curVid) { delete curVid.dataset.spent; delete curVid.dataset.handoff; }
      dots[idx].classList.remove('is-active');
      idx = next;
      dots[idx].classList.add('is-active');
      paintChrome(idx);
      if (owned) drawGalleryBorder(to);
      return;
    }

    /* simple crossfade — no mask, no spin */
    cur.classList.remove('is-copy-in');
    cur.classList.add('is-out');
    cur.setAttribute('aria-hidden', 'true');
    to.classList.remove('is-out');
    to.classList.add('is-active', 'is-copy-in');
    to.setAttribute('aria-hidden', 'false');

    clearTimeout(cur._exit);
    cur._exit = setTimeout(() => {
      cur.classList.remove('is-active', 'is-out');
    }, 800); /* matches the 0.7s opacity transition + a beat */

    /* the handover's flags belong to one arrival only — `spent` (already had
       its run, see syncFilm) and `handoff` (the intro is carrying this film,
       see startClock). Any slide change is a new film either way. */
    if (curVid) { delete curVid.dataset.spent; delete curVid.dataset.handoff; }

    dots[idx].classList.remove('is-active');
    idx = next;
    dots[idx].classList.add('is-active');
    paintChrome(idx);
  }

  /* ---------- the rail is a CLOCK, not a scrollbar ----------
     It says how long this slide has left, and when it runs out the deck
     goes to the next one by itself. Scrolling does not scrub it — one
     gesture is one slide, in whatever direction you gestured.

     Measured off labs.google's featured carousel, which is the same idea
     laid out horizontally: the active item is a wide bar with a fill, the
     rest are dots, and the fill takes about five seconds end to end. Ours
     fills LINEARLY where theirs eases out — a bar that decelerates is
     telling you the wrong thing about how much time is left.

     🔴 The auto-advance moves the PAGE, it does not just swap the slide.
     The deck still owns four screens of track, so if the index moved on
     its own while the scroll position stayed put, the two would disagree
     and the next real gesture would snap you back. Scrolling the page to
     the next anchor keeps one source of truth, and it means the deck runs
     out onto the section below at the end instead of trapping you. */
  const SLIDE_MS = 5000;
  /* 🔴 Scaled by distance, not a flat 620ms. A slide is three viewports of
     scroll now (see --slide-span in hero.css); at a fixed 620 the snap
     covered ~2700px in that time, which is a teleport rather than a move.
     Floor keeps short corrections snappy, ceiling keeps long ones from
     dragging. */
  const glideMs = (px) => Math.max(380, Math.min(1100, 300 + Math.abs(px) * 0.24));
  const QUIET = 140;          // ms of silence before a gesture counts as over
  /* nothing may advance on its own for a reader who asked for no motion —
     the deck stays where it is and the scroll is the only thing moving it */
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function metrics() {
    /* The desktop title is a zero-height sticky overlay in the same viewport
       as the stage, so the whole composition begins at the section boundary. */
    const top = track.offsetTop;
    const range = Math.max(1, track.offsetHeight - window.innerHeight);
    return { top, range };
  }
  const anchorY = (i) => {
    const { top, range } = metrics();
    return top + (range * Math.max(0, Math.min(N - 1, i))) / (N - 1);
  };

  /* 手机上给每张幻灯放一个吸附点（snap.js / snap.css）。用 anchorY 本身，
     不另算一份——它已经是「第 i 张幻灯该停在哪」的唯一定义，dots 的跳转
     (scrollToSlide) 和自动推进 (glide) 走的都是它。
     🔴 …但手机上 deck 已经横过来了（hero.css 末尾那块），一张幻灯不再对应一段
     纵向滚动，anchorY 在那个模型里没有意义。纵向吸附点如果照建，读者划到 deck
     时会被四个不存在的边界一路拽住。所以这条现在只给桌面——而桌面本来就不跑
     snap.js（它自己第一行就 return 了），留着是因为这个判据说的是「什么时候
     需要纵向吸附」，不是「谁在跑」。 */
  if (!PHONE && window.snapAt) window.snapAt(track, () => {
    const { top } = metrics();
    return Array.from({ length: N }, (_, i) => anchorY(i) - top);
  });

  /* 🔴 手机上**不布吸附点**。四幕曾经各占一屏，那时一幕一个吸附点是对的
     （停下来看到的是完整的一幕）。幕改成内容高度之后，一屏能看到一张半，吸附
     反而有害：
       ① 它把幕拉成「顶边对齐视口顶」，而当前张的判据看的是**中心**（下面
          pickScene），两者互相拉扯——实测把第 1 幕居中后 snap 把页面拽到第 2
          幕的顶边，idx 跟着变成 1。
       ② 参照页（deepmind.google 手机版）的卡片流本来就是自由滚动的，没有任何
          吸附；一屏看到一张半正是它读起来连续的原因。
     hub / meet 各自的吸附点不受影响，它们仍是「一屏一拍」的段落。 */

  /* ---------- 手机：一幕一屏，谁在视口里谁是当前张 ----------
     🔴 只换「第 i 张是谁」这一个来源，别的一概不换。goHero / syncFilm /
     startClock 全部照旧跑——它们问的都是「现在是第几张」。竖版四幕里这个问题的
     答案是「哪一幕占着视口」，由下面那个 IntersectionObserver 回答（见文件末尾
     PHONE 那一段）。

     slideTo 仍然保留：进度条的点击跳转（scrollToSlide）走它。竖版里它就是把那
     一幕滚到视口顶边。 */
  const slideTo = (i) => {
    const el = slides[Math.max(0, Math.min(N - 1, i))];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* declared up here because glide() clears the settle timer on the way
     out, and glide() is defined above the gesture block that owns it */
  let raf = 0, assisting = false, lockUntil = 0, quiet = null;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* 🔴 A glide's LAST scroll event lands after the glide has declared
     itself finished, so `assisting` is already false when it arrives — it
     arms the settle, the settle reads the direction it was already going,
     and the deck walks on one more slide. Measured: a single swipe from
     slide 0 landed on slide 2. Clearing `assisting` is not enough; the
     tail has to be locked out for a beat as well. */
  const LOCK_MS = 260;
  /* 🔴 The flick that brings you INTO the deck must not also spend a slide.
     The gesture listener armed on `onScreen`, which is true from the
     stage's first pixel — so the same wheel that carried the reader down
     here latched a gesture, and the settle spent it the moment the deck
     landed. Measured, arriving by wheel: the first film was on screen for
     1.31 seconds of its 6.2 and then faded out. This is the beat between
     the deck taking the screen and the deck accepting input; the reader's
     next, separate flick still works normally. */
  const ARRIVE_MS = 700;

  function glide(to) {
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) return;
    const t0 = performance.now();
    const dur = glideMs(to - from);
    assisting = true;
    cancelAnimationFrame(raf);

    const landed = (now) => {
      raf = 0; assisting = false;
      lockUntil = (now || performance.now()) + LOCK_MS;
      clearTimeout(quiet);
    };

    /* 🔴 Hand the move to Lenis when it is running. Both this and Lenis
       write window.scrollTop every frame, so two of them animating at once
       is a tug of war — the snap stutters and can land short. Lenis's own
       scrollTo is still interruptible by the reader (no `lock`), which is
       the property the hand-rolled version was written for in the first
       place: an assist, not a hijack.

       🔴 The safety timer is not belt-and-braces. onComplete does NOT fire
       when the reader interrupts the tween, and `assisting` gates the whole
       settle mechanism — one interrupted glide without this and the deck
       stops responding to gestures for the rest of the session. */
    if (window.lenis) {
      let done = false;
      const finish = () => { if (!done) { done = true; landed(); } };
      window.lenis.scrollTo(to, { duration: dur / 1000, easing: easeOut, force: true, onComplete: finish });
      setTimeout(finish, dur + 220);
      return;
    }

    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, from + (to - from) * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else landed(now);
    })(t0);
  }
  function stopGlide() { if (raf) cancelAnimationFrame(raf); raf = 0; assisting = false; }

  function scrollToSlide(i) {
    stopClock();
    if (PHONE) slideTo(i);
    else glide(anchorY(i));
  }

  /* ---------- the clock ---------- */
  let clockRaf = 0, clockStart = 0, running = false, finished = false, leaving = false;

  /* 🔴 --fill, not `height`. The rail is a COLUMN on desktop and a ROW on a
     phone (hero.css's 767 query lays it down), so the same fraction is a
     height down one and a width across the other. Handing over the number
     and letting the stylesheet decide which axis it lands on keeps this a
     single painter; writing `height` here meant the phone rail either
     needed its own branch in this loop or could not fill at all. */
  function paintBar(f) {
    const bar = dots[idx] && dots[idx].querySelector('i');
    if (bar) bar.style.setProperty('--fill', (f * 100).toFixed(1) + '%');
    dots.forEach((d, i) => { if (i !== idx) d.querySelector('i').style.setProperty('--fill', '0%'); });
  }

  /* 🔴 This stops the CLOCK. It used to pause the film too, and that is
     what killed playback on the way back up: every wheel/touch event calls
     stopClock() (see the gesture listener), while the only thing that ever
     started the film again was a change of slide index or the observer
     crossing its threshold. Scroll up out of the deck and neither happens —
     you are still on slide 0 and the stage never fully left — so the film
     stayed parked on whatever frame the last wheel event caught, and came
     back dead. Measured: paused at t=0.04 and still 0.04 six seconds later.
     Playback belongs to "is this slide in front of me", which is syncFilm's
     job, not to "did the reader just touch the wheel". */
  function stopClock() {
    running = false;      /* the auto-advance stands down; the bar keeps painting */
    /* the reader has taken over, so the deck is no longer on its way
       anywhere — a film held on its last frame goes back to looping rather
       than sitting there frozen */
    leaving = false;
  }

  /* The film follows the slide, not the gesture: whatever slide is active
     while the deck is on screen is playing, everything else is paused.
     Called from the scroll frame and from the observer, so it is re-asserted
     continuously rather than only on transitions. Cheap — it only touches a
     video whose state already disagrees. */

  /* 手机端跨到 Meet 时必须真正释放视频解码缓冲，pause() 不够。

     四幕竖排会依次把四支影片提升到 preload=auto；到了 Meet 入口，Safari 仍让
     四支保持 readyState=4。此时 Meet 又开始解码 18 张图并启动 Rive，峰值会让
     iOS 直接杀掉页面。remove src + load() 才会让媒体元素丢掉内部缓冲。

     原地址存在 data-hero-src，向上返回 Hero 时 syncFilm 只恢复当前幕和下一幕，
     不会一次把四支重新拉回来。poster 在 .hero__inner 背后一直保留，所以释放和
     重载期间不会露出黑块。 */
  let phoneFilmsReleased = false;
  function releasePhoneFilms() {
    if (!PHONE || phoneFilmsReleased) return;
    owned = false;
    stopClock();
    slides.forEach((sl) => {
      const v = sl.querySelector('.hero__video');
      if (!v) return;
      try { v.pause(); } catch (e) {}
      const src = v.getAttribute('src') || v.currentSrc;
      if (src && !v.dataset.heroSrc) v.dataset.heroSrc = src;
      v.removeAttribute('src');
      v.preload = 'none';
      try { v.load(); } catch (e) {}
    });
    phoneFilmsReleased = true;
  }

  function restorePhoneFilm(v) {
    if (!PHONE || v.getAttribute('src') || !v.dataset.heroSrc) return;
    v.preload = 'auto';
    v.setAttribute('src', v.dataset.heroSrc);
    try { v.load(); } catch (e) {}
    phoneFilmsReleased = false;
  }

  if (PHONE) window.__releaseHeroFilms = releasePhoneFilms;

  /* 🔴 play() 被拒就等数据到了再试一次（用户 2026-08-30：「hero deck 往下拉
     完全不会播放」）。

     手机上后三张是 preload="metadata"（PR #3199 为省内存），所以 syncFilm 调
     play() 的那一刻它们**还没有可播的数据**。iOS 在这种情况下会拒绝 play()，
     而原来是 `.catch(() => {})` —— **吞掉就再也没有人重试**，那一张就永远停在
     poster 上。本地 localhost 数据瞬间到，所以三个测试环境都复现不了。

     canplay 是「现在有数据了」的信号；只挂一次（once），并且只在这张片子仍然
     是当前张时才真的播——否则读者早翻页了还会有一个迟到的 play() 把它唤醒。 */
  function playWhenReady(v, stillWanted) {
    if (!v) return;
    const go = () => { const q = v.play(); if (q) q.catch(() => {}); };
    const q = v.play();
    if (!q) return;
    q.catch(() => {
      /* 🔴 被拒之后必须**主动把下载踢起来**，不能只挂 canplay 等着。

         用户 2026-08-30 的现象是方向不对称的：往下滑（第一次到这张）不播，
         往上滑（之前播过）会播。机制正好对上——手机上后三张是
         preload="metadata"，浏览器取完文件头就停了；iOS 在没有可播数据时
         拒绝 play()，而**拒绝本身不会触发下载**。于是 canplay 永远不来，
         上一版那个「等 canplay 重试」就永远等不到。往上滑时数据早在，
         所以照常播。

         preload='auto' + load() 把下载真正启动，canplay 才有可能到。
         stillWanted 保证读者早翻页时那个迟到的 play() 不会把它唤醒。 */
      if (v.preload !== 'auto') { v.preload = 'auto'; try { v.load(); } catch (e) {} }
      v.addEventListener('canplay', () => { if (stillWanted()) go(); }, { once: true });
    });
  }

  function syncFilm() {
    /* 只有 viddiag.js 在场时才写（它自己也只在 ?vdiag 下才跑）。owned 是这一
       段唯一从外面看不见、又能一票否决所有播放的变量：它为 false 时下面第一个
       分支会把每个视频都 pause 掉，跟视频加载得怎么样毫无关系。 */
    if (window.__vdiag) window.__hero = { owned: owned, idx: idx, leaving: leaving };
    slides.forEach((sl, i) => {
      const v = sl.querySelector('.hero__video');
      if (!v) return;
      /* 从 Meet 往回走时只恢复眼前这一支和下一支。下一支提前恢复是原本的预热
         契约；更远的两支继续保持无 src，不占解码缓冲。 */
      if (PHONE && owned && (i === idx || i === idx + 1)) restorePhoneFilm(v);
      if (!owned || i !== idx) {
        if (!v.paused) v.pause();
        /* 🔴 预热**下一张**。手机上后三张只带 metadata，字节要等到轮到它才拿；
           在它上台之前的这一整张的时间里（约 7–8 秒）先把它下好，上台时就是
           即时起播，而不是先给一段静止的 poster。
           只升一次：升成 auto 之后这个条件自己就不成立了。 */
        /* 🔴 PHONE 这个闸不能省。判据写成 `v.preload === 'metadata'` 会连桌面
           一起吃进去：没写 preload 属性时 Chrome 的 IDL 默认值**就是**
           'metadata'（Safari 是 'auto'），于是桌面 Chrome 也会被我们强行升成
           auto —— 那是本来交给浏览器自己决定的事，不该由这里替它决定。
           只有手机才是我们显式写了 metadata 的那一档。 */
        /* 海报跟着影片一起预热：轮到下一张之前挂上，上台时底下就有图，
           而不是先露一格纯色。只挂一次，挂完把 data-img 摘掉。 */
        if (owned && i === idx + 1 && sl.dataset.img) {
          sl.style.setProperty('--slide-img', `url("${sl.dataset.img}")`);
          delete sl.dataset.img;
        }
        if (PHONE && owned && i === idx + 1 && v.preload === 'metadata') {
          v.preload = 'auto';
          try { v.load(); } catch (e) {}
        }
        return;
      }

      /* 🔴 `loop` came off the tag. With it on, a film that finished
         immediately restarted, and the deck then spent the whole 0.3–1s
         glide showing the OPENING of the film again before cutting away —
         which is what "没播完就到下一个" actually was. Measured: the film
         ran 0 → 6.205 of 6.21 (its full length, ffprobe agrees), then the
         slide changed at currentTime 0.042. Nothing was cut; you were
         being shown the beginning a second time and then taken off it.

         So: run once, hold the last frame, leave. The one case that still
         wants a loop is a slide the deck is NOT about to leave — the
         advance suspended by a gesture, or the last slide — where the
         alternative is a frozen frame sitting there. */
      if (v.ended) {
        /* Exhibition films are atmosphere, not navigation. Let each one hold
           its last frame instead of restarting or pushing the page; the last
           card can then hand that stillness cleanly to the Nestie section. */
        if (!PHONE && galleryDone) return;
        /* 🔴 `leaving`, not `!running`. Triggering the advance sets running
           false as its first act, so keying off that restarted the film the
           instant it finished — the deck then glided away over the opening
           seconds all over again, which is the exact thing removing `loop`
           was meant to stop. Measured: slide changed at currentTime 0.044
           of 6.21. While the deck is on its way out the last frame holds.

           🔴 `spent` is the intro's, and it is the second reason not to
           rewind. The film starts on the flip card, crosses into this
           element as one continuous take (see the handover at the foot of
           intro.js), and if it reached its end somewhere in that crossing
           then this slide has ALREADY shown it — restarting here is the
           deck replaying a film the reader just watched, right after it
           finished growing. The flag holds the last frame instead, and
           goHero() clears it, so the only playthrough it suppresses is
           the one that was handed to it.

           🔴 AND IT IS EARNED HERE, NOT ONLY AT THE HANDOVER. intro.js
           sets `spent` only when the film had ALREADY ended by the time
           the card landed (`if (done)` at the foot of that file) — which
           covers a slow crossing and nothing else. Cross at any normal
           speed and the film is still running when it docks, so `spent`
           is deleted, the film finishes a second later sitting in its
           final position, and this branch rewinds it: the replay you see
           after it grows.

           `handoff` is the durable half of the pair — intro.js sets it at
           the turn and only clears it if the reader goes back UP, and
           goHero() clears it on any slide change. So while it is still on
           the element, this film is on the crossing's one and only run,
           and the end of that run is where `spent` belongs regardless of
           which side of the dock it happens on. Setting it here rather
           than widening the intro's condition keeps the rule in the one
           place that knows the film actually ended. */
        if (v.dataset.handoff === '1') v.dataset.spent = '1';
        if (!leaving && v.dataset.spent !== '1') { try { v.currentTime = 0; } catch (e) {}
          playWhenReady(v, () => owned && slides[idx] === sl); }
      } else if (v.paused) {
        playWhenReady(v, () => owned && slides[idx] === sl);
      }
    });
  }

  /* ---------- the bar is the FILM's progress, not a timer beside it ----------
     🔴 It used to be a wall clock that started on a slide change and was
     killed by stopClock() — which every wheel event calls. So on any slide
     you actually scrolled to, the bar froze wherever the first wheel event
     caught it, and the only one that ever looked right was the LAST: its
     branch paints a flat 100% and never has to run at all. That is the
     "黑色只显示在最后一个".

     Now the fraction is read from the video itself — currentTime/duration,
     so it is that slide's real length by construction, not a number typed
     next to it — and the loop keeps painting for as long as the deck is on
     screen, whatever the reader's hands are doing. A slide with no film
     falls back to SLIDE_MS, which is the only case where a fixed duration
     is a guess rather than a fact.

     What a gesture suspends is the AUTO-ADVANCE, not the painting. Those
     were one flag doing two jobs; separating them is the whole fix. */
  function barLoop(now) {
    if (!owned) { clockRaf = 0; return; }
    clockRaf = requestAnimationFrame(barLoop);

    /* 🔴 Once a slide is done it STAYS done until the next one starts.
       Without this the bar flickers at exactly the moment it matters: the
       film wraps, the frame paints a full black bar, and the very next
       frame reads currentTime 0.02 and paints 2% — a full-height flash
       followed by an empty bar, held for the whole length of the glide to
       the next slide. Latching it means the bar fills, stays filled, and
       leaves with its slide. */
    if (finished) {
      paintBar(1);
    } else {
      const v = slides[idx] && slides[idx].querySelector('.hero__video');
      /* the film plays once now, so `ended` is the truth and no wrap
         heuristic is needed. A slide with no film falls back to SLIDE_MS —
         the only case where the length is a guess rather than a fact. */
      const f = (v && v.duration)
        ? (v.ended ? 1 : Math.min(1, v.currentTime / v.duration))
        : Math.min(1, (now - clockStart) / SLIDE_MS);
      if (f >= 1) finished = true;
      paintBar(f);
    }

    /* Desktop gallery position belongs to page scroll, never to a film clock. */
    if (!PHONE && galleryDone) {
      syncFilm();
      return;
    }

    /* 🔴 OUTSIDE the branch above. When it was inside, a slide that
       finished while the advance was suspended (any wheel event does that)
       latched `finished`, took the early return every frame after, and
       never reached this check again — the deck stopped advancing for
       good. The bar being done and the deck being free to move are two
       different questions asked at two different times. */
    /* 🔴 手机上**不自动推进**。竖版四幕是四个普通段落，页面滚到哪儿是读者的
       事；片子播完就替他把页面往下滚一屏，是把滚动权拿走——他可能正想再看一遍，
       或者正在读文案。参照页（deepmind.google 手机版）也没有任何自动滚动。
       进度条照常填满（上面那段 paintBar 不受影响），填满了就停在那儿。
       桌面不变：那边 deck 占着四屏 sticky 轨道，index 自己走而滚动位置不动的话
       两者会打架，所以必须推页面——理由是上面那段注释。 */
    if (!PHONE && finished && running && idx < N - 1 && !assisting && now > lockUntil) {
      running = false;
      leaving = true;
      glide(anchorY(idx + 1));
    }

    /* 🔴 Asserted from the frame loop, not only from scroll events. A wheel
       event suspends the advance without necessarily moving the page, and
       if nothing scrolls afterwards there is no scroll frame to notice that
       the film has ended and should go back to looping — measured: frozen
       on the last frame, deck parked, indefinitely. */
    syncFilm();
  }

  function startClock() {
    if (!PHONE && galleryDone) {
      /* Gallery films deliberately hold their last frame once they finish,
         but a card becoming current again is a new viewing. This includes
         returning from Meet while idx is still the final card — no goHero()
         transition occurs in that case, so this ownership edge is the only
         reliable place to rewind it.

         Rewinding alone is not enough. In WebKit, seeking an ended video is
         asynchronous: syncFilm() can still see `ended === true` in the same
         frame and deliberately hold the last frame, with no later scroll
         event to give it another chance. Start playback here as part of the
         same arrival transaction, then keep barLoop alive so a delayed seek
         or canplay is re-asserted while this card remains current. */
      clockStart = performance.now();
      finished = false;
      leaving = false;
      running = false;
      const gallerySlide = slides[idx];
      const galleryVideo = gallerySlide && gallerySlide.querySelector('.hero__video');
      if (galleryVideo) {
        const stillWanted = () => owned && slides[idx] === gallerySlide;
        const replay = () => {
          if (!stillWanted()) return;
          try { galleryVideo.currentTime = 0; } catch (e) {}
          playWhenReady(galleryVideo, stillWanted);
        };
        if (galleryVideo.readyState >= 1) replay();
        else galleryVideo.addEventListener('loadedmetadata', replay, { once: true });
      }
      if (!clockRaf && owned) clockRaf = requestAnimationFrame(barLoop);
      return;
    }
    clockStart = performance.now();
    finished = false;
    leaving = false;
    running = !REDUCED && idx < N - 1;
    /* 🔴 REWIND on arrival. Leaving a slide only pauses its film, and with
       `loop` on it can be anywhere in its length — so a slide re-entered
       mid-film would show a bar starting at 60%. syncFilm() does the
       playing; this only decides where it starts from.

       🔴 UNLESS THE INTRO IS STILL CARRYING IT. The opener's flip card and
       slide one's <video> are two elements showing one film as a single
       continuous take (see the handover at the foot of intro.js), and this
       function fires exactly when the deck takes the screen — which is the
       middle of that take, not the start of a new one. Rewinding there is the
       film playing a second time right after it finished growing into place:
       the card ran 0 → 0.5, the deck cut back to 0 and ran it again.

       This handler is rAF-gated and intro.js's is not, so the two disagree
       about which frame the pin happened on and the rewind could land BEFORE
       the handover delivered its playhead — measured 16ms before. So the
       intro claims the element at the turn instead, a viewport ahead of the
       pin, and the flag is what that claim looks like from this side. It is
       dropped by goHero(), so it only ever suppresses the one arrival it was
       set for. */
    const v = slides[idx] && slides[idx].querySelector('.hero__video');
    if (v && v.dataset.handoff !== '1') {
      if (v.readyState >= 1) { try { v.currentTime = 0; } catch (e) {} }
      else v.addEventListener('loadedmetadata', () => { try { v.currentTime = 0; } catch (e) {} }, { once: true });
    }
    if (!clockRaf && owned) clockRaf = requestAnimationFrame(barLoop);
  }

  /* only while the deck is actually on screen — otherwise it burns through
     all four slides while the reader is somewhere else on the page.

     🔴 Watch the STAGE, not the track. A threshold is a share of the
     TARGET, and the track is four viewports tall — 55% of it can never be
     on screen at once, so the clock never started at all. The stage is
     sticky and exactly one viewport, so it is the thing whose visibility
     actually means "the deck is in front of you". */
  const stageEl = $('.hero__stage');
  let onScreen = false;

  /* ---------- desktop: scroll-scrubbed exhibition ---------- */
  function drawGalleryBorder(slide) {
    if (PHONE || REDUCED || !slide) return;
    slide.classList.remove('is-border-drawing');
    void slide.offsetWidth;
    slide.classList.add('is-border-drawing');
  }

  /* Finish the lateral journey just before the sticky section releases.
     The final 10% of vertical runway is a small reading beat for the last
     card: the page still responds normally, but the exhibition holds its
     composition instead of dropping into Meet as soon as card four lands. */
  const galleryProgress = (scrollProgress) =>
    Math.max(0, Math.min(1, scrollProgress / 0.9));

  function positionGalleryAt(progress) {
    if (PHONE || !galleryDone) return;
    const first = slides[0], last = slides[N - 1];
    if (!first || !last) return;
    const a = first.offsetLeft + first.offsetWidth / 2;
    const b = last.offsetLeft + last.offsetWidth / 2;
    const centre = a + (b - a) * Math.max(0, Math.min(1, progress));
    stack.style.setProperty('--gallery-x', (-centre).toFixed(2) + 'px');
  }

  function initDesktopGallery() {
    if (PHONE) return;

    /* The title and rail must share one sticky coordinate system. Keeping the
       title as a sibling made it stay pinned until the section boundary and
       then disappear in one frame, while the stage itself was already moving
       away. On desktop only, place that same node inside the stage so both
       layers release and travel upward as a single composition. */
    const sectionTitle = track.querySelector('.hero__section-title');
    if (stageEl && sectionTitle && sectionTitle.parentElement !== stageEl) {
      stageEl.prepend(sectionTitle);
    }

    /* Every card needs its poster immediately because neighbouring cards are
       visible from the moment the exhibition enters the viewport. */
    slides.forEach(slide => {
      if (!slide.dataset.img) return;
      slide.style.setProperty('--slide-img', `url("${slide.dataset.img}")`);
      delete slide.dataset.img;
    });

    /* One quiet poster-only duplicate at each end means the first and last
       real cards still have a dim frame visible on both sides. Originals are
       the only cards with video and remain the only interactive state. */
    const ghost = (source) => {
      const copy = source.cloneNode(true);
      copy.classList.remove('is-active', 'is-out', 'is-copy-in');
      copy.classList.add('hero__slide--ghost');
      copy.setAttribute('aria-hidden', 'true');
      copy.querySelectorAll('video').forEach(video => video.remove());
      return copy;
    };
    stack.prepend(ghost(slides[N - 1]));
    stack.append(ghost(slides[0]));

    track.classList.add('hero--gallery');
    requestAnimationFrame(() => {
      positionGalleryAt(0);
      requestAnimationFrame(() => track.classList.add('hero--gallery-ready'));
    });
  }

  initDesktopGallery();

  /* ---------- "on screen" is not "in front of you" ----------
     🔴 The observer fires the moment the stage's first pixel appears, and
     the film started there — a whole viewport of scrolling before the deck
     actually takes the screen. By the time you were looking at it the
     first film was already seconds in, so it "ended" early and the deck
     moved on before you had seen it. Measured: advancing 5.3s into a 6.21s
     film, i.e. it had been running ~0.9s off screen.

     The stage is sticky and exactly one viewport tall, so PINNED is the
     honest test: top at 0 and bottom at the viewport floor means the deck
     is the screen. 2px of slack for sub-pixel layout. */
  let owned = false;
  /* 第一张文案入场的一次性闩，见 onScroll 里 `owned && !wasOwned` 那一段。
     ⚠️ 若 intro 的翻卡桥接哪天又接回 deck，它会先加上 .is-copy-in，这里再
     add 一次是幂等的；但那时应当把这个闩也置真，否则桥接播完这里还会再播。 */
  let firstCopyIn = false;
  const stagePinned = () => {
    if (!stageEl) return false;
    const r = stageEl.getBoundingClientRect();
    /* 🔴 手机上没有「钉住」这回事——舞台不再 sticky、也不再是一个视口高
       （hero.css 末尾那块把它改成了普通内容块）。下面那套 top<=2 的判据在横版
       里恒为 false，于是 owned 永远是 false，syncFilm 的第一个分支会把四支片子
       全部 pause 掉：读者划到 deck，四张卡片全是静止的 poster。

       横版里 owned 该问的是「这段在不在读者眼前」，所以量交叠：舞台可见的部分
       超过它自己和视口中较矮的那个的一半，就算它在前面。 */
    if (PHONE) {
      /* 🔴 「有没有交叠」就够，不要再要求过半。竖版四幕里 stage 高约 1572，
         读者停在最后一幕时它露出来的只有最后 600 多，`> min(高, 视口)/2`
         那条在边缘位置会翻成 false，于是最后一幕的片子被 syncFilm 一律 pause
         ——实测幕 4 owned=false、playing=-1。
         放宽是安全的：真正播哪一支由 idx 决定，而 idx 是「中心最接近视口中心
         的那一幕」（下面 pickScene），它按定义就在屏内。 */
      /* 最后 25% 已经在滑出，poster 足够承接这一小截；此时提前交还视频缓冲，
         给紧邻的 Meet 图片与 Rive 留出峰值空间。向上返回时超过 25% 再恢复。 */
      return Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0) > window.innerHeight * 0.25;
    }
    /* 🔴 跟**舞台自己的高度**比，不跟 window.innerHeight 比。

       上面那段注释的前提是「舞台正好一个视口高」——在 iOS Safari 上这个前提
       会失效，而且是**往下滑的时候**失效：

         .hero__stage 是 100svh，svh = 工具栏展开时的高度（固定值）
         往下滑 → iOS 收起工具栏 → innerHeight 涨到大视口（多出 ~75–90px）
         舞台还是 svh，于是 r.bottom 比 innerHeight 矮了一整条工具栏
         → 这个判定返回 false → owned 为 false
         → syncFilm 第一个分支每帧把所有视频 pause 掉

       往回滑一点，iOS 又把工具栏展开，innerHeight 缩回去，判定重新通过，
       视频就播了。用户 2026-08-30 报了四轮的「下滑不播、上滑播」正是这个，
       而且他描述得很准：「要我往回滑动一下才可以」。

       🔴 前三次修都修错了地方（preload 不够 / 等 canplay / 被拒后 load()）——
       全在猜媒体加载，而 play() 根本就没被调用过。无头浏览器和模拟器都没有
       会收起的工具栏，所以三轮都复现不了，这也是为什么三次都没验出来。

       min(innerHeight, r.height) 让判定只问「舞台顶边贴着 0 没有」：
       r.top <= 2 且 r.bottom >= r.height - 2 等价于 r.top ∈ [-2, 2]，
       也就是原注释真正想表达的「pinned」，而且跟工具栏状态无关。 */
    return r.top <= 2 && r.bottom >= Math.min(window.innerHeight, r.height) - 2;
  };

  /* 🔴 threshold: 0.1 not 0.5. The stage has overflow:hidden which causes
     some browsers to report a lower intersecting ratio than expected. A lower
     threshold catches it reliably. The isIntersecting check is the real gate. */
  new IntersectionObserver((es) => {
    es.forEach((e) => {
      onScreen = e.isIntersecting;
      /* leaving is immediate; ARRIVING is decided by stagePinned() in the
         scroll frame, which is a stricter test than this one.
         🔴 …but the scroll frame has to be ASKED. The observer fires a beat
         after the scroll event that caused it, so the last onScroll() ran
         while onScreen was still false and nothing recomputed ownership
         afterwards. Land on the deck in one jump and stop, and the film
         never started — measured: pinned, dot expanded, fill 0, video
         paused at 0, indefinitely. */
      if (!onScreen) { owned = false; stopClock(); }
      else onScroll();
      syncFilm();
    });
  }, { threshold: 0.1 }).observe(stageEl || track);

  /* Fallback: if the hero is the first thing on screen (e.g., no intro above),
     the observer may fire before JS has fully initialised the clock variables.
     Re-check once the document is definitely settled. */
  requestAnimationFrame(() => {
    if (!onScreen && stageEl) {
      const r = stageEl.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) {
        onScreen = true;
        onScroll();
      }
    }
  });

  /* ---------- a gesture is one slide ----------
     🔴 Counted from where the gesture STARTED, not from where the native
     scroll left you. Reading the position at the end makes a hard flick
     worth two slides and a gentle one worth one, which is the scrubbing
     behaviour this was meant to replace — measured: a firm swipe from
     slide 0 landed on slide 2. Latch the index on the first wheel event
     and the answer is one, every time, at any force. */
  let lastY = window.scrollY, dir = 1, gestureFrom = -1;

  function settleToSlide() {
    if (!PHONE && galleryDone) { gestureFrom = -1; return; }
    /* 🔴 横版整个不走这里。这一段做的是「把一次纵向手势折算成一张幻灯，再
       glide 到那张的锚点」——横版里那个折算由**原生 scroll-snap** 做，做得
       比这准（它知道手指的速度和位置，我们只知道方向）。留着的话，读者纵向
       划过 deck 时每一次停顿都会被折算成一次换张，而轨道并没有动。
       只把 `running` 续上：手势监听器每次都 stopClock()，没人续就再也不自动
       推进了（竖版里那件事是下面 `gestureFrom < 0` 那支干的）。 */
    if (PHONE) { running = !REDUCED && idx < N - 1; gestureFrom = -1; return; }
    if (!owned || assisting) { gestureFrom = -1; return; }
    /* 🔴 No latched gesture means no gesture happened — a scroll event on
       its own must NOT be worth a slide. Falling back to `idx` here made
       every stray event (the tail of our own glide, an anchor jump, the
       browser's own residue) advance the deck, and they arrive in runs: a
       single swipe from slide 0 walked all the way to slide 3. The gesture
       listener is the only thing allowed to authorise a move. */
    if (gestureFrom < 0) {
      /* the gesture ended without asking for a slide — re-arm the advance
         it suspended, or one stray wheel event stops the deck advancing
         for the rest of the session */
      running = !REDUCED && idx < N - 1;
      return;
    }
    const from = gestureFrom;
    gestureFrom = -1;
    const want = from + (dir > 0 ? 1 : -1);
    if (want < 0 || want > N - 1) return;      // let the page leave the deck

    /* 🔴 手势落在自己身上的时候，时钟得自己续上。
       每个 wheel 事件都会 stopClock()，而能把 `running` 设回来的只有两处：
       startClock()（只在 `want !== idx` 时跑）和上面那条「没有手势」的分支。
       两处都盖不住读者**进场**的那条最常见路径 —— 手势是从它开始的那一张
       算的（gestureFrom），可滚轮的惯性往往已经把 idx 带到了 want：

         滚轮把页面带过中点 → idx 已经是 1 → settle 求出的 want 也是 1 →
         glide 到**当前这张**的锚点 → `want !== idx` 为假 → startClock() 不跑
         → running 停在最后一个 wheel 留下的 false。

       实测（滚轮滑进 deck 后放手）：片子放完、进度条填到 100%，deck 就永远
       停在那儿（用户 2026-08-29：「怎么不会自动轮播了」）。

       🔴 只补这一格，别去 glide 的 landed() 里补。那里对**每次**落地都生效，
       包括自动进片自己的 glide —— 实测会连锁：一次 scrollTo 之后 3 秒内连跳
       两张，最后冲出 deck 停在 23890。这里只在「手势没换张」时补，进片路径
       一次都碰不到。 */
    if (want === idx) running = !REDUCED && idx < N - 1;

    glide(anchorY(want));
  }

  addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!assisting && performance.now() > lockUntil) {
      if (Math.abs(y - lastY) > 1) dir = y > lastY ? 1 : -1;
      clearTimeout(quiet);
      quiet = setTimeout(settleToSlide, QUIET);
    }
    lastY = y;
    onScroll();
  }, { passive: true });

  /* ---------- 手机：离视口中心最近的那一幕，就是当前那一幕 ----------
     🔴 这是竖版四幕里 idx 的**唯一**来源，对应桌面 onScroll 里那句
     `Math.round(p * (N - 1))`。goHero 之后的一切照旧：换 is-active、换 chrome、
     重置 handoff 标记；startClock 重开这一幕的时钟；syncFilm 播这一幕的片子、
     并把下一幕预热起来。

     🔴 走过两版 IntersectionObserver，都不成立，原因是同一个：**幕比视口矮**。
       · `threshold: .55`（过半即当前）—— 幕曾经是一屏高时对；改成内容高度
         （约 394px）之后一屏能装下两幕，两幕的 ratio 同时超过 .55，idx 在相邻
         两幕之间来回跳，第 3 幕直接没播。
       · `rootMargin: -42%`（只认视口中间一条带）—— 带只有 135px，而幕之间还有
         留白，读者停在两幕交界处时**谁都不在带内**，idx 停在上一幕。实测幕 1
         和幕 4 判错。
     直接量四个 rect 取最近的那个，没有阈值，任何滚动位置都有确定答案。开销是
     每帧四次 getBoundingClientRect，用 rAF 节流后与原来的 onScroll 同一个量级。 */
  if (PHONE) {
    /* 卡片文案自己的入场只播一次，不能复用 is-copy-in：后者会随着当前影片切换
       反复增删，正是标题看起来“本来就在、下滑又出现一次”的来源。 */
    if (REDUCED) {
      slides.forEach((slide) => slide.classList.add('is-card-revealed'));
    } else {
      const cardReveal = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-card-revealed');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
      slides.forEach((slide) => cardReveal.observe(slide));
    }

    let raf2 = 0;
    const pickScene = () => {
      const mid = window.innerHeight / 2;
      let best = idx, bestD = Infinity;
      for (let i = 0; i < slides.length; i++) {
        const r = slides[i].getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best !== idx) {
        goHero(best);
        if (owned) startClock();
      }
      syncFilm();
    };
    addEventListener('scroll', () => {
      if (raf2) return;
      raf2 = requestAnimationFrame(() => { raf2 = 0; pickScene(); });
    }, { passive: true });
    pickScene();
  }

  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((e) =>
    addEventListener(e, () => {
      if (!PHONE && galleryDone) return;
      /* `owned`, not `onScreen` — and not during the arrival beat */
      if (!owned || performance.now() < lockUntil) return;
      if (gestureFrom < 0) gestureFrom = idx;   // the first input of this gesture
      stopClock();
      stopGlide();
    }, { passive: true }));

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const { top, range } = metrics();
      const p = Math.max(0, Math.min(1, (window.scrollY - top) / range));
      const galleryP = galleryProgress(p);
      /* 🔴 横版里纵向滚动**不换张**。段高已经缩到一屏出头，range 是个几十像素
         的残值，`Math.round(p * 3)` 会在读者路过这一段的几帧里从 0 跳到 3 ——
         也就是页面自己把 deck 快进到最后一张。横版的 idx 只有一个来源：轨道的
         scrollLeft（见下面 stack 的 scroll 监听）。 */
      const want = PHONE ? idx : Math.round(galleryP * (N - 1));
      if (!PHONE && galleryDone) positionGalleryAt(galleryP);
      const wasOwned = owned;
      /* 🔴 手机上不看 onScreen。它由观察 stage 的 IntersectionObserver 写，
         threshold 0.1；竖版四幕里 stage 高约 1572，读者在段内移动时 ratio 一直
         在 0.1 以上、从不跨阈值，观察器就不再回调——onScreen 因此停在读者**进段
         之前**的那个值上。实测最后一幕 owned=false、片子被 syncFilm 一律 pause。
         stagePinned() 在手机分支里已经是「stage 与视口有交叠」，它每帧现算，
         本来就够回答「这段在不在眼前」。 */
      owned = PHONE ? stagePinned() : (onScreen && stagePinned());

      if (want !== idx) {
        goHero(want);
        if (owned) startClock();               // a new slide, a new film from the top
      } else if (owned && !wasOwned) {
        startClock();                          // the deck has just taken the screen
        lockUntil = performance.now() + ARRIVE_MS;
        if (!PHONE && galleryDone) drawGalleryBorder(slides[idx]);
        /* 🔴 第一张的文案入场，2026-09-05 补。用户：「Hero deck 的文字动画…就是
           没动效了，感觉应该就是直接出现。线上好像是有动画的啊。」

           它确实曾经有：hero.js 故意**不给** slides[0] 加 .is-copy-in（见上面
           那段注释「the first slide is the deck's resting state from load; its
           copy waits for the intro's flip to deliver it」），由 intro.js 的翻卡
           桥接在 pastIntro 那一刻补上。但开场早就改成 intro → **hub** 了，deck
           退到 hub 后面，那条桥接对第一张再也没跑过——实测从 0 滚到 hero，
           slides[0] 全程只有 is-active，一次 .is-copy-in 都没拿到。所以第一句
           标题是**页面加载时就摆在那里**的，读者滚到它跟前时什么也不会发生。
           后面三张一直是好的（goHero 每次都加），所以问题只在第一张。

           🔴 挂在 `owned && !wasOwned` 上，不是挂在 IntersectionObserver 上。
           那个观察器的 threshold 是 0.1，舞台又很高，10% 可见时这行字还在屏幕
           外——在那儿播就是重演上面注释记的老毛病（「hanging the copy on
           .is-active played its entrance while the reader was still three
           sections above it」）。stagePinned() 是严格得多的判据：舞台真的钉住
           了，字就在眼前。

           ⚠️ 一次性。这个分支每次 deck 重新拿到屏幕都会进（滚开再滚回来），
           不加闩就会每次重播一遍第一张的擦除。
           ⚠️ 只在第一张还是当前张时补。滚开时若已经翻到第 3 张，回来再给
           slides[0] 挂类，等于给一张看不见的幻灯片播入场，而且类会留在上面。 */
        if (!firstCopyIn && idx === 0) {
          firstCopyIn = true;
          slides[0].classList.add('is-copy-in');
        }
      } else if (!owned && wasOwned) {
        stopClock();
      }
      syncFilm();

      /* stage 的底边就是 Meet 的顶边。滑到视口上方 25% 这条线时，最后一幕只剩
         一小截 poster，主动清空四支视频；仅 pause 无法释放 Safari 解码内存。 */
      if (PHONE && stageEl.getBoundingClientRect().bottom <= window.innerHeight * 0.25 && !phoneFilmsReleased) {
        releasePhoneFilms();
      }

      /* `caught` is the deck's own arrival latch. The clock lockup this
         used to drive is gone — the intro's dot opens out into the film
         now — so what is left here is only "has this section taken the
         screen yet". */
      if (window.scrollY >= top) {
        caught = true;
      } else {
        caught = false;
      }
    });
  }

  addEventListener('resize', () => {
    onScroll();
    if (galleryDone) {
      const { top, range } = metrics();
      positionGalleryAt(galleryProgress((window.scrollY - top) / range));
    }
  });
  onScroll();

  /* ---------- calibrate each mask so it fully covers the stage ----------
     A fixed 400% leaves gaps on anything that isn't round, so we ray-march
     each shape off the stage and take its worst-case ratio. The hexagon
     and squircle both cover later than a circle does. */
  /* 🔴 1.6, not 1.8, and the number is chosen by where it lands the PLATEAU,
     not by how safe it feels. mask-end sets the scale of the whole grow
     curve, so the height the shape holds at mid-move is .117 × mask-end.
     At 1.8 the worst case came to 514% and the hold sat at 60% of the
     screen; labs.google holds at 52–54%. 1.6 gives 457% and a 53.5% hold —
     theirs, and still 60% more scale than is needed to cover the stage. */
  const MASK_HEADROOM = 1.8;

  function measureCoverScale(url, elW, elH) {
    return new Promise((resolve) => {
      /* a not-yet-laid-out element reports 0×0; the ratio below would then be
         Infinity/NaN and getImageData throws. 400 is the same safe fallback
         the other bail-outs use. */
      if (!(elW > 0) || !(elH > 0)) return resolve(400);
      const m = /url\(\s*(['"]?)([\s\S]*?)\1\s*\)/.exec(url);
      if (!m) return resolve(400);
      const img = new Image();
      img.onload = () => {
        const W = 300, H = Math.max(2, Math.round(W * elH / elW));
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d', { willReadFrequently: true });

        const ar = (img.naturalWidth || 1) / (img.naturalHeight || 1);
        let dw = W, dh = W / ar;
        if (dh > H) { dh = H; dw = H * ar; }
        ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);

        const px = ctx.getImageData(0, 0, W, H).data;
        const solid = (x, y) => {
          x |= 0; y |= 0;
          return x >= 0 && y >= 0 && x < W && y < H && px[(y * W + x) * 4 + 3] > 127;
        };
        const cx = W / 2, cy = H / 2;
        if (!solid(cx, cy)) return resolve(400);

        const lim = Math.hypot(W, H);
        let need = 1;
        for (let i = 0; i < 720; i++) {
          const a = i * Math.PI / 360, dx = Math.cos(a), dy = Math.sin(a);
          let f = 0;
          for (let r = 0.5; r < lim; r += 0.5) {
            if (!solid(cx + dx * r, cy + dy * r)) break;
            f = r;
          }
          if (f <= 0) continue;
          const rr = Math.min(Math.abs(cx / dx) || Infinity, Math.abs(cy / dy) || Infinity);
          need = Math.max(need, rr / f);
        }
        resolve(Math.min(need * MASK_HEADROOM, 60) * 100);
      };
      img.onerror = () => resolve(400);
      img.src = m[2];
    });
  }

  let calTimer = null;
  /* One --mask-end per slide, measured from its own shape — labs-clone's
     behaviour. (A pass in between shared one value across all four, copying
     labs.google's flat 400%. That does make the four plateau at the same
     height, but it is not what this deck was built from, and it forces
     every shape to carry the worst shape's overshoot.) */
  function calibrate() {
    const r = $('.hero__stage').getBoundingClientRect();
    slides.forEach((slide, i) => {
      measureCoverScale(SHAPE(SLIDES[i].mask), r.width, r.height)
        .then((pct) => slide.style.setProperty('--mask-end', pct.toFixed(1) + '%'));
    });
  }
  calibrate();
  addEventListener('resize', () => {
    clearTimeout(calTimer);
    calTimer = setTimeout(calibrate, 400);
  });

})();
