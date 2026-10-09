import { saveProfileSharing } from './profile-store.js';
import { SHARE_FIELDS, normalizeSharing } from './profile-sharing.js';
import { normalizeAcademic } from './profile-academic.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pair=(a,b)=>[a,b].sort().join('~');
let stops=[];
export function stopNetwork(){stops.forEach(stop=>stop());stops=[];}
window.protocolumStopNetwork=stopNetwork;
export async function mountNetwork(section,localUser,getProfile,onProfileSaved=()=>{}){
  stopNetwork();
  const root=document.createElement('section');root.className='network-panel';root.setAttribute('aria-labelledby','networkTitle');
  root.innerHTML=`<header><h2 id="networkTitle">${t('Rede acadêmica','Academic network')}</h2><p>${t('Encontre colegas e construa conexões com aceite mútuo.','Find colleagues and build mutually accepted connections.')}</p></header><p id="networkStatus" role="status" aria-live="polite"></p><div id="networkContent"></div>`;
  section.querySelector('.profile-friends').before(root);
  section.querySelector('.profile-friends h3').firstChild.textContent=t('Contatos pessoais ','Personal contacts ');
  const status=root.querySelector('#networkStatus'),content=root.querySelector('#networkContent');
  status.textContent=t('Carregando a rede acadêmica…','Loading academic network…');
  let db,auth,collection,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction;
  try {
    const [firebase,store]=await Promise.all([import('./auth-google.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
    ({db,auth}=firebase);
    ({collection,doc,getDoc,getDocs,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction}=store);
  } catch {
    if(root.isConnected)status.textContent=t('A rede está indisponível. Seu perfil, Lattes, ORCID e vitrine DOI continuam disponíveis abaixo e acima.','The network is unavailable. Your profile, Lattes, ORCID and DOI showcase remain available.');
    return;
  }
  if(!root.isConnected)return;
  status.textContent='';
  const user=auth?.currentUser;
  if(!user || localUser.firebaseUid!==user.uid){status.textContent=t('Entre com Google para acessar a rede entre usuários. Seus contatos pessoais continuam abaixo.','Sign in with Google to access the user network. Your personal contacts remain below.');return;}
  const uid=user.uid;let links=[],results=[],generation=0,viewGeneration=0,viewOpener=null;
  const dialog=document.createElement('dialog');dialog.className='friend-profile-dialog profile-details';dialog.setAttribute('aria-labelledby','friendProfileTitle');
  dialog.innerHTML=`<button class="btn" type="button" data-close-profile>${t('Fechar perfil','Close profile')}</button><div id="friendProfileContent"></div>`;root.append(dialog);
  const viewContent=dialog.querySelector('#friendProfileContent');
  dialog.querySelector('[data-close-profile]').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{viewGeneration++;viewContent.replaceChildren();if(viewOpener?.isConnected){viewOpener.disabled=false;viewOpener.focus();}});
  stops.push(()=>{viewGeneration++;dialog.close();dialog.remove();});
  const active=()=>root.isConnected&&auth?.currentUser?.uid===uid;
  const fail=error=>{if(active())status.textContent=error.code==='permission-denied'?t('A rede aguarda ativação das regras de acesso do Firebase. Seus dados locais foram preservados.','The network requires Firebase access rules activation. Your local data was preserved.'):t('Não foi possível acessar a rede. Verifique a conexão e tente novamente.','Could not access the network. Check your connection and retry.');};
  const labels={role:t('Formação / atuação','Training / role'),specialty:t('Especialidade','Specialty'),institution:t('Instituição','Institution'),city:t('Cidade','City'),bio:t('Bio','Biography'),orcid:'ORCID',lattes:'Lattes',articles:t('Publicações','Publications')};
  content.innerHTML=`<div class="network-publish"><h3>${t('Compartilhamento do perfil','Profile sharing')}</h3><p>${t('Escolha o que aparece no perfil da rede. Seu nome permanece visível; e-mail, contatos pessoais, favoritos e notas são privados.','Choose what appears in your network profile. Your name stays visible; email, personal contacts, favorites and notes are private.')}</p><fieldset id="networkVisibility"><legend>${t('Informações visíveis','Visible information')}</legend>${SHARE_FIELDS.map(field=>`<label><input type="checkbox" data-share-field="${field}"> ${labels[field]}</label>`).join('')}</fieldset><label class="network-auto"><input type="checkbox" id="networkAutoUpdate"> ${t('Atualizar o perfil publicado automaticamente ao salvar alterações','Automatically update the published profile when saving changes')}</label><p id="networkSharingState" role="status"></p><button class="btn primary" type="button" id="networkPublish">${t('Publicar / salvar compartilhamento','Publish / save sharing')}</button><button class="btn" type="button" id="networkHide">${t('Retirar perfil da rede','Remove profile from network')}</button></div><form id="networkSearchForm"><label for="networkSearch">${t('Buscar colegas pelo início do nome','Search colleagues by the start of their name')}<input id="networkSearch" type="search" minlength="2" maxlength="80" required placeholder="${t('Ex.: Leonardo','E.g. Leonardo')}"></label><button class="btn" type="submit">${t('Buscar','Search')}</button></form><div id="networkResults" class="network-cards"></div><h3>${t('Pedidos de amizade','Friend requests')}</h3><div id="networkRequests" class="network-cards"></div><h3>${t('Amigos','Friends')}</h3><div id="networkFriends" class="network-cards"></div>`;
  const get=id=>root.querySelector('#'+id);
  const relationship=other=>links.find(r=>r.members.includes(other));
  const card=(p)=>{
    const relation=relationship(p.uid);
    let action='send',label=t('Adicionar amigo','Add friend');
    if(relation){if(relation.status==='accepted'){action='remove';label=t('Desfazer amizade','Unfriend');}else if(relation.sender===uid){action='remove';label=t('Cancelar pedido','Cancel request');}else {action='accept';label=t('Aceitar pedido','Accept request');}}
    return `<article><div class="network-avatar" aria-hidden="true">${esc(p.name?.slice(0,1)||'?')}</div><div><strong>${esc(p.name||t('Perfil indisponível','Unavailable profile'))}</strong><p>${esc([p.specialty,p.institution].filter(Boolean).join(' · '))}</p></div><div class="profile-friend-actions"><button class="btn" type="button" data-view-user="${esc(p.uid)}">${t('Ver perfil','View profile')}</button><button class="btn" type="button" data-network-action="${action}" data-user="${esc(p.uid)}">${label}</button>${relation?.status==='pending'&&relation.sender!==uid?`<button class="btn" type="button" data-network-action="remove" data-user="${esc(p.uid)}">${t('Recusar','Decline')}</button>`:''}</div></article>`;
  };
  async function renderLinks(){
    const version=++generation;
    try{
      const profiles=await Promise.all(links.map(async r=>{const other=r.members.find(id=>id!==uid);const snapshot=await getDoc(doc(db,'network_profiles',other));return {...snapshot.data(),uid:other};}));
      if(!active()||version!==generation)return;
      get('networkRequests').innerHTML=profiles.filter((p,i)=>links[i].status==='pending').map(card).join('')||`<p>${t('Nenhum pedido pendente.','No pending requests.')}</p>`;
      get('networkFriends').innerHTML=profiles.filter((p,i)=>links[i].status==='accepted').map(card).join('')||`<p>${t('Ainda não há amizades confirmadas.','No confirmed friendships yet.')}</p>`;
      get('networkResults').innerHTML=results.map(card).join('');
    }catch(error){fail(error);}
  }
  stops.push(onSnapshot(query(collection(db,'network_connections'),where('members','array-contains',uid)),snapshot=>{links=snapshot.docs.map(d=>({...d.data(),id:d.id}));renderLinks();},fail));
  function renderSharing(){
    const sharing=normalizeSharing(getProfile().sharing);
    get('networkAutoUpdate').checked=sharing.autoUpdate;
    root.querySelectorAll('[data-share-field]').forEach(input=>{input.checked=sharing.visible.includes(input.dataset.shareField);});
    get('networkSharingState').textContent=!sharing.published?t('Perfil não publicado. Salvar alterações privadas não publica seu perfil.','Profile not published. Saving private changes does not publish your profile.'):sharing.autoUpdate?t('Perfil publicado · atualização automática ativada.','Profile published · automatic updates enabled.'):t('Perfil publicado · atualização manual.','Profile published · manual updates.');
    get('networkHide').hidden=!sharing.published;
  }
  const sharingUpdated=()=>renderSharing();section.addEventListener('profile-updated',sharingUpdated);stops.push(()=>section.removeEventListener('profile-updated',sharingUpdated));renderSharing();
  async function updateSharing(settings){
    const controls=[...root.querySelectorAll('.network-publish button,.network-publish input')];controls.forEach(control=>control.disabled=true);status.textContent=t('Salvando compartilhamento…','Saving sharing settings…');
    try{const profile=await saveProfileSharing(localUser,settings);if(!active())return;onProfileSaved(profile);renderSharing();status.textContent=settings.published?t('Perfil compartilhado salvo na nuvem.','Shared profile saved to the cloud.'):t('Perfil retirado da rede. Seu perfil privado e suas amizades foram mantidos.','Profile removed from the network. Your private profile and friendships were preserved.');}
    catch(error){fail(error);if(active())status.textContent+=t(' As opções não foram salvas. Clique novamente para tentar.',' Options were not saved. Click again to retry.');}
    finally{controls.forEach(control=>control.disabled=false);}
  }
  root.querySelector('.network-publish').addEventListener('change',()=>{get('networkSharingState').textContent=t('Opções alteradas. Clique em Publicar / salvar compartilhamento para aplicá-las.','Options changed. Click Publish / save sharing to apply them.');});
  get('networkPublish').onclick=()=>updateSharing({published:true,autoUpdate:get('networkAutoUpdate').checked,visible:[...root.querySelectorAll('[data-share-field]:checked')].map(input=>input.dataset.shareField)});
  get('networkHide').onclick=()=>updateSharing({...normalizeSharing(getProfile().sharing),published:false});
  get('networkSearchForm').onsubmit=async event=>{event.preventDefault();const term=normalized(get('networkSearch').value);if(term.length<2)return;const button=event.currentTarget.querySelector('button');button.disabled=true;status.textContent=t('Buscando…','Searching…');try{const snapshot=await getDocs(query(collection(db,'network_profiles'),orderBy('nameSearch'),startAt(term),endAt(term+'\uf8ff'),limit(20)));if(!active())return;results=snapshot.docs.map(d=>d.data()).filter(p=>p.uid!==uid);get('networkResults').innerHTML=results.map(card).join('');status.textContent=results.length?`${results.length} ${t('perfil(is) encontrado(s).','profile(s) found.')}`:t('Nenhum perfil publicado encontrado.','No published profiles found.');}catch(error){fail(error);}finally{button.disabled=false;}};
  async function openProfile(other,opener){
    if(opener)viewOpener=opener;dialog.dataset.academicTheme='ocean';
    const version=++viewGeneration;
    viewContent.innerHTML=`<h2 id="friendProfileTitle">${t('Perfil do colega','Colleague profile')}</h2><p role="status">${t('Carregando perfil…','Loading profile…')}</p>`;
    if(!dialog.open)dialog.showModal();
    const current=()=>active()&&dialog.open&&version===viewGeneration;
    try{
      const snapshot=await getDoc(doc(db,'network_profiles',other));if(!current())return;
      if(!snapshot.exists()){viewContent.innerHTML=`<h2 id="friendProfileTitle">${t('Perfil indisponível','Unavailable profile')}</h2><p role="status">${t('Este colega ainda não publicou seu perfil ou retirou-o da rede.','This colleague has not published a profile or removed it from the network.')}</p>`;return;}
      const p=snapshot.data(),a=normalizeAcademic(p);dialog.dataset.academicTheme=a.theme;
      const publications=[...a.articles].sort((left,right)=>Number(right.featured)-Number(left.featured));
      viewContent.innerHTML=`<header class="profile-summary academic-cover"><span class="profile-monogram" aria-hidden="true">${esc(p.name?.slice(0,1)||'?')}</span><div><h2 id="friendProfileTitle">${esc(p.name||t('Perfil do colega','Colleague profile'))}</h2><p>${t('Perfil compartilhado na rede acadêmica','Profile shared in the academic network')}</p></div></header><p class="academic-identity">${esc([p.role,p.specialty,p.institution,p.city].filter(Boolean).join(' · '))}</p><p class="academic-bio">${esc(p.bio||t('Nenhuma bio publicada.','No biography published.'))}</p><div class="academic-links">${a.orcid?`<a href="https://orcid.org/${a.orcid}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>`:''}${a.lattes?`<a href="https://lattes.cnpq.br/${a.lattes}" target="_blank" rel="noopener noreferrer">Lattes ↗</a>`:''}</div><h3>${t('Publicações vinculadas · autoria autodeclarada','Linked publications · self-declared authorship')}</h3><div class="academic-articles">${publications.map(article=>`<article class="academic-paper${article.featured?' is-featured':''}">${article.featured?`<span class="academic-paper-tag">${t('Em destaque','Featured')}</span>`:''}<h4><a href="https://doi.org/${article.doi.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener noreferrer">${esc(article.title)}</a></h4><p>${esc(article.authors)}</p><p>${esc([article.journal,article.year].filter(Boolean).join(' · '))}</p></article>`).join('')||`<p>${t('Nenhum artigo vinculado.','No linked articles.')}</p>`}</div>`;
    }catch(error){if(!current())return;viewContent.innerHTML=`<h2 id="friendProfileTitle">${t('Perfil do colega','Colleague profile')}</h2><p role="status">${error.code==='permission-denied'?t('Não foi possível acessar este perfil. A rede precisa das regras de acesso do Firebase.','Cannot access this profile. The network requires Firebase access rules.'):t('Não foi possível carregar o perfil. Verifique a conexão e tente novamente.','Could not load the profile. Check your connection and retry.')}</p><button class="btn" type="button" data-retry-profile>${t('Tentar novamente','Try again')}</button>`;viewContent.querySelector('[data-retry-profile]').onclick=()=>openProfile(other);}
  }
  const findContact=event=>{
    if(!active())return;get('networkSearch').value=String(event.detail?.name||'').slice(0,80);get('networkSearch').focus();get('networkSearchForm').scrollIntoView({behavior:'smooth',block:'center'});get('networkSearchForm').requestSubmit();
  };
  section.addEventListener('find-contact-profile',findContact);
  stops.push(()=>section.removeEventListener('find-contact-profile',findContact));
  root.addEventListener('click',async event=>{
    const action=event.target.closest('[data-network-action]'),view=event.target.closest('[data-view-user]');if(!action&&!view)return;const button=action||view;button.disabled=true;
    try{
      const other=action?.dataset.user||view.dataset.viewUser;
      if(view){await openProfile(other,view);return;}
      const ref=doc(db,'network_connections',pair(uid,other));
      await runTransaction(db,async transaction=>{
        const existing=await transaction.get(ref);
        if(action.dataset.networkAction==='send'){
          if(existing.exists())return;
          const target=await transaction.get(doc(db,'network_profiles',other));if(!target.exists())throw new Error('unavailable');
          transaction.set(ref,{members:[uid,other].sort(),sender:uid,recipient:other,status:'pending'});
        }else if(action.dataset.networkAction==='accept'){
          const connection=existing.data();if(connection?.recipient!==uid||connection.status!=='pending')return;transaction.update(ref,{status:'accepted'});
        }else if(existing.exists()){transaction.delete(ref);}
      });if(active())status.textContent=t('Rede atualizada.','Network updated.');
    }catch(error){fail(error);}finally{button.disabled=false;}
  });
}
