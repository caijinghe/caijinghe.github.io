/* ============================================================
   INTRO — two scenes on one scroll, after squareup.com.

   Scene one is the film, full screen, with no type on it at all.
   Scrolling shrinks it — the same element, never swapped — until it is
   one tile among the grid that was behind it the whole time. Scene two
   is that grid plus the slogan, which is read out a word at a time as
   you keep going.
   ============================================================ */
(function () {
  const intro = document.querySelector('.intro');
  if (!intro) return;

  const cover = intro.querySelector('.intro__cover');
  const video = intro.querySelector('.intro__video');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DESKTOP = matchMedia('(min-width: 768px)').matches;
  const RESUME_SCROLL_KEY = 'nestify-home-scroll-y-desktop';
  const resumeScrollY = (() => {
    try {
      const saved = Number(sessionStorage.getItem(RESUME_SCROLL_KEY)) || 0;
      return Math.max(0, saved || window.scrollY);
    }
    catch (e) { return window.scrollY; }
  })();
  const navigation = performance.getEntriesByType('navigation')[0];
  const RESUMING_AWAY_FROM_TOP = DESKTOP && !REDUCED &&
    navigation?.type === 'reload' && resumeScrollY > 8;
  /* 🔴 手机上翻卡的两个面改用静帧（用户 2026-08-30 同意，为止住 iOS 闪退）。
     实测手机上全页有 8 个 <video> 元素、只有 5 个文件——三对重名，其中两对
     就是这张卡的正反面：flip__front 与 intro__media 同为 hero-frugal.mp4，
     flip__back 与 hero 第一张同为 hero-one-place.mp4。而 7 个都停在
     readyState 4（preload 拦不住，浏览器有带宽就一路缓冲到底），于是八条
     解码管线同时活着，iOS 对并发解码器的限制远比桌面严。

     换成 <img> 省的是**解码管线**，不是下载——那两个文件本来就还在别处加载。
     代价写在下面 flip__back 那段长注释里：静帧在整个放大过程中是"死"的，
     那正是当年从静帧换回 <video> 的理由。手机上接受这个代价，桌面不变。 */
  const PHONE = matchMedia('(max-width: 767px)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  const stage = intro.querySelector('.intro__stage');
  const media = intro.querySelector('.intro__media');
  /* 🔴 RESTORED. This had lost its declaration while still being read 13
     times — buildCopy, revealCopy, the --lit write, the sub lookup, the
     frame's reveal gate. Each read threw ReferenceError from inside
     frame(), which aborts the whole scroll handler, so scene two's sentence
     never revealed at all. (Same failure as the hero lockup below; they
     surfaced one at a time because the first throw hides the rest.) */
  const copy = intro.querySelector('.intro__copy');
  /* the film's landing box, inline in the sentence — slotRect() reads it
     every frame, so it must exist for the whole shrink */
  const slot = intro.querySelector('.intro__slot');

  /* carrier element kept as a no-op so any downstream code that references
     it does not throw — it stays hidden at all times now that the word-fly
     animation between screens has been removed. */
  const carrier = document.createElement('i');
  carrier.className = 'intro__carry';
  carrier.setAttribute('aria-hidden', 'true');
  carrier.style.opacity = '0';
  document.body.appendChild(carrier);
  const heroEl = document.querySelector('.hero');
  const caret = intro.querySelector('.intro__caret');
  const heroLine = intro.querySelector('.intro__hero-line');
  const heroCopy = intro.querySelector('.intro__hero');

  /* ---------- the flip card: intro tile → hero slide 1 ----------
     A fixed-position card bridges the intro tile (small, 16:10) to
     hero slide 1 (large square). The front face mirrors the intro
     footage; the back reveals slide one's picture. JS drives every
     property each frame — no CSS transition — so the flip is perfectly
     coupled to the scroll.

     Geometry trick: the hero__inner's offset from its sticky
     parent (.hero__stage) is measured once. That offset equals the
     element's viewport coordinates when the stage pins at top:0,
     which is exactly where the flipper needs to land. */
  /* 🔴 0.85 → 0.50（2026-09-04）。转场原本只占行程最后 15% = 432px；
     用户加了「设备线框 → 线稿 → 上色」三拍之后，实测一次滚轮就从头冲到尾
     （「从那个屏幕一滑就过去了」）。翻卡与落位不受影响——它们按像素钉住了，
     见下面 LEGACY_RAMP。

     🔴 0.50 → 0.574（2026-09-04）：intro 段高从 420 加到 520svh，加的那一屏
     全部给换词（理由见 intro.css 的段高注释）。这里同步抬高，是为了让**转场
     那一段的像素长度基本不变**——0.50 配 420svh 是 2156px，0.574 配 520svh
     是 2311px。不抬的话转场会白白多吃掉一整屏。 */
  const FLIP_FROM = 0.574, FLIP_TO = 1.00;
  /* how much scroll the deck's first line takes to be written, measured
     BACK from the pin so it finishes as the deck arrives. ~0.6 of a
     viewport: long enough to read as writing rather than a flash, short
     enough that the words are never on their own. */
  const WIPE_PX = 560;
  /* easeInOutCubic — accelerates and decelerates, which is what a
     card flip feels like in reality */
  const flipEaseIO = t => t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const flipper = document.createElement('div');
  flipper.className = 'intro__flipper';
  flipper.setAttribute('aria-hidden', 'true');
  flipper.innerHTML = `
    <div class="flip__inner">
      <!-- 🔴 正面**必须仍是开场影片**。2026-09-04 我一度把它也换成 UI 静图，
           用户当场指出「翻卡应该是从视频渐变到最终的 UI，你中间夹了一张别的
           图片」——说得对：正面换成静图之后，句子里那块在 FLIP_FROM 那一刻
           从影片硬切成 UI，翻转本身反而没东西可交代了。影片 → 转 → UI 才是
           这张卡存在的理由，中间不该再插一次替换。 -->
      <div class="flip__front">
        ${PHONE
          ? '<img src="assets/hero-frugal-poster.jpg" alt="" decoding="async">'
          : '<video src="assets/hero-frugal.mp4" muted loop playsinline></video>'}
      </div>
      <!-- 🔴 背面是**线框**，不是设备照片。节点在 index.html 里（#deviceFrame），
           启动时搬进来——理由见那边的注释（字标是 9KB 的 path 数据）。

           2026-09-04 改过三次，三次的话都记着：
             ① 两面同一支影片 —— 为了不在翻转途中夹第三张图。
             ② 背面换成整台设备的静图 —— 用户「翻过来以后什么都没变」。
             ③ 背面换成**线框** —— 用户看过 ② 之后：「我觉得我们不需要变成真的，
                先拿这个线稿，它下来就变成一个跟后面那个屏幕一样的、线稿那个颜色
                一样的。」

           ③ 顺手解决了 ② 的毛病：一台**全彩照片级**的设备浮在极淡的手绘线稿上，
           两种材质对不上。现在设备和房间在同一支笔里起笔，最后一起落成实体。 -->
      <div class="flip__back">
      </div>
    </div>`;
  document.body.appendChild(flipper);
  const flipInner = flipper.querySelector('.flip__inner');
  const flipFront = flipper.querySelector('.flip__front');
  const flipBack  = flipper.querySelector('.flip__back');
  /* 线框节点搬家：它在标记里，搬进翻卡的背面。用 appendChild 而不是复制，
     是为了让 index.html 始终是它唯一的定义处。 */
  const frameSvg = document.getElementById('deviceFrame');
  if (frameSvg && flipBack) flipBack.appendChild(frameSvg);
  /* 🔴 扫描的亮片是**独立的固定层**，不在卡片里。它必须压在**真机**上面——
     落位那一刻卡片就撤了，光扫的是真正那台 3D 机器，所以它不能是卡片的子元素。
     z-index 见 intro.css，比 flipper(500) 和 hub 的舞台都高。 */
  const scan = document.createElement('div');
  scan.className = 'intro__scan';
  scan.setAttribute('aria-hidden', 'true');
  scan.innerHTML = '<i></i>';
  document.body.appendChild(scan);

  /* 🔴 闪光**不跟滚动**。用户 2026-09-04：「闪光能不能不要受到用户滑动的影响
     呀」——说得对：一道掠光的快慢是它自己的性质，跟读者手指多快无关。挂在滚动
     进度上时，滚快了它一闪而过、滚慢了它就凝固在半路，两种都不像「闪」。

     所以滚动只负责**扣扳机**，播放走 rAF 的自有时钟。必须是独立的 rAF：主
     滚动回调只在滚动时触发，读者一停手就不再跑，光会卡在半路。

     迟滞：越过 FLASH_AT 触发一次就下膛，要退回 FLASH_AT-0.05 以下才重新上膛，
     免得读者在阈值上来回蹭导致连闪不停。 */
  const FLASH_AT = 0.60;
  const FLASH_MS = 900;
  let flashT0 = 0, flashArmed = true, flashRAF = 0;

  function paintScan(t) {
    /* 位置每帧现量真机：闪光发生在舞台已经释放之后，拿 sticky 舞台的矩形推会
       算到屏幕外去（踩过，光整个跑到 top -445）。真机稳在原地，按它算才不漂。
       外扩 9% 是为了盖住 3D 外壳——它画在 canvas 上、比屏幕矩形大一圈。 */
    const pv = document.querySelector('.hub__pad');
    if (pv) {
      const pr = pv.getBoundingClientRect();
      const ex = pr.width * 0.09;
      scan.style.left   = (pr.left - ex).toFixed(1) + 'px';
      scan.style.top    = (pr.top  - ex * 0.56).toFixed(1) + 'px';
      scan.style.width  = (pr.width  + ex * 2).toFixed(1) + 'px';
      scan.style.height = (pr.height + ex * 1.12).toFixed(1) + 'px';
    }
    scan.style.setProperty('--scan-x', (-120 + t * 340).toFixed(1) + '%');
    scan.style.opacity = (t <= 0 || t >= 1) ? '0'
      : (Math.sin(t * Math.PI) ** 0.55).toFixed(3);
  }
  function flashLoop(now) {
    const t = (now - flashT0) / FLASH_MS;
    paintScan(Math.min(1, t));
    if (t < 1) { flashRAF = requestAnimationFrame(flashLoop); }
    else { flashRAF = 0; paintScan(0); }
  }

  const hubEl = document.querySelector('.hub');
  let padChrome = null;   /* 真机的圆角，落位前卡片要收敛到它 */
  const backVid   = flipBack.querySelector('video');
  /* ---------- the back face is the picture the card lands on ----------
     🔴 IT IS A <video> AGAIN. This block has now been argued both ways, and
     which one is right is decided entirely by what slide one IS — so keep
     both halves of the history, because the next asset swap re-opens it:

     Slide one was hero1.mp4, and the back face was a still. That meant a
     film played on the front, then a frozen frame swelled across the whole
     growth — measured, the back half is 1301px of a 1789px flip, 73% of it,
     and it is the half that GROWS — and only then did a film start. Nothing
     jumped, the two rects at the swap measured [0,0,0,0] apart, but the
     picture was DEAD for the entire enlargement and abruptly alive at the
     end, which reads as a dropped beat even though no frame is dropped.

     Slide one then became a WebP still, and with it the whole apparatus went
     away as dead weight: a still swelling into a still is not a dropped
     beat, it is the picture arriving.

     🔴 SLIDE ONE IS A FILM ONCE MORE (hero.js), so the first case is back
     and so is its fix: the back face starts from zero the instant the card
     turns to it, and a playhead handover carries its currentTime into the
     deck's element so the cut between the two is invisible. hero.js never
     lost its half of this — `handoff` and `spent` are read in syncFilm() and
     startClock() and cleared in goHero(); they were simply never set while
     there was no film. The three pieces that ARE here: the play at the 90°
     crossing (in the frame loop), the handover at the foot of this file, and
     the `handedOver` latch that keeps it firing once.

     🔴 THE POSTER IS THE ANSWER TO `preload`. It is a hint, and Safari
     honours it by fetching bytes and decoding nothing, so the card can turn
     over onto a black rectangle. `poster` is frame zero cut from the same
     mp4 with ffmpeg, so what the card paints before it can decode is the
     frame it is about to play — the same picture, not a stand-in for it.

     ⚠️ THE FILM IS NAMED IN TWO PLACES. It is here and in hero.js's SLIDES
     as slide one's `vid` (with the poster as its `img`). They must stay the
     same file or the card lands on a different picture than the one it turns
     into — which is the one failure this whole block exists to prevent.

     ⚠️ …AND THE ?v= HAS TO MATCH hero.js's ASSET_V. Same file, same URL:
     differ and the browser fetches 2MB twice and the two faces of the
     crossing can be two different takes. See the note on ASSET_V. */
  /* 手机上正面是 <img>，没有 video 可播 */
  { const fv = flipFront.querySelector('video'); if (fv) fv.play().catch(() => {}); }

  let heroInnerTarget = null;  /* cached hero__inner geometry (stable) */
  /* ---------- the copy rides the bridge too ----------
     🔴 The flip alone cannot close the seam, and this is why: the card is
     `position: fixed`, so it can stand where the hero's film WILL be while
     the intro is still the section on screen. The hero's own copy cannot —
     it is a full viewport further down the page. Revealing it as the card
     lands (which is what .is-copy-in does) reveals it OFF SCREEN, and the
     reader still arrives to a line that was already read.

     So the bridge carries the words as well: a fixed clone of slide one's
     copy, parked at the coordinates that copy will occupy once the hero
     stage pins, wiped in on the flip's own progress. When the stage does
     pin, the clone goes and the real one is already in place underneath —
     same words, same position, so the handover is not visible. */
  let heroCopyTarget = null, bridgeCopy = null;

  /* the crossing's two latches. `backStarted` is "this run of the film has
     begun", so re-crossing 90° resumes rather than rewinds; `handedOver` is
     "the playhead has been delivered", so the handover below fires once —
     `pastIntro` stays true for the rest of the page, and re-running it
     re-clamped the deck's film to a frozen instant on every scroll event. */
  let backStarted = false, handedOver = false;

  /* ---------- the gate: no opener until there is a picture behind it ----------
     The sheet is cream and the section behind it is cream, so the wordmark
     punched out of the sheet is cream on cream until the video has painted
     a frame — there is nothing in the hole to see. The wipe is on a fixed
     2s clock from page load, so a heavy video means the hold AND the wipe
     both run against a blank screen and the whole opener is simply gone by
     the time the picture lands. (Measured with the 10.7MB placeholder: first
     frame at ~3.5s, sheet finished at 2.0s.)

     So the opener runs on its OWN clock, started here: CSS keeps the sheet,
     and the header paused until `is-intro-go`. */
  const START_CAP = 2000;        // a stall must not hold the page hostage
  let started = false;
  function startOpener() {
    if (started) return;
    started = true;
    document.documentElement.classList.add('is-intro-go');
  }

  /* 🔴 keep this OFF any tone flip. `is-open` removes the sheet outright,
     and the sheet is wiped rather than dissolved — pulling it early would
     cut away whatever cream is still on screen at that instant. */
  function dropSheet() { intro.classList.add('is-open'); }

  if (RESUMING_AWAY_FROM_TOP) {
    /* A reload restores the reader's place. Replaying the full-screen film
       over that place is both visually wrong and delays the small, in-line
       film that belongs to scene two. */
    dropSheet();
    startOpener();
    intro.classList.add('is-opening-skipped');
  } else if (cover) {
    cover.addEventListener('animationend', () => { dropSheet(); typeHero(); }, { once: true });
    /* 🔴 2026-09-04：推迟一帧，不能同步调。
       typeHero() → showAll() → unlockOpener() 会读到 `typed`、
       `openerUnlockTimer` 等一串在**本文件后面**才声明的 let——同步调用发生在
       它们之前 = TDZ，抛 `Cannot access 'X' before initialization`。这句就在
       IIFE 顶层，一抛**整个 intro 模块当场死掉**：没有影片收缩、没有标题、
       没有翻卡。

       普通访客碰不到，因为上面那条挂在 animationend 上、早就跑到声明之后了；
       **只有开了「减弱动态效果」的人**每次都撞上。origin/main 上就有
       （那边是 213 行调、438 行才声明），2026-09-04 补 reduced-motion 覆盖、
       用 Playwright 的 reducedMotion:'reduce' 跑才照出来。

       修法取「推迟」而不是「把声明一个个上提」：TDZ 是级联的（修好 typed 就
       轮到 openerUnlockTimer），而这条分支的语义本来就是「跳过封面动画、直接
       到打完字的状态」，它没有任何理由必须发生在模块初始化的同一个 tick 里。
       下面那条没有 cover 的 else 同理。 */
    if (REDUCED) { dropSheet(); requestAnimationFrame(typeHero); }
  } else {
    requestAnimationFrame(typeHero);
  }

  /* ---------- scene one becomes scene two, on the scroll ----------
     Studied off squareup.com, measured rather than eyeballed: their hero
     film goes 1440×900 → 220×138 over the first ~300px of scroll, keeping
     its aspect and staying centred (the left edge is (viewport − width)/2
     at every frame), and it is the SAME element the whole way — never
     swapped for a smaller copy. The grid it lands in is already laid out
     behind it; the film shrinks through it and settles into one slot.

     Everything here hangs off one progress number so nothing can drift:
       0 → SHRINK_END        the film shrinks into its slot
       TILES_FROM → TILES_TO the grid it lands in comes up behind it
       COPY_FROM → COPY_TO   both lines of copy, together, in one move

     🔴 The film's target is read from the tile geometry, not typed in
     twice: --w on the tiles is a share of the stage, so the slot follows
     the same clamp they do and one edit moves both. */
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const SHRINK_END = 0.30;
  /* the sun: up behind the line, held while it is read, then drawn down to
     a point as the section releases and the hero's disc takes over */
  const HERO_OUT = 0.22;                    // scene one's line is gone by here
  const TILES_FROM = 0.10, TILES_TO = 0.36; // the grid behind the film
  /* 🔴 The copy used to be one scrubbed block, on the reasoning that
     staggering it "made the reader wait on the scroll for the second half of
     a sentence they could already see was coming". That reasoning was right
     about SCRUBBED staggers and wrong about staggers in general, and
     squareup's is the proof: theirs is a one-shot timeline on its OWN clock,
     fired when the line enters. The scroll only decides WHEN it starts —
     after that the words arrive at their own pace whether you keep scrolling
     or stop dead. Nobody ever waits on the wheel for a word.

     So COPY_FROM is now a trigger, not the start of a ramp; COPY_TO is gone
     with the ramp it belonged to. */
  const COPY_FROM = 0.28;                   // as the film lands, not after
  /* ---------- the grid, straight off squareup ----------
     Measured on `.hero-secondary-media-grid` at a 1440×900 window. The
     container is 1400×916 — WIDER than tall but taller than the fold,
     which is why theirs never reads as a neat 100vh box:

       tile          138px = 9.86% of the grid, square
       column pitch  22.54%  (the gap between two tiles is wider than a tile)
       5-wide rows   4.92 / 27.46 / 50 / 72.54 / 95.08 %
       4-wide rows   16.19 / 38.73 / 61.27 / 83.81 %   ← offset half a pitch
       rows at       7.5 / 29.15 / [50] / 70.85 / 92.47 % of the height

     Five row slots, and the MIDDLE ONE IS THE COPY — that is the bit that
     makes it read as a grid with a sentence set into it rather than as two
     clumps of pictures with a gap. The film lands in the centre slot of
     row 3, so it is one of the eighteen.

     🔴 Their film is 220×138 where a tile is 138×138 — it keeps a wide
     shape and matches the tile's HEIGHT, it does not become a square. At
     the 315px pitch a 220px film still leaves 95px of air either side, so
     it sits in the row without crowding it, and it stays legible as the
     film rather than dissolving into the pattern. */
  const SLOT_Y = 0.7085;          // row 3 — where the film parks
  const FILM_AR = 220 / 138;      // its resting shape: theirs, exactly

  /* ---------- the reference this copy's reveal started from ----------
     🔴 Kept as a record, no longer followed — see revealCopy, which fades
     the whole line in on one frame instead. The numbers below are
     squareup's and nothing reads them; they are here so the next pass
     knows what was tried and why it went.

     squareup's, measured off a live line at 1440×900. Their words carry
     inline GSAP styles, and sampling one as it entered gave:

       translateY  100px → 0
       opacity     0.20  → 1
       stagger     ~55ms per word
       ease        a long one — still 9% of the travel left at 825ms

     🔴 opacity starts at 0.2, NOT 0. A word that fades from nothing pops;
     one that is already faintly there reads as arriving from somewhere,
     and the 100px of travel is then legible as travel rather than as a
     word blinking on.

     🔴 The whole line is split into words but animated as ONE ordered list
     across both paragraphs, so the stagger runs continuously from "It" to
     the last word of the payoff. Splitting each paragraph into its own
     timeline restarts the count and the second line lands on a beat that
     has nothing to do with the first.

     .intro__steps is a flex row, so each .step is split on its own and the
     results are concatenated — splitting the flex parent would put the word
     wrappers where the flex items should be and the row would fall apart. */
  /* eslint-disable-next-line no-unused-vars -- the reference, not the reveal */
  const WORD_RISE = 100, WORD_FADE = 0.2, WORD_STAGGER = 0.055;
  let copyShown = false;
  let copyWords = [];

  /* 🔴 Split ONCE, at load — never mid-scroll. SplitText rewrites the line
     into per-word spans, and that re-lays-out the sentence: the slot the
     film is flying into moves a few pixels at the exact moment the split
     runs. Measured: `onSlot` went false for the frame the reveal fired on.
     Splitting up front means the slot's rect is settled before anything
     ever aims at it. */
  /* 🔴 Only the HEADLINE is split. The paragraph is 34 words — at a 55ms
     stagger that is nearly two seconds of words arriving one at a time,
     each starting 100px below where it belongs, so for most of the run the
     sentence is a scatter of loose words drifting up across the headline.
     A display line can be read word by word; a paragraph cannot. It comes
     in as one block instead. */
  function buildCopy() {
    if (!copy || !window.gsap || !window.SplitText || REDUCED) return;
    const lead = copy.querySelector('.intro__lead');
    if (lead) copyWords = new SplitText(lead, { type: 'words', wordsClass: 'word' }).words;
  }

  function revealCopy() {
    if (copyShown || !copy) return;
    copyShown = true;

    copy.style.setProperty('--lit', '1');

    const words = copyWords;
    if (!words.length) {
      reaim();
      return;
    }

    /* ---------- one fade, the whole line, nothing else ----------
       🔴 No stagger of any kind, and no blur. Both have been tried on this
       line and both are out:

         · a 55ms per-word stagger is the cadence of reading — the eye
           follows it left to right and the sentence has been "read" before
           it is legible.
         · a centre-out cascade fixes the direction but not the fact that
           the words still arrive at different times.
         · a blur-to-focus is a filter on display type over a photograph;
           it costs an offscreen buffer a frame on exactly the frames the
           film is being scaled, and it makes the line unreadable for the
           first third of its own entrance.

       So: `gsap.to` with no `stagger` key, which starts every word on the
       same frame. The ease and the length are the ones the stagger was
       originally tuned with, and they stay for the reasons they were
       picked:

         · not `ease: 'none'`. A linear opacity ramp has no attack — the
           last 10% takes as long as the first — and the eye reads that as
           a switch rather than as something arriving.
         · not 0.22s. At that length a fade is a blink; there is no room in
           it for an ease to be felt.

       Opacity is paint: no transform and no filter is set anywhere here,
       so the slot's rect never moves and nothing is left behind on a word
       for the film's measurement to trip over. */
    gsap.set(words, { opacity: 0 });
    gsap.to(words, {
      opacity: 1,
      duration: 0.55,
      ease: 'power2.out',
      onUpdate: reaim,
      onComplete: reaim,
    });

    /* 🔴 The swapping reading is on the SAME beat as the rest of it — no
       delay. It had a quarter second of one, to mark it as the word that
       keeps changing for the rest of the section, and that is exactly what
       made the line look like it was still arriving in pieces. The whole
       sentence is one frame now; the word earns its attention later, when
       it actually starts changing.

       It still needs its own tween: SplitText may or may not have parcelled
       the swap into a word wrapper, so `words` cannot be relied on to carry
       it — and drift.js appends the typed span inside it after the split
       either way. Same duration, same ease, same start time. */
    const swap = copy.querySelector('.intro__swap');
    if (swap) {
      gsap.fromTo(swap,
        { opacity: 0 },
        { opacity: 1, duration: 0.55, ease: 'power2.out', onUpdate: reaim, onComplete: reaim });
    }

    /* 🔴 The old delay was words.length × 55ms — it was waiting on a
       stagger that no longer exists, which would have left the sub-line
       sitting out for the best part of two seconds after a headline that
       had already landed. It follows the swap word now by the same beat
       the swap word follows the line. */
    const sub = copy.querySelector('.intro__sub');
    if (sub) {
      gsap.from(sub, {
        opacity: 0,
        duration: .7, ease: 'power2.out',
        delay: 0.5,
      });
    }
  }

  /* ---------- the film's corner ----------
     🔴 It is interpolated between two ends, not scaled up from zero. The
     old `t * 18px` tied the corner to PROGRESS, but the frame does not
     become visible until it is narrower than the stage — which the easing
     does not reach until t≈0.36 — so every frame anyone actually sees was
     drawn with 6–10px on a box over a thousand pixels wide. It read as a
     sharp rectangle with a nick out of each corner.

     So: start at the corner the page already uses at section scale, and
     land exactly on the tiles' own share. The radius therefore GROWS as a
     proportion while shrinking in pixels, which is how a corner stays
     optically the same weight across sizes — a small card needs a bigger
     share than a big one. */
  const R_FULL = 48;              // = --section-radius--large (3rem)
  const TILE_R = parseFloat(getComputedStyle(intro).getPropertyValue('--tile-r')) || 0.14;

  /* the footage's own ratio, so it is never squeezed. Read off the file
     once it has metadata; the fallback is the placeholder's 1920×800. */
  let AR = 2.4;

  /* ---------- scene one's line types itself out ----------
     Fired from the sheet's own `animationend`, so it starts the moment the
     wordmark has finished opening the picture — no scrolling required.

     The blue dot is the caret: it sits one glyph AHEAD of the text the
     whole way, which is what makes it read as a lead rather than as
     decoration, and it leaves once the line is complete. */
  const SPEED = 0.045;                     // seconds between glyphs
  let openerUnlocked = REDUCED || RESUMING_AWAY_FROM_TOP;
  let openerUnlockTimer = 0;

  if (RESUMING_AWAY_FROM_TOP) {
    /* If the reader later scrolls back to page top, this is the finished
       opener state: visible and usable, but never replayed. */
    intro.classList.add('is-typing', 'is-sub', 'is-cta', 'is-scroll-ready', 'is-scroll-committed');
  }

  function unlockOpener() {
    intro.classList.add('is-cta');
    clearTimeout(openerUnlockTimer);
    const finish = () => {
      openerUnlocked = true;
      intro.classList.add('is-scroll-ready');
    };
    /* The label completes after the pill's opening clip, so the first
       allowed wheel cannot take the page away while “Meet Nestify” is still
       arriving. Reduced motion has no staged opening to wait for. */
    if (REDUCED) finish();
    else openerUnlockTimer = setTimeout(finish, 720);
  }

  let typed = false;
  function typeHero() {
    if (typed || !heroLine) return;
    typed = true;

    /* the line starts hidden in CSS, so every early return has to unhide
       it or the words are simply lost.

       🔴 ...and the sub-line and the button with it. Both sit at opacity 0
       waiting for a class this timeline adds, so the old bail-out — which
       only unhid the headline — left anyone without GSAP, or with reduced
       motion on, looking at a title over footage with no sentence and no
       way in. Hence two functions: `show` for the staged path, `showAll`
       for every way out of it. */
    const show = () => intro.classList.add('is-typing');
    const showAll = () => {
      intro.classList.add('is-typing', 'is-sub');
      unlockOpener();
    };
    if (!window.gsap || !window.SplitText || REDUCED) { showAll(); return; }

    /* 🔴 'words,chars', NOT 'chars' —— 与 hub.js 里 "One screen." 那句同一个
       修复，同一个理由（那边的注释是全文，这里不重复）。只拆字符时每个字母
       都是一个独立的 inline-block，浏览器眼里这行**没有单词**，只有 19 个相邻
       的盒子，于是断行可以落在任意两个字母之间。

       实测 390×844：「A Smart Family / Copilo / t」；660×872 上更明显——用户
       2026-09-04 截图里是「A Smart Family C / opilot」，一个 C 单独留在行尾，
       他的原话是「像错别字一样」。

       words 层把每个单词装回自己的盒子（SplitText 给 word 自带 nowrap），断行
       只能落在盒子之间，于是这行只会断成「A Smart Family / Copilot」。
       动画一行没改：words,chars 返回的 .chars 与只拆 chars 时逐一对应。 */
    const chars = new SplitText(heroLine, {
      type: 'words,chars', wordsClass: 'wd', charsClass: 'ch',
    }).chars;
    if (!chars.length) { showAll(); return; }

    /* the caret's stops, measured BEFORE the glyphs are moved — each is
       the right-hand edge and baseline of the glyph being typed */
    const box = heroCopy.getBoundingClientRect();
    const stops = chars.map((c) => {
      const r = c.getBoundingClientRect();
      return { x: r.right - box.left, y: r.bottom - box.top };
    });

    /* glyphs hidden first, THEN the block unhidden — the other order puts
       the finished line on screen for a frame */
    gsap.set(chars, { opacity: 0, yPercent: 26 });
    if (caret) gsap.set(caret, { opacity: 1, x: stops[0].x, y: stops[0].y });
    show();

    const tl = gsap.timeline({ delay: 0.25 });
    tl.to(chars, { opacity: 1, yPercent: 0, duration: 0.3, ease: 'power3.out', stagger: SPEED }, 0);

    if (caret) {
      /* stepped, so the dot jumps glyph to glyph instead of gliding */
      tl.to({ i: 0 }, {
        i: chars.length - 1,
        duration: (chars.length - 1) * SPEED,
        ease: `steps(${chars.length - 1})`,
        onUpdate() { gsap.set(caret, stops[Math.round(this.targets()[0].i)]); },
      }, 0);
      tl.to(caret, { opacity: 0, duration: 0.3, ease: 'power2.out' }, '>0.35');
    }
    /* three beats, in reading order: the name, the sentence that says what
       it is, then the thing to press. Each waits for the one before —
       nothing here shares a beat, which is the whole point of staging it
       rather than fading the block in as a lump. */
    tl.call(() => intro.classList.add('is-sub'), null, '>0.05');
    tl.call(unlockOpener, null, '>0.4');
    heroTl = tl;
  }
  let heroTl = null;

  /* the film's resting size: the same width the tiles use, so it reads as
     one of them rather than as a video that happens to be small */
  /* ---------- how big the film ends up ----------
     🔴 DECLARED, not measured off a tile. This used to read the first
     tile's width, which was fine while every tile was the same size and
     became nonsense the moment they stopped being: the film's resting size
     would then depend on nothing but DOM order, and re-ordering the markup
     for visual reasons would silently resize the hero.

     🔴 The target is the SLOT'S OWN measured rect, not a number. The slot
     is a real inline box inside the sentence, so wherever the type lands
     at this viewport is where the film lands — nothing to keep in sync. */
  function slotRect() {
    return slot ? slot.getBoundingClientRect() : null;
  }

  /* 🔴 The film's own resting box, measured with the transform CLEARED.
     Deriving it from `top: 50%` + aspect-ratio looked right and was wrong
     by exactly the slot's `vertical-align` — 16px at 86px type. Anything
     computed from the stylesheet has to model every offset in the chain
     correctly; measuring the actual box models all of them for free.
     Cached, and re-taken on resize, because clearing a transform to read
     a rect forces a layout. */
  let baseBox = null;
  function baseRect() {
    if (baseBox) return baseBox;
    const held = media.style.transform;
    media.style.transform = 'none';
    const r = media.getBoundingClientRect();
    const st = stage.getBoundingClientRect();
    media.style.transform = held;
    /* 🔴 stored RELATIVE TO THE STAGE, not in viewport coordinates. The
       stage is sticky, so its viewport position changes with the scroll —
       a cached viewport centre is only correct at the scroll offset it was
       taken at, and everything after it is off by however far the stage
       has since moved. */
    baseBox = { w: r.width, h: r.height,
                rx: r.left + r.width / 2 - st.left,
                ry: r.top + r.height / 2 - st.top };
    return baseBox;
  }

  function frame(p) {
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    const w = sr.width, h = sr.height;

    /* --- the film flies into the sentence ---
       Transform only. The box is a fixed 16:10 rectangle the width of the
       stage, so all that changes is where its centre is and how big it is;
       the scale is UNIFORM at every step, so the picture is never stretched. */
    if (media) {
      const t = ease(clamp(p / SHRINK_END));
      const base = baseRect();
      const target = slotRect();

      /* cover a stage taller than 16:10 at the start, land on the slot */
      /* a hair of overscan at full bleed, so the film's own corners sit
         just OUTSIDE the stage while it is the whole screen — that is what
         lets the corner radius stay constant without four little notches
         of background showing at the start */
      const s0 = Math.max(1, h / base.h) * 1.03;
      const s1 = target ? target.width / base.w : 0.12;
      const scale = s0 + (s1 - s0) * t;

      /* start centred on the stage, finish centred on the slot */
      const c0x = sr.left + w / 2, c0y = sr.top + h / 2;
      const c1x = target ? target.left + target.width / 2 : c0x;
      const c1y = target ? target.top + target.height / 2 : c0y;
      const cx = c0x + (c1x - c0x) * t;
      const cy = c0y + (c1y - c0y) * t;

      const bx = sr.left + base.rx, by = sr.top + base.ry;
      media.style.transform =
        `translate3d(${(cx - bx).toFixed(2)}px, ${(cy - by).toFixed(2)}px, 0)` +
        ` scale(${scale.toFixed(5)})`;

      /* 🔴 divided by the scale. The radius is drawn in the box's own
         coordinates and then scaled with it, so a flat 24px would arrive
         on screen as 24 × scale ≈ 3px. Dividing it back out is what makes
         the corner land at 24 REAL pixels. */
      /* 🔴 CONSTANT on screen — the `t *` that used to be here is gone.
         Interpolating the radius means the film spends the whole shrink at
         some part-rounded value: a 700px-wide picture with an 8px corner
         does not read as "becoming rounded", it reads as a rectangle with
         a nick out of each corner. The corner is a property of the object,
         not of the transition, so it stays put and only the size moves.

         Still divided by the scale: the radius is drawn in the box's own
         coordinates and scaled with it, so a flat 16px would arrive on
         screen at 16 × scale ≈ 1.7px. Dividing it back out is what keeps
         it at 16 REAL pixels at every step. */
      /* 🔴 Read off the SLOT, not off --film-r. The variable is a clamp()
         now, and a custom property is not computed — getPropertyValue
         hands back the literal string "clamp(4.5px, 1.12vw, 20px)", which
         parseFloat turns into NaN and the `|| 16` quietly pinned the
         flying film to 16px while the slot it was landing in used the
         fluid value. The slot's own border-radius is always resolved to
         px, and matching the slot is the point of the number. */
      const landR = parseFloat(getComputedStyle(slot || intro).borderTopLeftRadius) || 16;
      media.style.setProperty('--mr', (landR / Math.max(scale, .0001)).toFixed(1) + 'px');

      /* the bar's ink follows whether the film is still under it */
      const BAR = 72;
      const tone = media.getBoundingClientRect().top < BAR ? 'dark' : 'light';
      if (intro.dataset.tone !== tone) {
        intro.dataset.tone = tone;
        dispatchEvent(new CustomEvent('hero:tone'));
      }
    }

    /* --- scene one's line leaves before scene two's arrives ---
       🔴 If it is still typing when the scroll starts, run the rest of the
       timeline out first. Fading a half-typed line just strands it. */
    if (heroCopy) {
      const t = clamp(p / HERO_OUT);
      if (t > 0 && heroTl && heroTl.progress() < 1) heroTl.progress(1);
      heroCopy.style.opacity = (1 - ease(t)).toFixed(3);
      heroCopy.style.transform = `translateY(-${(t * 40).toFixed(1)}px)`;
    }


    /* The blue dot is gone — halo, shrink, fall, hand-over, all of it. The
       clock now simply appears with the hero deck it belongs to; there is
       nothing in this section for it to come from. (index.html's
       #daytimeGlow element and .daytime__glow in hero.css went with it.) */

    /* word-fly animation removed: "family" now stays in its own sentence
       and the hero headline below shows independently. */
    const heroTrack = document.querySelector('.hero');
    if (heroTrack) heroTrack.style.setProperty('--carry-in', '1');

    /* --- the copy, word by word, once --- */
    if (copy && p >= COPY_FROM) revealCopy();

    /* ---------- Y-axis flip: intro tile → hero slide 1 ----------
       ft = 0  : flipper invisible, intro tile visible as normal
       ft = 0…1: flipper covers the tile, rotates & grows to hero size
       ft = 1  : flipper at hero inner's position — hero takes over

       Guard: `window.scrollY < top + range` ensures the flipper is
       ONLY active while the intro section is still pinned. Once the
       user scrolls past the intro into the hero section, p stays
       clamped at 1 forever — without this guard the flipper would
       remain at opacity:1 on top of all four hero slides, making them
       all appear to play the same video. */
    {
      /* 🔴 The flip ends AT THE PIN, not at p = 1 — and those are a whole
         viewport apart. The intro's stage is sticky, so it is let go one
         viewport before the section ends: p hits 1 at scrollY 7200 (1440×900)
         while .hero's stage does not reach top:0 until 8100. Ending the card
         on p meant it landed on an empty spot, blinked out, and the very same
         picture then climbed into that spot 900px later — the card and the
         deck read as two gestures with a dead screen wedged between them,
         which is the whole complaint. Measured before the change: at scrollY
         7103 the card was home at (43, 90), the real film still 1087px below.
         So the ramp is now measured in SCROLL, from where the card starts to
         where the deck arrives; the turn still ends where it always did (see
         TURN below) and the extra viewport is spent travelling. The card is
         still moving while the intro slides away behind it, and it is exactly
         on the film at the instant the film gets there.
         (FLIP_TO is what that used to be; it is kept only to name the old
         end, and nothing reads it.) */
      /* 🔴 hero deck 还紧跟在 intro 后面吗？
         这张卡原本是「翻到 deck 第一张片子上」的交接装置：下面有一整套只对
         deck 成立的动作——藏 .hero__inner、克隆 .hero__content 飞过去、把
         .hero__rail 压暗、把播放头交给 .hero__video。2026-09-03 改版把 deck
         挪到了页尾，这些动作会去对一个三万像素外、根本不在视口里的元素做
         定位（用户实测：「to be a parent 之后交互乱七八糟」）。

         判据用**几何**而不是写死 false：deck 哪天搬回 intro 后面，这里自己
         就恢复，不需要有人记得回来改。q() 是这一整套的唯一入口——deck 不在
         位时它返回 null，下游那些 `if (rail)` / `firstSlide && …` 守卫本来
         就都在，于是整套自然熄火。 */
      const deckFollows = () => {
        const h = document.querySelector('.hero');
        return !!h && Math.abs(h.offsetTop - (top + range)) < window.innerHeight;
      };
      const q = (sel) => (deckFollows() ? document.querySelector(sel) : null);

      const flipFromY = top + range * FLIP_FROM;
      const pastIntro = window.scrollY >= pinY;
      /* 🔴 行程终点改成 `top + range`（**舞台解除钉住的那一刻**），不是 pinY。

         pinY 是段落末尾，而 intro 的 sticky 舞台在段尾**前一个视口**就释放——
         原设计里最后那一屏正是「钉住的画面滑走、卡片在它前面继续飞」，所以
         转场的后三分之一必然带着画面移动。用户要的是全程不动
         （「往下滚不是让屏幕往下滚」），实测那段舞台顶从 0 掉到 −1075，
         正是他说的「下落感」。

         终点前移之后，整条转场都发生在舞台还钉着的时候；剩下的那一个视口
         （release → pinY）画面确实会滑走，但那时房间层已经满屏铺住了，
         底下滑什么都看不见。 */
      /* 🔴 2026-09-04 又改回 pinY —— 但这次是安全的，原因和上面那段不一样，
         别看到 pinY 就以为是退回旧 bug。

         当初把终点从 pinY 前移到 top + range，是因为**卡片的行程**跟着舞台跑：
         位置算式是 mr + (tgt - mr) × fe，而 mr 是舞台里那块内联媒体的实时矩形。
         舞台在段尾前一个视口就释放、开始上滑，fe 还没到 1 的话卡片就被拖着走，
         那就是用户说的「下落感」。

         现在卡片的行程在 LAND 就结束了（≈ ft 0.19，远在舞台释放之前），fe 一到
         1 位置就恒等于 tgt，跟 mr 再无关系。之后那一大段里会动的东西一个都没有：
         线稿和照片是 position: fixed，句子和媒体的 opacity 已经是 0。所以终点
         推到 pinY 只是**把后面三拍的行程变长**，不会把移动带回来。

         推到 pinY 是必须的：用户要「落位 → 空白 → 线稿 → 照片」四拍走完之后
         才交给 hub，而 hub 正是在 pinY 接手。终点停在 top + range 的话，最后
         一个视口就是「照片已经铺满但还没交接」的空转。 */
      const flipEndY = pinY;
      const rawFt = clamp((window.scrollY - flipFromY) / Math.max(1, flipEndY - flipFromY));
      const ft = rawFt;
      /* 🔴 转场是**分三拍**的，不是三样一起淡（用户：「字先渐渐隐去，然后屏幕
         打开，3D 模型出来以后，背景才慢慢被渲染出来」）。

         之前 copy 的退场和房间的显现共用同一个 ft，所以看起来是「一起慢慢
         出现」，没有先后。现在把 ft 切成三段各自归一化：

           copy 退场   ft 0.00 → 0.22    句子先走干净
           （卡片翻转/长大走它自己的 TURN 与 TRAVEL，见下面 fr / fe）
           房间渲染   ft 0.58 → 1.00    等设备已经在墙上了，墙才画出来

         中间那段留给卡片独占：字没了、墙还没来，画面上只有那块正在打开、
         正在变大的屏幕——那正是用户描述的顺序。 */
      const seg = (a, bnd) => clamp((ft - a) / Math.max(0.0001, bnd - a));
      /* 🔴 翻卡与落位按**像素**钉回原节奏，不跟着拉长的行程摊开。

         这两拍是在旧行程（range 的最后 15% = 432px）上调好的，用户说过那时
         「很流畅」。行程拉到 50% 之后若还按 ft 的比例走，同样的 180° 会被摊到
         三倍长度上，立刻变粘——正是之前踩过的坑。所以拿旧行程的长度当尺子：

           LEGACY_RAMP  旧行程本身（range × 15%）
           TURN         旋转结束点，占旧行程的 0.324（原公式在旧常数下的值）
           LAND         长大落到墙上的终点 = 旧行程走完

         两者都除以新的 span，于是像素长度不变、只是在 ft 上占的比例变小了。 */
      const span = Math.max(1, flipEndY - flipFromY);
      const LEGACY_RAMP = range * 0.15;
      const TURN = clamp(LEGACY_RAMP * 0.324 / span) || 1;
      const LAND = clamp(LEGACY_RAMP / span) || 1;

      /* 🔴 五拍，2026-09-04 用户三次复述之后的定版：

           句子退场   0.00 → 0.05     "Time to just be…" 先走干净
           屏幕打开   0.00 → LAND     翻卡原地转正、长大，停在墙上那个位置
           换静态壁纸 LAND → +0.04    影片交棒给真机那一屏的静图
           房间线稿   0.22 → 0.48     线框已经在墙上了，房间跟着同一支笔画出来
           落成实体   0.48 → 0.60     线框淡出、真机（3D 外壳 + working on it）淡入
           上色+字+光 0.58 → 0.90     三样一起：墙渲染、字擦入、光扫过
           标题退场   0.95 → 1.00     交接前先松手，别硬切

         🔴 「落成实体」排在线稿**之后**，是用户 2026-09-04 定的：翻卡翻过来先是
         线框，和房间线稿同一种笔、同一个颜色；等房间画完了，设备才连着 3D 外壳
         和屏幕内容一起长成实体。之前是落位就变真机，那时房间还没画，一台全彩
         照片级的设备浮在空白上，材质对不上。

         🔴 上色 / 文字 / 闪光是**同一拍**，不是三拍。之前拆成「上色 → 光 → 字」
         排了 0.42/0.64/0.80 三段，用户 2026-09-04 定：「渲染+文字+闪光一起出现」。
         闪光不占 ft 区间——它只是在 0.52 被扣一次扳机，之后走自己的 900ms。

         每拍一个变量，互不共用，所以先后是硬的——早先 copy 退场和房间显现共用
         一个 ft，看起来就是「三样一起淡」，没有先后，用户当场指出来过。

         🔴 中间那段原本是「空白独处」：落位之后干等 334px，什么都不发生。用户
         「这中间要快一点，现在还得滑一下」说的就是它。现在同样的位置换成扫描
         成型（250px），既短了，又有事情在发生——空白之所以显得久，一半是因为
         它是死的。

         🔴 字的位置也是用户定的：「出现线描稿的时候可以出现字了」。之前字排在
         彩色那一拍（0.68 起），比线稿晚一整拍。 */
      const roomT = seg(0.58, 0.90);
      // Mobile copy exits with its section; Lights Up no longer consumes it.
      intro.style.setProperty('--copy-out', PHONE ? '0' : pastIntro ? '1' : seg(0.00, 0.05).toFixed(4));
      intro.style.setProperty('--sketch-t',    (PHONE || pastIntro) ? '0' : seg(0.22, 0.48).toFixed(4));
      intro.style.setProperty('--room-t',      (PHONE || pastIntro) ? '0' : roomT.toFixed(4));
      /* Family Hub 的控件只能在房间真正上色完成后出现。用显式 class 交接，
         不让 CSS 猜滚动位置；回滑到渲染之前时也会重新收掉。 */
      if (hubEl) hubEl.classList.toggle('is-intro-rendered', pastIntro || roomT >= 0.999);
      /* 🔴 标题要在交接**之前**自己退场。pastIntro 那一刻所有 intro 变量归零，
         如果字还亮着就是一记硬切——实测在 y=pinY 那一帧字直接消失，很扎眼。
         所以擦入之后留一段，再在最后 10% 行程里淡出，交接时画面上本来就没字了。
         hub 接手后自己那句 "One screen." 归它自己的时间轴管。 */
      /* 🔴 字排在**上色完成之后**（0.70）。一度跟线稿同拍（0.27 起），用户看过
         说「这个字能不能在背景完全渲染出来之后再出现」——现在它是最后落下的
         那一笔：墙成型 → 光扫过 → 字出来。 */
      /* 🔴 门槛去掉了，转场期间**每帧都量**。

         这里曾是 `ft > 0.35`——那是字还排在 0.58 时定的「够早就行」。2026-09-04
         字提前到 0.22 之后这个数就失效了：字在 0.22 出现时用的还是启动那一次量
         的旧值，到 0.35 才校正，于是顶距从 131 跳到 107。字号全程没变（实测恒为
         92.268px），但配上擦入的动效，读起来就是用户说的「渲染完以后字体还会
         突然变大一点点」。

         把门槛绑在字的时机上是错的思路——字的时机改过五次了。转场期间一直量，
         两次 getBoundingClientRect，可忽略。 */
      if (!pastIntro) syncRoomLine();
      /* 🔴 提前到**线框画完就出**（0.22 起），不再等上色。用户 2026-09-04：
         「线框已经完整显示的时候，你就可以把 Meet Nestify 的文字显现出来。」
         卡片在 LAND(0.185) 停稳、线框此时已完整，所以 0.22 是它自然的下一拍。
         之前排在 0.58 是跟上色同起——那是「渲染完才落款」的读法，用户要的是
         「框成型就报名」。 */
      /* 🔴 和**房间线稿同一个窗口**（0.22 → 0.48），所以两者同时起笔、同时收笔。
         用户 2026-09-04：「它跟着线框的渲染，然后完成它的出现。」
         之前是 0.22 → 0.34，字先写完、线稿还在画，两件事各走各的。 */
      const lineIn  = seg(0.22, 0.48);
      /* 与 hub 那句交叉：hub 提前 300px 亮起（见 hub.js 的 inPrologue），
         这里同步把退场拉长到最后 300px 左右，两条曲线才叠得上。 */
      /* 🔴 硬切，而且切点要和 hub 那句亮起的**同一个阈值**：hubOrigin − 300。

         这条来回修过三次，三次的病因不同，都记着：
           ① 原本是 seg(0.87,1.00) 的淡出 → 与 hub 那句交叉时两层同样的字各自
              半透明叠加，合成 1-(1-a)(1-b) 只有 0.83，字整体淡一下（「闪一下」）。
           ② 改成保持满格到 pastIntro → 闪没了，但和 hub 那句有 300px 的**同时
              满格**期。两者水平中心差 0.5px（盒子宽度不同），叠出描边发虚
              （用户：「滚动的时候会有一个重影」）。
           ③ 现在：切点前移到 hub 那句亮起的同一刻，配合那边的 transition:none，
              任何时刻只有一句在画面上——既不重叠也不留空。 */
      const hubTop = hubEl ? hubEl.offsetTop : pinY;
      const lineOut = window.scrollY >= hubTop - 300 ? 1 : 0;
      intro.style.setProperty('--room-line-t', (PHONE || pastIntro) ? '0' : lineIn.toFixed(4));
      intro.style.setProperty('--room-line-o', (PHONE || pastIntro) ? '0' : (1 - lineOut).toFixed(4));
      /* 🔴 变身与闪光**分开**，各在各的时刻。

         变身在落位那一刻：平卡片交叉淡出，底下真机显形。两者像素对齐、屏幕内容
         也是同一屏，所以淡出过程中露出来的正好是 3D 机身长出来——不需要别的东西
         来遮接缝。

         闪光挪到**背景全部渲染完**的那一刻（用户 2026-09-04：「最后那个扫描的
         闪光应该是在它真正背景全部渲染出来的时候」）。它现在是收尾的signal——
         墙成型、机器在墙上、光扫过去，这一幕结束。

         ⚠️ 早先把两者绑在一起过（光扫到一半变身），那版用户的反馈是「扫描亮片
         没看到」：光当时扫的是一块平卡片，读者注意力全在变身上，光就白扫了。 */
      /* 线框 → 真机的交叉。两者落在同一个矩形上（落点已按机身轮廓量过），
         所以是原地换材质，不是位移。 */
      /* 🔴 机身+彩条先来，UI 后来。用户 2026-09-04：「彩条能不能先出现，然后
         再出现那个 UI 图片？」——所以这一拍拆成两段：

           0.48 → 0.58  线框淡出、机身淡入，屏幕是块白板，边缘彩条已经在转
           0.60 → 0.72  UI 在白板上显影

         彩条不跟着 UI 淡——它由 hub3d 每帧满强度画，setUiFade 只管底图。 */
      const morph = pastIntro ? 1 : seg(0.48, 0.58);
      /* ⚠️ setUiFade 只在彩条开着时有效（它改的是 hub3d 那张每帧重绘的画布）。
         彩条 2026-09-04 关掉了（见 hub.js 的 GLOW_ON），所以这行现在是空转，
         留着是为了开回来时不用重接。 */
      if (window.hub3d && window.hub3d.setUiFade) {
        window.hub3d.setUiFade(pastIntro ? 1 : seg(0.60, 0.72));
      }
      const live  = morph > 0;
      if (PHONE || pastIntro) {
        if (flashRAF) { cancelAnimationFrame(flashRAF); flashRAF = 0; }
        paintScan(0);
      } else if (ft < FLASH_AT - 0.05) {
        flashArmed = true;
      } else if (ft >= FLASH_AT && flashArmed && !REDUCED) {
        flashArmed = false;
        flashT0 = performance.now();
        if (!flashRAF) flashRAF = requestAnimationFrame(flashLoop);
      }

      /* 提前把 hub 的舞台钉到视口上。舞台本身是 sticky top:0、无 transform，
         钉住时的盒子正是 [0,0,视口宽,视口高]，所以 position:fixed;inset:0 复现的
         就是它 pinY 时刻的样子——真机因此正好落在卡片刚停下的那个矩形里。
         到 pinY 撤掉这个类，sticky 接管，位置一模一样，不会跳。 */
      if (hubEl) {
        hubEl.classList.toggle('is-early', !PHONE && live && !pastIntro);
        /* 真机不是硬切出现，是跟着 morph 淡进来——线框同时淡出，两条曲线互补。 */
        hubEl.style.setProperty('--early-in', morph.toFixed(4));
      }


      if (!PHONE && ft > 0.001 && !pastIntro) {
        /* measure the hero inner once: its offset from .hero__stage is
           stable regardless of scroll. When the stage pins (top:0) those
           offsets ARE the viewport coordinates the flipper needs. */
        /* 🔴 2026-09-03 改版：落点从 hero deck 的第一张片子改成 **hub 那台
           机器的屏幕**。原理没变——量的是「内层相对 sticky 舞台的偏移」，
           舞台钉住时那个偏移就是视口坐标，所以换个舞台照样成立。

           这里量到的是 pad **停靠状态**（挂在墙上、--dock-s 缩过）的矩形，
           而这正是读者到达时看见的样子：hub 的新时间轴以前奏开场，前奏期
           legacy p 恒等于 DOCK，所以 intro 还在放的时候 hub 就已经是停靠态。
           getBoundingClientRect 带 transform，量到的就是墙上那块的大小。 */
        /* 🔴 每帧重量，**不缓存**。原本是 `if (!heroInnerTarget)` 只量一次，
           量到什么就永久钉住什么——2026-09-04 用户实测落点变成 910px（视口的
           65%，而正确值是 325px）。根因是那唯一一次测量撞上了 hub 被滚到大尺寸
           场景的时刻：读者来回上下滚时，第一次进入转场区间的采样很容易发生在
           从 hub 往回拉的路上，于是把「大机器」的尺寸当成了落点。

           重量是安全的：存的两个偏移是**相对舞台**的（hiR - hsR），宽高是 pad
           自己的尺寸，scrollY < pinY 时 hub 恒在停靠态，所以每帧量到的都一样，
           落位之后也不会跳。代价是每帧两次 getBoundingClientRect，可忽略。 */
        {
          const hs = document.querySelector('.hub__stage');
          const hi = document.querySelector('.hub__screen');
          if (hs && hi) {
            const hsR = hs.getBoundingClientRect();
            const hiR = hi.getBoundingClientRect();
            /* 🔴 外扩到**设备完整轮廓**，不是屏幕矩形。3D 外壳画在 canvas 上、
               比屏幕大一圈，还有投影。量过（1398×829 视口）：屏幕 325×183 时
               整台机器连影是 374×235，四边分别多 24 / 23 / 24 / 28 px。
               下面这四个比例就是那次测量，底边多一点是投影。

               卡片背面现在放的是整台设备的静图，所以落点必须是同一个框——
               对不上的话 morph 交叉淡出时机器会错位一下。 */
            /* 🔴 外扩到**机身**，不含投影。旧值 EX_B=0.1530 是照着「机身+投影」
               的包围盒量的，落点因此比机器高出一截；线框要和机身重合，多出来的
               那道投影会让线框底边悬空。

               重量方式：在提前钉住的那一段抓一张真机图，按机身的橄榄绿把轮廓
               分离出来（投影是灰褐，不满足 G>R 且 G>B）。结果 373.3×227.0，
               四边相对屏幕矩形 左 23.3 / 上 22.3 / 右 25.0 / 下 21.7 px —— 左右
               不对称是真的，机身本身就没画正中。 */
            const EX_L = 0.0717, EX_R = 0.0769, EX_T = 0.1219, EX_B = 0.1186;
            heroInnerTarget = {
              left:   hiR.left - hsR.left - hiR.width * EX_L,
              top:    hiR.top  - hsR.top  - hiR.height * EX_T,
              width:  hiR.width  * (1 + EX_L + EX_R),
              height: hiR.height * (1 + EX_T + EX_B),
            };
          }
        }

        /* 🔴 顺带量真机的**外观**：边框宽、边框色、圆角。理由和落点同一条——
           写死就会跟 hub 漂开。三个值都要乘停靠缩放：pad 是「大尺寸 × scale(.37)」
           渲染的，所以 --bezel 的 15px 落到屏幕上只有 5.6px，圆角 19.3px 只有
           7.1px。漏掉这一乘，框会粗一倍、角会圆三倍。

           用户 2026-09-04：「它能不能是把框都已经变出来啊？现在就是只变了一张
           图片」——卡片原本落位时是 24px 圆角、没有框，跟那台机器差得远。 */
        const padEl = document.querySelector('.hub__pad');
        if (padEl && padEl.offsetWidth) {
          const k  = padEl.getBoundingClientRect().width / padEl.offsetWidth;
          const cs = getComputedStyle(padEl);
          padChrome = { radius: (parseFloat(cs.borderRadius) || 19.3) * k };
        }

        if (heroInnerTarget) {
          /* 🔴 TWO clocks off one ramp: the TURN and the TRAVEL.
             Spending the whole of the longer ramp on the rotation made the
             card mushy — the same 180° tuned over 1080px now dragged across
             1980px, and the edge-on moment (nothing on screen but a black
             sliver) stretched with it. So the turn keeps its original beat:
             it finishes at TURN, which is the scroll position the flip used
             to end at — the instant the intro's pin is released. What the
             extra viewport buys is the TRAVEL: the card, now fully turned
             and playing the hero's film, keeps growing into the film's slot
             while the intro slides away behind it, and gets there exactly as
             the deck does. Motion never stops, which is the whole point. */
          const fr  = flipEaseIO(clamp(ft / TURN));   // the turn
          const fe  = flipEaseIO(clamp(ft / LAND));    // the travel
          const mr  = media.getBoundingClientRect();
          const tgt = heroInnerTarget;

          /* position + size: intro tile (small, 16:10) → hero inner (large, 1:1) */
          const left   = mr.left   + (tgt.left   - mr.left)   * fe;
          const top    = mr.top    + (tgt.top    - mr.top)     * fe;
          const width  = mr.width  + (tgt.width  - mr.width)   * fe;
          const height = mr.height + (tgt.height - mr.height)  * fe;

          /* 圆角从内联那块的 16px 收敛到**真机的圆角**（约 7px），不是原来那个
             写死的 24px——落位后要跟机器一模一样，圆角差一倍就立刻不像。 */
          /* 圆角收到 0：卡片现在只是一块与墙同色的矩形，机器自己的圆角画在
             静图里。收不到 0 的话落位时会有一圈比墙略暗的圆角边露出来。 */
          const radius = (16 * (1 - fe)).toFixed(1) + 'px';

          flipper.style.left    = left.toFixed(1)  + 'px';
          flipper.style.top     = top.toFixed(1)   + 'px';
          flipper.style.width   = width.toFixed(1) + 'px';
          flipper.style.height  = height.toFixed(1) + 'px';
          flipper.style.opacity = (1 - morph).toFixed(3);
          flipFront.style.borderRadius = radius;
          flipBack.style.borderRadius  = radius;
          flipper.style.borderRadius   = radius;
          /* 🔴 机身那圈边框在**落位的最后三分之一**才长出来。整程都有的话，
             飞行途中就是一块带框的牌子，读起来像贴纸；等它停稳再长框，读到的
             才是「贴上墙 → 机身合拢」。用 box-shadow 的 spread 做，和 hub.css
             里真机那圈是同一种画法（见那边 --bezel 上方的注释）。 */
          /* 🔴 这里曾经用 box-shadow 仿过一圈机身边框（--bezel × dock-s = 5.5px
             的 #a8b183）。2026-09-04 用户看了实装说「这个能不能直接变成 3D 而
             不是中间有一个过度、加了 stroke 的」——说得对：仿的是一圈平涂描边，
             和真机那个有厚度、有明暗的 3D 外壳摆在一起就是两个东西。

             现在改成**落位即切真机**（见下面 is-early 那段），卡片全程只是一块
             平的屏幕，不再假装自己是机身。 */

          /* Y-axis rotation: 0° → 180°, eased — on the turn's own clock */
          /* 🔴 不转了，原地换面。fr 还是原来那条旋转曲线，只是现在驱动的是
             两面的不透明度——换面的时机和调好的节奏因此完全没变。
             理由见 intro.css 的 .flip__back。 */
          flipInner.style.transform = 'none';
          flipFront.style.opacity = (1 - fr).toFixed(3);
          flipBack.style.opacity  = fr.toFixed(3);

          /* hide source tile while flipper is on screen */
          media.style.visibility = 'hidden';

          /* fade out the sentence as the card grows over it — on the turn,
             so the line keeps the same beat it had before the ramp grew */
          const fq = clamp(ft / TURN);
          if (copy) copy.style.opacity = fq < 0.25 ? (1 - fq / 0.25).toFixed(3) : '0';

          /* once the back face is showing (past 90°) hide hero__inner
             so the real tile is not visible through the flipper */
          const firstInner = q('.hero__slide:first-child .hero__inner');
          if (firstInner) firstInner.style.visibility = fr > 0.5 ? 'hidden' : '';

          /* ---------- the film starts when the card turns onto it ----------
             🔴 AT `fr` CROSSING 0.5, the same instant the line above uses to
             hide the real tile. Before that the back face is pointing away
             from the reader and a film running there is a film nobody sees;
             after it, every frame of the growth is live, which is the whole
             point of the face being a <video> at all.

             🔴 AND THE DECK'S ELEMENT IS CLAIMED HERE, a viewport ahead of
             the pin, not at the handover below. hero.js's startClock() is
             rAF-gated and this handler is not, so the two disagree about
             which frame the pin happened on and the rewind could land BEFORE
             the handover delivered its playhead. That race was real and it
             was measured: startClock rewound at 6353ms, the handover landed
             at 6369ms, and the reader saw the opening seconds twice. The
             `handoff` flag is what the claim looks like from hero.js's side;
             goHero() drops it on the first slide change. */
          const deckVid = q('.hero__slide:first-child .hero__video');
          if (fr > 0.5) {
            if (deckVid) deckVid.dataset.handoff = '1';
            if (backVid && backVid.paused && !backVid.ended) {
              /* 🔴 rewind ONLY on the first start. Scrolling back and forth
                 across 90° re-enters this branch, and rewinding there is the
                 film restarting under a card that never left the screen. */
              if (!backStarted) { backStarted = true; try { backVid.currentTime = 0; } catch (e) {} }
              backVid.play().catch(() => {});
            }
          } else if (backVid && !backVid.paused) {
            backVid.pause();
          }

          /* the deck's scrubber waits with the rest of the deck — it fades
             in at the pin (see .hero__rail in hero.css) instead of climbing
             the screen while the card is still flying */
          const rail = q('.hero__rail');
          if (rail) rail.style.opacity = '0';

          /* ---------- the card hands the copy over ----------
             🔴 This is the seam the whole flip exists for. The card turns
             and lands in the hero's film slot, and the deck's first line
             used to be already sitting there — .is-active is on slide one
             from page load, so its entrance had played long before anyone
             arrived. What was left between the two was a stretch of scroll
             with nothing happening in it: flip, then wheel, then read.

             So the cue is HERE, at the moment the back face is fully round
             and the card is nearly home. .62 rather than .5: at half the
             card is edge-on and the words would start out of a card that
             is not showing anything yet.

             🔴 It comes off again below FLIP_FROM, so scrolling back up and
             down replays it rather than leaving the line already read. */
          const firstSlide = q('.hero__slide:first-child');

          if (!bridgeCopy) {
            const src = firstSlide && firstSlide.querySelector('.hero__content');
            const hs2 = q('.hero__stage');
            if (src && hs2) {
              const sR = src.getBoundingClientRect(), hR = hs2.getBoundingClientRect();
              heroCopyTarget = { left: sR.left - hR.left, top: sR.top - hR.top, width: sR.width, height: sR.height };
              /* 🔴 Carry the column's PADDING across by hand. .hero__content
                 sizes its top inset off `var(--film-w)`, and that variable is
                 declared on .hero__stage — the clone hangs off <body>, so the
                 var resolves to nothing, the whole padding declaration is
                 thrown out as invalid, and it computes to 0. The box was in
                 the right place and the words inside it were not: 72px left
                 of and 90px above where the real line sits, i.e. jammed up
                 under the header, then jumping into place at the handover.
                 Measured: bridge title (763, 0) against the real (835, 90). */
              heroCopyTarget.pad = getComputedStyle(src).padding;
              bridgeCopy = src.cloneNode(true);
              bridgeCopy.className = 'intro__bridge ' + src.className;
              bridgeCopy.setAttribute('aria-hidden', 'true');
              document.body.appendChild(bridgeCopy);
            }
          }

          if (bridgeCopy && heroCopyTarget) {
            /* 🔴 The line RIDES THE CARD instead of waiting at the finish.
               Parked at its final coordinates it read as a second, unrelated
               thing: fully written, alone at the top of the screen, with the
               picture it belongs to still crossing the page below it (and
               close enough to the top edge to run into the bar). Carrying the
               card's own remaining offset keeps the two in one composition —
               they arrive together, because they move together. */
            const dx = left - tgt.left, dy = top - tgt.top;
            bridgeCopy.style.left   = (heroCopyTarget.left + dx).toFixed(1) + 'px';
            bridgeCopy.style.top    = (heroCopyTarget.top  + dy).toFixed(1) + 'px';
            bridgeCopy.style.width  = heroCopyTarget.width.toFixed(1) + 'px';
            bridgeCopy.style.height = heroCopyTarget.height.toFixed(1) + 'px';
            bridgeCopy.style.padding = heroCopyTarget.pad;
            /* 🔴 …and the wipe is measured to the PIN, not to a fraction of
               the flip. The card's travel eases out, so it is 87% home with
               520px still to scroll: anything tied to that curve finished
               early and left the sentence standing on its own for most of a
               screen — which is exactly what looked wrong. Ending on the pin
               makes the last letter and the deck's arrival the same instant. */
            const w = clamp(1 - (pinY - window.scrollY) / WIPE_PX);
            bridgeCopy.style.setProperty('--wipe-n', w.toFixed(3));
            bridgeCopy.style.opacity = w > 0 ? '1' : '0';
          }

          /* 🔴 The deck's own column rides up into the screen during this
             last viewport — it is no longer safely below the fold, so the
             real line and the bridge's line would be on screen together,
             the same words twice, a few hundred pixels apart. Hide the real
             one for exactly as long as the bridge is carrying it.

             And arm it WHILE IT IS HIDDEN: .is-copy-armed kills the
             transition, so adding .is-copy-in here snaps the line to its
             finished state instead of starting an 0.8s wipe that would still
             be running when the bridge lets go. At the pin the class comes
             off with the line already in place — nothing to see, which is
             the point of a handover. */
          if (firstSlide) {
            const src = firstSlide.querySelector('.hero__content');
            if (src) src.style.visibility = 'hidden';
            firstSlide.classList.add('is-copy-armed', 'is-copy-in');
          }
        }

      } else {
        /* flip not active — restore everything to its natural state */
        if (flipper.style.opacity !== '0') {
          flipper.style.opacity = '0';
        }
        media.style.visibility = '';
        if (copy) copy.style.opacity = '';
        const firstInner = q('.hero__slide:first-child .hero__inner');
        if (firstInner) firstInner.style.visibility = '';

        /* ---------- the playhead handover ----------
           🔴 HERE, at the frame the flip goes inactive. The card and the
           deck's slide-one <video> are two objects showing one film, and the
           swap between them is a CUT: the second has to start where the first
           stopped or the cut is visible as a rewind. So the back face's
           currentTime is read at this exact moment and written into the
           deck's element.

           🔴 `spent` IS THE OTHER HALF. If the film had already ENDED by the
           time the card landed — a slow crossing — then the deck has already
           shown it, and syncFilm()'s ended-branch would rewind and replay it
           the moment the reader arrived. The flag holds the last frame
           instead. (The faster crossings are covered on hero.js's side: it
           promotes `handoff` to `spent` when the film ends still wearing the
           flag, so wherever the ending falls the rule is the same.)

           🔴 ONCE. `pastIntro` stays true for the rest of the page, so
           without the latch this re-clamps the deck's film to one frozen
           instant on every scroll event. Going back UP clears both latches
           below, which is the one case that should replay the crossing. */
        if (pastIntro && !handedOver && backVid) {
          handedOver = true;
          const deckVid = q('.hero__slide:first-child .hero__video');
          if (deckVid) {
            const done = backVid.ended;
            /* 🔴 a HAIR back from the end when the film is done, not the end
               itself. Seeking to exactly duration leaves `ended` ambiguous
               across browsers, and syncFilm() branches on it; a frame short
               is unambiguously "not ended", paints the same picture, and the
               `spent` flag below is what actually stops the replay. */
            const t = done ? Math.max(0, backVid.currentTime - 0.05) : backVid.currentTime;
            /* metadata is normally long since in — preload="auto" and the
               element has been on the page since load — but a seek before it
               lands is silently dropped, which is the rewind this exists to
               prevent. Same wait startClock() uses. */
            const seek = () => { try { deckVid.currentTime = t; } catch (e) {} };
            if (deckVid.readyState >= 1) seek();
            else deckVid.addEventListener('loadedmetadata', seek, { once: true });
            if (done) deckVid.dataset.spent = '1';
          }
          backVid.pause();
        } else if (!pastIntro) {
          /* back above the flip: the crossing has not happened, so nothing
             may be left claiming that it has. */
          handedOver = false;
          backStarted = false;
          if (backVid) { backVid.pause(); try { backVid.currentTime = 0; } catch (e) {} }
          const deckVid = q('.hero__slide:first-child .hero__video');
          if (deckVid) { delete deckVid.dataset.handoff; delete deckVid.dataset.spent; }
        }
        const rail = q('.hero__rail');
        if (rail) rail.style.opacity = '';
        /* 🔴 only re-arm ABOVE the flip, never below it. Past the intro the
           deck owns its own slides, and stripping the class here would take
           the first line back off the screen every time the reader scrolled
           within the hero. */
        const firstSlide = q('.hero__slide:first-child');
        if (firstSlide) {
          const src = firstSlide.querySelector('.hero__content');
          if (src) src.style.visibility = '';
          if (pastIntro) {
            /* 🔴 the handover, and it is a swap of two identical frames: the
               bridge goes off, the deck's own line comes back visible with
               .is-copy-in already on it and its wipe already finished. Only
               the arming class is dropped, so every LATER slide change gets
               its normal timed entrance from goHero(). Without this the
               reader would arrive at slide one with an empty column —
               hero.js deliberately leaves slide 0 without .is-copy-in. */
            firstSlide.classList.remove('is-copy-armed');
            firstSlide.classList.add('is-copy-in');
          } else {
            firstSlide.classList.remove('is-copy-armed', 'is-copy-in');
          }
        }
        if (bridgeCopy) bridgeCopy.style.opacity = '0';
      }
    }


  }

  /* ---------- one scroll, one progress number ----------
     Layout reads are cached, so the handler is arithmetic plus a handful of
     custom-property writes — no rAF gate, and nothing that can fall out of
     step with anything else. */
  let top = 0, range = 1, pinY = 0;
  const remeasure = () => {
    top = intro.offsetTop;
    range = Math.max(1, intro.offsetHeight - window.innerHeight) / (PHONE ? FLIP_FROM : 1);
    /* 🔴 where the NEXT SECTION takes the screen, which is NOT where the
       intro's progress runs out. A sticky stage is released one full viewport
       before its section ends, so the intro's last 100svh is the pinned scene
       sliding away — 900px at 1440×900 — and only then does the next section's
       own stage reach top:0. That viewport is what the flip has to cross; see
       the flip block for why it is measured here and not assumed.

       🔴 2026-09-03：这里原本写死 `heroEl.offsetTop` —— deck 紧跟 intro 时
       两者是同一个数，所以一直没露馅。改版把 deck 挪到页尾之后它变成三万多，
       后果有两个，都是致命的：

         · glideTopic(3) 的目标就是 pinY，一次滚动把读者滑出两万多像素
           （实测：从 intro 第三格直接滑到 27468，穿过整个 hub 落进 meet）；
         · ownsDesktopIntro() 用 `scrollY < pinY` 判「这一段归我管」，于是
           intro 的拍子机器接管了**整个 hub 段**的滚轮——每个 wheel 都被
           preventDefault 掉换成 intro 的一拍，hub 那边因此「什么也没有」。

       改成读 DOM 顺序上紧跟 intro 的那一段，谁排在后面都对，不再绑死 deck。 */
    let nx = intro.nextElementSibling;
    while (nx && !nx.matches('section, footer')) nx = nx.nextElementSibling;
    pinY = nx ? nx.offsetTop : top + range;
  };
  /* 🔴 One more pass after the scrolling stops. The film aims at the slot's
     MEASURED rect, so any frame computed while the sentence is still
     settling — the word-reveal tween is mid-flight, a webfont has just
     swapped, a transition is running — aims at a position the slot is
     about to leave, and nothing re-runs to correct it. Measured: the film
     parked 16px low and stayed there until the next scroll event.
     A trailing re-run costs one frame per gesture and makes the landing
     independent of what else happened to be moving. */
  let settle = null;
  /* re-run the frame at the current scroll position — used by anything
     that moves the sentence under the film */
  const reaim = () => frame(clamp((window.scrollY - top) / range));
  const onScroll = () => {
    const progress = clamp((window.scrollY - top) / range);
    frame(progress);
    if (RESUMING_AWAY_FROM_TOP && window.scrollY <= top + 2) {
      intro.classList.remove('is-opening-skipped', 'is-scroll-committed');
    }
    clearTimeout(settle);
    settle = setTimeout(() => frame(clamp((window.scrollY - top) / range)), 140);
  };

  /* 🔴 「先在中央、再滑到左侧」的入场位移**已撤**（2026-09-04，用户：「还是
     不要有一个居中的效果了，就是一开始就是在左侧」）。原实现是量出标题盒子
     中心与视口中心的差、写进 --hero-lift-x/y 当起点，.intro.is-sub 一到归零。
     要恢复就把那段量取逻辑和 intro.css 里 .intro__hero-line 的 translate 一起
     加回来——两边是一对，只留一半会让标题永远停在偏移位上。 */
  /* 🔴 转场里那句标题的顶距：量 hub 的第一句实际落在哪，再照搬。
     两边是同一句话、要停在同一个位置，而 hub 那条位置是「舞台 3svh 内距 +
     .hub__head 的 margin」推出来的，随视口变——照抄数字迟早对不上。 */
  /* 🔴 量的是 hub 那句标题**当下**的位置，所以要**反复量**，不能只在启动时量
     一次。启动那一刻 hub 是 docked 态，而 .hub.is-docked .hub__title 上挂着
     `transform: translateY(-10px)`；前奏态（.hub.is-prologue）又把它清掉。
     两个状态的位置差 14px，只量一次就会错这么多——实测 intro 的句子落在 107，
     hub 的却在 93，交接那一下字会跳一格。

     两句是同一句话、同一字号字重，交接靠的就是「同一个位置」这一条，差 14px
     就全露馅。所以在转场期间每帧重量（两次 getBoundingClientRect，可忽略）。 */
  const syncRoomLine = () => {
    const hubStage = document.querySelector('.hub__stage');
    /* 🔴 量 **.is-meet 那一句**，不是第一句。交接时接住这句的是前奏用的
       Meet Nestify（索引 5），它比其余四句大一档、位置也因此不同；照第一句量
       会差出一整行的高度。 */
    const hubLine = document.querySelector('.hub__title-line.is-meet')
      || document.querySelector('.hub__title-line');
    if (!hubStage || !hubLine) return;
    const top = hubLine.getBoundingClientRect().top - hubStage.getBoundingClientRect().top;
    if (top > 0) intro.style.setProperty('--room-line-top', top.toFixed(1) + 'px');
  };
  syncRoomLine();
  addEventListener('resize', syncRoomLine);

  buildCopy();
  remeasure();
  /* Browser restoration is usually early, but its timing is not a visual
     contract. Put the saved position back before the first intro frame so a
     reload inside scene two starts with the in-line film, never the opener. */
  if (RESUMING_AWAY_FROM_TOP && Math.abs(window.scrollY - resumeScrollY) > 1) {
    window.scrollTo(0, resumeScrollY);
  }
  onScroll();
  /* 🔴 2026-09-04：滚动改走 rAF 批处理。
     此前这里是 `addEventListener('scroll', onScroll)` 直挂——onScroll 每收到
     一个 scroll 事件就同步跑一遍 frame()，而 frame() 里有六处
     getBoundingClientRect（舞台、影片、槽位、翻卡落点、桥接文案）与样式写
     **交错**，每一次读都强制浏览器把前面的写 flush 成布局。滚动事件在一帧内
     可以来好几次，于是同一帧里重复付这笔钱。

     这一段是每位访客**第一个**滚到的东西，代价最贵的地方也在这里。而且它是
     本仓库的异类：hub.js / hero.js / drift.js 都有 ticking + rAF 闸，只有
     intro 没有。这里补上同一个模式。

     直接调用的那几处（初始化、resize、intro:typed 的 reaim）保持同步不变——
     它们是一次性的，不该被推迟一帧。 */
  let scrollTicking = false;
  addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => { scrollTicking = false; onScroll(); });
  }, { passive: true });
  /* drift.js types on its own clock, so the characters change while nothing
     is scrolling — and the dot is measured off the typed span's right edge.
     Without this it only catches up on the next wheel event and the caret
     lags a word behind. */
  addEventListener('intro:typed', reaim);
  addEventListener('resize', () => { baseBox = null; remeasure(); onScroll(); });
  addEventListener('pagehide', () => {
    if (!DESKTOP) return;
    try { sessionStorage.setItem(RESUME_SCROLL_KEY, String(Math.round(window.scrollY))); }
    catch (e) { /* storage is optional; native browser restoration still works */ }
  });

  /* ---------- the settle: let go half-way and it finishes the move ----------
     squareup.com does this and it is most of why their opener feels like a
     mechanism rather than a slider. Measured on theirs at 1440×900: stop the
     wheel at 180 and the page walks itself to 342; stop at 640 and it goes to
     1489; coming back up, stop at 1009 and it returns to 540. Ours had a drift
     of exactly 0 at every one of those — the film simply froze at whatever
     half-size the wheel happened to land on, 526px or 321px wide, sizes the
     design never has a use for. The shrink has two states worth resting in and
     this makes them the only two.

     🔴 It is NOT CSS scroll-snap. Theirs isn't either — html, body and every
     element on squareup report `scroll-snap-type: none` (the only snapping on
     that page is the hardware carousel, and that one is horizontal). Snap
     would apply to the whole document and fight every other pinned section on
     this page; this is scoped to one 540px window and nothing else.

     🔴 It is also not scrollTo({behavior:'smooth'}). That cannot be cancelled
     — once handed to the browser it runs to completion, so a user who changes
     their mind mid-settle gets dragged. Hand-animating on rAF means any new
     input kills it on the next frame, which is the difference between an
     assist and a hijack.

     DIRECTION, not proximity: scrolling down always finishes the shrink,
     scrolling up always restores the film, however far you actually got. It
     matches what the eye already committed to. */
  const SETTLE_QUIET = 150;   // ms of silence before it is our turn — long
                              // enough to sit out trackpad momentum, which
                              // keeps firing scroll events until it stops
  /* 🔴 Scaled by distance, like the deck's glide in hero.js. The shrink
     window is 2.7 viewports of scroll now that the track is 900svh — a
     flat 520ms across ~2400px is a teleport, not a settle. Floor keeps a
     short correction crisp, ceiling keeps a long one from dragging. */
  const settleMs = (px) => Math.max(380, Math.min(1100, 300 + Math.abs(px) * 0.24));
  const SETTLE_EDGE = 8;      // px of slack at each end, so it never nudges
                              // at a position it is already happy with

  let quiet = null, raf = 0, assisting = false;
  let lastY = window.scrollY, dir = 1;

  /* 🔴 IT DOES NOT REACH INTO LENIS, and that is a deliberate retreat. It
     briefly did: a Lenis tween is not a rAF we own, so cancelling one does
     not cancel the other, and the CTA's 6.4s tour is long enough that
     keyboard scrolling — which reaches the page natively and never touches
     Lenis's virtual-scroll path — could not call it off. The fix was to
     stop the tween where it stood, `lenis.scrollTo(animatedScroll,
     {immediate: true})`.

     That is a WRITE TO THE SCROLL POSITION, on every wheel event that
     follows a glide, from a function whose entire job is supposed to be
     letting go. Lenis's `animatedScroll` is its own idea of where the page
     is, which during a tween is not where the document is, so the "stop"
     could move the page — and it ran constantly, because maybeSettle
     glides every time the wheel goes quiet inside the shrink or the flip.
     A cancel that can itself scroll is worse than the gap it closed.

     What is left is the original: cancel our own rAF, drop the flag. Wheel
     and touch already stop a Lenis tween on their own (its virtual-scroll
     handler does it unless `lock` is set), so the realistic interruption
     works. Keyboard during the tour does not, and that is the known cost. */
  function stopSettle() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; assisting = false;
  }

  /* `ms` and `easing` are overrides — omitted, this is the settle it has
     always been. The CTA's tour passes both, because a tour is a different
     animation from a correction: far longer, and paced to be watched
     rather than to get out of the way. */
  function glide(to, ms, easing, locked = false) {
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) return;
    const t0 = performance.now();
    assisting = true;

    /* Same handover as the deck's glide in hero.js — see the note there.
       Two animators on one scrollTop fight; and the timer is required
       because an interrupted tween never reports completion, which would
       leave `assisting` stuck and kill every later settle. */
    const dur = ms || settleMs(to - from);
    const curve = easing || ease;

    if (window.lenis) {
      let done = false;
      const finish = () => { if (!done) { done = true; stopSettle(); } };
      window.lenis.scrollTo(to, {
        duration: dur / 1000,
        easing: curve,
        force: true,
        lock: locked,
        onComplete: finish
      });
      setTimeout(finish, dur + 220);
      return;
    }

    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, from + (to - from) * curve(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else stopSettle();
    })(t0);
  }

  /* 🔴 2026-09-04：桌面「一次滚动 = 换一个词」的拍子机器**整块删除**。

     它原本的职责是：把 intro 第二幕的滚动切成两拍，每拍滑到一个锚点并派发
     intro:topic 换词，期间 preventDefault 掉滚轮与方向键。同一天换词改成了
     drift.js 里的 1s 自动轮播（不再吃滚动），这套机器于是只剩阻尼没有收益——
     用户此前也说过这一段「阻尼有点大」。

     跟着一起消失的：TOPIC_PROGRESS / topicEase / topicIndex / topicStepping /
     topicPending / ownsDesktopIntro / syncTopicIndex / topicAnchor /
     glideTopic / runDesktopIntent / consumeDesktopIntent，以及 wheel 与
     keydown 两个 capture 监听。glide() 本身**保留**——settle 和 CTA 的导览
     还在用它。

     `is-scroll-committed` 类的切换也随之没了：它当初是给那颗已删的滚动提示
     圆片用的，现在没有任何 CSS 消费它。 */



  /* 🔴 2026-09-04：翻卡**自动播完**，不再要求读者一路滚下去。
     用户：「不想让它下滑才变，相当于在原地它就放大变成墙上的设备，其他东西
     渐渐出现」。

     做法不是新写一套动画——翻卡本来就是滚动位置的纯函数
     （ft = (scrollY - flipFromY) / (pinY - flipFromY)），所以让**滚动位置自己
     走完**这段，卡片就自己长大、落到 hub 那台挂墙 pad 上，房间也跟着浮现。
     一次 glide 即可，1332px / 1.5 屏 / 1.6s。

     触发点取翻卡起点（p = FLIP_FROM）：读者滚到这儿，剩下的交给页面。再往前
     的距离不动——影片缩进句子、词自动轮播那一段仍然由读者控制。

     🔴 可取消，这是前提。任何滚轮 / 触摸 / 按键都会打断它——文件下方那三个
     监听里的 stopSettle() 已经做了这件事，Lenis 自己的虚拟滚动也会停掉正在
     跑的 tween。一个抢走滚动又停不下来的动画比不做还糟，本文件别处（TOUR_MS
     那段）为同一件事写过同样的话。

     🔴 只播一次：played 闩住。否则读者往回滚一点又会被再推下去，等于把人锁在
     这一段里出不去。 */
  /* 🔴 原地转场改成**滚动驱动**（2026-09-04，用户第四次修正）。

     前三版都用了时钟：glide 到 hub → glide 挂安静定时器 → rAF 推 autoFlipT。
     用户要的是「往下滚不是让屏幕往下滚，往下滚是触发这个渐变的动画」——
     也就是滚动当**擦洗条**用，画面本身钉住不动。

     所以这里不再有任何定时器：翻卡的 ft 回到它原本的算法（滚动位置的纯函数），
     而 intro 的舞台本来就是 sticky 的，所以这一段滚起来画面是钉住的。房间
     则由同一个 ft 推上来（见 intro.css 的 --room-t）。 */

  function maybeSettle() {
    if (DESKTOP || REDUCED || assisting) return;
    const y = window.scrollY;

    /* -- shrink zone (original) ------------------------------------------ */
    const shrinkEndY = top + range * SHRINK_END;
    if (y > top + SETTLE_EDGE && y < shrinkEndY - SETTLE_EDGE) {
      glide(dir > 0 ? shrinkEndY : top);
      return;
    }

    if (PHONE) return; // Lights Up has its own clock, never settle-scroll into it.

    /* -- flip zone (new) --------------------------------------------------
       The card flip runs from p=FLIP_FROM to p=FLIP_TO (0.85→1.0).
       If the user stops inside that window, snap them to whichever end
       matches their direction: forward → complete the flip and enter hero,
       backward → unwind to just before the flip starts.

       🔴 The glide target going FORWARD is NOT `top + range` (the intro's
       last scroll pixel) — it is `top + range + window.innerHeight` (heroTop:
       the position where the hero stage first pins to top:0 and its content
       fills the viewport). The gap between the two is one full viewport of
       "hero section entering from the bottom", which is what made the right-
       column text appear blank after the flip. Carrying the user one viewport
       further means hero slide 1 is already on screen, pinned and complete,
       the moment the settle lands. The flipper's `pastIntro` guard already
       hides it as soon as scrollY crosses `top + range`, so the handoff to
       hero.js is seamless. */
    const flipStartY = top + range * FLIP_FROM;
    const heroTop    = top + range + window.innerHeight;   /* where hero pins */
    if (y > flipStartY + SETTLE_EDGE && y < top + range - SETTLE_EDGE) {
      glide(dir > 0 ? heroTop : flipStartY);
    }

  }

  /* ---------- the unskippable reveal -----------------------------------
     This is the one sequence whose meaning depends on seeing every beat:
     device wireframe -> room drawing -> rendered room -> scan. A raw scroll
     position cannot guarantee that — one trackpad fling can cross the whole
     interval without the browser ever painting its middle frames.

     Crossing FLIP_FROM downward therefore starts one short, time-bounded
     playback. The existing animation remains the single source of truth: we
     merely drive its scroll range over 3.2 seconds. Lenis is locked only for
     this passage so momentum cannot cancel it; the native fallback is guarded
     by the input handlers below. It plays once per page visit, so scrolling
     back up remains natural and never traps the reader in a loop. */
  const REVEAL_MS = 3200;
  const revealEase = (t) => t * t * (3 - 2 * t);
  let revealPlayed = false;
  let revealPlaying = false;

  function playReveal() {
    if (PHONE || REDUCED || revealPlayed || revealPlaying) return;
    revealPlayed = true;
    revealPlaying = true;
    clearTimeout(quiet);
    stopSettle();

    const from = top + range * FLIP_FROM;
    /* A fast wheel event may already have crossed the range before its first
       scroll event is delivered. Put the film back on its opening frame in
       the same turn, then let the normal frame() path paint every beat. */
    if (window.lenis) window.lenis.scrollTo(from, { immediate: true, force: true });
    else window.scrollTo(0, from);

    requestAnimationFrame(() => {
      glide(pinY, REVEAL_MS, revealEase, true);
      setTimeout(() => { revealPlaying = false; }, REVEAL_MS + 240);
    });
  }

  function guardRevealWheel(e) {
    if (revealPlaying) { e.preventDefault(); return; }
    if (PHONE || REDUCED || revealPlayed || e.deltaY <= 0) return;
    const start = top + range * FLIP_FROM;
    const y = window.scrollY;
    if ((y >= start && y < pinY) || (y < start && y + e.deltaY >= start)) {
      e.preventDefault();
      playReveal();
    }
  }
  addEventListener('wheel', guardRevealWheel, { passive: false, capture: true });

  /* Touch and keyboard scrolling do not expose a reliable future delta.
     Catch their first resulting scroll instead; the immediate rewind above
     prevents a large gesture from leaving the reveal half-painted. */
  addEventListener('scroll', () => {
    if (PHONE || REDUCED || revealPlayed || revealPlaying) return;
    const start = top + range * FLIP_FROM;
    const y = window.scrollY;
    if (lastY < start && y >= start) playReveal();
  }, { passive: true });

  const blockRevealInput = (e) => {
    if (!revealPlaying) return;
    if (e.type === 'keydown' && !['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
  };
  addEventListener('touchmove', blockRevealInput, { passive: false, capture: true });
  addEventListener('keydown', blockRevealInput, { passive: false, capture: true });

  addEventListener('scroll', () => {
    const y = window.scrollY;
    /* 🔴 our own glide fires scroll events too. Reading a direction off them
       would re-arm the timer from inside the animation and the page would
       creep on forever. */
    if (assisting) { lastY = y; return; }
    if (Math.abs(y - lastY) > 1) dir = y > lastY ? 1 : -1;
    lastY = y;
    clearTimeout(quiet);
    /* 🔴 停手之后才播，不是滚到就播。SETTLE_QUIET(150ms) 的原意就是「等惯性
       尾巴走完，现在轮到我们」——自动翻卡要的正是这个条件，否则读者自己的
       余波会把它掐掉。maybeSettle 在桌面上直接 return，所以这条定时器此前在
       桌面是空转的，正好接管。 */
    quiet = setTimeout(maybeSettle, SETTLE_QUIET);
  }, { passive: true });

  /* the moment anyone touches anything, it is their page again */
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach((e) =>
    addEventListener(e, () => {
      clearTimeout(quiet);
      if (!revealPlaying) stopSettle();
    }, { passive: true }));

  if (video) {
    /* keep the box on the footage's real shape */
    const readAR = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      AR = video.videoWidth / video.videoHeight;
      onScroll();          // frame() owns --mar; it interpolates off AR
    };
    video.addEventListener('loadedmetadata', readAR, { once: true });
    readAR();

    const play = () => video.play().catch(() => {});
    play();
    /* Safari sometimes refuses until the tab is interacted with */
    ['pointerdown', 'touchstart', 'keydown'].forEach((e) =>
      addEventListener(e, play, { once: true, passive: true }));
  }

  /* whichever lands first — a decoded frame, the poster standing in for
     one, or the cap. All three mean the same thing: there is now something
     in the hole. */
  if (REDUCED || !video) {
    startOpener();
  } else {
    setTimeout(startOpener, START_CAP);
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(() => startOpener());
    video.addEventListener('loadeddata', startOpener, { once: true });
    const poster = video.getAttribute('poster');
    if (poster) {
      /* the <video> paints the poster off this same cache entry, a frame
         behind this load at worst */
      const img = new Image();
      img.onload = () => requestAnimationFrame(startOpener);
      img.src = poster;
    }
  }

  /* 🔴 房间线稿（170KB）等视频首帧之后再取。它离读者还有三四屏，但开场时
     和 hero 视频抢带宽会直接推迟首帧——首帧就是开场动画的发令枪。 */
  {
    const arm = () => intro.classList.add('is-room-ready');
    if (REDUCED || !video) arm();
    else {
      video.addEventListener('loadeddata', arm, { once: true });
      setTimeout(arm, 4000);
    }
  }

  /* ---------- the CTA is a scroll cue, and it takes you on the tour ------
     It read `href="#"`, which is not a no-op — it sends the browser to the
     TOP of the document. Under a button whose whole job is "there is more
     below", that is the one direction it must not go.

     🔴 IT PLAYS THE OPENER, IT DOES NOT SKIP IT. Two earlier versions got
     this wrong in opposite directions and both are worth remembering:

       to the hero, at settle speed — the settle caps at 1100ms, and 1.1
         seconds across eight viewports is not a scroll, it is a cut. The
         film shrank, the grid built, the sentence rewrote itself twice and
         a card flipped, all in about the time it takes to blink. The
         content was not skipped; it was played too fast to see, which
         looks the same and is more wasteful.

       to the end of the shrink — the other overcorrection. It stopped
         after the one move it was sure about and left the reader stranded
         mid-opener, having pressed a button that did a third of a thing.

     What it does now is carry them through the whole opener at a pace
     built to be watched, and stop where the page starts driving itself:
     `heroTop`, with hero slide one ("Your whole family, in one place")
     pinned and complete. From there the reader is on a normal page again.

     🔴 THE DURATION IS SET BY THE TYPEWRITER, not by taste. The tail of
     the lead rewrites itself twice on the way down — parent, child, family
     — at drift.js's thresholds p=0.52 and p=0.76, and drift.js types at
     42ms per character on and 22ms off. So "child" costs 6x22 + 5x42 =
     342ms to arrive and "family" costs 5x22 + 6x42 = 362ms. Scroll past a
     threshold faster than that and the word is still being spelled when
     the next thing happens.

     The binding gap is the LAST one: `family` starts at p=0.76 and the
     card flip starts at p=0.85, only nine points of track later. Solving
     for that gap to clear 362ms is what fixes the total, and it lands at
     6400ms — at which the milestones fall

         shrink ends   1.9s
         "child"       3.0s   (+1.1s to read it)
         "family"      4.0s   (+0.9s, and 375ms before the flip)
         flip starts   4.3s
         intro ends    5.1s
         hero slide 1  6.4s

     🔴 SMOOTHSTEP, NOT THE SETTLE'S CUBIC EASE-OUT. Ease-out is right for a
     correction — go now, arrive gently — but over six seconds it front-
     loads brutally: half the distance is gone in the first fifth of the
     time, so the shrink would flash past and the flip would crawl. A tour
     wants an even middle and soft ends, which is exactly what t^2(3-2t)
     is. The timings above are computed against it, not against a constant
     speed; they are not the same.

     🔴 Six seconds is only acceptable because it is CANCELLABLE. A wheel
     or a touch kills it: our own listener above drops `assisting`, and
     Lenis stops its tween on its own virtual-scroll path. Keyboard is the
     gap — see the note on stopSettle for why closing it is not worth what
     closing it cost. */
  const TOUR_MS = 6400;
  const tourEase = (t) => t * t * (3 - 2 * t);

  const cta = intro.querySelector('.intro__cta');
  if (cta) {
    cta.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;  // let it open a tab
      e.preventDefault();
      intro.classList.add('is-scroll-committed');
      /* 🔴 `top + range + innerHeight`, not the intro's last pixel: `top +
         range` leaves the hero one full viewport below, still entering, and
         the tour would end on a blank screen. Same target the forward
         settle uses out of the flip zone — see maybeSettle. */
      const to = PHONE ? pinY : top + range + window.innerHeight;
      /* nothing to watch under reduced motion, and six seconds of forced
         movement is the exact thing that setting is asking us not to do */
      if (REDUCED) { window.scrollTo(0, to); return; }
      /* the pointerdown that preceded this click already ran stopSettle,
         so nothing is in flight to collide with */
      glide(to, TOUR_MS, tourEase);
    });
  }

  /* The CTA's hover is the page's one shared disc — .btn-disc in
     styles.css, the same .55s centre-grow the header pills use. It used to
     open from the point the cursor crossed the edge, measured here per
     enter (--fx/--fy/--fs) and finished off with an `is-filled` class on
     transitionend. That was a second interaction for buttons to have, and
     buttons are supposed to answer in one voice, so it went. */
})();
