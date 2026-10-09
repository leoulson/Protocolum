const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const remote=new Map(),watches=new Map();let fail=false,reads=0;
 for(let i=0;i<45;i++)remote.set('forum_posts/p'+String(i).padStart(3,'0'),{kind:i%2?'case':'general',userId:'author',author:'Author',timestamp:'2026-01-01T00:00:00.000Z',title:'Discussion '+i,body:'Educational discussion',topic:'Geral',assessment:'Academic assessment',plan:'Academic plan',reference:'Reference'});
 function result(ref){
  if(ref.kind==='doc')return remote.get(ref.path)??null;
  let rows=[...remote].filter(([key])=>key.startsWith(ref.path+'/')&&key.split('/').length===ref.path.split('/').length+1).map(([key,data])=>({id:key.split('/').at(-1),data}));
  if(ref.path==='forum_posts'){rows.sort((a,b)=>b.data.timestamp.localeCompare(a.data.timestamp)||b.id.localeCompare(a.id));if(ref.after)rows=rows.filter(row=>row.data.timestamp<ref.after.timestamp||(row.data.timestamp===ref.after.timestamp&&row.id<ref.after.id));}
  return rows.slice(0,ref.take??rows.length);
 }
 const adapter=`export const where=()=>({});export const getDocs=async()=>({forEach(){}});export const setDoc=async()=>{};export const serverTimestamp=()=>new Date().toISOString();let next=0;const listeners=new Map();export const doc=(_, ...parts)=>({path:parts.join('/'),kind:'doc'});export const collection=(_, ...parts)=>({path:parts.join('/'),kind:'collection'});export const query=(ref,...options)=>Object.assign({},ref,...options);export const orderBy=()=>({});export const limit=take=>({take});export const startAfter=snapshot=>({after:snapshot.cursor});const wrap=(ref,data)=>ref.kind==='doc'?{id:ref.path.split('/').at(-1),exists:()=>data!==null,data:()=>data,metadata:{fromCache:false,hasPendingWrites:false}}:{docs:data.map(row=>({id:row.id,cursor:{id:row.id,timestamp:row.data.timestamp},data:()=>row.data,metadata:{hasPendingWrites:false}})),metadata:{fromCache:false}};window.receivePage=(id,data)=>{const entry=listeners.get(id);if(entry)entry.callback(wrap(entry.ref,data));};export const onSnapshot=(ref,...args)=>{const id=String(++next);listeners.set(id,{ref,callback:args.find(arg=>typeof arg==='function')});window.watchPage(id,ref).then(data=>window.receivePage(id,data));return()=>{listeners.delete(id);window.unwatchPage(id);};};export const getDocsFromServer=async ref=>wrap(ref,await window.readPage(ref));`;
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'reader@example.com':{name:'Reader',email:'reader@example.com',authProvider:'google',firebaseUid:'reader'}}));sessionStorage.setItem('clinicalmind.session.v1','reader@example.com');});
 await context.route('https://**',route=>route.abort());
 await context.route('**/auth-google.js',route=>route.fulfill({contentType:'text/javascript',body:"export const db={};export const auth={currentUser:{uid:'reader'}};"}));
 await context.route('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',route=>route.fulfill({contentType:'text/javascript',body:adapter}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.exposeFunction('watchPage',(id,ref)=>{watches.set(id,ref);return result(ref);});await page.exposeFunction('unwatchPage',id=>watches.delete(id));await page.exposeFunction('readPage',ref=>{reads++;if(fail)throw Error('unavailable');return result(ref);});
 async function notify(){for(const[id,ref]of [...watches])await page.evaluate(({id,data})=>window.receivePage(id,data),{id,data:result(ref)});}
 await page.goto('http://127.0.0.1:8080/');await page.evaluate(()=>window.clinicalMindGoogleSuccess({uid:'reader',email:'reader@example.com',name:'Reader'}));await page.locator('#sidebarToggle').click();await page.locator('#nav [data-section="Comunidade"]').click();await expect(page.locator('.case-post:not(.is-demo)')).toHaveCount(10);assert.equal(reads,0);
 await page.locator('#openLegacyCommunity').click();await expect(page.locator('.community-card')).toHaveCount(10);
 const draft=page.locator('form[data-reply="p044"] input');await draft.fill('Keep this reply');fail=true;await page.locator('[data-community-more]').click();await expect(page.locator('[data-community-page-status]')).toContainText('Não foi possível');await expect(page.locator('.community-card')).toHaveCount(10);await expect(draft).toHaveValue('Keep this reply');
 fail=false;await page.locator('[data-community-more]').click();await expect(page.locator('.community-card')).toHaveCount(20);await expect(draft).toHaveValue('Keep this reply');assert.equal(reads,2);
 remote.set('forum_posts/new',{kind:'general',userId:'author',author:'Author',timestamp:'2026-02-01T00:00:00.000Z',title:'Live new post',body:'A newer discussion',topic:'Geral'});await notify();await expect(page.locator('.community-card')).toHaveCount(21);await expect(draft).toHaveValue('Keep this reply');
 remote.delete('forum_posts/p006');await notify();await expect(page.locator('.community-card')).toHaveCount(20);
 await page.locator('[data-community-more]').click();await expect(page.locator('.community-card')).toHaveCount(23);await expect(page.locator('[data-community-more]')).toBeHidden();await expect(page.locator('[data-community-page-status]')).toContainText('Todos os posts');await expect(draft).toHaveValue('Keep this reply');assert.equal(reads,3);
 await page.locator('#generalBack').click();await expect(page.locator('.case-post:not(.is-demo)')).toHaveCount(22);await expect(page.locator('[data-community-more]')).toBeHidden();assert.equal(reads,3);assert.deepEqual(errors,[]);
 watches.clear();await browser.close();console.log('Browser passed: initial 20 posts, cursor pages, failed page retry, preserved drafts, live insert and historical deletion, shared pagination across community views. Firestore simulated.');
})().catch(error=>{console.error(error);process.exit(1);});
