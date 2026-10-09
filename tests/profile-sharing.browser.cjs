const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const documents=new Map([['private_profiles/me',{name:'Ana',bio:'Bio original',city:'São Paulo',role:'Médica',sharing:{published:false,autoUpdate:true,visible:['role','specialty','institution','city','bio','orcid','lattes','articles']}}]]);
 let fail=false;let commits=0;
 async function device(){
  const context=await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('clinicalmind.accounts.v1',JSON.stringify({'ana@example.com':{name:'Ana',email:'ana@example.com',authProvider:'google',firebaseUid:'me'}}));sessionStorage.setItem('clinicalmind.session.v1','ana@example.com');});
  await context.route('https://**',route=>route.abort());
  await context.route('**/auth-google.js',route=>route.fulfill({contentType:'text/javascript',body:"export const db={};export const auth={currentUser:{uid:'me'}};"}));
  await context.route('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js',route=>route.fulfill({contentType:'text/javascript',body:`
   export const doc=(_,collection,uid)=>({collection,uid});
   export const getDocFromServer=async ref=>{const data=await window.readTestDocument(ref);return {exists:()=>data!==null,data:()=>data};};export const getDoc=getDocFromServer;
   export const runTransaction=async(_,callback)=>{const operations=[];const result=await callback({get:getDoc,set:(ref,data,options)=>operations.push({ref,data,options}),delete:ref=>operations.push({ref,remove:true})});await window.commitTestDocuments(operations);return result;};
   export const setDoc=async(ref,data,options)=>window.commitTestDocuments([{ref,data,options}]);
   export const collection=()=>({});export const query=()=>({});export const where=()=>({});export const orderBy=()=>({});export const startAt=()=>({});export const endAt=()=>({});export const limit=()=>({});export const getDocs=async()=>({docs:[],forEach(){}});export const onSnapshot=(ref,...args)=>{if(!ref.collection)args.find(value=>typeof value==='function')({docs:[]});return ()=>{};};export const addDoc=()=>{};export const serverTimestamp=()=>0;
  `}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('readTestDocument',ref=>documents.get(ref.collection+'/'+ref.uid)||null);
  await page.exposeFunction('commitTestDocuments',operations=>{if(fail)throw Error('offline');for(const op of operations){const key=op.ref.collection+'/'+op.ref.uid;if(op.remove)documents.delete(key);else documents.set(key,op.options?.merge?{...documents.get(key),...op.data}:op.data);}commits++;});
  await page.goto('http://127.0.0.1:8080/');await page.evaluate(()=>window.clinicalMindGoogleSuccess({uid:'me',email:'ana@example.com',name:'Ana'}));await page.locator('#sidebarToggle').click();await page.locator('#nav [data-section="Perfil"]').click();await expect(page.locator('#networkPublish')).toBeVisible();return {page,context,errors};
 }
 const first=await device(),p=first.page;
 await expect(p.locator('#networkSharingState')).toContainText('Perfil não publicado');await expect(p.locator('#networkAutoUpdate')).toBeChecked();await p.locator('[data-share-field="city"]').uncheck();await p.locator('#networkPublish').click();await expect(p.locator('#networkStatus')).toContainText('salvo na nuvem');assert.equal(documents.get('network_profiles/me').city,'');assert.equal(documents.get('network_profiles/me').bio,'Bio original');
 await p.locator('.academic-editor').filter({has:p.locator('#professionalProfile')}).locator('summary').click();await p.locator('#profileBio').fill('Bio atualizada');await p.locator('#professionalProfile button').click();await expect(p.locator('#profileSyncMessage')).toHaveText('Salvo na nuvem.');assert.equal(documents.get('network_profiles/me').bio,'Bio atualizada');assert.equal(documents.get('network_profiles/me').city,'');
 await p.locator('#profileName').fill('Ana Nova');await p.locator('#profileForm button').click();await expect(p.locator('#profileStatus')).toHaveText('Salvo na nuvem.');assert.equal(documents.get('network_profiles/me').name,'Ana Nova');
 fail=true;await p.locator('[data-share-field="bio"]').uncheck();await p.locator('#networkPublish').click();await expect(p.locator('#networkStatus')).toContainText('opções não foram salvas');assert.equal(documents.get('network_profiles/me').bio,'Bio atualizada');await expect(p.locator('[data-share-field="bio"]')).not.toBeChecked();fail=false;await p.locator('#networkPublish').click();await expect(p.locator('#networkStatus')).toContainText('salvo na nuvem');assert.equal(documents.get('network_profiles/me').bio,'');
 await p.locator('#networkAutoUpdate').uncheck();await p.locator('#networkPublish').click();await expect(p.locator('#networkSharingState')).toContainText('atualização manual');await p.locator('#profileRole').fill('Pesquisadora');await p.locator('#professionalProfile button').click();await expect(p.locator('#professionalStatus')).toHaveText('Salvo na nuvem.');assert.equal(documents.get('network_profiles/me').role,'Médica');
 const second=await device();await expect(second.page.locator('[data-share-field="bio"]')).not.toBeChecked();await expect(second.page.locator('[data-share-field="city"]')).not.toBeChecked();await expect(second.page.locator('#networkAutoUpdate')).not.toBeChecked();
 await p.locator('#networkPublish').click();await expect(p.locator('#networkStatus')).toContainText('salvo na nuvem');assert.equal(documents.get('network_profiles/me').role,'Pesquisadora');
 await p.locator('#networkHide').click();await expect(p.locator('#networkSharingState')).toContainText('Perfil não publicado');await p.locator('#profileBio').fill('Privada');await p.locator('#professionalProfile button').click();await expect(p.locator('#professionalStatus')).toHaveText('Salvo na nuvem.');assert.equal(documents.has('network_profiles/me'),false);assert.equal(documents.get('private_profiles/me').bio,'Privada');assert.deepEqual(first.errors,[]);assert.deepEqual(second.errors,[]);
 console.log('Browser passed: sharing controls, automatic profile/name updates, atomic failure and retry, manual mode, preferences on another device, unpublishing. Firestore simulated;',commits,'commits.');await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
