const listeners = new Set();
let state = {status:'signed-out',posts:[],replies:{},votes:{}};
let generation=0, stopPosts, ownerId;
const children=new Map();
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
  generation++;stopPosts?.();stopPosts=undefined;children.forEach(stops=>stops.forEach(stop=>stop()));children.clear();ownerId=undefined;
  state={status:'signed-out',posts:[],replies:{},votes:{}};emit();
}
function date(value) { try { return typeof value==='string'?new Date(value).toISOString():value.toDate().toISOString(); } catch { return null; } }
function post(snapshot) {
  const data=snapshot.data(),createdAt=date(data.timestamp)||date(data.createdAt);
  const kind=data.kind || (typeof data.assessment==='string'?'case':'general');
  if(!createdAt || !data.userId || typeof data.author!=='string' || !['case','general'].includes(kind))return null;
  if(kind==='case' && ['assessment','plan','reference'].some(key=>typeof data[key]!=='string'))return null;
  if(kind==='general' && ['title','body','topic'].some(key=>typeof data[key]!=='string'))return null;
  return {...data,id:snapshot.id,kind,createdAt};
}
export async function startCommunity(user,{force=false}={}) {
  if(ownerId===user?.firebaseUid && !force && ['loading','ready'].includes(state.status))return;
  stopCommunity();
  if(user?.authProvider!=='google')return;
  ownerId=user.firebaseUid;const version=generation;
  state={...state,status:'loading'};emit();
  try {
    const store=await cloud(user);if(version!==generation)return;
    let childFailure=false;
    const fail=()=>{childFailure=true;if(version===generation){state={...state,status:'error'};emit();}};
    stopPosts=store.onSnapshot(store.query(store.collection(store.db,'forum_posts'),store.orderBy('timestamp','desc'),store.limit(50)),{includeMetadataChanges:true},snapshot=>{
      if(version!==generation)return;
      const posts=snapshot.docs.filter(doc=>!doc.metadata?.hasPendingWrites).map(post).filter(Boolean);
      const ids=new Set(posts.map(post=>post.id));
      for(const [id,stops]of children)if(!ids.has(id)){stops.forEach(stop=>stop());children.delete(id);delete state.replies[id];delete state.votes[id];}
      state={...state,status:childFailure?'error':snapshot.metadata?.fromCache?'loading':'ready',posts};emit();
      for(const item of posts)if(!children.has(item.id)) {
        const stops=[];children.set(item.id,stops);
        for(const type of ['replies','votes']) {
          const collection=store.collection(store.db,'forum_posts',item.id,type);
          const target=type==='replies'?store.query(collection,store.orderBy('createdAt','asc'),store.limit(200)):collection;
          stops.push(store.onSnapshot(target,childSnapshot=>{
            if(version!==generation||!children.has(item.id))return;
            const entries=childSnapshot.docs.filter(doc=>!doc.metadata?.hasPendingWrites).map(doc=>({...doc.data(),id:doc.id}));
            const value=type==='replies'?entries.map(reply=>({...reply,createdAt:date(reply.createdAt)})).filter(reply=>reply.createdAt && typeof reply.body==='string'):entries;
            state={...state,[type]:{...state[type],[item.id]:value}};emit();
          },fail));
        }
      }
    },fail);
  }catch {if(version===generation){state={...state,status:'error'};emit();}}
}
const text=(value,min,max)=>{const result=typeof value==='string'?value.trim():'';if(result.length<min||result.length>max)throw new Error('Invalid content');return result;};
export async function publishCommunityPost(user,value,id=crypto.randomUUID()) {
  const store=await cloud(user);
  const data={userId:user.firebaseUid,author:text(active().name,1,80),kind:value.kind,timestamp:store.serverTimestamp()};
  if(value.kind==='case')Object.assign(data,{assessment:text(value.assessment,10,2400),plan:text(value.plan,10,2400),reference:text(value.reference,3,240)});
  else if(value.kind==='general')Object.assign(data,{title:text(value.title,1,90),body:text(value.body,1,1200),topic:text(value.topic,1,80)});
  else throw new Error('Invalid post type');
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
