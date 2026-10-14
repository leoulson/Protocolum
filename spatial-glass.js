// Coalesce pointer input into one transform update per frame.
const pointer=matchMedia('(hover: hover) and (pointer: fine)');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const allowed=()=>pointer.matches&&!reduced.matches;
const controllers=new Map();
let active;
function reset(element,instant=false){
 const state=controllers.get(element);if(!state)return;
 cancelAnimationFrame(state.frame);clearTimeout(state.timer);state.frame=0;state.bounds=null;
 element.style.setProperty('--glass-rotate-x','0deg');element.style.setProperty('--glass-rotate-y','0deg');
 if(active===element)active=null;
 if(instant)element.removeAttribute('data-spatial-phase');
 else{element.dataset.spatialPhase='restoring';state.timer=setTimeout(()=>element.removeAttribute('data-spatial-phase'),550);}
}
function move(element,x,y){
 if(!allowed()||element.contains(document.activeElement))return;
 const state=controllers.get(element);if(!state)return;
 if(active&&active!==element)reset(active);
 active=element;clearTimeout(state.timer);state.point={x,y};
 if(state.frame)return;
 state.frame=requestAnimationFrame(()=>{
  state.frame=0;if(!allowed())return reset(element,true);
  // Read at rest once per hover, avoiding transformed bounds feeding back into rotation.
  const rect=state.bounds||(state.bounds=element.getBoundingClientRect());if(!rect.width||!rect.height)return reset(element,true);
  const limit=Math.min(12,Math.max(0,Number(element.dataset.tiltLimit)||6));
  const clamp=value=>Math.max(-1,Math.min(1,value));
  const horizontal=clamp((state.point.x-(rect.left+rect.width/2))/(rect.width/2));
  const vertical=clamp((state.point.y-(rect.top+rect.height/2))/(rect.height/2));
  element.dataset.spatialPhase='tracking';element.style.setProperty('--glass-rotate-x',`${(-vertical*limit).toFixed(2)}deg`);element.style.setProperty('--glass-rotate-y',`${(horizontal*limit).toFixed(2)}deg`);
 });
}
export function initializeSpatialGlass(initial){
 for(const element of document.querySelectorAll('[data-spatial-glass]')){
  if(controllers.has(element))continue;controllers.set(element,{frame:0,timer:0,bounds:null});
  element.addEventListener('mousemove',event=>move(element,event.clientX,event.clientY),{passive:true});
  element.addEventListener('mouseleave',()=>reset(element));
  element.addEventListener('focusin',()=>reset(element,true));
 }
 if(initial?.element?.matches(':hover'))move(initial.element,initial.x,initial.y);
}
const stop=()=>{for(const element of controllers.keys())reset(element,true);};
pointer.addEventListener('change',stop);reduced.addEventListener('change',stop);
window.addEventListener('blur',stop);
window.addEventListener('resize',stop,{passive:true});
window.addEventListener('scroll',()=>{if(active)reset(active);},{passive:true});
