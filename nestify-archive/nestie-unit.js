/* ============================================================
   THE NESTIE UNIT — the object itself, and nothing about where it
   is pointed.

   🔴 THIS FILE EXISTS SO THERE IS ONE OF IT. The housing is now
   drawn in two places — the device page's hero and the home page's
   hub, at the moment it docks onto the wall — and two copies of a
   bevel, a rim ratio and an anodising colour drift apart the first
   time one of them is tuned. Everything that describes the PRODUCT
   lives here; everything that describes a SHOT lives in the file
   doing the shooting.

   The split is: geometry, materials and the room are the object.
   Camera, placement, shadow, entrance and scroll are not.

   🔴 THERE IS NO MODEL FILE, AND THERE DOES NOT NEED TO BE. Nestie
   is a rounded slab with a raised rim: two extruded profiles and a
   picture. That is a shape a browser can build from numbers alone.

   🔴 THREE LAYERS: a blue metal rim that STANDS PROUD, a white face
   recessed behind it, the screen inside that. Two extrusions, not
   one — the rim is a ring extruded deeper than the slab it
   surrounds, so it has a top surface of its own and drops a hairline
   of shadow onto the white. Earlier versions collapsed the first two
   into a single white slab and none of them read as hardware; a flat
   face has one outline, and this object has two.
   ============================================================ */
