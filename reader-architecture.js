// Reorganiza a ficha de leitura existente sem duplicar ou reescrever seu conteúdo clínico.
// A observação fica restrita ao painel de leitura; mudanças na conta não acionam este módulo.
const body = document.getElementById('detailBody');
const titleNode = document.getElementById('detailTitle');
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const english = () => document.documentElement.lang.toLowerCase().startsWith('en');
const localize = text => window.clinicalMindTranslate?.(text) || text;
const text = (pt, en) => english() ? en : pt;
let selectedCompareId = '';
let selectedCompareFor = '';
let sectionObserver;
let responsiveHandler;

function getCurrentGuideline() {
  return window.clinicalMindGetGuideline?.(titleNode?.dataset.guidelineId);
}

function relatedDefault(current) {
  const ids = ['ckd', 'gap-ckd-focused-update', 'empa-kidney'];
  return ids.includes(current?.id) ? 'cvd-ckd' : current?.id === 'cvd-ckd' ? 'ckd' : 'cvd-ckd';
}

function getSectionTitle(section) {
  return section.querySelector('.reading-section-label')?.textContent?.trim()
    || section.querySelector('h2,h3,h4')?.textContent?.trim()
    || section.querySelector('.reading-note b')?.textContent?.trim()
    || text('Seção da diretriz', 'Guideline section');
}

function buildReader() {
  if (!body || !body.querySelector('#readerSummary') || body.querySelector('.reader-architecture')) return;
  const current = getCurrentGuideline();
  const sourceNodes = Array.from(body.children);
  const toolbar = sourceNodes.find(node => node.matches('.reader-tools'));
  const searchResult = sourceNodes.find(node => node.matches('.reader-search-result'));
  const sections = [];
  sourceNodes.forEach(node => {
    if (node.matches('section')) sections.push(node);
    else if (node.matches('.reading-context')) {
      const section = document.createElement('section');
      section.className = 'reader-context-section';
      const heading = document.createElement('div');
      heading.className = 'reading-section-label';
      heading.textContent = text('Contexto clínico', 'Clinical context');
      section.append(heading, node);
      sourceNodes[sourceNodes.indexOf(node)] = section;
      sections.push(section);
    } else if (node.matches('.reader-notes-wrap,.reading-note')) {
      const section = document.createElement('section');
      section.className = 'reader-topic-section';
      section.append(node);
      sourceNodes[sourceNodes.indexOf(node)] = section;
      sections.push(section);
    }
  });

  sections.forEach((section, index) => {
    section.dataset.readerSection = '';
    section.id = `readerSection${index + 1}`;
    section.setAttribute('tabindex', '-1');
    section.setAttribute('aria-label', getSectionTitle(section));
  });

  const area = current?.cid === 'N18' ? text('Nefrologia', 'Nephrology') : text('Biblioteca clínica', 'Clinical library');
  const topic = current?.cid === 'N18' ? 'DRC' : current?.cid || text('Diretriz', 'Guideline');
  const currentTitle = localize(current?.title || titleNode.textContent.trim());
  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'reader-breadcrumbs';
  breadcrumb.setAttribute('aria-label', 'breadcrumb');
  breadcrumb.innerHTML = `<ol><li><span>${html(text('Biblioteca Clínica', 'Clinical Library'))}</span></li><li><span>${html(area)}</span></li><li><span>${html(topic)}</span></li><li aria-current="page"><span>${html(currentTitle)}</span></li></ol>`;

  const chrome = document.createElement('header');
  chrome.className = 'reader-architecture-head';
  chrome.innerHTML = `<div><p>${html(text('Leitura estruturada', 'Structured reading'))}</p><button class="btn reader-compare-toggle" type="button" aria-pressed="false">${html(text('Modo Comparação (Split-Screen)', 'Comparison mode (split screen)'))}</button></div>`;

  const layout = document.createElement('div');
  layout.className = 'reader-layout';
  const toc = document.createElement('aside');
  toc.className = 'reader-toc';
  toc.innerHTML = `<details class="reader-toc-details" open><summary>${html(text('Índice desta diretriz', 'Guideline contents'))}</summary><nav aria-label="${html(text('Tópicos da diretriz', 'Guideline topics'))}"><ol>${sections.map((section, index) => `<li><a href="#${section.id}" data-toc="${section.id}">${html(getSectionTitle(section))}</a></li>`).join('')}</ol></nav></details>`;

  // The overall page already has its single <main>; use a labeled section inside the modal.
  const main = document.createElement('section');
  main.className = 'reader-main';
  main.setAttribute('aria-label', text('Texto da diretriz', 'Guideline text'));
  const article = document.createElement('article');
  article.className = 'reader-document';
  article.setAttribute('aria-label', currentTitle);
  if (toolbar) article.append(toolbar);
  if (searchResult) article.append(searchResult);
  sourceNodes.forEach(node => {
    if (node === toolbar || node === searchResult) return;
    article.append(node);
  });
  main.append(article);

  const compare = document.createElement('article');
  compare.className = 'reader-compare-column';
  compare.hidden = true;
  compare.setAttribute('aria-label', text('Diretriz complementar', 'Complementary guideline'));
  layout.append(toc, main, compare);

  const architecture = document.createElement('div');
  architecture.className = 'reader-architecture';
  architecture.dataset.readerArchitecture = 'true';
  architecture.append(breadcrumb, chrome, layout);
  body.replaceChildren(architecture);

  toc.querySelectorAll('[data-toc]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    body.querySelector(`#${CSS.escape(link.dataset.toc)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (matchMedia('(max-width: 760px)').matches) toc.querySelector('details').open = false;
  }));

  chrome.querySelector('.reader-compare-toggle').addEventListener('click', event => {
    const enabled = !layout.classList.contains('is-comparing');
    layout.classList.toggle('is-comparing', enabled);
    compare.hidden = !enabled;
    event.currentTarget.setAttribute('aria-pressed', String(enabled));
    event.currentTarget.textContent = enabled
      ? text('Fechar comparação', 'Close comparison')
      : text('Modo Comparação (Split-Screen)', 'Comparison mode (split screen)');
    if (enabled) {
      if (selectedCompareFor !== current?.id) {
        selectedCompareId = relatedDefault(current);
        selectedCompareFor = current?.id || '';
      }
      renderCompare(compare, selectedCompareId, current);
      requestAnimationFrame(() => sectionObserver?.takeRecords());
    }
  });

  installObserver(sections, toc);
  const details = toc.querySelector('details');
  if (matchMedia('(max-width: 760px)').matches) details.open = false;
  if (responsiveHandler) window.removeEventListener('resize', responsiveHandler);
  responsiveHandler = () => {
    if (!document.querySelector('.reader-architecture')) return;
    if (matchMedia('(max-width: 760px)').matches) details.open = false;
    else details.open = true;
  };
  window.addEventListener('resize', responsiveHandler, { passive: true });
}

