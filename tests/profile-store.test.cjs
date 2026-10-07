const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

async function setup({remote, local, readError, writeError}={}) {
  let user={email:'one@example.com',name:'One',authProvider:'google',firebaseUid:'uid-one'};
  const values=new Map(local?[['protocolum.profile.v1.one@example.com',JSON.stringify(local)]]:[]);
  const writes=[];const documents=new Map(remote?[['uid-one',remote]]:[]);
  let reads=0;
  const context=vm.createContext({console,URL,window:{clinicalMindCurrentUser:()=>user,clinicalMindUpdateProfileName:name=>{user={...user,name};}},localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}});
  const firebase={db:{},auth:{get currentUser(){return user?.authProvider==='google'?{uid:user.firebaseUid}:null;}}};
  const store={doc:(_,collection,uid)=>({collection,uid}),getDocFromServer:async ref=>{reads++;if(readError)throw Error('offline');return {exists:()=>documents.has(ref.uid),data:()=>documents.get(ref.uid)};},setDoc:async(ref,data,options)=>{if(writeError)throw Error('permission-denied');writes.push({ref,data,options});documents.set(ref.uid,options?.merge?{...documents.get(ref.uid),...data}:data);}};
  const modules=new Map();
  async function moduleFor(specifier,ref) {
    const id=specifier.startsWith('https:')?'firestore':specifier.endsWith('auth-google.js')?'auth':path.resolve(ref?path.dirname(ref.identifier):path.join(__dirname,'..'),specifier);
    if(modules.has(id))return modules.get(id);
    let module;
    if(id==='auth'||id==='firestore') {const exports=id==='auth'?firebase:store;module=new vm.SyntheticModule(Object.keys(exports),function(){for(const key of Object.keys(exports))this.setExport(key,exports[key]);},{context,identifier:id});}
    else module=new vm.SourceTextModule(fs.readFileSync(id,'utf8'),{context,identifier:id,importModuleDynamically:async(spec,ref)=>{const m=await moduleFor(spec,ref);if(m.status==='unlinked')await m.link(moduleFor);if(m.status==='linked')await m.evaluate();return m;}});
    modules.set(id,module);return module;
  }
  const main=await moduleFor('./profile-store.js');await main.link(moduleFor);await main.evaluate();
  return {api:main.namespace,user:()=>user,setUser:value=>{user=value;},values,writes,documents,reads:()=>reads};
}
test('migrates browser profile only if remote is absent, saving privately by UID',async()=>{
 const s=await setup({local:{bio:'Existing biography',theme:'violet'}});
 const p=await s.api.loadProfile(s.user());assert.equal(p.bio,'Existing biography');assert.equal(s.writes.length,1);assert.equal(s.writes[0].ref.collection,'private_profiles');assert.equal(s.writes[0].ref.uid,'uid-one');assert.equal(s.writes[0].data.name,'One');assert.ok(!('email' in s.writes[0].data));
});
test('remote profile wins over stale browser data and restores name on another device',async()=>{
 const s=await setup({remote:{name:'Cloud Name',bio:'Cloud bio',theme:'emerald',articles:[{doi:'10.1234/paper',title:'Paper'}]},local:{bio:'Stale'}});
 const p=await s.api.loadProfile(s.user());assert.equal(p.bio,'Cloud bio');assert.equal(p.articles.length,1);assert.equal(s.user().name,'Cloud Name');assert.equal(s.writes.length,0);
 await s.api.saveProfile(s.user(),{...p,bio:'Updated'});await s.api.saveProfileName(s.user(),'New Name');
 const second=await setup({remote:s.documents.get('uid-one')});assert.equal((await second.api.loadProfile(second.user())).bio,'Updated');assert.equal(second.user().name,'New Name');
});
test('failed cloud read does not overwrite remote with local data',async()=>{
 const s=await setup({readError:true,local:{bio:'Local'}});await assert.rejects(s.api.loadProfile(s.user()));await assert.rejects(s.api.saveProfile(s.user(),{bio:'Changed'}));assert.equal(s.writes.length,0);
});
test('failed cloud write does not update local cache or report success',async()=>{
 const s=await setup({remote:{name:'One',bio:'Original'},writeError:true});const p=await s.api.loadProfile(s.user());await assert.rejects(s.api.saveProfile(s.user(),{...p,bio:'Unsaved'}));assert.equal(JSON.parse(s.values.get('protocolum.profile.v1.uid.uid-one')).bio,'Original');
});
test('account switches prevent pending writes to previous identity',async()=>{
 const s=await setup({remote:{name:'One'}});const previous=s.user();const pending=s.api.saveProfile(previous,{bio:'Wrong account'});s.setUser({...previous,email:'two@example.com',firebaseUid:'uid-two'});await assert.rejects(pending);assert.equal(s.writes.length,0);
});
test('local accounts save locally without invoking Firestore',async()=>{
 const s=await setup();s.setUser({email:'local@example.com',name:'Local'});await s.api.saveProfile(s.user(),{bio:'Local only'});await s.api.saveProfileName(s.user(),'Local Name');assert.equal((await s.api.loadProfile(s.user())).bio,'Local only');assert.equal(s.user().name,'Local Name');assert.equal(s.reads(),0);assert.equal(s.writes.length,0);
});
