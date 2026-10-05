// Busca PubMed em duas etapas (ESearch + ESummary) e mantém a avaliação no dispositivo.
const API = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const DEFAULT_QUERY = 'heart failure AND (SGLT2 OR dapagliflozin OR empagliflozin)';
const CACHE_MS = 5 * 60 * 1000;
// Optional: set window.CLINICALMIND_NCBI_EMAIL to the developer's registered contact email.
// Do not put an end-user email or an NCBI API key in this public client-side application.
const CONTACT_EMAIL = window.CLINICALMIND_NCBI_EMAIL || '';
const cache = new Map();
let articles = [];
let selectedPmid = '';
let activeController;

const copy = {
  pt: {
    title: 'Feed de Novas Evidências', intro: 'Encontre artigos recentes no PubMed e registre uma leitura metodológica estruturada.',
    query: 'Termo de busca', search: 'Buscar no PubMed', notice: 'Seu termo de busca será enviado ao PubMed/NCBI. Não inclua dados identificáveis de pacientes.',
    loading: 'Carregando artigos do PubMed…', error: 'Não foi possível consultar o PubMed. Verifique sua conexão e tente novamente.',
    noResults: 'Nenhum artigo encontrado. Tente ampliar ou ajustar os termos.', select: 'Selecione um artigo para iniciar a avaliação crítica.',
    feed: 'Feed de Novas Evidências', appraisal: 'Laboratório de Análise', validity: 'Validade interna', random: 'A randomização foi descrita e adequada?', conceal: 'A ocultação da alocação foi adequada?',
    blinding: 'Cegamento', who: 'Quem foi mascarado?', participants: 'Participantes', team: 'Equipe assistencial', assessors: 'Avaliadores de desfecho',
    stats: 'Análise estatística', itt: 'A análise seguiu intenção de tratar (ITT)?', outcome: 'Desfechos e relevância clínica', primary: 'Desfecho primário e tipo (clínico ou substituto)',
    significant: 'Houve significância estatística (p < 0,05)?', effect: 'Magnitude do efeito (RR, IC 95%, NNT)', notes: 'Anotações', notesPlaceholder: 'Registre sua avaliação metodológica…',
    save: 'Salvar avaliação', saved: 'Avaliação salva neste navegador.', authors: 'Autores', year: 'Ano', journal: 'Fonte / periódico', pubmed: 'Ver no PubMed',
    open: 'Abrir artigo no PubMed', appNote: 'Checklist educacional inspirado no CONSORT e na medicina baseada em evidências. Confirme os métodos no texto integral; os metadados não substituem leitura crítica.'
  },
  en: {
    title: 'New Evidence Feed', intro: 'Find recent PubMed articles and record a structured methodological appraisal.',
    query: 'Search query', search: 'Search PubMed', notice: 'Your search query will be sent to PubMed/NCBI. Do not include patient-identifiable information.',
    loading: 'Loading PubMed articles…', error: 'Could not reach PubMed. Check your connection and try again.',
    noResults: 'No articles found. Try broadening or adjusting your query.', select: 'Select an article to begin critical appraisal.',
    feed: 'New Evidence Feed', appraisal: 'Appraisal Lab', validity: 'Internal validity', random: 'Was randomization described and appropriate?', conceal: 'Was allocation concealment adequate?',
    blinding: 'Blinding', who: 'Who was blinded?', participants: 'Participants', team: 'Care team', assessors: 'Outcome assessors',
    stats: 'Statistical analysis', itt: 'Did the analysis follow intention to treat (ITT)?', outcome: 'Outcomes and clinical relevance', primary: 'Primary outcome and type (clinical or surrogate)',
    significant: 'Was the result statistically significant (p < 0.05)?', effect: 'Effect size (RR, 95% CI, NNT)', notes: 'Notes', notesPlaceholder: 'Write your methodological appraisal…',
    save: 'Save appraisal', saved: 'Appraisal saved in this browser.', authors: 'Authors', year: 'Year', journal: 'Source / journal', pubmed: 'View on PubMed',
    open: 'Open article in PubMed', appNote: 'Educational checklist informed by CONSORT and evidence-based medicine. Verify methods in the full text; metadata cannot replace critical appraisal.'
  }
};
const lang = () => document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'pt';
const t = key => copy[lang()][key];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const reviewKey = pmid => `clinicalmind.pubmed-review.v1.${pmid}`;
const recordURL = pmid => `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/`;

