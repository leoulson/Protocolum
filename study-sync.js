const active = () => window.clinicalMindCurrentUser?.();
const identity = user => `${user?.authProvider || 'local'}:${user?.firebaseUid || user?.email}`;
const current = user => { if (!user || identity(active()) !== identity(user)) throw new Error('Account changed'); };
const google = user => user.authProvider === 'google';
const favoriteKey = user => `clinicalmind.favorites.${user.email}`;
const noteKey = (user,id) => `clinicalmind.notes.${google(user) ? 'uid.'+user.firebaseUid : user.email}.${id}`;
const draftKey = (user,id) => `protocolum.note-draft.${identity(user)}.${id}`;
const favoritesLoads = new Map(), queues = new Map(),favoriteWatches=new Map();let watchVersion=0;
function watchFavorites(store,user,version){
 const key=identity(user);if(version!==watchVersion||favoriteWatches.has(key)||!store.onSnapshot)return;
 const valid=()=>version===watchVersion&&identity(active())===key;
 const stop=store.onSnapshot(store.ref,{includeMetadataChanges:true},snapshot=>{if(!valid()||snapshot.metadata?.hasPendingWrites||snapshot.metadata?.fromCache)return;const ids=favorites(snapshot.data()?.favorites),before=favorites(read(favoriteKey(user),[]));favoritesLoads.set(key,Promise.resolve(ids));localStorage.setItem(favoriteKey(user),JSON.stringify(ids));if(JSON.stringify(before)!==JSON.stringify(ids))window.clinicalMindRefreshFavorites?.();window.dispatchEvent?.(new CustomEvent('protocolum-favorites-sync-ready'));},()=>{if(valid())window.dispatchEvent?.(new CustomEvent('protocolum-favorites-sync-error'));});favoriteWatches.set(key,stop);
}
const favorites = value => [...new Set((Array.isArray(value)?value:[]).filter(id=>typeof id==='string' && id.length>0 && id.length<=200))].slice(0,2000);
function read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function cachedNote(user,id) { const value=read(noteKey(user,id),read(`clinicalmind.notes.${user.email}.${id}`,''));return typeof value==='string'?value.slice(0,3000):''; }
async function cloud(user) {
  const [firebase,store]=await Promise.all([import('./auth-google.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
  current(user);
  if(!firebase.db || firebase.auth?.currentUser?.uid!==user.firebaseUid)throw new Error('Google sign-in required');
  return {...store,ref:store.doc(firebase.db,'private_study',user.firebaseUid),note:id=>store.doc(firebase.db,'private_study',user.firebaseUid,'notes',encodeURIComponent(id))};
}
function enqueue(key,operation) {const result=(queues.get(key)||Promise.resolve()).then(operation);const tail=result.catch(()=>{});queues.set(key,tail);tail.finally(()=>{if(queues.get(key)===tail)queues.delete(key);});return result;}
export async function reconnectFavoriteUpdates(user){const version=++watchVersion;favoriteWatches.forEach(stop=>stop());favoriteWatches.clear();const store=await cloud(user);watchFavorites(store,user,version);}
export function resetStudySync() {watchVersion++;favoriteWatches.forEach(stop=>stop());favoriteWatches.clear();favoritesLoads.clear();}
export async function loadFavorites(user) {
  current(user);
  if(!google(user))return favorites(read(favoriteKey(user),[]));
  const key=identity(user);
  if(!favoritesLoads.has(key)) {
    const version=watchVersion;const loading=(async()=>{
      const store=await cloud(user);
      const snapshot=await store.getDocFromServer(store.ref);current(user);
      let ids;
      if(snapshot.exists())ids=favorites(snapshot.data().favorites);
      else ids=await store.runTransaction(store.ref.firestore,async tx=>{
        const latest=await tx.get(store.ref);current(user);
        if(latest.exists())return favorites(latest.data().favorites);
        const local=favorites(read(favoriteKey(user),[]));tx.set(store.ref,{favorites:local});return local;
      });
      current(user);localStorage.setItem(favoriteKey(user),JSON.stringify(ids));watchFavorites(store,user,version);return ids;
    })();
    favoritesLoads.set(key,loading);loading.catch(()=>{if(favoritesLoads.get(key)===loading)favoritesLoads.delete(key);});
  }
  return favoritesLoads.get(key);
}
export async function toggleFavorite(user,id) {
  if(typeof id!=='string'||!id||id.length>200)throw new Error('Invalid guideline');
  return enqueue(identity(user)+':favorites',async()=>{
    current(user);await loadFavorites(user);
    let ids=favorites(read(favoriteKey(user),[]));
    if(google(user)) {
      const store=await cloud(user);
      ids=await store.runTransaction(store.ref.firestore,async tx=>{
        const snapshot=await tx.get(store.ref);current(user);
        const saved=favorites(snapshot.data()?.favorites);
        const next=saved.includes(id)?saved.filter(value=>value!==id):[...saved,id];
        if(next.length>2000)throw new Error('Favorite limit reached');
        tx.set(store.ref,{favorites:next});return next;
      });current(user);favoritesLoads.set(identity(user),Promise.resolve(ids));
    } else ids=ids.includes(id)?ids.filter(value=>value!==id):[...ids,id];
    localStorage.setItem(favoriteKey(user),JSON.stringify(ids));return ids.includes(id);
  });
}
export async function loadNote(user,id) {
  current(user);let value=cachedNote(user,id);
  if(google(user)) {
    const store=await cloud(user);const ref=store.note(id);
    const snapshot=await store.getDocFromServer(ref);current(user);
    if(snapshot.exists())value=snapshot.data().text;
    else if(value) value=await store.runTransaction(ref.firestore,async tx=>{
      const latest=await tx.get(ref);current(user);
      if(latest.exists())return latest.data().text;
      tx.set(ref,{text:value});return value;
    });
    current(user);
  }
  value=typeof value==='string'?value.slice(0,3000):'';
  localStorage.setItem(noteKey(user,id),JSON.stringify(value));
  const draft=read(draftKey(user,id),null);
  return {text:typeof draft==='string'?draft:value,pending:typeof draft==='string'};
}
export async function migrateLegacyNotes(user) {
  current(user);if(!google(user))return;
  const prefix=`clinicalmind.notes.${user.email}.`,ids=[];
  for(let i=0;i<localStorage.length;i++) {
    const key=localStorage.key(i);
    if(key?.startsWith(prefix)) {const id=key.slice(prefix.length);if(id&&id.length<=200)ids.push(id);}
  }
  // Bound concurrency while migrating only this account's existing notes.
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(4,ids.length)},async()=>{
    while(cursor<ids.length){const id=ids[cursor++];current(user);await loadNote(user,id);}
  }));
}
export function saveDraft(user,id,text) { current(user);localStorage.setItem(draftKey(user,id),JSON.stringify(text.slice(0,3000))); }
export function saveNote(user,id,text) {
  if(typeof text!=='string'||text.length>3000)return Promise.reject(new Error('Invalid note'));
  return enqueue(identity(user)+':note:'+id,async()=>{
    current(user);
    if(google(user)){const store=await cloud(user);await store.setDoc(store.note(id),{text});current(user);}
    localStorage.setItem(noteKey(user,id),JSON.stringify(text));
    if(read(draftKey(user,id),null)===text)localStorage.removeItem(draftKey(user,id));
  });
}
export async function mountReaderNotes(user,id,textarea,status) {
  if(!user)return;
  let revision=0,timer;
  const visible=()=>textarea.isConnected && identity(active())===identity(user);
  const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Tentar novamente';retry.hidden=true;status.after(retry);
  const flush=async()=>{
    const version=revision,text=textarea.value;retry.hidden=true;status.textContent=google(user)?'Salvando na nuvem…':'Salvando…';
    try {await saveNote(user,id,text);if(visible()&&version===revision)status.textContent=google(user)?'Salvo na nuvem.':'Salvo neste navegador.';}
    catch {if(visible()&&version===revision){status.textContent='Rascunho neste navegador. Não foi possível sincronizar; tente novamente.';retry.hidden=false;retry.onclick=flush;}}
  };
  const load=async()=>{
    textarea.disabled=true;retry.hidden=true;status.textContent='Carregando anotações…';
    try {
      const note=await loadNote(user,id);if(!visible())return;
      textarea.value=note.text;textarea.disabled=false;status.textContent=google(user)?'Anotações sincronizadas com a nuvem.':'Anotações salvas neste navegador.';
      if(note.pending)await flush();
    } catch {if(visible()){status.textContent='Não foi possível carregar as anotações. Verifique a conexão e tente novamente.';retry.hidden=false;retry.onclick=load;}}
  };
  textarea.oninput=()=>{
    revision++;clearTimeout(timer);
    try {saveDraft(user,id,textarea.value);status.textContent=google(user)?'Rascunho local; aguardando sincronização…':'Salvando…';timer=setTimeout(flush,500);}
    catch {status.textContent='Não foi possível salvar o rascunho neste navegador.';}
  };
  await load();
}
