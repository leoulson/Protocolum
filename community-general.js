import { communityState, publishCommunityPost, replyToCommunityPost, toggleCommunityVote, startCommunity } from './community-cloud.js';
import { user, escape as esc, text as t, watchCommunity, connectionMessage, renderFeed, localDrafts, releaseBusy } from './community-view.js';
export function renderGeneralCommunity(){
 const root=document.getElementById('recommendations');if(!root)return;
 root.classList.remove('list');root.classList.add('community');
 root.innerHTML=`<section class="shared-general-community"><button type="button" class="btn legacy-community-back" id="generalBack">${t('← Voltar à sessão clínica','← Back to clinical session')}</button><div class="community-note">${t('Posts, respostas e apoios são compartilhados com usuários autenticados. Não publique dados identificáveis de pacientes.','Posts, replies and support are shared with signed-in users. Do not post identifiable patient information.')}</div><p id="communityConnection" role="status" aria-live="polite"></p><button id="retryCommunity" class="btn" type="button" hidden>${t('Tentar novamente','Try again')}</button><form class="community-form" id="postForm"><input name="title" maxlength="90" required placeholder="${t('Título da discussão','Discussion title')}"><select name="topic"><option>Cardiologia</option><option>Endocrinologia</option><option>Nefrologia</option><option>Medicina baseada em evidências</option><option>Outro tema</option></select><textarea name="body" maxlength="1200" required placeholder="${t('Compartilhe uma discussão acadêmica (até 1.200 caracteres)','Share an academic discussion (up to 1,200 characters)')}"></textarea><button class="btn primary">${t('Publicar discussão','Publish discussion')}</button><p id="generalPostStatus" role="status" aria-live="polite"></p></form><div id="communityPosts"></div></section>`;
 const form=root.querySelector('#postForm'),status=root.querySelector('#generalPostStatus');
 root.querySelector('#generalBack').onclick=()=>window.renderEvidenceCommunity?.();
 root.querySelector('#retryCommunity').onclick=()=>startCommunity(user(),{force:true});
 const drafts=localDrafts('clinicalmind.community.v1').filter(post=>typeof post.title==='string'&&typeof post.body==='string');
 if(drafts.length){const select=document.createElement('select');select.setAttribute('aria-label',t('Recuperar post local para compartilhar','Recover a local post to share'));select.innerHTML=`<option value="">${t('Recuperar post antigo deste navegador…','Recover an old browser post…')}</option>`+drafts.map((post,i)=>`<option value="${i}">${esc(post.title)}</option>`).join('');form.prepend(select);select.onchange=()=>{const post=drafts[select.value];if(post){form.elements.title.value=post.title;form.elements.body.value=post.body;form.elements.topic.value=[...form.elements.topic.options].some(option=>option.value===post.topic)?post.topic:'Outro tema';status.textContent=t('Revise e publique para compartilhar com os outros usuários.','Review and publish to share with other users.');}};}
 form.onsubmit=async event=>{
  event.preventDefault();const author=user(),button=form.querySelector('button');button.disabled=true;status.textContent=t('Publicando…','Publishing…');
  try{const values=Object.fromEntries(new FormData(form));await publishCommunityPost(author,{...values,kind:'general'});form.reset();status.textContent=t('Discussão publicada na comunidade.','Discussion published to the community.');}
  catch{status.textContent=t('Não foi possível publicar. Entre com Google e verifique a conexão; seu texto foi mantido.','Could not publish. Sign in with Google and check your connection; your text was kept.');}
  finally{releaseBusy(button,root);}
 };
 const feed=root.querySelector('#communityPosts');
 feed.onclick=async event=>{const button=event.target.closest('[data-like]');if(!button)return;button.disabled=true;try{await toggleCommunityVote(user(),button.dataset.like,'like');}catch{status.textContent=t('Não foi possível salvar o apoio. Entre com Google e tente novamente.','Could not save support. Sign in with Google and try again.');}finally{releaseBusy(button,root);}};
 feed.onsubmit=async event=>{
  const form=event.target.closest('[data-reply]');if(!form)return;event.preventDefault();const input=form.elements.reply,body=input.value,button=form.querySelector('button');button.disabled=true;
  try{await replyToCommunityPost(user(),form.dataset.reply,body);const replacement=[...feed.querySelectorAll('[data-reply]')].find(node=>node.dataset.reply===form.dataset.reply);if(replacement?.elements.reply.value===body)replacement.reset();status.textContent=t('Resposta publicada.','Reply published.');}
  catch{status.textContent=t('Não foi possível publicar a resposta. Seu texto foi mantido.','Could not publish the reply. Your text was kept.');}
  finally{releaseBusy(button,root);}
 };
 watchCommunity(state=>{
  if(!root.querySelector('.shared-general-community'))return;
  root.querySelector('#communityConnection').textContent=connectionMessage(state);root.querySelector('#retryCommunity').hidden=state.status!=='error';
  const posts=state.posts.filter(post=>post.kind==='general');
  document.getElementById('resultCount').textContent=t(`${posts.length} discussões · compartilhadas`,`${posts.length} shared discussions`);
  renderFeed(feed,posts.length?posts.map(post=>{
   const replies=state.replies[post.id]||[],votes=state.votes[post.id]||[];
   return `<article class="community-card" data-post-id="${esc(post.id)}"><h3>${esc(post.title)}</h3><div class="meta">${esc(post.topic)} · ${esc(post.author)} · ${esc(new Date(post.createdAt).toLocaleString())}</div><div class="postbody">${esc(post.body)}</div><div class="community-actions"><button type="button" data-like="${esc(post.id)}" aria-pressed="${votes.some(v=>v.id===user()?.firebaseUid&&v.like)}">♡ ${votes.filter(v=>v.like).length} ${t('apoio','support')}</button><span>${replies.length} ${t('respostas','replies')}</span></div>${replies.map(reply=>`<div class="reply">${esc(reply.body)}<small>${esc(reply.author)} · ${esc(new Date(reply.createdAt).toLocaleString())}</small></div>`).join('')}<form class="reply-form" data-reply="${esc(post.id)}"><input name="reply" maxlength="500" required placeholder="${t('Escreva uma resposta','Write a reply')}"><button class="btn" type="submit">${t('Responder','Reply')}</button></form></article>`;
  }).join(''):`<div class="empty">${t('Ainda não há discussões compartilhadas.','No shared discussions yet.')}</div>`);
 });
}
window.renderSharedGeneralCommunity=renderGeneralCommunity;
