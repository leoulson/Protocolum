export function articleIdentifier(value){
  let id=String(value||'').trim();
  const pmid=id.match(/^(?:PMID:\s*|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d{1,12})\/?$/i);
  if(pmid)return {source:'pubmed',identifier:pmid[1]};
  id=id.replace(/^doi:\s*/i,'').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i,'');
  try{id=decodeURIComponent(id);}catch{return null;}
  if(/^10\.\d{4,9}\/[^\s<>"?#]+$/i.test(id)&&id.length<=300)return {source:'crossref',identifier:id.toLowerCase()};
  return null;
}
export function normalizeArticle(value){
  if(!value||typeof value!=='object')return null;
  const id=articleIdentifier(value.identifier);
  if(!id||id.source!==value.source||typeof value.title!=='string'||!value.title.trim()||value.title.length>600||typeof value.authors!=='string'||value.authors.length>1000)return null;
  return {...id,title:value.title.trim(),authors:value.authors.trim(),url:id.source==='pubmed'?`https://pubmed.ncbi.nlm.nih.gov/${id.identifier}/`:'https://doi.org/'+id.identifier.split('/').map(encodeURIComponent).join('/')};
}
