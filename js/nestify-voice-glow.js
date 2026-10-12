// Edge shader and state parameters ported from Nestify's
// jinghe/device-proto/voice-animation/2026-07-11 (edge_aura.frag / nestie_controller.dart).
(() => {
 const canvas = document.querySelector('.nestify-voice-glow');
 if (!canvas) return;
 const gl = canvas.getContext('webgl', {alpha:true, premultipliedAlpha:true});
 const controls = document.querySelector('.nestify-voice-controls');
 const device=canvas.closest('.nestify-cover__device');
 let gate=0, previousState="";
 if (!gl) { controls.hidden = true; return; }
 function shader(type, source) {
   const sh = gl.createShader(type); gl.shaderSource(sh,source); gl.compileShader(sh);
   if (!gl.getShaderParameter(sh,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
   return sh;
 }
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER, 'attribute vec2 position; varying vec2 vUV; void main(){vUV=position*.5+.5;gl_Position=vec4(position,0.,1.);}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER, "precision highp float;\nuniform vec2  uSize;        // [0,1]   \u753b\u5e03\u5c3a\u5bf8 (1920,1080)\nuniform float uTime;        // [2]     \u79d2\nuniform float uIntensity;   // [3]     0..1 \u603b\u5f3a\u5ea6 (\u542b gain)\nuniform float uBreath;      // [4]     0..1 \u547c\u5438 (\u8046\u542c: \u6052\u5b9a\u63a5\u8fd11)\nuniform float uFlowSpeed;   // [5]     \u8272\u76f8\u6d41\u52a8\u901f\u5ea6\nuniform float uSourceBias;  // [6]     -1..1 \u58f0\u6e90\u65b9\u4f4d\nuniform float uPulse;       // [7]     0..1 \u5b8c\u6210\u8109\u51b2\nuniform float uReach;       // [8]     \u57fa\u7840\u539a\u5ea6 px (1920 \u5c3a\u5ea6, \u5982\u8046\u542c96/\u5904\u740660)\nuniform float uWaveAmp;     // [9]     \u6ce2\u5e45 px\nuniform float uBandMix;     // [10]    0=\u5168\u8fb9 1=\u4eae\u5e26(\u5904\u7406\u6001)\nuniform float uBandPos;     // [11]    0..1 \u4eae\u5e26\u6cbf\u5468\u957f\u4f4d\u7f6e\nuniform float uFeather;     // [12]    0..1 \u8fb9\u7f18\u67d4\u5ea6\nuniform vec2  uAuraPos;     // [13,14] \u8bf4\u8bdd\u7403\u4e2d\u5fc3 px (\u9876\u90e8\u8d77\u7b97)\nuniform float uAuraR;       // [15]    \u7403\u534a\u5f84 px (~156)\nuniform float uAuraLevel;   // [16]    0..1 TTS \u6162\u5305\u7edc\nuniform float uAuraOn;      // [17]    0..1 \u662f\u5426\u8bf4\u8bdd (\u4e14\u5df2\u51fa\u9e1f)\nuniform vec3  uEdgeC0;      // [18..20] \u8fb9\u7f18\u8c03\u8272\u76d8 \u9752\nuniform vec3  uEdgeC1;      // [21..23] \u84dd\nuniform vec3  uEdgeC2;      // [24..26] \u54c1\u7ea2\nuniform vec3  uEdgeC3;      // [27..29] \u9ec4\nuniform vec3  uAuraC0;      // [30..32] \u7403\u8272 \u84dd\nuniform vec3  uAuraC1;      // [33..35] \u9ec4\nuniform vec3  uAuraC2;      // [36..38] \u7ea2\nuniform vec3  uAuraC3;      // [39..41] \u9752\nuniform vec4  uAuraArea;    // [42..45] \u7403\u56db\u8272\u5404\u81ea\u9762\u79ef (0..0.8)\n\nvarying vec2 vUV;\n\nconst vec3 YELLOW = vec3(1.0, 0.7647, 0.1490); // secondary500 #FFC326 (\u5b8c\u6210\u8109\u51b2)\n\nfloat wave(float sn){\n  float t = uTime*0.6, TAU = 6.2831853;\n  return uWaveAmp*( 0.50*sin(sn*TAU*3.0  + t)\n                  + 0.30*sin(sn*TAU*7.0  + t*1.27)\n                  + 0.20*sin(sn*TAU*13.0 + t*0.83) );\n}\nfloat sdRoundRect(vec2 p, vec2 b, float r){\n  vec2 q = abs(p) - b + r;\n  return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r;\n}\nfloat band(float sn){\n  float dd = abs(sn - uBandPos); dd = min(dd, 1.0-dd);\n  float sigma = 0.06;\n  return exp(-(dd*dd)/(2.0*sigma*sigma));\n}\nvec3 pal4(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3){\n  t = fract(t);\n  float seg = t*4.0;\n  float f = fract(seg); f = f*f*(3.0-2.0*f);\n  int i = int(floor(seg));\n  if(i==0) return mix(c0,c1,f);\n  if(i==1) return mix(c1,c2,f);\n  if(i==2) return mix(c2,c3,f);\n  return mix(c3,c0,f);\n}\n\nvoid main(){\n  vec2 fc = vec2(vUV.x, 1.0-vUV.y) * uSize;\n  vec2 center = uSize*0.5;\n  vec2 p = fc - center;\n\n  // \u8fb9\u7f18\u5149: \u89d2\u5ea6\u7ed5\u5708\u4e0a\u8272 + \u9ad8\u65af\u8f6f\u8870\u51cf\u3002\n  // \u5173\u952e\u4fee\u590d\uff08\u56db\u89d2\u63a5\u7f1d\uff09\uff1a\u4e0d\u7528 min \u8ddd\u79bb\u573a\uff08distance-to-nearest-edge \u5728\u89d2\u5bf9\u89d2\u7ebf\u4e0a\u6709\n  // \u68af\u5ea6\u6298\u75d5 = \u77e9\u5f62\u4e2d\u8f74\uff0c\u547c\u5438\u65f6\u9732\u51fa\u4e00\u6761\u659c\u7ebf\uff09\u3002\u6539\u4e3a\u300c\u6c34\u5e73\u8fb9 gH\u300d\u300c\u5782\u76f4\u8fb9 gV\u300d\u5404\u81ea\u72ec\u7acb\n  // \u8ba1\u7b97\uff0c\u518d screen \u6df7\u5408 gH+gV-gH*gV \u2014\u2014 \u65e0 min \u5373\u65e0\u6298\u75d5\uff0c\u56db\u89d2\u5904\u4e24\u8fb9\u81ea\u7136\u53e0\u4eae\u586b\u6ee1\u3002\n  float ang = atan(p.y, p.x);\n  float sn = ang*0.15915494 + 0.5;\n  float depth = max(uReach + wave(sn), 8.0);\n  float k = mix(6.5, 1.5, clamp(uFeather,0.0,1.0));\n  float dy = max(center.y - abs(p.y), 0.0);   // \u5230\u6700\u8fd1\u6c34\u5e73\u8fb9(\u4e0a/\u4e0b)\u7684\u6df1\u5ea6\n  float dx = max(center.x - abs(p.x), 0.0);   // \u5230\u6700\u8fd1\u5782\u76f4\u8fb9(\u5de6/\u53f3)\u7684\u6df1\u5ea6\n  float ty = dy/depth, tx = dx/depth;\n  float gH = exp(-ty*ty*k);\n  float gV = exp(-tx*tx*k);\n  float glow = gH + gV - gH*gV;               // screen \u6df7\u5408\uff1a\u56db\u89d2\u65e0\u7f1d\u53e0\u4eae\n  float profile = mix(1.0, 0.1 + 0.9*band(sn), uBandMix);\n  float sideFactor = 1.0 + uSourceBias*0.5*clamp(p.x/center.x, -1.0, 1.0);\n  float alpha = glow*profile*sideFactor*uIntensity;\n  alpha *= (0.85 + 0.15*uBreath);\n  alpha = clamp(alpha, 0.0, 1.0);\n  // \u989c\u8272\u6d41\u5411\u4e0e\u4eae\u5e26\u540c\u4e3a\u987a\u65f6\u9488\uff08sn \u589e\u5927 = \u987a\u65f6\u9488\uff09\uff1a\u7528 -uTime \u8ba9\u8272\u76f8\u968f sn \u589e\u5927\u65b9\u5411\u79fb\u52a8\u3002\n  vec3 col = pal4(sn - uTime*uFlowSpeed, uEdgeC0,uEdgeC1,uEdgeC2,uEdgeC3);\n\n  // \u8bf4\u8bdd\u8111\u540e\u7684\u7403: \u56db\u4e2a\u9519\u4f4d\u5f84\u5411\u6e10\u53d8\u5c42\u53e0\n  vec3 auraP = vec3(0.0); float auraA = 0.0;\n  if(uAuraOn > 0.002){\n    vec2 ad = (fc - uAuraPos)/uAuraR;\n    float radial = length(ad);\n    if(radial < 1.9){\n      float base = uTime*0.10, R = 1.10, au = uAuraLevel*0.28, sp = 0.42;\n      vec2 o0 = sp*vec2(cos(base),        sin(base));\n      vec2 o1 = sp*vec2(cos(base+1.5708), sin(base+1.5708));\n      vec2 o2 = sp*vec2(cos(base+3.1416), sin(base+3.1416));\n      vec2 o3 = sp*vec2(cos(base+4.7124), sin(base+4.7124));\n      float a0 = 1.0 - smoothstep((uAuraArea.x+au)*R, R, length(ad-o0));\n      float a1 = 1.0 - smoothstep((uAuraArea.y+au)*R, R, length(ad-o1));\n      float a2 = 1.0 - smoothstep((uAuraArea.z+au)*R, R, length(ad-o2));\n      float a3 = 1.0 - smoothstep((uAuraArea.w+au)*R, R, length(ad-o3));\n      // over\uff08\u524d\u76d6\u540e\uff0c\u6700\u521d\u7248\u672c\uff09\uff1a4 \u8272\u53e0\u5c42\uff0c\u67d4\u548c glow\uff0c\u7ed3\u679c\u843d\u5728\u989c\u8272\u51f8\u5305\u5185\u2014\u2014\u4e0d\u51fa\u767d\u3002\n      vec3 c = vec3(0.0); float a = 0.0;\n      c = uAuraC0*a0 + c*(1.0-a0); a = a0 + a*(1.0-a0);\n      c = uAuraC1*a1 + c*(1.0-a1); a = a1 + a*(1.0-a1);\n      c = uAuraC2*a2 + c*(1.0-a2); a = a2 + a*(1.0-a2);\n      c = uAuraC3*a3 + c*(1.0-a3); a = a3 + a*(1.0-a3);\n      float e = exp(-radial*radial*1.30) * uAuraOn * (1.05 + uAuraLevel*0.15);\n      auraA = clamp(a*e, 0.0, 1.0);\n      auraP = c*e;\n    }\n  }\n\n  // \u5408\u6210: \u7403\u5728\u6700\u5e95 -> \u8fb9\u7f18 over \u7403 -> \u5b8c\u6210\u8109\u51b2 over \u5168\u90e8 (premultiplied)\n  float pulseA = uPulse*0.35;\n  vec3  eP = col*alpha;\n  vec3  baseP = auraP + eP*(1.0-auraA);\n  float baseA = auraA + alpha*(1.0-auraA);\n  vec3  pP = YELLOW*pulseA;\n  vec3  outP = pP + baseP*(1.0-pulseA);\n  float outA = pulseA + baseA*(1.0-pulseA);\n\n  gl_FragColor = vec4(outP, clamp(outA, 0.0, 1.0));\n}\n"));
 gl.linkProgram(program);
 if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {controls.hidden=true;return;}
 gl.useProgram(program);
 const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const pos=gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
 const uniforms = new Map();
 const loc=name=>{if(!uniforms.has(name)) uniforms.set(name,gl.getUniformLocation(program,name));return uniforms.get(name);};
 const f=(name,value)=>gl.uniform1f(loc(name),value);
 gl.uniform2f(loc('uSize'),1920,1200);
 [[56,212,230],[91,156,246],[241,79,206],[244,209,78]].forEach((c,i)=>gl.uniform3f(loc('uEdgeC'+i),...c.map(v=>v/255)));
 let thinking=0,target=0,frame=0,visible=true,last=0,time=0;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 function draw(now) {
   frame=0; const dt=last?Math.min((now-last)/1000,.05):0;last=now;
   const arrived=device.dataset.voiceReady==='true';
   if(!reduce.matches&&arrived) time+=dt;
   gate=reduce.matches?(arrived?1:0):gate+((arrived?1:0)-gate)*(1-Math.exp(-dt/.35));
   // Hidden controls are retained for future manual demos: 3s listening, 2s thinking, 3s speaking, 2s delivery.
   if(controls.hidden) {
     const phase=time%10;
     const state=phase<3?'listening':phase<5?'thinking':phase<8?'speaking':'complete';
     target=state==='thinking'?1:0;
     if(state!==previousState){previousState=state;device.dataset.voiceState=state;device.dispatchEvent(new CustomEvent('nestie-state',{detail:state}));}
     controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.voiceState==='thinking')===Boolean(target))));
   }
   thinking=reduce.matches?target:thinking+(target-thinking)*Math.min(1,dt*8);
   const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
   const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
   const br=.5+.5*Math.sin(time*2*Math.PI/2.7);
   const mix=(a,b)=>a+(b-a)*thinking;
   f('uTime',time);f('uIntensity',gate*((previousState==='speaking'||previousState==='complete')?0:mix((.42+.10*br)*1.47,1.73)));
   f('uBreath',1);f('uFlowSpeed',mix(.1,.06));f('uReach',mix(96*(.45+.9*br),60));
   f('uWaveAmp',mix(20,6));f('uFeather',mix(.18,.7));f('uBandMix',thinking);f('uBandPos',(time/1.8)%1);
   gl.drawArrays(gl.TRIANGLES,0,6);
   if(visible&&!document.hidden&&!reduce.matches) frame=requestAnimationFrame(draw);
 }
 function resume(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;if(visible&&!document.hidden)frame=requestAnimationFrame(draw);}
 controls.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{
   target=button.dataset.voiceState==='thinking'?1:0;
   controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));resume();
 }));
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;resume();}).observe(canvas);
 device.addEventListener('nestie-ready',resume);
 document.addEventListener('visibilitychange',resume);reduce.addEventListener('change',resume);
 new ResizeObserver(resume).observe(canvas);
})();
