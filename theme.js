// Restore appearance before styles load. A system preference follows live OS changes.
(()=>{
 const key='protocolum.theme.v1',root=document.documentElement,system=matchMedia('(prefers-color-scheme: dark)');
 const valid=value=>['system','light','dark'].includes(value);
 let paintVersion=0;
 let mode='system';try{const saved=localStorage.getItem(key);if(valid(saved))mode=saved;}catch{}
 function labels(){
  const english=root.lang.startsWith('en'),dark=root.dataset.theme==='dark';
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
   const label=english?(dark?'Light mode':'Dark mode'):(dark?'Modo claro':'Modo escuro');
   button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(dark));
   button.querySelector('[data-theme-label]').textContent=label;
  });
 }
 function apply(value,{source='device',remember=true}={}){
  mode=valid(value)?value:'system';const theme=mode==='system'?(system.matches?'dark':'light'):mode;
  if(root.dataset.theme&&root.dataset.theme!==theme){
   const version=++paintVersion;root.classList.add('theme-switching');
   requestAnimationFrame(()=>requestAnimationFrame(()=>{if(version===paintVersion)root.classList.remove('theme-switching');}));
  }
  root.dataset.appearance=mode;root.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#101927':'#edf1f7');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',theme);
  if(remember)try{localStorage.setItem(key,mode);}catch{}
  labels();window.dispatchEvent(new CustomEvent('protocolum-appearance-changed',{detail:{mode,source}}));
 }
 window.protocolumAppearance={get:()=>mode,set:apply};
 document.addEventListener('protocolum-theme-controls',labels);apply(mode,{remember:false});
 system.addEventListener('change',()=>{if(mode==='system')apply(mode,{source:'system',remember:false});});
 document.addEventListener('DOMContentLoaded',()=>{
  labels();document.addEventListener('click',event=>{
   if(event.target.closest('[data-theme-toggle]'))apply(root.dataset.theme==='dark'?'light':'dark',{source:'user'});
  });new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
 });
 window.addEventListener('storage',event=>{if(event.key===key)apply(valid(event.newValue)?event.newValue:'system',{remember:false});});
})();
