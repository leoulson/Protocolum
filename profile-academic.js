// Canonical identifiers prevent user-provided URLs from becoming unsafe links.
export function normalizeDOI(value) {
  let doi=String(value||'').trim().replace(/^doi:\s*/i,'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
  try{doi=decodeURIComponent(doi);}catch{return '';}
  return /^10\.\d{4,9}\/[^\s<>"?#]+$/i.test(doi) && doi.length<=300 ? doi.toLowerCase() : '';
}
export function normalizeORCID(value) {
  const id=String(value||'').trim().replace(/^https?:\/\/orcid\.org\//i,'').toUpperCase();
  if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(id))return '';
  const digits=id.replaceAll('-','');let total=0;
  for(const d of digits.slice(0,15))total=(total+Number(d))*2;
  const check=(12-total%11)%11;
  return digits[15]===(check===10?'X':String(check))?id:'';
}
export function normalizeLattes(value) {
  const id=String(value||'').trim().replace(/^https?:\/\/lattes\.cnpq\.br\//i,'').replace(/\/$/,'');
  return /^\d{16}$/.test(id)?id:'';
}
export function normalizeAcademic(value={}) {
  const p=value&&typeof value==='object'?value:{};
  const articles=(Array.isArray(p.articles)?p.articles:[]).filter(a=>a&&normalizeDOI(a.doi)).map(a=>({doi:normalizeDOI(a.doi),title:String(a.title||a.doi).slice(0,600),authors:String(a.authors||'').slice(0,1000),journal:String(a.journal||'').slice(0,200),year:String(a.year||'').slice(0,4),relationship:['author','coauthor','reading'].includes(a.relationship)?a.relationship:'reading',featured:a.featured===true,metadataSource:a.metadataSource==='Crossref'?'Crossref':'manual'}));
  return {orcid:normalizeORCID(p.orcid),lattes:normalizeLattes(p.lattes),theme:['ocean','violet','emerald'].includes(p.theme)?p.theme:'ocean',articles:articles.filter((a,i,all)=>all.findIndex(x=>x.doi===a.doi)===i).slice(0,100)};
}
const t=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const doiURL=doi=>'https://doi.org/'+doi.split('/').map(encodeURIComponent).join('/');
// One explicit lookup per click, bounded in time; no author identity is inferred.
async function lookup(doi){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const response=await fetch('https://api.crossref.org/works/'+encodeURIComponent(doi),{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(response.status===404?'not-found':'network');
    const {message:m}=await response.json();
    if(!m || normalizeDOI(m.DOI)!==doi)throw new Error('not-found');
    return {doi,title:m.title?.[0]||doi,authors:(m.author||[]).slice(0,15).map(a=>[a.given,a.family].filter(Boolean).join(' ')).join(', '),journal:m['container-title']?.[0]||'',year:String((m.published?.['date-parts']||m.issued?.['date-parts'])?.[0]?.[0]||''),metadataSource:'Crossref'};
  }finally{clearTimeout(timer);}
}
export function mountAcademic(section,user,getProfile,commit){
  let academic=normalizeAcademic(getProfile());
  const header=section.querySelector('.profile-summary');header.classList.add('academic-cover');
  const top=document.createElement('div');top.className='academic-showcase';
  top.innerHTML=`<div id="academicIdentity" class="academic-identity"></div><div id="academicStats" class="academic-stats"></div><section aria-labelledby="publicationTitle"><div class="academic-section-heading"><h3 id="publicationTitle">${t('Vitrine de publicações','Publication showcase')}</h3><span>DOI</span></div><p class="profile-hint">${t('Artigos vinculados por você. A autoria declarada não é verificada pela plataforma.','Articles linked by you. Declared authorship is not verified by the platform.')}</p><div id="academicArticles" class="academic-articles"></div></section>`;
  header.after(top);
  const editor=document.createElement('details');editor.className='academic-editor';
  editor.innerHTML=`<summary>${t('Personalizar perfil e conexões acadêmicas','Customize profile and academic links')}</summary><form id="academicLinks"><label for="academicTheme">${t('Tema da capa','Cover theme')}<select id="academicTheme"><option value="ocean">${t('Oceano','Ocean')}</option><option value="violet">${t('Violeta','Violet')}</option><option value="emerald">${t('Esmeralda','Emerald')}</option></select></label><label for="academicORCID">ORCID<input id="academicORCID" maxlength="80" placeholder="0000-0002-1825-0097" value="${esc(academic.orcid)}"></label><label for="academicLattes">Lattes<input id="academicLattes" maxlength="100" placeholder="https://lattes.cnpq.br/ + ID" value="${esc(academic.lattes)}"></label><small>${t('Conexões por link, sem autenticação ou importação do currículo.','Links only, without authentication or CV import.')}</small><button class="btn primary">${t('Salvar conexões','Save links')}</button><p id="academicLinkStatus" role="status" aria-live="polite"></p></form></details>`;
  top.after(editor);
  const add=document.createElement('details');add.className='academic-editor';
  add.innerHTML=`<summary>${t('Adicionar artigo por DOI','Add article by DOI')}</summary><form id="academicArticleForm"><label for="academicDOI">DOI<input id="academicDOI" maxlength="320" required placeholder="10.1056/NEJMoa1911303"></label><button class="btn" id="academicLookup" type="button">${t('Buscar dados do artigo','Look up article details')}</button><label for="academicArticleTitle">${t('Título','Title')}<input id="academicArticleTitle" maxlength="600" required></label><label for="academicAuthors">${t('Autores','Authors')}<input id="academicAuthors" maxlength="1000"></label><div class="profile-fields"><label for="academicJournal">${t('Revista','Journal')}<input id="academicJournal" maxlength="200"></label><label for="academicYear">${t('Ano','Year')}<input id="academicYear" maxlength="4" inputmode="numeric" pattern="[0-9]{4}"></label></div><label for="academicRelationship">${t('Vínculo com o artigo','Relationship to this article')}<select id="academicRelationship"><option value="reading">${t('Leitura / referência','Reading / reference')}</option><option value="author">${t('Autor (autodeclarado)','Author (self-declared)')}</option><option value="coauthor">${t('Coautor (autodeclarado)','Coauthor (self-declared)')}</option></select></label><small>${t('Se a consulta não retornar dados, preencha os campos manualmente.','If the lookup returns no data, fill in the fields manually.')}</small><button class="btn primary">${t('Adicionar à vitrine','Add to showcase')}</button><p id="academicArticleStatus" role="status" aria-live="polite"></p></form></details>`;
  editor.after(add);
  const get=id=>section.querySelector('#'+id);let importedDOI='',busy=false,revision=0;
  get('academicTheme').value=academic.theme;
  const persist=async(next,status)=>{if(await commit(next,status)){academic=normalizeAcademic(next);render();return true;}return false;};
  function render(){
    section.dataset.academicTheme=academic.theme;
    const p=getProfile();
    get('academicIdentity').innerHTML=`<p class="academic-bio">${esc(p.bio||t('Seu espaço acadêmico no Protocolum.','Your academic space on Protocolum.'))}</p><p>${esc([p.role,p.specialty,p.institution,p.city].filter(Boolean).join(' · '))}</p><div class="academic-links">${academic.orcid?`<a href="https://orcid.org/${academic.orcid}" target="_blank" rel="noopener noreferrer">ORCID ↗</a>`:''}${academic.lattes?`<a href="https://lattes.cnpq.br/${academic.lattes}" target="_blank" rel="noopener noreferrer">Lattes ↗</a>`:''}</div>`;
    get('academicStats').innerHTML=[ [academic.articles.length,t('Artigos','Articles')],[p.friends?.length||0,t('Amigos na lista','Friends in your list')],[academic.articles.filter(a=>a.featured).length,t('Destaques','Featured')] ].map(([n,label])=>`<div><strong>${n}</strong><span>${label}</span></div>`).join('');
    const sorted=[...academic.articles].sort((a,b)=>Number(b.featured)-Number(a.featured));
    get('academicArticles').innerHTML=sorted.length?sorted.map(a=>`<article class="academic-paper${a.featured?' is-featured':''}"><span class="academic-paper-tag">${a.featured?'★ ':''}${esc(a.relationship==='author'?t('Autor · autodeclarado','Author · self-declared'):a.relationship==='coauthor'?t('Coautor · autodeclarado','Coauthor · self-declared'):t('Leitura / referência','Reading / reference'))}</span><h4><a href="${esc(doiURL(a.doi))}" target="_blank" rel="noopener noreferrer">${esc(a.title)}</a></h4><p>${esc(a.authors)}</p><small>${esc([a.journal,a.year].filter(Boolean).join(' · '))}</small><a class="academic-doi" href="${esc(doiURL(a.doi))}" target="_blank" rel="noopener noreferrer">DOI: ${esc(a.doi)} ↗</a><div class="profile-friend-actions"><button type="button" class="btn" data-feature-doi="${esc(a.doi)}" aria-pressed="${a.featured}">${a.featured?t('Retirar destaque','Unfeature'):t('Destacar','Feature')}</button><button type="button" class="btn" data-remove-doi="${esc(a.doi)}">${t('Remover','Remove')}</button></div></article>`).join(''):`<p class="academic-empty">${t('Sua vitrine está vazia. Adicione um DOI para apresentar artigos aqui.','Your showcase is empty. Add a DOI to display articles here.')}</p>`;
  }
  get('academicLinks').onsubmit=async e=>{e.preventDefault();const status=get('academicLinkStatus'),orcid=normalizeORCID(get('academicORCID').value),lattes=normalizeLattes(get('academicLattes').value);if(get('academicORCID').value.trim()&&!orcid){status.textContent=t('ORCID inválido. Confira o identificador e seu dígito verificador.','Invalid ORCID. Check the identifier and checksum.');return;}if(get('academicLattes').value.trim()&&!lattes){status.textContent=t('Informe o ID Lattes de 16 dígitos ou o link lattes.cnpq.br correspondente.','Enter the 16-digit Lattes ID or its lattes.cnpq.br link.');return;}await persist({...getProfile(),orcid,lattes,theme:get('academicTheme').value},status);};
  get('academicDOI').oninput=()=>{revision++;importedDOI='';};
  get('academicLookup').onclick=async()=>{
    if(busy)return;const status=get('academicArticleStatus'),doi=normalizeDOI(get('academicDOI').value);
    if(!doi){status.textContent=t('Informe um DOI válido.','Enter a valid DOI.');return;}
    const requestRevision=revision;busy=true;get('academicLookup').disabled=true;status.textContent=t('Buscando na Crossref…','Searching Crossref…');
    try{const article=await lookup(doi);if(!section.isConnected||requestRevision!==revision||accountEmail()!==user.email)return;for(const [id,value]of [['academicArticleTitle',article.title],['academicAuthors',article.authors],['academicJournal',article.journal],['academicYear',article.year]])get(id).value=value;importedDOI=doi;status.textContent=t('Dados encontrados. Revise e adicione à vitrine.','Details found. Review and add to your showcase.');}
    catch{if(section.isConnected&&requestRevision===revision)status.textContent=t('Consulta indisponível ou DOI não encontrado na Crossref. Você pode preencher os dados manualmente.','Lookup unavailable or DOI not found in Crossref. You can fill in details manually.');}
    finally{busy=false;get('academicLookup').disabled=false;}
  };
  function accountEmail(){return window.clinicalMindCurrentUser?.()?.email;}
  get('academicArticleForm').onsubmit=async e=>{e.preventDefault();const status=get('academicArticleStatus'),doi=normalizeDOI(get('academicDOI').value);if(!doi){status.textContent=t('Informe um DOI válido.','Enter a valid DOI.');return;}if(academic.articles.some(a=>a.doi===doi)){status.textContent=t('Esse DOI já está na vitrine.','This DOI is already in your showcase.');return;}if(academic.articles.length>=100){status.textContent=t('Limite de 100 artigos atingido.','100 article limit reached.');return;}const title=get('academicArticleTitle').value.trim();if(!title){status.textContent=t('Informe o título.','Enter a title.');return;}const article={doi,title,authors:get('academicAuthors').value.trim(),journal:get('academicJournal').value.trim(),year:get('academicYear').value,relationship:get('academicRelationship').value,featured:false,metadataSource:importedDOI===doi?'Crossref':'manual'};if(await persist({...getProfile(),articles:[...academic.articles,article]},status)){get('academicArticleForm').reset();revision++;importedDOI='';}};
  get('academicArticles').onclick=async e=>{const feature=e.target.closest('[data-feature-doi]'),remove=e.target.closest('[data-remove-doi]');if(!feature&&!remove)return;const articles=remove?academic.articles.filter(a=>a.doi!==remove.dataset.removeDoi):academic.articles.map(a=>a.doi===feature.dataset.featureDoi?{...a,featured:!a.featured}:a);await persist({...getProfile(),articles},get('academicArticleStatus'));};
  section.addEventListener('profile-updated',()=>{academic=normalizeAcademic(getProfile());render();});
  render();
}
