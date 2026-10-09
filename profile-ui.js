import { normalizeProfile } from './profile-data.js';
export { normalizeProfile } from './profile-data.js';
import { loadProfile, saveProfile, saveProfileName } from './profile-store.js';
import { mountNetwork, stopNetwork } from './friends-network.js';
import { mountAcademic } from './profile-academic.js';
const text = (pt, en) => document.documentElement.lang.startsWith('en') ? en : pt;
const account = () => window.clinicalMindCurrentUser?.();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const field = (id, label, value, max = 160, type = 'text') => `<label for="${id}">${label}<input id="${id}" type="${type}" maxlength="${max}" value="${escape(value)}"></label>`;
async function enhanceProfile(target) {
  const user = account(), body = target || document.getElementById('detailBody');
  if (!user || !body || (!target && document.getElementById('detailOverlay')?.style.display !== 'flex')) return;
  body.querySelectorAll('#profileForm input, #profileForm button').forEach(control=>control.disabled=true);
  const loading = document.createElement('p');
  loading.setAttribute('role','status');
  loading.textContent=text('Carregando perfil…','Loading profile…');
  body.prepend(loading);
  let profile;
  try { profile = await loadProfile(user); }
  catch {
    if (!body.isConnected || account()?.email !== user.email) return;
    loading.textContent=text('Não foi possível carregar seu perfil da nuvem. Verifique a conexão e tente novamente.','Could not load your cloud profile. Check your connection and try again.');
    const retry=document.createElement('button');retry.className='btn';retry.textContent=text('Tentar novamente','Try again');
    retry.onclick=()=>renderProfilePage();loading.append(' ',retry);return;
  }
  if (!body.isConnected || account()?.email !== user.email || account()?.firebaseUid !== user.firebaseUid) return;
  loading.remove();
  let retryAction=null;
  const syncMessage={saving:text('Salvando…','Saving…'),saved:text('Salvo na nuvem.','Saved to the cloud.'),error:text('Falha ao salvar. Suas alterações foram mantidas.','Failed to save. Your changes were kept.'),local:text('Salvo neste navegador.','Saved in this browser.'),dirty:text('Alterações ainda não salvas.','Changes not saved yet.')};
  const setSync=state=>{section.querySelector('#profileSyncState').dataset.state=state;section.querySelector('#profileSyncMessage').textContent=syncMessage[state];section.querySelector('#profileSyncRetry').hidden=state!=='error';};
  const attempt = async (operation, onSuccess, status) => {
    const controls=[...section.querySelectorAll('button, input, select, textarea')];
    const enabled=controls.filter(control=>!control.disabled);enabled.forEach(control=>control.disabled=true);
    retryAction=null;setSync('saving');status.textContent=syncMessage.saving;
    try { await operation();onSuccess();status.textContent=saved();setSync(user.authProvider==='google'?'saved':'local');return true; }
    catch { status.textContent=text('Não foi possível salvar. Suas alterações continuam no formulário; tente novamente.','Could not save. Your changes remain in the form; try again.');retryAction=()=>attempt(operation,onSuccess,status);setSync('error');return false; }
    finally { enabled.forEach(control=>control.disabled=false); }
  };
  const save=(next,status,onSuccess)=>{let result;return attempt(async()=>{result=await saveProfile(user,next);},()=>{profile=normalizeProfile(result);onSuccess?.();section.dispatchEvent(new Event('profile-updated'));},status);};
  const saved = () => user.authProvider === 'google' ? text('Salvo na nuvem.','Saved to the cloud.') : text('Salvo neste navegador. Entre com Google para salvar na nuvem.','Saved in this browser. Sign in with Google to save to the cloud.');
  document.getElementById('detailTitle').textContent = text('Meu perfil','My profile');
  const section = document.createElement('section');
  section.className = 'profile-details';
  section.innerHTML = `<header class="profile-summary"><span class="profile-monogram" aria-hidden="true">${escape(account()?.name?.slice(0,1).toUpperCase() || 'P')}</span><div><h3>${escape(account()?.name || user.name)}</h3><p>${user.authProvider === 'google' ? text('Conta Google conectada','Google account connected') : text('Conta local','Local account')}</p></div></header>
  <form id="professionalProfile"><h3>${text('Sobre mim','About me')}</h3><div class="profile-fields">${field('profileRole',text('Formação / atuação','Training / role'),profile.role,80)}${field('profileSpecialty',text('Especialidade / área de interesse','Specialty / area of interest'),profile.specialty,80)}${field('profileInstitution',text('Instituição','Institution'),profile.institution)}${field('profileCity',text('Cidade','City'),profile.city,100)}</div><label for="profileBio">${text('Bio','Bio')}<textarea id="profileBio" rows="3" maxlength="600" placeholder="${text('Interesses acadêmicos e objetivos de estudo…','Academic interests and study goals…')}">${escape(profile.bio)}</textarea></label><small>${text('Evite inserir informações de pacientes. O perfil não é público.','Avoid patient information. Your profile is not public.')}</small><button class="btn primary" type="submit">${text('Salvar perfil','Save profile')}</button><p id="professionalStatus" role="status" aria-live="polite"></p></form>
  <section class="profile-friends" aria-labelledby="friendsHeading"><h3 id="friendsHeading">${text('Meus amigos','My friends')} <span id="friendsCount"></span></h3><p class="profile-hint">${text('Contatos privados do seu perfil. Não envia convites nem estabelece amizade entre contas.','Private profile contacts. No invitations are sent and no connection is established between accounts.')}</p><form id="friendForm"><div class="profile-fields">${field('friendName',text('Nome','Name'),'',80)}${field('friendEmail',text('E-mail','Email'),'',160,'email')}${field('friendSpecialty',text('Especialidade (opcional)','Specialty (optional)'),'',80)}</div><button class="btn primary" id="friendSave" type="submit">${text('Adicionar amigo','Add friend')}</button><button class="btn" id="friendCancel" type="button" hidden>${text('Cancelar edição','Cancel editing')}</button><p id="friendStatus" role="status" aria-live="polite"></p></form><label for="friendSearch">${text('Buscar na lista','Search your list')}<input id="friendSearch" type="search" maxlength="160"></label><ul id="friendList" class="profile-friend-list"></ul></section>`;
  body.prepend(section);
  const sync=document.createElement('div');sync.className='profile-sync';sync.id='profileSyncState';sync.setAttribute('role','status');sync.setAttribute('aria-live','polite');
  sync.innerHTML=`<span id="profileSyncMessage"></span><button id="profileSyncRetry" class="btn" type="button" hidden>${text('Tentar novamente','Try again')}</button>`;
  section.querySelector('.profile-summary').after(sync);
  section.querySelector('#profileSyncRetry').onclick=()=>retryAction?.();
  section.addEventListener('input',event=>{if(event.target.id!=='friendSearch'&&!event.target.closest('.network-panel')&&sync.dataset.state!=='saving'){retryAction=null;setSync('dirty');}});
  setSync(user.authProvider==='google'?'saved':'local');
  const get = id => section.querySelector('#' + id);
  let editing = null;
  const renderFriends = () => {
    const query = get('friendSearch').value.trim().toLocaleLowerCase();
    const matches = profile.friends.filter(f => `${f.name} ${f.email} ${f.specialty}`.toLocaleLowerCase().includes(query));
    section.dispatchEvent(new Event('profile-updated'));
    get('friendsCount').textContent = `(${profile.friends.length})`;
    get('friendList').innerHTML = matches.length ? matches.map(f => `<li><div><strong>${escape(f.name)}</strong><span>${escape(f.specialty)}</span><a href="mailto:${escape(f.email)}">${escape(f.email)}</a></div><div class="profile-friend-actions"><button type="button" class="btn" data-find-profile="${escape(f.id)}">${text('Buscar perfil','Find profile')}</button><button type="button" class="btn" data-edit="${escape(f.id)}">${text('Editar','Edit')}</button><button type="button" class="btn" data-remove="${escape(f.id)}">${text('Remover','Remove')}</button></div></li>`).join('') : `<li>${query ? text('Nenhum amigo encontrado.','No friends found.') : text('Sua lista está vazia. Adicione um colega para começar.','Your list is empty. Add a colleague to get started.')}</li>`;
  };
  const reset = () => { editing=null;get('friendForm').reset();get('friendCancel').hidden=true;get('friendSave').textContent=text('Adicionar amigo','Add friend'); };
  get('friendName').required=true;get('friendEmail').required=true;
  get('professionalProfile').onsubmit = async event => {
    event.preventDefault();
    const next = {...profile,role:clean(get('profileRole').value,80),specialty:clean(get('profileSpecialty').value,80),institution:clean(get('profileInstitution').value),city:clean(get('profileCity').value,100),bio:clean(get('profileBio').value,600)};
    await save(next,get('professionalStatus'));
  };
  get('friendForm').onsubmit = async event => {
    event.preventDefault();
    const status=get('friendStatus'), name=clean(get('friendName').value,80), email=clean(get('friendEmail').value).toLowerCase();
    if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent=text('Informe um nome e um e-mail válido.','Enter a name and valid email.');return;}
    if(email===user.email.toLowerCase()){status.textContent=text('Esse é o e-mail da sua própria conta.','This is your own account email.');return;}
    if(profile.friends.some(f=>f.email===email && f.id!==editing)){status.textContent=text('Este amigo já está na lista.','This friend is already on your list.');return;}
    if(!editing && profile.friends.length>=100){status.textContent=text('Limite de 100 contatos atingido.','100 contact limit reached.');return;}
    const friend={id:editing || (crypto.randomUUID?.() || 'friend-' + Date.now() + '-' + Math.random().toString(36).slice(2)),name,email,specialty:clean(get('friendSpecialty').value,80)};
    const next={...profile,friends:editing?profile.friends.map(f=>f.id===editing?friend:f):[...profile.friends,friend]};
    await save(next,status,()=>{reset();renderFriends();});
  };
  get('friendCancel').onclick=reset;get('friendSearch').oninput=renderFriends;
  get('friendList').onclick = async event => {
    const find=event.target.closest('[data-find-profile]');
    if(find){const friend=profile.friends.find(f=>f.id===find.dataset.findProfile);if(friend){get('friendStatus').textContent=text('Escolha o perfil publicado do colega na rede acadêmica. É necessário entrar com Google.','Choose the colleague’s published profile in the academic network. Google sign-in is required.');section.dispatchEvent(new CustomEvent('find-contact-profile',{detail:{name:friend.name}}));}return;}
    const edit=event.target.closest('[data-edit]'), remove=event.target.closest('[data-remove]');
    if(edit){const f=profile.friends.find(f=>f.id===edit.dataset.edit);if(!f)return;editing=f.id;get('friendName').value=f.name;get('friendEmail').value=f.email;get('friendSpecialty').value=f.specialty;get('friendSave').textContent=text('Salvar amigo','Save friend');get('friendCancel').hidden=false;get('friendName').focus();}
    if(remove){const next={...profile,friends:profile.friends.filter(f=>f.id!==remove.dataset.remove)};await save(next,get('friendStatus'),()=>{if(editing===remove.dataset.remove)reset();renderFriends();});}
  };
  // Export only this account's extended profile. No credentials are included.
  const exportButton = body.querySelector('#exportData');
  if(exportButton)exportButton.onclick=()=>{
    let favorites=[];try{const ids=JSON.parse(localStorage.getItem('clinicalmind.favorites.'+user.email)||'[]');if(Array.isArray(ids))favorites=ids.map(id=>window.clinicalMindGetGuideline?.(id)).filter(Boolean).map(({id,title,society,cid})=>({id,title,society,cid}));}catch{}
    const blob=new Blob([JSON.stringify({name:account()?.name,email:user.email,createdAt:user.createdAt,profile,favorites},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download='protocolum-perfil.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const professional=section.querySelector('#professionalProfile');const editAbout=document.createElement('details');editAbout.className='academic-editor';editAbout.innerHTML='<summary>'+text('Editar apresentação','Edit introduction')+'</summary>';professional.before(editAbout);const nameForm=body.querySelector('#profileForm');if(nameForm){
    editAbout.append(nameForm);
    nameForm.querySelectorAll('input, button').forEach(control=>control.disabled=false);
    const input=nameForm.querySelector('#profileName');input.value=account()?.name||user.name;
    nameForm.onsubmit=async event=>{
      event.preventDefault();const status=nameForm.querySelector('#profileStatus'),name=clean(input.value,80);
      if(name.length<2){status.textContent=text('Use pelo menos 2 caracteres.','Use at least 2 characters.');return;}
      await attempt(async()=>{await saveProfileName(user,name);profile=await loadProfile(user);},()=>{section.dispatchEvent(new Event('profile-updated'));section.querySelector('.profile-summary h3').textContent=name;section.querySelector('.profile-monogram').textContent=name.slice(0,1).toUpperCase();},status);
    };
  }editAbout.append(professional);
  mountAcademic(section,user,()=>profile,async (next,status,afterSave)=>save(next,status,afterSave));
  section.querySelector('.profile-summary').after(sync);
  mountNetwork(section,user,()=>profile,next=>{profile=normalizeProfile(next);section.dispatchEvent(new Event('profile-updated'));});
  renderFriends();
}
export function renderProfilePage() {
  stopNetwork();
  const host=document.getElementById('recommendations');
  if(!host || !account())return;
  document.getElementById('detailOverlay').style.display='none';
  document.getElementById('detailBody').replaceChildren();
  host.classList.remove('list','community');
  host.innerHTML='<article class="profile-page" aria-labelledby="profilePageTitle"><header class="profile-page-heading"><span>Protocolum · '+text('Espaço acadêmico','Academic space')+'</span><h1 id="profilePageTitle">'+text('Meu perfil','My profile')+'</h1><p>'+text('Apresentação, conexões acadêmicas e publicações. Com Google, alterações salvas na nuvem.','Introduction, academic links and publications. With Google, changes are saved to the cloud.')+'</p></header><div id="profilePageBody"></div></article>';
  const body=host.querySelector('#profilePageBody');
  window.renderProfileAccountBase?.(body);
  enhanceProfile(body);
}
export function injectProfile() {
  window.renderProfilePage=renderProfilePage;
  const button=document.getElementById('accountBtn');
  if(button){button.dataset.protocolumProfile='ready';button.onclick=()=>document.querySelector('#nav [data-section="Perfil"]')?.click();}
  if(document.querySelector('.nav-btn.active')?.dataset.section==='Perfil')renderProfilePage();
  let lastLanguage=document.documentElement.lang;
  new MutationObserver(()=>{
    const next=document.documentElement.lang;
    if(next===lastLanguage)return;
    lastLanguage=next;
    if(document.querySelector('.nav-btn.active')?.dataset.section==='Perfil')renderProfilePage();
  }).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}
