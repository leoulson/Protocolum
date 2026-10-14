import { loadProfile, saveProfileAppearance, subscribeProfileUpdates } from './profile-store.js';
const account=()=>window.clinicalMindCurrentUser?.(),identity=u=>u?`${u.authProvider||'local'}:${u.firebaseUid||u.email}`:'';
const t=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
let owner='',version=0,revision=0,pending=null,state='device',busy=false;
function render(){
 for(const panel of document.querySelectorAll('.appearance-settings')){
  panel.querySelector('select').value=window.protocolumAppearance.get();
  panel.dataset.state=state;
  const messages={device:t('Preferência salva neste navegador.','Preference saved in this browser.'),loading:t('Consultando a preferência do perfil…','Loading profile preference…'),saving:t('Salvando aparência…','Saving appearance…'),saved:t('Aparência salva na nuvem.','Appearance saved to the cloud.'),local:t('Aparência salva neste perfil local.','Appearance saved in this local profile.'),error:t('Não foi possível sincronizar. A escolha continua aplicada neste navegador. Tente novamente.','Could not sync. Your choice remains active in this browser. Try again.')};
  panel.querySelector('[data-appearance-status]').textContent=messages[state];panel.querySelector('[data-appearance-retry]').hidden=state!=='error';
 }
}
async function save(){
 const user=account();if(!user||!pending||busy)return;
 const token=version,wanted=pending,attempt=revision;busy=true;state='saving';render();
 try{
  await saveProfileAppearance(user,wanted);if(token!==version)return;
  if(attempt===revision){pending=null;state=user.authProvider==='google'?'saved':'local';}
 }catch{if(token===version)state='error';}
 finally{if(token===version){busy=false;render();if(pending&&attempt!==revision)save();}}
}
async function connect(){
 const user=account(),next=identity(user);if(next===owner)return;
 owner=next;const token=++version;revision++;pending=null;busy=false;state=user?'loading':'device';render();
 if(!user)return;
 try{const profile=await loadProfile(user);if(token!==version||pending)return;window.protocolumAppearance.set(profile.appearance||'system',{source:'profile'});state=user.authProvider==='google'?'saved':'local';}
 catch{if(token===version)state='error';}finally{if(token===version)render();}
}
window.addEventListener('protocolum-account-changed',connect);
window.addEventListener('protocolum-appearance-changed',event=>{
 if(event.detail.source==='user'&&account()){revision++;pending=event.detail.mode;save();}render();
});
subscribeProfileUpdates(update=>{
 if(update.status==='ready'&&account()?.authProvider==='google'&&update.uid===account()?.firebaseUid&&!pending&&!busy){window.protocolumAppearance.set(update.profile.appearance||'system',{source:'profile'});state='saved';render();}
});
export function mountAppearance(section){
 const panel=document.createElement('section');panel.className='appearance-settings';panel.setAttribute('aria-label',t('Aparência','Appearance'));
 panel.innerHTML=`<h3>${t('Aparência','Appearance')}</h3><label>${t('Tema do aplicativo','App theme')}<select aria-label="${t('Tema do aplicativo','App theme')}"><option value="system">${t('Acompanhar o sistema','Follow system')}</option><option value="light">${t('Modo claro','Light mode')}</option><option value="dark">${t('Modo escuro','Dark mode')}</option></select></label><p data-appearance-status role="status" aria-live="polite"></p><button class="btn" type="button" data-appearance-retry hidden>${t('Tentar novamente','Try again')}</button>`;
 section.querySelector('.profile-summary').after(panel);
 panel.querySelector('select').onchange=event=>window.protocolumAppearance.set(event.target.value,{source:'user'});
 panel.querySelector('button').onclick=()=>{if(pending)save();else{owner='';connect();}};
 render();
}
connect();
