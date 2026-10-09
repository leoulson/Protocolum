import { normalizeArticle } from './community-article-data.js';
const listeners = new Set();
const PAGE_SIZE=20;
const emptyState=()=>({status:'signed-out',posts:[],replies:{},votes:{},hasMore:false,loadingMore:false,pageError:false});
let state=emptyState();
let generation=0, stopPosts, ownerId;
const children=new Map(),olderWatches=new Map(),loadedPosts=new Map();
let storeForPages,cursor,headIds=new Set(),childFailure=false;
const active=()=>window.clinicalMindCurrentUser?.();
function current(user) {
  const account=active();
  if(!user || user.authProvider!=='google' || account?.firebaseUid!==user.firebaseUid || account?.authProvider!=='google')throw new Error('Google sign-in required');
}
async function cloud(user) {
  current(user);
  const [firebase,store]=await Promise.all([import('./auth-google.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
  current(user);
  if(!firebase.db || firebase.auth?.currentUser?.uid!==user.firebaseUid)throw new Error('Google sign-in required');
  return {...store,db:firebase.db};
}
function emit() { for(const listener of listeners)listener(state); }
export function communityState() { return state; }
export function subscribeCommunity(listener) { listeners.add(listener);listener(state);return ()=>listeners.delete(listener); }
export function stopCommunity() {
  generation++;olderWatches.forEach(stop=>stop());olderWatches.clear();loadedPosts.clear();headIds.clear();storeForPages=undefined;cursor=undefined;childFailure=false;stopPosts?.();stopPosts=undefined;children.forEach(stops=>stops.forEach(stop=>stop()));children.clear();ownerId=undefined;
  state=emptyState();emit();
}
function date(value) { try { return typeof value==='string'?new Date(value).toISOString():value.toDate().toISOString(); } catch { return null; } }
function post(snapshot) {
  const data=snapshot.data(),createdAt=date(data.timestamp)||date(data.createdAt);
  const kind=data.kind || (typeof data.assessment==='string'?'case':'general');
  if(!createdAt || !data.userId || typeof data.author!=='string' || !['case','general'].includes(kind))return null;
  if(kind==='case' && ['assessment','plan','reference'].some(key=>typeof data[key]!=='string'))return null;
  if(kind==='general' && ['title','body','topic'].some(key=>typeof data[key]!=='string'))return null;
  return {...data,article:normalizeArticle(data.article),id:snapshot.id,kind,createdAt};
}
function failLive(version){if(version===generation){childFailure=true;state={...state,status:'error'};emit();}}
function updatePosts(store,version){
  if(version!==generation)return;
  const ids=new Set(loadedPosts.keys());
  for(const[id,stops]of children)if(!ids.has(id)){stops.forEach(stop=>stop());children.delete(id);delete state.replies[id];delete state.votes[id];}
  for(const[id,stop]of olderWatches)if(!ids.has(id)||headIds.has(id)){stop();olderWatches.delete(id);}
  state={...state,posts:[...loadedPosts.values()].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||b.id.localeCompare(a.id))};emit();
  for(const item of state.posts){
    if(!children.has(item.id)){
      const stops=[];children.set(item.id,stops);
      for(const type of ['replies','votes']){
        const collection=store.collection(store.db,'forum_posts',item.id,type),target=type==='replies'?store.query(collection,store.orderBy('createdAt','asc'),store.limit(200)):collection;
        stops.push(store.onSnapshot(target,snapshot=>{
          if(version!==generation||!children.has(item.id))return;
          const entries=snapshot.docs.filter(doc=>!doc.metadata?.hasPendingWrites).map(doc=>({...doc.data(),id:doc.id}));
          const value=type==='replies'?entries.map(reply=>({...reply,createdAt:date(reply.createdAt)})).filter(reply=>reply.createdAt&&typeof reply.body==='string'):entries;
          if(JSON.stringify(state[type][item.id]||[])===JSON.stringify(value))return;state={...state,[type]:{...state[type],[item.id]:value}};emit();
        },()=>failLive(version)));
      }
    }
    // A post leaving the live first page may be displaced by a new post, rather than deleted.
    if(!headIds.has(item.id)&&!olderWatches.has(item.id))olderWatches.set(item.id,store.onSnapshot(store.doc(store.db,'forum_posts',item.id),{includeMetadataChanges:true},snapshot=>{
      if(version!==generation||snapshot.metadata?.fromCache||snapshot.metadata?.hasPendingWrites)return;
      const value=snapshot.exists()?post(snapshot):null;if(JSON.stringify(value)===JSON.stringify(loadedPosts.get(item.id)||null))return;if(value)loadedPosts.set(item.id,value);else loadedPosts.delete(item.id);
      updatePosts(store,version);
    },()=>failLive(version)));
  }
}
export async function startCommunity(user,{force=false}={}){
  if(ownerId===user?.firebaseUid&&!force&&['loading','ready'].includes(state.status))return;
  stopCommunity();if(user?.authProvider!=='google')return;
  ownerId=user.firebaseUid;const version=generation;state={...state,status:'loading'};emit();
  try{
    const store=await cloud(user);if(version!==generation)return;storeForPages=store;
    stopPosts=store.onSnapshot(store.query(store.collection(store.db,'forum_posts'),store.orderBy('timestamp','desc'),store.limit(PAGE_SIZE)),{includeMetadataChanges:true},snapshot=>{
      if(version!==generation)return;
      if(snapshot.metadata?.fromCache||snapshot.docs.some(doc=>doc.metadata?.hasPendingWrites))return;
      const nextIds=new Set(snapshot.docs.map(doc=>doc.id));
      // If a burst of new posts replaces the entire live page, resume from its tail to avoid gaps.
      if(!cursor||(headIds.size&&!snapshot.docs.some(doc=>headIds.has(doc.id)))){
        cursor=snapshot.docs.at(-1);state={...state,hasMore:snapshot.docs.length===PAGE_SIZE};
      }
      headIds=nextIds;
      if(snapshot.docs.length<PAGE_SIZE){for(const id of loadedPosts.keys())if(!nextIds.has(id))loadedPosts.delete(id);state={...state,hasMore:false};}
      for(const doc of snapshot.docs){const value=post(doc);if(value)loadedPosts.set(doc.id,value);else loadedPosts.delete(doc.id);}
      state={...state,status:childFailure?'error':'ready'};updatePosts(store,version);
    },()=>failLive(version));
  }catch{failLive(version);}
}
export async function loadMoreCommunity(user){
  current(user);if(state.loadingMore||!state.hasMore||!cursor||!storeForPages)return;
  const version=generation,store=storeForPages,after=cursor;state={...state,loadingMore:true,pageError:false};emit();
  try{
    const snapshot=await store.getDocsFromServer(store.query(store.collection(store.db,'forum_posts'),store.orderBy('timestamp','desc'),store.startAfter(after),store.limit(PAGE_SIZE)));
    current(user);if(version!==generation)return;
    if(snapshot.metadata?.fromCache||snapshot.docs.some(doc=>doc.metadata?.hasPendingWrites))throw Error('Unconfirmed page');
    for(const doc of snapshot.docs){const value=post(doc);if(value)loadedPosts.set(doc.id,value);}
    if(cursor===after){if(snapshot.docs.length)cursor=snapshot.docs.at(-1);state={...state,hasMore:headIds.size===PAGE_SIZE&&snapshot.docs.length===PAGE_SIZE};}
    state={...state,loadingMore:false,pageError:false};updatePosts(store,version);
  }catch{if(version===generation){state={...state,loadingMore:false,pageError:true};emit();}}
}

const text=(value,min,max)=>{const result=typeof value==='string'?value.trim():'';if(result.length<min||result.length>max)throw new Error('Invalid content');return result;};
export async function publishCommunityPost(user,value,id=crypto.randomUUID()) {
  const store=await cloud(user);
  const data={userId:user.firebaseUid,author:text(active().name,1,80),kind:value.kind,timestamp:store.serverTimestamp()};
  if(value.kind==='case')Object.assign(data,{assessment:text(value.assessment,10,2400),plan:text(value.plan,10,2400),reference:text(value.reference,3,240)});
  else if(value.kind==='general')Object.assign(data,{title:text(value.title,1,90),body:text(value.body,1,1200),topic:text(value.topic,1,80)});
  else throw new Error('Invalid post type');
  if(value.article){const article=normalizeArticle(value.article);if(!article)throw new Error('Invalid article');data.article=article;}
  await store.setDoc(store.doc(store.db,'forum_posts',id),data);
  current(user);return id;
}
export async function replyToCommunityPost(user,postId,body,id=crypto.randomUUID()) {
  const store=await cloud(user);
  await store.setDoc(store.doc(store.db,'forum_posts',postId,'replies',id),{userId:user.firebaseUid,author:text(active().name,1,80),body:text(body,1,500),createdAt:store.serverTimestamp()});
  current(user);return id;
}
export async function toggleCommunityVote(user,postId,type) {
  if(!['supported','citation','like'].includes(type))throw new Error('Invalid vote');
  const store=await cloud(user),ref=store.doc(store.db,'forum_posts',postId,'votes',user.firebaseUid);
  await store.runTransaction(store.db,async transaction=>{
    const snapshot=await transaction.get(ref);current(user);
    const old=snapshot.data()||{};
    transaction.set(ref,{supported:old.supported===true,citation:old.citation===true,like:old.like===true,[type]:old[type]!==true});
  });current(user);
}
