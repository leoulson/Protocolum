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