function renderCompare(target, selectedId, current) {
  const list = window.clinicalMindListGuidelines?.() || [];
  const options = list.filter(item => item.id !== current?.id);
  const selected = options.find(item => item.id === selectedId) || options[0];
  if (!selected) {
    target.innerHTML = `<p>${html(text('Não há outra ficha disponível para comparar.', 'No other entry is available for comparison.'))}</p>`;
    return;
  }
  selectedCompareId = selected.id;
  selectedCompareFor = current?.id || '';
  target.innerHTML = `<label class="reader-compare-select">${html(text('Comparar com', 'Compare with'))}<select aria-label="${html(text('Selecionar ficha complementar', 'Select complementary entry'))}">${options.map(item => `<option value="${html(item.id)}" ${item.id === selected.id ? 'selected' : ''}>${html(localize(item.title))}</option>`).join('')}</select></label>
    <div class="reader-compare-card"><div class="reader-compare-meta">${html(localize(selected.society))} · ${html(selected.cid)} · ${html(selected.sourceDate)}</div><h3>${html(localize(selected.title))}</h3><p>${html(localize(selected.abstract))}</p>${selected.evidenceGap ? `<section class="reader-compare-gap"><h4>${html(text('Limite / lacuna de evidência', 'Evidence limitation / gap'))}</h4><p>${html(localize(selected.evidenceGap))}</p></section>` : ''}<a class="reading-source" href="${html(selected.sourceUrl)}" target="_blank" rel="noopener noreferrer">↗ ${html(text('Abrir fonte complementar', 'Open complementary source'))}</a></div>`;
  target.querySelector('select').addEventListener('change', event => renderCompare(target, event.currentTarget.value, current));
}

function installObserver(sections, toc) {
  sectionObserver?.disconnect();
  const links = Array.from(toc.querySelectorAll('[data-toc]'));
  if (!('IntersectionObserver' in window)) return;
  sectionObserver = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => {
      const active = link.dataset.toc === visible.target.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, { root: body, rootMargin: '-10% 0px -72% 0px', threshold: 0 });
  sections.forEach(section => sectionObserver.observe(section));
}

const contentObserver = new MutationObserver(() => {
  if (body?.querySelector('#readerSummary') && !body.querySelector('.reader-architecture')) buildReader();
  else if (body && !body.querySelector('.reader-architecture')) {
    sectionObserver?.disconnect();
    if (responsiveHandler) window.removeEventListener('resize', responsiveHandler);
    responsiveHandler = undefined;
  }
});
if (body) contentObserver.observe(body, { childList: true });

document.getElementById('appLanguage')?.addEventListener('click', () => {
  requestAnimationFrame(() => {
    const layout = body?.querySelector('.reader-layout');
    if (!layout) return;
    const button = body.querySelector('.reader-compare-toggle');
    button.textContent = layout.classList.contains('is-comparing')
      ? text('Fechar comparação', 'Close comparison')
      : text('Modo Comparação (Split-Screen)', 'Comparison mode (split screen)');
    const toc = body.querySelector('.reader-toc');
    toc.querySelector('summary').textContent = text('Índice desta diretriz', 'Guideline contents');
    toc.querySelector('nav').setAttribute('aria-label', text('Tópicos da diretriz', 'Guideline topics'));
    toc.querySelectorAll('[data-toc]').forEach(link => {
      const section = body.querySelector(`#${CSS.escape(link.dataset.toc)}`);
      link.textContent = section ? localize(getSectionTitle(section)) : link.textContent;
    });
    const current = getCurrentGuideline();
    body.querySelector('.reader-breadcrumbs').innerHTML = `<ol><li><span>${html(text('Biblioteca Clínica', 'Clinical Library'))}</span></li><li><span>${html(current?.cid === 'N18' ? text('Nefrologia', 'Nephrology') : text('Biblioteca clínica', 'Clinical library'))}</span></li><li><span>${html(current?.cid === 'N18' ? 'DRC' : current?.cid || text('Diretriz', 'Guideline'))}</span></li><li aria-current="page"><span>${html(localize(current?.title || titleNode.textContent.trim()))}</span></li></ol>`;
    if (layout.classList.contains('is-comparing')) renderCompare(body.querySelector('.reader-compare-column'), selectedCompareId, current);
  });
});
