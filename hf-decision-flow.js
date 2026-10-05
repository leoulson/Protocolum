// Árvore didática de decisão para ICFEr. O conteúdo e os caminhos ficam nos dados;
// renderNode() é genérico e pode ser reutilizado com outros grafos clínicos.
const nodes = [
  {
    id: 'start', tipo: 'pergunta',
    texto: 'Diagnóstico de insuficiência cardíaca confirmado e sintomas atuais (NYHA II–IV)?',
    textoEn: 'Is heart failure confirmed, with current symptoms (NYHA II–IV)?',
    fundamentacao: 'Confirme o diagnóstico clínico e a síndrome de insuficiência cardíaca antes de aplicar recomendações farmacológicas para doença sintomática.',
    fundamentacaoEn: 'Confirm the clinical diagnosis and heart failure syndrome before applying pharmacologic recommendations for symptomatic disease.',
    opcoes: [{ texto: 'Sim', textoEn: 'Yes', proximo: 'ef' }, { texto: 'Não', textoEn: 'No', proximo: 'not-eligible' }]
  },
  {
    id: 'ef', tipo: 'pergunta', texto: 'Qual é a fração de ejeção do ventrículo esquerdo (FEVE)?',
    textoEn: 'What is the left ventricular ejection fraction (LVEF)?',
    fundamentacao: 'A FEVE ajuda a classificar o fenótipo e direcionar a evidência terapêutica aplicável.',
    fundamentacaoEn: 'LVEF helps classify the phenotype and identify applicable therapeutic evidence.',
    opcoes: [
      { texto: '≤ 40% (ICFEr)', textoEn: '≤ 40% (HFrEF)', proximo: 'congestion' },
      { texto: '41–49% (ICFElr)', textoEn: '41–49% (HFmrEF)', proximo: 'hfmrEF' },
      { texto: '≥ 50% (ICFEp)', textoEn: '≥ 50% (HFpEF)', proximo: 'hfpef' }
    ]
  },
  {
    id: 'congestion', tipo: 'pergunta',
    texto: 'Há sinais clínicos de congestão (por exemplo, edema periférico, turgência jugular ou estertores)?',
    textoEn: 'Are there clinical signs of congestion (e.g., peripheral edema, jugular venous distension, or crackles)?',
    fundamentacao: 'Diuréticos são usados para aliviar congestão e sintomas; não substituem a terapia modificadora de prognóstico.',
    fundamentacaoEn: 'Diuretics relieve congestion and symptoms; they do not replace disease-modifying therapy.',
    opcoes: [{ texto: 'Sim', textoEn: 'Yes', proximo: 'diuretic' }, { texto: 'Não', textoEn: 'No', proximo: 'four-pillars' }]
  },
  {
    id: 'diuretic', tipo: 'acao',
    texto: 'Considerar diurético de alça (por exemplo, furosemida) para aliviar a congestão, com ajuste conforme resposta e monitoramento.',
    textoEn: 'Consider a loop diuretic (e.g., furosemide) to relieve congestion, adjusting to response and monitoring.',
    fundamentacao: 'A dose depende do estado volêmico, função renal, resposta clínica e tratamento prévio. Reavalie sintomas, peso, pressão arterial, eletrólitos e função renal.',
    fundamentacaoEn: 'Dose depends on volume status, renal function, clinical response, and prior treatment. Reassess symptoms, weight, blood pressure, electrolytes, and renal function.',
    opcoes: [{ texto: 'Continuar para terapia modificadora de prognóstico', textoEn: 'Continue to disease-modifying therapy', proximo: 'four-pillars' }]
  },
  {
    id: 'four-pillars', tipo: 'conclusao',
    texto: 'ICFEr sintomática (FEVE ≤ 40%): introduzir precocemente os quatro pilares, frequentemente em paralelo e em doses baixas, conforme estabilidade, contraindicações e tolerabilidade.',
    textoEn: 'Symptomatic HFrEF (LVEF ≤ 40%): initiate the four pillars early, often in parallel at low doses, according to stability, contraindications, and tolerability.',
    fundamentacao: 'A diretriz AHA/ACC/HFSA descreve quatro classes de terapia dirigida por diretrizes. A ESC recomenda ARNI/IECA, betabloqueador, ARM e iSGLT2 para ICFEr; otimização individualizada e monitoramento são essenciais.',
    fundamentacaoEn: 'The AHA/ACC/HFSA guideline describes four classes of guideline-directed therapy. ESC recommends ARNI/ACEi, beta-blocker, MRA, and SGLT2i for HFrEF; individualized optimization and monitoring are essential.',
    pillars: [
      { title: 'INRA (sacubitril/valsartana), preferencial quando apropriado; IECA ou BRA se INRA não for viável.', titleEn: 'ARNI (sacubitril/valsartan), preferred when appropriate; ACEi or ARB if ARNI is not feasible.', note: 'Após IECA, aguardar pelo menos 36 horas antes de iniciar INRA. Avaliar pressão arterial, potássio, função renal e histórico de angioedema.', noteEn: 'After an ACEi, wait at least 36 hours before starting ARNI. Assess blood pressure, potassium, renal function, and history of angioedema.' },
      { title: 'Betabloqueador com evidência em ICFEr (carvedilol, bisoprolol ou succinato de metoprolol).', titleEn: 'Evidence-based beta-blocker for HFrEF (carvedilol, bisoprolol, or metoprolol succinate).', note: 'Iniciar ou titular quando o paciente estiver clinicamente estável; cautela em descompensação aguda e baixo débito.', noteEn: 'Initiate or titrate when clinically stable; use caution in acute decompensation and low-output states.' },
      { title: 'Antagonista do receptor mineralocorticoide (espironolactona ou eplerenona), se elegível.', titleEn: 'Mineralocorticoid receptor antagonist (spironolactone or eplerenone), if eligible.', note: 'Na diretriz AHA/ACC/HFSA: em geral, eGFR > 30 mL/min/1,73 m² e potássio < 5,0 mEq/L para iniciar; monitorar potássio e função renal.', noteEn: 'AHA/ACC/HFSA guideline: generally eGFR > 30 mL/min/1.73 m² and potassium < 5.0 mEq/L to initiate; monitor potassium and renal function.' },
      { title: 'Inibidor de SGLT2 (dapagliflozina ou empagliflozina), mesmo sem diabetes, conforme indicação e função renal.', titleEn: 'SGLT2 inhibitor (dapagliflozin or empagliflozin), even without diabetes, according to indication and renal function.', note: 'Revisar função renal, volemia, risco de cetoacidose e situações de suspensão temporária conforme bula/protocolo.', noteEn: 'Review renal function, volume status, ketoacidosis risk, and situations requiring temporary interruption per product label/protocol.' }
    ],
    evidence: [
      { name: 'PARADIGM-HF', url: 'https://pubmed.ncbi.nlm.nih.gov/25176015/' },
      { name: 'EMPHASIS-HF', url: 'https://pubmed.ncbi.nlm.nih.gov/21073363/' },
      { name: 'DAPA-HF', url: 'https://pubmed.ncbi.nlm.nih.gov/31535829/' },
      { name: 'EMPEROR-Reduced', url: 'https://pubmed.ncbi.nlm.nih.gov/32865377/' },
      { name: 'Diretriz AHA/ACC/HFSA 2022', url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063' },
      { name: 'Atualização focada ESC 2023', url: 'https://academic.oup.com/eurheartj/article/44/37/3627/7246292' }
    ]
  },
  {
    id: 'not-eligible', tipo: 'conclusao',
    texto: 'O paciente não preenche, com as informações fornecidas, os critérios deste percurso para terapia otimizada de ICFEr sintomática. Investigue outras causas para os sintomas e confirme o diagnóstico.',
    textoEn: 'Based on the information provided, the patient does not meet this pathway’s criteria for optimized symptomatic HFrEF therapy. Investigate other causes of symptoms and confirm the diagnosis.',
    fundamentacao: 'Esta simulação cobre somente um recorte de ICFEr sintomática e não substitui avaliação diagnóstica, prevenção ou conduta individual.',
    fundamentacaoEn: 'This simulation covers only a narrow pathway for symptomatic HFrEF and does not replace diagnostic assessment, prevention, or individualized care.'
  },
  {
    id: 'hfmrEF', tipo: 'conclusao',
    texto: 'A FEVE de 41–49% não corresponde à ICFEr definida neste fluxo. Consulte a diretriz específica de ICFElr; iSGLT2 e diuréticos podem ter papel conforme sintomas e contexto.',
    textoEn: 'An LVEF of 41–49% does not meet the HFrEF definition used in this pathway. Consult HFmrEF-specific guidance; SGLT2 inhibitors and diuretics may have a role depending on symptoms and context.',
    fundamentacao: 'A atualização ESC 2023 reforçou recomendações para iSGLT2 em ICFElr e ICFEp. Este fluxo não detalha esses fenótipos.',
    fundamentacaoEn: 'The 2023 ESC update strengthened recommendations for SGLT2 inhibitors in HFmrEF and HFpEF. This pathway does not detail those phenotypes.'
  },
  {
    id: 'hfpef', tipo: 'conclusao',
    texto: 'A FEVE ≥ 50% não corresponde à ICFEr definida neste fluxo. Consulte a diretriz específica de ICFEp e confirme critérios diagnósticos, etiologia e comorbidades.',
    textoEn: 'An LVEF ≥ 50% does not meet the HFrEF definition used in this pathway. Consult HFpEF-specific guidance and confirm diagnostic criteria, etiology, and comorbidities.',
    fundamentacao: 'A classificação da insuficiência cardíaca depende de FEVE e do conjunto clínico/diagnóstico; este fluxograma não avalia ICFEp.',
    fundamentacaoEn: 'Heart failure classification depends on LVEF and the overall clinical/diagnostic picture; this flowchart does not assess HFpEF.'
  }
];

const byId = new Map(nodes.map(node => [node.id, node]));
const $ = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const isEnglish = () => document.documentElement.lang.toLowerCase().startsWith('en');
const tr = (pt, en) => isEnglish() ? (en || pt) : pt;
const FLOW_STATE_KEY='clinicalmind.hf-flow.state.v1';
let currentId = 'start';
let trail = [];
try { const saved=JSON.parse(localStorage.getItem(FLOW_STATE_KEY)||'null'); if(saved&&byId.has(saved.currentId)&&Array.isArray(saved.trail)){currentId=saved.currentId;trail=saved.trail.filter(step=>step&&byId.has(step.id)).slice(0,20)} } catch {}
function persistFlow(){try{localStorage.setItem(FLOW_STATE_KEY,JSON.stringify({currentId,trail}))}catch{}}

function labelFor(option) { return tr(option.text, option.textEn); }
function nodeText(node) { return tr(node.texto, node.textoEn); }
function nodeRationale(node) { return tr(node.fundamentacao, node.fundamentacaoEn); }

function transitionTo(nextId, answerText) {
  const current = byId.get(currentId);
  if (current) trail.push({ id: current.id, text: nodeText(current), answer: answerText || '' });
  currentId = nextId;
  persistFlow();
  renderNode(currentId, true);
}

function renderNode(id, animate = false) {
  const container = $('hfFlowStage');
  if (!container) return;
  const node = byId.get(id);
  if (!node) {
    container.innerHTML = '<div class="hf-flow-error">Não foi possível abrir esta etapa. Reinicie o fluxograma.</div>';
    return;
  }
  const prior = trail.map((step, index) => `<li><span>${index + 1}. ${safe(step.text)}</span>${step.answer ? `<small>→ ${safe(step.answer)}</small>` : ''}</li>`).join('');
  const options = (node.opcoes || []).map(option => `<button class="btn hf-flow-option" type="button" data-next="${safe(option.proximo)}" data-answer="${safe(labelFor(option))}">${safe(labelFor(option))}<span aria-hidden="true">→</span></button>`).join('');
  const conclusion = node.tipo === 'conclusao';
  const action = node.tipo === 'acao';
  const title = node.tipo === 'pergunta' ? (isEnglish() ? 'Clinical question' : 'Pergunta clínica') : action ? (isEnglish() ? 'Symptom relief' : 'Alívio de sintomas') : (isEnglish() ? 'Pathway result' : 'Resultado do percurso');
  const pillars = node.pillars ? `<ol class="hf-pillars">${node.pillars.map(pillar => `<li><strong>${safe(tr(pillar.title, pillar.titleEn))}</strong><small>${safe(tr(pillar.note, pillar.noteEn))}</small></li>`).join('')}</ol>` : '';
  const evidence = node.evidence ? `<section class="hf-evidence" id="hfEvidence"><h4>${isEnglish() ? 'Key evidence and guidance' : 'Evidências e diretrizes'}</h4><div>${node.evidence.map(item => `<a href="${safe(item.url)}" target="_blank" rel="noopener noreferrer">${safe(item.name)} ↗</a>`).join('')}</div></section>` : '';
  const restart = conclusion ? `<button class="btn primary hf-flow-restart" type="button" data-restart>${isEnglish() ? 'Restart simulation' : 'Reiniciar simulação'}</button>` : '';
  const evidenceButton = node.evidence ? `<button class="btn hf-flow-evidence" type="button" data-evidence>${isEnglish() ? 'View evidence / pivotal studies' : 'Ver evidências/estudos pivotais'}</button>` : '';
  const existingStep = trail.length + 1;
  container.innerHTML = `${prior ? `<ol class="hf-flow-trail" aria-label="${isEnglish() ? 'Previous steps' : 'Etapas anteriores'}">${prior}</ol>` : ''}
    <article class="hf-flow-card ${conclusion ? 'is-conclusion' : ''} ${action ? 'is-action' : ''}" aria-live="polite">
      <div class="hf-flow-kicker">${safe(title)}${node.tipo === 'pergunta' ? ` · ${isEnglish() ? 'Step' : 'Etapa'} ${existingStep}` : ''}</div>
      <h3>${safe(nodeText(node))}</h3>
      ${pillars}
      <details class="hf-flow-rationale"><summary>${isEnglish() ? 'Rationale and safety notes' : 'Fundamentação e pontos de segurança'}</summary><p>${safe(nodeRationale(node))}</p></details>
      ${options ? `<div class="hf-flow-options">${options}</div>` : ''}
      ${evidenceButton}${evidence}
      ${restart}
      <p class="hf-flow-disclaimer">${isEnglish() ? 'Educational decision-support example only. It is not a diagnosis or a patient-specific prescription. Confirm current local guidance, contraindications, interactions, laboratory results, and clinical stability.' : 'Exemplo educacional de apoio à decisão. Não é diagnóstico nem prescrição individual. Confirme diretrizes locais vigentes, contraindicações, interações, exames laboratoriais e estabilidade clínica.'}</p>
    </article>`;
  if (animate) {
    const card = container.querySelector('.hf-flow-card');
    card.classList.add('is-entering');
    requestAnimationFrame(() => card.classList.remove('is-entering'));
  }
  container.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => transitionTo(button.dataset.next, button.dataset.answer)));
  container.querySelector('[data-restart]')?.addEventListener('click', restartFlow);
  container.querySelector('[data-evidence]')?.addEventListener('click', () => $('hfEvidence')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
}

