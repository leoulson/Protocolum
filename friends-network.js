import { normalizeAcademic } from './profile-academic.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
const normalized=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const pair=(a,b)=>[a,b].sort().join('~');
let stops=[];
export function stopNetwork(){stops.forEach(stop=>stop());stops=[];}
window.protocolumStopNetwork=stopNetwork;
export async function mountNetwork(section,localUser,getProfile){
  stopNetwork();
  const root=document.createElement('section');root.className='network-panel';root.setAttribute('aria-labelledby','networkTitle');
  root.innerHTML=`<header><h2 id="networkTitle">${t('Rede acadêmica','Academic network')}</h2><p>${t('Encontre colegas e construa conexões com aceite mútuo.','Find colleagues and build mutually accepted connections.')}</p></header><p id="networkStatus" role="status" aria-live="polite"></p><div id="networkContent"></div>`;
  section.querySelector('.profile-friends').before(root);
  section.querySelector('.profile-friends h3').firstChild.textContent=t('Contatos pessoais ','Personal contacts ');
  const status=root.querySelector('#networkStatus'),content=root.querySelector('#networkContent');
  status.textContent=t('Carregando a rede acadêmica…','Loading academic network…');
  let db,auth,collection,doc,getDoc,getDocs,setDoc,deleteDoc,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction;
  try {
    const [firebase,store]=await Promise.all([import('./auth-google.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
    ({db,auth}=firebase);
    ({collection,doc,getDoc,getDocs,setDoc,deleteDoc,query,where,orderBy,startAt,endAt,limit,onSnapshot,runTransaction}=store);
  } catch {
    if(root.isConnected)status.textContent=t('A rede está indisponível. Seu perfil, Lattes, ORCID e vitrine DOI continuam disponíveis abaixo e acima.','The network is unavailable. Your profile, Lattes, ORCID and DOI showcase remain available.');
    return;
  }
  if(!root.isConnected)return;
  status.textContent='';
  const user=auth?.currentUser;
  if(!user || localUser.firebaseUid!==user.uid){status.textContent=t('Entre com Google para acessar a rede entre usuários. Seus contatos pessoais continuam abaixo.','Sign in with Google to access the user network. Your personal contacts remain below.');return;}
  const uid=user.uid;let links=[],results=[],generation=0;
  const active=()=>root.isConnected&&auth?.currentUser?.uid===uid;
  const fail=error=>{if(active())status.textContent=error.code==='permission-denied'?t('A rede aguarda ativação das regras de acesso do Firebase. Seus dados locais foram preservados.','The network requires Firebase access rules activation. Your local data was preserved.'):t('Não foi possível acessar a rede. Verifique a conexão e tente novamente.','Could not access the network. Check your connection and retry.');};
  content.innerHTML=`<div class="network-publish"><p>${t('Publique seu perfil para aparecer no buscador. Serão compartilhados nome, bio, formação, instituição, cidade, Lattes, ORCID e artigos. E-mail e contatos pessoais ficam privados.','Publish your profile to appear in search. Name, bio, training, institution, city, Lattes, ORCID and articles are shared. Email and personal contacts remain private.')}</p><button class="btn primary" id="networkPublish">${t('Publicar / atualizar perfil','Publish / update profile')}</button><button class="btn" id="networkHide">${t('Retirar perfil da busca','Remove profile from search')}</button></div><form id="networkSearchForm"><label for="networkSearch">${t('Buscar colegas pelo início do nome','Search colleagues by the start of their name')}<input id="networkSearch" type="search" minlength="2" maxlength="80" required placeholder="${t('Ex.: Leonardo','E.g. Leonardo')}"></label><button class="btn" type="submit">${t('Buscar','Search')}</button></form><div id="networkResults" class="network-cards"></div><div id="networkPublicView"></div><h3>${t('Pedidos de amizade','Friend requests')}</h3><div id="networkRequests" class="network-cards"></div><h3>${t('Amigos','Friends')}</h3><div id="networkFriends" class="network-cards"></div>`;
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
  get('networkPublish').onclick=async event=>{
    event.target.disabled=true;
    try{const p=getProfile(),academic=normalizeAcademic(p),name=window.clinicalMindCurrentUser?.()?.name||user.displayName||'Protocolum';
      await setDoc(doc(db,'network_profiles',uid),{uid,name:name.slice(0,80),nameSearch:normalized(name).slice(0,80),role:p.role,specialty:p.specialty,institution:p.institution,city:p.city,bio:p.bio,orcid:academic.orcid,lattes:academic.lattes,articles:academic.articles,theme:academic.theme});
      if(active())status.textContent=t('Perfil publicado. Atualize novamente após editar seus dados locais.','Profile published. Update it again after editing your local details.');
    }catch(error){fail(error);}finally{event.target.disabled=false;}
  };
  get('networkHide').onclick=async event=>{event.target.disabled=true;try{await deleteDoc(doc(db,'network_profiles',uid));if(active())status.textContent=t('Perfil retirado da busca. Suas amizades e seu perfil local foram mantidos.','Profile removed from search. Friendships and your local profile are preserved.');}catch(error){fail(error);}finally{event.target.disabled=false;}};
  get('networkSearchForm').onsubmit=async event=>{event.preventDefault();const term=normalized(get('networkSearch').value);if(term.length<2)return;const button=event.currentTarget.querySelector('button');button.disabled=true;status.textContent=t('Buscando…','Searching…');try{const snapshot=await getDocs(query(collection(db,'network_profiles'),orderBy('nameSearch'),startAt(term),endAt(term+'\uf8ff'),limit(20)));if(!active())return;results=snapshot.docs.map(d=>d.data()).filter(p=>p.uid!==uid);get('networkResults').innerHTML=results.map(card).join('');status.textContent=results.length?`${results.length} ${t('perfil(is) encontrado(s).','profile(s) found.')}`:t('Nenhum perfil publicado encontrado.','No published profiles found.');}catch(error){fail(error);}finally{button.disabled=false;}};
  root.addEventListener('click',async event=>{
    const action=event.target.closest('[data-network-action]'),view=event.target.closest('[data-view-user]');if(!action&&!view)return;const button=action||view;button.disabled=true;
    try{
      const other=action?.dataset.user||view.dataset.viewUser;
      if(view){const snapshot=await getDoc(doc(db,'network_profiles',other));if(!active())return;if(!snapshot.exists()){status.textContent=t('Este perfil não está publicado.','This profile is not published.');return;}const p=snapshot.data(),a=normalizeAcademic(p);get('networkPublicView').innerHTML=`<section class="network-public-view"><button type="button" class="btn" id="networkCloseView">${t('Fechar perfil','Close profile')}</button><h3>${esc(p.name)}</h3><p>${esc([p.role,p.specialty,p.institution,p.city].filter(Boolean).join(' · '))}</p><p>${esc(p.bio)}</p>${a.orcid?`<a href="https://orcid.org/${a.orcid}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>`:''} ${a.lattes?`<a href="https://lattes.cnpq.br/${a.lattes}" target="_blank" rel="noopener noreferrer">Lattes ↗</a>`:''}<h4>${t('Publicações vinculadas · autoria autodeclarada','Linked publications · self-declared authorship')}</h4>${a.articles.map(article=>`<p><a href="https://doi.org/${article.doi.split('/').map(encodeURIComponent).join('/')}" target="_blank" rel="noopener noreferrer">${esc(article.title)}</a><br><small>${esc(article.journal)} ${esc(article.year)}</small></p>`).join('')||t('Nenhum artigo vinculado.','No linked articles.')}</section>`;get('networkCloseView').onclick=()=>get('networkPublicView').replaceChildren();get('networkPublicView').scrollIntoView({behavior:'smooth',block:'start'});return;}
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
