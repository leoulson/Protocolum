import { normalizeSharing, sharedProfile } from './profile-sharing.js';
import { normalizeProfile } from './profile-data.js';

const localKey = user => 'protocolum.profile.v1.' + (user.authProvider === 'google' ? 'uid.' + user.firebaseUid : user.email.toLowerCase());
const identity = user => `${user.authProvider || 'local'}:${user.firebaseUid || user.email}`;
const loads = new Map();
let writeQueue = Promise.resolve();
let watchVersion=0;const watches=new Map(),profileListeners=new Set();
export function subscribeProfileUpdates(listener){profileListeners.add(listener);return ()=>profileListeners.delete(listener);}
function watchProfile(store,user,version){
  const key=identity(user);if(version!==watchVersion||watches.has(key)||!store.onSnapshot)return;
  const valid=()=>version===watchVersion&&identity(window.clinicalMindCurrentUser?.()||{})===key;
  const stop=store.onSnapshot(store.ref,{includeMetadataChanges:true},snapshot=>{
    if(!valid()||snapshot.metadata?.hasPendingWrites||snapshot.metadata?.fromCache)return;
    const data=snapshot.data()||{},before=cached(user),profile=normalizeProfile(data);if(snapshot.exists()&&!data.sharing)profile.sharing=before.sharing;
    const name=typeof data.name==='string'&&data.name.trim()?data.name.trim().slice(0,80):window.clinicalMindCurrentUser().name;
    const changed=JSON.stringify(before)!==JSON.stringify(profile)||name!==window.clinicalMindCurrentUser().name;
    loads.set(key,Promise.resolve(profile));localStorage.setItem(localKey(user),JSON.stringify(profile));rememberName(user,name);
    for(const listener of profileListeners)listener({profile,name,uid:user.firebaseUid,status:'ready',changed});
  },()=>{if(valid())for(const listener of profileListeners)listener({uid:user.firebaseUid,status:'error'});});watches.set(key,stop);
}

function current(user) {
  const active = window.clinicalMindCurrentUser?.();
  if (!active || identity(active) !== identity(user)) throw new Error('Account changed');
}
function cached(user) {
  // Preserve the existing browser profile when first migrating a Google account.
  const value = localStorage.getItem(localKey(user)) ?? localStorage.getItem('protocolum.profile.v1.' + user.email.toLowerCase());
  try { return normalizeProfile(JSON.parse(value || '{}')); }
  catch { return normalizeProfile(); }
}
async function cloud(user) {
  const [firebase, store] = await Promise.all([
    import('./auth-google.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);
  current(user);
  if (!firebase.db || firebase.auth?.currentUser?.uid !== user.firebaseUid) throw new Error('Google sign-in required');
  return { ...store, db:firebase.db, ref: store.doc(firebase.db, 'private_profiles', user.firebaseUid) };
}
function rememberName(user, name) {
  current(user);
  window.clinicalMindUpdateProfileName?.(name);
}
export async function reconnectProfileUpdates(user){const version=++watchVersion;watches.forEach(stop=>stop());watches.clear();const store=await cloud(user);watchProfile(store,user,version);}
export function resetProfileSync() { watchVersion++;watches.forEach(stop=>stop());watches.clear();loads.clear(); }
export async function loadProfile(user) {
  current(user);
  if (user.authProvider !== 'google') return cached(user);
  const id=identity(user);
  if (!loads.has(id)) {
    const version=watchVersion;const loading=(async()=>{
      const store=await cloud(user);
      const snapshot=await store.getDocFromServer(store.ref);
      current(user);
      let profile;
      if (snapshot.exists()) {
        const data=snapshot.data();profile=normalizeProfile(data);
        if(!data.sharing){const publicProfile=await store.getDocFromServer(store.doc(store.db,'network_profiles',user.firebaseUid));current(user);profile.sharing.published=publicProfile.exists();}
        if (typeof data.name === 'string' && data.name.trim()) rememberName(user,data.name.trim().slice(0,80));
      } else {
        profile=cached(user);
        await store.setDoc(store.ref,{...profile,name:window.clinicalMindCurrentUser().name});
        current(user);
      }
      localStorage.setItem(localKey(user),JSON.stringify(profile));
      watchProfile(store,user,version);return profile;
    })();
    loads.set(id,loading);
    loading.catch(()=>{if(loads.get(id)===loading)loads.delete(id);});
  }
  return loads.get(id);
}
function enqueue(operation) {
  const result=writeQueue.then(operation);
  writeQueue=result.catch(()=>{});
  return result;
}
async function persist(user,value,name,sharingOverride,base){
  await loadProfile(user);
  const store=await cloud(user),publicRef=store.doc(store.db,'network_profiles',user.firebaseUid);
  const inferred=(await loadProfile(user)).sharing;
  const profile=await store.runTransaction(store.db,async transaction=>{
    const snapshot=await transaction.get(store.ref);current(user);
    const remote=snapshot.data()||{},next=value?normalizeProfile(value):normalizeProfile(remote);
    if(value&&base){const original=normalizeProfile(base),latest=normalizeProfile(remote);for(const key of Object.keys(next))if(JSON.stringify(next[key])===JSON.stringify(original[key]))next[key]=latest[key];}
    const sharing=normalizeSharing(sharingOverride||remote.sharing||inferred);
    // Read before writing. A withdrawn public profile must never be recreated by a stale editor.
    const published=sharing.published?await transaction.get(publicRef):null;current(user);
    if(sharing.published&&!published.exists()&&!sharingOverride)sharing.published=false;
    next.sharing=sharing;
    const savedName=name||remote.name||window.clinicalMindCurrentUser().name;
    transaction.set(store.ref,{...next,name:savedName},{merge:true});
    if(sharingOverride&&!sharing.published)transaction.delete(publicRef);
    else if(sharing.published&&(sharing.autoUpdate||sharingOverride))transaction.set(publicRef,sharedProfile(user.firebaseUid,savedName,next,sharing));
    return next;
  });
  current(user);loads.set(identity(user),Promise.resolve(profile));localStorage.setItem(localKey(user),JSON.stringify(profile));
  return profile;
}
export function saveProfile(user,value,{base}={}){
  const profile=normalizeProfile(value);
  return enqueue(async()=>{
    current(user);
    if(user.authProvider==='google')return persist(user,profile,null,null,base);
    localStorage.setItem(localKey(user),JSON.stringify(profile));return profile;
  });
}
export function saveProfileSharing(user,settings){
  return enqueue(async()=>{current(user);if(user.authProvider!=='google')throw new Error('Google sign-in required');return persist(user,null,null,normalizeSharing(settings));});
}
export function saveProfileName(user,name){
  if(typeof name!=='string'||name.trim().length<2||name.trim().length>80)return Promise.reject(new Error('Invalid name'));
  name=name.trim();
  return enqueue(async()=>{current(user);if(user.authProvider==='google')await persist(user,null,name);rememberName(user,name);});
}
