/* ============================================================
   FAMILY HUB — section 05, scroll-driven.

   One progress number runs the whole section. Before the pad docks
   it drives the real Family Hub (Flutter iframe). After DOCK the
   pad hangs on the wall and the thesis / CTA take over.
   ============================================================ */
(function () {
  const hub = document.querySelector('.hub');
  if (!hub) return;

  const stage = hub.querySelector('.hub__stage');
  const thesis = hub.querySelector('.hub__thesis');
  const cta = hub.querySelector('.hub__cta');
  const wrap = document.getElementById('hubWrap');
  const pad = hub.querySelector('.hub__pad');
  const screen = hub.querySelector('.hub__screen');
  const inner = hub.querySelector('.hub__inner');
  const catcher = hub.querySelector('.hub__catch');
  const iframe = document.getElementById('hub-app');
  const flies = document.getElementById('hubFlies');
  const nestieHost = document.getElementById('hubNestie');
  const fxCanvas = document.getElementById('hubFx');
  const habitsHost = document.getElementById('hubHabits');
  if (!stage || !screen || !inner || !iframe) return;

  /* ---------- lazy boot of the Flutter hub ----------
     The iframe ships with data-src (see index.html) so the engine does not
     download while the intro film is starting. Inject the real src once the
     hub section is within 1.5 viewports. No timer fallback: the observer
     re-evaluates on every scroll and layout change, so anchor jumps and
     resizes are covered, .hub is never display:none, and browsers without
     IntersectionObserver take the eager branch — a timer would only force
     the ~4 MB engine on visitors who never leave the hero, against the
     still-streaming intro film. The load listener below re-tells the
     current scroll state once the real document arrives. */
  (function bootHubLazily() {
    const src = iframe.getAttribute('data-src');
    if (!src) return; /* markup went back to an eager src — nothing to do */
    if (!('IntersectionObserver' in window)) {
      iframe.setAttribute('src', src);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      /* 🔴 手机上不 boot，改用静态图（见 index.html 的 .hub__still 与那段注释）。
         判定放在**回调里**而不是函数开头：观察器因此保持挂着，读者要是转屏或
         把窗口拉宽过 767，下一次相交就会正常 boot。写在开头 return 的话，
         一台竖屏进来的手机横过来之后就永远只剩静态图了。 */
      if (matchMedia('(max-width: 767px)').matches) return;
      io.disconnect();
      iframe.setAttribute('src', src);
    }, { rootMargin: '150% 0px' });
    io.observe(hub);
  })();

  const TYPE_SPEED = 0.045;
  let thesisTl = null;
  let thesisDone = false;   /* 逐字跑满过一次之后就上锁，见 onScroll 里的 is-hushed */
  /* 🔴 2026-09-04 用户定版：**"One screen." 这一句保留逐字**（「这个可以用
     之前的」），而 hub 的五句标题改用 clip-path 横向擦除（见下面 titleLines
     那段）。两者从此不是同一种揭示，是有意的：五句标题是随滚动一拍一句地
     换，逐字在那里会把「换句」拖成两秒；而这一句是整段的落幕，只出现一次，
     逐字正好当收尾的节奏。 */
  if (thesis && window.gsap && window.SplitText &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    /* 🔴 'words,chars', NOT 'chars'. Splitting to characters alone puts
       every glyph in its own inline-block and takes the WORD BOUNDARIES
       with it — the browser is then free to break between any two letters,
       because as far as it can see there are no words here, only 44
       adjacent boxes. That is how "happens." came to sit on one line with
       its full stop alone on the next: the period is a box like any other
       and it fits where the rest of the word does not.
       Splitting words as well puts each word back in a box of its own, and
       a break can only fall between those. The animation is unchanged — it
       still runs on .chars, which words,chars returns exactly as before. */
    const chars = new SplitText(thesis, {
      type: 'words,chars', wordsClass: 'wd', charsClass: 'ch',
    }).chars;
    if (chars.length) {
      gsap.set(chars, { opacity: 0, yPercent: 26 });
      thesis.classList.add('is-typed');
      thesisTl = gsap.timeline({
        paused: true,
        onReverseComplete: () => hub.classList.remove('is-slot-busy'),
      }).to(chars, {
        opacity: 1, yPercent: 0, duration: 0.3, ease: 'power3.out', stagger: TYPE_SPEED,
      });
    }
  }

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* 🔴 RE-ANCHORED AGAINST 1235svh (hub.css), up from 1050. The marks are
     fractions of the section's scroll range, so they all move when the
     section grows — and the numbers below keep every measured svh AFTER the
     dock exactly where it was, and spend the whole increase before it.

       range = 1235 - 100 (the sticky stage) = 1135svh
       dock    785 / 1135 = .6916    (was 600svh of pre-dock, now 785)
       thesis  859 / 1135 = .7568    (74svh after the dock, unchanged)
       cta     878 / 1135 = .7736    (19svh after that, unchanged)
       exit    12.4 / 1135 = .0109   (the same 12.4svh it always was)
       head    10.7 / 1135 = .0094   (likewise)

     🔴 THE 185svh IS DAMPING FOR THE TWO CARD BEATS, and it had to be
     distance because that is the only currency this section has. The
     lead-ins were already 26% and 46% of the fly span and it still read as
     "one flick and everything happened" — because it WAS one flick: at
     150svh with `at` .72 the calendar's whole run, pad and scraps and
     flight, was 108svh, and a macOS flick carries about 100. No division
     of a span that short survives contact with one gesture.

     So the two of them grew instead: calendar 150 → 240, lists 135 → 230,
     which puts the pad alone at ~53svh — half a flick on its own, and 90
     before the cards so much as move. The other three beats are untouched
     at 90 / 100 / 125, so nothing else in the run changed pace. */
  /* range 依断点而异 —— PHONE 在本文件靠后才声明，这里另取一个早的。 */
  const PHONE_R = matchMedia('(max-width: 767px)').matches;
  /* 🔴 手机的 range 比桌面短，因为三面墙在手机上不再占滚动距离（改成时钟
     驱动了，见 syncRooms）。桌面 1513svh，手机 1140 = pre-dock 940 + 停靠
     尾巴 200。

     ⚠️ 下面每个数都是「同一个 svh 锚点 ÷ 各自的 range」，不是两套独立的设计：
     dock 仍在 940svh、thesis 仍在 dock 后 74、按钮再 19 —— 手机桌面**画面
     节奏完全一样**，只是手机在停靠之后少了 373svh 的空滚。 */
  /* 🔴 手机的四个锚点在 2026-09-05 整体前移，因为**段高从 1140svh 变成了
     200svh**（hub.css 末尾那块）：五拍摊成横滑轨道之后，没有要按滚动分配的
     演示了，那 940svh 的 pre-dock 是空的。

     现在的读法是：**前奏一结束，三样立刻就位**——停靠、thesis、按钮。
     桌面四个数一个没动。

     ⚠️ 这三个数在手机上已经不再分配任何节奏，只是「大于 0」的三个哨兵，所以
     压到千分位。理由是 progress() 在**前奏结束时把 p 从 DOCK 断崖式打回 ~0**
     （见那边的重映射），之后 p 才重新涨；而摊开之后，前奏之后的滚动距离全部
     属于「读者横划完卡片再往下走」，中间没有第二拍要等。
     两版走过的弯路都留在这儿：12/20/26 时按钮要再滚半屏才亮，4/7/10 仍然差
     一点（实测 f=0.45 处 .hub__cta 还没有 is-on、按钮 opacity 0）。
     ⚠️ 不能写 0：判据是 `p > CTA_AT`，0 在 p=0 那一帧仍然为假；而且 DOCK 还要
     给 is-early / intro 交接留一个「还没停靠」的区间。

     ⚠️ 别把手机的 DOCK 设成 0：progress() 在前奏期恒返回 DOCK，而 is-early /
     intro 交接那一段要靠「p < DOCK」区分「还没停靠」。留 12% 给它。 */
  const HEAD_IN = PHONE_R ? 0.0094 : 0.0071;
  const DOCK = PHONE_R ? 0.005 : 0.6213;
  const THESIS_AT = PHONE_R ? 0.010 : 0.6702;
  const CTA_AT = PHONE_R ? 0.015 : 0.6829;
  // Scroll-up lands here: Home, undocked, one more flick leaves the section.
  const EXIT_P = PHONE_R ? 0.0109 : 0.0082;

  /* 🔴 ONE BEAT PER HEADLINE, and each beat plays its own second half.
     calendar and lists used to be TWO beats each — `fly` scrubbed the cards
     in, then `play` was a whole further scroll that did nothing but hold
     them there. The headline did not change across the pair, so the reader
     was asked to scroll twice through one sentence and the second scroll
     had nothing in it.

     Now a stage is one beat, split by `at`: the cards fly over the part
     before it as you scroll, and `then` goes out on its own once they have
     landed — no second beat, no second scroll. `line` indexes
     .hub__title-line in index.html, and there is now exactly one beat per
     line, which is the whole point.

     🔴 `w` IS SVH, not an arbitrary weight. They are normalised against
     their own sum, so any unit works — and stating them as the scroll each
     stage actually costs is the difference between "1.8" and "48svh, half a
     screen, which is why that one flies past". Pre-dock is 600svh by
     construction, and DOCK above is set so that is exactly where it lands.

     The old eight beats spent 397svh in total and gave rewards 48 of it. No
     stage is under 90 now: a flick is ~1 screen, so every stage costs at
     least one and the reader cannot cross two of them without stopping. */
  /* 🔴 2026-09-02 home / rewards / meals 三拍加长（用户：「手机上 family hub
     滑动也没有阻力」）。手机上一次划动 ≈ 1 屏 ≈ 100svh，而这三拍原本是
     90 / 100 / 125 —— 一次划动就能整拍划过去，等于没有阻力：

         home     90 → 140     rewards  100 → 160     meals  125 → 170
         calendar 240、lists 230 不动（本来就跨不过去）

     pre-dock 785 → 940svh，range 1358 → 1513，段高 1458 → 1613svh。

     ⚠️ 改 range 就要把**每一个**按 range 取分数的常量一起换算——这个文件为此
     出过事故（漏了 ROOM_AT，换墙点跑到 thesis 前面去了）。

     🔴 dock 之后的保的是**相对 dock 的偏移**，不是绝对 svh：thesis 仍在 dock
     后 74svh、按钮再 19svh、三间房仍是 213/160/200 —— 上一轮给房间加的阻力
     一点没被稀释。 */
  /* 🔴 四拍 → **五拍**（2026-09-04 当天来回改了两次，两次的话都留着）。

     先删后加。删的时候的理由是：intro 的转场结尾那句正是 "Everything that
     matters today."，hub 第 0 拍又说一遍、屏幕内容也是同一屏，等于重复。

     加回来的时候用户把 intro 的落地句换成了 **Meet / Nestify**，重复就不存在了
     ——两句话各说各的，第 0 拍回到 hub 名下。段高也一起改回（见 hub.css）。 */
  const beats = [
    { tab: 'home', phase: 'think', w: 140, line: 0 },                                        // Everything that matters today.
    /* 🔴 THE CHIP MUST MATCH WHAT THE APP DRAWS ON THE OTHER SIDE OF THIS.
       `then` is a CUT: at .86 of the flight our seven chips dissolve and the
       app redraws the same seven events itself, so any way in which .ev is
       not the app's card shows up as the picture changing under a reader who
       has already stopped watching things arrive. It was bold-vs-regular for
       a long time — see the weight note in hub.css, which is where the
       matching is done and where the measurements live.

       ⚠️ DO NOT REMOVE `then` TO AVOID THAT. Tried, measured, reverted: in
       `calendar|fly` the app draws only three of its own cards and leaves
       the week empty for ours to land in. It is `calendar|play` that fills
       the other eleven in. Without the handover the reader is left looking
       at a calendar with seven events in it and five blank days. */
    { tab: 'calendar', phase: 'fly', w: 240, line: 1, then: 'calendar|play', at: 0.72, settle: true },    // All your calendars, synced.
    /* 🔴 NO `then` EITHER, and for a different reason than calendar's. The pad's
       `lists|play` puts these four sections at the top of their panels and
       shoves what was already there down; handing over therefore meant
       either flying the cards at an occupied slot, or flying them to the
       free space below and then watching the app move them. Neither reads
       as "something new arrived". Without the handover the app holds its
       own two lists still for the whole beat and the cards land under them,
       which is the sentence the headline is making. See LIST_GRID. */
    { tab: 'lists', phase: 'fly', w: 230, line: 2, at: 0.74 },                              // See what’s changing in your family.
    /* 🔴 idle FIRST, THEN play, and the app has both. This beat used to
       open straight on `rewards|play`, so the screen and the redemption it
       is showing off arrived on the same frame — the reader met the board
       already congratulating them for something they never saw un-won.
       `rewards|idle` draws the same board with "Redeem 8" still standing;
       the handover at .45 is what spends it. The gap is the point. */
    { tab: 'rewards', phase: 'idle', w: 160, line: 3, then: 'rewards|play', at: 0.45 },     // Know what they need as they grow.
    { tab: 'meals', phase: 'play', w: 170, line: 4, then: 'home|idle', at: 0.55 },          // The household, handled together.
  ];
  const nBeats = beats.length;
  const weightSum = beats.reduce((s, b) => s + b.w, 0);

  /* ---------- the five headlines arrive the way the thesis does ----------
     🔴 THE SAME EFFECT AS "One screen." — asked for, and right: that line
     and these five are the only sentences in the section, they share a slot
     (see .hub__head in index.html), and having them arrive two different
     ways made the swap look like a different kind of event from the ending.
     So this is thesisTl's treatment, split to glyphs and staggered, with
     two differences that the swap needs and the ending does not.

     🔴 EVERY LINE TAKES THE SAME TIME, whatever its length. The thesis is
     one sentence and can afford a fixed per-character stagger; five of them
     cannot — at .045 the shortest of these would land in half the time of
     the longest, so the reader's sense of how long a beat lasts would
     change with the sentence rather than with the scroll. SPREAD is the
     whole stagger, divided by however many characters the line has, so a
     34-character line and a 20-character one both take SPREAD to write.

     🔴 AND THEY TAKE TURNS. showLine reverses the outgoing timeline and
     only starts the incoming one when it is done — see the note there. The
     old CSS cross-fade had both at half strength on the same pixels, which
     is unreadable for type in a way it is not for the rooms.

     No GSAP, or reduced motion: nothing here runs, .is-typed is never set,
     and hub.css's own sequenced fade carries the swap instead. */
  const LINE_SPREAD = 0.42;   // s, the whole stagger of one line
  const LINE_DUR = 0.28;      // s, one glyph's own rise
  const LINE_OUT_SCALE = 2.4; // the exit is the entrance, hurried
  const titleLines = [...hub.querySelectorAll('.hub__title-line')];
  const lineTls = [];
  /* 🔴 2026-09-04：五句标题同样停用逐字，理由与上面 thesis 那段相同。
     lineTls 保持为空 → goLine() 里 `if (!lineTls.length)` 那条分支接管，
     由 hub.css 的 .hub__title-line.is-on 做 clip-path 擦除。 */

  // Pinned to proto hubToday = Tue Aug 18, 2026. Fills = PadEventColor.
  const todayCol = 2;
  const d = (off) => (todayCol + off + 7) % 7;
  const FILL = {
    david: '#DBECFF', // Sky
    sarah: '#CFF1EB', // Teal
    anna: '#FFE7BC', // Honey
    leo: '#E4F4D7', // Green
    mia: '#EDEAFF', // Purple
    nestie: '#F4F0E5', // PadEventColor.nestieCard
  };
  const SOLID = {
    david: '#81C5FF',
    sarah: '#5BBCB2',
    anna: '#F19D38',
    leo: '#6AB627',
    mia: '#9689DC',
    nestie: '#CBB47B', // PadEventColor.nestieAvatar
  };
  const ICONS = {
    person: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>',
    flower: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 22a9 9 0 0 1-2-17.78V3h4v1.22A9 9 0 0 1 12 22zm0-2a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm-1-6.1c.3-.05.7-.05 1 0 .6-1.8 2.1-3.2 4-3.6-1.9-.4-3.4-1.8-4-3.6-.3.05-.7.05-1 0-.6 1.8-2.1 3.2-4 3.6 1.9.4 3.4 1.8 4 3.6z"/></svg>',
    ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 2.07c3.07.4 5.51 2.78 6.02 5.81L13 8.02V4.07zM11 4.07v3.95L4.98 9.88C5.49 6.85 7.93 4.47 11 4.07zM4.26 11.7 10 10.12v5.66l-4.24 1.7A7.96 7.96 0 0 1 4.26 11.7zm1.96 8.03L11 17.91V19.93c-1.86-.24-3.52-1.2-4.78-2.6zM13 19.93v-2.02l4.78 1.82A8.03 8.03 0 0 1 13 19.93zm0-4.15V10.12l5.74 1.58a7.96 7.96 0 0 1-1.5 6.37L13 15.78z"/></svg>',
    /* 🔴 REDRAWN. The old path rendered as three dots over a BLOCK — its
       pad segment was malformed, so at 9px it read as a burger rather than
       a paw, while the app draws four toes over a rounded pad. Compared at
       6× against the app's own frame; this is four toes in an arc with the
       pad's shoulders tucked under them, which is what that frame shows. */
    paw: '<svg viewBox="0 0 24 24" aria-hidden="true">'
      + '<ellipse fill="currentColor" cx="5.9" cy="10.4" rx="2.15" ry="2.75" transform="rotate(-24 5.9 10.4)"/>'
      + '<ellipse fill="currentColor" cx="9.9" cy="6.5" rx="2.25" ry="2.95" transform="rotate(-9 9.9 6.5)"/>'
      + '<ellipse fill="currentColor" cx="14.1" cy="6.5" rx="2.25" ry="2.95" transform="rotate(9 14.1 6.5)"/>'
      + '<ellipse fill="currentColor" cx="18.1" cy="10.4" rx="2.15" ry="2.75" transform="rotate(24 18.1 10.4)"/>'
      + '<path fill="currentColor" d="M12 12.1c2.35 0 5.35 2.15 5.35 4.75 0 2.0-1.65 3.25-3.5 3.25-.75 0-1.25-.28-1.85-.28s-1.1.28-1.85.28c-1.85 0-3.5-1.25-3.5-3.25C6.65 14.25 9.65 12.1 12 12.1z"/>'
      + '</svg>',
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>',
  };
  const PEOPLE = {
    david: { id: 'david', name: 'David', solid: SOLID.david, icon: ICONS.person, photo: 'assets/hub-avatars/david.jpg' },
    sarah: { id: 'sarah', name: 'Sarah', solid: SOLID.sarah, icon: ICONS.flower, photo: 'assets/hub-avatars/sarah.jpg' },
    anna: { id: 'anna', name: 'Anna', solid: SOLID.anna, icon: ICONS.ball },
    leo: { id: 'leo', name: 'Leo', solid: SOLID.leo, icon: ICONS.paw },
    mia: { id: 'mia', name: 'Noah', solid: SOLID.mia, icon: ICONS.car },
  };
  const ALL = ['david', 'sarah', 'anna', 'leo', 'mia'];
  /* 🔴 `fill` IS WHAT THE APP ACTUALLY DRAWS, sampled off the build at its
     own 1920×1080 — not the FILL entry the owner would suggest. The pad
     dims events on days that are already past, so Sunday's and Monday's
     chips render as washed-out versions of their colour (#EEF3E5 where
     FILL.leo is #E4F4D7). A card that morphs into the un-dimmed colour
     would brighten on the last frame and then snap back the moment the app
     took over. `solid` is the accent that colour comes from, and it is here
     because cardInk() needs it to pick the ink the pad would pick.

     🔴 Movie night is 18, not 16. Its own label says 6:00–8:00 PM and the
     app draws it at six; `hour: 16` was landing it two hours high. Nothing
     caught it before because calDest's clamp — see below — was flattening
     every card into the 3–4 band anyway, so no hour was being honoured. */
  /* `who` is read off the app's chips, not guessed: the all-day pair carry
     no faces at all, the two lessons carry Leo alone, and the two evening
     events carry the whole family — which avatarHtml renders as three and a
     "+2", exactly as the pad does. */
  /* 🔴 HYPHEN, NOT EN DASH, IN `time`. A range wants an en dash and these
     all had one — but the app writes a hyphen, and the chip is a copy of
     the app's card, not a typographically better one. An en dash is
     visibly wider, so at the handover the whole string re-spaced: same
     face, same size, same weight, and it still read as a different font.
     That is what "字间距的问题" was. If the pad ever switches to en dashes,
     these follow it, not the other way round. */
  const calCards = [
    { title: 'Beach day', time: 'All day', source: 'sticky', note: 'Pack sunscreen', stack: 'left', slot: 0, day: d(-2), allDay: true, fill: '#E6F2ED', solid: SOLID.sarah, who: [] },
    { title: 'Movie night', time: '6:00-8:00 PM', source: 'sticky', note: 'Popcorn!', stack: 'right', slot: 1, day: d(3), hour: 18, hours: 2, fill: FILL.nestie, solid: SOLID.nestie, who: ALL },
    { title: 'Soccer practice', time: '3:00-5:00 PM', source: 'app', note: 'Club calendar', stack: 'left', slot: 1, day: d(-2), hour: 15, hours: 2, fill: '#EEF3E5', solid: SOLID.leo, who: ['leo'] },
    { title: 'Piano recital', time: '4:30-6:30 PM', source: 'mail', from: 'Lincoln School', note: 'Anna plays second. Please arrive by 4:10.', stack: 'left', slot: 2, day: d(-1), hour: 16.5, hours: 2, fill: '#F9EEDA', solid: SOLID.anna, who: ['anna', 'sarah', 'david'] },
    { title: 'Camping trip', time: 'All day', source: 'mail', from: 'David', note: 'Leave at 8. Tent is in the garage.', stack: 'right', slot: 0, day: d(4), allDay: true, fill: FILL.david, solid: SOLID.david, who: [] },
    { title: 'Family dinner', time: '5:00-7:00 PM', source: 'imessage', from: 'Sarah', note: 'Can we do dinner at five? Whole family.', stack: 'right', slot: 2, day: d(0), hour: 17, hours: 2, fill: FILL.nestie, solid: SOLID.nestie, who: ALL },
    { title: 'Swim lesson', time: '4:00-5:00 PM', source: 'paper', note: 'Bring goggles', stack: 'right', slot: 3, day: d(1), hour: 16, hours: 1, fill: FILL.leo, solid: SOLID.leo, who: ['leo'] },
  ];
  const listCards = [
    { kind: 'shop', title: 'Party supplies', items: ['Balloons', 'Paper plates', 'Birthday candles'], done: [false, false, false], who: ['sarah'], col: 0 },
    { kind: 'shop', title: 'School snacks', items: ['Apples', 'Cheese sticks', 'Granola bars'], done: [false, false, false], who: ['sarah'], col: 0 },
    { kind: 'todo', title: 'Home projects', items: ['Hang the shelf', 'Replace light bulb'], done: [false, false], who: ['david'], col: 1 },
    { kind: 'todo', title: 'Library pickup', items: ['Return picture books', 'Pick up holds'], done: [false, false], who: ['sarah'], col: 1 },
  ];
  const mealCards = [
    { title: 'Banana pancakes', img: 'hub-fly/meal-05.jpg', from: 'left', day: 0, row: 0 },
    { title: 'Short ribs', img: 'hub-fly/meal-01.jpg', from: 'top', day: 0, row: 2 },
    { title: 'Overnight oats', img: 'hub-fly/meal-02.jpg', from: 'left', day: 1, row: 0 },
    { title: 'Baked salmon', img: 'hub-fly/meal-03.jpg', from: 'top', day: 1, row: 2 },
    { title: 'School lunch', img: 'hub-fly/meal-04.jpg', from: 'bottom', day: 2, row: 1 },
    { title: 'Smash burgers', img: 'hub-fly/meal-06.jpg', from: 'right', day: 2, row: 2 },
    { title: 'Grilled cheese', img: 'hub-fly/meal-06.jpg', from: 'left', day: 3, row: 1 },
    { title: 'Leftover stew', img: 'hub-fly/meal-04.jpg', from: 'bottom', day: 3, row: 2 },
    { title: 'Overnight oats', img: 'hub-fly/meal-02.jpg', from: 'top', day: 4, row: 0 },
    { title: 'Grilled cheese', img: 'hub-fly/meal-06.jpg', from: 'right', day: 4, row: 1 },
    { title: 'Roast chicken', img: 'hub-fly/meal-01.jpg', from: 'right', day: 4, row: 2 },
    { title: 'Yogurt parfait', img: 'hub-fly/meal-05.jpg', from: 'top', day: 5, row: 0 },
    { title: 'Pasta night', img: 'hub-fly/meal-03.jpg', from: 'right', day: 5, row: 2 },
    { title: 'School lunch', img: 'hub-fly/meal-04.jpg', from: 'bottom', day: 6, row: 1 },
    { title: 'Taco Tuesday', img: 'hub-fly/meal-02.jpg', from: 'right', day: 6, row: 2 },
  ];
  const habitCards = [
    {
      name: 'Leo', level: 4, stars: 20, fill: FILL.leo, solid: SOLID.leo, side: 'left', slot: 0,
      customs: [
        { emoji: '\u{1F370}', label: 'Extra dessert' },
        { emoji: '\u{1F3A5}', label: 'Movie night' },
      ],
    },
    {
      name: 'Anna', level: 3, stars: 16, fill: FILL.anna, solid: SOLID.anna, side: 'left', slot: 1,
      customs: [
        { emoji: '\u{1F31F}', label: 'Stickers' },
        { emoji: '\u{1F6CD}', label: 'New clothes' },
      ],
    },
    {
      name: 'Noah', level: 2, stars: 4, fill: FILL.mia, solid: SOLID.mia, side: 'right', slot: 0,
      customs: [
        { emoji: '\u{1F31F}', label: 'Stickers' },
        { emoji: '\u{1F9F8}', label: 'New toy' },
      ],
    },
  ];
  const rewardsI = beats.findIndex((b) => b.tab === 'rewards');

  function avatarHtml(ids) {
    const people = ids.map((id) => PEOPLE[id]).filter(Boolean);
    const max = 3;
    const shown = people.slice(0, max);
    const extra = people.length - shown.length;
    /* --av-c is the person's own colour, carried on BOTH kinds. An icon
       avatar wears it as its fill, as it always did; a photo one wears it
       as a ring, which is what the pad draws and what the flying cards had
       no use for. Additive: the list cards' own rule ignores it. */
    const bits = shown.map((p, i) => (
      p.photo
        ? '<span class="av av-photo" style="--av-c:' + p.solid + ';z-index:' + (10 - i) + '" title="' + p.name + '">' +
            '<img src="' + p.photo + '" alt="">' +
          '</span>'
        : '<span class="av" style="--av-c:' + p.solid + ';background:' + p.solid + ';z-index:' + (10 - i) + '" title="' + p.name + '">' +
            p.icon +
          '</span>'
    ));
    if (extra > 0) {
      bits.push('<span class="av is-more" style="z-index:1">+' + extra + '</span>');
    }
    return '<div class="avs">' + bits.join('') + '</div>';
  }
  // PadEventColor.readableOn + time lerp — same as pad calendar cards.
  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
  }
  function relLuminance(hex) {
    const lin = (ch) => {
      const c = ch / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const { r, g, b } = hexToRgb(hex);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function contrastRatio(a, b) {
    const la = relLuminance(a);
    const lb = relLuminance(b);
    const hi = Math.max(la, lb);
    const lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  function rgbToHsl(hex) {
    let { r, g, b } = hexToRgb(hex);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h / 6, s, l };
  }
  function hslToHex(hsl) {
    const { h, s, l } = hsl;
    const hue2rgb = (p, q, t) => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return rgbToHex(r * 255, g * 255, b * 255);
  }
  function readableOn(bg, base, minRatio) {
    const ratio = minRatio == null ? 7 : minRatio;
    if (contrastRatio(bg, base) >= ratio) return base;
    const hsl = rgbToHsl(base);
    let l = hsl.l;
    while (l > 0) {
      l = Math.max(0, l - 0.02);
      const c = hslToHex({ h: hsl.h, s: hsl.s, l });
      if (contrastRatio(bg, c) >= ratio) return c;
    }
    return '#000000';
  }
  function lerpHex(a, b, t) {
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    return rgbToHex(
      A.r + (B.r - A.r) * t,
      A.g + (B.g - A.g) * t,
      A.b + (B.b - A.b) * t,
    );
  }
  /* ---------- the app dims what has already happened ----------
     🔴 A CARD ON A PAST DAY IS DRAWN 40% OF THE WAY TO ITS OWN FILL, and we
     were not doing it — so at the handover Soccer practice (Sun) and Piano
     recital (Mon) went from full-strength ink to the app's faded ink in one
     frame, while Swim lesson (Thu) did not move at all. That difference is
     what pinned the rule down rather than a guess: sampling every chip on
     both sides of the seam, the future cards matched to the byte (47,81,17
     against 47,81,17) and only the past ones did not.

     0.40 measured, twice, on two different fills:
       Soccer practice  ours 52,90,19   app 126,151,103   t = 0.404
       Piano recital    ours 115,67,8   app 169,135,92    t = 0.404

     🔴 THE TIME ROW FALLS OUT OF IT — no second number. It is already
     lerp(title, fill, .28), so dimming the title first composes:
     .404 + .28 × (1 − .404) = .571, against .572 measured on the app. That
     the two agree to a thousandth is the check that this is one rule and
     not two coincidences.

     `day < todayCol` is the whole test: the grid is one week with today in
     it, so a smaller column is unambiguously earlier. */
  const PAST_FADE = 0.40;
  function cardInk(fill, solid, past) {
    /* 🔴 #594B26, MEASURED, not #87723D. The nestie fill is the one case
       readableOn() is overridden with a literal, and the literal was three
       shades light: sampled on both sides of the handover, Movie night and
       Family dinner (the two nestie-fill cards, and the only two) read
       135,114,61 from us against 89,75,38 from the app. Every other fill
       matched to the byte, which is what says this is the literal and not
       readableOn(). */
    let title = fill === FILL.nestie ? '#594B26' : readableOn(fill, solid);
    if (past) title = lerpHex(title, fill, PAST_FADE);
    return { title, time: lerpHex(title, fill, 0.28) };
  }

  function measureWord(el) {
    el.style.width = 'max-content';
    el.style.height = 'auto';
    el.dataset.nw = String(el.offsetWidth || 160);
    el.dataset.nh = String(el.offsetHeight || 48);
  }
  /* 🔴 TWO LAYERS, AND BOTH ARE BUILT UP FRONT. `.scrap` is the note, the
     mail, the text message — the thing that flew. `.ev` is the pad's own
     event chip, lying exactly over it and invisible until the landing.
     placeSet cross-fades between them on --m while the box itself shrinks
     to the chip's box, so the scrap is not replaced at the seam: it turns
     into what it becomes, and you can watch it do it.

     Built now rather than swapped in at the seam for two reasons. A swap
     costs a layout on the one frame that can least afford one; and it
     cannot be run backwards, which a scrubbed section has to be able to do
     — scroll up through the landing and this simply plays in reverse. */
  function makeCalEl(card) {
    const el = document.createElement('div');
    el.className = 'hub__src hub__src--' + (card.source || 'sticky');
    const scrap = document.createElement('div');
    scrap.className = 'scrap';
    if (card.source === 'mail') {
      scrap.innerHTML = '<div class="from"></div><div class="t"></div><div class="s"></div>';
      scrap.querySelector('.from').textContent = card.from || 'Inbox';
      scrap.querySelector('.t').textContent = card.title;
      scrap.querySelector('.s').textContent = card.note || card.time;
    } else if (card.source === 'imessage') {
      scrap.innerHTML = '<div class="bubble"><div class="who"></div><div class="t"></div><div class="s"></div></div>';
      scrap.querySelector('.who').textContent = card.from || '';
      scrap.querySelector('.t').textContent = card.note || card.title;
      scrap.querySelector('.s').textContent = card.time;
    } else if (card.source === 'app') {
      scrap.innerHTML = '<div class="app"></div><div class="t"></div><div class="s"></div>';
      scrap.querySelector('.app').textContent = card.note || 'Calendar';
      scrap.querySelector('.t').textContent = card.title;
      scrap.querySelector('.s').textContent = card.time;
    } else {
      scrap.innerHTML = '<div class="t"></div><div class="s"></div>';
      scrap.querySelector('.t').textContent = card.title;
      scrap.querySelector('.s').textContent = card.note || card.time;
    }
    el.appendChild(scrap);

    /* the chip, in the pad's colours — cardInk() is the pad's own
       readableOn(), so the title lands on the ink the app would have used */
    const ink = cardInk(card.fill, card.solid, card.day < todayCol);
    const ev = document.createElement('div');
    /* an all-day chip is 44 tall and carries the title alone, centred — the
       time row would not fit and there is nothing to put in it anyway */
    ev.className = card.allDay ? 'ev is-allday' : 'ev';
    ev.innerHTML = '<div class="t"></div><div class="s"></div>';
    /* both, because the ring around each face is the chip's own colour —
       see .hub__src > .ev .av in hub.css */
    ev.style.setProperty('--to-fill', card.fill);
    ev.style.background = card.fill;
    ev.querySelector('.t').textContent = card.title;
    ev.querySelector('.t').style.color = ink.title;
    ev.querySelector('.s').textContent = card.time;
    ev.querySelector('.s').style.color = ink.time;
    /* 🔴 THE FACES ARE PART OF THE MORPH, not part of the handover. Without
       them the chip we land is the app's chip minus its avatars — so the
       moment our card faded out, a row of faces appeared in a box that had
       been sitting still and finished for half a second. It read as a pop
       because it WAS one: nothing was animating them, they simply had not
       existed on our side. Carried here, they arrive with the rest of the
       chip and the handover has nothing left to introduce.

       Sets read off the app's own render — see `who` on each card. */
    if (card.who && card.who.length) {
      ev.insertAdjacentHTML('beforeend', avatarHtml(card.who));
    }
    el.appendChild(ev);
    return el;
  }
  /* ---------- the app's own section, to the pixel ----------
     🔴 THE OLD NUMBERS WERE A BOUNDING BOX, NOT A DESIGN. `head: 71,
     item: 58` put the card in the right PLACE and at the right total
     height, and everything inside it was still our own invention — so the
     four that landed sat next to "Weekly groceries" reading as a different
     component: no count badge, no + / ✏ / ⌃, an avatar half again too big
     and parked at the far right instead of beside the title, a header bar
     14% too tall, rows 17% too tight, and a brown title against the app's
     near-black. Reported as exactly that: "这个下落卡片的样式和正式 list
     卡片不一样".

     So this is the section itself, measured off the build at its own
     1920×1080 the way CAL_GRID was — same method, same discipline, one
     source for both faces of every number:

       section    w 804, r 16, gap 17 between two of them
       header     h 67; title x 17, 26.7px; badge +12.5 after the title ink,
                  62×31.75, r 16; avatar +12 after the badge, 31.75;
                  the three icons on 50px slots, 5.25 from the right edge
       body       16.75 above the first row, 19.25 below the last
       row        35.75 tall (which is the CHECKBOX — it is the tallest
                  thing in the row and the row is built round it), 16.5
                  between rows; box 36 at x 20, r 10, then 7.5 to the text
       ink        title #1C1917, and the header chrome is a flat #79736C —
                  sampled on the yellow band and the orange one, badge text
                  and all three icons: four samples, one value, so it is a
                  literal in the app and not a tint of the section
       checkbox   color-mix(accent 55%, body) — #EAC573 against #FFF9E6 and
                  #D99A15, which is the measured pixel to the byte

     ⚠️ 52.25 IS row + rowGap and it is the number that has to stay in step
     with LIST_GRID.y0 below: change either and the second card in a panel
     lands on top of the first. */
  const SEC = {
    w: 804, r: 16, gap: 17,
    head: 67,
    titleX: 17, titleT: 26.7,
    badgeGap: 12.5, badgeH: 31.75, badgePadX: 17, badgeT: 19, badgeR: 16,
    avGap: 12, av: 31.75,
    iconSlot: 50, iconBox: 21.5, iconRight: 5.25,
    padTop: 16.75, padBot: 19.25,
    row: 35.75, rowGap: 16.5,
    boxX: 20, box: 36, boxR: 10, boxB: 3, boxGap: 7.5, rowT: 23.9,
    ink: '#1C1917', chrome: '#79736C',
  };
  function secH(n) {
    return SEC.head + SEC.padTop + n * SEC.row + Math.max(0, n - 1) * SEC.rowGap + SEC.padBot;
  }
  /* the three the app puts at the right of every section header. Stroke
     icons, because that is what they are — the measured ink is one flat
     #79736C and the glyphs are open, not filled. */
  const SEC_ICONS = {
    add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.5h4.2L20 8.7a2.9 2.9 0 0 0-4.1-4.1L4 16.3v4.2z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    fold: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14.5 12 9l6 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  function makeListEl(card) {
    const el = document.createElement('div');
    el.className = 'hub__fly-card is-list';
    const shop = card.kind === 'shop';
    const accent = shop ? '#D99A15' : '#2497F0';
    const body = shop ? '#FFF9E6' : '#EFF8FF';
    const head = shop ? '#FFEEB8' : '#DCF0FE';
    /* 🔴 NOT readableOn(). That is the pad's rule for an EVENT CHIP, whose
       ink is derived from its own fill, and it is why our titles were brown
       (#694B0A measured) beside the app's near-black. A section header is
       not a chip: sampled on the yellow band and the orange one, the app
       draws #1C1917 on both. One literal, no derivation. */
    const ink = SEC.ink;
    const doneInk = lerpHex(ink, body, 0.44);
    el.style.background = body;
    el.style.color = ink;
    /* the badge and the checkbox are both measured mixes — see SEC */
    el.style.setProperty('--band', head);
    el.style.setProperty('--badge-bg', 'color-mix(in srgb, ' + SEC.ink + ' 6%, ' + head + ')');
    el.style.setProperty('--box-c', 'color-mix(in srgb, ' + accent + ' 55%, ' + body + ')');
    const hd = document.createElement('div');
    hd.className = 'hd';
    hd.style.background = head;
    hd.style.color = ink;
    const title = document.createElement('span');
    title.className = 'hd-t';
    title.textContent = card.title;
    hd.appendChild(title);
    /* done/total, the way the app writes it — ours are all still to do, so
       these read 0/3 and 0/2 against the app's 5/5 and 2/2 */
    const done = (card.done || []).filter(Boolean).length;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = done + '/' + card.items.length;
    hd.appendChild(badge);
    hd.insertAdjacentHTML('beforeend', avatarHtml(card.who || []));
    hd.insertAdjacentHTML('beforeend', '<span class="sp"></span>');
    ['add', 'edit', 'fold'].forEach((name) => {
      hd.insertAdjacentHTML('beforeend', '<span class="ic">' + SEC_ICONS[name] + '</span>');
    });
    const it = document.createElement('div');
    it.className = 'it';
    card.items.forEach((name, i) => {
      const row = document.createElement('div');
      const isDone = !!(card.done && card.done[i]);
      row.className = 'row' + (isDone ? ' is-done' : '');
      row.style.color = isDone ? doneInk : ink;
      const box = document.createElement('span');
      box.className = 'box';
      row.appendChild(box);
      const label = document.createElement('span');
      label.className = 'row-t';
      label.textContent = name;
      row.appendChild(label);
      it.appendChild(row);
    });
    el.appendChild(hd);
    el.appendChild(it);
    return el;
  }
  function makeMealEl(card) {
    const el = document.createElement('div');
    el.className = 'hub__fly-card is-meal';
    const img = document.createElement('img');
    img.src = card.img;
    img.alt = card.title;
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = card.title;
    el.appendChild(img);
    el.appendChild(cap);
    return el;
  }

  const calEls = [];
  const listEls = [];
  const mealEls = [];
  if (flies) {
    calCards.forEach((card) => {
      const el = makeCalEl(card);
      flies.appendChild(el);
      measureWord(el);
      calEls.push(el);
    });
    listCards.forEach((card) => {
      const el = makeListEl(card);
      flies.appendChild(el);
      listEls.push(el);
    });
  }

  /* ---------- one scale, and it is fractional ----------
     🔴 clientWidth IS AN INTEGER, and the pad's box is not. At 1024 the
     wrap comes out 860.16 wide; clientWidth says 860, and the sixteenth of
     a pixel that rounds away is a sliver of .hub__screen's background down
     the foot and the right edge of the device — the same defect as the
     Safari one above, three ties smaller. The wrap's COMPUTED width is the
     real number, and it is a layout length, so unlike getBoundingClientRect
     it is not multiplied by --dock-s when the pad shrinks onto the wall.

     Cached rather than read per frame: placeFly wants the same number for
     every card destination, and this only changes on resize, which is
     exactly when the observer below re-runs it. */
  let padS = 1;
  function sizePad() {
    padS = (parseFloat(getComputedStyle(wrap).width) || screen.clientWidth) / 1920;
    inner.style.transform = 'scale(' + padS + ')';
    if (catcher) catcher.style.left = (128 * padS) + 'px';
  }
  new ResizeObserver(sizePad).observe(screen);
  sizePad();

  /* ---------- the tab change gets a settle ----------
     🔴 IT IS A CUT AND WE CANNOT MAKE IT ANYTHING ELSE. The switch happens
     inside the iframe, in a Flutter build whose source is not in this repo
     (see public/hub-clock.js for the same constraint), and the only thing
     we can say to it is a token. So Calendar → Lists → Rewards → Meals all
     land in one frame, which is what reads as a slide deck.

     What we own is the pane the app is drawn in. So the new screen arrives
     out of focus and settles: 320ms of blur and opacity on .hub__inner,
     started in the same task as the token, which the app then paints
     behind. It is not a cross-fade — nothing is holding the old picture —
     but a cut you arrive INTO is a very different event from one that
     simply happens, and it costs a class.

     🔴 NOT transform. sizePad() writes an inline scale() on this element
     every resize, and a CSS animation on transform outranks inline styles —
     the pad would jump to 1:1 for the length of every switch. Opacity and
     filter are ours alone.

     Only the TAB, not the phase. calendar|fly → calendar|play is the app
     animating on purpose and must not be interrupted. */
  let lastTold = '';
  let lastTab = '';
  const TAB_OUT_MS = 170;
  let tabTimer = 0;
  let tabPending = '';

  function post(token) {
    lastTold = token;
    iframe.contentWindow.postMessage(token, '*');
  }

  /* 手机上的静态图换图。挂在 tellToken 里，因为那是「这一拍该显示什么」的唯一
     漏斗 —— iframe 和静态图共用同一个判断，两条路不会走岔。
     src 到这里才写，所以读者没滚到这一段之前一张图都不下载。

     🔴 一张图一个 TOKEN，不是一个 TAB。第一版按 tab 存，把 phase 丢了，
     于是上面 beats 里那两处专门设计的「前后两态」在手机上整个消失：

       calendar|fly  应用只画自己的 3 张，把一周空出来让我们的卡片落进去
       calendar|play 才补上另外 11 张
       rewards|idle  「Redeem 8」还立着
       rewards|play  才把它花掉

     按 tab 存等于永远只有后一态。用户 2026-08-30 报的就是这个：「第一幕就是
     一个已经完整的卡片，飞进去以后没有新卡片出现的感觉」，以及「Rewards 那个
     Redeem 的动画已经消失了」。两条是同一个 bug。

     ⚠️ 加 beat 或改 beat 的 phase，就要配一张同名的图，否则那一拍是 404
     （屏幕留在上一张，不会白屏，但那一拍的叙事就没了）。文件名 = token 把
     `|` 换成 `-`。重截脚本的做法见本次提交说明：直接开 nestify-hub-web，
     postMessage 每个 token，等 13s 让应用自己的动画走完再截。 */
  const still = document.getElementById('hubStill');
  /* 🔴 带版本号。这些图的**文件名不会变**（名字是 token 派生的），但内容会——
     rewards-play 这一张 2026-08-30 就从静态图换成了播一次的动图。没有这个
     查询串，已经缓存过旧图的读者永远看不到新的，而且完全无声无息。
     改图就改这个数。 */
  const STILL_V = '?v=403';
  const stillSrc = tok => 'assets/hub/still-' + tok.replace('|', '-') + '.webp' + STILL_V;
  const warmed = new Set();
  let stillTok = '';
  /* 🔴 预热只灌字节，**不解码** —— 所以用 fetch，不用 `new Image()`。

     still-rewards-play.webp 原是一张 28 帧 / 2352ms / **循环次数 1** 的动图
     （Redeem 被花掉 + 彩纸庆祝）。动图 WebP 一解码就开始播，跟它在不在 DOM
     里无关；`new Image()` 会解码，于是这张只播一次的动图在**预热的那一刻**
     就把 2.35 秒放完了，等读者滚到交接点、<img src> 换过去时它已经停在最后
     一帧。用户 2026-08-31：「手机版 Rewards 那个庆祝动画没出现」。

     预热本来是为了防止那一拍空白（见下面 setStill 里的注释），结果它正好
     杀死了这一拍唯一的动效。fetch 把字节放进 HTTP 缓存但不建解码器，之后
     `img.src` 命中同一个 URL 走缓存、当场解码、从第 0 帧开始播——两件事都
     成立。

     ⚠️ 以后往这套静图里再加动图，也必须走这条路。判断依据：webp 里有 ANMF
     块就是动图；`ANIM` 块第 12–14 字节是循环次数，1 = 只播一次。 */
  function warmStill(tok) {
    if (!tok || warmed.has(tok)) return;
    warmed.add(tok);
    fetch(stillSrc(tok), { cache: 'force-cache' }).catch(() => {});
  }
  function setStill(tok) {
    if (!still || !tok || tok === stillTok) return;
    /* 🔴 桌面上这张图是 display:none —— 但 display:none 的 <img> **照样会下载**。
       少了这道判断，每个桌面访客都白下一张图（实测）。窗口拉窄到 767 以下时，
       下一次 tellToken 会补上，所以不会漏。 */
    if (!matchMedia('(max-width: 767px)').matches) return;
    stillTok = tok;
    warmed.add(tok);
    still.src = stillSrc(tok);
    /* 同一拍的后半态先下好。它要在卡片落地的那一瞬间顶上去，那时候再开始下载
       就晚了 —— 手机上一次网络往返足够让那一拍空掉。 */
    const b = beats.find(x => x.tab + '|' + x.phase === tok);
    if (b && b.then) warmStill(b.then);
  }

  function tellToken(token) {
    if (!iframe.contentWindow || token === lastTold || token === tabPending) return;
    const tab = token.slice(0, token.indexOf('|'));

    if (tab && tab !== lastTab) {
      /* 🔴 THE SCREEN LEAVES BEFORE THE NEXT ONE ARRIVES, which is the only
         way to get a dissolve out of a cut we do not own. The first pass
         only faded IN: the token went out immediately, the app had already
         repainted, and the animation played over a picture that was
         already the new one — so meals → home was a hard swap with a soft
         landing, and on two screens as dense as those it still read as a
         slide change.

         Now the pane dims and blurs AWAY first, the token goes at the
         bottom of that, and the new screen comes back up through the same
         blur. 170ms is enough to lose the old layout without the pad
         looking broken, and it is the only place in this section where the
         app is told something later than the scroll said it. */
      lastTab = tab;
      tabPending = token;
      inner.classList.remove('is-tab-in');
      inner.classList.add('is-tab-out');
      if (tabTimer) clearTimeout(tabTimer);
      tabTimer = setTimeout(function () {
        tabTimer = 0;
        /* 静态图跟 post 同一拍换 —— 换 tab 时它要等这 170ms 的淡出走完才换，
           跟应用被告知的时机完全一致（CSS 那边用兄弟选择器把 is-tab-out /
           is-tab-in 一并作用到 .hub__still 上，所以手机上也有这次溶解，
           不是硬切）。 */
        setStill(tabPending);
        post(tabPending);
        tabPending = '';
        inner.classList.remove('is-tab-out');
        void inner.offsetWidth;          // or a second switch re-uses the first run
        inner.classList.add('is-tab-in');
      }, TAB_OUT_MS);
      return;
    }

    /* a phase change inside the same tab is the app animating on purpose
       and is never delayed — but if the pane is mid-swap it has to wait its
       turn, and onScroll will offer it again on the next frame. */
    if (tabPending) return;
    /* 同一个 tab 里的 phase 变化是应用在**故意**演，从不延迟——静态图也一样
       立刻换，因为那一刻正是卡片落地、屏幕该有反应的那一帧。 */
    setStill(token);
    post(token);
  }
  function tellHub(beat) {
    if (!beat) return;
    tellToken(beat.tab + '|' + beat.phase);
  }

  function beatFromHubP(p) {
    if (p >= DOCK) return nBeats - 1;
    const t = clamp(p / DOCK);
    let acc = 0;
    for (let i = 0; i < nBeats; i++) {
      acc += beats[i].w / weightSum;
      if (t < acc) return i;
    }
    return nBeats - 1;
  }

  function beatStart(i) {
    let acc = 0;
    for (let j = 0; j < i; j++) acc += beats[j].w;
    return acc / weightSum;
  }

  /* ---------- three things happen, in order ----------
     🔴 THE SCREEN, THEN THE CARDS, THEN THE FLIGHT. All three used to start
     on the same frame: the tab arrived, and the scraps were already there
     beside it at full strength and already moving. So there was never a
     moment of "here is the empty week" — the answer was on screen before
     the question, and the cards read as part of the app's own arrival
     rather than as things coming from outside it.

     The beat's first half is now spent making that sequence legible:

       0    → .26   the pad alone. The tab has changed, the app is drawing
                    its own week, and nothing of ours is on screen yet.
       .26  → .46   the scraps fade up where they are parked, still. You
                    see WHAT is about to move before it moves.
       .46  → 1     the flight — cardWindow gets this remainder instead of
                    the whole beat.

     🔴 THESE ARE FRACTIONS OF THE FLY SPAN, SO THEY ONLY MEAN SOMETHING
     NEXT TO `at`. First pass was .12 / .26 against at .60, which on the
     150svh calendar beat bought the pad ELEVEN svh alone — a ninth of one
     flick, gone before it registered, which is exactly what "先出现页面"
     was asking for and not getting. At .26 / .46 against at .72 the same
     beat reads 28svh of pad, 22 of the scraps arriving, 58 of flight. The
     lead-ins roughly doubled and the flight did NOT pay for it: `at` grew
     by the same amount, out of the app's own second half, which had 60svh
     to spend and needed 42.

     Small per-card offset on the fade so the stack does not switch on like
     a lamp; it is a tenth of the stagger the flight itself uses, because
     this one is only meant to stop them being simultaneous. */
  const CARD_IN = 0.31;
  const FLY_FROM = 0.53;

  /* Where each beat starts, ends, and hands over to its own second half.
     `split` used to be a beat boundary — the seam between `fly` and `play` —
     and is now a number inside one beat. That is the whole of the change:
     the same two moments, without a scroll stop between them. A beat with no
     `at` has its split at the end, so it never hands over. */
  /* 🔴 THE TOKEN GOES OUT BEFORE THE CARDS ARE DOWN, and that is the point.
     Fire it ON the last card's landing and the two events queue: the cards
     stop, then Flutter starts laying out the week, and the seam between
     them is however long that takes. At .86 of the run the app is already
     drawing its events while the last two cards are still settling over the
     top of them, so the handover is a cross-fade rather than a cut, and the
     app's own render time is spent behind cards instead of behind nothing.

     Only fly beats get the lead. `meals` also hands over, but it has no
     cards to hide behind, so it hands over where it says it does.

     🔴 .86 OF THE FLIGHT, NOT OF THE SPAN, and the two stopped being the
     same thing when the lead-ins grew. A fly beat now spends its first .46
     showing the pad and then the parked scraps; measured against the whole
     span, .86 lands at 74% of the travel — the app would start drawing with
     the cards still a quarter of the way out, which is a cross-fade begun
     too early rather than a handover. FLY_FROM is where the travel starts,
     so the lead is taken across what is left of the span after it. */
  const HANDOVER_LEAD = 0.86;
  const span = beats.map((b, i) => {
    const s = beatStart(i);
    const e = beatStart(i + 1);
    const split = s + (e - s) * (b.at ?? 1);
    const lead = FLY_FROM + (1 - FLY_FROM) * HANDOVER_LEAD;
    return {
      s, e, split,
      hand: b.phase === 'fly' ? s + (split - s) * lead : split,
    };
  });

  /* (The scroll→flight mapping that used to live here is flyStateAt, down by
     applyBeat, where it can be read next to the note on why the flight is a
     scrub. It reads `split` and `hand` off these spans.) */

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  /* 🔴 THE CONVERGENCES USE THIS, NOT easeOutCubic, AND THE DIFFERENCE IS THE
     FIRST FRAME. easeOutCubic leaves at 3× — right for a card being thrown,
     wrong for a type size, because the reader is looking straight at the
     words when they start and a ramp that opens at 3× is a step with a tail
     on it. smoothstep is flat at BOTH ends: nothing moves on the frame the
     ramp opens, nothing moves on the frame it closes, and everything in
     between is one continuous curve. Every convergence in the landing —
     --lift, --m — is one of these now. */
  function smoothstep(t) {
    const x = clamp(t);
    return x * x * (3 - 2 * x);
  }
  /* 🔴 .78, NOT .7 — so the LAST card lands exactly where the scrub ends.
     The stagger gives card i a head start of a (capped at .22), and each
     card then took .7 of the run to arrive: the last one was home at t=.92
     while the scrub kept going to 1. Those eight points are the gap you see
     as cards sitting still on an empty calendar, waiting for a handover
     that has not happened yet. At .78 the first card lands at .78 and the
     last at exactly 1.0, so the run ends on the same frame the last card
     does and there is nothing left over. */
  /* 🔴 THE RAW WINDOW IS ITS OWN FUNCTION because the morph cannot be timed
     off the eased one. easeOutCubic spends most of its output early —
     e=.6 is reached at raw .26 — so a morph starting at "60% eased" would
     start while the card is still most of a pad away and crossing open
     space. Started at raw .62 it starts at e=.945, which is the card
     arriving, and that is the moment the shape is allowed to change. */
  function cardWindow(t, i) {
    const a = Math.min(0.22, i * 0.04);
    const b = Math.min(1, a + 0.78);
    return clamp((t - a) / (b - a));
  }
  function cardEase(t, i) {
    return easeOutCubic(cardWindow(t, i));
  }
  /* the last stretch of a card's own travel, spent turning into an event */
  const MORPH_AT = 0.62;
  /* 🔴 THE WEIGHT HAS TO FINISH EARLY, AND THE REASON IS THE FONT FILE.
     PadNunito is FOUR STATIC CUTS — 400/500/600/700, see the @font-face
     block in hub.css — not the variable face the old note here claimed. So
     `font-weight: calc(…)` does not glide, it SNAPS to the nearest cut, and
     the ramp is a staircase however smooth the number driving it is.

     Which puts the whole problem in WHERE the steps land, and the last one
     is the one that matters: 800 − 400·l only reaches 400 at l = 1, so with
     the weight riding --lift to its end the 500 → 400 snap — the biggest
     of the three and the one that reads as 变细 — would fire on the exact
     frame the card stops and the chip starts fading in. The most visible
     frame in the section.

     .75 pulls all three steps back into the middle of the flight. Against
     the smoothstep they land at raw ≈ .26 / .33 / .40, where easeOutCubic
     still has the card 40% / 30% / 22% from home and moving; the weight is
     final by raw .42 and nothing about it happens during the landing.

     ⚠️ IF A VARIABLE NUNITO EVER LANDS IN THE REPO this constant becomes
     dead weight — drop it and let the weight ride --lift like the size
     does. The staircase is the only reason it exists. */
  const WEIGHT_SETTLE = 0.75;
  /* the all-day chip's title, in the app's px like everything in CAL_GRID.
     Smaller than a timed card's 26/28.4 — measured against the app's own
     "School holiday", which sits in the same row and needs no alignment. */
  const ALLDAY_T = 24.3;
  const ALLDAY_NUDGE = 1.25;   /* CSS px — see the note at the write site */

  /* ---------- where the pad actually draws its week ----------
     🔴 MEASURED OFF THE APP, not guessed. The iframe runs at a fixed
     1920×1080 (.hub__inner in hub.css scales that whole box to the pad), so
     these are constants in the app's own coordinates and hold at every
     viewport — multiply by `scale` and you are in screen px.

     They replace four numbers that had drifted into fiction: allDayY 176
     put the all-day cards over the DATE HEADER, timeTop 248 was 295 above
     the 4 PM row, and floor 420 then clamped every timed card back into the
     3–4 band, so seven cards with seven different hours all landed in one
     stripe. Only hourH was right. The old numbers look like a DOM calendar
     this section used to draw for itself — hub.css still carries the note
     about that view being replaced by the iframe — and nothing failed
     loudly when it went, because "roughly on the grid" is all the cards
     needed back when they simply vanished on arrival. They need to be
     exact now that they morph into what is underneath them.

     Read: 4:00 PM sits at y=543 and an hour is 160 tall (4:30 → 623,
     5:00 → 703, 6:00 → 863, dead linear). The grid shows 3 PM at 383 and is
     cut off by the bottom of the screen at 1032. */
  const CAL_GRID = {
    x0: 266,        // the SUN column's left edge
    col: 229.4,     // and the step to the next one
    w: 220,         // a chip is narrower than its column
    allDayY: 236, allDayH: 44,
    y16: 543, hour: 160,
    top: 383, bot: 1032,
  };

  function calDest(card, scale) {
    const x = (CAL_GRID.x0 + card.day * CAL_GRID.col) * scale;
    const w = CAL_GRID.w * scale;
    if (card.allDay) {
      return { x: x, y: CAL_GRID.allDayY * scale, w: w, h: CAL_GRID.allDayH * scale };
    }
    const y = CAL_GRID.y16 + (card.hour - 16) * CAL_GRID.hour;
    /* clipped by the grid, exactly as the app clips it — Movie night runs to
       8 PM and the screen ends before that, so both stop in the same place */
    const top = Math.max(CAL_GRID.top, y);
    const bot = Math.min(CAL_GRID.bot, y + (card.hours || 2) * CAL_GRID.hour);
    return {
      x: x, y: top * scale, w: w,
      h: Math.max(CAL_GRID.hour * 0.5, bot - top) * scale,
    };
  }

  /* ---------- and where it draws the two lists ----------
     Measured the same way, off the same build. A section is a header bar
     plus one row per item, and both panels lay theirs out on the same
     numbers: 71 for the header, 58 per row, 15 between sections.

     🔴 THE CARDS LAND UNDER WHAT IS ALREADY THERE, and this is the whole
     reason the beat no longer hands over. The pad's own `lists|play` adds
     these four sections at the TOP of each panel and pushes the existing
     ones down — so aiming at the top meant a card spent its entire flight
     descending onto "Weekly groceries", a section that was already sitting
     there, and only at the handover did everything shuffle. It read as the
     card going back into a slot that was never empty, which is the exact
     opposite of the point: these arrived from outside and are NEW.

     So they land after the app's own sections. In `lists|fly` — the state
     the app now stays in for this whole beat — shopping ends at 490 and
     to-do at 592, and a section gap is 15. Two cards then fill each panel
     to 1010, which is where the panel's content area ends: the numbers
     land exactly, because the panels were drawn to hold this many.

     The cost is that the pad's own rendering of these four is never shown —
     our cards ARE the four for the length of the beat. See the note on
     `then` in the beats table.

     🔴 THE OLD listDest RETURNED A RAW 236 AS ITS WIDTH — an app-coordinate
     number handed back next to an x that HAD been multiplied by scale, so
     the two were never in the same unit. It went unnoticed because nothing
     read the width: placeSet used dest.x and dest.y and dropped the rest.
     It is read now, so it is in screen px like everything else here.

     Gone with it: listCardH, which existed only so this function could
     stack sections by measuring the FLYING cards, and which had to keep
     restoring the width it borrowed because those measurements were leaking
     back into the phone layout. Sections are the app's, so their heights
     come from the app's numbers and no element gets measured at all. */
  /* y0 is per panel because the two hold different amounts already: one
     "Weekly groceries", against a "Piano practice" and a "Soccer bag".
     🔴 508 / 610, NOT 505 / 607: the app's own sections end at 491 and 593
     and the gap between two sections is 17, not the 15 this used to carry.
     Measured on both panels; the old pair was three px high in each. */
  const LIST_GRID = { x: [184, 1060], w: SEC.w, y0: [508, 610], gap: SEC.gap };

  /* Nestie's perch, app coordinates: the bird occupies 1792–1883 × 953–1042.
     🔴 r HUGS THE BIRD — 46 is half of its 91, not a radius with air around
     it. 56 left a 10px ring of whatever the app draws behind the bird
     showing through, and behind the bird is a green list section and, past
     the panel's edge, the page's own #f5f3ee: against a pale blue card that
     reads as a thick white outline drawn round the bird on purpose. There
     is no plate under it to justify one — sampled across the bird's centre,
     the pixel outside its outline is the section, immediately. Tight to the
     silhouette the leftover is a couple of px on the diagonals, which is
     the antialiasing either way. */
  const BIRD = { x: 1837, y: 998, r: 46 };

  function listDest(card, scale) {
    const group = listCards.filter((c) => c.col === card.col);
    let y = LIST_GRID.y0[card.col];
    for (let i = 0; i < group.length; i++) {
      const item = group[i];
      const h = secH(item.items.length);
      if (item === card) {
        return {
          x: LIST_GRID.x[card.col] * scale, y: y * scale,
          w: LIST_GRID.w * scale, h: h * scale,
        };
      }
      y += h + LIST_GRID.gap;
    }
    return { x: LIST_GRID.x[card.col] * scale, y: y * scale, w: LIST_GRID.w * scale, h: 1 };
  }

  function mealDest(card, scale) {
    const gridX = 300;
    const gridY = 212;
    const colW = 1588 / 7;
    const rowH = 836 / 4;
    const x = gridX + card.day * colW + 8;
    const y = gridY + card.row * rowH + 4;
    return {
      x: x * scale,
      y: y * scale,
      w: (colW - 16) * scale,
      h: (rowH - 8) * scale,
    };
  }

  function hideEls(els) {
    els.forEach((el) => { el.style.opacity = '0'; });
  }

  function parkPos(card, w, heights, slot, st, pr, kind) {
    const padX = pr.left - st.left;
    const padY = pr.top - st.top;
    const left = kind === 'lists' ? card.col === 0 : card.stack === 'left';
    const out = 20;
    const edge = 16;
    const ceil = padY + 48;
    const floor = padY + pr.height - 24;
    const body = heights.reduce((s, n) => s + n, 0);
    let gap = 16;
    const room = Math.max(120, floor - ceil);
    if (heights.length > 1 && body + (heights.length - 1) * gap > room) {
      gap = Math.max(6, (room - body) / (heights.length - 1));
    }
    const stackH = body + Math.max(0, heights.length - 1) * gap;
    const x = left
      ? Math.max(edge, padX - w - out)
      : Math.min(st.width - w - edge, padX + pr.width + out);
    let y = ceil + Math.max(0, (room - stackH) / 2);
    if (y + stackH > floor) y = floor - stackH;
    if (y < edge) y = edge;
    for (let i = 0; i < slot; i++) y += heights[i] + gap;
    return { x: x, y: y };
  }

  /* 一次求值：读了会触发样式计算，而 placeSet 是每帧跑的。转屏时宽度会变，
     但 767px 这条线两边都是「手机」，横竖屏都落在同一侧。 */
  const PHONE = matchMedia('(max-width: 767px)').matches;

  function placeSet(cards, els, destOf, state, scale, st, pr, sr, kind) {
    if (!state.show) {
      hideEls(els);
      return;
    }
    const padX = pr.left - st.left;
    /* 🔴 The card sizes below are DRAWN AGAINST A 950px PAD and were flat
       px, so on a phone — pad 359 — a 148×158 sticky note came out 86% of
       the device's own height. k moves the whole card with the pad, and the
       floor is where legibility stops it: scaled honestly they would be 15%
       of the pad as on desktop, which puts the title type under 6px. .72
       keeps that at ~11px and gives back what proportion it can. CSS reads
       the same number for padding, radius, type and avatars.

       🔴 手机上的下限是 0.48，不是 0.72。上面这段推理只算了「字还认不认得
       出」，没算「这张纸条跟它要变成的那枚 chip 之间的比例」——而那个比例才是
       读者看到的东西。量一下：

         桌面  flyK 1.00，--to-k 0.495（950/1920）→ 纸条是应用自己尺度的 2.02×
         手机  flyK 0.72，--to-k 0.169（324/1920）→ 4.26×

       同一张纸条在手机上相对屏幕**大了一倍**。实测 324×182 的 pad 上，那张
       148×158 的黄色便签算出来 107×114，占 pad 高的 63%（桌面 30%）——它整个
       盖住半块屏，还从底下溢出去。用户 2026-08-30：「有的卡片飞进去的时候，
       它本身就过于的大…那些黄色卡片，它变得特别大」。

       完全诚实的缩放是 0.341（= 2.02 × 324/1920），标题会掉到 7px；0.48 是
       停在中间：标题约 8px，纸条约 2.8× 应用尺度，能看见底下的周历。

       ⚠️ 下限只对手机改。桌面那条 0.72 的理由（窄窗口下的可读性）没变。 */
    const flyK = clamp(pr.width / 950, PHONE ? 0.48 : 0.72, 1);
    flies.style.setProperty('--fly-k', flyK.toFixed(4));

    /* ---------- a hole for the bird ----------
       🔴 NESTIE IS DRAWN INSIDE THE IFRAME, so every card we lay over the
       screen is in front of it — and the second to-do card lands right on
       the corner it sits in, cutting its head off. The pad's own list
       sections run under it too; the app simply paints the bird last, which
       is a z-order we do not have from out here. So the layer takes a hole
       where the bird is. Centre measured off the build at its own 1920×1080
       and steady to a pixel across all three tabs.

       🔴 OPENED ONLY AS THEY LAND. As a permanent hole it would be a bite
       taken out of any card that crossed that corner in flight, which the
       right-hand stack does on its way in. state.t past .88 is after the
       last card has arrived, so nothing that is still moving is ever cut. */
    const birdOpen = kind === 'lists' ? clamp((state.t - 0.88) / 0.12) : 0;
    flies.style.setProperty('--bird-x', (sr.left - st.left + BIRD.x * scale).toFixed(1) + 'px');
    flies.style.setProperty('--bird-y', (sr.top - st.top + BIRD.y * scale).toFixed(1) + 'px');
    flies.style.setProperty('--bird-r', (BIRD.r * scale * birdOpen).toFixed(1) + 'px');
    /* the OTHER scale, and the two are not the same number. --fly-k sizes a
       scrap against the pad with a legibility floor under it; --to-k is the
       app's own 1920 mapped to the screen, dead straight, because .ev is
       drawing the pad's chip and has to match it rather than stay readable
       on its own terms. */
    flies.style.setProperty('--to-k', scale.toFixed(5));
    const sized = cards.map((card, i) => {
      const el = els[i];
      const dest = destOf(card, scale);
      const left = kind === 'lists' ? card.col === 0 : card.stack === 'left';
      const gutter = left ? padX : (st.width - (padX + pr.width));
      /* 🔴 260, UP FROM 236, AND IT IS THE HEADER THAT SETS IT. A section
         header is title + badge + avatar + three icons, and the card now
         carries all of them from the moment it is parked (see the note on
         the header in hub.css — nothing in this card appears or disappears).
         At 236 the parked row measured 244 wide and the title took the
         difference out of itself through `text-overflow: ellipsis`, so
         "Party supplies" parked as "Party supplie…". 260 clears it with
         room; the gutter it parks in is 310 at 1600 and scales with the
         pad, so this does not push the stack off the stage. */
      const wBase = kind === 'lists'
        ? 260
        : card.source === 'sticky'
          ? 148
          : Math.min(210, Math.max(160, (gutter - 40) / flyK));
      const w = Math.round(wBase * flyK);
      /* 🔴 MEASURE AT THE CONTAINER'S SCALE, ALWAYS. The morph below writes
         a bigger --fly-k onto the element itself, and if that were still
         standing here the card would be measured at the size it is morphing
         TO and the natural height would climb every frame — a card feeding
         its own destination back into its start. Dropped first, restored
         after the measurement, which is the same discipline listCardH used
         to need for width and the reason it is gone. */
      el.style.removeProperty('--fly-k');
      /* 🔴 AND --m WITH IT, for exactly the same reason one line up. A list
         card's every inset now interpolates on --m (hub.css), so measuring
         it at the CURRENT --m measures the card partway through its own
         landing and feeds that back in as the height the landing starts
         from — the loop the note above describes, one variable further on.
         Zeroed for the measurement; the real value is written below, in the
         same frame, so this costs no extra layout. */
      el.style.setProperty('--m', '0');
      el.style.width = w + 'px';
      el.style.height = 'auto';
      el.style.minHeight = card.source === 'sticky' ? Math.round(158 * flyK) + 'px' : '';
      const rawH = el.offsetHeight || 72;
      /* 🔴 158 也要乘 flyK —— 上一行的 min-height 乘了，这一行原来没乘。

         便签在**飞行途中**的高度走的是这个 h，落定后的高度走 dest.h，所以那个
         漏掉的 flyK 只在飞行中现形：手机上便签宽度老实缩到 74（148×0.48），
         高度却卡在 158 不动，飞进来的是一根 74×158 的竖条，占 pad 高的 88%。
         落定后量到的是 114，一切正常——这就是为什么按落定态量了几轮都没看出
         问题，两个状态由两个不同的数控制。

         一个常数写在相邻两行、一行缩放一行不缩放，就是这么来的。 */
      const h = card.source === 'sticky' ? Math.max(rawH, Math.round(158 * flyK)) : rawH;
      return { card: card, el: el, dest: dest, left: left, w: w, h: h, wBase: wBase };
    });
    sized.forEach((item, i) => {
      const { card, el, dest, left, w } = item;
      const destX = sr.left - st.left + dest.x;
      /* clamped against the DESTINATION's height, not the scrap's. The scrap
         is the tall thing; by the time this position matters the box is the
         chip's, and clamping a chip by a sticky note's height pushed the
         late-afternoon cards up off their own rows. */
      const destY = Math.min(
        sr.top - st.top + sr.height - dest.h - 12,
        Math.max(sr.top - st.top + 64, sr.top - st.top + dest.y)
      );
      const group = sized.filter((s) => (
        kind === 'lists' ? s.card.col === card.col : s.card.stack === card.stack
      ));
      const heights = group.map((s) => s.h);
      const slot = kind === 'lists' ? group.indexOf(item) : card.slot;
      /* the flight gets the beat AFTER the two lead-ins — see CARD_IN */
      const raw = cardWindow(clamp((state.t - FLY_FROM) / (1 - FLY_FROM)), i);
      const e = easeOutCubic(raw);
      /* 🔴 SMOOTHSTEPPED, AND IT WAS THE OTHER HALF OF THE STEP. --m used to
         be the raw fraction, so d(m)/d(scroll) went 0 → 1/.38 on the frame
         raw crossed MORPH_AT: the box, the shadow and the cross-fade all
         started at full rate out of a card that had been holding its shape
         for the whole flight. Nothing about the values was wrong — the
         DERIVATIVE was, and a derivative step reads exactly like a value
         step. Eased at both ends the landing grows out of the flight and
         settles into the chip instead of being switched on and off. */
      const m = smoothstep(clamp((raw - MORPH_AT) / (1 - MORPH_AT)));
      el.style.opacity = clamp(
        (state.t - CARD_IN - i * 0.004) / (FLY_FROM - CARD_IN)
      ).toFixed(3);
      const park = parkPos(card, w, heights, slot, st, pr, kind);
      const x = park.x + (destX - park.x) * e;
      const y = park.y + (destY - park.y) * e;
      const parkTilt = left ? [-3, 2, -2][slot] || -2 : [3, -2, 2, -3][slot] || 2;
      const tilt = kind === 'lists' ? 0 : parkTilt * (1 - e);
      el.style.zIndex = String(10 + slot);
      el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + tilt + 'deg)';

      /* ---------- the landing ----------
         The box becomes the app's box, and everything inside it comes with
         it: --fly-k is the card's whole internal scale (hub.css multiplies
         every padding, radius and type size by it), so moving it to
         dest.w/wBase shrinks or grows the card AS ONE OBJECT rather than
         squeezing a full-size note into a chip-size frame and clipping it.

         A calendar scrap shrinks — a 148px sticky note down onto a ~110px
         chip — and cross-fades to the event underneath.

         🔴 THE TWO FIT ON DIFFERENT AXES. A scrap is fitted by WIDTH —
         dest.w/wBase — because a sticky note and a chip are the same kind of
         object at two sizes, and taking the width takes the whole thing.

         A list card is fitted by HEIGHT, and by a much smaller number. The
         pad's list section is not a bigger copy of the card: it is a WIDER
         one, with the same header and the same type. Scale it by width like
         a scrap and the header blows up to 2½ its height and the items are
         pushed out the bottom of their own box. But leaving it alone is not
         right either — our rows run about 13% taller than the app's, so the
         last item was being clipped off by exactly that. dest.h/item.h is
         that 13%, and it lands the card's contents on the section's own
         proportions. It does not cross-fade: it already looks like what it
         lands in, so growing into place is the whole trick.

         --m carries all of it, and it is a scroll fraction like everything
         else here: the landing runs backwards if the reader scrolls back up
         through it. */
      el.style.minHeight = '0px';
      el.style.width = (w + (dest.w - w) * m) + 'px';
      el.style.height = (item.h + (dest.h - item.h) * m) + 'px';
      el.style.setProperty('--m', m.toFixed(4));
      /* ---------- the type converges ACROSS the flight, and is done before it lands ----------
         🔴 THREE STATES, NOT TWO: parked, flying, landed. The scrap sits at
         the side of the pad drawn as what it is — a sticky note at 20px
         extrabold, an email at 15, a torn page at 18 — and that is the one
         the reader has time to look at, so it keeps its own type. By the
         time it is over the pad it is already the event it is going to be,
         and it stays that way through the landing and through the app's
         handover. Asked for exactly: "大字不要变，飞行字要和落下来的字一模一样".

         🔴 SO IT CANNOT RIDE --m. --m is the LANDING (it starts at
         MORPH_AT, .62 of the flight), which would put the type change in
         the last third — mid-air, with the card nearly still, which is the
         one place it is impossible to miss.

         🔴 AND IT USED TO BE `raw / .12`, WHICH IS THE REST OF THAT SAME
         MISTAKE AT THE OTHER END. The argument for 12% was that the card is
         at its fastest there so nothing shows — but 20px → 12.7px is a 36%
         shrink, and no amount of motion hides 36% delivered in an eighth of
         the run. Worse, it was happening while the BOX was still full size
         and holding: the type collapsed in the first eighth, then nothing
         for half the flight, then the box collapsed in the last third. Two
         separate events, in opposite phases, from one object. Reported as
         exactly that: "飞行之后到落地，这个过程中间不够 smooth".

         So the ramp is now the WHOLE flight up to the landing, smoothstep
         so it is flat at both ends. At raw .05 it has moved 1.8% — the
         reader gets the note they were shown, unchanged, which is the
         "一开头字号可以不变" half of the ask. At raw .62 it is finished AND
         its derivative is zero, so the type is at the app's numbers and
         standing still on the frame the box starts moving — the other half.
         Nothing about the type happens during the landing at all; the
         landing is free to be the only thing the eye has to follow.

         ⚠️ THE WEIGHT IS THE ONE EXCEPTION and it is a font-file problem,
         not a timing one — see WEIGHT_SETTLE. */
      const lift = smoothstep(raw / MORPH_AT);
      el.style.setProperty('--lift', lift.toFixed(4));
      el.style.setProperty('--wlift', clamp(lift / WEIGHT_SETTLE).toFixed(4));

      /* the all-day chip's own title size, and the centring that falls out
         of it — see --allday-pad in hub.css for why this is not CSS's job */
      if (kind === 'calendar' && card.allDay) {
        el.style.setProperty('--to-t', ALLDAY_T + 'px');
        const lineH = ALLDAY_T * scale * 1.15;   /* 1.15 = .ev .t line-height */
        const boxH = item.h + (dest.h - item.h) * m;
        /* 🔴 +ALLDAY_NUDGE, and it is a correction to lineH rather than to
           the centring. Half a line box is not half the INK: the ascent sits
           lower in the box than the formula assumes, so centring the box
           left the ink 1.25px high on both all-day cards — measured against
           the app's own frame, same number for the sticky (line-height
           1.15) and the mail (1.25), which is what says it is the box model
           and not the leading. */
        el.style.setProperty('--allday-pad',
          ((Math.max(0, (boxH - lineH) / 2) + ALLDAY_NUDGE) * lift).toFixed(2) + 'px');
      }
      /* 🔴 LISTS NO LONGER TOUCH --fly-k, and dropping it is the point of
         the rewrite. It used to carry the whole landing for a list card —
         one number, `flyK × dest.h/item.h`, scaling our own layout up until
         it happened to fill the app's box. That is what a bounding box buys
         you: the right height and nothing else, which is why the landed
         card was 91% of its parked type inside a box 74% wider and read as
         a different component.
         Now every inset has both endpoints of its own (hub.css), the parked
         one on --fly-k and the app's on --to-k, and --m crosses between
         them. The element keeps the container's flyK, so the parked half of
         every one of those sums stays put while it crosses. */
      if (kind !== 'lists') {
        el.style.setProperty('--fly-k', (flyK + (dest.w / item.wBase - flyK) * m).toFixed(4));
      }
    });
  }

  /* 🔴 THE OUTGOING SET DISSOLVES, it does not blink out. hideEls has always
     written opacity 0, but the layer above it was slammed to
     visibility:hidden in the same frame, so the fade never had anywhere to
     happen — the cards were simply gone, and the seam between one stage and
     the next was a cut. Hold the layer visible for the length of the fade
     (.hub__src transitions opacity in hub.css) and drop it after. Coming
     back cancels the pending drop, so a fast reverse does not catch the
     layer mid-hide. */
  const FLY_OUT_MS = 380;
  let hideTimer = 0;
  function setFliesShown(show) {
    if (show) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = 0; }
      flies.style.visibility = 'visible';
      flies.style.opacity = '1';
    } else if (!hideTimer && flies.style.visibility !== 'hidden') {
      /* the layer carries the fade now, not the cards — see the note on
         .hub__flies in hub.css */
      flies.style.opacity = '0';
      hideTimer = setTimeout(function () {
        flies.style.visibility = 'hidden';
        hideTimer = 0;
      }, FLY_OUT_MS);
    }
  }

  function placeFly(kind, state) {
    if (!flies) return;
    /* the same number sizePad scaled the app by — a second, rounded copy of
       it here would put every card destination a fraction off the grid it
       is aiming at */
    const scale = padS;
    const st = stage.getBoundingClientRect();
    const pr = pad.getBoundingClientRect();
    const sr = screen.getBoundingClientRect();
    const show = !!(state && state.show);
    setFliesShown(show);
    if (kind === 'calendar') {
      hideEls(listEls);
      hideEls(mealEls);
      placeSet(calCards, calEls, calDest, state, scale, st, pr, sr, 'calendar');
    } else if (kind === 'lists') {
      hideEls(calEls);
      hideEls(mealEls);
      placeSet(listCards, listEls, listDest, state, scale, st, pr, sr, 'lists');
    } else {
      hideEls(calEls);
      hideEls(listEls);
      hideEls(mealEls);
    }
  }

  function mountNestie() {
    if (!nestieHost || nestieHost.dataset.ready) return;
    nestieHost.dataset.ready = '1';
    const src = 'nestify-hub-web/assets/assets/nestie/idle.riv';
    if (window.rive && window.rive.Rive) {
      const c = document.createElement('canvas');
      nestieHost.appendChild(c);
      try {
        const inst = new window.rive.Rive({
          src: src,
          canvas: c,
          autoplay: !REDUCED,
          fit: window.rive.Fit ? window.rive.Fit.Contain : undefined,
          onLoad: function () {
            try { inst.resizeDrawingSurfaceToCanvas(); } catch (err) {}
          },
        });
        return;
      } catch (err) {
        c.remove();
      }
    }
    const img = document.createElement('img');
    img.src = 'nestify-hub-web/assets/assets/image/bird_avatar_no_bg.png';
    img.alt = '';
    nestieHost.appendChild(img);
  }

  function showNestie(on) {
    if (!wrap) return;
    mountNestie();
    wrap.classList.toggle('is-nestie', !!on);
  }

  if (habitsHost) {
    habitCards.forEach((card) => {
      const el = document.createElement('div');
      el.className = 'hub__habit';
      el.style.background = card.fill;
      el.style.color = readableOn(card.fill, card.solid);
      const stars = Array.from({ length: card.level }, () => '\u2B50').join('');
      el.innerHTML =
        '<div class="nm"></div>' +
        '<div class="lv"><span class="star-row"></span><span class="bal"></span></div>' +
        '<div class="customs"></div>';
      el.querySelector('.nm').textContent = card.name;
      el.querySelector('.star-row').textContent = stars;
      el.querySelector('.bal').textContent = '\u2B50 ' + card.stars;
      const box = el.querySelector('.customs');
      card.customs.forEach((c) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        const em = document.createElement('span');
        em.className = 'em';
        em.textContent = c.emoji;
        const lb = document.createElement('span');
        lb.textContent = c.label;
        chip.appendChild(em);
        chip.appendChild(lb);
        box.appendChild(chip);
      });
      habitsHost.appendChild(el);
      card.el = el;
    });
  }

  function placeHabits(on) {
    if (!wrap || !habitsHost) return;
    wrap.classList.toggle('is-habits', !!on);
    if (!on) return;
    const wr = wrap.getBoundingClientRect();
    habitCards.forEach((card) => {
      const el = card.el;
      if (!el) return;
      const left = card.side === 'left';
      el.style.left = left ? '-228px' : (wr.width + 18) + 'px';
      el.style.top = (20 + card.slot * 168) + 'px';
    });
  }

  const FX_COLS = ['#38D4E6', '#5B9CF6', '#F14FCE', '#F4D14E', '#2497F0', '#F19D38'];
  let fxParts = [];
  let fxRaf = 0;
  let fxOn = false;
  function burstFx(cx, cy) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.4 + Math.random() * 4.2;
      fxParts.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1.2,
        r: 3 + Math.random() * 7,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        col: FX_COLS[(Math.random() * FX_COLS.length) | 0],
      });
    }
  }
  function tickFx() {
    if (!fxOn || !fxCanvas) { fxRaf = 0; return; }
    const ctx = fxCanvas.getContext('2d');
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = fxCanvas.clientWidth;
    const h = fxCanvas.clientHeight;
    if (fxCanvas.width !== Math.round(w * dpr) || fxCanvas.height !== Math.round(h * dpr)) {
      fxCanvas.width = Math.round(w * dpr);
      fxCanvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (Math.random() < 0.045) {
      burstFx(w * (0.12 + Math.random() * 0.76), h * (0.08 + Math.random() * 0.38));
    }
    fxParts = fxParts.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.035;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.col;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.6 + p.life * 0.7), 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;
    fxRaf = requestAnimationFrame(tickFx);
  }
  function showFx(on) {
    if (!wrap || !fxCanvas) return;
    wrap.classList.toggle('is-fx', !!on);
    if (on && !fxOn) {
      fxOn = true;
      if (!fxRaf) fxRaf = requestAnimationFrame(tickFx);
    } else if (!on) {
      fxOn = false;
      fxParts = [];
    }
  }

  function placeOrnaments(i, local, docked) {
    showNestie(false);
    showFx(false);
    placeHabits(false);
  }

  /* aria-hidden goes with the swap: the four dim lines are still in the tree,
     and without this the heading reads out as all five sentences run together. */
  let lineOn = -1;
  let lineHandoff = null;
  function showLine(n) {
    if (n === lineOn || !titleLines.length) return;
    const prev = lineOn;
    lineOn = n;
    titleLines.forEach((el, i) => {
      if (i === n) el.removeAttribute('aria-hidden');
      else el.setAttribute('aria-hidden', 'true');
    });

    /* no split — hub.css owns the swap, and its two fades are sequenced by
       transition-delay for the same reason the timelines are below */
    if (!lineTls.length) {
      titleLines.forEach((el, i) => el.classList.toggle('is-on', i === n));
      return;
    }

    /* 🔴 THE OUTGOING LINE FINISHES FIRST. Playing the two together is what
       the CSS cross-fade used to do and it is the thing being fixed: two
       sentences on the same pixels, each half there, and neither readable.
       So the exit is reversed at LINE_OUT_SCALE and the entrance is armed
       for exactly as long as that reversal will take — `progress()` and not
       the full duration, because a line interrupted a third of the way in
       only has a third of the way back.

       The pending call is killed on every change: scroll fast enough to
       cross two beats and the middle line simply never gets its turn,
       which is correct — it is the one you scrolled past. */
    if (lineHandoff) { lineHandoff.kill(); lineHandoff = null; }

    /* 🔴 收拾**所有**还在场上的行，不只是紧邻的上一行（用户 2026-08-30：
       「往下滑，字全部都糊在一起」）。

       原来只倒放 lineTls[prev]。快滑跨过多拍时的实际序列是：
         拍 0→1  tl[0] 开始倒放，排 delayedCall 等它退完再放 tl[1]
         拍 1→2  倒放没完，handoff 被 kill；此时 out = tl[1]，而 tl[1] 从没
                 播过、progress() === 0 → 走 else → tl[2] 立刻播
       于是 tl[0]（还在倒放、字还在屏上）与 tl[2]（正在入场）同屏 = 糊在一起。
       中间那行被跳过是对的，问题在于**更早那行没人管**。

       手机上更容易撞：一次划动就能跨好几拍，而这几条动画是**按秒**跑的
       （LINE_SPREAD / LINE_DUR），跟滚动距离无关——所以缩短 hub 的滚动预算
       （PR #3200）让它从偶发变成必现。 */
    lineTls.forEach((tl, i) => {
      if (i === n || i === prev || !tl || tl.progress() === 0) return;
      tl.timeScale(LINE_OUT_SCALE).reverse();
    });

    const out = lineTls[prev];
    const inn = lineTls[n];
    if (!inn) return;
    if (out && out.progress() > 0) {
      const back = out.duration() * out.progress() / LINE_OUT_SCALE;
      out.timeScale(LINE_OUT_SCALE).reverse();
      lineHandoff = gsap.delayedCall(back, () => {
        lineHandoff = null;
        inn.timeScale(1).play();
      });
    } else {
      inn.timeScale(1).play();
    }
  }

  let cur = -2;
  let screenIsEarly = null;   /* 停靠贴图当前是不是 home|think，见 onScroll */
  /* ---------- the flight runs on the wheel ----------
     🔴 A SCRUB, NOT A TIMELINE. It was a clock for one release: entering a
     stage called startRun(), a 1500ms rAF played the flight to the end, and
     scrolling had nothing to do with it after the first frame. Stop moving
     and the cards kept going; scroll a whole stage in one flick and you
     arrived after they had already landed. The reader was watching a video
     that happened to start when they got there.

     Now the flight IS the scroll again. One number runs it — `local`, the
     same position that picks the beat — so the cards move exactly as far as
     the wheel turns, stop dead when it stops, and run backwards when it
     does. No clock, no `pending` queue, no `spent` set: a scrub has nothing
     to replay because position alone says where every card is, and arriving
     at the same scroll twice draws the same frame twice.

     Two things the beat map already carries and this reads rather than
     re-decides:

     WHERE IT ENDS. span[i].split — `at` in the beats table, .60 for both
     fly stages. The cards fly over the first 60% of the beat and the app's
     own second half plays out over the rest, which is what `then` is for.

     HANDOVER. span[i].hand, still .86 of the flight and still for the
     original reason: the app starts drawing while the last cards are
     settling over it, so its render time is spent behind cards rather than
     behind nothing. As a scroll fraction it is also reversible — scroll back
     above it and the app goes back to the state it was in, which the clock
     could not do. */

  /* the cards sit on the grid before they go — the 320ms the clock held for,
     restated as a fraction of the flight's own scroll so it scales with the
     stage instead of with a stopwatch. */
  const FLY_HOLD = 0.21;

  function flyStateAt(i, local) {
    const sp = span[i];
    const fly = Math.max(1e-6, sp.split - sp.s);
    /* 🔴 A STAGE THAT HANDS OVER LETS ITS CARDS GO; ONE THAT DOES NOT IS
       HOLDING THE PICTURE. calendar's cards fade once the app has drawn the
       same events underneath them, so FLY_HOLD is all they need. lists has
       no handover — the cards are the only copy of those two new sections
       there is — so releasing them on the same timer would empty the panel
       back out in front of the reader, halfway through the beat that just
       filled it. It holds them to the end of its own beat instead, and the
       change of tab is what clears them. */
    const until = beats[i].then ? sp.split + fly * FLY_HOLD : sp.e;
    const t = clamp((local - sp.s) / fly);
    /* 🔴 A SETTLING BEAT LETS ITS CARDS GO ON A CLOCK, NOT ON THE WHEEL —
       see the note on armSettle. `until` still decides it for every other
       beat; for this one the answer is "when the settle says so". */
    if (beats[i].settle) return { show: !released, t: t };
    return { show: local < until, t: t };
  }

  /* ---------- the last beat of the landing runs itself ----------
     🔴 EVERYTHING ELSE IN THIS SECTION IS A SCROLL FRACTION, and that is
     still the right rule for the parts the reader is steering. The handover
     is not one of them. By the time the cards have landed the reader has
     arrived; what is left is a conclusion, and it was made of three things
     on three different clocks:

       the box morph      scroll (--m)
       our layer's fade   time   (.38s CSS transition on .hub__flies)
       the app's repaint  neither — it paints when it feels like it, and
                          the build is not in this repo

     Scrub them slowly and they line up. Take them at a normal scroll speed
     and they do not, and the seam reads as a jolt with a small displacement
     in it — reported as "咯噔一下的断裂感", and it is not something more
     alignment can fix, because nothing here is misaligned. They are out of
     STEP, not out of place.

     So the flight stays on the wheel and the conclusion comes off it: the
     moment the last card is home, the token goes out and a fixed hold
     starts. The app gets that whole hold to paint BEHIND cards that are
     still standing — which is what `hand` was buying with scroll distance,
     bought with time instead, and reliably rather than at whatever rate the
     reader happened to be moving. Then our copies leave.

     🔴 STILL REVERSIBLE, which is the one thing the scroll version had that
     a clock usually loses. Scrolling back above the landing disarms it: the
     timer is cancelled, the cards come back, and the app is told to go back
     to `fly`. Come down again and the settle plays from the top. */
  const SETTLE_HOLD = 420;
  let settleOn = false, released = false, settleTimer = 0;

  function armSettle(then) {
    if (settleOn) return;
    settleOn = true;
    tellToken(then);
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      settleTimer = 0;
      released = true;
      /* 🔴 A CUT, NOT A FADE, AND ONLY BECAUSE THE TWO ARE IDENTICAL. The
         layer's .38s exit is right for every other beat, where the cards
         are the only copy of what they show. Here the app has spent the
         hold painting the same seven events underneath, matched to the
         quarter-pixel — box, type, weight, ink, avatars — so the fade has
         nothing to reveal and one thing to cost: for 380ms both copies are
         half-transparent over the same ground, the composite reads lighter
         than either, and the contrast dipping and coming back is felt as
         the words settling. Measured frame by frame at 25fps the content
         never translates by so much as a pixel through this, which is what
         says the movement is in the FADE and not in the geometry.
         Swapping two identical pictures in one frame shows nothing. */
      flies.classList.add('is-cut');
      onScroll();
    }, SETTLE_HOLD);
  }

  function disarmSettle() {
    if (!settleOn) return;
    settleOn = false;
    released = false;
    flies.classList.remove('is-cut');
    clearTimeout(settleTimer);
    settleTimer = 0;
  }

  function applyBeat(i) {
    /* 🔴 手机上五拍已经摊成 .hub__deck 那条横滑轨道（index.html / hub.css），
       不再由滚动播。这里早退掉的是两件事：tellHub 往 iframe 发的换屏消息、
       showLine 换标题——两者对应的元素在手机上都是 visibility:hidden，跑了也
       看不见，只是白烧。轨道上那五张卡用的就是 setStill 会写的同几张图。 */
    if (PHONE_R) return;
    if (i === cur) return;
    cur = i;
    if (i >= 0 && i < nBeats) {
      tellHub(beats[i]);
      showLine(beats[i].line);
    }
  }

  /* 🔴 入场期不吃滚动。模糊没散完之前，滚动只喂清晰度（--meet-fly），demo
     一拍都不许走——否则 pad 还糊着，里面的画面已经在换了（用户 2026-08-28）。

     做法是把**原点**在入场期内跟着滚动走，于是 p 恒为 0；meet 的飞越一到 1，
     原点就定在那一刻的 scrollY，demo 从那里开始吃滚动。往回滚时 f 掉回 <1，
     原点又跟着走，对称，不需要额外的复位。

     🔴 不用固定长度的死区。固定死区要么在慢滚时留下"已经清晰了但滚了没反应"
     的一屏，要么在快滚时提前放行——因为飞越走完的位置随滚动速度浮动（meet 的
     播放头带阻尼）。原点跟着 f 走才两头都对。

     原点夹在 [hub.offsetTop, +ENTER_MAX]：万一 meet.js 没跑（reduced-motion /
     报错），__meetFly 是 undefined，直接退回老行为（原点 = offsetTop）。 */
  // meet.js 算好后发布（window.__hubOverlap）；回退值与 hub.css 的 --hub-overlap 一致
  const ENTER_MAX = () => (window.__hubOverlap ?? 3.3) * window.innerHeight;
  let originY = null;
  function hubOrigin() {
    const base = hub.offsetTop;
    /* 🔴 2026-09-03 改版：入场期整个取消，原点恒为 offsetTop。
       上面那套「原点在入场期内跟着滚动走」的前提是 **meet 排在 hub 前面**：
       f = __meetFly 从 0 涨到 1 的那段是 meet 的飞越，hub 在此期间不许吃滚动。
       改版后 hub 排在 meet **前面**，读者走到 hub 时 meet 根本还没开始，
       __meetFly 恒为 0 —— 于是 `f < 1` 每一帧都成立，原点每帧都被改写成当前
       scrollY，追着读者跑，p 随即失控。

       实测（改前，1440×900 真滚）：单帧最高跳 3482px，读者从 intro 一路被
       滑到 22482 —— 正好是 hub 段末尾，即 jumpHomeExit 的出口。这就是
       「to be a parent 之后交互乱七八糟」的第二个根因（第一个是 hub.css
       那条负 margin 咬进 intro）。

       deck / meet 哪天搬回 hub 前面，把这段连同 hub.css 的 --hub-overlap
       一起恢复即可；两处是同一个机制的两半。 */
    return base;
  }
  const clamp2 = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- 前奏：这一段现在从「房间 1 + 挂墙的模型」开场 ----------
     2026-09-03 改版（用户定的顺序）：

       前奏      房间 1，pad 挂在墙上          ← 新增
       ↓         脱墙：模型飞进 app 位          = dock 倒放
       五拍      pad 里跑真 app                 原样
       ↓         上墙：模型飞回墙上             = dock 正放
       房间 1 → 2 → 3                          原样（"One screen." 在这里）

     🔴 实现上只加了一层映射，**下游一行没改**：前奏期把 legacy p 钉在 DOCK
     （停靠、data-room=0），走完前奏之后原样重放整条旧时间轴 0→1。旧时间轴
     本身就是「五拍 → DOCK → thesis → 三间房」，所以接上去正好是要的顺序。

     两个转场因此天生互为逆动画：脱墙是 .is-docked 被摘掉时 CSS 自己倒放
     （几何在 hub.css 的 --dock-y / --dock-s 上），上墙是原来那次 DOCK 穿越。
     不需要写第二套动画，也不会两套走形。

     🔴 前奏用 px 现算而不是写死分数：段高里有一份 meet.js 发布的
     --hub-overlap，分数会随它漂。 */
  /* 🔴 2026-09-04：2 屏 → 0 → **1**。两次改动的理由都留着，因为它们不矛盾。

     置 0 的理由（当天早些时候）：intro 加了原地转场，挂墙这一幕已经在 intro
     里演完了，前奏等于让读者滚过去**再看一遍同样的画面**。这条现在依然成立
     ——所以没有改回 2。

     改到 1 的理由（同日晚些，用户实测后定的）：脱墙不是滚动驱动的，是
     `docked = p >= DOCK` 这个 class 一摘、CSS 自己倒放。读者一跨过 pinY 它就
     开跑，实测 **80px 滚动内 pad 从 325px 弹到 879px**（2.5 倍）。刚把墙一笔
     一笔渲染出来，紧接着机器炸开，很突兀。

     前奏期 progress() 恒返回 DOCK，于是 is-docked 保持、pad 停在 325px。这一屏
     不是「重看一遍」——转场那一幕是**动画**，这一屏是**静止的定格**，作用是让
     读者看清机器已经在墙上了，再开始巡览。

     ⚠️ 改这个数必须同步改 hub.css 的段高（1 屏 = +100svh），否则前奏是从正片
     里挖走的，巡览会被压短。 */
  /* 🔴 1 → 0.55（2026-09-05，用户嫌前奏那句到第 0 拍之间要滚太久）。
     前奏在屏幕上的实际跨度 = 300px 的提前量（inPrologue 那个 lead）+ PRO_SVH 屏。
     1440×900：改前 300+900=1200（实测 1300），改后 300+495=795 ≈ 0.88 屏。
     ⚠️ 上面那条「改这个数必须同步改 hub.css 的段高（1 屏 = +100svh）」照旧：
     那边已经从 1713 走到 1185，其中前奏占 55svh，正是这里的 0.55。 */
  const PRO_SVH = 0.55;

  /* iOS Safari changes `innerHeight` when its address bar collapses, but the
     section length above is authored in `svh` — the SMALL viewport, which
     deliberately does not change with that chrome. Using innerHeight here
     made the prologue boundary move by ~40px while unlockExplore landed only
     3px beyond it: the page briefly became `.is-prologue` again and the old
     Lights Up room flashed back over the Family Hub room.

     Measure the same CSS unit the section uses. Desktop keeps its existing
     dynamic-viewport calculation; this stability rule is phone-only. */
  function measureSmallViewportHeight() {
    if (!PHONE_R || !document.body) return window.innerHeight;
    const ruler = document.createElement('i');
    ruler.setAttribute('aria-hidden', 'true');
    ruler.style.cssText = 'position:fixed;left:-2px;top:0;width:1px;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(ruler);
    const measured = ruler.getBoundingClientRect().height;
    ruler.remove();
    return measured > 0 ? measured : window.innerHeight;
  }
  let prologueViewportHeight = measureSmallViewportHeight();
  /* A real orientation change needs a new small viewport. Browser-toolbar
     resize events do not: that distinction is exactly why this is not tied
     to the ordinary resize handler. */
  if (PHONE_R) addEventListener('orientationchange', () => {
    setTimeout(() => { prologueViewportHeight = measureSmallViewportHeight(); }, 180);
  }, { passive: true });
  const PROLOGUE_EXIT_PAD = 32;

  function proFrac(range) {
    /* 上限兜底：真出现极端视口时，前奏最多吃掉四成，剩下的留给正片 */
    const viewportHeight = PHONE_R ? prologueViewportHeight : window.innerHeight;
    return Math.min(0.4, (PRO_SVH * viewportHeight) / range);
  }

  /* 🔴 原始进度：**没经过前奏映射**的那个数，0=段首、1=段尾。
     凡是「读者在这一段的什么位置」这类判断都必须用它，不能用 progress()——
     后者在前奏期恒等于 DOCK(0.62)，那是给下游画面用的假身份，不是位置。
     踩过的坑写在 onScroll 的出口判断那里。 */
  function rawProgress() {
    const o = hubOrigin();
    const range = Math.max(1, hub.offsetTop + hub.offsetHeight - window.innerHeight - o);
    return clamp((window.scrollY - o) / range);
  }

  /* 读者是不是还在前奏里。必须用 rawProgress——progress() 在前奏期恒等于
     DOCK，拿它判永远为真。 */
  function inPrologue() {
    if (PHONE_R) return true;
    const o = hubOrigin();
    /* 🔴 必须先确认读者**已经走到**这一段。rawProgress() 在 scrollY < o 时被
       clamp 成 0，也 ≤ proFrac，于是「还在 intro 里」会被判成前奏——那会让 hub
       的标题在 intro 的转场期间就亮起来，和 intro 自己那句同时满不透明地叠在
       一起，同一行字渲染两遍，看起来更粗。 */
    /* 🔴 提前 300px 亮起来，跟 intro 那句交叉淡出。

       hub 标题的 opacity 挂着 CSS 过渡（时间型），而 intro 那句是滚动 scrub 的。
       不提前的话两边会在交接那一帧同时为 0——intro 的已经淡完，hub 的过渡才刚
       起步，读者看到标题空一下。300px 的提前量让两条曲线叠上，加上位置字号
       完全一致，读者只会觉得那句话一直立着。 */
    if (window.scrollY < o - 300) return false;
    if (PHONE_R) return true;
    const range = Math.max(1, hub.offsetTop + hub.offsetHeight - window.innerHeight - o);
    return rawProgress() <= proFrac(range);
  }

  function progress() {
    if (PHONE_R) return DOCK;
    const o = hubOrigin();
    const range = Math.max(1, hub.offsetTop + hub.offsetHeight - window.innerHeight - o);
    const raw = clamp((window.scrollY - o) / range);
    const pro = proFrac(range);
    if (raw <= pro) return DOCK;         // 前奏：停在墙上的那一帧
    return clamp((raw - pro) / (1 - pro));
  }
  /* 🔴 必须是 progress() 的逆函数。它是 jumpHomeExit 一类「跳到某个 p」的
     落点计算，漏掉前奏就会整体偏 2 屏——而且偏的方向正好是把读者甩回前奏里。 */
  function yAt(p) {
    const o = hubOrigin();
    const range = Math.max(1, hub.offsetTop + hub.offsetHeight - window.innerHeight - o);
    const pro = proFrac(range);
    return o + range * (pro + clamp(p) * (1 - pro));
  }

  // The mobile feature cards follow Lights Up in normal document flow.
  const exploreBtn = hub.querySelector('.hub__explore-btn');
  if (exploreBtn) exploreBtn.hidden = true;

  // Down: every beat. Up: skip the rewind — Home only, then out.
  let lastP = 0;
  let lastScrollY = window.scrollY;
  let storyArmed = false;
  let skippingUp = false;

  function holdHome() {
    applyBeat(nBeats - 1);
    tellToken('home|idle');
    placeFly('', { show: false, t: 0 });
    placeOrnaments(-1, 0, true);
  }

  function jumpHomeExit() {
    skippingUp = true;
    holdHome();
    /* 🔴 落点走**原始**坐标，不走 yAt()。yAt 是 progress() 的逆函数，会把
       EXIT_P 映射到前奏**之后**（实测 7987）——读者被弹到那里，再往回滚一下
       又满足触发条件，于是原地反复弹，表现就是「很多 section 拉不回去」。
       往回滚的语义是「跳到这一段开头」，而这一段现在的开头就是前奏。 */
    const o = hubOrigin();
    const rng = Math.max(1, hub.offsetTop + hub.offsetHeight - window.innerHeight - o);
    const y = o + rng * EXIT_P;
    if (window.lenis) {
      window.lenis.scrollTo(y, { immediate: true, force: true });
    } else {
      window.scrollTo(0, y);
    }
  }

  function measurePad() {
    if (!pad || !stage) return;
    /* 🔴 手机上量的是**横滑轨道**的底边，不是真机的。--pad-bot 的意思一直是
       「按钮该挂在谁下面」（.hub__close 的 top 就是它 + 4.67svh），而手机上真机
       整个 visibility:hidden、位置留在原处，照它算按钮会落在轨道中间——实测
       390×844：轨道 266–535，按钮 478，正压在第三张卡上。
       轨道在断点外是 display:none，querySelector 拿不到高度时自然回落到真机，
       所以这里不需要判断断点。 */
    /* 量的是**轨道**，不是包着它的那张纸：按钮要落在纸**里面**（纸的下内边距
       就是给它留的），照纸的底边算会把按钮顶到纸外面去。 */
    const deck = hub.querySelector('.hub__deck-track');
    const src = (deck && deck.offsetHeight > 0) ? deck : pad;
    const b = src.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
    hub.style.setProperty('--pad-bot', b.toFixed(1) + 'px');
  }

  function onOuterWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    if (window.lenis) {
      window.lenis.scrollTo(window.lenis.scroll + e.deltaY, { immediate: true });
    } else {
      window.scrollBy(0, e.deltaY);
    }
  }
  if (catcher) catcher.addEventListener('wheel', onOuterWheel, { passive: false });

  function attachIframeWheel() {
    try {
      const win = iframe.contentWindow;
      if (!win || win._hubWheel) return;
      win._hubWheel = true;
      win.addEventListener('wheel', onOuterWheel, { passive: false, capture: true });
    } catch (err) {}
  }
  /* What the hub should show RIGHT NOW, derived from scroll state the same
     way onScroll decides it. beats[cur]'s entry token is not enough: docked
     means 'home|idle' (the docked branch never sends tokens), and a spent
     stage past its handover means its `then`, not a replay of the flight. */
  function currentStateToken() {
    const p = progress();
    /* 🔴 前奏期是 **home|think**，不是 home|idle。这一屏（带 "working on it"）
       是原第 0 拍的画面，现在归 intro 的转场演——前奏是它的延续，屏幕内容必须
       接得上，否则读者刚在转场里看到的那一屏，一交接就换掉了。
       必须排在下面 `p >= DOCK` 之前：前奏期 p 恒等于 DOCK，会被那条截胡。 */
    if (inPrologue()) return 'home|think';
    if (skippingUp || p >= DOCK) return 'home|idle';
    const i = beatFromHubP(p);
    const beat = beats[i];
    if (!beat) return '';
    /* 🔴 上游这里有一句 `if (run) return …` —— 飞行还在飞时由它占着 token。
       本版飞行是随滚动的 scrub，没有「在飞的 run」这个状态（run 未声明），
       而 beatFromHubP(p) 本身就已经是当前该在的那一拍，所以直接往下走。 */
    const local = clamp(p / DOCK);
    return beat.then && local >= span[i].hand
      ? beat.then
      : beat.tab + '|' + beat.phase;
  }
  /* The iframe's load fires when the document is in — but the Flutter app
     registers its message listener only after CanvasKit instantiates and
     runApp builds, seconds later on slow devices. A single post at load
     lands in a not-yet-listening window and is dropped, and lastTold would
     then dedupe every later resend of the same token, sticking the hub on
     its boot tab. There is no ready signal from the app, so re-affirm the
     current state a few times; sends are state descriptors, so a repeat
     delivery is idempotent for the app. */
  let retellTimer = null;
  iframe.addEventListener('load', () => {
    /* the initial about:blank also fires load while data-src waits — the
       wheel poll covers that window, and there is no app to talk to yet */
    if (!iframe.getAttribute('src')) return;
    lastTold = '';
    tellToken(currentStateToken());
    attachIframeWheel();
    if (retellTimer) clearInterval(retellTimer);
    let retells = 0;
    retellTimer = setInterval(() => {
      if (++retells > 15) {
        clearInterval(retellTimer);
        retellTimer = null;
        return;
      }
      lastTold = '';
      tellToken(currentStateToken());
    }, 800);
  });
  const wheelPoll = setInterval(() => {
    attachIframeWheel();
    if (iframe.contentDocument) clearInterval(wheelPoll);
  }, 400);

  /* ---------- 不在这一段时，别让 Flutter 空转 ----------
     判据、实测数据和「为什么只有 content-visibility 停得住」都写在 hub.css
     的 `.hub.is-away .hub__inner` 上方，这里只负责挂那个 class。

     🔴 观察的是 .hub 本身，不是 .hub__stage —— stage 是 sticky 的，只要读者
     还在这一段里它就一直与视口相交，等于永远不 away。.hub 的高度包含了 meet
     压上来的那段负 margin，所以「不相交」的含义正是「读者还在 meet 以上」，
     也就是那 40 屏。

     100% 的余量 = 提前一屏恢复，读者滚到之前 Flutter 已经在画了。 */
  new IntersectionObserver(
    ([e]) => {
      hub.classList.toggle('is-away', !e.isIntersecting);
      if (!e.isIntersecting) stopRoomClock();   // 见 syncRooms 顶部：离屏别空转
    },
    { rootMargin: '100% 0px' }
  ).observe(hub);

  let ticking = false;

  /* ---------- the wall behind the docked device ----------
     🔴 THE WALL IS ON THE WHEEL NOW. It used to be a 2800ms interval, and
     the note that stood here argued hard for that: "stop moving and the
     room stops with you, which is the one thing a room must never do."
     That was written when this section was a timeline. It is a scrub — the
     cards, the flights, the landings all move only as far as the reader
     turns the wheel — and a wall that changed itself was the last thing in
     it still running on a clock, which read as the one part of the section
     that was not listening.

     Gone with the interval: the IntersectionObserver that paused it off
     screen (nothing to pause), and ROOM_HOLD (nothing to time). The 1.2s
     cross-fade in hub.css and hub3d.js's matching ROOM_FADE are untouched —
     the wall still DISSOLVES over 1.2s, it is just the reader who decides
     when. Scroll slowly and a room holds as long as you like.

     🔴 IT OPENS ON 1, NOT ON 0. 0-1-2 is how the pictures are STACKED —
     hub.css paints room 0 as the ground and layers the other two over it,
     and hub3d.js does the same with the rim's coats over the blue one,
     which is why 0 has to be the one with no layer on. 1-2-0 is the order
     they are SHOWN in: green, then wood, then blue.

     🔴 THE LAST ROOM IS THE LONG ONE, and that is the damping. In svh off
     the 1135 range (see the anchors at the top) — the three keep the exact
     lengths they were given; only the dock they hang off has moved:

       room 1   785 →  895   110svh   the dock, the thesis, the button
       room 2   895 →  985    90svh   about one flick
       room 0   985 → 1135   150svh   the finish, and hard to flick past

     A flick is ~1 screen, so at 90 the middle room cannot be crossed
     without stopping, and the last takes nearly two. It is the same trade
     every other number in this file makes: resistance is bought with
     distance. */
  const ROOMS = 3;
  const ROOM_ORDER = [1, 2, 0];
  /* Lists 与 Rewards 交换整套视觉房间；功能内容和标题顺序保持不变。 */
  const FEATURE_ROOM_ORDER = [1, 2, 4, 3, 0];
  /* 手机五幕按视觉顺序映射：5 黄柜、1 红棕厨房、2 极简卧室、3 儿童房、4 蓝沙发。
     data-room 仍采用堆叠层编号，所以数组顺序不是读者看到的 1→5。 */
  const ROOM_TINTS = [0xb58a45, 0xa06a52, 0xb59d7f, 0xb88952, 0x82a9c6];
  const ROOM_AT = [DOCK, 0.7621, 0.8678];   // 940, 1153, 1313 of 1513

  /* 手机上给五拍与三面墙各放一个吸附点（snap.js / snap.css）。位置由
     beatStart() 和 ROOM_AT 推出来——它们就是这一段时间轴的定义本身，所以
     range 再变也不会漂（这正是本文件出过事故的地方）。

     🔴 用 hub.offsetHeight - innerHeight 作为 range，而不是 progress() 里那个
     减掉 origin 的版本：手机上 --hub-overlap 为 0，两者相等；而吸附点是**页面
     坐标**里的东西，不该跟着入场期的 origin 漂移。 */
  /* 🔴 手机上不布吸附点。五拍已经摊成横滑轨道（hub.css 末尾那块），
     `range * DOCK * beatStart(k)` 里的 DOCK 在这一版是 0.005 的哨兵值，五个点
     全塌在同一个像素上——实测页面上有 5 个 .snap-pt 挤在 y=2870/2871。
     段落本身只有 1.3 屏，吸附也没有可分的拍了。 */
  if (!PHONE_R && window.snapAt) window.snapAt(hub, () => {
    const range = Math.max(1, hub.offsetHeight - innerHeight);
    const pts = [];
    /* 🔴 要乘 DOCK。beatStart() 给的是**五拍之内**的分数（acc / weightSum），
       而五拍只占 range 的 0..DOCK 那一段——下游读它的地方都是拿 p / DOCK 去比
       的（见 beatFromHubP 与 `local = clamp(p / DOCK)`）。漏掉这一乘，吸附点
       会落在 0/225/612/982/1239svh，而拍的真实起点是 0/140/380/610/770。 */
    for (let k = 0; k < beats.length; k++) pts.push(range * DOCK * beatStart(k));
    /* 手机上房间是时钟驱动的，给它们放吸附点没有意义（滚动位置不再决定
       墙的切换），只保留五拍。 */
    if (!PHONE_R) for (const r of ROOM_AT) pts.push(range * r);
    return pts;
  });
  /* 🔴 2026-08-31 三间房各自加长（用户：「往下滑的时候能不能有点阻力，感觉
     一下场景就过去了，尤其是第一张」）。range 1135 → 1358，段高 +223svh。

         room 1   785 →  998   213svh （原 110）
         room 2   998 → 1158   160svh （原  90）
         room 0  1158 → 1358   200svh （原 150）

     🔴 第一张为什么最没有停留感，是算得出来的：它肚子里装着三件事——
     dock(785)、thesis(859)、CTA(878)，而它原本 895 就换墙了。也就是说 CTA
     出现之后只剩 **17svh**（五分之一屏）是安定的，读者眼里那面墙等于没停过。
     加长之后这段安定期是 120svh，第一间房才真的有「停下来看一眼」的余地。

     ⚠️ 改 range 就要把**每一个**按 range 取分数的常量一起换算，否则就是这个
     文件出过的那次事故（漏了 ROOM_AT，换墙点跑到 thesis 前面去了）。这次一起
     换算并逐个复核过 svh 锚点的是：HEAD_IN / EXIT_P / DOCK / THESIS_AT /
     CTA_AT / ROOM_AT —— 全部保住原值，所以 dock 之前那五拍一帧没动。
     FLY_FROM 与 HANDOVER_LEAD 是**拍内**分数，不随 range 变，不用动。 */
  let room = ROOM_ORDER[0];

  function showRoom(n) {
    if (n === room && hub.dataset.room === String(n)) return;
    /* 🔴 THE WRAP IS A CUT, NOT A FADE, for the layer underneath — see
       .hub.is-room-cut in hub.css and the same rule for the rim's coats in
       hub3d.js. It has to be written BEFORE the room, in the same task, so
       the two land in one style update; on its own frame it would be a
       visible flash of room 2 first. */
    if (PHONE_R) {
      const fromFeature = FEATURE_ROOM_ORDER.indexOf(room);
      const toFeature = FEATURE_ROOM_ORDER.indexOf(n);
      hub.classList.remove('is-room-slide-forward', 'is-room-slide-back');
      /* 强制落一次样式，连续快速滚动也会重新播放这一格横移。 */
      void hub.offsetWidth;
      hub.classList.add(toFeature >= fromFeature ? 'is-room-slide-forward' : 'is-room-slide-back');
    }
    hub.classList.toggle('is-room-cut', n === 0 && (room === ROOMS - 1 || room === 4));
    room = n;
    hub.dataset.room = String(n);
    if (PHONE_R && window.hub3d && window.hub3d.setCoatTint) {
      const stillLightsUp = inPrologue() || hub.classList.contains('is-early');
      window.hub3d.setCoatTint(stillLightsUp ? 0x9aa66e : ROOM_TINTS[n], true);
    }
  }

  /* which of the three the reader is standing in, and how far through it —
     the fill under the button is that second number, painted per frame now
     rather than run off a keyframe. */
  /* ---------- 手机上这面墙自己走，不跟手 ----------
     用户 2026-09-02：「One screen 就让它自动滑过去吧，相当于在手机上它是自动
     变换场景的，不会根据用户的手势去变换，它就自己在那边变，当然用户滑它就
     可以把它划走。」

     🔴 这是**有意退回**到 2026 年更早的那一版。上面 showRoom 那段注释记着当初
     为什么改成跟手：「这一段是 scrub——卡片、飞行、落位都只随读者转动轮子而
     动，而一面自己会变的墙，是里面唯一还在跑时钟的东西。」那个理由在**桌面**
     仍然成立，所以桌面一行没动。

     手机上不成立的原因是它太贵：三面墙跟手时要占 573svh（5.7 屏）的滚动距离，
     而整页已经 44.4 屏、用户明确说滑太久。改成时钟之后这段距离可以整个收掉，
     墙照样转，读者想走随时能走 —— 这正是用户描述的那个模型。

     ⚠️ 时钟只在**停靠且在视野里**时走。离开就停：否则读者滚到页尾时它还在
     后台换墙，白烧合成器（这一页 44 屏，那是很长的一段后台空转）。 */
  const ROOM_MS = 2600;          // 每面墙停留多久（手机）
  let roomT0 = 0, roomRAF = 0;

  function roomClock(now) {
    roomRAF = 0;
    if (!roomT0) roomT0 = now;
    const el = now - roomT0;
    const i = Math.floor(el / ROOM_MS) % ROOMS;
    showRoom(ROOM_ORDER[i]);
    hub.style.setProperty('--room-fill', ((el % ROOM_MS) / ROOM_MS).toFixed(4));
    roomRAF = requestAnimationFrame(roomClock);
  }
  function stopRoomClock() {
    if (roomRAF) cancelAnimationFrame(roomRAF);
    roomRAF = 0; roomT0 = 0;
  }

  function syncRooms(p, docked) {
    hub.classList.toggle('is-rooms-on', docked);
    if (!docked) {
      hub.style.setProperty('--room-fill', '0');
      stopRoomClock();
      return;
    }
    if (PHONE && !REDUCED) {
      /* 🔴 前奏那一屏不轮墙。它显示的是 intro 那面绿色客厅（.hub__glow-pro，
         hub.css 里那一整段讲的就是它），三面墙的轮换属于段尾「One screen」
         那几屏——机器回到墙上之后的事。

         前奏期 progress() 恒等于 DOCK，所以 docked 为 true，时钟照样起：
         轮到 room=2 时 ::after 会从 .hub__glow-pro 上面盖过来（伪元素画在子
         元素之后），读者停在那一屏不动都能看见背景每 7.8 秒换 2.6 秒
         （用户 2026-09-05 报的就是这个）。

         hub.css 那边给 .hub__glow-pro 加了 z-index 兜住这件事；这里是不做无用
         功——前奏有好几屏，rAF 在那里空转纯属白烧。两条修法互相独立，都留着。

         ⚠️ 停钟不动 data-room：--bezel-c（机身边框色）和 hub3d 的 coat tint 都
         读它，改了会连带换机身的颜色。停钟只是不再往前走。 */
      /* 🔴 时钟停了，房间改由**框里的轨道**驱动（2026-09-05 第三版，用户：
         「背景也可以跟着它动，每次换一个场景就变一次」）。

         走过两版：先是跟滚动（桌面至今如此），再是 2.6s 一格的时钟（用户当时
         要「它自己在那边变」）。现在换场景这件事有了明确的触发者——读者滑到第
         几张——再让时钟并行跑，两个东西会抢同一个 data-room。
         驱动在 deckTrack 里，五张画面对三面墙轮着来。 */
      stopRoomClock();
      return;
      /* 停靠了就起钟；离开停靠或离开视野由上面那支和 is-away 的观察器收掉。 */
      if (!roomRAF) roomRAF = requestAnimationFrame(roomClock);
      return;
    }
    let i = 0;
    for (let j = ROOM_AT.length - 1; j > 0; j--) {
      if (p >= ROOM_AT[j]) { i = j; break; }
    }
    showRoom(ROOM_ORDER[i]);
    const from = ROOM_AT[i];
    const to = i + 1 < ROOM_AT.length ? ROOM_AT[i + 1] : 1;
    hub.style.setProperty('--room-fill', clamp((p - from) / (to - from)).toFixed(4));
  }

  /* ---------- 手机：框里的轨道驱动三样东西 ----------
     🔴 「滑到第几张」是这一幕唯一的真相源，标题、房间、箭头的可用状态都从它推。
     不维护自己的 index：读者随时可能用手指划，任何自存的状态都会和真实位置漂开，
     所以每次都从 scrollLeft 现算。

     🔴 步长用**一张卡的宽度**（它就是屏幕宽），不是 clientWidth 之外的什么值——
     .hub__shots > li 是 `flex: 0 0 100%`，两者相等，但写成 offsetLeft 之差才不会
     在将来加 gap 或 peek 时悄悄错位。 */
  // A local animation clock: scrolling only brings this section into view.
  (function mobileLightsUp() {
    if (!PHONE_R || !stage) return;
    hub.classList.add('hub--auto-lights');
    const roomLayer = hub.querySelector('.hub__glow-pro');
    if (roomLayer) stage.prepend(roomLayer);
    const sketch = document.createElement('div');
    sketch.className = 'intro__sketch hub__auto-sketch';
    sketch.setAttribute('aria-hidden', 'true');
    stage.prepend(sketch);
    const wire = document.createElement('div');
    wire.className = 'hub__auto-wire';
    wire.setAttribute('aria-hidden', 'true');
    const frame = document.getElementById('deviceFrame');
    if (frame) wire.append(frame); // Reuse the original device drawing, including its wordmark.
    stage.append(wire);
    function measureWire() {
      const screen = hub.querySelector('.hub__screen');
      if (!screen) return;
      const rect = screen.getBoundingClientRect();
      const parent = stage.getBoundingClientRect();
      wire.style.left = (rect.left - parent.left - rect.width * .0717) + 'px';
      wire.style.top = (rect.top - parent.top - rect.height * .1219) + 'px';
      wire.style.width = (rect.width * 1.1486) + 'px';
      wire.style.height = (rect.height * 1.2405) + 'px';
    }
    new ResizeObserver(measureWire).observe(stage);
    let raf = 0, previous = 0, elapsed = 0, visible = false;
    const ramp = (t, a, b) => clamp((t - a) / (b - a));
    function paint() {
      const t = REDUCED ? 6500 : elapsed % 11000;
      const fade = 1 - ramp(t, 10200, 11000);
      // Draw the device and room first, form the solid device second,
      // then colour the room. Keep each completed beat visible before advancing.
      const solid = ramp(t, 2800, 3900);
      hub.style.setProperty('--auto-wire-draw', ramp(t, 0, 1500).toFixed(4));
      hub.style.setProperty('--auto-wire', ((1 - solid) * fade).toFixed(4));
      hub.style.setProperty('--auto-sketch', (ramp(t, 700, 2600) * fade).toFixed(4));
      hub.style.setProperty('--auto-room', (ramp(t, 4100, 6000) * fade).toFixed(4));
      hub.style.setProperty('--auto-device', (solid * fade).toFixed(4));
    }
    function tick(now) {
      if (previous) elapsed += (now - previous) * 1.5;
      if (!previous) measureWire();
      previous = now;
      paint();
      raf = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(raf);
      raf = 0; previous = 0;
      if (visible && !document.hidden && !REDUCED) raf = requestAnimationFrame(tick);
    }
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(hub);
    document.addEventListener('visibilitychange', sync);
    paint();
  })();

  (function deckTrack() {
    const track = hub.querySelector('.hub__shots');
    if (!track || !PHONE_R) return;
    const shots = [...track.children];
    if (shots.length < 2) return;
    const features = document.createElement('section');
    features.id = 'family-hub-features';
    features.className = 'hub hub--features hub--track-on';
    features.setAttribute('aria-label', 'Nestify Family Hub features');
    const link = document.createElement('a');
    link.className = 'hub__feature-link';
    link.href = '/device';
    link.innerHTML = 'Explore Nestify Family Hub <span aria-hidden="true">↗</span>';
    track.classList.add('hub__carousel');
    track.setAttribute('aria-label', 'Family Hub cards');
    track.setAttribute('data-lenis-prevent', '');
    track.tabIndex = 0;
    shots.forEach((li, i) => {
      li.classList.add('hub__feature-card');
      li.dataset.room = String(FEATURE_ROOM_ORDER[i]);
      const screen = document.createElement('div');
      screen.className = 'hub__feature-screen';
      while (li.firstChild) screen.appendChild(li.firstChild);
      const title = document.createElement('h3');
      title.className = 'hub__feature-title';
      title.textContent = titleLines[i].textContent.trim();
      li.append(title, screen);
      li.setAttribute('aria-label', `${i + 1} of ${shots.length}: ${title.textContent}`);
    });
    const nav = document.createElement('div');
    nav.className = 'hub__feature-nav';
    [-1, 1].forEach(dir => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hub__deck-arrow';
      button.dataset.dir = String(dir);
      button.setAttribute('aria-label', dir < 0 ? 'Previous Family Hub card' : 'Next Family Hub card');
      button.setAttribute('aria-controls', track.id);
      button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir < 0 ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'}"/></svg>`;
      nav.append(button);
    });
    features.append(link, track, nav);
    hub.after(features);
    hub.querySelector('.hub__mobile-controls')?.remove();
    hub.querySelector('.hub__mobile-dots')?.remove();
    titleLines.forEach(line => {
      const on = line.classList.contains('is-meet');
      line.classList.toggle('is-on', on);
      line.setAttribute('aria-hidden', String(!on));
    });
    const arrows = [...nav.children];
    const step = () => shots[1].offsetLeft - shots[0].offsetLeft;
    let cur = -1;
    let armed = false;
    // Animate only the visible first card's small edge overlay. No additional
    // WebGL context or full UI runtime is needed for this colour movement.
    const glow = document.createElement('canvas');
    glow.className = 'hub__feature-glow';
    glow.setAttribute('aria-hidden', 'true');
    const thinkingScreen = shots[0].querySelector('.hub__feature-screen');
    const shade = document.createElement('div');
    shade.className = 'hub__thinking-shade';
    shade.setAttribute('aria-hidden', 'true');
    const badge = document.createElement('div');
    badge.className = 'hub__thinking-badge';
    badge.innerHTML = 'Working on it <span aria-hidden="true"><i></i><i></i><i></i></span>';
    thinkingScreen.append(shade, glow, badge);
    const glowContext = glow.getContext('2d');
    let glowRAF = 0, glowLast = 0, glowStart = 0;
    function paintGlow(now) {
      glowRAF = requestAnimationFrame(paintGlow);
      if (now - glowLast < 1000 / 24) return;
      glowLast = now;
      const ctx = glowContext;
      ctx.clearRect(0, 0, 640, 360);
      const gradient = ctx.createConicGradient((now % 4200) / 4200 * Math.PI * 2, 320, 180);
      [[0,'#58b8ff'],[.16,'#8e83ef'],[.32,'#e984d9'],[.48,'#ffb775'],[.64,'#f4db77'],[.80,'#71d8b8'],[1,'#58b8ff']]
        .forEach(([offset, color]) => gradient.addColorStop(offset, color));
      ctx.strokeStyle = gradient;
      // Nested translucent strokes soften the inward edge without a large blur layer.
      const appear = clamp((now - glowStart - 450) / 700);
      ctx.beginPath();
      ctx.roundRect(0, 0, 640, 360, 10);
      for (let width = 48; width >= 4; width -= 4) {
        ctx.lineWidth = width;
        ctx.globalAlpha = .11 * appear;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    function syncGlow() {
      const on = armed && cur === 0 && !REDUCED && glowContext?.createConicGradient;
      if (on && !glowRAF) {
        glow.width = 640; glow.height = 360;
        glowStart = performance.now();
        glowRAF = requestAnimationFrame(paintGlow);
      } else if (!on) {
        cancelAnimationFrame(glowRAF); glowRAF = 0;
        if (glow.width !== 1) { glow.width = 1; glow.height = 1; }
      }
    }

    /* Rewards 素材循环播放，但只在当前屏幕解码。fetch 只预热字节；进入时
       创建新的 Blob URL 从第 0 帧开始循环，离开时清掉 src 并释放 URL。 */
    const replayImgs = shots.map(li => li.querySelector('.v--replay'));
    const replayBlobs = replayImgs.map(img => {
      if (!img) return null;
      return fetch(img.dataset.replaySrc, { cache: 'force-cache' })
        .then(r => {
          if (!r.ok) throw new Error('replay image ' + r.status);
          return r.blob();
        })
        .catch(() => null);
    });
    let replayTicket = 0;

    function showReplay(index) {
      const ticket = ++replayTicket;
      replayImgs.forEach(img => {
        if (!img) return;
        img.classList.remove('is-replaying');
        img.removeAttribute('src');
        if (img._hubReplayUrl) {
          URL.revokeObjectURL(img._hubReplayUrl);
          img._hubReplayUrl = '';
        }
      });
      const img = replayImgs[index];
      const pending = replayBlobs[index];
      if (!img || !pending || REDUCED) return;
      pending.then(blob => {
        if (ticket !== replayTicket || !armed || cur !== index) return;
        const url = blob
          ? URL.createObjectURL(blob)
          : img.dataset.replaySrc + '#replay-' + ticket;
        if (blob) img._hubReplayUrl = url;
        img.onload = () => {
          if (ticket === replayTicket && armed && cur === index) {
            img.classList.add('is-replaying');
          }
        };
        img.src = url;
      });
    }


    function apply() {
      const stride = step();
      if (!(stride > 0)) return;
      const index = Math.max(0, Math.min(shots.length - 1, Math.round(track.scrollLeft / stride)));
      const max = track.scrollWidth - track.clientWidth;
      arrows[0].disabled = track.scrollLeft <= 2;
      arrows[1].disabled = track.scrollLeft >= max - 2;
      shots.forEach((li, i) => li.classList.toggle('is-current', armed && i === index));
      const changed = cur !== index;
      cur = index;
      syncGlow();
      if (!changed) return;
      showReplay(armed ? index : -1);
    }
    // A finite animation avoids WebKit dropping repeated native smooth-scroll calls.
    let moveRAF = 0;
    let targetIndex = null;
    function cancelMove() {
      cancelAnimationFrame(moveRAF);
      moveRAF = 0;
      targetIndex = null;
      track.style.scrollSnapType = '';
    }
    function moveTo(index) {
      cancelMove();
      targetIndex = Math.max(0, Math.min(shots.length - 1, index));
      const from = track.scrollLeft;
      const to = Math.min(track.scrollWidth - track.clientWidth, targetIndex * step());
      if (REDUCED) { track.scrollLeft = to; cancelMove(); apply(); return; }
      track.style.scrollSnapType = 'none';
      const start = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - start) / 550);
        track.scrollLeft = from + (to - from) * (1 - Math.pow(1 - t, 3));
        if (t < 1) moveRAF = requestAnimationFrame(frame);
        else { cancelMove(); apply(); }
      }
      moveRAF = requestAnimationFrame(frame);
    }
    arrows.forEach(button => button.addEventListener('click', () => {
      moveTo((targetIndex ?? Math.round(track.scrollLeft / step())) + Number(button.dataset.dir));
    }));
    track.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      moveTo((targetIndex ?? cur) + (e.key === 'ArrowLeft' ? -1 : 1));
    });
    track.addEventListener('pointerdown', cancelMove, { passive: true });
    track.addEventListener('touchstart', cancelMove, { passive: true });
    track.addEventListener('wheel', cancelMove, { passive: true });
    track.addEventListener('scroll', apply, { passive: true });
    addEventListener('resize', () => { cancelMove(); apply(); });
    let intersecting = false;
    function syncVisibility() {
      armed = intersecting && !document.hidden;
      if (!armed) cancelMove();
      cur = -1;
      apply();
    }
    new IntersectionObserver(entries => {
      intersecting = entries[0].isIntersecting;
      syncVisibility();
    }).observe(features);
    document.addEventListener('visibilitychange', syncVisibility);
    apply();
  })();

  /* the state hub.css and hub3d.js both read, written once at boot so
     neither of them has to guess what a missing attribute means */
  hub.dataset.room = String(room);


  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const p = progress();
      /* 🔴 「读者走到哪了」一律用 rawP，不用 p。p 在前奏期恒等于 DOCK(0.62)，
         那是给画面用的假身份：拿它判会让 storyArmed 在页面刚加载时就武装好，
         并且让下面的出口判断在**整个前奏里恒成立**——落点又正好在前奏之后，
         于是弹过去、再往回滚、再弹回来，原地锁死。用户实测：hub 的房间段和
         privacy 段往回滚，都会被弹到 7987 动不了。 */
      /* 🔴 读者还没走到 hub 之前，整个舞台不可见。

         舞台是 sticky 的：钉住之前它就在视口下方，**跟着滚动往上顶**。而 hub
         排在 intro 后面，同层级下后面的段落画在上面——于是 intro 好不容易在原地
         渐显出来的那面墙，被 hub 自己那面一模一样的墙从底下拉上来盖住了。用户
         2026-09-04：「为什么这个背景滚动两次啊？就不要有一个图片从下往上拉的
         效果」。跟着上顶的还有真机，所以那一段其实是**两台设备两面墙**。

         用 visibility 而不是 opacity/display：
           · display:none 会把布局抽掉，而 intro.js 正是靠量 .hub__screen 的矩形
             决定翻卡落点（heroInnerTarget），抽掉布局落点就没了；
           · opacity 有 1.1s 过渡，切换时会看见淡入；visibility 是硬切，而硬切
             正是这里要的——交接那一帧两面墙同图同位，换过去看不出来。

         提前 8px 打开：intro 撤自己那层和 hub 亮起来是两个 rAF 回调，可能差一帧。
         差在「都没有」那一侧会闪一下米色底；差在「都有」那一侧只是墙错开 8px，
         看不出来。所以宁可早开。 */
      hub.classList.toggle('is-entered', PHONE_R || window.scrollY >= hubOrigin() - 8);

      const rawP = rawProgress();
      if (rawP > 0.08) storyArmed = true;
      if (rawP < 0.005) {
        storyArmed = false;
        skippingUp = false;
      }

      /* 🔴 方向必须从**真实滚动位置**判，不能再从 p 判。
         前奏（房间 1）期间 legacy p 恒等于 DOCK，走完前奏那一刻它断崖式掉到
         0 —— 那正是「脱墙、模型飞进 app」这一下，而读者是**往下**滚出来的。
         用 p 判方向会把它读成「在往回滚」，于是下面的 jumpHomeExit 把人一把
         甩到 yAt(EXIT_P)。实测（改前）：从 intro 往下滚三格，人被扔到 7987，
         再一路失控滑到 22482（hub 段末尾）。 */
      const goingUp = window.scrollY < lastScrollY - 1;
      lastScrollY = window.scrollY;
      /* 🔴 只有读者**真的还在这一段里**才允许跳。rawP 对段尾以下的一切都
         clamp 成 1，所以光看 rawP，站在 hero / privacy 里往回滚一下也满足条件
         ——结果是从页尾被一把传送进 hub，中间的 meet 和 hero 整个被跳过。
         改版前 hub 是最后一个内容段，"往回滚就跳回本段开头"因此一直没露馅；
         现在它后面还隔着两段，这个前提没了。 */
      const inHub = window.scrollY >= hubOrigin()
        && window.scrollY < hub.offsetTop + hub.offsetHeight - window.innerHeight;
      /* 手机端五屏现在由纵向位置双向驱动，回滑必须能逐屏返回；桌面才保留原有的
         快速回到 Home 出口。 */
      if (!PHONE_R && inHub && goingUp && storyArmed && !skippingUp && rawP > EXIT_P + 0.008) {
        lastP = p;
        jumpHomeExit();
        return;
      }
      if (!goingUp) skippingUp = false;
      lastP = p;

      hub.classList.toggle('is-lit', p > HEAD_IN);

      /* 🔴 标题比 pad 先亮，这是第一句的特例。
         `is-lit` 绑在 p > HEAD_IN 上，而入场期里 p 恒为 0（见 hubOrigin 上方
         那段：meet 的飞越没走完之前 demo 一拍都不许走），那一段有 3 个多视口
         长。于是第一句「Everything that matters today.」要等整段交接结束才亮，
         读起来就是「我得先滑一会儿它才出现」（用户 2026-08-31，两次）。

         所以标题改由 meet 的飞越进度点亮：f 过 .42 时 hub 这块已经在淡入了
         （.hub__wrap 的 opacity 就是 --meet-fly），标题跟着一起到。实测把
         起亮点从 y≈+3000 提前到 y≈+1350，亮满从 +3300 提前到 +2100。

         🔴 只解耦标题，不解耦 pad。`is-lit` 同时在 gate pad 的入场，而那是
         专门修过的——在 stage 还在上滑时就显示 pad，会看见它「被抬上来」而不
         是「已经在那儿」。两者各用各的闸。

         ⚠️ 这条 2026-08-31 被我用 `git checkout origin/main -- hub.js` 整文件
         覆盖时丢过一次，用户立刻就察觉「又有点慢」。回退 hub 的实现时，这一条
         和 hub.css 里配套的 `.hub.is-head-lit .hub__title` 要一起带上。 */
      const mf = window.__meetFly;
      /* 🔴 `|| !docked` 是补前奏出口那道缝的。

         前奏结束的一瞬 p 从 DOCK 断崖式掉到 ~0（见 progress() 的重映射），而
         is-lit / is-head-lit 的门槛是 HEAD_IN=0.0071——换算约 95px 滚动。那段
         里 docked 已经false（标题不再被 .hub.is-docked 藏住）、head-lit 又还
         没到，于是标题**整个空掉**，等越过门槛才回来。用户 2026-09-04：
         「为什么 Meet Nestify 这个文字它要闪一下？」实测 y=5200 处 intro 和
         hub 两边的不透明度同时为 0。

         没动 HEAD_IN 本身：它还管着别的（--meet-fly 那条入场判据）。这里只补
         「没停靠就该亮」这一条——停靠态由 .hub.is-docked 的规则继续压住，
         thesis 那一拍由 .hub.is-slot-busy 压住，两者都排在后面，不受影响。 */
      /* ⚠️ 用 `p >= DOCK` 而不是下面那个 `docked` 变量：那一行还在下面，
         引用它是 TDZ（实测直接抛 "Cannot access 'docked' before
         initialization"，整个 hub 的滚动回调死掉）。 */
      hub.classList.toggle('is-head-lit',
        p > HEAD_IN || p < DOCK || (mf != null && mf >= 0.42));

      // Phones keep the device on the wall throughout the feature tour.
      // Desktop progress resets after the prologue, briefly clearing this
      // class and fading out the entire room if used for the phone handoff.
      const docked = PHONE_R || p >= DOCK;
      hub.classList.toggle('is-docked', docked);

      /* 🔴 同一块涂层，两幕两个颜色。

           intro 转场 + hub 巡览   橄榄绿 —— 用户要 Meet Nestify 那里保持原样
           段尾 One screen.        棕红   —— 「第一幕变成那种比较棕红色的感觉」

         两幕的 data-room 都是 1，靠房间号分不开（用户：「这两个东西能不能不要
         连接在一起呀？就改了下面上面也改」），所以按**幕**换 albedo。
         `p >= DOCK` 正是「机器回到墙上、进入 One screen. 那几屏」的判据，和上面
         那行 is-docked 用的是同一个。 */
      /* 🔴 光看 `docked` 不够：前奏期 progress() **恒等于 DOCK**，于是 intro 的
         Meet Nestify 那一幕也被算成了段尾，两处又一起变成棕红（实测踩到）。
         真正的判据要排掉前奏和 intro 提前钉住的那段。 */
      if (window.hub3d && window.hub3d.setCoatTint) {
        const introRoom = inPrologue() || hub.classList.contains('is-early');
        const desktopFinish = docked && !introRoom;
        if (PHONE_R) {
          window.hub3d.setCoatTint(introRoom ? 0x9aa66e : ROOM_TINTS[room], true);
        } else {
          window.hub3d.setCoatTint(desktopFinish ? 0x9c5f45 : 0x9aa66e);
        }
      }

      /* the wall, on the same p as everything else — see the block above */
      syncRooms(p, docked);

      /* 🔴 前奏：标题停在第 0 句、屏幕停在 home|think，两样都不走拍子机器。

         不拦的话 beatFromHubP(DOCK) 会返回**最后一拍**（p 恒等于 DOCK），于是
         前奏里显示的是 "The household, handled together." ——以前看不出来是因为
         标题在 docked 态被藏着，现在前奏要亮标题，就露出来了。

         点的是**第 5 句**（Meet / Nestify），那是 intro 落地时那句的副本；走出
         前奏之后拍子机器接管，第 0 拍换成 "Everything that matters today."。

         cur = -1 是为了让 applyBeat 在走出前奏时重新应用第 1 拍；它有个
         `if (i === cur) return` 的短路，不清掉就会以为已经在那一拍了。 */
      const pro = inPrologue();
      hub.classList.toggle('is-prologue', pro);

      /* 🔴 停靠态那块屏是 **3D 的一张贴图**，不是 .hub__screen 里的 iframe——
         3D 模式下 .hub__screen 整层不参与绘制（实测：往里塞 z-index:999 的纯红
         块，画面纹丝不动）。所以「机器上显示什么」这件事只能通过换贴图来做，
         hub3d 为此开了 setScreen。

         这一段（intro 提前钉住 + hub 前奏）显示 home|think，也就是
         "Working on it" 那一屏——它是原第 0 拍的画面，现在归 intro 的转场演。
         走出前奏就换回默认，因为段尾那几屏（"One screen."）要的是 hub3d 注释
         里说的「demo 结束时的画面」。 */
      const wantEarly = pro || hub.classList.contains('is-early');
      if (wantEarly !== screenIsEarly && window.hub3d && window.hub3d.setScreen) {
        screenIsEarly = wantEarly;
        /* 第二个参数 = 要不要动。贴上墙的这一段那三个点得转起来（用户：
           「翻卡的过程可以静止，但放到墙上以后就得动起来」）；段尾那张是静的。 */
        /* 🔴 两幕现在用**同一张**贴图：assets/device/device1.webp，也就是段尾
           「One screen.」那台机器上一直在用的那张日历周视图。

           这一条来回改过三次，都留着免得又绕回去：
             ① still-home-think（Home 面板 + "Working on it" 药丸）
                → 用户：不要 working on it，要边缘在转的那种感觉
             ② still-home-idle（干净的 Home 面板）+ 边缘彩条
                → 用户：彩条暂时不要了，保持一张单独的卡片
             ③ device1.webp ← 现在
                → 用户 2026-09-04：「你可以用回这张 UI 图吗？就是最原始的那张，
                  实际上就是那个 one screen 用的那张图。我感觉现在用的这个
                  Nestify 这个图不太好看。」

           所以 setScreen 的第一个参数两幕相同，留着这个三元只是为了以后再分幕
           时有个明显的挂点。第二个参数 = 边缘彩条开关，见下面 GLOW_ON。

           🔴 GLOW_ON = false：彩条整套实现原样留着（hub3d 的 paintGlow /
           setUiFade，颜色是从原版辉光上逐点量的），要开回来改这一个布尔值。
           关掉时 setScreen 会 stopLive()，每帧重绘的 rAF 循环一并停掉，不空转。 */
        const GLOW_ON = false;
        window.hub3d.setScreen(wantEarly
          ? 'assets/device/device1.webp'
          : 'assets/device/device1.webp', wantEarly && GLOW_ON);
      }
      /* 🔴 还没走到这一段时也要停在第 0 句。beatFromHubP(p) 在 p >= DOCK 时返回
         **最后一拍**（段尾那几屏本该如此），而读者还在 intro 里时 p 恒等于
         DOCK，于是 is-on 停在 "The household, handled together." 上。平时看不见
         （docked 态标题是透明的），但前奏一亮标题就会从第 4 句闪切到第 0 句。
         类只在 pro 时加（它带 300px 提前量，负责交叉淡入），点句子的范围要更宽。 */
      const preHub = window.scrollY < hubOrigin();
      if (pro || preHub) {
        /* 手机版 lights-up 定格必须让第一层 coat 实际处于可见状态；room 0 会把
           coat 全关掉、露出蓝色原生框，即使 setCoatTint 已写绿色也看不见。 */
        if (PHONE_R) showRoom(1);
        disarmSettle();
        showLine(5);   /* 前奏接住 intro 的落地句，见 index.html 索引 5 那条 */
        /* 令还是发——哪天实时应用认了就自然生效。 */
        tellToken('home|think');
        cur = -1;
      } else if (skippingUp) {
        disarmSettle();
        holdHome();
      } else {
        const i = beatFromHubP(p);
        if (!beats[i] || !beats[i].settle) disarmSettle();
        applyBeat(i);

        /* 共用底部进度条：这一段分五格，一拍一格（beats 就是那五句标题）。
           停靠之后（"One screen."那一屏）五格全满——那是这一段走完了的样子，
           而不是没有进度。这一段原本手机上**什么指示都没有**，是三段里唯一
           缺的一块，用户要的连续感断在这里。 */
        /* 同 meet：只有舞台盖住视口中线时才接管，否则会在接缝处把还在放片子的
           那一段抢掉。三段共用这一条规则。 */
        const _sr = stage ? stage.getBoundingClientRect() : null;
        const _mid = innerHeight / 2;

        const local = docked ? 1 : clamp(p / DOCK);
        const beat = beats[i];
        if (docked) {
          placeFly('', { show: false, t: 0 });
          /* assert the docked state. A flick can jump a scroll sample from
             before the meals handover straight past DOCK — applyBeat then
             sends 'meals|play' and nothing below would ever correct it.
             lastTold dedupes, so this costs one message, not one a frame.

             🔴 上游这一格原本还带着 `else if (run) … startRun(i)` 的分支链，
             那是**旧的时间轴**实现（进一个 stage 就播 1500ms rAF）。本文件
             已经把飞行改成随滚动的 scrub（见「the flight runs on the wheel」
             那段），run / pending / spent 三个变量在这一版里都不存在，照搬
             进来就是 ReferenceError。所以只取这句停靠断言。 */
          tellToken('home|idle');
        } else {
          /* 🔴 THE SETTLE IS DECIDED BEFORE THE CARDS ARE PLACED, and the
             order is load-bearing. flyStateAt reads `released`, so deciding
             afterwards placed one frame with the previous answer — and on
             the way back up that frame is the LAST one, because disarming
             does not itself produce a scroll event to correct it. The cards
             stayed gone until the reader moved again. */
          if (beat.settle) {
            /* armed by the LANDING, not by a scroll position: sp.split is
               where the last card is home. Everything after that is on the
               settle's own clock — see armSettle. */
            if (local >= span[i].split) armSettle(beat.then);
            else { disarmSettle(); tellToken(beat.tab + '|' + beat.phase); }
          } else {
            /* every other stage hands over on scroll, flying or not: `meals`
               has no cards to time against, so its split is where it says it
               is. Stated both ways rather than fired once at the crossing, so
               scrolling back up puts the stage back instead of leaving the
               app in the state the reader has just left. */
            tellToken(beat.then && local >= span[i].hand
              ? beat.then
              : beat.tab + '|' + beat.phase);
          }

          /* the cards are wherever this scroll says they are. A stage with
             no cards draws none; one that has them and has held them long
             enough past the landing lets them go — see FLY_HOLD. */
          const fly = beat.phase === 'fly' ? flyStateAt(i, local) : null;
          if (fly && fly.show) placeFly(beat.tab, fly);
          else placeFly('', { show: false, t: 1 });
        }
        placeOrnaments(i, local, docked);
      }

      if (thesisTl) {
        if (p > THESIS_AT) {
          hub.classList.add('is-slot-busy');
          thesis.classList.remove('is-hushed');
          thesisTl.timeScale(1).play();
          if (thesisTl.progress() > 0.999) thesisDone = true;
        } else if (thesisDone) {
          /* 🔴 出现过之后**不再倒放逐字**，整块淡出就好。

             倒放是这条时间线原本的退场：timeScale(2.5).reverse()，字符带着
             `yPercent: 26` 逐个退回去。往下滑时看不出问题，往回滑时它就是一场
             缓慢的逐字下坠——两行字在各自的 stagger 里错开高度，视觉上压成一团。
             用户 2026-09-04：「往回滑的时候，这些字就慢慢的全部叠在一起了……
             出现过的字就不要再用这种效果了。」

             所以只对**第一次**保留倒放（那时字还没真正出现过，倒放是它正确的
             撤销）；跑满一次之后就上锁，此后进出只改整块的 opacity，字符一律
             停在原位。 */
          thesis.classList.add('is-hushed');
          hub.classList.remove('is-slot-busy');
        } else if (thesisTl.progress() > 0) {
          thesisTl.timeScale(2.5).reverse();
        }
      } else if (thesis) {
        thesis.classList.toggle('is-on', p > THESIS_AT);
        hub.classList.toggle('is-slot-busy', p > THESIS_AT);
      }
      if (cta) cta.classList.toggle('is-on', p > CTA_AT);
      measurePad();
    });
  }

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { sizePad(); onScroll(); });
  if (pad) pad.addEventListener('transitionend', measurePad);

  applyBeat(0);
  onScroll();
})();
