const {chromium,expect}=require('@playwright/test');const assert=require('node:assert/strict');const xml=require('./pubmed-fixture.cjs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});const c=await b.newContext({serviceWorkers:'block',reducedMotion:'reduce',viewport:{width:process.env.PROTOCOLUM_MOBILE?390:1440,height:1000}});await c.route('https://**',r=>r.abort());await c.route('**/auth-google.js',r=>r.fulfill({contentType:'text/javascript',body:'export const db=null;export const auth=null;'}));await c.route('https://eutils.ncbi.nlm.nih.gov/**',r=>r.fulfill({contentType:r.request().url().includes('esearch')?'application/json':'application/xml',body:r.request().url().includes('esearch')?JSON.stringify({esearchresult:{idlist:['123']}}):xml([{pmid:'123',guideline:true,title:'Clinical evidence',journal:'Clinical research',abstract:'Read the original source.'}])}));await c.route('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({result:{uids:['123'],'123':{uid:'123',title:'Clinical evidence for mobile reading',authors:[{name:'A Researcher'}],source:'Clinical Research',pubdate:'2025'}}})}));
const p=await c.newPage();await p.goto('http://127.0.0.1:8080/');
 async function audit(name){const failures=await p.evaluate(()=>{
  const rgb=v=>{const n=v.match(/[\d.]+/g)?.map(Number);return n&&n.length>=3?[n[0],n[1],n[2],n[3]??1]:[0,0,0,0]},mix=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3]));
  const lum=c=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const base=document.documentElement.dataset.theme==='dark'?[16,25,39]:[240,243,248],bad=[];
  for(const el of document.querySelectorAll('h1,h2,h3,h4,p,a,label,small,button,summary,span,dt,dd,.reading-section-label,[role=status]')){
   if(!el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})||el.closest('[aria-hidden=true],button:disabled,[hidden]')||!Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent.trim()))continue;
   const style=getComputedStyle(el),chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);let bg=base;
   for(const n of chain)bg=mix(rgb(getComputedStyle(n).backgroundColor),bg);
   const fg=mix(rgb(style.color),bg),a=lum(fg),d=lum(bg),ratio=(Math.max(a,d)+.05)/(Math.min(a,d)+.05),large=parseFloat(style.fontSize)>=24||parseFloat(style.fontSize)>=18.66&&Number(style.fontWeight)>=700;
   if(ratio<(large?3:4.5))bad.push({tag:el.tagName,class:el.className,id:el.id,text:el.textContent.trim().slice(0,70),color:style.color,ratio:Number(ratio.toFixed(2))});
  }return bad;
 });assert.deepEqual(failures,[],name+' text contrast');}
 for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit('landing '+mode)}
 await p.locator('#landingLogin').click();for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit('auth '+mode)}
 await p.evaluate(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'local@example.com':{name:'Local',email:'local@example.com'}}));sessionStorage.setItem('clinicalmind.session.v1','local@example.com')});await p.reload();await p.waitForTimeout(500);
 for(const route of ['Diretrizes','Comparador','Fluxogramas','Laboratório PubMed','Comunidade','Perfil','Favoritos','Histórico']){
  if(await p.locator('#caseBack').isVisible())await p.locator('#caseBack').click();
  await p.locator('#sidebarToggle').click();await p.locator(`#nav [data-section="${route}"]`).click();await p.waitForTimeout(200);if(route==='Laboratório PubMed')await expect(p.locator('.pml-save')).toBeVisible();if(route==='Perfil'){await expect(p.locator('#profileBio')).toBeAttached();await p.locator('.profile-page details').evaluateAll(items=>items.forEach(item=>item.open=true));}
  for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit(route+' '+mode)}
  if(route==='Diretrizes'){await p.locator('.item[data-title]').first().click();for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit('reader '+mode)}await p.evaluate(()=>document.getElementById('detailOverlay').style.display='none');}
  if(route==='Comunidade'&&await p.locator('#openLegacyCommunity').isVisible()){await p.locator('#openLegacyCommunity').click();for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit('general community '+mode)}await p.locator('#generalBack').click();}
 }
 await p.goto('http://127.0.0.1:8080/privacidade.html');for(const mode of ['light','dark']){await p.evaluate(mode=>window.protocolumAppearance.set(mode),mode);await audit('privacy '+mode)}
 await b.close();console.log('Contrast passed: primary routes in both themes; alpha surfaces composited over the theme base. Gradients require visual inspection.');})().catch(e=>{console.error(e);process.exit(1)});
