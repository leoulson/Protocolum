(function(){
  const STORAGE_KEY = 'clinicalmind.pubmed.library.v1';
  const DAY = 24 * 60 * 60 * 1000;
  const MAX_RECORDS = 30;
  const QUERY = '(("Practice Guideline"[Publication Type] OR "Guideline"[Publication Type] OR "Randomized Controlled Trial"[Publication Type] OR "Systematic Review"[Publication Type]) AND (heart failure[Title/Abstract] OR cardiovascular[Title/Abstract] OR kidney[Title/Abstract] OR diabetes[Title/Abstract] OR stroke[Title/Abstract] OR asthma[Title/Abstract] OR COPD[Title/Abstract] OR hypertension[Title/Abstract]) AND ("last 365 days"[dp]))';
  const byId = id => document.getElementById(id);
  const lang = () => document.documentElement.lang === 'en';
  let records = [];
  let busy = false;
  function readCache() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (value && Array.isArray(value.records)) {
        records = value.records.filter(x => x && typeof x.id === 'string' && x.id.startsWith('pubmed-'));
        return { checkedAt: Number(value.checkedAt) || 0 };
      }
    } catch (_) {}
    return { checkedAt: 0 };
  }
  function saveCache(checkedAt) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ checkedAt, records })); } catch (_) {}
  }
  function status(message) {
    const node = byId('libraryAutoStatus');
    if (node) node.textContent = message;
  }
  function formatDate(time) {
    if (!time) return lang() ? 'never' : 'ainda não';
    return new Intl.DateTimeFormat(lang() ? 'en-US' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time));
  }
  function report(message) {
    const cache = readCache();
    const prefix = lang() ? 'PubMed auto-sync' : 'Sincronização PubMed';
    const count = lang() ? records.length + ' records' : records.length + ' registros';
    status(prefix + ': ' + message + (records.length ? ' · ' + count : '') + (cache.checkedAt ? ' · ' + (lang() ? 'checked ' : 'verificado ') + formatDate(cache.checkedAt) : ''));
  }
  function xmlText(node, selector) {
    const el = node.querySelector(selector);
    return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';
  }
  function parseArticles(xmlTextValue) {
    const doc = new DOMParser().parseFromString(xmlTextValue, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid PubMed XML');
    return Array.from(doc.querySelectorAll('PubmedArticle')).map(article => {
      const medline = article.querySelector('MedlineCitation');
      const source = article.querySelector('Article');
      if (!medline || !source) return null;
      const pmid = xmlText(medline, 'PMID');
      const title = xmlText(source, 'ArticleTitle');
      if (!pmid || !title) return null;
      const journal = xmlText(source, 'Journal Title') || 'PubMed';
      const dateNode = source.querySelector('JournalIssue PubDate');
      const year = dateNode ? (xmlText(dateNode, 'Year') || (xmlText(dateNode, 'MedlineDate').match(/\d{4}/) || [''])[0]) : '';
      const authors = Array.from(source.querySelectorAll('Author')).slice(0, 3).map(a => [xmlText(a, 'LastName'), xmlText(a, 'Initials')].filter(Boolean).join(' ')).filter(Boolean);
      const abstract = Array.from(source.querySelectorAll('Abstract AbstractText')).map(part => {
        const label = part.getAttribute('Label');
        return (label ? label + ': ' : '') + part.textContent.trim();
      }).filter(Boolean).join('\n\n') || 'Abstract not available in PubMed. Open the source record for full details.';
      const types = Array.from(source.querySelectorAll('PublicationType')).map(x => x.textContent.trim());
      const guideline = types.some(type => /guideline/i.test(type));
      return {
        id: 'pubmed-' + pmid, society: 'PubMed', title,
        cid: '—', scenario: 'Não especificado', population: 'Consulte a fonte original',
        strength: 'Registro bibliográfico · revisar', evidence: guideline ? 'Registro indexado como diretriz' : 'Registro bibliográfico',
        contentLabel: 'Resumo do registro PubMed', abstract,
        sections: ['Literatura', 'Referências'], sourceDate: year || 'Data na fonte',
        sourceTitle: (authors.length ? authors.join(', ') + '. ' : '') + journal + (year ? '. ' + year : '') + '. PMID: ' + pmid,
        sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(pmid) + '/',
        evidenceGap: 'Descoberta automática no PubMed. A indexação não confirma que o conteúdo esteja vigente, seja uma diretriz oficial ou se aplique ao contexto local. Confira o texto integral, população, métodos, conflitos e recomendações na fonte original.'
      };
    }).filter(Boolean);
  }
  function mergeIntoSite() {
    if (!Array.isArray(window.clinicalMindLibrary)) return;
    const library = window.clinicalMindLibrary;
    const curated = library.filter(item => !String(item.id).startsWith('pubmed-'));
    const ids = new Set(curated.map(item => item.id));
    const discovered = records.filter(item => !ids.has(item.id));
    library.splice(0, library.length, ...curated, ...discovered);
    // Refresh library views without interrupting a comparison, case or appraisal form.
    const section = document.querySelector('.nav-btn.active')?.dataset.section;
    const libraryViews = ['Início', 'Diretrizes', 'Literatura', 'Favoritos', 'Alertas', 'Referências', 'Histórico', 'Lacunas de Evidência'];
    if (libraryViews.includes(section) && typeof window.clinicalMindRenderList === 'function') window.clinicalMindRenderList();
  }
  async function fetchText(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/xml, application/json' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return await response.text();
    } finally { clearTimeout(timer); }
  }
  async function sync(force) {
    const cache = readCache();
    if (busy || (!force && cache.checkedAt && Date.now() - cache.checkedAt < DAY)) return;
    busy = true;
    const button = byId('refreshLibrary');
    if (button) { button.disabled = true; button.textContent = lang() ? 'Updating…' : 'Atualizando…'; }
    status(lang() ? 'Connecting to NCBI PubMed…' : 'Conectando ao PubMed/NCBI…');
    try {
      const params = new URLSearchParams({ db: 'pubmed', term: QUERY, retmode: 'json', retmax: String(MAX_RECORDS), sort: 'date' });
      const searchText = await fetchText('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?' + params);
      const ids = JSON.parse(searchText).esearchresult?.idlist || [];
      if (!ids.length) {
        records = [];
      } else {
        const fetchParams = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'xml' });
        const xml = await fetchText('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?' + fetchParams);
        records = parseArticles(xml).slice(0, MAX_RECORDS);
      }
      saveCache(Date.now());
      mergeIntoSite();
      report(lang() ? 'updated from NCBI' : 'atualizado pelo NCBI');
    } catch (error) {
      report(lang() ? 'offline; showing saved records' : 'indisponível; exibindo registros salvos');
      console.warn('Protocolum PubMed sync failed:', error);
    } finally {
      busy = false;
      if (button) { button.disabled = false; button.textContent = lang() ? 'Refresh PubMed' : 'Atualizar PubMed'; }
    }
  }
  function init() {
    const app = byId('app');
    let started = false;
    const startWhenAvailable = () => {
      if (started || !app || app.hidden) return;
      started = true;
      readCache();
      mergeIntoSite();
      report(lang() ? 'ready' : 'pronto');
      const button = byId('refreshLibrary');
      if (button) button.addEventListener('click', () => sync(true));
      sync(false);
      setInterval(() => sync(false), 6 * 60 * 60 * 1000);
    };
    startWhenAvailable();
    if (app && !started) {
      const observer = new MutationObserver(() => {
        startWhenAvailable();
        if (started) observer.disconnect();
      });
      observer.observe(app, { attributes: true, attributeFilter: ['hidden'] });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
