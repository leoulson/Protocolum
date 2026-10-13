// Animate the static introduction once; live feeds remain stable while updating.
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
if(!reduced.matches&&'IntersectionObserver' in window){
 const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('soft-reveal');observer.unobserve(entry.target);}
 },{threshold:.08});
 document.querySelectorAll('.landing-copy,.landing-visual,.landing-card').forEach(element=>observer.observe(element));
}
