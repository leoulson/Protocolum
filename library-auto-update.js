const API='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const TOPICS='(heart failure[Title/Abstract] OR cardiovascular[Title/Abstract] OR kidney[Title/Abstract] OR diabetes[Title/Abstract] OR stroke[Title/Abstract] OR asthma[Title/Abstract] OR COPD[Title/Abstract] OR hypertension[Title/Abstract])';
const byId=id=>document.getElementById(id);
const english=()=>document.documentElement.lang.startsWith('en');
const text=(pt,en)=>english()?en:pt;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,lastChecked=0,lastQuery='',lastRequest=0,favoritesPending=false;
const favoriteLookups=new Set();
let lastFilters={yearFrom:'',yearTo:'',studyType:'recent',fullText:'any'};
const STUDY_TYPES={guideline:'("Practice Guideline"[Publication Type] OR "Guideline"[Publication Type])',trial:'"Randomized Controlled Trial"[Publication Type]',systematic:'"Systematic Review"[Publication Type]',meta:'"Meta-Analysis"[Publication Type]',observational:'"Observational Study"[Publication Type]'};
const readFilters=()=>({yearFrom:byId('pubmedYearFrom')?.value||'',yearTo:byId('pubmedYearTo')?.value||'',studyType:byId('pubmedStudyType')?.value||'recent',fullText:byId('pubmedFullText')?.value||'any'});
const searchControls=()=>['refreshLibrary','searchOnlineLibrary','applyFilters','pubmedYearFrom','pubmedYearTo','pubmedStudyType','pubmedFullText'].map(byId).filter(Boolean);
function validateFilters(filters){for(const value of [filters.yearFrom,filters.yearTo])if(value&&(!/^\d{4}$/.test(value)||Number(value)<1500||Number(value)>3000))throw Error(text('Informe anos inteiros entre 1500 e 3000.','Enter whole years between 1500 and 3000.'));if(filters.yearFrom&&filters.yearTo&&Number(filters.yearFrom)>Number(filters.yearTo))throw Error(text('O ano inicial deve ser menor ou igual ao ano final.','The starting year must be no later than the ending year.'));}

