import { normalizeAcademic } from './profile-academic.js';
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function normalizeProfile(value = {}) {
  const p = value && typeof value === 'object' ? value : {};
  const friends = Array.isArray(p.friends) ? p.friends.filter(f => f && typeof f === 'object').map(f => ({id:clean(f.id),name:clean(f.name,80),email:clean(f.email).toLowerCase(),specialty:clean(f.specialty,80)})).filter(f => f.id && f.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) : [];
  return {...normalizeAcademic(p),role:clean(p.role,80),specialty:clean(p.specialty,80),institution:clean(p.institution),city:clean(p.city,100),bio:clean(p.bio,600),friends:friends.filter((f,i,a)=>a.findIndex(x=>x.email===f.email)===i).slice(0,100)};
}
