import { QUESTIONS, VERIFIED_ON, localize, buildComparison, buildReport } from './guideline-comparison-data.js';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const language = () => document.documentElement.lang.startsWith('en') ? 'en' : 'pt';
const t = (pt, en) => language() === 'en' ? en : pt;
const text = value => localize(value, language());
const storageKey = () => 'protocolum.guideline-comparison.v1.' + (window.clinicalMindCurrentUser?.()?.email || 'guest');
let state = {};
let currentId = QUESTIONS[0].id;
let query = '';

function loadState() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || '{}');
    state = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { state = {}; }
  currentId = QUESTIONS.some(q => q.id === state.question) ? state.question : QUESTIONS[0].id;
}
function saveState() {
  state.question = currentId;
  try { localStorage.setItem(storageKey(), JSON.stringify(state)); }
  catch { announce(t('Não foi possível salvar neste navegador.', 'Could not save in this browser.')); }
}
function currentQuestion() { return QUESTIONS.find(question => question.id === currentId); }
function selectedIds(question) {
  const saved = state['sources:' + question.id];
  return Array.isArray(saved) ? saved.filter(id => question.sources.some(source => source.id === id)) : question.sources.map(source => source.id);
}
function notes() { return typeof state['notes:' + currentId] === 'string' ? state['notes:' + currentId] : ''; }
function comparison() { return buildComparison(currentId, selectedIds(currentQuestion())); }
function announce(message) {
  const element = document.getElementById('gcompFeedback');
  if (element) element.textContent = message;
}
function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function matchingQuestions() {
  const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return QUESTIONS.filter(question => tokens.every(token =>
    normalize(question.keywords + ' ' + text(question.title)).includes(token)));
}

function sourceCard(source) {
  const fields = [
    [t('População', 'Population'), source.population],
    [t('Critérios de aplicação', 'Application criteria'), source.criteria],
    [t('Força e evidência', 'Strength and evidence'), null],
    [t('Limites e exclusões', 'Limits and exclusions'), source.limits]
  ];
  return '<article class="gcomp-card"><header><span class="gcomp-society">' + escapeHTML(source.society) +
    '</span><span class="gcomp-year">' + source.year + '</span></header><h3>' +
    escapeHTML(text(source.recommendation)) + '</h3><div class="gcomp-fields">' +
    fields.map(([label, value], index) => '<details' + (index === 0 ? ' open' : '') + '><summary>' +
      escapeHTML(label) + '</summary>' + (value ? '<p>' + escapeHTML(text(value)) + '</p>' :
      '<dl><dt>' + t('Força', 'Strength') + '</dt><dd>' + escapeHTML(text(source.strength)) +
      '</dd><dt>' + t('Evidência', 'Evidence') + '</dt><dd>' + escapeHTML(text(source.evidence)) +
      '</dd><dt>' + t('Sistema de classificação', 'Grading system') + '</dt><dd>' +
      escapeHTML(source.framework) + '</dd></dl>') + '</details>').join('') +
    '</div><footer><p>' + escapeHTML(source.title) + '</p><small>' +
    t('Localizador: ', 'Locator: ') + escapeHTML(source.section) +
    '</small><a class="gcomp-source-link" href="' + escapeHTML(source.url) +
    '" target="_blank" rel="noopener noreferrer">' + t('Ler fonte original ↗', 'Read original source ↗') +
    '</a></footer></article>';
}

function drawResults() {
  const host = document.getElementById('gcompResults');
  if (!host) return;
  const result = comparison();
  const { question, sources, complete } = result;
  const date = new Intl.DateTimeFormat(language() === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'medium' })
    .format(new Date(VERIFIED_ON + 'T12:00:00'));
  host.innerHTML = '<header class="gcomp-result-heading"><h2>' + escapeHTML(text(question.title)) +
    '</h2><p>' + t('Fontes verificadas em ', 'Sources checked on ') + date + '</p></header>' +
    (complete ? '<section class="gcomp-synthesis" aria-label="' + t('Síntese editorial', 'Editorial synthesis') +
      '"><h3>' + t('Concordâncias', 'Agreements') + '</h3><p>' + escapeHTML(text(question.agreement)) +
      '</p><h3>' + t('Diferenças e interpretação', 'Differences and interpretation') + '</h3><p>' +
      escapeHTML(text(question.difference)) + '</p></section>' :
      '<section class="gcomp-empty" role="status"><h3>' + t('Comparação incompleta', 'Incomplete comparison') +
      '</h3><p>' + t('Selecione pelo menos duas fontes. Há ', 'Select at least two sources. There are ') +
      sources.length + t(' selecionada(s) e ', ' selected and ') + question.sources.length +
      t(' cadastrada(s) para esta pergunta. O comparador não infere recomendações ausentes.', ' curated for this question. The comparator does not infer missing recommendations.') + '</p></section>') +
    '<p class="gcomp-context">' + escapeHTML(text(question.context)) + '</p>' +
    '<div class="gcomp-cards">' + sources.map(sourceCard).join('') + '</div>' +
    '<section class="gcomp-notes"><label for="gcompNotes">' + t('Minha leitura da comparação', 'My appraisal of the comparison') +
    '</label><textarea id="gcompNotes" rows="4" maxlength="5000" placeholder="' +
    t('Registre dúvidas e pontos para revisar…', 'Record questions and points to review…') + '">' +
    escapeHTML(notes()) + '</textarea><small id="gcompNotesStatus">' +
    t('Anotações salvas somente neste navegador.', 'Notes saved only in this browser.') +
    '</small></section><div class="gcomp-actions"><button type="button" id="gcompCopy">' +
    t('Copiar comparação', 'Copy comparison') + '</button><button type="button" id="gcompExport">' +
    t('Baixar comparação', 'Download comparison') + '</button></div><p class="gcomp-use-note">' +
    t('Resumo educacional de edições selecionadas. Consulte os documentos completos e protocolos locais antes de aplicar uma recomendação.',
      'Educational summary of selected editions. Consult complete documents and local protocols before applying a recommendation.') +
    '</p><p id="gcompFeedback" class="gcomp-feedback" role="status"></p>';
  const field = document.getElementById('gcompNotes');
  const resize = () => { field.style.height = 'auto'; field.style.height = Math.max(128, field.scrollHeight) + 'px'; };
  field.addEventListener('input', () => {
    state['notes:' + currentId] = field.value;
    saveState();
    resize();
  });
  resize();
  document.getElementById('gcompCopy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildReport(comparison(), language(), notes()));
      announce(t('Comparação e referências copiadas.', 'Comparison and references copied.'));
    } catch { announce(t('Cópia indisponível. Use “Baixar comparação”.', 'Copy unavailable. Use “Download comparison”.')); }
  });
  document.getElementById('gcompExport').addEventListener('click', () => {
    const blob = new Blob([buildReport(comparison(), language(), notes())], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'protocolum-comparacao-' + currentId + '.txt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce(t('Comparação exportada com as referências.', 'Comparison exported with references.'));
  });
}

