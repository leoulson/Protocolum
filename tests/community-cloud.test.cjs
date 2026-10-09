const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
async function setup({failWrites=false}={}){
 let user={name:'One',email:'one@example.com',authProvider:'google',firebaseUid:'uid-one'};let counter=0;
 const documents=new Map(),subscriptions=new Set(),writes=[],pending=new Set();const db={};
 const stamp=()=>({toDate:()=>new Date('2026-10-07T12:00:00Z')});
 const snapshot=ref=>({id:ref.path.split('/').at(-1),exists:()=>documents.has(ref.path),data:()=>documents.get(ref.path),metadata:{hasPendingWrites:pending.has(ref.path)}});
 function feed(ref){const parts=ref.path.split('/').length;return {docs:[...documents.keys()].filter(key=>key.startsWith(ref.path+'/')&&key.split('/').length===parts+1).map(key=>snapshot({path:key})),metadata:{fromCache:false}};}
 function emit(){for(const subscription of [...subscriptions])subscription.next(feed(subscription.ref));}
 const store={doc:(_, ...parts)=>({path:parts.join('/')}),collection:(_, ...parts)=>({path:parts.join('/')}),query:ref=>ref,orderBy:()=>({}),limit:()=>({}),serverTimestamp:stamp,onSnapshot:(ref,...args)=>{const next=args.find(arg=>typeof arg==='function');const subscription={ref,next};subscriptions.add(subscription);queueMicrotask(()=>{if(subscriptions.has(subscription))next(feed(ref));});return()=>subscriptions.delete(subscription);},setDoc:async(ref,data)=>{if(failWrites)throw Error('permission-denied');documents.set(ref.path,data);writes.push(ref.path);emit();},runTransaction:async(_,callback)=>{const changes=[];await callback({get:async ref=>snapshot(ref),set:(ref,data)=>changes.push([ref,data])});for(const[ref,data]of changes)await store.setDoc(ref,data);}};
 const firebase={db,auth:{get currentUser(){return user?.authProvider==='google'?{uid:user.firebaseUid}:null;}}};
 const context=vm.createContext({console,crypto:{randomUUID:()=>`id-${++counter}`},window:{clinicalMindCurrentUser:()=>user}});
 const modules=new Map();
 async function dynamic(specifier){const id=specifier.endsWith('auth-google.js')?'auth':'firestore';if(modules.has(id))return modules.get(id);const exports=id==='auth'?firebase:store;const module=new vm.SyntheticModule(Object.keys(exports),function(){for(const key of Object.keys(exports))this.setExport(key,exports[key]);},{context});modules.set(id,module);await module.link(()=>{});await module.evaluate();return module;}
 const main=new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,'../community-cloud.js'),'utf8'),{context,importModuleDynamically:dynamic});await main.link(specifier=>new vm.SourceTextModule(fs.readFileSync(path.join(__dirname,'..',specifier),'utf8'),{context}));await main.evaluate();
 return {api:main.namespace,user:()=>user,setUser:value=>user=value,documents,subscriptions,writes,pending,emit,flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
const general={kind:'general',title:'Discussion',body:'Academic question',topic:'Cardiologia'};
const clinical={kind:'case',assessment:'Assessment of a fictional case',plan:'Educational discussion plan',reference:'KDIGO 2024'};
test('publishes both community formats with author UID and no email',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),general,'general-one');await s.api.publishCommunityPost(s.user(),clinical,'case-one');
 assert.equal(s.documents.get('forum_posts/general-one').userId,'uid-one');assert.equal(s.documents.get('forum_posts/case-one').kind,'case');assert.equal(s.documents.get('forum_posts/general-one').email,undefined);assert.ok(s.documents.get('forum_posts/general-one').timestamp.toDate());
});
test('another authenticated user receives posts, replies and votes',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),general,'general-one');s.setUser({...s.user(),name:'Two',email:'two@example.com',firebaseUid:'uid-two'});await s.api.startCommunity(s.user());await s.flush();
 assert.equal(s.api.communityState().posts[0].author,'One');await s.api.replyToCommunityPost(s.user(),'general-one','A shared reply','reply-one');await s.api.toggleCommunityVote(s.user(),'general-one','like');await s.flush();
 assert.equal(s.api.communityState().replies['general-one'][0].userId,'uid-two');assert.equal(s.api.communityState().votes['general-one'][0].like,true);
 await s.api.toggleCommunityVote(s.user(),'general-one','like');assert.equal(s.api.communityState().votes['general-one'][0].like,false);
});
test('separate user votes cannot overwrite another user vote',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),clinical,'case-one');await s.api.toggleCommunityVote(s.user(),'case-one','supported');s.setUser({...s.user(),firebaseUid:'uid-two'});await s.api.toggleCommunityVote(s.user(),'case-one','citation');
 assert.equal(s.documents.get('forum_posts/case-one/votes/uid-one').supported,true);assert.equal(s.documents.get('forum_posts/case-one/votes/uid-two').citation,true);
});
test('snapshots replace edited posts and remove deleted posts and child listeners',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),general,'post-one');await s.api.startCommunity(s.user());await s.flush();assert.equal(s.subscriptions.size,3);
 s.documents.get('forum_posts/post-one').title='Server change';s.emit();assert.equal(s.api.communityState().posts[0].title,'Server change');s.documents.delete('forum_posts/post-one');s.emit();assert.equal(s.api.communityState().posts.length,0);assert.equal(s.subscriptions.size,1);
});
test('failed publication is not inserted into the shared feed',async()=>{
 const s=await setup({failWrites:true});await s.api.startCommunity(s.user());await s.flush();await assert.rejects(s.api.publishCommunityPost(s.user(),general));assert.equal(s.api.communityState().posts.length,0);assert.equal(s.writes.length,0);
});
test('local accounts and switched accounts cannot publish with another identity',async()=>{
 const s=await setup();const old=s.user();s.setUser({...old,firebaseUid:'uid-two'});await assert.rejects(s.api.publishCommunityPost(old,general));s.setUser({name:'Local',email:'local@example.com'});await assert.rejects(s.api.replyToCommunityPost(s.user(),'p','Reply'));await s.api.startCommunity(s.user());assert.equal(s.api.communityState().status,'signed-out');assert.equal(s.writes.length,0);
});
test('sign-out clears shared state and stops all listeners',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),general,'post-one');await s.api.startCommunity(s.user());await s.flush();s.api.stopCommunity();assert.equal(s.subscriptions.size,0);assert.equal(s.api.communityState().posts.length,0);assert.equal(s.api.communityState().status,'signed-out');
});
test('invalid content and reaction types are rejected',async()=>{
 const s=await setup();await assert.rejects(s.api.publishCommunityPost(s.user(),{...clinical,assessment:'short'}));await assert.rejects(s.api.replyToCommunityPost(s.user(),'p',''));await assert.rejects(s.api.toggleCommunityVote(s.user(),'p','unsupported'));assert.equal(s.writes.length,0);
});