function requestURL(endpoint, params) {
  const url = new URL(endpoint, API);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  // tool is a software identifier; do not send an end-user email or expose API keys in browser code.
  url.searchParams.set('tool', 'Protocolum');
  if (CONTACT_EMAIL) url.searchParams.set('email', CONTACT_EMAIL);
  return url;
}

async function getJSON(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`NCBI HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload;
}

function summaryToArticle(pmid, entry = {}) {
  const authors = Array.isArray(entry.authors) ? entry.authors.map(author => author.name).filter(Boolean) : [];
  const date = String(entry.pubdate || '');
  const year = date.match(/\b(?:19|20)\d{2}\b/)?.[0] || '';
  return {
    pmid,
    title: entry.title || (lang() === 'en' ? 'Title not available' : 'Título indisponível'),
    authors: authors.slice(0, 3).join(', ') + (authors.length > 3 ? ' et al.' : ''),
    journal: entry.fulljournalname || entry.source || '', year, pubdate: date
  };
}

async function searchPubMed(query, signal) {
  const normalized = query.trim();
  const cached = cache.get(normalized.toLocaleLowerCase());
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.articles;
  const searchURL = requestURL('esearch.fcgi', {
    db: 'pubmed', term: normalized, retmax: '5', sort: 'date', retmode: 'json'
  });
  const searchData = await getJSON(searchURL, signal);
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) return [];
  // Leave a small gap between the two E-utilities calls and stay well below NCBI's per-IP ceiling.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 400);
    signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  const summaryURL = requestURL('esummary.fcgi', {
    db: 'pubmed', id: ids.join(','), retmode: 'json'
  });
  const summaryData = await getJSON(summaryURL, signal);
  const result = summaryData.result || {};
  const found = (result.uids || ids).map(id => summaryToArticle(id, result[id])).filter(article => article.pmid);
  cache.set(normalized.toLocaleLowerCase(), { time: Date.now(), articles: found });
  return found;
}

function getSavedReview(pmid) {
  try {
    const data = JSON.parse(localStorage.getItem(reviewKey(pmid)) || 'null');
    return data && typeof data === 'object' ? data : {};
  } catch { return {}; }
}

function renderArticleList() {
  const target = document.getElementById('pmlResults');
  if (!target) return;
  if (!articles.length) {
    target.innerHTML = `<div class="pml-empty">${escapeHTML(t('noResults'))}</div>`;
    return;
  }
  target.innerHTML = articles.map(article => `
    <button class="pml-card" type="button" data-pmid="${escapeHTML(article.pmid)}" aria-pressed="${selectedPmid === article.pmid}">
      <h4>${escapeHTML(article.title)}</h4>
      <p><strong>${escapeHTML(t('authors'))}:</strong> ${escapeHTML(article.authors || '—')}</p>
      <p><strong>${escapeHTML(t('journal'))}:</strong> ${escapeHTML(article.journal || '—')} ${article.year ? `· ${escapeHTML(article.year)}` : ''}</p>
      <p><a href="${recordURL(article.pmid)}" target="_blank" rel="noopener noreferrer" data-external>${escapeHTML(t('pubmed'))} · PMID ${escapeHTML(article.pmid)}</a></p>
    </button>`).join('');
  target.querySelectorAll('[data-pmid]').forEach(button => {
    button.addEventListener('click', event => {
      if (event.target.closest('[data-external]')) return;
      selectedPmid = button.dataset.pmid;
      renderArticleList();
      renderAnalysis();
    });
  });
}

function renderAnalysis() {
  const panel = document.getElementById('pmlAnalysis');
  if (!panel) return;
  const article = articles.find(item => item.pmid === selectedPmid);
  if (!article) {
    panel.innerHTML = `<div class="pml-empty">${escapeHTML(t('select'))}</div>`;
    return;
  }
  const saved = getSavedReview(article.pmid);
  const checked = name => saved[name] ? 'checked' : '';
  const value = name => escapeHTML(saved[name] || '');
  panel.innerHTML = `
    <div class="pml-meta">PMID ${escapeHTML(article.pmid)} · <a href="${recordURL(article.pmid)}" target="_blank" rel="noopener noreferrer">${escapeHTML(t('open'))} ↗</a></div>
    <h3>${escapeHTML(t('appraisal'))}</h3><h4>${escapeHTML(article.title)}</h4>
    <form id="pmlReviewForm">
      <section><h4>${escapeHTML(t('validity'))}</h4><div class="pml-checks">
        <label class="pml-check"><input type="checkbox" name="randomization" ${checked('randomization')}>${escapeHTML(t('random'))}</label>
        <label class="pml-check"><input type="checkbox" name="concealment" ${checked('concealment')}>${escapeHTML(t('conceal'))}</label>
      </div></section>
      <section><h4>${escapeHTML(t('blinding'))}</h4><p class="pml-muted">${escapeHTML(t('who'))}</p><div class="pml-checks">
        <label class="pml-check"><input type="checkbox" name="blindParticipants" ${checked('blindParticipants')}>${escapeHTML(t('participants'))}</label>
        <label class="pml-check"><input type="checkbox" name="blindTeam" ${checked('blindTeam')}>${escapeHTML(t('team'))}</label>
        <label class="pml-check"><input type="checkbox" name="blindAssessors" ${checked('blindAssessors')}>${escapeHTML(t('assessors'))}</label>
      </div></section>
      <section><h4>${escapeHTML(t('stats'))}</h4><label class="pml-check"><input type="checkbox" name="itt" ${checked('itt')}>${escapeHTML(t('itt'))}</label></section>
      <section><h4>${escapeHTML(t('outcome'))}</h4>
        <label class="pml-field">${escapeHTML(t('primary'))}<textarea name="primaryOutcome" maxlength="2000">${value('primaryOutcome')}</textarea></label>
        <label class="pml-check"><input type="checkbox" name="significant" ${checked('significant')}>${escapeHTML(t('significant'))}</label>
        <label class="pml-field">${escapeHTML(t('effect'))}<input name="effect" maxlength="500" value="${value('effect')}"></label>
      </section>
      <label class="pml-field">${escapeHTML(t('notes'))}<textarea name="notes" maxlength="5000" placeholder="${escapeHTML(t('notesPlaceholder'))}">${value('notes')}</textarea></label>
      <button class="btn primary pml-save" type="submit">${escapeHTML(t('save'))}</button>
      <div class="pml-status" id="pmlSaveStatus" role="status" aria-live="polite"></div>
    </form>
    <p class="pml-notice">${escapeHTML(t('appNote'))} ${escapeHTML(lang() === 'en' ? 'Do not enter patient-identifiable information.' : 'Não registre informações que identifiquem pacientes.')}</p>`;
  panel.querySelector('#pmlReviewForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const statusEl = panel.querySelector('#pmlSaveStatus');

    if (!window.clinicalMindUser) {
      statusEl.textContent = lang() === 'en' ? 'Please log in with Google to save your appraisal.' : 'Por favor, faa login com o Google para salvar.';
      statusEl.style.color = '#ff8d9e';
      return;
    }
    
    statusEl.textContent = lang() === 'en' ? 'Saving to cloud...' : 'Salvando na nuvem...';
    statusEl.style.color = '#8fcfff';
    
    const data = Object.fromEntries(new FormData(form).entries());
    form.querySelectorAll('input[type="checkbox"]').forEach(input => { data[input.name] = input.checked; });
    const review = { version: 1, pmid: article.pmid, updatedAt: new Date().toISOString(), ...data };
    
    try {
      localStorage.setItem(reviewKey(article.pmid), JSON.stringify(review));
      if (window.savePubMedToCloud) {
         await window.savePubMedToCloud(article.pmid, review);
      }
      statusEl.textContent = t('saved') + ' (Cloud)';
      statusEl.style.color = '#39d9a0';
    } catch (e) {
      statusEl.textContent = lang() === 'en' ? 'Could not save to cloud.' : 'Erro ao salvar na nuvem: ' + e.message;
      statusEl.style.color = '#ff8d9e';
    }
  });
}

function renderShell() {
  const root = document.getElementById('recommendations');
  root.innerHTML = `
    <section class="pml-wrap" aria-label="${escapeHTML(t('appraisal'))}">
      <header class="pml-intro"><h2>${escapeHTML(t('title'))}</h2><p>${escapeHTML(t('intro'))}</p>
        <form class="pml-search" id="pmlSearchForm">
          <label>${escapeHTML(t('query'))}<input id="pmlQuery" name="query" type="search" required maxlength="400" value="${escapeHTML(DEFAULT_QUERY)}" placeholder="${escapeHTML(lang() === 'en' ? 'e.g., hypertension AND randomized trial' : 'ex.: hipertensão AND ensaio clínico')}" autocomplete="off"></label>
          <label>${escapeHTML(lang() === 'en' ? 'Year' : 'Ano')}<select id="pmlYear" name="year">
            <option value="">${escapeHTML(lang() === 'en' ? 'Any' : 'Qualquer')}</option>
            <option value="1">${escapeHTML(lang() === 'en' ? 'Last 1 year' : 'Último 1 ano')}</option>
            <option value="5">${escapeHTML(lang() === 'en' ? 'Last 5 years' : 'Últimos 5 anos')}</option>
            <option value="10">${escapeHTML(lang() === 'en' ? 'Last 10 years' : 'Últimos 10 anos')}</option>
          </select></label>
          <label>${escapeHTML(lang() === 'en' ? 'Study Type' : 'Tipo')}<select id="pmlType" name="type">
            <option value="">${escapeHTML(lang() === 'en' ? 'Any' : 'Qualquer')}</option>
            <option value="randomized controlled trial[pt]">${escapeHTML(lang() === 'en' ? 'Clinical Trial' : 'Ensaio Clínico')}</option>
            <option value="systematic review[pt]">${escapeHTML(lang() === 'en' ? 'Systematic Review' : 'Revisão Sistemática')}</option>
            <option value="meta-analysis[pt]">${escapeHTML(lang() === 'en' ? 'Meta-Analysis' : 'Meta-análise')}</option>
          </select></label>
          <button class="btn primary" id="pmlSearchButton" type="submit">${escapeHTML(t('search'))}</button>
        </form>
        <p class="pml-notice">${escapeHTML(t('notice'))}</p>
      </header>
      <div class="pml-status" id="pmlStatus" role="status" aria-live="polite"></div>
      <div class="pml-grid"><section class="pml-panel pml-feed"><h3>${escapeHTML(t('feed'))}</h3><div class="pml-feed-list" id="pmlResults"><div class="pml-empty">${escapeHTML(t('loading'))}</div></div></section>
      <aside class="pml-panel pml-analysis" id="pmlAnalysis"><div class="pml-empty">${escapeHTML(t('select'))}</div></aside></div>
    </section>`;
  document.getElementById('pmlSearchForm').addEventListener('submit', runSearch);
}

async function runSearch(event) {
  event?.preventDefault();
  let query = document.getElementById('pmlQuery').value.trim();
  const yearFilter = document.getElementById('pmlYear')?.value;
  const typeFilter = document.getElementById('pmlType')?.value;
  const status = document.getElementById('pmlStatus');
  const button = document.getElementById('pmlSearchButton');
  
  if (!query) return;

  if (yearFilter) {
    query += ` AND "last ${yearFilter} years"[dp]`;
  }
  if (typeFilter) {
    query += ` AND ${typeFilter}`;
  }

  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  button.disabled = true;
  status.textContent = t('loading');
  document.getElementById('pmlResults').innerHTML = `<div class="pml-empty">${escapeHTML(t('loading'))}</div>`;
  try {
    articles = await searchPubMed(query, controller.signal);
    selectedPmid = articles[0]?.pmid || '';
    renderArticleList();
    renderAnalysis();
    status.textContent = '';
  } catch (error) {
    if (error.name !== 'AbortError') {
      articles = [];
      selectedPmid = '';
      renderArticleList();
      renderAnalysis();
      status.textContent = `${t('error')} ${error.message === 'Failed to fetch' ? '' : `(${error.message})`}`;
    }
  } finally {
    if (activeController === controller) button.disabled = false;
  }
}

window.renderPubMedLab = () => {
  renderShell();
  runSearch();
};

// Rebuild the visible interface when the user switches Portuguese/English while this tab is open.
document.getElementById('appLanguage')?.addEventListener('click', () => {
  if (document.querySelector('.nav-btn.active')?.dataset.section === 'Laboratório PubMed') {
    const query = document.getElementById('pmlQuery')?.value || DEFAULT_QUERY;
    renderShell();
    document.getElementById('pmlQuery').value = query;
    if (articles.length) { renderArticleList(); renderAnalysis(); }
    else runSearch();
  }
});
