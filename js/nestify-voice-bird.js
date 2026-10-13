// The original prototype uses the blink Rive for both listening and processing.
(() => {
 const canvas=document.querySelector('.nestify-voice-bird canvas');
 if(!canvas||!window.rive)return;
 const speakCanvas=document.createElement('canvas');speakCanvas.className='nestie-speaking';speakCanvas.setAttribute('aria-hidden','true');canvas.parentElement.append(speakCanvas);
 const bubble=document.createElement('div');bubble.className='nestie-reply';bubble.innerHTML='<span>Added soccer practice for Leo</span><span>every Wednesday at 5:30 PM.</span>';canvas.parentElement.append(bubble);
 let speakReady=false;
 const speak=new rive.Rive({src:'media/nestify/hero/bird-speak.riv',canvas:speakCanvas,autoplay:true,layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),onLoad(){speakReady=true;speak.resizeDrawingSurfaceToCanvas();sync();}});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const host=canvas.parentElement, device=host.closest('.nestify-cover__device');
 // Use unzoomed layout width: the preview already applies its own outer zoom.
 const replySizeObserver=new ResizeObserver(([entry])=>{
  bubble.style.setProperty('--nestie-reply-scale',String(entry.contentRect.width/704));
 });
 replySizeObserver.observe(device);
 let visible=false,ready=false,started=false;
 function finish(){device.dataset.voiceReady='true';device.dispatchEvent(new Event('nestie-ready'));}
 host.addEventListener('animationend',event=>{if(event.target===canvas&&event.animationName==='nestie-arrive')finish();});
 function enter(){
  if(started||!ready||!visible||document.hidden||document.getElementById('loading-overlay'))return;
  started=true;if(!reduced.matches)window.startNestieBirth?.(device);host.classList.add('is-entering');if(reduced.matches)finish();
 }
 const loaderObserver=new MutationObserver(enter);loaderObserver.observe(document.body,{childList:true});
 const bird=new rive.Rive({src:'media/nestify/hero/bird-blink.riv',canvas,autoplay:true,
  layout:new rive.Layout({fit:rive.Fit.Contain,alignment:rive.Alignment.Center}),
  onLoad(){ready=true;bird.resizeDrawingSurfaceToCanvas();sync();}
 });
 function sync(){if(!ready)return;enter();
 const active=visible&&!document.hidden&&!reduced.matches, talking=device.dataset.voiceState==='speaking';
 host.classList.toggle('is-speaking',talking&&speakReady);
 if(active&&!talking)bird.play();else bird.pause();
 if(speakReady){if(active&&talking)speak.play();else speak.pause();}
 }
 const layer=document.createElement('div');layer.className='nestie-delivery';layer.setAttribute('aria-hidden','true');
 const card=document.createElement('div');card.className='nestie-delivery-card';card.innerHTML='<strong>Soccer Practice</strong><span>5:30 PM · Leo</span>';
 layer.append(card);device.append(layer);
 let delivery=[];
 device.addEventListener('nestie-state',event=>{
  sync();delivery.forEach(a=>a.cancel());delivery=[];
  if(event.detail!=='complete')return;
  const rect=layer.getBoundingClientRect(),zoom=rect.width/layer.offsetWidth;
  const dx=rect.width*.59/zoom,dy=rect.height*.18/zoom;
  const frames=reduced.matches?[{opacity:0},{opacity:1},{opacity:0}]:[
   {offset:0,opacity:0,transform:`translate(${dx}px,${dy}px) scale(.65)`},
   {offset:.07,opacity:1,transform:`translate(${dx}px,${dy}px) scale(.7)`},
   {offset:.45,opacity:1,transform:'translate(0,0) scale(1)',boxShadow:'0 0 0 0 transparent'},
   {offset:.56,opacity:1,transform:'translate(0,0) scale(1)',boxShadow:'0 0 0 2px #2497f0, 0 0 14px #2497f088'},
   {offset:.8,opacity:1,transform:'translate(0,0) scale(1)',boxShadow:'0 0 0 2px #2497f0, 0 0 10px #2497f044'},
   {offset:1,opacity:0,transform:'translate(0,0) scale(1)',boxShadow:'0 0 0 0 transparent'}];
  delivery.push(card.animate(frames,{duration:1700,easing:'ease-in-out',fill:'both'}));
 });
 new ResizeObserver(()=>{if(ready)bird.resizeDrawingSurfaceToCanvas();if(speakReady)speak.resizeDrawingSurfaceToCanvas();}).observe(canvas);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(canvas);
 document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',()=>{if(reduced.matches&&started)finish();sync();});
 window.addEventListener('pagehide',()=>{replySizeObserver.disconnect();bird.cleanup();speak.cleanup();},{once:true});
})();
