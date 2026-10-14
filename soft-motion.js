// Animate the static introduction once; live feeds remain stable while updating.
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
if(!reduced.matches&&'IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('soft-reveal');observer.unobserve(entry.target);}
 },{threshold:.08});
 document.querySelectorAll('.landing-copy,.landing-visual,.landing-card').forEach(element=>observer.observe(element));
}

// Load the tilt engine on the first eligible interaction, preserving startup savings.
const precise=matchMedia('(hover: hover) and (pointer: fine)');
let opticalEngine,latestPoint;
function activateGlass(event){
 const element=event.target.closest('[data-spatial-glass]');if(!element||!precise.matches||reduced.matches)return;
 latestPoint={element,x:event.clientX,y:event.clientY};
 if(!opticalEngine){
  opticalEngine=import('./spatial-glass.js').then(module=>{document.removeEventListener('mousemove',activateGlass);module.initializeSpatialGlass(latestPoint);}).catch(()=>{opticalEngine=null;});
 }
}
document.addEventListener('mousemove',activateGlass,{passive:true});
