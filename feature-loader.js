// Optional screens load on first use; authentication and appearance remain eager.
(()=>{
 let requestVersion=0;
 const loaded=new Map(),active=()=>document.querySelector('.nav-btn.active')?.dataset.section;
 const text=(pt,en)=>document.documentElement.lang.startsWith('en')?en:pt;
 const features={
  'Perfil':{load:()=>import('./profile-ui.js').then(module=>module.injectProfile({renderCurrent:false})),render:()=>window.renderProfilePage()},
  'Comparador':{load:()=>import('./guideline-comparison.js'),render:()=>window.renderGuidelineComparison()},
  'Fluxogramas':{load:()=>import('./hf-decision-flow.js'),render:()=>window.renderHFDecisionFlow()},
  'Laboratório PubMed':{load:()=>import('./pubmed-lab.js'),render:()=>window.renderPubMedLab()},
  'Comunidade':{load:()=>import('./community-case-forum.js'),render:()=>window.renderEvidenceCommunity()},
  'reader':{load:()=>import('./reader-architecture.js')}
 };
 function notice(name){
  const reader=name==='reader',host=document.getElementById(reader?'detailBody':'recommendations');
  if(!host||(reader?!host.querySelector('#readerSummary'):active()!==name||document.getElementById('app').hidden))return;
  const panel=document.createElement('div');panel.className='feature-load-notice';panel.setAttribute('role','status');
  const message=document.createElement('p');message.textContent=text('Não foi possível carregar esta ferramenta. Verifique a conexão e tente novamente.','Could not load this tool. Check your connection and try again.');
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent=text('Recarregar página','Reload page');button.onclick=()=>location.reload();panel.append(message,button);
  if(reader){host.querySelector('.feature-load-notice')?.remove();host.prepend(panel);}else host.replaceChildren(panel);
 }
 async function request(name){
  const feature=features[name];if(!feature)return;const version=++requestVersion;
  if(!loaded.has(name)){const pending=feature.load();loaded.set(name,pending);pending.catch(()=>{if(loaded.get(name)===pending)loaded.delete(name);});}
  try{
   await loaded.get(name);
   if(version===requestVersion&&feature.render&&active()===name&&!document.getElementById('app').hidden)feature.render();
  }catch{if(version===requestVersion)notice(name);}
 }
 window.protocolumLoadFeature=request;
 document.addEventListener('DOMContentLoaded',()=>{
  const account=document.getElementById('accountBtn');if(account)account.onclick=()=>document.querySelector('#nav [data-section="Perfil"]')?.click();
 });
})();