test('legacy cloud case posts remain visible through the original server timestamp',async()=>{
 const s=await setup();s.documents.set('forum_posts/legacy',{userId:'uid-one',author:'Original Author',assessment:'An existing assessment',plan:'An existing plan',reference:'KDIGO 2024',createdAt:'2026-10-01T00:00:00Z',timestamp:{toDate:()=>new Date('2026-10-01T00:00:00Z')}});await s.api.startCommunity(s.user());await s.flush();assert.equal(s.api.communityState().posts[0].kind,'case');assert.equal(s.api.communityState().posts[0].author,'Original Author');
});
test('a pending local publication is hidden until the server acknowledges it',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),general,'pending-one');s.pending.add('forum_posts/pending-one');await s.api.startCommunity(s.user());await s.flush();assert.equal(s.api.communityState().posts.length,0);s.pending.clear();s.emit();assert.equal(s.api.communityState().posts.length,1);
});

test('articles are stored and received by another user with canonical links',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),{...general,article:{source:'pubmed',identifier:'123456',title:'Study',authors:'Researcher A',url:'javascript:alert(1)'}},'article-post');
 assert.equal(s.documents.get('forum_posts/article-post').article.url,'https://pubmed.ncbi.nlm.nih.gov/123456/');s.setUser({...s.user(),firebaseUid:'uid-two'});await s.api.startCommunity(s.user());await s.flush();assert.equal(s.api.communityState().posts[0].article.title,'Study');
});
test('invalid article metadata is rejected before writing the post',async()=>{
 const s=await setup();for(const article of [{source:'pubmed',identifier:'bad',title:'Title',authors:''},{source:'crossref',identifier:'10.1234/test',title:'',authors:''},{source:'pubmed',identifier:'123',title:'Title',authors:'a'.repeat(1001)}])await assert.rejects(s.api.publishCommunityPost(s.user(),{...general,article}));assert.equal(s.writes.length,0);
});
test('DOI links are canonical and invalid stored attachments do not break legacy posts',async()=>{
 const s=await setup();await s.api.publishCommunityPost(s.user(),{...clinical,article:{source:'crossref',identifier:'https://doi.org/10.1234/TEST',title:'Paper',authors:'A'}},'doi-post');assert.equal(s.documents.get('forum_posts/doi-post').article.url,'https://doi.org/10.1234/test');
 s.documents.set('forum_posts/legacy',{...s.documents.get('forum_posts/doi-post'),article:{source:'unknown',url:'javascript:alert(1)'}});await s.api.startCommunity(s.user());await s.flush();assert.equal(s.api.communityState().posts.find(post=>post.id==='legacy').article,null);
});
