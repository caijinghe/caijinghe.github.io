/* ============================================================
   MEET NESTIE — 小鸟，和它一个词一个词递出来的卡。

   🔴 数值不是设计出来的，是扒出来的。卡片的位置/旋转/景深/透明度/
   模糊、场景漂移的两段 rotateZ、以及飞越时每张卡的 scale+rotate+
   translate 终点，全部取自豆包官网 about_page 那个 chunk 里的原值
   （tW / tS / tP 三个表）。照抄的理由是那套构图已经在真机上调平过，
   自己重推一遍只会得到一个更差的版本。换成 Nestify 自己的图和文案，
   骨架不动。

   🔴 滚动不直接等于进度。scrollY 只当「目标」，真正驱动画面的是一个
   带阻尼的播放头 cur —— 每帧朝目标靠拢一点，并且用 MAX_STEP 限死单帧
   最大推进量。所以猛滑一下不会一步跨过去，而是把动画往前推、让它按
   自己的速度接着播完。这是在 Lenis 之上再加一层：Lenis 治的是滚轮的
   动量尾巴，这里治的是「一段滚动距离里塞了几个词」。

   🔴 进度是段内相对量，不是页面绝对量。-rect.top / innerHeight 正好
   等于「已经滚进这一段几个视口高」，和下面时间轴的单位是同一个，所以
   常量可以直接读成视口高。用页面 scrollY 的话，上面 hero 改一次高度
   这一段就全错位。
   ============================================================ */
