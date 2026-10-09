// Native touch fields remain usable when the software keyboard is open.
const resizeField=field=>{if(!(field instanceof HTMLTextAreaElement))return;field.style.height='auto';field.style.height=Math.min(480,Math.max(96,field.scrollHeight))+'px';};
document.addEventListener('input',event=>resizeField(event.target));
document.addEventListener('focusin',event=>{
  const field=event.target;
  if(field.matches('input,textarea,select') && field.closest('#app')){
    resizeField(field);
    document.getElementById('app')?.classList.add('keyboard-open');
  }
});
document.addEventListener('focusout',()=>{
  setTimeout(()=>{if(!document.activeElement?.matches('input,textarea,select'))document.getElementById('app')?.classList.remove('keyboard-open');},100);
});
// Opening filters must reveal the drawer before attempting to focus a control.
const advanced=document.getElementById('advanced');
if(advanced)advanced.onclick=()=>{
  const app=document.getElementById('app');
  if(!app.classList.contains('drawer-open'))document.getElementById('sidebarToggle')?.click();
  document.getElementById('pubmedYearFrom')?.focus();
  document.querySelector('.filters')?.scrollIntoView({behavior:'smooth',block:'start'});
};
