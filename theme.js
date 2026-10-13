// Apply the saved theme before styles load to avoid a flash on navigation.
(()=>{
 const key='protocolum.theme.v1',root=document.documentElement;
 let theme='light';
 try{const saved=localStorage.getItem(key);if(saved==='dark'||saved==='light')theme=saved;}catch{}
 function labels(){
  const english=root.lang.startsWith('en'),dark=theme==='dark';
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
   const label=english?(dark?'Light mode':'Dark mode'):(dark?'Modo claro':'Modo escuro');
   button.setAttribute('aria-label',label);button.setAttribute('title',label);button.setAttribute('aria-pressed',String(dark));
   button.querySelector('[data-theme-label]').textContent=label;
  });
 }
 function apply(value){
  theme=value;root.dataset.theme=value;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='dark'?'#101927':'#edf1f7');
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',value);
  labels();
 }
 document.addEventListener('protocolum-theme-controls',labels);
 apply(theme);
 document.addEventListener('DOMContentLoaded',()=>{
  labels();document.addEventListener('click',event=>{
   if(!event.target.closest('[data-theme-toggle]'))return;
   apply(theme==='dark'?'light':'dark');try{localStorage.setItem(key,theme);}catch{}
  });
  new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
 });
 window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue==='dark'?'dark':'light');});
})();
