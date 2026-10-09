export const SHARE_FIELDS=['role','specialty','institution','city','bio','orcid','lattes','articles'];
export function normalizeSharing(value){
  const s=value&&typeof value==='object'?value:{};
  return {published:s.published===true,autoUpdate:s.autoUpdate!==false,visible:Array.isArray(s.visible)?SHARE_FIELDS.filter(field=>s.visible.includes(field)):[...SHARE_FIELDS]};
}
export function sharedProfile(uid,name,profile,settings){
  const sharing=normalizeSharing(settings),visible=new Set(sharing.visible);
  name=String(name||'Protocolum').trim().slice(0,80)||'Protocolum';
  const result={uid,name,nameSearch:name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),theme:profile.theme};
  for(const field of SHARE_FIELDS)result[field]=visible.has(field)?profile[field]:field==='articles'?[]:'';
  return result;
}