export function parseArticles(xml,checkedAt=Date.now()) {
  const document=new DOMParser().parseFromString(xml,'application/xml');
  if(document.querySelector('parsererror')||document.querySelector('ERROR'))throw new Error('Invalid PubMed response');
  const content=(node,selector)=>node.querySelector(selector)?.textContent.trim().replace(/\s+/g,' ')||'';
  return [...document.querySelectorAll('PubmedArticle')].map(article=>{
    const citation=article.querySelector('MedlineCitation'),source=article.querySelector('Article');if(!citation||!source)return null;
    const pmid=content(citation,'PMID'),title=content(source,'ArticleTitle');if(!/^\d+$/.test(pmid)||!title)return null;
    const journal=content(source,'Journal Title')||'PubMed';
    const date=source.querySelector('JournalIssue PubDate');
    const rawYear=date?(content(date,'Year')||(content(date,'MedlineDate').match(/\d{4}/)||[])[0]||''):'';
    const year=/^\d{4}$/.test(rawYear)?rawYear:'';
    const authors=[...source.querySelectorAll('Author')].slice(0,6).map(author=>content(author,'CollectiveName')||[content(author,'LastName'),content(author,'Initials')].filter(Boolean).join(' ')).filter(Boolean);
    const types=[...source.querySelectorAll('PublicationType')].map(node=>node.textContent.trim());
    const guideline=types.some(type=>/guideline/i.test(type));
    const mesh=[...citation.querySelectorAll('MeshHeading DescriptorName')].map(node=>node.textContent.trim());
    const adults=mesh.some(term=>['Adult','Aged','Middle Aged','Young Adult','Aged, 80 and over'].includes(term)),children=mesh.some(term=>['Child','Infant','Adolescent','Child, Preschool','Infant, Newborn'].includes(term));
    const population=adults&&children?'População mista':adults?'Adultos':children?'Pediatria':'Consulte a fonte original';
    const abstract=[...source.querySelectorAll('Abstract AbstractText')].map(node=>(node.getAttribute('Label')?node.getAttribute('Label')+': ':'')+node.textContent.trim()).filter(Boolean).join('\n\n');
    return {id:'pubmed-'+pmid,pmid,title,society:journal,journal,authors,publicationTypes:types,sourceDate:year||'Data na fonte',cid:'—',scenario:'Não especificado',population,
      sections:guideline?['Diretrizes','Literatura','Referências','Alertas','Lacunas de Evidência']:['Literatura','Referências','Alertas','Lacunas de Evidência'],
      strength:'Registro bibliográfico · revisar',evidence:guideline?'Indexado como diretriz no PubMed':types.join(' · ')||'Registro bibliográfico',contentLabel:'Resumo do registro PubMed',
      abstract:abstract||text('Resumo não disponibilizado pelo PubMed. Consulte o registro original.','Abstract not provided by PubMed. Consult the original record.'),
      sourceTitle:(authors.length?authors.join(', ')+'. ':'')+journal+(year?'. '+year:'')+'. PMID: '+pmid,
      sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/'+pmid+'/',sourceRetrievedAt:checkedAt,
      evidenceGap:text('A indexação no PubMed não confirma a vigência ou a aplicabilidade da recomendação. Consulte o texto integral, métodos, população e fonte original.','PubMed indexing does not confirm that a recommendation is current or applicable. Consult the full text, methods, population and original source.')};
  }).filter(Boolean);
}
function status(message,state='ready'){const node=byId('libraryAutoStatus');if(node){node.textContent=message;node.dataset.state=state;}const badge=byId('onlineSourcesState');if(badge)badge.textContent=state==='loading'?text('Consultando…','Loading…'):state==='error'?text('Falha na consulta','Request failed'):text('PubMed online','PubMed online');refreshView();}
function filterOptions(id,values,label){const select=byId(id);if(!select)return;const chosen=select.value;const options=[...new Set(values.filter(Boolean))].sort();select.innerHTML=`<option value="">${esc(label)}</option>`+options.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');select.value=options.includes(chosen)?chosen:'';}
function renderSources(records){
  const sources=byId('onlineReferenceSources');const journals=new Map();for(const record of records)if(!journals.has(record.journal))journals.set(record.journal,record);
  if(sources)sources.innerHTML=journals.size?[...journals.values()].slice(0,10).map(record=>`<div class="source"><a href="${record.sourceUrl}" target="_blank" rel="noopener noreferrer">${esc(record.journal)}</a></div>`).join(''):`<small>${esc(text('As fontes aparecerão após uma consulta online.','Sources will appear after an online request.'))}</small>`;
  const side=byId('onlineLibraryHighlights');if(side)side.innerHTML=records.slice(0,3).map(record=>`<div class="alert"><a href="${record.sourceUrl}" target="_blank" rel="noopener noreferrer">${esc(record.title)}</a><small>${esc(record.journal)} · ${esc(record.sourceDate)}</small></div>`).join('');
  const hero=document.querySelector('.hero');if(hero){hero.hidden=!records.length;if(records.length){hero.querySelector('.tag').textContent=text('DIRETAMENTE DO PUBMED','DIRECTLY FROM PUBMED');hero.querySelector('h2').textContent=records[0].title;hero.querySelector('p').textContent=records[0].abstract.slice(0,320)+(records[0].abstract.length>320?'…':'');}}
  filterOptions('society',records.map(record=>record.society),text('Todas as revistas / fontes','All journals / sources'));
  filterOptions('population',records.map(record=>record.population),text('Todas as populações','All populations'));
}
function apply(records,query){const library=window.clinicalMindLibrary;if(!Array.isArray(library))throw new Error('Library unavailable');library.splice(0,library.length,...records);window.clinicalMindOnlineQuery=query;renderSources(records.filter(record=>!record.lookupOnly));window.clinicalMindUpdateLibraryReferences?.();refreshView();window.dispatchEvent(new CustomEvent('protocolum-library-updated'));}
function refreshView(){const section=document.querySelector('.nav-btn.active')?.dataset.section;if(['Início','Diretrizes','Literatura','Favoritos','Alertas','Referências','Histórico','Lacunas de Evidência'].includes(section))window.clinicalMindRenderList?.();}
async function fetchResponse(endpoint,parameters,format){
  // NCBI permits up to three requests per second without an API key.
  const delay=Math.max(0,400-(Date.now()-lastRequest));if(delay)await new Promise(resolve=>setTimeout(resolve,delay));lastRequest=Date.now();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{const response=await fetch(API+endpoint+'?'+new URLSearchParams(parameters),{signal:controller.signal,headers:{Accept:format==='xml'?'application/xml':'application/json'}});if(!response.ok)throw new Error('PubMed HTTP '+response.status);return await (format==='xml'?response.text():response.json());}finally{clearTimeout(timer);}
}
export function searchParameters(term,type,filters){
  validateFilters(filters);
  const kind=filters.studyType==='recent'?type:filters.studyType;
  const filter=kind==='research'?'("Randomized Controlled Trial"[Publication Type] OR "Systematic Review"[Publication Type])':STUDY_TYPES[kind];
  const terms=[`(${term||TOPICS})`];if(filter)terms.push(filter);
  if(filters.yearFrom||filters.yearTo)terms.push(`("${filters.yearFrom||'1500'}/01/01"[Date - Publication] : "${filters.yearTo||'3000'}/12/31"[Date - Publication])`);
  if(filters.fullText==='full')terms.push('full text[sb]');else if(filters.fullText==='free')terms.push('free full text[sb]');
  const parameters={db:'pubmed',term:terms.join(' AND '),retmode:'json',retmax:filters.studyType==='recent'?'40':'80',sort:'date'};
  if(!term&&!filters.yearFrom&&!filters.yearTo)Object.assign(parameters,{reldate:kind==='guideline'?'1825':'365',datetype:'pdat'});
  return parameters;
}
async function search(term,type,filters){
  const response=await fetchResponse('esearch.fcgi',searchParameters(term,type,filters),'json');if(response.error||!Array.isArray(response.esearchresult?.idlist))throw new Error('Invalid PubMed search response');return response.esearchresult.idlist.filter(id=>/^\d+$/.test(id));
}

function savedIds(){
  const user=window.clinicalMindCurrentUser?.();if(!user)return[];
  const read=key=>{try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value:[];}catch{return[];}};
  const ids=[...read('clinicalmind.favorites.'+user.email),...read('clinicalmind.history.'+user.email).map(entry=>entry?.id)];
  return [...new Set(ids.filter(id=>typeof id==='string'&&/^pubmed-\d+$/.test(id)).map(id=>id.slice(7)))];
}
export async function syncLibrary(term='',filters=readFilters()) {
  if(busy)return;term=String(term).trim().slice(0,200);try{if(!/^(?:pubmed-)?\d{1,12}$/.test(term))validateFilters(filters);}catch(error){status(error.message,'error');return;}lastFilters={...filters};busy=true;lastQuery=term;favoriteLookups.clear();
  const buttons=searchControls();buttons.forEach(button=>button.disabled=true);
  status(text('Consultando diretrizes e artigos no PubMed/NCBI…','Fetching guidelines and articles from PubMed/NCBI…'),'loading');
  try{
    const pmid=term.match(/^(?:pubmed-)?(\d{1,12})$/)?.[1];
    const guidelines=pmid?[pmid]:await search(term,'guideline',filters),articles=pmid||filters.studyType!=='recent'?[]:await search(term,'research',filters),ids=[...new Set([...guidelines,...articles,...savedIds()])];
    savedIds().forEach(id=>favoriteLookups.add(id));
    const records=[],checkedAt=Date.now();
    for(let i=0;i<ids.length;i+=100){const xml=await fetchResponse('efetch.fcgi',{db:'pubmed',id:ids.slice(i,i+100).join(','),retmode:'xml'},'xml');records.push(...parseArticles(xml,checkedAt));}
    const primaryIds=new Set([...guidelines,...articles]);
    const unique=[...new Map(records.map(record=>[record.id,{...record,lookupOnly:!primaryIds.has(record.pmid)}])).values()];lastChecked=checkedAt;lastQuery=term;apply(unique,term);
    if(!pmid&&!['recent','guideline'].includes(filters.studyType)&&['Início','Diretrizes'].includes(document.querySelector('.nav-btn.active')?.dataset.section))document.querySelector('#nav [data-section="Literatura"]')?.click();
    if(pmid&&['Início','Diretrizes','Literatura','Alertas','Referências'].includes(document.querySelector('.nav-btn.active')?.dataset.section))document.querySelector('#nav [data-section="Literatura"]')?.click();
    if(byId('app')?.classList.contains('drawer-open'))byId('sidebarToggle')?.click();
    const fetched=new Intl.DateTimeFormat(english()?'en-US':'pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(lastChecked));
    status(text(`PubMed online: ${unique.filter(record=>!record.lookupOnly).length} registros · consultado em ${fetched}.`,`PubMed online: ${unique.filter(record=>!record.lookupOnly).length} records · retrieved ${fetched}.`)+(pmid?text(' Consulta direta por PMID; filtros não aplicados.',' Direct PMID lookup; filters not applied.'):text(' Filtros aplicados na consulta.',' Filters applied to the request.')));
  }catch(error){status(text('Falha ao consultar o PubMed. Clique em Atualizar PubMed para tentar novamente.','Could not fetch PubMed. Click Refresh PubMed to try again.')+(lastChecked?text(' Os resultados da última consulta online foram mantidos.',' Results from the last online request were kept.'):'') ,'error');refreshView();console.warn('Protocolum online library:',error.message);}
  finally{busy=false;buttons.forEach(button=>button.disabled=false);if(favoritesPending){favoritesPending=false;recoverFavorites();}}
}
async function recoverFavorites(){
  if(busy){favoritesPending=true;return;}
  const library=window.clinicalMindLibrary;if(!Array.isArray(library))return;
  const ids=savedIds().filter(id=>!library.some(record=>record.pmid===id)&&!favoriteLookups.has(id));if(!ids.length)return;
  ids.forEach(id=>favoriteLookups.add(id));busy=true;const buttons=searchControls();buttons.forEach(button=>button.disabled=true);
  try{const records=[];for(let i=0;i<ids.length;i+=100){const xml=await fetchResponse('efetch.fcgi',{db:'pubmed',id:ids.slice(i,i+100).join(','),retmode:'xml'},'xml');records.push(...parseArticles(xml).map(record=>({...record,lookupOnly:true})));}apply([...new Map([...library,...records].map(record=>[record.id,record])).values()],window.clinicalMindOnlineQuery||'');}
  catch{status(text('Não foi possível consultar os favoritos no PubMed. Use Atualizar PubMed para tentar novamente.','Could not retrieve favorites from PubMed. Use Refresh PubMed to try again.'),'error');}
  finally{busy=false;buttons.forEach(button=>button.disabled=false);if(favoritesPending){favoritesPending=false;recoverFavorites();}}
}
window.addEventListener('protocolum-favorites-updated',()=>recoverFavorites());
function init(){byId('applyFilters').onclick=()=>syncLibrary(byId('search')?.value||'');byId('showAll')?.addEventListener('click',()=>{byId('pubmedYearFrom').value='';byId('pubmedYearTo').value='';byId('pubmedStudyType').value='recent';byId('pubmedFullText').value='any';syncLibrary('');});const app=byId('app');let started=false;byId('refreshLibrary')?.addEventListener('click',()=>syncLibrary(lastQuery,lastFilters));byId('searchOnlineLibrary')?.addEventListener('click',()=>syncLibrary(byId('search')?.value||''));byId('search')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();syncLibrary(event.target.value);}});const start=()=>{if(started||!app||app.hidden)return;started=true;syncLibrary();};start();if(app&&!started){const observer=new MutationObserver(()=>{start();if(started)observer.disconnect();});observer.observe(app,{attributes:true,attributeFilter:['hidden']});}document.addEventListener('visibilitychange',()=>{if(started&&!document.hidden&&Date.now()-lastChecked>6*60*60*1000)syncLibrary(lastQuery,lastFilters);});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