function restartFlow() {
  currentId = 'start';
  trail = [];
  persistFlow();
  renderNode(currentId, true);
}

function renderShell() {
  $('recommendations').innerHTML = `<section class="hf-flow" aria-labelledby="hfFlowTitle">
    <header class="hf-flow-intro"><span class="hf-flow-eyebrow">${isEnglish() ? 'INTERACTIVE CLINICAL PATHWAY' : 'FLUXOGRAMA CLÍNICO INTERATIVO'}</span><h2 id="hfFlowTitle">${isEnglish() ? 'HFrEF treatment pathway' : 'Tratamento da ICFEr'}</h2>
      <p>${isEnglish() ? 'A step-by-step educational simulation based on the four foundational therapy classes.' : 'Uma simulação educacional passo a passo baseada nas quatro classes fundamentais de tratamento.'}</p>
    </header>
    <div class="hf-flow-stage" id="hfFlowStage"></div>
    <footer class="hf-flow-sources"><span>${isEnglish() ? 'Guideline sources:' : 'Fontes das diretrizes:'}</span> <a href="https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063" target="_blank" rel="noopener noreferrer">AHA/ACC/HFSA 2022</a> · <a href="https://academic.oup.com/eurheartj/article/44/37/3627/7246292" target="_blank" rel="noopener noreferrer">ESC 2023 focused update</a></footer>
  </section>`;
  renderNode(currentId);
}

window.renderHFDecisionFlow = renderShell;

document.getElementById('appLanguage')?.addEventListener('click', () => {
  if (document.querySelector('.nav-btn.active')?.dataset.section === 'Fluxogramas') renderNode(currentId);
});
