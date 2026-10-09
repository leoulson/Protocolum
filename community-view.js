import { subscribeCommunity, startCommunity, loadMoreCommunity } from './community-cloud.js';
let stop;
export const user=()=>window.clinicalMindCurrentUser?.();
export const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const text=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
export function stopCommunityView(){stop?.();stop=undefined;}
window.protocolumStopCommunityView=stopCommunityView;
export function watchCommunity(listener){stopCommunityView();stop=subscribeCommunity(listener);startCommunity(user());}
export function connectionMessage(state){return state.status==='ready'?text('Comunidade compartilhada · atualizações em tempo real.','Shared community · live updates.'):state.status==='signed-out'?text('Entre com Google para ler e publicar na comunidade compartilhada.','Sign in with Google to read and publish in the shared community.'):state.status==='error'?text('Não foi possível atualizar a comunidade. Verifique a conexão e tente novamente.','Could not update the community. Check your connection and try again.'):text('Carregando a comunidade…','Loading community…');}
export function renderFeed(container,html){
  const drafts=[...container.querySelectorAll('input,textarea')].map(input=>({post:input.closest('[data-reply]')?.dataset.reply,name:input.name,value:input.value,focused:input===document.activeElement,start:input.selectionStart,end:input.selectionEnd}));
  const disabled=[...container.querySelectorAll('button:disabled')].map(button=>({reply:button.closest('[data-reply]')?.dataset.reply,id:button.dataset.id,vote:button.dataset.vote,like:button.dataset.like}));
  container.innerHTML=html;
  for(const entry of disabled){for(const button of container.querySelectorAll('button'))if((entry.reply&&button.closest('[data-reply]')?.dataset.reply===entry.reply)||(entry.id&&button.dataset.id===entry.id&&button.dataset.vote===entry.vote)||(entry.like&&button.dataset.like===entry.like))button.disabled=true;}
  for(const draft of drafts){const input=[...container.querySelectorAll('input,textarea')].find(input=>input.closest('[data-reply]')?.dataset.reply===draft.post&&input.name===draft.name);if(input){input.value=draft.value;if(draft.focused){input.focus();input.setSelectionRange(draft.start,draft.end);}}}
}
export function localDrafts(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.slice(0,100):[];}catch{return [];}}

export function releaseBusy(button,container){
  button.disabled=false;
  const reply=button.closest('[data-reply]')?.dataset.reply;
  for(const replacement of container.querySelectorAll('button'))if((reply&&replacement.closest('[data-reply]')?.dataset.reply===reply)||(button.dataset.id&&replacement.dataset.id===button.dataset.id&&replacement.dataset.vote===button.dataset.vote)||(button.dataset.like&&replacement.dataset.like===button.dataset.like))replacement.disabled=false;
}

export function mountCommunityPagination(container){
 const footer=document.createElement('div');footer.className='community-pagination';footer.innerHTML=`<button class="btn" type="button" data-community-more hidden>${text('Carregar mais posts','Load more posts')}</button><p data-community-page-status role="status" aria-live="polite"></p>`;container.append(footer);
 footer.querySelector('button').onclick=()=>loadMoreCommunity(user()).catch(()=>{footer.querySelector('p').textContent=text('Entre com Google para carregar os posts.','Sign in with Google to load posts.');});
}
export function renderCommunityPagination(container,state){
 const button=container.querySelector('[data-community-more]'),status=container.querySelector('[data-community-page-status]');if(!button)return;
 button.hidden=!state.hasMore;button.disabled=state.loadingMore||state.status==='loading';button.textContent=state.loadingMore?text('Carregando posts…','Loading posts…'):state.pageError?text('Tentar carregar mais novamente','Retry loading more'):text('Carregar mais posts','Load more posts');
 status.textContent=state.pageError?text('Não foi possível carregar mais posts. Os posts já carregados foram mantidos.','Could not load more posts. Previously loaded posts were kept.'):state.loadingMore?text('Buscando posts mais antigos…','Fetching older posts…'):!state.hasMore&&state.status==='ready'?text('Todos os posts disponíveis foram carregados.','All available posts have been loaded.'):'';
}