(function () {
  const section = document.getElementById('meet-nestie');
  if (!section) return;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ 缓动 ============ */
  const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutSine = t => Math.sin((t * Math.PI) / 2);
  const easeOutBack = t => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const norm = (v, a, b) => clamp((v - a) / (b - a), 0, 1);

  function cubicBezier(x1, y1, x2, y2) {
    const A = (a, b) => 1 - 3 * b + 3 * a;
    const B = (a, b) => 3 * b - 6 * a;
    const C = a => 3 * a;
    const calc = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const slope = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const d = slope(t, x1, x2);
        if (d === 0) break;
        t -= (calc(t, x1, x2) - x) / d;
      }
      return calc(t, y1, y2);
    };
  }
  const flyEase = cubicBezier(0.33, 0, 0.67, 1);      // 豆包卡片飞越用的曲线
  const settleEase = cubicBezier(0.22, 1, 0.36, 1);   // 卡片从小鸟飞出后的落位

  /* ============ 时间轴（单位：视口高） ============
     0.00–0.22  hero 末屏那支片子收圆、抬到小鸟位、缩成头那么大
     0.13–0.24  小鸟接手（和上一条重叠 = 交叉溶解，不是先走后来）
     0.10–0.32  Nestie 说的那句话飞出来，亮一下再暗回背景
     0.20–0.32  MEET NESTIE 淡入
     0.34 起    每 0.62 出一个词 + 它的两张卡，共五段
     0.30–0.78  小鸟退场，文案整块上移补位
     3.34–3.64  全部卡片转清晰（对应豆包的 opening.clear）
     3.64–4.64  冲向镜头的飞越，交给 Family Hub
  =================================================== */
  /* 🔴 收摊要能被**外部**调用，不能只写在 apply() 里。这一段的 rAF 循环由
     IntersectionObserver 管起停：滚出视野后 apply() 根本不再跑，于是接力层
     会连同"hero 的 film 已被藏起来"这个副作用一起冻在半路——实测就是首屏
     加载时 apply() 拿着一个还没定过的 S 跑了一遍，把 hero 的 film 藏了，
     然后段落不在视野里、循环不转，那个 0 就再也没人擦掉。
     恢复也刻意不看 relaying 标志：卡住的状态必须能自己走出来。 */
  /* 🔴 把飞越进度播给 hub。它是 --meet-fly，0=卡片还清晰，1=糊到底。
     hub 的 pad 直接用这个数做 opacity/blur，于是"卡片糊"和"hub 出现"是
     **同一个数**，不可能对不齐。

     为什么必须这样而不能让 hub 自己按滚动位置算：这一段的播放头 S 是带
     阻尼且限速的（见文件头），真滚起来它落后原始滚动**将近 1.2 屏**——
     实测连续滚到 y=22836 时 hub 已经亮到 0.1，而卡片 blur 还是 0。两边
     各按各的时钟算，怎么调参都对不上。
     缺省值给 1（见 hub.css）：万一这段脚本没跑（reduced-motion / 报错），
     hub 必须是可见的，不能因为一个过场把主内容藏了。 */
  /* 🔴 声明必须在 setFly 之前：setFly 用到它。原来它在 179 行、setFly 在 96 行，
     虽然函数体要到调用时才求值、实际不会炸，但那是暂时性死区，读代码的人得先
     证明「调用一定晚于声明」才能放心。提上来就不用证明了。 */
  const PHONE_W = matchMedia('(max-width: 767px)').matches;

  /* 🔴 手机上恒发 1（用户 2026-08-30：「family hub 刚滑到的时候是空白的」）。

     --meet-fly 是给桌面那套「卡片冲镜头、hub 从模糊里长出来」用的：hub 压着
     meet 重叠，靠这个数控制淡入与冻结。手机上两段已经不重叠了（--hub-overlap
     = 0），这个耦合没有存在的理由，而且**它会坏事**：

     手机改自动播之后，播放头由时间驱动。读者要是在 17 秒播完之前就划过
     meet，S 永远到不了 FLY_B，f 恒为 0，于是 .hub__stage 的 opacity 恒为 0
     ——hub 整段全透明，就是那个空白。桌面不会有这个问题，因为那边滚动本身
     就是驱动，划过去等于播完。

     恒 1 同时修掉第二处：hub.js 的 hubOrigin() 也读 __meetFly 来决定「入场期
     不吃滚动」，f < 1 时会把原点夹住。 */
  const setFly = v => {
    /* 🔴 恒为 1。飞越那一拍两端都不播了（见 END），v 因此永远到不了 1；而
       hub 那边把 `--meet-fly` 当「卡片糊完没有」的信号用，读到 0 会以为 meet
       还在飞。手机上本来就写死 1（那边更早砍掉飞越），现在两端一致。 */
    const out = 1;
    document.documentElement.style.setProperty('--meet-fly', out.toFixed(3));
    window.__meetFly = out;   // hub.js 读它决定 demo 冻不冻（CSS var 每帧 getComputedStyle 太贵）
  };

  function relayOff(handBackToHero) {
    if (!relay || !heroInner) return;
    if (relaying) {
      relaying = false;
      /* 🔴 交还播放头。往下走时是 hero → relay（见下面 relaying 的入口），
         往回滚就是反过来——不还回去的话，hero 的片子会从它自己停住的那一帧
         接上，而观众刚看到的是 relay 那一帧，接缝处画面跳一下。 */
      if (handBackToHero && heroVid) {
        try { heroVid.currentTime = relayVid.currentTime; } catch (e) {}
      }
      try { relayVid.pause(); } catch (e) {}
    }
    if (relay.style.opacity !== '0') relay.style.opacity = '0';
    if (heroInner.style.opacity !== '') heroInner.style.opacity = '';
    if (heroCopy && heroCopy.style.opacity !== '') heroCopy.style.opacity = '';
    if (heroRail && heroRail.style.opacity !== '') heroRail.style.opacity = '';
  }

  /* 接力窗口。-1.15 是量出来的：hero 的 film 一直钉在 y=90，到 meet 顶
     上方 1000px（S≈-1.11）才开始往上走。在它开始"被滚走"之前接手，
     观感才是"片子飞过去了"而不是"片子滚没了、另一个东西冒出来"。 */
  /* 🔴 -1.0（曾是 -1.15、又改过 -1.5），现在这个值有**两个**硬约束，不是配出来的：

     ① 它必须正好等于 hero 最后一个锚点。实测 1440×900：hero 轨 8100..18000
        （四屏，锚点 8100/11400/14700/18000），meet 顶 18900 —— 于是
        rawS = -1.0 恰好是 18000。接力窗口因此正好落在 hero **撒手之后**：
        hero.js 的 settle 门在 `owned = onScreen && stagePinned()`，而钉住只到
        18000。往前挪一格（比如 -1.5 = 17550）就把窗口塞进 hero 还攥着的区间，
        两套 settle 会对着同一个 scrollTop 各拉各的。
     ② 不能更晚：hero 的 film 钉在 y=90，要到 rawS≈-1.11 才开始往上走。
        在它开始「被滚走」之前接手，观感才是「片子飞过去了」。-1.0 是这两条
        之间唯一的解。

     之前为了「别让一次轻扫就过完」把窗口拉宽到 1.6 屏，那个理由现在没了 ——
     下面的 snap 让这一段的时长由 glide 决定，跟读者滑了多远无关。 */
  /* Meet now has a visual gap above it. Keep the relay's first frame at the
     gallery's final anchor by including that gap in the start offset. */
  let RELAY_A = -1.0;
  const RELAY_B = 0.10;
  /* No film hands into the bird now. On desktop it grows in while the Meet
     stage itself rises through the viewport: the first visible edge carries
     a tiny Nestie, and it reaches full size shortly before the stage pins. */
  const BIRD_IN_A = PHONE_W ? -0.32 : -0.55;
  const BIRD_IN_B = PHONE_W ? -0.12 : -0.08;

  /* 🔴 开场改成豆包 about 页的结构（用户 2026-08-28 指了那一页）：
     小鸟站正中说一句话 → 所有卡片**一起**在各自的家位出现（清晰）→ 整体沉入
     背景层 → 之后每个词只是**点亮**它那两张。
     旧结构是每个词把两张卡从小鸟身上"飞"出来，所以每出一个词就是一次大位移
     ——用户说"有点重、太快了"，重的正是这个飞行本身，不是时长。 */
  /* 🔴 顺序是：小鸟 → 气泡说话 → **气泡消失** → 卡片铺开 → 小鸟飞到顶上
     → 五个词（用户 2026-08-28 口述，第二版）。

     这一版推翻了前一版的「卡片紧跟小鸟、气泡最后说话」。那一版的理由是豆包
     about 页里角色和卡片同时在场，所以卡片不该是气泡之后的一个节拍——理由
     本身没错，但用户要的是另一件事：**开场先只有小鸟和它那句自我介绍**，一
     句话说完、气泡收掉，画面干净了，卡片才铺开。所以这里现在是四拍，不是
     三拍，而且新增的那一拍是**气泡退场**——上一版里气泡从来不单独消失，它
     一直挂着，直到 SINK 时跟着小鸟一起飞走。

     🔴 每两拍之间都要留空，否则读成"同时发生"。这一段的教训值一条注释：曾
     经气泡 0.45 收、卡片 0.50 起，只隔 0.05 屏 ≈ 45px 滚动，任何真实滑动速
     度下都是一帧的事。现在每个间隔至少 0.10 屏，气泡说完还额外站 0.34 屏
     （≈300px）让人读得完那五个字。

     ⚠️ 改这里会改整段的长度：WORD_START 往后推多少，CLEAR/FLY/END 和
     --meet-h 就跟着推多少（见 resize()）。它们全是从 WORD_START 算出来的，
     不用手动跟。 */
  /* 🔴 手机上这四拍**合成一拍**（2026-09-05）。用户：「meet nestie 一开始能不能
     就是 hi 我是 nestie、然后周围已经有卡片了，就是把前两步骤合并了，不然拉
     下来一开始是空白的」。

     上面那两段注释记的是**桌面**的编排，它整个立在一个前提上：这一段有一屏多
     的「接力」垫在前面（RELAY_A = -1.0，那支从 deck 飞过来的片子），读者进场
     时画面是满的，所以开场可以慢慢来——先只有小鸟，再开口，再收，再铺卡片。

     手机上那个前提没了：deck 横过来之后接力整套关掉（见 RELAY_OFF），进场那
     一屏本来就是空的，再让开场铺满 2.40 屏，读者就是「拉拉拉、什么都没有」。

     所以手机的编排是：小鸟、气泡、卡片**一起**到（0.02–0.28），然后一起站住
     0.34 屏让人读完那句话，再按原顺序收气泡、沉卡片。桌面一个数都没动。

     ⚠️ 这一版有意推翻上面那条「每两拍之间都要留空，否则读成"同时发生"」——
     那条的目的是让四拍各自可辨，而用户要的正是**同时发生**。它对桌面仍然
     成立，所以那段注释留着，不是过时的。 */
  const BUBBLE_A   = PHONE_W ? -0.28 : 0.22, BUBBLE_B   = PHONE_W ? -0.06 : 0.46;
  /* 说完站 0.34 屏，再收掉——收掉之后画面上只剩小鸟，卡片还没来 */
  const BUB_OUT_A  = PHONE_W ? 0.62 : 0.80, BUB_OUT_B  = PHONE_W ? 0.78 : 0.98;
  /* 🔴 1.24，不是 1.08。气泡 0.98 收干净、卡片 1.08 起，中间只有 0.10 屏 =
     90px：实测在那个位置截图，卡片已经在以 5% 淡入，"气泡没了"和"卡片来了"
     是同一眼看到的两件事。0.26 屏（≈235px）才有一帧真正只剩小鸟的画面，也
     就是用户要的"消失以后再出现"。 */
  /* 手机 0.04：跟气泡同一拍到，就是「一开口周围已经有卡片了」那句要求。
     桌面 1.24 一个数没动，上面那段 0.26 屏的推导仍然是它的理由。 */
  const CARDS_A  = PHONE_W ? -0.26 : 1.24, CARDS_B  = PHONE_W ? 0.00 : 1.60;   // 气泡清干净、空一拍，卡片才铺开
  const SINK_A   = PHONE_W ? 0.92 : 1.95, SINK_B   = PHONE_W ? 1.20 : 2.25;   // 小鸟飞到顶上，卡片沉入背景层
  /* 前奏 2.40 → 1.35 屏，省下来的一屏整是上面那三拍并起来腾出的。
     ⚠️ 下游不用手动跟：CLEAR / FLY / END / --meet-h 全是从这个数现算的。 */
  const WORD_START = PHONE_W ? 1.35 : 2.40;
  /* 🔴 1.25（原 0.62）。用户 2026-08-28：「我往下拉根本看不到卡片是什么东西，
     就一直拉拉拉拉完了」。**扛事的是这个距离，不是下面的限速**——理由写在
     WORD_SPEED 那里，那是我这一轮走过的弯路。 */
  /* 🔴 手机上 0.85（桌面 1.25）。同上——砍的是距离不是节奏：WORD_SPEED
     的限速没动，所以「一个词至少看多久」这件事在两边是一样的，只是手机
     上不用为它滑那么远。段高与 hub 的 overlap 都从这个数现推，跟着变。 */
  /* 🔴 飞越那一拍的模糊，手机上从 50px 砍到 8px（用户 2026-08-30：
     「meet nestie 播完之后手机直接黑屏了，还要重启」）。

     50px 是照桌面配的，而这一拍**同时**有三个满视口的模糊在跑：小鸟、
     整层卡片、文案，外加 hub.css 给 .hub__wrap 的 16px（它正在淡入）、
     12 张卡各自的 scale3d、以及 hub 的 WebGL canvas 正在启动。

     高斯模糊要求合成器分配离屏缓冲，而缓冲边界要按模糊半径向外扩（50px
     半径约扩 3 倍）。三个满视口的这种缓冲叠在同一帧，在 4GB 的手机上就是
     GPU 显存爆掉——**爆的是合成器不是页面**，所以症状是整块屏幕黑掉、要
     重启设备，而不是页面重新加载。

     8px 仍然读得出「糊掉」的意思，缓冲面积却是 50px 的约 1/40。 */
  /* 🔴 手机上是 0，而且 0 的含义是**根本不设 filter**，不是设 blur(0px)——
     后者照样让合成器建一个离屏缓冲，省不下什么。见下面三处的 `if (FLY_BLUR)`。
     飞越在手机上因此只剩「淡出 + 缩放」，糊化没有了。这是拿观感换不崩。 */
  /* 🔴 两端都是 0（用户 2026-08-30：「meet nestie 最后不用模糊到 family hub」）。
     手机上原本就是 0（为止住合成器爆显存），现在桌面也去掉。

     0 的含义是**根本不设 filter**，不是设 blur(0px)——后者照样让合成器建离屏
     缓冲。见下面三处的 `if (FLY_BLUR)` 守卫。

     飞越那一拍因此只剩「冲向镜头 + 淡出」：卡片照常飞、照常淡，只是不再糊。
     留着这个常量而不是把三行删掉，是因为它同时是「要不要建离屏缓冲」的开关，
     哪天想把模糊加回来，改这一个数就够。 */
  const FLY_BLUR = 0;
  /* 🔴 手机 0.65（桌面 1.25 不动）。用户 2026-09-02「meet nestie 那里 mobile
     要滑动好久」。

     这个数当初从 0.62 加到 0.85，是因为「我往下拉根本看不到卡片是什么东西，
     就一直拉拉拉」—— 那时**距离是唯一的保证**：滑过去没有任何东西让你停下。
     现在 snap.js 在每个词的**中点**放了吸附点（见下面 snapAt），一次划动会落
     在那儿，而那正是卡片满亮的位置。保证换了人，距离就不必再兼这份差。

     ⚠️ 0.65 有下限依据：一个词的最短通过时间 = WORD_SPAN ÷ WORD_SPEED(1.0)
     = 0.65 秒，这是限速给的地板，再减就真会一闪而过。 */
  const WORD_SPAN = PHONE_W ? 0.65 : 1.25;
  const WORD_N = 5;

  /* ============================================================
     🔴 手机改成「点选」模型（2026-09-05）。用户：「手机端这个 Meet Nestie
     不要滚动交互了，最后总共就两页……hi nestie 完以后五个词就直接出来了，
     用户点击某一个关键词就点亮哪两张卡片。」

     桌面一个字不动：下面所有 TAP 分支都在 `TAP` 里，而 TAP 恒等于 PHONE_W。

     模型的差别只有一处，其余全部复用：
       滚动版  S 每前进 WORD_SPAN，第 i 个词淡入并把 PAIRS[i] 那两张点亮，
               点亮程度 u 由滚动位置连续给出。
       点选版  过了 WORD_START 五个词**一起**淡入，u 恒为 0（全暗、全在转）；
               点中哪个词，就把那个词的 u 钉在 0.5。
     0.5 不是随手取的：paintCard 里 lit 的窗口是 up(u/0.30) × (1−down(u@0.68..1))，
     满亮区间是 u∈[0.30, 0.68]，0.5 正是它的正中间——离两头各 0.2，所以点亮是
     稳定的满亮，不会卡在爬升或衰减的坡上。

     ⚠️ 时间轴也跟着压：点选版不需要「一个词一段滚动」，那五段 WORD_SPAN 就
     全是白滚。所以 SINK 与 WORD_START 一起提前，END 收到 1.20，段高 2.2 屏
     （见 resize），这才是用户说的"两页"。 */
  const TAP = PHONE_W;
  /* 点选版专用的三个锚点。滚动版的同名常量在上面，两套不共用一个数——
     ⚠️ 别把上面那几个改成这里的值：桌面读的是上面那套。 */
  const TAP_SINK_A = 0.30, TAP_SINK_B = 0.60;
  const TAP_END = 1.20;            // 播放头到此为止，再往下就是段落走完
  /* 当前被点中的词（null = 没有，五张卡全暗）。点第二次同一个词取消。 */
  let tapped = null;

  /* Mobile repeats the complete story: greeting, handoff, five words,
     then a soft return to the greeting. Scroll only controls visibility;
     it never scrubs the story or holds the reader in this section.
     Use elapsed time (capped dt in tick), not a fixed increment per frame,
     so 60 Hz and 120 Hz screens share the same reading pace. */
  const TAP_HELLO_HOLD = 1.45;
  const TAP_HANDOFF = 0.55;
  const TAP_HELLO = TAP_HELLO_HOLD + TAP_HANDOFF;
  /* 🔴 0.42 → 1.0 秒/词（2026-09-05 加"每出一个词就点亮它那两张卡"那次）。
     不是嫌快，是这一拍现在要**装两件事**：词淡入 + 那两张卡亮起来又暗回去。
     paintCard 的满亮窗口是 u∈[0.30, 0.68]，占一步的 38%——0.42 步长下只有
     0.16 秒，卡片刚放大就开始收，读者根本抓不住。1.0 步长给到 0.38 秒的满亮，
     和桌面滚动版一个词的停留量级相当。整轮 5 词 = 5 秒。 */
  const TAP_STEP = 1.0;    // 秒/词
  const TAP_FADE = 0.38;   // 秒：单个词的淡入时长
  const TAP_CYCLE = WORD_N * TAP_STEP;
  const TAP_WORD_EXIT = 0.3;
  const TAP_RETURN_GAP = 0.25; // let the words' .2s CSS opacity transition finish
  const TAP_RETURN = 0.6;
  const TAP_RETURN_AT = TAP_HELLO + TAP_CYCLE + TAP_WORD_EXIT + TAP_RETURN_GAP;
  const TAP_LOOP = TAP_RETURN_AT + TAP_RETURN;
  let playT = 0;
  const CLEAR_A = WORD_START + WORD_N * WORD_SPAN - 0.10;
  const CLEAR_B = CLEAR_A + 0.30;
  /* 🔴 +0.9 屏的**停留**，而且这 0.9 必须在时间轴**里面**，不能挂在 SLACK 上。

     用户 2026-09-04：「滑到 grows 的时候是不是没有阻尼了？一下又滑出去了。」
     ——这一段的「阻尼」是那个限速的播放头（WORD_SPEED），它只在 target() 的
     定义域内起作用，而 target() 被 clamp 到 END。END 停在 CLEAR_B 时，Grows
     一落定播放头就到头了，尾巴那截完全在时间轴之外，等于自由滚，一甩就出去。

     所以把停留放进 END：这 0.9 屏里所有拍子都已经走完、画面不变（卡片仍在转，
     那是 driftFrame 的时间驱动、跟滚动无关），但播放头还在追，段落仍然是「活」
     的。SLACK 同步收回 0.5——它是「播放头补完」的余量，本来就不该兼当停留。 */
  const HOLD = 0.9;
  const END = CLEAR_B + HOLD;
  /* 🔴 起点是 **END**，不是 CLEAR_B ——所以飞越永远不会被播到。

     2026-09-04 加 HOLD 时踩了这个坑：END 从 CLEAR_B 变成 CLEAR_B + 0.9，而
     FLY_A 还停在 CLEAR_B，于是那 0.9 屏正好把播放头推进飞越区间，飞越播了
     0.9/2.2 = 41%——卡片又开始模糊放大。用户 2026-09-04：「最终状态停留在这里
     就好了，不要让卡片飞出去。」

     FLY_A/FLY_B 整套保留而不是删掉：它们仍是 setFly 的定义域和 inFly 的判据，
     也是哪天想把这一拍加回来的挂点。钉在 END 上就等于「永远差一步」。 */
  const FLY_A = CLEAR_B + HOLD;
  /* 🔴 2.2 屏（原 1.0）。飞越同时驱动**三件事**：卡片糊出去、meet 文案退场、
     以及 hub 那块 pad 由糊到清（--meet-fly）。1 屏意味着一次滑动就能把这三样
     一起跨过去——用户 2026-08-28：「不要一滑而过」。
     阻力买在**距离**上，不是再叠一层阻尼：这一拍现在是 hub 入场的唯一时钟
     （见 hub.css 的 .hub__stage / .hub__wrap），给它加阻尼就等于让 hub 的清晰度
     落后于卡片的模糊度，正是前面刚修掉的那个错位。 */
  const FLY_B = FLY_A + 2.2;
  /* 🔴 手机上时间轴到 CLEAR_B 就结束——不播飞越那一拍（用户 2026-08-30：
     「最后一幕不需要卡片飞出去，停在最后一个词 Grows 的动画就好」）。

     CLEAR_B 正是「五个词都出完、卡片统一转清晰」的那一刻，也就是 Grows 落定。
     END 是整条时间轴的终点，段高、hub 的 overlap、is-spent 的判据、进度条的
     分母全都从它推——所以只改这一个数，那五处自动跟着对。

     连带的好处：飞越是这一段唯一还在做大幅变换的一拍（12 张卡各自放大位移），
     不播它，接缝处就只剩静态画面。 */
  /* 🔴 2026-09-04：桌面也收在 CLEAR_B，飞越那一拍**两端都不播了**。

     上面那段记的是 2026-08-30 只砍了手机（「最后一幕不需要卡片飞出去，停在
     最后一个词 Grows 的动画就好」）。同日用户对桌面提了同一件事：「到最后
     Grows 完了以后，他能不能不要卡片飞出去？就在这边旋转就可以了，不要再多
     一个动作。」

     代价是零：飞越原本驱动的三件事里，两件（meet 文案退场、hub 由糊到清）在
     2026-09-03 把 hub 挪到 meet **前面**之后就已经没有消费者了——hub.css 的
     .hub__stage / .hub__wrap 那两处 opacity 早就硬设成 1，blur 也归零。剩下
     那件就是卡片自己飞出去，正是用户不要的。

     FLY_A / FLY_B 保留：它们仍是 setFly 的定义域，也是哪天想把这一拍加回来的
     挂点。段高、is-spent 的判据、进度条分母都从 END 现推，改这一个数就够。 */

  /* 🔴 2.0 → 0.5（2026-09-04）。用户：「从 privacy 往回滑到 meet nestie 的时候
     一开始是空的」。

     这 2 屏原本不是给读者看的——它是留给 **hub 咬进来**的。证据就在下面
     resize() 里算 overlap 的那行：`(END + 1 + SLACK) - FLY_A + 0.1`，整条尾巴
     连同它都在 hub 的负 margin 覆盖范围内，所以从来没人看见过它是空的。
     2026-09-04 的改版把 hub 挪到了 meet **前面**、并移除了 overlap，这段尾巴
     就此失去消费者，变成飞越演完之后 3 屏实打实的空白。

     实测（1440×900）：meet 段高 14.1 视口，飞越结束在 11.05 —— 尾巴 3.00 视口，
     而旧的 --hub-overlap 回退值正是 3.30 视口，两个数对得上。

     0.5 的依据用的是手机那一版已经论证过的口径（见 resize() 里「手机尾巴
     1 → 0.5 屏」那段）：尾巴的正经用途只有「限速的播放头追平最后一拍」，而
     飞越那一拍本来就不受限速（见 tick() 里 inFly 那段，约 0.2s 收敛），
     0.5 屏绰绰有余。另外 `+1` 不能动——那是 sticky 舞台解除钉住需要的一屏，
     属于结构，不是余量。 */
  /* 🔴 0.5 → 1.4 →（同日）**收回 0.5**。停留改由 END 里的 HOLD 承担——挂在
     SLACK 上的那 0.9 屏在时间轴之外，播放头到不了，等于没有阻尼（用户：「滑到
     grows 一下就滑出去了」）。下面这段 2.0→0.5 的历史仍然成立，保留。

     2.0 → 0.5 那次是因为「从 privacy 往回滑到 meet nestie 一开始是空的」——
     那时飞越已经演完，尾巴上真的什么都没有，纯空白。

     同日砍掉飞越之后（END = CLEAR_B），尾巴上留着的是**最后一个词 Grows 落定、
     整圈卡片停在那儿转**的画面，不是空白。用户要的正是这个：「Grows 完了以后
     不要卡片飞出去，就在这边旋转就可以了」。0.5 屏太紧，Grows 一落定就到段尾、
     下一段接上来，没有站定的余地。

     ⚠️ 这个数同时还是 resize() 注释里说的「播放头补完」的余量，别减到 0.5 以下。 */
  const SLACK = 0.5;   // 纯粹的播放头补完余量；Grows 之后的停留见 END 的 HOLD

  /* ============ 卡片 ============
     七个位置沿用豆包原值，另外四个（手机/沙发/下雨/less-to-carry）是补的，
     凑够「一句开场白 + 五对」= 11 张 */

  const BIRD = { x: 720, y: 405 };   // 小鸟在 1440×810 画布里的中心，和 .meet__bird 对齐（改这里必须同步改 meet.css）

  const NOTE = (tag, tone, title, body) =>
    `<div class="meet__ch meet__ch--note meet__face">
       <span class="meet__ch-tag meet__ch-tag--${tone}">${tag}</span>
       <h4>${title}</h4>
       <p>${body}</p>
     </div>`;

  const CARDS = [
    /* --- 两张"零头"卡：不属于任何一个词，只跟大盘的 present/sunk 走 ---
       11 张 = 5 对 + 1 张余数，现在是 12 张 = 5 对 + 2 张余数。 */
    {
      /* 2026-08-29 换掉了原来那条 HTML 胶囊（"Soccer moved to 4:30…"）。
         它是最后一张 HTML 卡，所以 fitHtmlCard / NOTE / .meet__ch 那一套
         CSS 现在全部没有使用者了——留着没删，因为这一段的图换得很频繁，
         随时可能换回手写卡。
         源图直角，radius 走 CARD_R（738×3.7% = 27），不写死。 */
      /* 🔴 0.43 而不是 0.23——**保面积在这张上是错的规则**。
         换图时我按老规矩保了渲染面积，但被换掉的是一条 324×38 的胶囊：又长
         又薄，同样的面积摊到 2.32 的比例上只剩 170×73，宽度掉了一半。用户
         2026-08-29：「之前那个挺长的嘛，现在感觉有点小」——他记住的是那条
         **有多长**，不是它占了多少面积。
         所以这张按**宽度**对齐而不是面积。走过两个极端才落到 0.34：
           0.23（保面积）渲染 170 宽 —— 用户："感觉有点小"
           0.43（对齐胶囊 324）渲染 331 宽 —— 用户："头上那个卡片太大了呀"
           0.34 渲染 251 宽，取中。
         上限由邻居定死：c-cal 右缘 462、c-grow 左缘 924，中心在 670.5，
         所以这张最宽只能到 ~500，0.34 还有余量。 */
      name: 'c-wide', left: 302, top: -53, w: 738, h: 318,
      scale3d: '0.34, 0.34, 0.34', rotate: 'rotateZ(-1deg)',
      perspective: 2680, opacity: 0.25, blur: 15,
      img: 'assets/meet-others-1.webp',
    },
    {
      /* 🔴 第 12 张，补 Anticipates 那一簇下面的空（用户 2026-08-29："那个
         Others card 能不能放在 Anticipate 的卡旁边，因为有点空"）。
         🔴 中心 (785, 750)，**压在 Milk 那张（c-carry, 900,710）后面**、
         从它左下角探出来——不是摆在两张中间。摆中间那一版被否了：用户
         2026-08-29「底部的卡片为什么和左右的像一个 8 字形排开？太周正了…
         能不能放在某一张卡的后面」。(700,785) 正好是 c-rain(520,692) 和
         c-carry(900,710) 的中垂位置，三张连起来是一条对称的弧，规整得像排
         版而不像散落。塞到一张后面就打破了那条弧。
         它在 CARDS 里排第 2、c-carry 排第 10，DOM 顺序天然让它在后面，不用
         写 z。倾角也从 +3° 改成 -9°，和 c-carry 的 -22° 差一档，读起来是两
         张叠着而不是同一张的重影。
         🔴 横向走过 820 → 785：820 时两张重叠 58px，占 Milk 宽度的 64%，
         糊成一坨（用户 2026-08-29："稍微分开一点点"）。785 时重叠 23px、
         26%，还搭着一角但各自的轮廓都读得出来。再往左到 765 就只剩 3px，
         那就不是叠压是并排了。
         ⚠️ **别用画布坐标推它和词块的距离，会差几十像素**。.meet__cards 整层
         带着 driftAngle 在转，卡片的屏上位置不等于它在画布上的 left/top：这
         张中心写的是 (820, 750)，实测上缘落在 751 而不是算出来的 692，差了
         60。我按画布算过一次，得出"离词只剩 13px、不能再上移"，实测量出来
         的真实间距是 **94**。要判断挤不挤，量，别算。
         ⚠️ 它和 c-wide 一样不属于任何一个词，apply() 里要单独 paintCard，
         漏了就永远不出现。 */
      name: 'c-plan', left: 394, top: 578, w: 783, h: 343,
      scale3d: '0.22, 0.22, 0.23', rotate: 'rotateZ(-9deg)',
      perspective: 2600, opacity: 0.25, blur: 20,
      img: 'assets/meet-others-2.webp',
    },

    /* --- Remembers ---
       🔴 两张都换成了成稿卡片（用户 2026-08-28 给的 remembers1/2.png，已转
       webp）。它们不是"照片"，是画好的卡：自带圆角、自带文字、自带透明角，
       所以这一对比其它九张多三个约束，改动时别当普通图片处理：

       ① 比例必须**照抄图片**，因为 .meet__face 是 object-fit: cover——盒子
          比例一歪就是裁掉画好的字。1604×1656 → 0.9686，1587×1656 → 0.9583，
          w/h 就是照这个算出来的（其它卡是 360×468 = 0.769，套不上）。
       ② scale3d 的 x/y 必须**相等**。原来是 0.28/0.26 和 0.24/0.22，那是给
          照片做的 7% 纵向压扁，放在带字的卡上就是字被压扁。取几何平均
          （0.27 / 0.23）换成等比，屏幕上的大小不变、形不再变。
       ③ 圆角照抄图片自己的：源图 52px 圆角，按盒子宽换算 = 14px。共享规则
          里的 44px 是给直角照片切圆角用的，套在这两张上会切进画面——437 宽的
          盒子上 44px 相当于 10% 的角，正好啃掉左上角那枚 ALLERGY / GROWING
          FAST 标签，而且 box-shadow 会跟着那个更圆的形状走、和卡片本身的角
          对不上。

       ⚠️ left/top 是**反算**出来的，不是照搬：scale3d 的 transform-origin 是
       中心，所以换比例时要保住中心点不动，否则整张卡在画布上平移。
       原中心 (237, 427) 和 (1220, 470)，现在还是。 */
    {
      name: 'c-allergy', left: 19, top: 202, w: 437, h: 451,
      scale3d: '0.27, 0.27, 0.26', rotate: 'rotateX(8deg) rotateY(-5deg)',
      perspective: 2709, opacity: 0.25, blur: 15,
      img: 'assets/meet-remembers-1.webp', radius: 14,
    },
    {
      name: 'c-sizeup', left: 1006, top: 246, w: 429, h: 448,
      scale3d: '0.23, 0.23, 0.23', rotate: 'rotateZ(31deg) rotateY(-14deg)',
      perspective: 2600, opacity: 0.25, blur: 16,
      img: 'assets/meet-remembers-2.webp', radius: 14,
    },

    /* --- Coordinates ---
       也换成成稿卡（用户 2026-08-29 给的 coordinates1/2.png）。三条约束和
       Remembers 那一对一样，写在那儿；这里只记不一样的地方：

       🔴 这两张是**横的**（1.6716 / 1.6273），原来的盒子是竖的 558×708
       （0.788）。所以不是改改尺寸，是整个翻过来。

       🔴 翻的时候保的是**面积**，不是宽也不是高。这两张在构图里的分量由
       它占多大一块决定：照抄宽（139.5）会把高压到 83，照抄高（162.8）会把
       宽撑到 272，两种都换了这张卡在圈里的份量。解 w·h·k² = 原面积、
       w/h = 图片比例，得出的就是下面这组——渲染面积和换图前一致到 0.2%。

         c-cal   139.5×162.8 = 22710  →  812×486×0.24  = 195×117 = 22737
         c-list   83.7×99.1  =  8295  →  801×492×0.145 = 116×71  =  8282

       ⚠️ litK 会跟着自动重算（长边 → litW），不用手动跟。

       🔴 litW 330，只有这一对。用户 2026-08-29 指着这两张说"变大的时候能不
       能更大一点点"——**只有这一对**：我第一版把默认 LIT_W 从 280 改到 330，
       五拍全跟着大了，被打回来「你是每组都变大了吗 我只要变大 coordinates
       的」。所以现在是 per-card 覆盖，另外四拍原样 280。
       当初的理由是"这俩是仅有的横版卡，按长边配齐会让横版吃亏"——**这个理由
       后来只剩一半**：c-cal 2026-08-29 改版成了竖版，现在只有 c-list 是横的。
       但 330 留着，因为用户要的本来就是"这一对再大一点"，跟版型无关；把它
       写成版型推论只会让下一个人以为改回横版才需要它。
       算过上限：330/160.6 = 2.06（c-cal）、330/112.1 = 2.94（c-list），都在
       LIT_MAX 3.4 以内，所以上限不用动。 */
    {
      /* ⚠️ 这张的源图在迭代中，2026-08-29 一天之内横→竖→横改了三版，比例
         在 1.6716 / 0.8823 / 1.6741 之间来回。所以下面这组数**没有一个是设
         计出来的**，全是从源图算的，换图必须整组重算，一个都不能留：

           w/h    = 保面积反算：解 w·h·k² = 原渲染面积、w/h = 源图比例
                    （原渲染面积 = 812×486×0.24² = 22731，这个基准别动，
                    它是这张卡在圈里的分量）
           left/top = 反推，让中心永远钉在 (365, 222)
           radius = 源图圆角 ÷ 源图宽 × 盒子宽
           litK   = 自动，读 litW/w/h

         只换 img 一行、其余照旧 = object-fit: cover 裁掉画好的字。这一对已
         经栽过两次，第三次就不该再靠记忆了。 */
      name: 'c-cal', left: -42, top: -21, w: 814, h: 486,
      scale3d: '0.24, 0.24, 0.24', rotate: 'rotateX(17deg) rotateY(22deg) rotateZ(18deg)',
      perspective: 2099, opacity: 0.25, blur: 15,
      img: 'assets/meet-coordinates-1.webp', radius: 30, litW: 330,
      /* 🔴 这里曾有 `z: 1` 压住 c-phone，现在撤了。那时 c-phone 是张小照片，
         压住它、只露一角是对的；它现在是张有字的清单卡，压住就等于让它在背
         景态里七成看不见（实测只露出"…sday / Leo's cleats / Book fair
         money"三行的尾巴）。叠压关系反过来：小卡在上、大卡从它周围露出来，
         这样两张都读得到，而且**小的压大的**本来就是更自然的读法。
         撤掉之后靠 DOM 顺序即可——c-phone 在 CARDS 里排在这张后面。 */
    },
    {
      /* ⚠️ 这张的图换过一版（2026-08-29，暖棕的客厅换成夜蓝的），比例跟着从
         1.6273 变 1.5164，所以 w/h/left/top/radius 全部重算过一遍——**换图不
         是只换一行 img**，上面那三条约束每条都跟图片的像素绑着。 */
      name: 'c-list', left: 778, top: 69, w: 773, h: 510,
      scale3d: '0.145, 0.145, 0.17', rotate: 'rotateZ(-26deg)',
      perspective: 2704, opacity: 0.25, blur: 30,
      img: 'assets/meet-coordinates-2.webp', radius: 31, litW: 330,
    },

    /* --- Reminds --- */
    {
      /* 🔴 这张挪过两轮，两轮都是同一个人看着同一处不舒服，记全比记结论有用：

         ① 原位 left:20 / top:-114，中心离小鸟 593 —— 十一张里最远的一张，
            第二远的才 505，其余都在 300–480。用户：「不要距离轴线那么远，
            感觉这个散出去了」。先只是把它往里收到 516。
         ② 收进来之后问题换了个样子：它斜着 -34° 悬在 c-cal 的左上角，用户：
            「太尖了，就感觉像发射出去」。那 -34° 原是给"甩在圈外"的构图配
            的——一张孤零零的卡靠倾角撑住动势；一旦它挨到别的卡边上，同样
            的倾角就变成了一支从那张卡里射出来的镖。

            所以这一轮不是再挪一点，是换关系：它现在**压在 c-cal 的右下角
            底下**，露出右侧和下沿，倾角收到 -11°。参照用户给的豆包那张——
            前后两张卡错开叠着、后面那张只露一角，靠的是叠压关系而不是倾角。
         ③ c-cal 换成横版成稿卡之后（渲染 195×117，原来是 139×163），它的
            右下角整个挪了位，这张卡再放在 ② 的地方就只是"挂在它正下方"，
            不再是压着一角。跟着它的新轮廓右移 30，才重新露出右侧和下沿。
            中心现在 (445, 300)。

         ④ 图换过三轮：手机照片 → Smart Reminder 那张 UI 示意图（底色和页面
            地色只差几个色阶，混在实拍卡里质感对不上）→ 临时用 HTML 清单卡
            顶上 → 2026-08-29 换成成稿图。**这个槽位的基准面积一直是 8078**
            （那一版 HTML 卡 360×359 × 0.25²），换几次图都以它为准。

         ⑤ 中心从 x445.5 挪到 x372（用户："左上角的卡会被 Coordinates 遮住，
            往外放点"）。**这个 74 是量出来的**：五个词里最靠左的是
            Coordinates，左缘在画布 x571；点亮时这张卡右缘到 x635，压进去
            64。挪 74 之后右缘 561，留 10 的空。改词的 --dx 或 LIT_W 都会让
            这个数失效，要重量。

         🔴 ⑥ 这张**没有 radius**，是六张成稿卡里唯一不写的两张之一，别照着
            上面四张补上。源图从 2026-08-29 起改成了**直角**（四角 alpha 255，
            实测），圆角交给共享规则 `img.meet__face` 的 44px 去切——这正是
            用户要的"你自己去设圆角，跟其他卡片一样"。

            为什么这件事不只是好看：自带圆角的图 + CSS 圆角是**两条不同的
            曲线**（设计稿的角是 squircle，CSS 是圆弧），两者之间那一两像素
            的缝里，图是透明的、而 box-shadow 是**外阴影不画在 border-box
            以内**——于是那条缝露出的是没被阴影压暗的页面底色，在四周都被阴
            影压暗的对比下就是一条亮边。用户看见的"白边"就是它（"我卡本身
            是没有白边的，你为什么要给卡本身底下再加个白边"）。
            直角图 + 一个 CSS 圆角之后，切口和阴影走同一条曲线，缝在构造上
            就不存在了。

            ⚠️ 剩下四张（remembers1/2、coordinates1/2）目前**仍是自带圆角**，
            所以仍带这条亮边。等它们也换成直角图，就把各自的 radius 一起删掉。 */
      name: 'c-phone', left: 145, top: 158, w: 455, h: 284,
      scale3d: '0.25, 0.25, 0.25', rotate: 'rotateZ(-11deg) rotateX(12deg)',
      perspective: 2500, opacity: 0.25, blur: 18,
      img: 'assets/meet-reminds-1.webp',
    },
    {
      /* ⚠️ 这张也从 HTML 清单卡（Tuesday / Swim kit…）换成了成稿图
         （2026-08-29，reminders2.png，FAMILY REMINDER / On dog duty?）。
         保面积的基准是那张 HTML 卡的渲染尺寸：360×359 × 0.51² = 33615。

         🔴 那张 HTML 卡留下的两个数**不是跟着图片来的，是它自己挣的**，换图
         时最容易顺手抹掉：
           · scale3d 等比 0.51 —— 原来是 0.55/0.47，15% 的纵向压扁。文字卡被
             压 15% 很明显，这张卡上是一行大字，同样明显。
           · h 曾经写死 468 而内容只有 355，下面空一块，用户 2026-08-29 指过
             "不要这样底部空白"。现在是图片卡，h 由比例算、fitHtmlCard 不再
             管它——但"盒子必须贴着内容"这条没变，只是执行者从 fitHtmlCard
             换成了保面积公式。 */
      /* 同上一张：源图直角，radius 交给共享的 44px，别补 —— 理由写在
         c-phone 的 ⑥。 */
      name: 'c-task', left: 944, top: 436, w: 426, h: 303,
      scale3d: '0.51, 0.51, 0.49', rotate: 'rotateX(17deg) rotateY(-22deg) rotateZ(3deg)',
      perspective: 1406, opacity: 0.34, blur: 11,
      img: 'assets/meet-reminds-2.webp',
    },

    /* --- Anticipates --- */
    {
      /* 2026-08-29 换成成稿图 anticipates1.png（Milk, eggs, bananas）。
         原来是 HTML 便签（NOTE('Anticipates','amber','Rain on Thursday'…)），
         所以保面积的基准取那张**被 fitHtmlCard 量完之后**的渲染尺寸：
         360×0.26 与 614×0.24 —— 614 是量出来的高，不是 CARDS 里写的 468，
         拿 468 算会把这张卡缩小 24%。
         scale3d 也顺手改成等比 0.25（原 0.26/0.24 是 8% 纵向压扁）。

         ⚠️ radius 28 是**照抄源图**（52/714×381），不是房规的 3.7%（那会是
         14）。这两张 anticipates 又是自带圆角的图，占自身宽 7.3%，比其余卡
         圆一倍——见下面 c-carry 的同一条注释。 */
      name: 'c-rain', left: 320, top: 417, w: 401, h: 551,
      scale3d: '0.25, 0.25, 0.25', rotate: 'rotateX(-16deg) rotateZ(19deg)',
      perspective: 2300, opacity: 0.25, blur: 16,
      img: 'assets/meet-anticipates-2.webp', radius: 29,
    },
    {
      /* 🔴 这一对是**自带圆角**的图（源图圆角 52，占宽 7.3%），所以两张都
         写死各自换算出来的 radius 去贴那条曲线，没有走 CARD_R 的 3.7%。
         代价是它俩比其余九张明显圆一倍——用户 2026-08-29 刚定过"所有卡圆角
         一致、以 Coordinates 为准"，这两张是例外，因为改成 3.7% 会让 CSS
         切口小于图里画好的角，缝里露出没被阴影压暗的底色，就是那条亮边。
         导成直角图之后把这两行 radius 删掉即可自动归到 3.7%。 */
      name: 'c-carry', left: 734, top: 457, w: 332, h: 506,
      scale3d: '0.27, 0.27, 0.27', rotate: 'rotateX(-14deg) rotateZ(-22deg)',
      perspective: 2350, opacity: 0.26, blur: 15,
      img: 'assets/meet-anticipates-1.webp', radius: 24,
    },

    /* --- Grows --- */
    {
      /* 2026-08-29 换成成稿图 grows1.png。scale3d 从 0.36/0.31 改成等比
         0.334（几何平均），原来是 14% 的纵向压扁。
         ⚠️ 换掉的 hero-know-better.webp **不要删**：hero.js 还在用同名的
         .mp4/.jpg 那一组，webp 只是这里不用了。 */
      /* 🔴 0.241 / 0.236：Grows 这一对**互相配平**过，不是各调各的。
         原来 c-know 渲染长边 252、c-grow 只有 131，差 1.93 倍——十二张里
         最大和最小的两张恰好是同一对，一亮起来一边压着另一边（用户
         2026-08-29："grows 那两张初始状态一张比较大，要均衡一下，取一个
         中间值"）。取**几何中值** √(252×131) = 181，两张的长边都拉到它：
         c-know 235×252 → 169×181，c-grow 104×131 → 144×181。
         几何中值而不是算术中值：这是尺寸比，等比缩放里两边各让一半才公平
         （算术中值 191 会让小的那张多长 46%、大的只缩 24%）。
         ⚠️ 只改 scale3d，不动 left/top —— scale3d 绕中心缩放，两张在圈里
         的位置不变。 */
      name: 'c-know', left: -70, top: 216, w: 704, h: 754,
      scale3d: '0.241, 0.241, 0.25', rotate: 'rotateX(45deg) rotateY(32deg) rotateZ(-52deg)',
      perspective: 2903, opacity: 0.3, blur: 15,
      img: 'assets/meet-grows-1.webp',
    },
    {
      /* 同上，源图是 `image 967.png`（量身高那张，设计师没改名）。
         ⚠️ 这一对**是直角图**，所以两张都不写 radius，圆角由 CARD_R 的 3.7%
         自动算（25 / 23）——目前十一张里唯一和 reminds 一样干净的一对。 */
      name: 'c-grow', left: 671, top: -234, w: 609, h: 769,
      scale3d: '0.236, 0.236, 0.25', rotate: 'rotateZ(-55deg)',
      perspective: 2738, opacity: 0.25, blur: 25,
      img: 'assets/meet-grows-2.webp',
    },
  ];

  // 每个词带出来的两张卡（一左一右），顺序和 .meet__verb 一一对应
  const PAIRS = [
    ['c-allergy',  'c-sizeup'],   // Remembers
    ['c-cal',   'c-list'],    // Coordinates
    ['c-phone', 'c-task'],    // Reminds
    ['c-rain',  'c-carry'],   // Anticipates
    ['c-know',  'c-grow'],    // Grows
  ];

  /* 飞越的终点姿态。前七个是豆包原值，后四个按「从画面中心往外推」补的 */
  const FLY = {
    'c-know':  { sx: 2.4,   sy: 3.2,   sz: 3.2,   rx: 21,  ry: 16,  rz: -53,  tx: -708.36,  ty: -628.88 },
    'c-allergy':  { sx: 2.625, sy: 2.625, sz: 2.625, rx: -77, ry: 57,  rz: 12,   tx: -1093.44, ty: -839.50 },
    'c-cal':   { sx: 5.625, sy: 5.522, sz: 5.522, rx: -2,  ry: 0,   rz: -112, tx: -751.38,  ty: -867.03 },
    'c-wide':  { sx: 4.125, sy: 4.087, sz: 3.96,  rx: 0,   ry: 0,   rz: 0,    tx: 108.44,   ty: -741.25 },
    /* 第 12 张：往画面下方冲出去，和它在构图里的位置一致 */
    'c-plan':  { sx: 3.6,   sy: 3.6,   sz: 3.6,   rx: 0,   ry: 0,   rz: 0,    tx: -60,      ty: 720 },
    'c-grow':  { sx: 2.9,   sy: 3,     sz: 2.9,   rx: 0,   ry: 0,   rz: 0,    tx: 738.58,   ty: -920.46 },
    'c-list':  { sx: 4.353, sy: 4.4,   sz: 4.412, rx: -21, ry: -71, rz: 0,    tx: 900.59,   ty: -587.60 },
    'c-task':  { sx: 2.328, sy: 2.328, sz: 2.328, rx: -41, ry: -35, rz: 72,   tx: 372.27,   ty: -370.61 },
    'c-phone': { sx: 3.1,   sy: 3.1,   sz: 3.1,   rx: 18,  ry: -24, rz: 40,   tx: -820,     ty: -560 },
    'c-rain':  { sx: 3.0,   sy: 3.0,   sz: 3.0,   rx: -30, ry: 22,  rz: -18,  tx: -380,     ty: -880 },
    'c-sizeup': { sx: 3.2,   sy: 3.2,   sz: 3.2,   rx: -18, ry: -46, rz: 26,   tx: 860,      ty: -520 },
    'c-carry': { sx: 2.9,   sy: 2.9,   sz: 2.9,   rx: 24,  ry: 18,  rz: -34,  tx: 420,      ty: -900 },
  };

  /* ============ DOM ============ */
  const cardsEl = section.querySelector('.meet__cards');
  const scene = section.querySelector('.meet__scene');
  /* 接力的两端：hero 末屏那个 film 盒子 → 小鸟锚点。两端都**每帧现读**，
     所以 t=0 时接力层正压在 hero 的 film 上、t=1 时正落在小鸟上，
     交接点落在哪一帧都不会跳（两个段落此刻都还在动）。 */
  const heroStage = document.querySelector('.hero__stage');
  const heroSlides = [...document.querySelectorAll('.hero__slide')];
  const heroInner = heroSlides.length
    ? heroSlides[heroSlides.length - 1].querySelector('.hero__inner') : null;
  const heroVid = heroInner ? heroInner.querySelector('video') : null;
  /* 片子飞走了，它的标题和进度条却还钉在原地——读起来像"图没了、说明还在"。
     这两样跟着接力一起退场。rail 由 hero.js 只用来 appendChild，没人写它的
     opacity，所以这里独占，不会打架。 */
  const heroCopy = heroSlides.length
    ? heroSlides[heroSlides.length - 1].querySelector('.hero__content') : null;
  const heroRail = document.querySelector('#heroProgress');
  /* 🔴 手机上这一整套接力**前提没了**（2026-09-05，deck 横过来之后）。

     它的第一句就是「hero 末屏那个 film 盒子」——竖版里 deck 最后一张占满
     舞台、正压在读者眼前，片子从那个满屏的方块飞进小鸟，成立。横版里
     （hero.css 末尾那块）第四张只是横向轨道上最右边的一张卡片：读者不一定
     划到过它，即使划到了它也只有 575px 宽，而且多半停在视口右侧甚至完全在
     视口外。起点几何一垮，每帧插值出来的就是一个屏外矩形补到小鸟的连线。

     实测 662×1552，读者停在 deck 上：.film-relay 变成 575×575、opacity 1、
     fixed 在 (0,0)、z-index 40，正正盖住第一张卡片的上半张——用户看到的是
     同一支片子在一张卡上出现了两次（2026-09-05：「怎么还在？」）。

     置 null 就够，不需要动下面任何一处：relayOff() 第一行 `if (!relay ||
     !heroInner) return`，驱动块的条件是 `if (relay && heroInner &&
     heroStage)`，两处一起熄火。于是 .film-relay 保持它 CSS 里的初始态
     （width/height 0、opacity 0，见 meet.css），heroInner / heroCopy /
     heroRail 的 opacity 也从头到尾没人写过——卡片是干净的。
     relayVid 是 preload="none"，不进 relaying 分支就一个字节都不下。

     ⚠️ 判据必须和 hero.css 末尾那块、hero.js 的 PHONE 用**同一个** 767：
     那三处说的是同一件事——deck 是不是横的。哪天横版的断点改了，这里要跟。 */
  /* Hero is now a self-contained exhibition on every viewport. Its final
     film no longer morphs into Nestie; Meet begins as an independent scene. */
  const RELAY_OFF = true;
  const relay = null;
  const relayVid = document.querySelector('.film-relay__v');
  let relaying = false;
  const birdEl = section.querySelector('.meet__bird');
  const birdCanvas = section.querySelector('.meet__bird-c');

  /* ============ 每个词一只鸟 ============
     🔴 顺序**必须**和 index.html 里 .meet__verb 的顺序一致：
     Remembers / Coordinates / Reminds / Anticipates / Grows。
     这五张是设计师画的"小鸟在做那件事"（写字、看日历、提醒…），所以对不上
     顺序不是排版错，是语义错——鸟在写字而词是 Grows。

     🔴 建在 JS 里而不是写进 index.html：它们和词的时间轴绑死，五张的存在
     完全由 WORD_N 决定；写死在 HTML 里，哪天加减一个词就会剩一张孤儿图或
     者少一只鸟，而且不会报错。 */
  /* 🔴 第 0 只：**飞上去之后、第一个词进来之前**站在顶上的那只（用户
     2026-08-29 给的 idle-bird.png）。它不属于任何一个词，所以不在
     BIRD_PICS 里，单独一个 img——BIRD_PICS 的长度和 WORD_N 绑死，混进去
     会让"第 i 只鸟配第 i 个词"的对应关系错开一位。 */
  const birdIdle = document.createElement('img');
  birdIdle.className = 'meet__bird-p';
  birdIdle.style.setProperty('--bs', '1.067');
  /* 🔴 手机换 assets/m/nestie/ 下的 400px 变体。六帧原图 600×600，而手机上
     小鸟盒是画布里的 230px、再乘 --meet-cover 0.4875 ≈ 112 CSS px，DPR3 也只
     要 336 设备像素——600 是近 1.8 倍的浪费，而六帧一起解码是 8.2MB 常驻。
     解码内存按**源图**像素算，不按显示大小，这是这一整轮减内存的共同前提。 */
  const M = matchMedia('(max-width: 767px)').matches;
  const birdSrc = (u) => (M ? u.replace('assets/nestie/', 'assets/m/nestie/') : u);
  birdIdle.src = birdSrc('assets/nestie/meet-bird-0-idle.webp');
  birdIdle.alt = '';
  birdIdle.decoding = 'async';
  birdIdle.setAttribute('aria-hidden', 'true');
  birdEl.appendChild(birdIdle);

  /* 🔴 第二个数是**每张自己的放大倍数**，量出来的，不是配的。
     🔴 量的是**眼镜**，不是"蓝色的包围盒"。第一版按蓝色量，结果 coordinates
     那只肉眼明显比前后两只小——用户 2026-08-29："coordinates 的鸟头总是比
     其他前后的鸟小一点点"。原因是蓝色不只有头：翅膀、尾巴、脚都是蓝的，
     而那只的姿势蓝色伸得更开（包围盒 390 对别的 375），按它归一化就等于
     把头按比例缩了。眼镜只长在头上，六张源图里几乎恒定（353–361px），是
     这里唯一可靠的尺子。改回来之后它从 61.2% 回到 64.2%，和其余五只齐平。

     量法：图里近黑像素（眼镜框）的包围盒宽 ÷ 图的长边，再用 0.642 除它。
     0.642 是 idle 那只的现值，而 idle 已经验证过和 Rive 对齐（实测头宽比
     0.995），所以拿它当基准，六张和 Rive 就都在同一档上。
     ⚠️ 换任何一张鸟图都要重量——道具画多画少不影响眼镜，但换姿势会。 */
  const BIRD_PICS = [
    [birdSrc('assets/nestie/meet-bird-1-remembers.webp'),   1.079],
    [birdSrc('assets/nestie/meet-bird-2-coordinates.webp'), 1.085],
    [birdSrc('assets/nestie/meet-bird-3-reminds.webp'),     1.085],
    [birdSrc('assets/nestie/meet-bird-4-anticipates.webp'), 1.085],
    [birdSrc('assets/nestie/meet-bird-5-grows.webp'),       1.091],
  ];
  const birdPics = BIRD_PICS.map(([src, bs]) => {
    const im = document.createElement('img');
    im.className = 'meet__bird-p';
    im.style.setProperty('--bs', String(bs));
    im.src = src;
    im.alt = '';
    im.decoding = 'async';
    im.setAttribute('aria-hidden', 'true');
    birdEl.appendChild(im);
    return im;
  });
  const copyEl = section.querySelector('.meet__copy');
  const bubble = section.querySelector('.meet__bubble');
  const verbs = [...section.querySelectorAll('.meet__verb')];
  /* ============================================================
     🔴 点选：手机上五个词是**可点的**，点谁亮谁那两张卡（2026-09-05）。
     桌面完全不挂——TAP 恒等于 PHONE_W，没有监听器、没有 role、没有 tabindex，
     那边的交互仍旧是 hover 放大（meet.css 的 hover 媒体查询）。 */
  if (TAP) {
    verbs.forEach((el, i) => {
      /* 语义：它现在真的是一个按钮了。不用 <button> 是因为这五个 <span> 的
         排版（--dx 的错位、逐词 translate）全挂在现有类上，换标签要连 CSS
         一起动；role + tabindex 拿到的是同一份可达性，键盘也能用。 */
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-pressed', 'false');
      /* 🔴 pointerup 而不是 click。click 在移动端有 ~300ms 的等待（等双击判定），
         而这一下要的是"点下去就亮"。同时 touch-action 交给 CSS，不拦滚动：
         这五个词占了屏幕中段，拦了读者就滑不下去了。 */
      const hit = (e) => {
        /* 只在词已经出来之后才可点——没出来时它们 opacity 0，点了会亮出
           一对没有上下文的卡片。 */
        if (+el.style.opacity < 0.9) return;
        e.preventDefault();
        tapped = (tapped === i) ? null : i;   // 再点一次取消
        verbs.forEach((v, j) => {
          v.setAttribute('aria-pressed', String(tapped === j));
          v.classList.toggle('is-picked', tapped === j);
        });
        section.classList.toggle('is-picked', tapped !== null);
        /* 🔴 必须自己重绘一次。tick() 在播放头追平滚动之后就 `looping = false`
           熄火了（见那边的停机判据），而点选**不是**滚动事件——不主动叫一次
           apply()，tapped 改了画面却不动，实测点了完全没反应。
           apply 是函数声明，提升到这个闭包顶部，这里调得到。 */
        apply();
      };
      el.addEventListener('pointerup', hit);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') hit(e);
      });
    });
  }
  /* 五个词是否已经整组走完过一次——走完之后回程不再逐个熄灭，见 onScroll */
  let wordsDone = false;
  /* Desktop scrubs the first story, then repeats the highlights by time.
     The first return retires its scroll runway for this page visit. */
  let desktopReplay = false;
  let desktopReplayT = 0;
  let desktopCompact = false;

  /* 🔴 变大的是**被点亮的那两张**，背景那一堆一个像素都不动。
     用户 2026-08-28：「卡片都太小了，完全看不到里面的东西」→ 我先把所有卡
     等比放大了 1.45，立刻被打回来：「没滑到的时候不要变那么大，好丑啊」。
     这条弯路值得留在这儿：背景卡是**背景**，它们的尺寸是构图的一部分（那
     一圈 25% 不透明、blur 15–30 的东西撑的是景深），一起放大就只是把一张
     糊图变成一张更大的糊图，看清的还是只有点亮的那两张。真正的问题从来只
     在"点亮"这一下不够。

     🔴 原来的点亮只有 scale(1.10)。10% 在一张宽 10% 视口的卡上就是多出
     14px —— 读者滑到 Remembers，那两张确实"亮"了，但仍然是两个看不清的小
     方块。豆包 about 页点亮的那张（"数据中心绿色转型战略洞察"）占视口 18%，
     卡上的正文是读得出来的，差的就是这个量级。

     🔴 倍率**逐卡算**，不是统一乘一个数。十一张的底盘大小差 2.7 倍（c-know
     的长边 279 画布 px，c-phone 只有 98），统一乘的话要么小的还是看不清、
     要么大的糊一脸。这里反过来：给一个点亮后的目标长边，每张卡自己算需要
     放多少倍。于是无论滑到哪个词，亮起来的两张都是同一个尺寸——一致性本身
     就是"看得清"的一半。

     280 画布 px（画布宽 1440）→ 1440×900 视口上约 311 CSS px，占视口 21.6%，
     和豆包那张 18% 同一档，略大一点是因为我们的卡是照片配一行小字，而豆包
     那张是密排中文，同样尺寸下我们更吃分辨率。
     上限 3.4：够 Wednesday / c-list 这种最小的底盘够到目标（280/90 = 3.11），
     又不至于让某张离谱地弹出来。

     🔴 这是**默认值**，可以被单张卡的 cfg.litW 覆盖——见 Coordinates 那一对。
     曾经把这个数直接从 280 改成 330 想"再大一点点"，结果五拍全大了一圈；
     用户 2026-08-29：「你是每组都变大了吗 我只要变大 coordinates 的」。
     调某一拍就写那两张的 litW，别动这里。
     ⚠️ 写 litW 之前先算 litW ÷ 该卡长边，超过 LIT_MAX 就得一起提上限，
     否则那张够不到目标、这一对两张不一样大。 */
  const LIT_W = 280;
  /* 🔴 手机 2.1，桌面 3.4。同 LIT_W，这个上限是照 1440 的舞台定的：桌面上
     一张放大三倍的卡周围还有大片空地，手机上它直接长到词的头上——用户
     2026-08-30：「remembers 的卡片放大会和 remembers 重叠」。

     实测 390px 宽（最惨的那个词被卡片盖住的面积）：
       3.4 → 34%    2.6 → 22%    2.1 → 8%
     2.1 是词完全让出来的那一档，而卡片本身仍然看得清（最大边约 172px，
     占屏宽 44%）。

     ⚠️ 这跟 meet.css 里 .meet__copy 的 z-index:10 是**两件事**，都要留着：
     z-index 保证词永远不被盖住（兜底），这个数保证它们根本不撞（构图）。 */
  const LIT_MAX = PHONE_W ? 2.1 : 3.4;

  /* 🔴 圆角是卡片自身宽度的百分比，不是一个像素数。
     原来共享规则给所有图片卡切死的 44px，而每张卡的盒子宽差 4 倍（426 到
     1411）、外层 scale3d 又差 3.5 倍（0.145 到 0.51）——同一个 44 落到屏幕上
     从 3.2px 到 22.4px 都有。用户 2026-08-29：「所有卡的圆角能不能一致啊？
     就不要太圆」。

     3.7% 是**从设计稿量的，不是定的**：设计师给的六张成稿卡，源图圆角 ÷ 源图
     宽分别是 3.24 / 3.28 / 3.63 / 4.01 %。用户点名以 Coordinates 为准，那张
     正是 3.63%，取 3.7 落在这一簇里。换算过去：

       改前（44 死数）  绿卡 9.7%  黄卡 10.3%  c-rain 12.2%  c-know 7.5%
       改后（3.7% 规则） 全部 3.7%

     ⚠️ 四张**自带圆角**的成稿卡（remembers1/2、coordinates1/2）仍写各自的
     radius，因为它们的 CSS 切口必须贴着图里画好的那条曲线，对不上就会露出
     那条亮边（见 c-phone 的 ⑥）。等它们也导成直角图，把 radius 一并删掉，
     十一张就全归这一条规则。 */
  const CARD_R = 0.037;



  /* 🔴 HTML 卡的高度是**量**出来的，不是写在 CARDS 里的。
     图片卡的高必须写死（要和图片比例对上，否则 object-fit: cover 裁字），
     HTML 卡正相反：它的高完全由内容决定，写死就一定会错——写大了下面空一
     块（用户 2026-08-29 指着 Tuesday 那张说"不要这样底部空白"：468 的盒子
     装 ~355 的内容，25% 是空的），写小了 .meet__ch 的 overflow:hidden 会把
     最后一行切掉。

     🔴 量完要**把中心搬回原位**。scale3d 的 transform-origin 是中心，而
     left/top 定的是左上角——只改 h 不改 top，卡会往上跳半个差值。所以先记下
     原中心，再按新高反算 top。CARDS 里那对 top/h 因此只是"中心在哪"的一种
     写法，改文案不用跟着算，量完自己会归位。

     🔴 字体没加载完时量出来的是回退字的高度。所以 fonts.ready 之后再量一
     遍——不是多余：Google Sans 是网络字体，首屏那一遍量到的几乎必然是系统
     回退字，两者行高不同，差几个像素就又是一条缝。 */
  function fitHtmlCard(cfg, persp) {
    if (cfg.img) return;
    const cy = cfg.top + cfg.h / 2;
    persp.style.height = 'auto';
    const nat = persp.offsetHeight;
    if (nat > 0) {
      cfg.h = nat;
      cfg.top = Math.round(cy - nat / 2);
      persp.style.top = cfg.top + 'px';
    }
    persp.style.height = cfg.h + 'px';
  }

  const cardEls = {};

  for (const cfg of CARDS) {
    // Without perspective, the visible XY projection is an affine 2D
    // transform. Avoid retaining a separate 3D surface for every card.
    cfg.cardScale = PHONE_W
      ? `scale(${cfg.scale3d.split(',').slice(0, 2).join(',')})`
      : `scale3d(${cfg.scale3d})`;
    const persp = document.createElement('div');
    persp.className = 'meet__card';
    persp.style.cssText =
      `left:${cfg.left}px;top:${cfg.top}px;width:${cfg.w}px;height:${cfg.h}px;` +
      /* 🔴 手机上不给 perspective（用户 2026-08-30：飞越时手机立刻崩溃）。

         有 perspective 时，子元素的任何 Z 分量都是**投影**变换：scale3d 的 Z、
         scaleZ、rotateX/rotateY 都会把元素的某一部分推向摄像机，越近投影越大，
         贴到摄像机平面就趋向无穷。实测手机上飞越那一拍，逐步排除的结果：
             原样                    投影最宽 559,728px   纹理估算 3.8 TB
             去掉 scaleZ             投影最宽  14,254px   纹理估算 1.3 TB
             再去掉 rotateX/Y        投影最宽  11,996px   纹理估算 535 GB
             perspective 也去掉      见下
         前两步都只砍掉一部分，因为**投影本身**才是放大器——只要它还在，剩下
         任何一个 Z 分量都能把尺寸重新推上去。

         去掉之后所有变换退化成仿射，尺寸严格由 scaleX/Y 决定，有界。代价是
         卡片没有纵深（不再有近大远小的透视感），换的是这一段能跑完。 */
      (PHONE_W ? '' : `perspective:${cfg.perspective}px;filter:blur(${cfg.blur}px)`);

    const rot = document.createElement('div');
    rot.className = 'meet__rot meet__hover';
    /* 🔴 写成自定义属性，**不要**写成内联 transform。
       meet.css 里 `.meet__hover:hover { transform: var(--rot) scale(1.16) }`
       这条一直存在却从未生效——内联 transform 压过样式表，hover 永远追不上。
       改成 --rot 之后 transform 归 CSS 管，hover 才有可能叠上去。 */
    if (PHONE_W) {
      const m = new DOMMatrix(cfg.rotate);
      rot.style.setProperty('--rot', `matrix(${m.m11},${m.m12},${m.m21},${m.m22},0,0)`);
    } else {
      rot.style.setProperty('--rot', cfg.rotate);
    }


    let face;
    if (cfg.img) {
      face = document.createElement('img');
      face.className = 'meet__face';
      /* 🔴 手机换 assets/m/ 下的 **560px** 变体（2026-09-02 从 760 降下来）。

         **解码内存不按显示大小算，按源图像素算**——12 张一起解码是常驻的，
         而 iPhone 12 mini（4GB）上整页曾被 iOS Safari 杀掉重载。

         760 那个数是按「冲向镜头」那一拍配的：卡片那时几乎铺满屏、最宽约
         351 CSS px。但**那一拍在手机上已经不播了**（END = CLEAR_B，停在
         Grows），所以那个尺寸是在为一个不再发生的画面付钱。

         2026-09-02 扫了整段、记录每张卡在**点亮放大**时的最大显示宽度（不能
         按沉底尺寸量，否则点亮的卡会糊）：最宽 173 CSS px，DPR3 需 519px。
         560 覆盖它还留 8% 余量。
           解码位图 23.7MB → 12.9MB（省 10.9MB），磁盘 308KB → 239KB。

         ⚠️ 哪天手机上把飞越那一拍加回来，卡片会重新放大到 351px 左右，这批图
         就要跟着回到 760 —— 两件事绑在一起。

         🔴 ?v= 不能省：文件名不变、内容会变，不打版本号读者只会拿到缓存里的
         旧图，而且完全无声（今天已经踩过三次）。改图就改这个数。 */
      face.src = (matchMedia('(max-width: 767px)').matches && cfg.img.startsWith('assets/meet-'))
        ? cfg.img.replace('assets/', 'assets/m/') + '?v=448'
        : cfg.img;
      face.alt = '';
      face.loading = 'lazy';
      face.decoding = 'async';
      rot.appendChild(face);
    } else {
      rot.innerHTML = cfg.html;
      face = rot.firstElementChild;
    }
    /* 圆角：默认走 CARD_R 那条百分比规则；自带圆角的成稿卡写死自己的值，
       理由见 CARD_R 的注释。图片卡和 HTML 卡一视同仁——c-rain 那张便签原来
       也吃共享的 44px，占它自己宽度的 12.2%，是全场最圆的一张。 */
    const rad = (cfg.radius != null ? cfg.radius : Math.round(cfg.w * CARD_R)) + 'px';
    face.style.borderRadius = rad;

    persp.appendChild(rot);
    cardsEl.appendChild(persp);

    /* 🔴 顺序：先贴合高度，再算 litK 和出生点。litK 读 cfg.h、出生点读
       cfg.top —— 两个都是 fitHtmlCard 会改的，先算就是拿旧值算。 */
    fitHtmlCard(cfg, persp);
    const [sx, sy] = cfg.scale3d.split(',').map(parseFloat);
    cfg.litK = clamp((cfg.litW || LIT_W) / Math.max(cfg.w * sx, cfg.h * sy), 1, LIT_MAX);

    // 出生点：小鸟中心
    cfg.dx = BIRD.x - (cfg.left + cfg.w / 2);
    cfg.dy = BIRD.y - (cfg.top + cfg.h / 2);
    persp.style.transform = `translate(${cfg.dx}px, ${cfg.dy}px) ${cfg.cardScale} scale(0.12)`;

    cardEls[cfg.name] = { persp, face, cfg };
  }

  /* ============ 手机：把横躺的卡片圈立起来 ============
     🔴 桌面上这一圈是**横椭圆**——画布 1440×810，卡片按那个比例散开，实测
     圈的包围盒 1307×757（画布单位）。手机竖屏 390×844 正好反过来：横向不
     够、纵向大片空。用户 2026-08-29："这个卡片旋转的时候现在是一个平的椭
     圆，我们可以改成竖的椭圆，仅限手机版"。

     🔴 改的是**每张卡的中心**，不是给整层加 scaleX/scaleY。加 scale 会把
     卡片本身也压扁（横向 0.565 就是压掉四成），字都跟着变形；只挪中心，
     卡片保持原样，动的只有它们的排布。

     🔴 left0/top0 是桌面原值，必须留着：这个函数在每次 resize 都会重跑，
     从改过的值上再乘一次系数就会越跑越偏（转屏两次卡片就飞出画面）。

     kx .565 / ky 1.90 把 1307×757 变成 738×1438，屏上约 360×700 —— 竖屏的
     可用区域。超出画布的部分由 .meet__sticky 的 overflow:hidden 切掉，那是
     要的边缘感。 */
  const RING_M = { kx: 0.565, ky: 1.90 };
  CARDS.forEach((c) => { c.left0 = c.left; c.top0 = c.top; });
  /* 🔴 桌面上卡片就待在作者给的家位，**不做任何收拢**。

     2026-09-04 我曾按「让整圈塞进一个视口」去解一个收拢系数，用户否掉两次：
     先是「我不要你把视口改小……变小了很难看」，再是「恢复成原来的大小，不要
     把它挤在一整个 100vh 里面，超出去就超出去，但是不要切掉」。

     所以这里不解、不收——「不被切」是**裁剪**的问题，不是布局的问题，修在
     祖先的 overflow 上（见 meet.css）。手机那套 RING_M 是另一回事：那边是屏
     太窄、非收不可，留着。 */
  function ringLayout() {
    const m = innerWidth <= 767;
    for (const cfg of CARDS) {
      const cx0 = cfg.left0 + cfg.w / 2, cy0 = cfg.top0 + cfg.h / 2;
      const cx = m ? BIRD.x + (cx0 - BIRD.x) * RING_M.kx : cx0;
      const cy = m ? BIRD.y + (cy0 - BIRD.y) * RING_M.ky : cy0;
      cfg.left = Math.round(cx - cfg.w / 2);
      cfg.top = Math.round(cy - cfg.h / 2);
      cfg.dx = BIRD.x - cx;          // 出生点跟着走，否则卡片从旧位置飞出来
      cfg.dy = BIRD.y - cy;
      const e = cardEls[cfg.name];
      if (e) { e.persp.style.left = cfg.left + 'px'; e.persp.style.top = cfg.top + 'px'; }
    }
  }
  ringLayout();

  /* 字体到位后重量一遍，见 fitHtmlCard 的第三条注释。litK 和出生点跟着重算，
     否则它们还挂在回退字量出来的那个高上。 */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      for (const name in cardEls) {
        const { persp, cfg } = cardEls[name];
        if (cfg.img) continue;
        fitHtmlCard(cfg, persp);
        const [sx, sy] = cfg.scale3d.split(',').map(parseFloat);
        cfg.litK = clamp((cfg.litW || LIT_W) / Math.max(cfg.w * sx, cfg.h * sy), 1, LIT_MAX);
        cfg.dx = BIRD.x - (cfg.left + cfg.w / 2);
        cfg.dy = BIRD.y - (cfg.top + cfg.h / 2);
      }
    });
  }

  /* ============ 视口缩放 ============ */
  let riveBird = null;   // resize() 先跑，声明必须在它前面

  function resize() {
    RELAY_A = -1 - (parseFloat(getComputedStyle(section).marginTop) || 0) / innerHeight;
    // 铺满视口（豆包的 E()）；但窄屏上 1440 的画布会把 47px 的词顶出框，
    // 所以再按「文案块要放得下」压一道。桌面端 fit 远大于 cover，不生效。
    const cover = Math.max(innerWidth / 1440, innerHeight / 810);
    const fit = Math.max(innerWidth / 800, 0.42);
    section.style.setProperty('--meet-cover', Math.min(cover, fit).toFixed(4));
    // 段高 = 时间轴长度 + 一屏（sticky 舞台自己占的）
    /* 🔴 +SLACK：时间轴之外再留一段「舞台还钉着、但 target 已经封顶」的余量。
       限速低于滚动速度时播放头必然落后，落后的那部分要有地方补完——没有这段
       余量，读者一滚到 END 舞台立刻松开，剩下的词只能在屏幕外播。 */
    /* 🔴 手机段高重新跟时间轴挂钩（用户 2026-08-30 改回手动滑动）。

       自动播那一版是 4 屏定值——时间轴不需要铺成滚动距离。改回手滑之后必须
       铺回去，否则读者滑到底、词才出到第二个。

       手机 END = CLEAR_B = 6.85（停在 Grows，不播飞越），所以 6.85 + 1 + 1
       ≈ 9 屏。比当初手滑那一版的 12 屏短，因为飞越那 2.2 屏已经不播了。
       尾巴取 1 屏而不是桌面的 SLACK=2：那 2 屏是给飞越那一拍补播用的。 */
    /* 手机尾巴 1 → 0.5 屏。它的用处是「限速的播放头追平最后一拍」，而吸附
       会把读者停在 CLEAR_B 上、播放头就地收敛，不再需要一整屏来兜。 */
    // Mobile is a normal viewport-sized section: autoplay needs no
    // extra scroll track. Desktop keeps its scroll-driven timeline.
    const H = PHONE_W || desktopCompact ? 1 : (END + 1 + SLACK);
    if (!REDUCED) section.style.setProperty('--meet-h', (H * 100).toFixed(0) + 'svh');
    /* 🔴 hub 要压上来多少屏，由**这里**算给它，不要两边各写一个数。
       判据是硬的：hub 的舞台必须在飞越可能开始之前就钉住，否则 pad 会一边
       淡入一边被舞台推上来（实测过 200px 的可见位移）。飞越最早开始于
       S=FLY_A，meet 总长 END+1，所以下界就是 (END + 1) - FLY_A，再留 0.1。
       改 FLY_B / WORD_SPAN 而忘了改 hub 的 margin-top，就是那个位移回来的
       方式——所以它不该是个手写常量。 */
    /* hub 必须在飞越可能开始之前钉住。手机上飞越由时间触发、随时可能发生，
       所以整段都要压住 → overlap = 段高本身减去 1（hub 自己的舞台那一屏）。 */
    /* 🔴 手机上 hub 不再压上来（用户 2026-08-30：「family hub 不要再从小鸟那
       一屏出现」）。重叠意味着两段的合成层在接缝处**同时活着**——meet 的 22 层
       撞上 hub 的 161 层，正是页面崩在那一刻的原因。

       桌面保留重叠：那是「卡片冲向镜头、hub 从模糊里长出来」的整个效果，而且
       桌面显存扛得住。手机上小鸟停在五个词那里，往下滑才是 hub，两段各管各的。 */
    const overlap = PHONE_W ? 0 : ((END + 1 + SLACK) - FLY_A + 0.1);
    document.documentElement.style.setProperty('--hub-overlap', (overlap * 100).toFixed(0) + 'svh');
    window.__hubOverlap = overlap;
    ringLayout();
    sizeBirdSurface();
  }

  /* ============ Nestie（Rive 眨眼小鸟） ============ */
  // 🔴 Rive 用 canvas 的 bounding rect 决定绘制缓冲区大小，而祖先的 transform
  // 会算进这个 rect —— 弹入过程中量到的是缩小后的盒子，缓冲区按那个尺寸分配，
  // 鸟就一直是被拉伸的糊图。所以量之前先把 transform 摘掉，量完立刻还原：
  // 两次写在同一个任务里，浏览器不会画出中间帧。（bird.js 里踩过同一个坑。）
  function sizeBirdSurface() {
    if (!riveBird) return;
    const held = birdEl.style.transform;
    birdEl.style.transform = 'none';
    riveBird.resizeDrawingSurfaceToCanvas();
    birdEl.style.transform = held;
  }

  function bootBird() {
    if (!window.rive) return;   // vendor/rive.js 没加载上 —— 没有鸟，别的照跑
    try {
      riveBird = new window.rive.Rive({
        src: 'assets/nestie/bird-blink.riv',
        canvas: birdCanvas,
        autoplay: true,
        stateMachines: 'State Machine 1',
        onLoad: () => sizeBirdSurface(),
      });
    } catch (e) { /* 鸟是锦上添花，不能是这一段看起来坏掉的理由 */ }
  }

  /* ---- 场景整体的慢速旋转漂移（豆包原参数：先 12s 到 -10°，再 36s 在 -10↔20 往复） ---- */
  let driftAngle = 0;
  let driftRAF = 0;
  let driftT0 = 0;

  function driftFrame(now) {
    if (!driftT0) driftT0 = now;
    const t = now - driftT0;
    if (t < 12000) {
      driftAngle = lerp(0, -10, easeOutSine(t / 12000));
    } else {
      const c = ((t - 12000) % 72000) / 36000;          // 0→2，一个来回
      const u = c < 1 ? c : 2 - c;
      driftAngle = lerp(-10, 20, easeInOutSine(u));
    }
    // The mobile playback clock already paints this frame. Drift only
    // needs to paint independently when that clock has stopped.
    if (!PHONE_W || !looping) apply();
    driftRAF = requestAnimationFrame(driftFrame);
  }

  /* ============ 画面 ============ */

  /* 一张卡在它那一段里的样子：
     u 0→0.42   从小鸟身上飞出来，落位时最清晰（scale 1.12）
     u 0.5→0.92 暗回背景层（scale 1，低透明度 + 模糊）
     C 是最后统一转清晰的量 */
  /* 🔴 卡片不再"飞出来"，它们一直在自己的家位上。
     present  所有卡片一起淡入（开场那一拍）
     sunk     整体沉入背景层：暗下去 + 糊掉
     u        这张卡被它那个词点亮的程度（没轮到它就恒 0）
     点亮 = 回到清晰 + 微微放大 10%，**不位移**。位移是旧模型的"飞行"，
     也是"重"的来源：每个词都伴随两次跨半屏的搬运，读者的眼睛被拽走，
     而豆包那边一个词只是把两张卡的焦点拨过去。 */
  /* 🔴 「这张卡被点亮了多少」的**唯一**定义，paintCard 和词的染色共用一份。
     单独提出来是因为 2026-09-05 加了「被点亮的词变蓝」——蓝的浓度必须和卡片
     亮起来的量严格同步，抄一份公式过去迟早会漂（这个文件里同类的教训已经有
     好几处：字距、字号、text-wrap 都栽过"两处必须一致"）。
     曲线本身一个字没动：亮 0→0.30、停 0.30→0.68、暗 0.68→1.0。 */
  const litOf = (u) => clamp(settleEase(clamp(u / 0.30, 0, 1)) * (1 - easeInOutSine(norm(u, 0.68, 1.0))), 0, 1);

  function paintCard(name, u, C, present, sunk) {
    const card = cardEls[name];
    const { persp, cfg } = card;
    /* 🔴 亮 0→0.30、**停 0.30→0.68**、暗 0.68→1.0。
       原来是 0→0.42 亮、0.5→0.92 暗——满亮的窗口只有 u∈[0.42,0.50]，占一个词
       的 8%（约 0.05 视口的滚动）。也就是说卡片刚到最亮就开始灭了，读者根本
       没有一个「它停在那儿让我看」的时刻。现在满亮占 38%，是原来的近五倍。 */
    const lit = litOf(u);

    const bgO = lerp(1, cfg.opacity, sunk);
    const bgB = lerp(0, cfg.blur, sunk);

    let o = lerp(bgO, 1, lit) * present;
    let b = lerp(bgB, 0, lit);

    o = lerp(o, present, C);   // 收尾那一拍统一转清晰
    b = lerp(b, 0, C);

    // Most cards are resting while one pair is highlighted. Leave their
    // unchanged styles alone instead of invalidating them on every frame.
    if (card.paintedOpacity !== o) {
      persp.style.opacity = o;
      card.paintedOpacity = o;
    }
    // Mobile focus uses opacity and scale. Keep filters absent, including
    // blur(0), so every card does not carry a filtered rendering surface.
    if (!PHONE_W && card.paintedBlur !== b) {
      persp.style.filter = `blur(${b}px)`;
      card.paintedBlur = b;
    }
    const scale = lerp(1, cfg.litK, lit);
    if (card.paintedScale !== scale) {
      persp.style.transform = `${cfg.cardScale} scale(${scale})`;
      card.paintedScale = scale;
    }
    /* 🔴 亮着的那张永远在最上面。cfg.z 排的是**静态**叠压关系（现在只有
       c-cal 压 c-phone 一处），但点亮会把卡放大近三倍，一张本来只探出一角的
       卡长到 280px 之后就会被压它的那张切掉一大块——而那一刻它正是主角。
       🔴 门槛 .05，不是 .01。播放头 S 是带阻尼的，停下时上一个词的 u 会差
       那么一点点到不了 1，于是 lit 卡在 0.00x —— 肉眼完全没变大（实测那几张
       量出来还是背景尺寸），z 却已经抬到 9 了。结果是一堆背景卡陪着主角站在
       最上层，真撞上的时候只能靠 DOM 顺序断。.05 对应的 scale 已经明显在长，
       抬它才有意义。 */
    /* 🔴 写成自定义属性 --z，**不要**写成内联 zIndex。跟这个文件里 --rot 那条
       是同一个理由、同一个坑：内联压过样式表，meet.css 想在 :hover 时把卡片提
       到最前就永远追不上（1.34 的放大会明显被邻卡切掉一块）。
       层级本身的规则一个字没改，只是换了个出口；.meet__card 那边 z-index 读
       var(--z, 0)。 */
    const z = lit > 0.05 ? 9 : (cfg.z || 0);
    if (card.paintedZ !== z) {
      persp.style.setProperty('--z', z);
      card.paintedZ = z;
    }
  }


  let S = 0;   // 播放头，单位「视口高」
  /* 「这一段已经把资源交还了」。见下面 apply() 里赋值处的注释——它现在的含义是
     「舞台滚出屏幕了」，不再是「播放头到终点了」。 */
  let spent = false;
  const stickyEl = section.querySelector('.meet__sticky');
  /* The observer prepares rendering as the section approaches its reading
     position. Start the story once the opener has arrived, and pause once most
     of it has scrolled away. Neither condition changes the scroll position. */
  const phoneClockOn = () => {
    if (!PHONE_W || !stickyEl) return true;
    const r = stickyEl.getBoundingClientRect();
    return r.top <= innerHeight * 0.15 && r.bottom >= innerHeight * 0.5;
  };

  function apply() {
    /* 🔴 点选版恒 0。CLEAR 那一拍的作用是「五个词都出完之后，把所有卡片统一
       转清晰」——那是滚动版的收尾。点选版里卡片的常态就是**虚的、在转**，
       只有被点中的那两张清晰，一旦 C 抬起来就全部变清晰，点选就没有对比可言。
       （CLEAR_A/B 本身没动，桌面照旧读它们。） */
    // Clear the words first, then bring the bird and greeting back.
    const phoneWordsOut = TAP ? easeInOutSine(norm(playT, TAP_HELLO + TAP_CYCLE, TAP_HELLO + TAP_CYCLE + TAP_WORD_EXIT)) : 0;
    const phoneReturn = TAP ? easeInOutSine(norm(playT, TAP_RETURN_AT, TAP_LOOP)) : 0;
    const C = TAP || desktopReplay ? 0 : easeInOutSine(norm(S, CLEAR_A, CLEAR_B));   // 统一转清晰
    const f = norm(S, FLY_A, FLY_B);                      // 飞越进度
    setFly(f);                                            // hub 的 pad 跟这个数走

    /* 进度条跟播放头 S 走，而不是跟滚动位置走：读者看到的是**画面**的进度，
       而 S 才是画面的时钟（它带阻尼，落后于滚动一点点）。
       飞越开始就淡掉——那一拍画面已经在交给 hub 了，进度条留着只是噪音。
       （这两句原本是在说「用 S 不用 autoS」，autoS 是时间驱动那一版的目标量，
       已随手滑改回一并删掉；道理不变，对手是滚动位置而不是 autoS 了。） */
    /* 🔴 播完就把场景交还给浏览器（仅手机，见 meet.css 末尾那段的二分依据）。 */
    if (PHONE_W) {
      /* 🔴 判据是「舞台滚出屏幕上方」，不再是「播放头到终点」。

         改了是因为这一段现在**循环播放**：播放头永远不会停在终点，老判据下
         is-spent 会每循环一次闪一下，而 content-visibility 一闪就是整个场景
         白一帧。

         ⚠️ 这条不是装饰，是 2026-08-30 那次「整机黑屏、要重启」的修法本体
         （二分结论：meet 的卡片与 hub 同屏共存才崩）。交还的时机因此只能往
         **后**挪到「舞台真的走了」，绝不能取消。往回滚一帧就撤销。

         只判 bottom<=0（走到上方去了），不判 top>=innerHeight（还在下方没进来）：
         段落还在视口下方时正是 hero 的影片变小鸟那段接力，那时候把场景摘掉
         接力就断了。老代码在接近期也一直是 live 的，这里保持一致。 */
      const sr = stickyEl.getBoundingClientRect();
      spent = sr.bottom <= 0;
      section.classList.toggle('is-spent', spent);

      syncLive();
    }

    if (progFill) {
      progFill.firstElementChild.style.width = (clamp(S / END, 0, 1) * 100).toFixed(1) + '%';
      progFill.style.opacity = String(clamp(1 - norm(S, FLY_A, FLY_A + 0.5), 0, 1));
    }

    /* ---- 片子 → 头：页面级接力 ----
       🔴 用**原始**进度，不用上面那个 S。两个原因：
       ① S 被 target() 夹在 [0, END]，段落还在视口下方时它恒等于 0——
          接力窗口整个落在负数区，用 S 永远进不去（实测：宽度冻在 184px、
          transform 却在动，因为几何是现读的而 rt 冻住了）。
       ② 接力的起点是 hero 那个 film 的**实时**位置，它与滚动 1:1。给 rt
          加阻尼会让接力层落后于 hero 的 film，快滑时两者分开 = 又变成两个。 */
    const rawS = desktopCompact ? CLEAR_A : -section.getBoundingClientRect().top / innerHeight;
    const rt = easeInOutSine(norm(rawS, RELAY_A, RELAY_B));
    if (relay && heroInner && heroStage) {
      if (rt <= 0 || rt >= 1) {
        relayOff(rt <= 0);   // rt<=0 = 交还给 hero；rt>=1 = 交给小鸟
      } else {
        if (!relaying) {
          relaying = true;
          /* 🔴 交接播放头，不是从头放。两个 <video> 是同一支片子的两个
             解码器，接手时不对齐 currentTime 就会在同一个位置上跳一下画面
             ——intro↔hero 那张翻牌卡片踩过同一个坑。 */
          if (heroVid) { try { relayVid.currentTime = heroVid.currentTime; } catch (e) {} }
          const q = relayVid.play(); if (q) q.catch(() => {});
        }
        // from：hero 那个 film 盒子此刻的**自然**位置（offset* 不含 transform）
        const st = heroStage.getBoundingClientRect();
        const fx = st.left + heroInner.offsetLeft;
        const fy = st.top + heroInner.offsetTop;
        const fw = heroInner.offsetWidth || 1;
        // to：小鸟锚点此刻的位置（scene 自带 translate+scale，rect 已经含进去了）
        const sc = scene.getBoundingClientRect();
        const cover = sc.width / 1440;
        const bw = 158 * cover;
        const bx = sc.left + BIRD.x * cover - bw / 2;
        const by = sc.top + BIRD.y * cover - bw / 2;

        const w = lerp(fw, bw, rt);
        relay.style.width = w + 'px';
        relay.style.height = lerp(heroInner.offsetHeight || 1, bw, rt) + 'px';
        relay.style.transform =
          `translate(${lerp(fx, bx, rt)}px, ${lerp(fy, by, rt)}px)`;
        relay.style.borderRadius = `${lerp(24 / fw * 100, 50, rt)}%`;
        /* 🔴 用 rawS，不用 S。几何跑在 rawS 上、淡入淡出跑在阻尼过的 S 上 =
           两个时钟：S 落后于 rawS，回滚时尤其明显——片子已经飞回原位了，
           透明度还停在半路（用户 2026-08-28：「往回滑不够丝滑」）。 */
        relay.style.opacity = String(clamp(1 - norm(rawS, BIRD_IN_A, BIRD_IN_B), 0, 1));
        heroInner.style.opacity = '0';   // 全程只有一个可见
        /* 🔴 比片子先走完（rt 的前半程就淡光）。和片子同速退场的话，飞到
           一半时半透明的标题还压在画面上，比不淡更难看；先清干净，让飞行
           的后半程只剩那一个圆。 */
        const chromeOut = String(clamp(1 - norm(rt, 0, 0.5), 0, 1));
        if (heroCopy) heroCopy.style.opacity = chromeOut;
        if (heroRail) heroRail.style.opacity = chromeOut;
      }
    }

    // 独立入场：Meet 上滑进视口时，小鸟从小到大，不再接任何 Hero 影片。
    const birdInT = norm(rawS, BIRD_IN_A, BIRD_IN_B);
    const bi = PHONE_W ? easeOutBack(birdInT) : easeOutSine(birdInT);
    /* 🔴 小鸟**不退场**，它挪到词的底下站着（用户 2026-08-28）。SINK 这一拍
       它从画布正中（405）下移到 553 —— 正好是底对齐的词块下沿再留 24 的空当
       （见 meet.css 的 .meet__copy）。原来这里是淡出到 0，现在只缩到 0.74。

       🔴 transform 顺序是 translate 在前、scale 在后。写成 scale() translateY()
       的话位移会被缩放乘掉（148 × 0.74 ≈ 110），落点就差了 38px；最右边的先
       作用于元素，所以要让 scale 先发生、translate 在父坐标系里量。

       最后跟着飞越一起走：不给它单独的退场，f 一起，它和卡片、文案同时糊掉。 */
    /* 🔴 点选版的 bo 挂在**自动播**上，不是钉成 1（2026-09-05 用户：「鸟要放在
       中间……现在你这个位置为什么放错了呢？」）。

       上一版我把它钉成 1，理由写的是"鸟已经在终点位"——那是读错了要求。bo 是
       小鸟的**飞行**进度：0 = 画布正中（也就是屏幕正中），1 = 已经飞到顶上。
       钉成 1 等于开场就把它放在飞完之后的位置，所以第一页上它偏高了约 175px
       画布单位，正是用户截图里那个位置。

       现在：起播之前恒 0（正中，配气泡打招呼），自动播一起步它就飞上去让位给
       五个词，播完停在顶上。飞行时长取 TAP_STEP × 1.2 ≈ 0.5s，比第一个词的
       淡入略长一点，读起来是"先让位、词再落下来"。

       ⚠️ 这里**只**管位置。birdCanvas / birdIdle 的交叉淡化在点选版里已经被
       改成常量（见下面），所以 bo 不再牵动"哪只鸟"，只牵动"鸟在哪"。 */
    const bo = TAP
      ? easeInOutSine(clamp((playT - TAP_HELLO_HOLD) / TAP_HANDOFF, 0, 1)) * (1 - phoneReturn)
      : easeInOutSine(norm(S, SINK_A, SINK_B));
    birdEl.style.opacity = String(clamp(bi, 0, 1) * clamp(1 - f * 1.6, 0, 1));
    const birdStartScale = PHONE_W ? 0.25 : 0.12;
    birdEl.style.transform =
      `translateY(${lerp(0, -175, bo)}px) scale(${lerp(birdStartScale, 1, bi) * lerp(1, 0.74, bo)})`;
    if (FLY_BLUR) birdEl.style.filter = `blur(${lerp(0, FLY_BLUR, f)}px)`;

    /* 🔴 气泡现在**自己退场**，不再挂到 SINK 上跟小鸟一起飞走。它是开场的
       一拍：说完就收，收干净了卡片才来（见上面的顺序说明）。所以淡出跑在
       自己的 BUB_OUT 窗口上，和小鸟的 bo 无关——SINK 要到 1.80 才开始，那时
       这个气泡早就是 0 了，再把 bo 的位移挂在它身上就是一段读不到的死代码，
       和一条会骗下一个人的注释。

       🔴 退场不是纯淡出：往上飘 14px、缩到 0.96。跟入场那一下（下往上 10px、
       0.92→1 的 easeOutBack）是同一条轴上的反向，读起来是"这句话说完了"，
       而不是"这段文字的透明度变成了 0"。 */
    /* 🔴 入场跑 rawS，退场仍跑 S（手机）。用户 2026-09-05：「滑到 deck 的时候
       能不能已经有 hi i'm nestie 了，而不是等一下才出现」。

       S 被 target() 夹在 [0, END]，段落还在视口下方时它恒等于 0——也就是说
       任何「提前」都表达不出来：最早也只能在 S 刚离开 0 的那一刻开始淡入，而
       那时舞台已经钉住、整屏都是空的，读者看到的就是「先空一下，然后才出现」。
       rawS 是原始进度、可以为负，-0.26 就是「舞台顶边还在视口下方四分之一屏」
       ——那时这一段正随舞台往上滑进来，气泡和卡片已经在场，读者一眼看到的是
       「它本来就在那儿」而不是「它现在才来」。

       退场不改：BUB_OUT 落在正值区，S 和 rawS 在那里只差一点阻尼，而阻尼正是
       退场想要的（跟读者的手速走）。 */
    /* 🔴 点选版没有入场：`1`，不是一条曲线（2026-09-05，用户：「鸟一开始不要
       消失，就一开始就固定在这个 section 的原地，把出现动画消失掉，一开始
       上来就是 hi I'm Nestie」）。
       退场那一半（bubOut）**留着**——那是第一页交给第二页的动作，读者往下滑
       时气泡让位给五个词，不是入场动画。 */
    const bubIn = TAP ? 1 : norm(PHONE_W ? rawS : S, BUBBLE_A, BUBBLE_B);
    /* 🔴 点选版的气泡退场挂在**自动播**上，不挂滚动：第一个词一开始淡入它就
       让位。挂滚动的话，读者滑一下起播、然后停住不动，气泡会一直压在词上面。 */
    const bubOut = TAP
      ? easeInOutSine(clamp((playT - TAP_HELLO_HOLD) / TAP_HANDOFF, 0, 1)) * (1 - phoneReturn)
      : easeInOutSine(norm(S, BUB_OUT_A, BUB_OUT_B));
    const bub = bubIn * clamp(1 - bubOut, 0, 1);
    bubble.style.opacity = String(bub);
    bubble.style.transform =
      `translateX(-50%) translateY(${lerp(10, 0, easeOutSine(bubIn)) + lerp(0, -14, bubOut)}px) ` +
      `scale(${lerp(0.92, 1, easeOutBack(clamp(bubIn, 0, 1))) * lerp(1, 0.96, bubOut)})`;

    /* 全局两拍：一起出现 → 一起沉进背景层
       出现跑 rawS、沉底跑 S，理由同上面 bubIn 那段（一个要能取负、一个要阻尼）。 */
    /* 🔴 点选版两个都钉死：卡片一上来就在（present=1）、而且一上来就是虚的
       在背景层里转（sunk=1）。同一条要求的另一半——「这些卡片还有鸟本身就在」。

       ⚠️ sunk 和小鸟的 bo 在点选版里是**分开**的（滚动版共用 SINK_A/B 这对
       锚点）。卡片要一上来就虚着转，所以 sunk 恒 1；小鸟要一上来在正中、
       起播才飞上去，所以 bo 跟自动播走——见上面那段。TAP_SINK_A/B 因此在点选
       版里已经没有消费者了。 */
    const present = TAP ? 1 : norm(PHONE_W ? rawS : S, CARDS_A, CARDS_B);
    const sunk = TAP ? 1 : norm(S, SINK_A, SINK_B);

    // 两张零头卡没有对应的词（12 张 = 5 对 + 2 张余数），只跟大盘走
    paintCard('c-wide', 0, C, present, sunk);
    paintCard('c-plan', 0, C, present, sunk);

    /* 🔴 **整组**走完才锁，不是逐词锁。

       用户 2026-09-04 要的是：「我第一次把这 5 个词慢慢拉完以后，我往回走的
       时候，它就不要是一个个词消失。」——只改**回程**，去程一个字不动。

       我第一版做成了逐词锁（每个词自己满格就上锁），他立刻发现去程被改坏了：
       「我第一个 Remembers 看完以后，轻轻一拉，底下全部都出来了。」逐词锁在
       播放头追赶时会把沿途扫过的词一并钉死，于是本该一个个来的变成一次全出。

       所以判据是**全部五个都满格**这一件事，之前 shown 恒等于 a，去程与改动
       前完全一致。

       ⚠️ 锁不是永久的：读者退到 WORD_START **之前**（词还没开始的位置）就解锁。
       不解锁的话，一路滑回页首再下来时五个词会在自己的拍子之前就已经亮着。 */
    if (S < WORD_START) {
      wordsDone = false;
      desktopReplay = false;
      desktopReplayT = 0;
    }
    // 每往下滑一段，出一个词，并**点亮**它那两张卡（不再飞出来）
    const wordIn = [];
    // Each round includes the greeting, all five words, then a soft return.
    const t0 = playT - TAP_HELLO;
    const tapWord = (i) => clamp((t0 - i * TAP_STEP) / TAP_FADE, 0, 1) * (1 - phoneWordsOut);
    /* phase < 0 表示还没开播（Hi 那一拍），此时没有任何一个词被点亮。 */
    const replaying = TAP || desktopReplay;
    const phase = TAP
      ? (t0 < 0 ? -1 : Math.min(t0, TAP_CYCLE - 0.0001))
      : (desktopReplay ? desktopReplayT % TAP_CYCLE : 0);
    /* 开场鸟飞到顶后，在第一个词淡入的同一拍交给词对应的小头像。飞行期间
       openerBirdMix 仍为 0，所以鸟头不会半路消失。 */
    const openerBirdMix = TAP ? clamp(t0 / TAP_FADE, 0, 1) * (1 - phoneReturn) : 1;
    /* 第 i 个词那两张卡的点亮量。跨过自己那一步之后 u→1，paintCard 的 down
       段把它带回背景层，所以任何时刻只有一个词的卡是亮的。
       被点选时改成钉死 0.5（满亮窗口的正中），循环已经冻住。 */
    /* 🔴 第 i 只小头像的不透明度。轮播时任何时刻只有一只（或两只在交叉），
       和被点亮的那个词是同一步。
       交叉放在每一步的最后 22%：早于此换头像，读者会觉得头像抢在词前面；
       整步硬切则会在换的那一帧闪一下（两只都在 = 一瞬间两个鸟头）。 */
    const birdMix = (i) => {
      if (TAP && tapped !== null) return tapped === i ? '1' : '0';
      if (phase < 0) return '0';                       // Hi 那一拍：让位给会眨眼的那只
      const k = phase / TAP_STEP;
      const cur = Math.floor(k) % WORD_N;
      const frac = k - Math.floor(k);
      const x = TAP && cur === WORD_N - 1 ? 0 : clamp((frac - 0.78) / 0.22, 0, 1);     // 这一步末尾的交叉量
      const nxt = (cur + 1) % WORD_N;
      if (i === cur) return ((1 - x) * openerBirdMix).toFixed(3);
      if (i === nxt) return (x * openerBirdMix).toFixed(3);
      return '0';
    };
    const tapU = (i) => tapped !== null
      ? (tapped === i ? 0.5 : 0)
      : (phase < 0 ? 0 : clamp((phase - i * TAP_STEP) / TAP_STEP, 0, 1));
    for (let i = 0; i < WORD_N; i++) {
      /* 🔴 两套模型在这里岔开，往下的 paintCard / verbs 写法是共用的。
         点选版的 u 是**离散**的：点中 0.5（满亮正中），没点中 0。第二张卡
         滚动版会晚 0.06 让两张错开一点，点选版不需要——两张是同时被"选中"
         的，错开反而读成"其中一张更亮"。 */
      const u = replaying
        ? tapU(i)
        : norm(S, WORD_START + i * WORD_SPAN, WORD_START + (i + 1) * WORD_SPAN);
      const a = clamp(u / 0.34, 0, 1);
      const tw = TAP ? tapWord(i) : 0;
      wordIn.push(TAP ? tw : a);
      const shown = TAP ? tw : (wordsDone ? 1 : a);
      verbs[i].style.opacity = shown;
      verbs[i].style.transform = `translateX(var(--dx)) translateY(${lerp(18, 0, easeOutSine(shown))}px)`;
      /* 🔴 正在被点亮的那个词变品牌蓝（2026-09-05，用户：「每次被点亮的单词要
         变成蓝色，我们的主题蓝色哦」）。
         --nes-blue 是这一段自己已经在用的那支蓝：气泡里的 "Nestie"（.meet__brand）
         就是它，所以词亮起来和小鸟报名字是同一个蓝，不是新引进一支。
         浓度直接读 litOf(u)——和它那两张卡亮起来的量是**同一个数**，词和卡因此
         永远同步升同步落，不会出现"卡亮了字还没蓝"。

         🔴 染的是 **background-image，不是 color**。这一栽我实测过一次：
         .meet__verb 的墨是一条 `linear-gradient(96deg, ink → #8d867a)` 靠
         `background-clip: text` 剪出来的，`color` 本身写死 transparent。所以
         写 style.color 完全不上屏——computed 里那支蓝是对的，画面上一点没变。
         这里改成把**同一条渐变**的两个端点一起往蓝里推，渐变结构不动，所以
         不会在点亮的那一帧变成纯色块、也不会有硬切。
         ⚠️ 归零时必须写回空字符串把 background-image 交还给 CSS，不能留一条
         0% 的 color-mix 渐变——那会把样式表里那条永久盖住。 */
      if (replaying) {
        const wl = litOf(u);
        if (wl > 0.002) {
          const pc = (wl * 100).toFixed(1);
          const a1 = `color-mix(in srgb, var(--nes-blue) ${pc}%, var(--nes-ink))`;
          const a2 = `color-mix(in srgb, var(--nes-blue) ${pc}%, #8d867a)`;
          verbs[i].style.backgroundImage = `linear-gradient(96deg, ${a1} 0%, ${a1} 42%, ${a2} 100%)`;
        } else if (verbs[i].style.backgroundImage) {
          verbs[i].style.backgroundImage = '';
        }
      } else if (verbs[i].style.backgroundImage) {
        verbs[i].style.backgroundImage = '';
      }
      paintCard(PAIRS[i][0], u, C, present, sunk);
      paintCard(PAIRS[i][1], replaying ? u : clamp(u - 0.06, 0, 1), C, present, sunk);
    }
    /* 五个都满格过一次，回程才上锁——见上面那段 */
    if (!wordsDone && wordIn.every(v => v > 0.999)) wordsDone = true;
    // Finish the fifth word's full beat before handing over to the repeat clock.
    if (!PHONE_W && wordsDone && S >= CLEAR_A && !desktopReplay) {
      desktopReplay = true;
      desktopReplayT = 0;
    }
    /* 🔴 五个词展示完才开 hover（用户 2026-09-04：「五个展示完之后可以 hover
       放大」）。之前开着的话，读者还在逐词读的过程中鼠标扫过就会有卡片跳起来，
       和「一个词点亮它那两张」的节奏打架。桌面限定在 CSS 里做（见 meet.css 的
       hover 媒体查询），这里只管「演完没有」。 */
    section.classList.toggle('is-cards-live', wordsDone);

    /* ---- 顶上那只鸟跟着词换 ----
       🔴 用**词自己的淡入进度**当交叉淡化的时钟，不是"当前是第几个词"这种
       离散判断。离散判断会在两个词的交界上跳一帧；这里第 i 只鸟的不透明度是
       `它自己的词进来了 × 下一个词还没进来`，两只鸟的和恒等于 1 附近，换鸟
       和换词是同一条曲线，不可能错位。

       🔴 词是**累加**的（五个词滑完全部留在画面上，见上面 verbs 的写法），
       所以不能拿"最后一个可见的词"当依据——那五个词到最后都可见。要的是
       "最近一个正在进来的词"，wordIn[i] × (1 - wordIn[i+1]) 正好是它。

       🔴 Rive 那只眨眼鸟只属于开场（小鸟落地 + 说那句话那一拍）。第一个词
       一开始进来它就让位，否则它和写字的那只会叠在一起——两只鸟。 */
    for (let i = 0; i < WORD_N; i++) {
      const next = i + 1 < WORD_N ? wordIn[i + 1] : 0;
      /* 🔴 手机版重新接回「换词换鸟」（2026-09-05，用户：「上面的小头像也要跟着
         变换」）。上一版这里写死 0，理由是"点选版没有当前是第几个词"——轮播
         之后有了，就是 phase 落在哪一步。

         ⚠️ 不能沿用桌面那条 `wordIn[i] × (1 − wordIn[i+1])`。那条读的是"词的
         淡入进度"，而手机版首轮之后五个词恒为 1，算出来全是 0（最后一只恒 1），
         等于凭空点亮一只。手机版改读 birdMix：它由 phase 直接推出"现在是第几
         步、走了多少"，跟词还在不在无关。 */
      birdPics[i].style.opacity = replaying ? birdMix(i) : (wordIn[i] * (1 - next)).toFixed(3);
    }
    /* 🔴 三段接力，不是两段：Rive 眨眼鸟（开场站正中说话）→ idle（飞上去
       之后停在顶上）→ 第一个词的鸟。中间那段以前是 Rive 那只硬撑的，用户
       2026-08-29："它飞上去的时候…用我这个 idle bird，就是最后落下去的那
       只"。
       idle 用 `bo`（SINK 的进度）淡入、用第一个词淡出——两头都挂在已有的
       时钟上，不引入新常量：bo 在 SINK_A..SINK_B 之间从 0 到 1，正好就是
       "飞上去"这一下。 */
    /* 🔴 点选版**不做这场交接**，会眨眼的那只（Rive canvas）一直留着。
       用户点名：「上面的鸟它是一个初始状态会眨眼的鸟」。滚动版这里是三段接力
       Rive → idle 静帧 → 每个词自己的鸟，接力的理由是「换词要换鸟」；点选版
       没有当前词，接力没有对象，留下会眨眼的那只才是"待命"该有的样子。
       ⚠️ birdIdle 必须显式写 0：它是 JS 建的节点，默认样式里没有 opacity，
       不写就会和 canvas 叠成两只鸟。 */
    /* 🔴 会眨眼的那只（Rive canvas）现在**只属于 Hi 那一拍**。轮播一起步就把
       画面交给五只词头像（birdMix），否则两层鸟会叠在一起。
       交接用 bo：它正是"鸟从正中飞上去"那一下，和轮播起步是同一个时刻。 */
    birdIdle.style.opacity = replaying ? '0' : (bo * (1 - wordIn[0])).toFixed(3);
    birdCanvas.style.opacity = TAP ? (1 - openerBirdMix).toFixed(3) : (1 - bo).toFixed(3);

    /* （这里曾是 `translateY(lerp(0, -70, bo))` —— 小鸟退场后文案整块上移 70
       "补位"。小鸟现在不退场了，它就站在这叠词底下，那 70 就变成了纯粹的错位：
       实测把底对齐的词块从 scene 450 拽到 376，词和小鸟之间凭空多出 74px。
       跟着 bo 走的位移一并删掉，词块的位置现在完全由 meet.css 的 bottom 决定。 */

    // 冲向镜头：豆包的写法，前 2.9% 停顿，其余 94.2% 走 cubicBezier(.33,0,.67,1)
    const e = flyEase(clamp((f - 0.029) / 0.942, 0, 1));
    for (const name in FLY) {
      const fl = FLY[name];
      const el = cardEls[name].face;
      /* 🔴 手机上不做 Z 放大（用户 2026-08-30：「最后模糊放大的过程手机立刻崩溃」）。

         容器上有 perspective，所以 scaleZ 的物理含义是**把元素推向摄像机**。
         叠加 rotateX/rotateY 之后，元素的一角会逼近甚至穿过摄像机平面，投影
         尺寸趋向无穷——实测手机上飞越第 14 秒，一张卡的投影宽度冲到
         **559,728 px**，按 DPR 3 估算的纹理是 **3.8 TB**。那不是「有点大」，
         是合成器当场毙命。桌面 GPU 有余量、又被裁剪救了一把，所以一直没暴露。

         去掉 Z 之后卡片照常在 XY 上放大、照常旋转位移，只是不再冲向摄像机
         平面。观感上少了一点纵深，换的是这一段能跑完。
         ⚠️ 桌面保留 —— 但它同样在制造超大投影，只是暂时扛得住，见下面的
         DESKTOP 说明。 */
      /* 🔴 手机上飞越只用 2D：去掉 scaleZ 与 rotateX/rotateY，只留 scaleXY、
         rotateZ（2D 旋转，安全）和位移。

         容器上有 perspective，所以这三个属性都是**投影**变换：scaleZ 把元素
         推向摄像机，rotateX/rotateY 把它的一角转向摄像机。任何一个让某个角
         逼近摄像机平面，投影尺寸就趋向无穷。实测手机上飞越第 14 秒：
             原样            投影最宽 559,728px   纹理估算 3.8 TB
             只去掉 scaleZ   投影最宽  14,254px   纹理估算 1.3 TB
             再去掉 rx/ry    见下
         第一步只解决了一半——真正的量级是三个一起造出来的，得一起去掉。

         2D 之下卡片照常放大、照常旋转位移、照常淡出，少的是纵深感。
         桌面保留 3D：它同样在制造超大投影，只是 GPU 有余量、又被裁剪救了
         一把。⚠️ 那不等于安全，只是暂时没暴露——桌面显存更小的机器上同样
         会中招，值得单独排一次。 */
      const D3 = !PHONE_W;
      el.style.transform =
        `scaleX(${lerp(1, fl.sx, e)}) scaleY(${lerp(1, fl.sy, e)}) ` +
        (D3 ? `scaleZ(${lerp(1, fl.sz, e)}) ` : '') +
        (D3 ? `rotateX(${lerp(0, fl.rx, e)}deg) rotateY(${lerp(0, fl.ry, e)}deg) ` : '') +
        `rotateZ(${lerp(0, fl.rz, e)}deg) ` +
        `translateX(${lerp(0, fl.tx, e)}px) translateY(${lerp(0, fl.ty, e)}px)`;
      el.style.opacity = clamp(lerp(1, -0.5, f), 0, 1);
    }

    cardsEl.style.transform = `rotateZ(${driftAngle}deg)`;
    if (FLY_BLUR) cardsEl.style.filter = `blur(${lerp(0, FLY_BLUR, f)}px)`;
    if (FLY_BLUR) copyEl.style.filter = `blur(${lerp(0, FLY_BLUR, f)}px)`;
    copyEl.style.opacity = clamp(1 - f * 1.6, 0, 1);
  }

  /* ============ 带阻尼的播放头 ============ */
  const EASE = 0.075;       // 每 60fps 帧向目标靠拢的比例
  const MAX_SPEED = 1.14;   // 最快播多少「视口高」每秒（逐词段之外）
  /* 逐词那一段单独限速：全局调慢会把开场（小鸟落位、卡片铺开、气泡）一起
     拖沉，而那几拍读者并不需要停下来看。

     🔴 但**不能**调得明显低于真实滚动速度。落后是会累积的，试过 0.70：
     词 1、词 2 各满亮 1570ms（正是想要的），可到词 3 时读者已经滚到段尾，
     兜底阀门放开 6 倍，词 3/4/5 各只剩 **167ms**、间隔 125ms/116ms ——
     前两个慢得很舒服，后三个直接糊过去，比原来还糟。

     所以分工是：**距离**（WORD_SPAN）决定看多久，限速只负责把一次轻扫抹平，
     取值贴着正常滚动速度（实测约 1.3 视口/秒）。 */
  const WORD_SPEED = 1.0;
  let looping = false;
  let inView = false;

  /* 🔴 is-live 给 22 个元素挂 will-change，而 will-change 就是「预先建合成层」。
     content-visibility 跳过的是**渲染**，拦不住建层——两条都要收，才算真的把
     资源交还给浏览器。手机上播完（S 到终点）即摘，往回滚立刻恢复。 */
  const syncLive = () =>
    section.classList.toggle('is-live', inView && !(PHONE_W && spent));
  let last = 0;

  /* ============ 手机：自动播，不锁滚动 ============
     用户 2026-08-30 定的形态。改动**只有这一个函数** —— 播放头 S 本来就是
     个抽象量，全段 15 个节拍常量都是「S 的单位」，只有这里把滚动映射成 S。
     换成时间映射，下游一个数都不用动。

     🔴 不锁滚动：舞台钉住就自己播，你随时可以划走；划走了 IntersectionObserver
     停 rAF，划回来接着播（AUTO 不清零，除非整段退出视口上方）。想看的人会
     停下来看完，不想看的人不会被困住。

     🔴 舞台钉住之前仍然跟滚动（raw < 0 那支）。那一段是 hero 的影片变小鸟的
     接力，它跨在 hero 与 meet 的接缝上、必须跟手；只有钉住之后才切时间。

     0.62 单位/秒：END≈10.4，整段约 17 秒。比逐词段的限速 WORD_SPEED(1.0) 慢，
     所以那条限速在手机上不再生效——时间驱动之下播放头不可能"落后于滚动"。 */
  /* （这里曾是 AUTO_RATE / LOOP_HOLD / LOOP_FADE / autoS —— 手机端时间驱动
     自动播 + 循环的那一套。用户 2026-08-30 最后定为手动滑动，整套撤掉。
     撤的时候连带撤掉的：tick 里推进 autoS 与绕回的那几行、apply 里循环末尾
     的场景淡出、以及 rAF「循环没有播完这个时刻」的停机判据。） */

  /* 自动播的进度条。只在手机上建——桌面由手滑驱动，浏览器的滚动条就是进度。
     挂在 .meet__sticky 上（那是钉住的那一层，所以它跟着舞台停在屏上），
     而不是 .meet__scene——scene 带着 --meet-cover 的缩放，挂上去尺寸会跟着变。 */
  let progFill = null;
  if (PHONE_W && !REDUCED) {
    const sticky = section.querySelector('.meet__sticky');
    if (sticky) {
      const bar = document.createElement('div');
      bar.className = 'meet__prog';
      bar.setAttribute('aria-hidden', 'true');
      bar.innerHTML = '<i></i>';
      sticky.appendChild(bar);
      progFill = bar;
    }
  }

  /* 🔴 全站唯一的「滚动 → 播放头」映射，桌面手机同一支。

     手机上曾经在这里岔开过：2026-08-30 因为崩溃排查把它改成时间驱动（自动播），
     后来又加了循环。用户当天最后要求改回「手动滑动控制单词一个个出现」，所以
     这里回到一支，autoS / AUTO_RATE / LOOP_* 一并没了。

     值得留下的一句：当初改成时间驱动只动了这一个函数——下游 15 个节拍常量
     全是「S 的单位」，跟 S 从哪来无关。改回来同样只动这里，加上段高（见
     resize）和收资源的判据（见 apply）这两处**依赖驱动方式**的地方。 */
  /* ⚠️ 点选版夹到 TAP_END，不是 END。END 是滚动版的终点（含五段 WORD_SPAN），
     拿它当上限的话播放头会一路涨到 4 点几，而段落只有 2.2 屏高——读者滑到底
     播放头才走了一半，五个词永远淡不满。 */
  const target = () => desktopCompact ? CLEAR_A : clamp(-section.getBoundingClientRect().top / innerHeight, 0, TAP ? TAP_END : END);

  // Never register mobile snap points here: readers may stop to watch
  // the timed animation or swipe straight past it.
  if (!PHONE_W && window.snapAt) window.snapAt(section, () => {
    const pts = [];
    for (let i = 0; i < WORD_N; i++) pts.push((WORD_START + (i + 0.5) * WORD_SPAN) * innerHeight);
    pts.push(CLEAR_B * innerHeight);
    return pts;
  });

  /* 🔴 按时间推进，不按帧。写成「每帧走 EASE、每帧最多走 MAX_STEP」的话，
     播放速度就跟着刷新率走：ProMotion 的 120Hz 上整段会以两倍速冲过去，
     而掉帧的机器上又慢得像卡住。dt 上限 64ms 是防止切回标签页时
     积压的一大段时间被一次性兑现成一个跳变。 */
  let lastT = null;                 // 上一帧的 target，用来分辨「目标跳了」和「播放头落后了」
  function tick(now) {
    if (!inView || (TAP && REDUCED)) {
      // Finish offscreen cleanup once; do not leave a recurring rAF alive.
      apply();
      looping = false;
      last = 0;
      return;
    }
    const dt = last ? Math.min(64, now - last) : 16.7;
    last = now;

    const t = target();
    let d = t - S;

    /* 🔴 跳变太大就直接接上，不要爬（用户 2026-08-30：「family hub 刚滑到的时候
       是空白的」的桌面那一半）。

       阻尼是给**连续滚动**用的。位置发生跳变时——刷新页面保留滚动位置、锚点
       跳转、浏览器前进后退——播放头要爬好几屏才追得上，而 target() 早已封顶，
       于是它停在半路：实测桌面跳到 hub 之后 fly 卡在 0.64，hub 整段就只有
       64% 不透明，而且不再变化。刷新保留滚动位置是很常见的路径，尤其在页面
       崩溃重载之后。

       2 屏是判据：真实滚动一帧走不了这么多（实测最快约 1.3 视口/秒 ≈ 0.02
       屏/帧），所以这个分支只会被真正的跳变命中，不会误伤手滑。

       🔴 判的是**目标自己**一帧跳了多远，不是 `d`（目标与播放头的落差）。
       用 `d` 是错的，而且恰恰在逐词那一段错得最狠：那一段的限速
       （WORD_SPEED = 1.0 视口/秒）**故意**让播放头落后于滚动——这正是「粘滞」
       的来源。连续快滑时落差自己就会攒过 2 屏，于是这条本该只在刷新/锚点跳转
       时触发的分支被误命中，播放头一帧瞬移到目标，一次跨过两三个词。

       实测（每 700ms 扫 1600px）：五个词的点亮时刻是 0@1426 1@1426，然后
       2@2859 3@2859 4@2859 —— 间隔 **0ms**，三个词同一帧。用户 2026-08-31：
       「有的时候会滑一下就滑了两个词掉，感觉这个阻尼做的不是特别好」。
       改判 target 的帧间增量之后，落差再大也只由限速慢慢追，粘滞才真的生效。 */
    const dT = lastT == null ? 0 : t - lastT;
    lastT = t;
    if (Math.abs(dT) > 2) { S = t; d = 0; }
    /* （这里曾有一条"S 越过 TAP_TRIG 才起播"的判据。改成一直轮播之后没有起播
       这回事了，整条删除。它留下的教训仍然有效并且已经写进下面那条停机判据：
       任何**时间驱动**的东西都要防着 rAF 在播放头追平滚动时熄火。） */
    /* 追平就停。两边都由滚动驱动，没滚动就没有新目标；再动由 scroll 上挂的
       kick() 叫醒。（时间驱动那一版这里必须多一个条件，因为时间会自己往前走。） */
    /* 🔴 `&& !TAP` —— 上面那句注释自己预言了这一条：「时间驱动那一版这里必须
       多一个条件，因为时间会自己往前走」。手机版的五个词现在是**一直轮播**的
       时间动画，播放头追平滚动只说明"读者不滚了"，不说明"没东西要动了"。
       不加这个条件实测词会冻在 [1,1,1,0.32,0] 再也不动。
       ⚠️ 这意味着这一段可见时 rAF 一直在跑。挡在外面的是 inView / kick()：
       段落滚出视口就不再 kick，循环随之停。 */
    if (Math.abs(d) < 0.0004 && !TAP && !desktopReplay) {
      S = t;
      apply();
      looping = false;
      last = 0;
      return;
    }
    const k = 1 - Math.pow(1 - EASE, dt / 16.7);
    /* 🔴 飞越那一段不限速。MAX_SPEED 是给「一次滑动别跨过好几个词」用的
       ——那是逐词揭示才需要的粘滞；而飞越是段尾一次连续的转场，限速在这里
       只会让它**在舞台已经滚走之后**才播完。

       实测（1440×900，每 260ms 滚 300px ≈ 1.28 视口/秒，比 MAX_SPEED 的
       1.14 快）：舞台已经到 y=-1003 了，飞越才走到 blur 45/50——卡片是在
       屏幕外糊完的，读者根本没看见。播放头一旦落后于滚动就再也追不回来，
       因为 cap 恒小于滚动速度。

       放开后由 EASE 收敛（0.075/帧，约 0.2s 追上），飞越就在舞台还钉着的
       时候走完，正好交给 hub。逐词那一段的粘滞一点没动。 */
    /* 🔴 兜底阀门的判据是「舞台还能钉多久」，不是「target 过没过 FLY_A」。
       后者在有 SLACK 之后会提前整整 SLACK 屏放开：读者刚把 target 顶到封顶、
       余量一点没用上，阀门就开了，词照样糊过去。这里直接量段尾离视口底还有
       多远，不足 0.35 屏才放开，把没播完的部分在**舞台还在画面里**时补完。 */
    const pinLeft = (section.getBoundingClientRect().bottom - innerHeight) / innerHeight;
    const inFly = S >= FLY_A || pinLeft < 0.35;
    const inWords = !inFly && (t >= WORD_START || S >= WORD_START);
    const cap = (inFly ? MAX_SPEED * 6 : inWords ? WORD_SPEED : MAX_SPEED) * dt / 1000;
    /* 🔴 2026-09-04：限速只管**往前**，倒着走不限。
       用户：「现在从 privacy 往回滑到 meet nestie 的时候一开始是空的」。

       原因就在这条 clamp 原本是对称的（-cap..cap）。粘滞的用途上面写得很清楚
       ——「给『一次滑动别跨过好几个词』用的」——那是**往下读**才需要的保证：
       别让一次猛滑跳过没看的词。倒着滚没有这个需求，而对称的限速在这里只有
       坏处：读者从 privacy 往回滚时，播放头还停在段尾（卡片已飞走、词已清空）
       的状态，要按 1.0 视口/秒慢慢往回爬，于是舞台先亮出一片空的。

       这跟文件里已有的两条是同一族问题，修法也同源：
         · 「family hub 刚滑到的时候是空白的」→ 上面 dT > 2 的跳变直连
         · 「飞越在舞台滚走之后才播完」      → inFly 放开限速
       都是「限速在它没道理管的场合造成了落后」。倒放这条是第三例。

       倒向仍留一个上限（MAX_SPEED × 6），不直接瞬移：那样会把逐词那段的
       退场一帧跨完，反而看不出词是怎么退的。按上面 inFly 那段的实测，
       这个量级由 EASE 收敛约需 0.2s，人眼读作「立刻回到位」。 */
    /* 🔴 2026-09-04：倒向**彻底不限速**了（原来还留着 MAX_SPEED × 6）。

       留那个上限的理由写在上面：「不然会把逐词那段的退场一帧跨完，看不出词是
       怎么退的」。但同日词已经改成**看过就不再退**（wordsDone），根本没有退场
       可看了，这个上限就只剩坏处。用户：「往回滑的时候阻尼还在，我觉得往回滑
       动的时候不应该有」。

       去掉之后倒向仍由 EASE 收敛（0.075/帧，约 0.2s），不是瞬移。 */
    S += Math.min(d * k, cap);
    // Loop only while the phone scene is readable. Selection pauses the
    // clock, and wrapping reuses the existing cards and canvas.
    if (TAP && tapped === null && phoneClockOn()) {
      playT += dt / 1000;
      if (playT >= TAP_LOOP) {
        playT %= TAP_LOOP;
        wordsDone = false;
      }
    }
    if (desktopReplay && !document.hidden) {
      const r = stickyEl.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) desktopReplayT += dt / 1000;
    }
    apply();
    requestAnimationFrame(tick);
  }

  const kick = () => {
    if (!inView || looping) return;
    looping = true;
    requestAnimationFrame(tick);
  };

  /* 🔴 只在这一段露头时才跑 rAF。整页还有 hero / hub / drift 几套滚动动画，
     一个常驻的空转循环就是白送掉的一帧预算。IntersectionObserver 兼管漂移的
     起停 —— 漂移是时间驱动的，滚过去了还转就是纯浪费。 */
  new IntersectionObserver(
    entries => {
      const wasInView = inView;
      inView = entries[0].isIntersecting;
      if (inView) {
        // An unselected scene welcomes the reader again on reentry.
        if (PHONE_W && !wasInView && tapped === null) {
          playT = 0;
          wordsDone = false;
          last = 0;
        }
        /* 手机没有 Hero→Meet 的影片接力（RELAY_OFF=true）。Meet 真正进入顶部
           可视带时先让 Hero 清空视频解码缓冲，再启动 Rive 与卡片漂移，避免两组
           重资源在 Safari 的同一帧叠加。 */
        if (PHONE_W && typeof window.__releaseHeroFilms === 'function') {
          window.__releaseHeroFilms();
        }
        if (!driftRAF) { driftT0 = 0; driftRAF = requestAnimationFrame(driftFrame); }
        kick();
      } else {
        /* 段落不在视野时 apply() 不跑，--meet-fly 会冻在最后一帧。往下滚过去
           要给 1（hub 该完全可见），往上退回去要给 0。 */
        setFly(section.getBoundingClientRect().bottom < 0 ? 1 : 0);
        relayOff(false);  // 见 relayOff 的注释：不收就会把 hero 的 film 永久藏住
        if (driftRAF) { cancelAnimationFrame(driftRAF); driftRAF = 0; }
      }

      /* 🔴 Rive 自己不认识视口。autoplay 起来之后它就一直在画，这一页有
         46 屏，读者停在任何别的段落时那只鸟都在后台按帧渲染 —— 实测这一项
         就能让一个空闲的标签页常驻烧掉可观的 CPU。nestie.js 把它的 WebGL
         气泡用同一个 observer 管了，却漏了 Rive 实例本身；这里一并管上。 */
      if (riveBird) {
        try { inView ? riveBird.play() : riveBird.pause(); } catch (e) {}
      }

      /* 🔴 will-change 只在这一段活着的时候挂。11 张卡各写一句
         will-change:transform,filter 等于让合成器**长期**为它们各留一层，
         离屏了也占着显存和合成预算。挂 class 而不是写死在 CSS 里，才是
         「这段要动了」这个语义。 */
      /* is-live 的实际开合在 apply() 里（每帧跑），这里只记状态——观察器不会
         因为「播放头到了终点」再触发一次，写在这里的条件永远不会被重新求值。
         这正是第一版没生效的原因：spent 置上了，is-live 却一直挂着。 */
      syncLive();
    },
    /* With the Hero relay removed, desktop only warms the scene shortly
       before it arrives instead of starting it 1.5 screens early. */
    { rootMargin: PHONE_W ? '0px 0px -75% 0px' : '25% 0px' }
  ).observe(section);

  /* ============ 接力段：轻扫一下就到位 ============
     用户 2026-08-28：「不想要用户慢慢地去滑，而是滑动一下就变成这个，往上滑
     一下就变成那个，像我们首页的 hero video 一样」。hero.js（glide）和
     intro.js（settle）各已有一份同型实现，这是第三份 —— 机制照抄，窗口和
     时长按这一段另配。

     🔴 判**方向**，不判远近：往下滚一定走完变身，往上滚一定还原成片子，不管
     实际停在哪。它匹配的是眼睛已经认定的方向。推导见 intro.js 里那段长注释。
     🔴 不是 CSS scroll-snap —— 那会作用到整个文档，跟这页其它钉住的段落全都
     打架；这里只管一个 990px 的窗口。
     🔴 也不是 scrollTo({behavior:'smooth'}) —— 交给浏览器就收不回来，中途改
     主意的读者会被拖着走。自己按 rAF/Lenis 动，任何新输入下一帧就能叫停，
     这是「协助」与「劫持」的分界。 */
  const SNAP_QUIET = 150;   // 静默多久才算「这一下滑完了」——要盖过触控板惯性，
                            // 它在手指离开后还会持续派发 scroll
  const SNAP_EDGE  = 8;     // 两端各留的余量：已经到位就不再推一下
  /* 990px 一段 ≈ 700ms。系数比 hero/intro 的 0.24 大：那两处是「纠正到最近的
     档」，越快越好；这里是一次形变，太快就只剩一次闪白。 */
  const snapMs = (px) => Math.max(420, Math.min(1000, 320 + Math.abs(px) * 0.38));
  const snapEase = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let snapQuiet = null, snapRAF = 0, snapping = false;
  let snapLastY = window.scrollY, snapDir = 1;

  function stopSnap() {
    if (snapRAF) cancelAnimationFrame(snapRAF);
    snapRAF = 0; snapping = false;
  }

  function snapTo(to) {
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) return;
    const dur = snapMs(to - from);
    snapping = true;

    /* 🔴 有 Lenis 就把这一步交给它。两个动画同时写 scrollTop 是拔河，snap 会
       抖、会落短。它自己的 scrollTo 仍可被读者打断（没传 lock），正是我们要的
       那个性质。

       🔴 安全定时器不是保险丝：被打断的 tween **不会**回调 onComplete，而
       `snapping` 挡着整套机制 —— 少了它，一次被打断的 snap 会让这一段此后
       再也不响应。 */
    if (window.lenis) {
      let done = false;
      const finish = () => { if (!done) { done = true; stopSnap(); } };
      window.lenis.scrollTo(to, { duration: dur / 1000, easing: snapEase, force: true, onComplete: finish });
      setTimeout(finish, dur + 220);
      return;
    }
    const t0 = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, from + (to - from) * snapEase(t));
      if (t < 1) snapRAF = requestAnimationFrame(step);
      else stopSnap();
    })(t0);
  }

  /* 🔴 用 rect + scrollY 而不是 offsetTop：offsetTop 是相对 offsetParent 的，
     哪天这一段外面套上个 position 祖先，窗口就会整体错位而且一点声音都没有。 */
  const relayEdges = () => {
    const top = section.getBoundingClientRect().top + window.scrollY;
    return [top + RELAY_A * innerHeight,    // 片子完好（= hero 最后一个锚点）
            top + RELAY_B * innerHeight];   // 小鸟成形
  };

  function maybeSnap() {
    if (PHONE_W || desktopCompact || snapDir < 0 || RELAY_OFF || REDUCED || snapping) return;
    const [a, b] = relayEdges();
    const y = window.scrollY;
    if (y > a + SNAP_EDGE && y < b - SNAP_EDGE) snapTo(snapDir > 0 ? b : a);
  }

  addEventListener('scroll', () => {
    const y = window.scrollY;
    /* 🔴 我们自己的 snap 也会派发 scroll。从里面读方向 = 在动画内部重新武装
       定时器，页面会一路爬下去停不住。 */
    if (snapping) { snapLastY = y; return; }
    const d = y - snapLastY;
    snapLastY = y;
    if (Math.abs(d) > 1) snapDir = d > 0 ? 1 : -1;

    /* 🔴 按**每帧速度**判「这一下滑完了」，不是按「有没有 scroll 事件」。
       Lenis 在惯性收尾时每帧都派发 scroll，哪怕这一帧只挪了 0.4px；照着
       事件重新武装定时器，就要等它彻底静止才轮到我们。实测：一次三格轻扫，
       Lenis 从 18000 滑到 18601 用了 1.45s，而最后 500ms 里页面**看上去是
       停住的**——片子卡在半路 360px 宽，正是用户抱怨的那个「慢慢滑」的样子，
       只是短了一点。改判速度之后 snap 提前约 0.5s 接手。
       2px/帧 ≈ 120px/s：比 Lenis 的收尾尾巴快，比任何真实的慢速拖动慢。 */
    if (Math.abs(d) < 2) return;
    clearTimeout(snapQuiet);
    snapQuiet = setTimeout(maybeSnap, SNAP_QUIET);
  }, { passive: true });

  /* 谁一碰，这页就还给谁 */
  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(e =>
    addEventListener(e, () => { clearTimeout(snapQuiet); stopSnap(); }, { passive: true }));

  /* Desktop return: after the five-word story, retire the sticky runway.
     The compact scene repeats its highlights only while visible. */
  let replayLastY = window.scrollY;
  addEventListener('scroll', () => {
    const y = window.scrollY;
    const goingUp = y < replayLastY - 1;
    replayLastY = y;
    if (!PHONE_W && !REDUCED && !desktopCompact && goingUp && wordsDone) {
      // Retire the first-pass runway on return. Remove only the consumed
      // distance above the viewport, preserving the visible stage (or the
      // section below it) at the same screen position. Keep this compact for
      // the rest of this page visit, including another trip down from Hero.
      const r = section.getBoundingClientRect();
      const top = r.top + y;
      desktopCompact = true;
      desktopReplay = true;
      section.classList.add('is-desktop-replay');
      resize();
      const removed = r.height - section.getBoundingClientRect().height;
      const nextY = y - clamp(y - top, 0, Math.max(0, removed));
      S = CLEAR_A;
      lastT = CLEAR_A;
      replayLastY = snapLastY = nextY;
      if (window.lenis) {
        window.lenis.resize();
        window.lenis.scrollTo(nextY, { immediate: true, force: true });
      } else window.scrollTo(0, nextY);
      apply();
    }
    kick();
  }, { passive: true });
  addEventListener('resize', () => { resize(); apply(); });

  /* ============ 启动 ============ */
  resize();
  bootBird();

  if (REDUCED) {
    // 成品状态：词都在、卡都清晰、不漂移、不随滚动动
    S = CLEAR_B;
    apply();
  } else {
    apply();
  }
})();