window.NestieUnit = (function () {
  'use strict';

  /* ---------- the object, in metres-ish ----------
     The two bands are measured against the SCREEN, not against each other
     or against the body, so the picture stays the anchor for everything —
     including whatever the caller frames against. */
  const SCREEN_W = 1.6;
  const SCREEN_H = 0.9;
  const WHITE = SCREEN_W * 0.038;   // the white face, inside the lip
  const RIM = SCREEN_W * 0.022;     // the blue band, outside it
  const BODY_W = SCREEN_W + (WHITE + RIM) * 2;   // 1.792
  const BODY_H = SCREEN_H + (WHITE + RIM) * 2;   // 1.092
  const RADIUS = BODY_W * 0.052;

  /* 🔴 A SHARE OF THE SCREEN, not a subtraction from the body's radius.
     The concentric version is geometrically pure and goes NEGATIVE the
     moment a band widens, clamping to zero and quietly putting four
     square corners back on the picture. */
  const SCREEN_R = SCREEN_W * 0.022;

  /* 🔴 THICKNESS at 6.8% of the width. A slate is about 4%; this thing
     stands on a counter. At 5.2 the raised lip and the side wall read as
     an outline rather than as a part you could pick up. */
  const DEPTH = BODY_W * 0.068;

  /* 🔴 HOW FAR THE RIM STANDS PROUD — a fifth of the depth. Enough that
     the lip reads as a separate part in the silhouette and throws its
     line of shadow inward, not so much that the object looks like a
     picture frame with a photo dropped in it. */
  const LIP = DEPTH * 0.20;

  /* a small chamfer, not a roll. Machined edges: light stops at a line.
     It has to stay under half the rim's width or the lip's flat top is
     eaten from both sides and the band turns into a bead. */
  const BEVEL = 0.006;
  const FRONT = DEPTH / 2;          // the white face

  const DIMS = {
    SCREEN_W, SCREEN_H, WHITE, RIM,
    BODY_W, BODY_H, RADIUS, SCREEN_R,
    DEPTH, LIP, BEVEL, FRONT,
  };

  /* ---------- the room ----------
     🔴 THIS IS THE MATERIAL, as much as the material block is. A white
     dielectric takes its shape from how the light FALLS OFF across it and
     the metal rim takes its shape from what it REFLECTS; both of them are
     this room, one as a gradient and one as an image. Point either at a
     smooth grey sky and you get a smooth grey slab.

     It is a photographic set, and every element earns its place:

       · a HORIZON, hard, and LOW at 0.62. This decides whether the object
         is light or dark and the first pass got it wrong: a horizon at
         the middle puts half the sphere below it, a face tilted a few
         degrees down looks into that half, and it came out a flat mid
         grey. A metal is exactly as bright as what it is pointed at.
       · THREE SOFTBOXES, and the KEY IS ON THE RIGHT. Their EDGES are
         the point — a rectangle with a defined edge, reflected in a
         chamfer, is the bright line down an anodised rim; a radial blob
         is a smudge.
       · a FLOOR that is dark but not crushed. #3d3b39 at its darkest is
         far darker than anything on either page and still gives the
         chamfer an underside; the first pass used near-black and the
         whole lower third went to one dead value, which reads as a hole.

     Everything is drawn with fillRect and gradients on a 2D canvas, which
     matters for one non-obvious reason: it is same-origin however the
     page is opened. An .hdr fetched off the disk would be blocked on
     file:// exactly like a screenshot is. */
  function roomTexture(THREE) {
    const W = 1024;
    const H = 512;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    const sky = g.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0.00, '#a9aeb5');   // ceiling corners, not black
    sky.addColorStop(0.30, '#dde2e8');
    sky.addColorStop(1.00, '#f6f8fb');   // brightest just above the horizon
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H * 0.62);

    const floor = g.createLinearGradient(0, H * 0.62, 0, H);
    floor.addColorStop(0.00, '#6e6a66');
    floor.addColorStop(0.45, '#4a4744');
    floor.addColorStop(1.00, '#3d3b39');
    g.fillStyle = floor;
    g.fillRect(0, H * 0.62, W, H * 0.38);

    const bounce = g.createRadialGradient(W * 0.72, H * 0.70, 4, W * 0.72, H * 0.70, W * 0.22);
    bounce.addColorStop(0.0, 'rgba(255,238,218,.50)');
    bounce.addColorStop(1.0, 'rgba(255,238,218,0)');
    g.fillStyle = bounce;
    g.fillRect(0, H * 0.62, W, H * 0.38);

    /* a hard core inside a feathered surround, because a pure radial has
       no edge and an un-feathered rect aliases into a stair the moment it
       is reflected across a curve */
    function softbox(cx, cy, w, h, strength, tint) {
      const feather = g.createRadialGradient(cx, cy, Math.min(w, h) * 0.35,
                                             cx, cy, Math.max(w, h) * 0.95);
      feather.addColorStop(0.0, 'rgba(' + tint + ',' + strength + ')');
      feather.addColorStop(1.0, 'rgba(' + tint + ',0)');
      g.fillStyle = feather;
      g.fillRect(cx - w, cy - h, w * 2, h * 2);

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(' + tint + ',' + strength + ')';
      /* 🔴 roundRect is Chrome 99 / Safari 16.4 / Firefox 112. Older than
         that and it is not a rounded softbox, it is a TypeError that
         unwinds whichever IIFE called this. A square softbox is fine. */
      if (g.roundRect) {
        g.beginPath();
        g.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.3);
        g.fill();
      } else {
        g.fillRect(cx - w / 2, cy - h / 2, w, h);
      }
      g.restore();
    }

    softbox(W * 0.74, H * 0.38, W * 0.085, H * 0.44, 0.95, '255,253,250');  // key, front-right
    softbox(W * 0.19, H * 0.42, W * 0.060, H * 0.30, 0.62, '236,244,255');  // fill, front-left
    softbox(W * 0.50, H * 0.11, W * 0.62, H * 0.07, 0.70, '255,255,255');   // overhead strip

    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* the PMREM pass needs a renderer, so this is a call rather than a
     constant — and the source texture is disposed straight after, because
     what the scene keeps is the convolved cubemap, not the canvas */
  function makeEnvironment(THREE, renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = roomTexture(THREE);
    const env = pmrem.fromEquirectangular(room).texture;
    room.dispose();
    pmrem.dispose();
    return env;
  }

  /* ---------- the profiles ----------
     one path builder, used for the outside, the aperture and the ring.
     `Ctor` because a hole has to be a Path, not a Shape. */
  function roundedRect(THREE, w, h, r, Ctor) {
    const s = new (Ctor || THREE.Shape)();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /* 🔴 ShapeGeometry's UVs are the vertex POSITIONS, not a 0–1 map — the
     shape is centred on the origin, so straight out of the constructor
     the texture is sampled from -0.8..0.8 and the picture is mostly
     clamped edge pixels. They have to be remapped over the bounding box
     by hand; this is the whole reason a plane was used at first. A plane
     is wrong because it has four square corners inside a case that has
     none — four little wedges of wallpaper poking into the radius, which
     is the one detail that says "image pasted onto a render". */
  function panelGeo(THREE, w, h, r) {
    const g = new THREE.ShapeGeometry(roundedRect(THREE, w, h, r), 16);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
    }
    uv.needsUpdate = true;
    return g;
  }

  /* geometry and the two case materials are built once and shared by
     every unit; only the screen material is per-unit, because two units
     showing the same picture is the one thing this arrangement must not
     do */
  let cache = null;

  function parts(THREE) {
    if (cache) return cache;

    /* 🔴 TWO EXTRUSIONS, ONE INSIDE THE OTHER, because the rim has to be
       a separate PART and not a painted band. A ring extruded deeper than
       the slab it surrounds is the only way to get a lip that rises above
       the white face, shows its own top surface to the light, and drops a
       hairline of shadow onto the white just inside it. Colouring a flat
       face in two tones gets you a sticker; the silhouette gives it away.

       🔴 THE SLAB IS OVERSIZED ON PURPOSE. It runs a hair WIDER than the
       ring's inner hole so the two interlock. Sized to meet exactly, the
       coincident surfaces z-fight and the seam flickers as the object
       turns; sized short, daylight shows through the join.

       🔴 The bevel is SUBTRACTED from every profile, not added to it.
       Extrude's bevel grows a shape outward — and grows a HOLE inward —
       so each contour is fed BEVEL short of its finished size. Get this
       wrong on the ring's inner edge and the lip creeps over the white. */
    const OVERLAP = 0.004;
    const INNER_W = BODY_W - RIM * 2;
    const INNER_H = BODY_H - RIM * 2;
    const INNER_R = RADIUS - RIM;     // concentric with the outer corner

    const bodyGeo = new THREE.ExtrudeGeometry(
      roundedRect(THREE, INNER_W + OVERLAP - BEVEL * 2,
                  INNER_H + OVERLAP - BEVEL * 2, INNER_R - BEVEL),
      {
        depth: DEPTH - BEVEL * 2,
        bevelEnabled: true,
        bevelThickness: BEVEL,
        bevelSize: BEVEL,
        bevelSegments: 3,
        curveSegments: 26,
      },
    );
    bodyGeo.center();

    const rimShape = roundedRect(THREE, BODY_W - BEVEL * 2, BODY_H - BEVEL * 2, RADIUS - BEVEL);
    rimShape.holes.push(
      roundedRect(THREE, INNER_W + BEVEL * 2, INNER_H + BEVEL * 2, INNER_R + BEVEL, THREE.Path),
    );
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: DEPTH + LIP - BEVEL * 2,
      bevelEnabled: true,
      bevelThickness: BEVEL,
      bevelSize: BEVEL,
      /* four, not three: this edge is the object's outline and the one
         thing the eye tracks as it turns. Facets show. */
      bevelSegments: 4,
      curveSegments: 26,
    });
    rimGeo.center();

    /* ---------- two materials, on two parts ----------
       🔴 metalness is a SWITCH, not a dial. It selects between two BRDFs
       and a value in between is meant for texel-level transitions, not
       for taste: ask for 0.4 and you get an albedo scaled toward black
       with a tinted specular over it — dirty, not metallic. So the white
       part is 0 and the rim is 1, and nothing is in between.

       What makes the FACE feel like a hard coated panel rather than a
       moulding: roughness 0.44 (softboxes arrive as shapes with edges,
       not a wash); a clearcoat that is TIGHT rather than strong; a
       specular tinted one step COOL (a dielectric's specular is white by
       definition and tinting it is a lie, but it is the lie every product
       render tells, because the eye reads a cool highlight on a warm body
       as a hard surface); and anisotropy, the one term doing physics
       rather than persuasion — it smears the highlight along an axis,
       which is what a blasted finish does to reflected light.

       🔴 NOT #ffffff. A diffuse surface at pure white has nothing above
       it: the lit face clips, the chamfer flattens, the part becomes a
       silhouette. #f2f1ed leaves the highlights somewhere to climb, and
       sits warm against the cool rim — a warm face beside a cool edge
       reads as two materials, which it is. */
    /* 🔴 2026-09-04：0xf2f1ed → 0xfcfbf8，envMapIntensity 1.15 → 1.5。

       上面那条「不要纯白」仍然成立，也仍然是这里没有用 #ffffff 的原因。但
       f2f1ed 配 1.15 的环境强度渲染出来只有 **(222,221,220)**，而它紧挨着的
       屏幕是纸白 255——两者一并排，机身内圈那道边就读成灰黄。用户 2026-09-04：
       「你用的是一个比较灰暗的黄色，本来应该是边缘是白色的，跟纸面里面的颜色
       一样。」

       🔴 真正的瓶颈不是材质，是**色调映射**。渲染器挂着 ACESFilmicToneMapping
       （hub3d.js，曝光 1.04），ACES 把高光压得很狠：把 color 从 f2f1ed 推到
       fcfbf8、环境强度 1.15→1.5，实测内圈只从 222 涨到 225。而屏幕之所以能是
       纯白，是因为它的材质写了 `toneMapped: false`，整个绕开了这条曲线。

       所以提亮走**自发光**：只给这一块材质加一个底，不动全局曝光（那会把机身
       涂层和高光一起吹掉），也不关它的色调映射（关掉会让它和还在 ACES 下的
       涂层、金属圈脱节，像贴上去的）。

       ⚠️ 别再去调 color 或 envMapIntensity 找亮度——那两个已经到顶了，量过。 */
    const caseMat = new THREE.MeshPhysicalMaterial({
      color: 0xfcfbf8,
      metalness: 0.0,
      roughness: 0.44,
      clearcoat: 0.34,
      clearcoatRoughness: 0.30,
      specularIntensity: 1.0,
      specularColor: 0xe8eef5,
      anisotropy: 0.28,
      anisotropyRotation: Math.PI / 2,
      envMapIntensity: 1.5,
      emissive: 0xfcfbf8,
      emissiveIntensity: 0.9,
    });

    /* 🔴 ANODISING IS A TINT OVER METAL, not a coat of paint on it — a
       dyed oxide layer a few microns thick. On a metal the colour term IS
       the reflection's tint, so this is not "how blue the part is", it is
       how much of each channel the surface hands back: most of the blue,
       rather less of the red. That is why anodised blue looks like a pale
       metal indoors and only declares itself against white. Push the
       saturation and it stops being anodising and becomes a painted
       bezel, which is the plastic problem arriving by another road.

       Roughness 0.26 — satin, not mirror. A polished rim throws a hard
       white line that travels faster than the object turns and reads as a
       rendering artefact. */
    const rimMat = new THREE.MeshPhysicalMaterial({
      color: 0xaec8de,
      metalness: 1.0,
      roughness: 0.26,
      envMapIntensity: 1.3,
    });

    const screenGeo = panelGeo(THREE, SCREEN_W, SCREEN_H, SCREEN_R);

    cache = { bodyGeo, rimGeo, screenGeo, caseMat, rimMat };
    return cache;
  }

  /* ---------- one unit ----------
     🔴 NO SHEET OF GLASS, no dark gasket, and no panel mask. All three
     were built and all three are out:

       glass    an edge-to-edge black sheet over the face, from "the
                front of a modern device is one sheet of glass". True of
                a tablet; it turned the case into a black slab. Then a
                reflective layer over the picture — physically the right
                decomposition, and a sheet of reflection sliding across
                the thing the page exists to show.
       gasket   a fine dark line at the screen's edge, added because a
                white case running into a white app leaves nothing to say
                where the screen ends. The RIM says it now.
       mask     the picture inset with the gasket showing through, as an
                LCD's unlit margin. Measured against the white bezel it
                came out nearly twice as wide as the frame outside it.

     If a dark glossy surface ever comes back, the term to reach for is
     envMapIntensity, not the colour: a near-mirror shows you the room,
     not itself, which is why 0x08090b once rendered light grey. */
  function makeUnit(THREE) {
    const p = parts(THREE);
    const unit = new THREE.Group();

    unit.add(new THREE.Mesh(p.bodyGeo, p.caseMat));

    /* 🔴 THE RING SITS FORWARD BY HALF THE LIP, which is what puts all of
       its extra depth at the FRONT. Both extrusions are centred on their
       own origin, so leaving the ring where it lands would split the lip
       evenly and hang half of it off the back, where it would read as a
       foot rather than as a raised edge. Offset by LIP/2 and the backs
       are flush. */
    const rim = new THREE.Mesh(p.rimGeo, p.rimMat);
    /* 🔴 NAMED, like the screen — a clone shares its materials by
       reference, so anything that wants one housing's rim to differ from
       another's has to be able to FIND the mesh. Nothing does today (the
       black back rim was tried and dropped, see nestie3d.js), and the name
       stays because it costs nothing and because getObjectByName is also
       how a dropped-in .glb gets inspected. */
    rim.name = 'rim';
    rim.position.z = LIP / 2;
    unit.add(rim);

    /* the UI. MeshBasic and toneMapped:false on purpose — this is a
       screen, it is its own light source, and a screenshot that has been
       through the scene's exposure is a screenshot with the wrong colours
       in it. Everything else in here is lit; this is not. */
    const screenMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const screen = new THREE.Mesh(p.screenGeo, screenMat);
    screen.name = 'screen';
    screen.position.z = FRONT + 0.0009;
    unit.add(screen);

    return { unit, screenMat };
  }

  /* ---------- the same rim, in the other two finishes ----------
     The home page's hub shows the device in three rooms, one after another
     (see the room layers in hub.css), and the housing changes finish with
     the room: anodised blue in the first, a painted deep green in the
     second, wood in the third. These are FINISHES OF THE PRODUCT, so they
     are described here; WHEN each one is on is the hub's business and lives
     in hub3d.js.

     🔴 EXTRA MESHES ON THE SAME GEOMETRY, cross-faded over the blue one —
     not the blue material re-tinted. metalness is a switch (see the note on
     caseMat) and both of these are on the other side of it: driving one
     material from 1 to 0 walks it through half a second of albedo-scaled-
     toward-black with a tinted specular over it, which is neither metal nor
     paint but is exactly what a "dirty" material looks like. Separate
     meshes let each finish be rendered by the BRDF it belongs to and let
     the blend happen in the framebuffer, where a dissolve belongs.

     🔴 polygonOffset, because the rings are coincident to the last bit.
     Without it the depth test between them is a coin toss per fragment and
     the band stipples. -1/-1 is the smallest nudge that settles it;
     depthWrite is off because a blended overlay has no business in the
     depth buffer.

     The cost is two extra draws of a thin ring for as long as the page is
     open. The alternative — adding and removing meshes around each fade —
     buys back a ring's worth of fill and pays for it with a state that can
     disagree with the attribute that drives it.

     🔴 NO GRAIN OR FLAKE MAP, and that is measured rather than lazy.
     ExtrudeGeometry hands out world POSITIONS as UVs, so a tiled texture
     would have to be mapped by hand around a ring whose four sides run in
     two directions — and the band is ~8px wide on screen at the dock's .37
     scale, where any texture is a texture of noise. What reads as wood or
     as paint at that size is the colour and the way the surface answers the
     light.

     Both colours are ALBEDOS, not screen values: what lands on screen is
     the albedo through the room's environment and ACES, which costs it
     something in every channel. They are sampled off their own rooms and
     then opened back up. Their twins are the --bezel-c values in hub.css,
     which are the flat fallback's ring; move them together. */
  const COATS = {
    /* the bedroom's chair and lamp are light ash — #daba96 lit, #bc986c in
       shade. Diffuse, no metal reflection, and a low satin clearcoat: the
       lacquer on a thing that hangs in a bedroom is a sheen, not a gloss. */
    wood: {
      color: 0xc99a63,
      roughness: 0.55,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42,
      specularIntensity: 0.7,
      envMapIntensity: 0.95,
    },
    /* 🔴 PAINT, NOT ANODISING, and the colour is why. Anodising is a tint
       over metal, so the colour term is the REFLECTION's tint and it can
       only ever be as saturated as the room is dark — ask a metal for a
       green and you get a murky mirror. A coated dielectric puts the colour
       in the diffuse term, where it is simply the colour. The blue band
       stays anodised; these are honestly different finishes, which is also
       why this room is allowed a colour the first one could not hold.

       🔴 OLIVE, NOT GREEN, and that distinction is the whole colour. It is
       the sage a phone comes in: low chroma, warm, more grey than hue, and
       it sits BESIDE the room instead of announcing itself. Two passes got
       this wrong from opposite ends — a grass green that was the loudest
       thing on the wall, then a deep forest that read as almost black at
       this size. What works is a light, desaturated body with a satin
       sheen, which is also the only version of green that does not fight
       the second room's sage wall three feet behind it.

       Measured, not guessed: this albedo renders to #b0b88e on the band's
       side face under this room, which is the reference finish's own value.
       Re-measure if the environment is ever retuned — a coated dielectric
       takes most of its screen value from the softboxes. */
    /* 🔴 这个 color 是**默认值**，运行时会被换掉。2026-09-04 之后同一块涂层要在
       两个地方穿两种颜色：

         intro 转场 + hub 前奏（Meet Nestify）  这里的橄榄绿，保持原样
         hub 段尾 One screen. 的第一幕          换成棕红

       用户当天先要求「改成黑框」，我把这里直接改成了炭黑——结果两处一起变了，
       他随即指出：「这两个东西能不能不要连接在一起呀？就改了下面上面也改。」
       两处共用 data-room=1，所以光靠 data-room 分不开；改法是 hub3d 暴露
       setCoatTint()，由 hub.js 按 `p >= DOCK` 判断在哪一幕，运行时换 albedo。

       ⚠️ 所以**不要**再来这里改颜色找效果——这里只是没人换时的兜底。
       两幕各自的值在 hub.js 的 setCoatTint 调用处。 */
    sage: {
      color: 0x9aa66e,
      roughness: 0.38,
      clearcoat: 0.4,
      clearcoatRoughness: 0.22,
      specularIntensity: 1.0,
      envMapIntensity: 1.0,
    },
  };

  function makeCoatedRim(THREE, coat) {
    const spec = COATS[coat];
    if (!spec) throw new Error('[NestieUnit] no such finish: ' + coat);
    const p = parts(THREE);
    const mesh = new THREE.Mesh(p.rimGeo, new THREE.MeshPhysicalMaterial({
      color: spec.color,
      metalness: 0.0,
      roughness: spec.roughness,
      clearcoat: spec.clearcoat,
      clearcoatRoughness: spec.clearcoatRoughness,
      specularIntensity: spec.specularIntensity,
      envMapIntensity: spec.envMapIntensity,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }));
    mesh.name = 'rim-' + coat;
    /* the same forward offset the blue ring gets in makeUnit — they are all
       the same part, so they sit in the same place */
    mesh.position.z = LIP / 2;
    return mesh;
  }

  /* 🔴 ONE small punctual light, doing far less than the room. A metal
     has no diffuse term, so the environment is doing nearly all of the
     work; this is left only for the one thing an environment map cannot
     give — a small hard specular that stays put as the object turns,
     which is what stops the chamfer looking painted on. On the RIGHT,
     with the key softbox. */
  function makeKey(THREE) {
    const key = new THREE.DirectionalLight(0xfff8f0, 0.65);
    key.position.set(2.4, 2.4, 3.0);
    return key;
  }

  return { DIMS, COATS, makeEnvironment, makeUnit, makeCoatedRim, makeKey, panelGeo, roundedRect };
})();
