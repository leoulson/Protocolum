const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const remote=new Map([['private_study/uid-one',{favorites:['hf']}],['private_study/uid-one/notes/hf',{text:'Cloud note'}]]);let fail=false;
 const adapter=`export const doc=(_, ...parts)=>({path:parts.join('/'),firestore:{}});const snapshot=data=>({exists:()=>data!==null,data:()=>data});export const getDocFromServer=async ref=>snapshot(await window.studyRead(ref.path));export const setDoc=async(ref,data)=>window.studyWrite(ref.path,data);export const runTransaction=async(_,callback)=>{const writes=[];const value=await callback({get:async ref=>snapshot(await window.studyRead(ref.path)),set:(ref,data)=>writes.push([ref.path,data])});for(const [path,data]of writes)await window.studyWrite(path,data);return value;};export const collection=()=>({});export const query=()=>({});export const where=()=>({});export const getDocs=async()=>({forEach(){}});export const addDoc=()=>{};export const onSnapshot=()=>()=>{};export const serverTimestamp=()=>0;`;
 async function device(){
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'one@example.com':{name:'One',email:'one@example.com',authProvider:'google',firebaseUid:'uid-one'}}));sessionStorage.setItem('clinicalmind.session.v1','one@example.com');});
  await context.route('https://**',route=>route.abort());
  await context.route('**/auth-google.js',route=>route.fulfill({contentType:'text/javascript',body:"export const db={};export const auth={currentUser:{uid:'uid-one'}};"}));
  await context.route('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',route=>route.fulfill({contentType:'text/javascript',body:adapter}));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('studyRead',path=>remote.get(path)??null);
  await page.exposeFunction('studyWrite',(path,data)=>{if(fail)throw Error('offline');remote.set(path,data);});
  await page.goto('http://127.0.0.1:8080/');await page.evaluate(async()=>{window.clinicalMindGoogleSuccess({uid:'uid-one',email:'one@example.com',name:'One'});const store=await import('./study-sync.js');await store.loadFavorites(window.clinicalMindCurrentUser());window.clinicalMindRefreshFavorites();});
  return {page,context,errors};
 }
 const first=await device(),p=first.page;
 await expect(p.locator('[data-fav="hf"]')).toHaveText('★');
 await p.locator('[data-fav="hf"]').click();await expect(p.locator('[data-fav="hf"]')).toHaveText('♡');assert.deepEqual(remote.get('private_study/uid-one').favorites,[]);
 await p.locator('[data-fav="hf"]').locator('..').click();await expect(p.locator('#readerNotes')).toHaveValue('Cloud note');await expect(p.locator('#readerNotes')).toBeEnabled();
 await p.locator('#readerFavorite').click();await expect(p.locator('#readerFavorite')).toHaveAttribute('aria-pressed','true');assert.deepEqual(remote.get('private_study/uid-one').favorites,['hf']);
 await p.locator('#readerNotes').fill('Saved study note');await expect(p.locator('#readerNoteStatus')).toHaveText('Salvo na nuvem.');assert.equal(remote.get('private_study/uid-one/notes/hf').text,'Saved study note');
 fail=true;await p.locator('#readerNotes').fill('Offline draft');await expect(p.locator('#readerNoteStatus')).toContainText('Rascunho neste navegador');assert.equal(remote.get('private_study/uid-one/notes/hf').text,'Saved study note');fail=false;
 await p.getByRole('button',{name:'Tentar novamente',exact:true}).click();await expect(p.locator('#readerNoteStatus')).toHaveText('Salvo na nuvem.');assert.equal(remote.get('private_study/uid-one/notes/hf').text,'Offline draft');
 // Capture the old reader's note before opening a different reference.
 await p.locator('#readerNotes').fill('Saved after switching readers');await p.evaluate(()=>document.getElementById('detailOverlay').style.display='none');await p.locator('[data-fav="dm"]').locator('..').click();await expect(p.locator('#readerNotes')).toBeEnabled();await expect(p.locator('#readerNotes')).toHaveValue('');await expect.poll(()=>remote.get('private_study/uid-one/notes/hf').text).toBe('Saved after switching readers');assert.equal(remote.has('private_study/uid-one/notes/dm'),false);
 const second=await device();await expect(second.page.locator('[data-fav="hf"]')).toHaveText('★');await second.page.locator('[data-fav="hf"]').locator('..').click();await expect(second.page.locator('#readerNotes')).toHaveValue('Saved after switching readers');await second.page.locator('#readerNotes').fill('');await expect(second.page.locator('#readerNoteStatus')).toHaveText('Salvo na nuvem.');assert.equal(remote.get('private_study/uid-one/notes/hf').text,'');
 assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);console.log('Browser passed: list and reader favorites, notes, offline draft and retry, switching references, second device, cleared notes. Firestore simulated.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
