import { normalizeAcademic, mountAcademic } from './profile-academic.js';
const text = (pt, en) => document.documentElement.lang.startsWith('en') ? en : pt;
const account = () => window.clinicalMindCurrentUser?.();
const key = user => 'protocolum.profile.v1.' + user.email.toLowerCase();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function normalizeProfile(value = {}) {
  const p = value && typeof value === 'object' ? value : {};
  const friends = Array.isArray(p.friends) ? p.friends.filter(f => f && typeof f === 'object').map(f => ({id:clean(f.id),name:clean(f.name,80),email:clean(f.email).toLowerCase(),specialty:clean(f.specialty,80)})).filter(f => f.id && f.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) : [];
  return {...normalizeAcademic(p),role:clean(p.role,80),specialty:clean(p.specialty,80),institution:clean(p.institution),city:clean(p.city,100),bio:clean(p.bio,600),friends:friends.filter((f,i,a)=>a.findIndex(x=>x.email===f.email)===i)};
}
function read(user) {
  try { return normalizeProfile(JSON.parse(localStorage.getItem(key(user)) || '{}')); }
  catch { return normalizeProfile(); }
}
function save(user, profile, status) {
  try { localStorage.setItem(key(user), JSON.stringify(profile)); return true; }
  catch { status.textContent = text('Não foi possível salvar. Verifique o espaço e as permissões do navegador.','Could not save. Check browser storage and permissions.'); return false; }
}
const field = (id, label, value, max = 160, type = 'text') => `<label for="${id}">${label}<input id="${id}" type="${type}" maxlength="${max}" value="${escape(value)}"></label>`;
function enhanceProfile(target) {
  const user = account(), body = target || document.getElementById('detailBody');
  if (!user || !body || (!target && document.getElementById('detailOverlay')?.style.display !== 'flex')) return;
  let profile = read(user);
  document.getElementById('detailTitle').textContent = text('Meu perfil','My profile');
  const section = document.createElement('section');
  section.className = 'profile-details';
  section.innerHTML = `<header class="profile-summary"><span class="profile-monogram" aria-hidden="true">${escape(user.name?.slice(0,1).toUpperCase() || 'P')}</span><div><h3>${escape(user.name)}</h3><p>${user.authProvider === 'google' ? text('Conta Google conectada','Google account connected') : text('Conta local','Local account')}</p></div></header>
  <form id="professionalProfile"><h3>${text('Sobre mim','About me')}</h3><div class="profile-fields">${field('profileRole',text('Formação / atuação','Training / role'),profile.role,80)}${field('profileSpecialty',text('Especialidade / área de interesse','Specialty / area of interest'),profile.specialty,80)}${field('profileInstitution',text('Instituição','Institution'),profile.institution)}${field('profileCity',text('Cidade','City'),profile.city,100)}</div><label for="profileBio">${text('Bio','Bio')}<textarea id="profileBio" rows="3" maxlength="600" placeholder="${text('Interesses acadêmicos e objetivos de estudo…','Academic interests and study goals…')}">${escape(profile.bio)}</textarea></label><small>${text('Evite inserir informações de pacientes. O perfil não é público.','Avoid patient information. Your profile is not public.')}</small><button class="btn primary" type="submit">${text('Salvar perfil','Save profile')}</button><p id="professionalStatus" role="status" aria-live="polite"></p></form>
  <section class="profile-friends" aria-labelledby="friendsHeading"><h3 id="friendsHeading">${text('Meus amigos','My friends')} <span id="friendsCount"></span></h3><p class="profile-hint">${text('Lista pessoal salva nesta conta e neste navegador. Não envia convites nem estabelece amizade entre contas.','Personal list saved for this account in this browser. No invitations are sent and no connection is established between accounts.')}</p><form id="friendForm"><div class="profile-fields">${field('friendName',text('Nome','Name'),'',80)}${field('friendEmail',text('E-mail','Email'),'',160,'email')}${field('friendSpecialty',text('Especialidade (opcional)','Specialty (optional)'),'',80)}</div><button class="btn primary" id="friendSave" type="submit">${text('Adicionar amigo','Add friend')}</button><button class="btn" id="friendCancel" type="button" hidden>${text('Cancelar edição','Cancel editing')}</button><p id="friendStatus" role="status" aria-live="polite"></p></form><label for="friendSearch">${text('Buscar na lista','Search your list')}<input id="friendSearch" type="search" maxlength="160"></label><ul id="friendList" class="profile-friend-list"></ul></section>`;
  body.prepend(section);
  const get = id => section.querySelector('#' + id);
  let editing = null;
  const renderFriends = () => {
    const query = get('friendSearch').value.trim().toLocaleLowerCase();
    const matches = profile.friends.filter(f => `${f.name} ${f.email} ${f.specialty}`.toLocaleLowerCase().includes(query));
    section.dispatchEvent(new Event('profile-updated'));
    get('friendsCount').textContent = `(${profile.friends.length})`;
    get('friendList').innerHTML = matches.length ? matches.map(f => `<li><div><strong>${escape(f.name)}</strong><span>${escape(f.specialty)}</span><a href="mailto:${escape(f.email)}">${escape(f.email)}</a></div><div class="profile-friend-actions"><button type="button" class="btn" data-edit="${escape(f.id)}">${text('Editar','Edit')}</button><button type="button" class="btn" data-remove="${escape(f.id)}">${text('Remover','Remove')}</button></div></li>`).join('') : `<li>${query ? text('Nenhum amigo encontrado.','No friends found.') : text('Sua lista está vazia. Adicione um colega para começar.','Your list is empty. Add a colleague to get started.')}</li>`;
  };
  const reset = () => { editing=null;get('friendForm').reset();get('friendCancel').hidden=true;get('friendSave').textContent=text('Adicionar amigo','Add friend'); };
  get('friendName').required=true;get('friendEmail').required=true;
  get('professionalProfile').onsubmit = event => {
    event.preventDefault();
    const next = {...profile,role:clean(get('profileRole').value,80),specialty:clean(get('profileSpecialty').value,80),institution:clean(get('profileInstitution').value),city:clean(get('profileCity').value,100),bio:clean(get('profileBio').value,600)};
    if (save(user,next,get('professionalStatus'))) {profile=next;section.dispatchEvent(new Event('profile-updated'));get('professionalStatus').textContent=text('Perfil salvo neste navegador.','Profile saved in this browser.');}
  };
  get('friendForm').onsubmit = event => {
    event.preventDefault();
    const status=get('friendStatus'), name=clean(get('friendName').value,80), email=clean(get('friendEmail').value).toLowerCase();
    if(name.length<2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status.textContent=text('Informe um nome e um e-mail válido.','Enter a name and valid email.');return;}
    if(email===user.email.toLowerCase()){status.textContent=text('Esse é o e-mail da sua própria conta.','This is your own account email.');return;}
    if(profile.friends.some(f=>f.email===email && f.id!==editing)){status.textContent=text('Este amigo já está na lista.','This friend is already on your list.');return;}
    const friend={id:editing || (crypto.randomUUID?.() || 'friend-' + Date.now() + '-' + Math.random().toString(36).slice(2)),name,email,specialty:clean(get('friendSpecialty').value,80)};
    const next={...profile,friends:editing?profile.friends.map(f=>f.id===editing?friend:f):[...profile.friends,friend]};
    if(save(user,next,status)){profile=next;reset();renderFriends();status.textContent=text('Lista atualizada.','List updated.');}
  };
  get('friendCancel').onclick=reset;get('friendSearch').oninput=renderFriends;
  get('friendList').onclick = event => {
    const edit=event.target.closest('[data-edit]'), remove=event.target.closest('[data-remove]');
    if(edit){const f=profile.friends.find(f=>f.id===edit.dataset.edit);if(!f)return;editing=f.id;get('friendName').value=f.name;get('friendEmail').value=f.email;get('friendSpecialty').value=f.specialty;get('friendSave').textContent=text('Salvar amigo','Save friend');get('friendCancel').hidden=false;get('friendName').focus();}
    if(remove){const next={...profile,friends:profile.friends.filter(f=>f.id!==remove.dataset.remove)};if(save(user,next,get('friendStatus'))){profile=next;if(editing===remove.dataset.remove)reset();renderFriends();get('friendStatus').textContent=text('Amigo removido da lista.','Friend removed from the list.');}}
  };
  // Export only this account's extended profile. No credentials are included.
  const exportButton = body.querySelector('#exportData');
  if(exportButton)exportButton.onclick=()=>{
    let favorites=[];try{const ids=JSON.parse(localStorage.getItem('clinicalmind.favorites.'+user.email)||'[]');if(Array.isArray(ids))favorites=ids.map(id=>window.clinicalMindGetGuideline?.(id)).filter(Boolean).map(({id,title,society,cid})=>({id,title,society,cid}));}catch{}
    const blob=new Blob([JSON.stringify({name:account()?.name,email:user.email,createdAt:user.createdAt,profile,favorites},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), link=document.createElement('a');link.href=url;link.download='protocolum-perfil.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const professional=section.querySelector('#professionalProfile');const editAbout=document.createElement('details');editAbout.className='academic-editor';editAbout.innerHTML='<summary>'+text('Editar apresentação','Edit introduction')+'</summary>';professional.before(editAbout);const nameForm=body.querySelector('#profileForm');if(nameForm){editAbout.append(nameForm);nameForm.addEventListener('submit',()=>queueMicrotask(()=>{const updated=account();section.querySelector('.profile-summary h3').textContent=updated?.name||user.name;section.querySelector('.profile-monogram').textContent=(updated?.name||user.name).slice(0,1).toUpperCase();}));}editAbout.append(professional);
  mountAcademic(section,user,()=>profile,(next,status)=>{if(!save(user,next,status))return false;profile=normalizeProfile(next);return true;});
  renderFriends();
}
export function renderProfilePage() {
  const host=document.getElementById('recommendations');
  if(!host || !account())return;
  document.getElementById('detailOverlay').style.display='none';
  document.getElementById('detailBody').replaceChildren();
  host.classList.remove('list','community');
  host.innerHTML='<article class="profile-page" aria-labelledby="profilePageTitle"><header class="profile-page-heading"><span>Protocolum · '+text('Espaço acadêmico','Academic space')+'</span><h1 id="profilePageTitle">'+text('Meu perfil','My profile')+'</h1><p>'+text('Apresentação, conexões acadêmicas e publicações. Dados salvos neste navegador.','Introduction, academic links and publications. Data saved in this browser.')+'</p></header><div id="profilePageBody"></div></article>';
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
