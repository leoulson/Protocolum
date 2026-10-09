import { articleIdentifier, normalizeArticle } from './community-article-data.js';
import { escape as esc, text as t } from './community-view.js';
export function articleCard(value){
  const article=normalizeArticle(value);if(!article)return '';
  return `<aside class="community-article"><small>${article.source==='pubmed'?'PubMed · PMID':'Crossref · DOI'}: ${esc(article.identifier)}</small><h4><a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">${esc(article.title)} ↗</a></h4><p>${esc(article.authors||t('Autores não informados pela fonte.','Authors not provided by the source.'))}</p></aside>`;
}
async function lookup(id,signal){
  const url=id.source==='pubmed'?'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?'+new URLSearchParams({db:'pubmed',id:id.identifier,retmode:'xml'}):'https://api.crossref.org/works/'+encodeURIComponent(id.identifier);
  const response=await fetch(url,{signal});if(!response.ok)throw Error('lookup');let title,authors;
  if(id.source==='pubmed'){
    const xml=new DOMParser().parseFromString(await response.text(),'application/xml');if(xml.querySelector('parsererror'))throw Error('lookup');
    const citation=[...xml.querySelectorAll('PubmedArticle')].find(node=>node.querySelector('MedlineCitation > PMID')?.textContent.trim()===id.identifier);if(!citation)throw Error('lookup');
    title=citation.querySelector('ArticleTitle')?.textContent;
    authors=[...citation.querySelectorAll('AuthorList > Author')].slice(0,15).map(node=>node.querySelector('CollectiveName')?.textContent||[node.querySelector('LastName')?.textContent,node.querySelector('Initials')?.textContent].filter(Boolean).join(' ')).join(', ');
  }else{
    const {message}=await response.json();if(articleIdentifier(message?.DOI)?.identifier!==id.identifier)throw Error('lookup');title=message.title?.[0];authors=(message.author||[]).slice(0,15).map(author=>author.name||[author.given,author.family].filter(Boolean).join(' ')).join(', ');
  }
  const article=normalizeArticle({...id,title:String(title||'').replace(/\s+/g,' ').trim().slice(0,600),authors:String(authors||'').slice(0,1000)});if(!article)throw Error('lookup');return article;
}
export function mountArticle(form){
  const block=document.createElement('section');block.className='community-article-compose';
  block.innerHTML=`<label>${t('Anexar artigo por PMID ou DOI (opcional)','Attach an article by PMID or DOI (optional)')}<input type="text" data-article-id maxlength="320" placeholder="PMID: 12345678 / DOI: 10.1234/artigo"></label><div><button class="btn" type="button" data-article-lookup>${t('Buscar artigo','Find article')}</button><button class="btn" type="button" data-article-remove hidden>${t('Remover artigo','Remove article')}</button></div><p data-article-status role="status" aria-live="polite"></p><div data-article-preview></div>`;
  const submit=form.querySelector('button[type="submit"]');submit.before(block);
  const input=block.querySelector('[data-article-id]'),button=block.querySelector('[data-article-lookup]'),remove=block.querySelector('[data-article-remove]'),status=block.querySelector('[data-article-status]'),preview=block.querySelector('[data-article-preview]');
  let article=null,version=0,controller,referenceFilled='';
  const clear=()=>{version++;controller?.abort();article=null;preview.replaceChildren();status.textContent='';remove.hidden=true;button.disabled=false;submit.disabled=false;};
  input.oninput=()=>{if(referenceFilled&&form.elements.reference?.value===referenceFilled)form.elements.reference.value='';referenceFilled='';clear();};
  remove.onclick=()=>{input.value='';if(referenceFilled&&form.elements.reference?.value===referenceFilled)form.elements.reference.value='';referenceFilled='';clear();input.focus();};
  button.onclick=async()=>{
    clear();const id=articleIdentifier(input.value);if(!id){status.textContent=t('Informe um PMID ou DOI válido.','Enter a valid PMID or DOI.');return;}
    const revision=version;controller=new AbortController();const request=controller,timer=setTimeout(()=>request.abort(),15000);button.disabled=true;submit.disabled=true;status.textContent=t('Buscando metadados do artigo…','Fetching article metadata…');
    try{const result=await lookup(id,request.signal);if(revision!==version||!block.isConnected)return;article=result;preview.innerHTML=articleCard(result);remove.hidden=false;status.textContent=t('Artigo encontrado. Revise a referência antes de publicar.','Article found. Review the reference before publishing.');if(form.elements.reference&&!form.elements.reference.value.trim()){referenceFilled=((result.source==='pubmed'?'PMID: ':'DOI: ')+result.identifier).slice(0,240);form.elements.reference.value=referenceFilled;}}
    catch{if(revision===version&&block.isConnected)status.textContent=t('Artigo não encontrado ou fonte indisponível. Confira o identificador e tente novamente.','Article not found or source unavailable. Check the identifier and retry.');}
    finally{clearTimeout(timer);if(revision===version){button.disabled=false;submit.disabled=false;}}
  };
  return {get(){if(input.value.trim()&&!article){status.textContent=t('Busque o artigo antes de publicar ou limpe o identificador.','Find the article before publishing or clear the identifier.');throw Error('Article lookup required');}return article;},clear(){input.value='';referenceFilled='';clear();}};
}
