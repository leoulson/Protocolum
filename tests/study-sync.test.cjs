const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup({documents=new Map(),local=new Map(),readError=false,writeError=false}={}) {
 let user={email:'one@example.com',authProvider:'google',firebaseUid:'uid-one'};
 const subscriptions=new Set();let refreshes=0;const writes=[];let lock=Promise.resolve();const firestore={};
 const values=new Map(local);
 const context=vm.createContext({console,encodeURIComponent,window:{clinicalMindCurrentUser:()=>user,clinicalMindRefreshFavorites:()=>{refreshes++;}},localStorage:{get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}});
 const snapshot=ref=>({exists:()=>documents.has(ref.path),data:()=>documents.get(ref.path)});
 const store={onSnapshot:(ref,options,next,error)=>{const listener={ref,next,error};subscriptions.add(listener);return()=>subscriptions.delete(listener);},doc:(_, ...parts)=>({path:parts.join('/'),firestore}),getDocFromServer:async ref=>{if(readError)throw Error('offline');return snapshot(ref);},setDoc:async(ref,data)=>{if(writeError)throw Error('offline');writes.push(ref.path);documents.set(ref.path,data);},runTransaction:(_,callback)=>{
  const result=lock.then(async()=>{const pending=[];const value=await callback({get:async ref=>{if(readError)throw Error('offline');return snapshot(ref);},set:(ref,data)=>pending.push([ref,data])});if(writeError)throw Error('offline');for(const [ref,data]of pending){writes.push(ref.path);documents.set(ref.path,data);}return value;});lock=result.catch(()=>{});return result;
 }};
 const firebase={db:firestore,auth:{get currentUser(){return user.authProvider==='google'?{uid:user.firebaseUid}:null;}}};
 const modules=new Map();
 const make=async(specifier)=>{
  const id=specifier.endsWith('auth-google.js')?'auth':'firestore';if(modules.has(id))return modules.get(id);
  const exports=id==='auth'?firebase:store;const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const key of Object.keys(exports))this.setExport(key,exports[key]);},{context,identifier:id});modules.set(id,m);await m.link(()=>{});await m.evaluate();return m;
 };
 const main=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,'../study-sync.js'),'utf8'),{context,importModuleDynamically:make});await main.link(()=>{});await main.evaluate();
 return {subscriptions,refreshes:()=>refreshes,push:(value,metadata={})=>{documents.set('private_study/'+user.firebaseUid,value);for(const listener of subscriptions)listener.next({...snapshot(listener.ref),metadata});},api:main.namespace,user:()=>user,setUser:value=>user=value,values,documents,writes};
}
test('favorites migrate once; remote favorites replace stale local data',async()=>{
 const local=new Map([['clinicalmind.favorites.one@example.com','["hf","dm"]']]);const s=await setup({local});await s.api.loadFavorites(s.user());assert.deepEqual(Array.from(s.documents.get('private_study/uid-one').favorites),['hf','dm']);
 const second=await setup({documents:s.documents,local:new Map([['clinicalmind.favorites.one@example.com','["stale"]']])});assert.deepEqual(Array.from(await second.api.loadFavorites(second.user())),['hf','dm']);assert.equal(second.writes.length,0);
});
test('favorite changes preserve favorites from another device and allow removal',async()=>{
 const documents=new Map([['private_study/uid-one',{favorites:['hf']}]]);const s=await setup({documents});await s.api.loadFavorites(s.user());documents.set('private_study/uid-one',{favorites:['hf','dm']});assert.equal(await s.api.toggleFavorite(s.user(),'ckd'),true);assert.deepEqual(Array.from(documents.get('private_study/uid-one').favorites),['hf','dm','ckd']);assert.equal(await s.api.toggleFavorite(s.user(),'hf'),false);assert.deepEqual(Array.from(documents.get('private_study/uid-one').favorites),['dm','ckd']);
});
test('legacy notes migrate privately and remote notes win on another device',async()=>{
 const s=await setup({local:new Map([['clinicalmind.notes.one@example.com.hf','"Legacy note"']])});assert.equal((await s.api.loadNote(s.user(),'hf')).text,'Legacy note');assert.equal(s.documents.get('private_study/uid-one/notes/hf').text,'Legacy note');
 await s.api.saveNote(s.user(),'hf','Updated note');const second=await setup({documents:s.documents,local:new Map([['clinicalmind.notes.one@example.com.hf','"Stale"']])});assert.equal((await second.api.loadNote(second.user(),'hf')).text,'Updated note');
});
test('cleared notes stay empty and do not restore legacy content',async()=>{
 const s=await setup({local:new Map([['clinicalmind.notes.one@example.com.hf','"Old note"']])});await s.api.loadNote(s.user(),'hf');await s.api.saveNote(s.user(),'hf','');assert.equal((await s.api.loadNote(s.user(),'hf')).text,'');assert.equal(s.documents.get('private_study/uid-one/notes/hf').text,'');
});
test('failed reads never overwrite cloud data; failed saves retain a draft',async()=>{
 const s=await setup({readError:true});await assert.rejects(s.api.loadFavorites(s.user()));await assert.rejects(s.api.loadNote(s.user(),'hf'));assert.equal(s.writes.length,0);
 const failing=await setup({writeError:true});failing.api.saveDraft(failing.user(),'hf','Keep my draft');await assert.rejects(failing.api.saveNote(failing.user(),'hf','Keep my draft'));assert.equal((await failing.api.loadNote(failing.user(),'hf')).text,'Keep my draft');assert.equal((await failing.api.loadNote(failing.user(),'hf')).pending,true);
});
test('successful save clears only the submitted draft, preserving newer edits',async()=>{
 const s=await setup();s.api.saveDraft(s.user(),'hf','Older');const save=s.api.saveNote(s.user(),'hf','Older');s.api.saveDraft(s.user(),'hf','Newer');await save;assert.equal((await s.api.loadNote(s.user(),'hf')).text,'Newer');await s.api.saveNote(s.user(),'hf','Newer');assert.equal((await s.api.loadNote(s.user(),'hf')).pending,false);
});
test('account switch rejects queued writes and keeps notes isolated',async()=>{
 const s=await setup();const old=s.user();const pending=s.api.saveNote(old,'hf','Private');s.setUser({...old,email:'two@example.com',firebaseUid:'uid-two'});await assert.rejects(pending);assert.equal(s.writes.length,0);
});
test('local accounts can use notes and favorites without Firebase',async()=>{
 const s=await setup({readError:true});s.setUser({email:'local@example.com'});await s.api.toggleFavorite(s.user(),'hf');await s.api.saveNote(s.user(),'hf','Local note');assert.equal((await s.api.loadNote(s.user(),'hf')).text,'Local note');assert.equal((await s.api.loadFavorites(s.user()))[0],'hf');assert.equal(s.writes.length,0);
});