function drawSources() {
  const question = currentQuestion();
  const selected = selectedIds(question);
  const fieldset = document.getElementById('gcompSources');
  fieldset.hidden = false;
  fieldset.innerHTML = '<legend>' + t('Fontes para comparar', 'Sources to compare') + '</legend>' +
    question.sources.map(source => '<label class="gcomp-source-choice"><input type="checkbox" value="' +
      escapeHTML(source.id) + '"' + (selected.includes(source.id) ? ' checked' : '') +
      '><span>' + escapeHTML(source.society) + ' <small>' + source.year + ' · ' +
      escapeHTML(source.framework) + '</small></span></label>').join('');
  fieldset.onchange = () => {
    state['sources:' + currentId] = Array.from(fieldset.querySelectorAll('input:checked'), input => input.value);
    saveState();
    drawResults();
  };
  drawResults();
}
function drawPicker() {
  const select = document.getElementById('gcompQuestion');
  const matches = matchingQuestions();
  if (!matches.length) {
    select.innerHTML = '<option>' + t('Nenhuma pergunta cadastrada', 'No curated question found') + '</option>';
    select.disabled = true;
    document.getElementById('gcompSources').hidden = true;
    document.getElementById('gcompResults').innerHTML = '<div class="gcomp-empty" role="status"><h2>' +
      t('Ainda não há comparação para esse tema', 'No comparison available for this topic yet') +
      '</h2><p>' + t('Tente “diabetes”, “renal” ou “ICFEp”. A ausência aqui indica falta de conteúdo cadastrado, não ausência de diretrizes.',
        'Try “diabetes”, “kidney” or “HFpEF”. Absence here means missing curated content, not absence of guidelines.') + '</p></div>';
    return;
  }
  select.disabled = false;
  if (!matches.some(question => question.id === currentId)) currentId = matches[0].id;
  select.innerHTML = matches.map(question => '<option value="' + question.id + '"' +
    (question.id === currentId ? ' selected' : '') + '>' + escapeHTML(text(question.title)) + '</option>').join('');
  saveState();
  drawSources();
}

export function renderGuidelineComparison() {
  const host = document.getElementById('recommendations');
  if (!host) return;
  loadState();
  host.classList.remove('community', 'list');
  host.innerHTML = '<section class="gcomp" aria-labelledby="gcompTitle"><header class="gcomp-intro">' +
    '<span class="gcomp-eyebrow">Protocolum · ' + t('Leitura em contexto', 'Reading in context') +
    '</span><h1 id="gcompTitle">' + t('Uma pergunta. Mais de uma perspectiva.', 'One question. More than one perspective.') +
    '</h1><p>' + t('Compare recomendações por população, critérios e evidência, com acesso direto às fontes.',
      'Compare recommendations by population, criteria and evidence, with direct access to sources.') +
    '</p></header><section class="gcomp-controls" aria-label="' + t('Escolher comparação', 'Choose comparison') +
    '"><label for="gcompSearch">' + t('Buscar pergunta clínica', 'Search clinical questions') +
    '</label><input type="search" id="gcompSearch" maxlength="160" placeholder="' +
    t('Ex.: diabetes, renal, ICFEp…', 'E.g. diabetes, kidney, HFpEF…') + '" value="' + escapeHTML(query) +
    '"><label for="gcompQuestion">' + t('Pergunta cadastrada', 'Curated question') +
    '</label><select id="gcompQuestion"></select><fieldset id="gcompSources"></fieldset></section>' +
    '<section id="gcompResults" aria-label="' + t('Resultado da comparação', 'Comparison results') + '"></section></section>';
  document.getElementById('gcompSearch').addEventListener('input', event => { query = event.target.value; drawPicker(); });
  document.getElementById('gcompQuestion').addEventListener('change', event => {
    currentId = event.target.value;
    saveState();
    drawSources();
  });
  drawPicker();
}

window.renderGuidelineComparison = renderGuidelineComparison;
const active = () => document.querySelector('.nav-btn.active')?.dataset.section === 'Comparador';
// Ignore repeated assignments: translation and rendering must not form a loop.
let renderedLanguage = language();
new MutationObserver(() => {
  const nextLanguage = language();
  if (nextLanguage === renderedLanguage) return;
  renderedLanguage = nextLanguage;
  if (active()) renderGuidelineComparison();
})
  .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
// Covers restoring the route before this deferred module has finished loading.
if (active()) renderGuidelineComparison();