test('migrates all existing notes without opening each reference',async()=>{
 const s=await setup({local:new Map([['clinicalmind.notes.one@example.com.hf','"Heart note"'],['clinicalmind.notes.one@example.com.dm','"Diabetes note"'],['clinicalmind.notes.two@example.com.hf','"Other account"']])});
 await s.api.migrateLegacyNotes(s.user());assert.equal(s.documents.get('private_study/uid-one/notes/hf').text,'Heart note');assert.equal(s.documents.get('private_study/uid-one/notes/dm').text,'Diabetes note');assert.equal(s.writes.length,2);
});

test('live favorite additions and removals refresh the active library',async()=>{
 const s=await setup({documents:new Map([['private_study/uid-one',{favorites:['a']} ]])});await s.api.loadFavorites(s.user());s.push({favorites:['b','c']});assert.deepEqual(Array.from(await s.api.loadFavorites(s.user())),['b','c']);assert.equal(s.refreshes(),1);s.push({favorites:[]});assert.equal((await s.api.loadFavorites(s.user())).length,0);assert.equal(s.refreshes(),2);assert.equal(s.writes.length,0);
});
test('favorite listeners ignore cached or pending snapshots and stop on reset',async()=>{
 const s=await setup({documents:new Map([['private_study/uid-one',{favorites:['a']} ]])});await s.api.loadFavorites(s.user());s.push({favorites:['pending']},{hasPendingWrites:true});s.push({favorites:['cached']},{fromCache:true});assert.deepEqual(Array.from(await s.api.loadFavorites(s.user())),['a']);const old=[...s.subscriptions][0];s.api.resetStudySync();assert.equal(s.subscriptions.size,0);old.next({data:()=>({favorites:['wrong']}),metadata:{}});assert.equal(s.refreshes(),0);
});
