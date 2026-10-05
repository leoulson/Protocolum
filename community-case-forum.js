// Fórum de caso simulado: conteúdo, publicações e votos ficam no navegador.
const POSTS_KEY = 'clinicalmind.community.case-posts.v1';
const VOTES_KEY = 'clinicalmind.community.case-votes.v1';
const isEnglish = () => document.documentElement.lang.toLowerCase().startsWith('en');
const t = (pt, en) => isEnglish() ? en : pt;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

// Três contribuições de demonstração são fixas e não são persistidas como dados de usuários.
const examplePosts = [
  {
    id: 'sample-cardiorenal-1', demo: true, author: 'Dra. Marina · Cardiologia',
    assessment: 'Quadro compatível com insuficiência cardíaca com fração de ejeção reduzida e congestão. A DRC é G3b/A3 pelos dados informados; considerar também fibrilação atrial como fator de descompensação e investigar etiologia isquêmica.',
    plan: 'Após estabilização clínica, discutir início precoce e progressivo dos pilares de ICFEr, com monitoramento de pressão, potássio e função renal. Descongestão deve ser individualizada; reavaliar volemia e resposta. Na DRC, confirmar tendência de eGFR/albuminúria e revisar fármacos nefrotóxicos.',
    reference: 'AHA/ACC/HFSA 2022; KDIGO 2024 CKD Guideline', createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'sample-cardiorenal-2', demo: true, author: 'Rafael · Residente',
    assessment: 'Diferenciais para a piora: progressão de cardiomiopatia, isquemia e controle inadequado da frequência na fibrilação atrial. A elevação de BNP apoia congestão no contexto, mas deve ser interpretada considerando a função renal e o quadro clínico.',
    plan: 'Eu complementaria a avaliação etiológica e revisaria ECG, ecocardiograma e exames prévios. A introdução de betabloqueador deve considerar estabilidade hemodinâmica; para ARM, os limiares de eGFR e potássio e a monitorização laboratorial são centrais.',
    reference: 'AHA/ACC/HFSA 2022 Heart Failure Guideline', createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
  },
  {
    id: 'sample-cardiorenal-3', demo: true, author: 'Dra. Camila · Nefrologia',
    assessment: 'O fenótipo renal requer causa, cronicidade e estratificação por eGFR e albuminúria. Uma medida isolada de creatinina não define trajetória; os dados do caso descrevem cronicidade, mas a etiologia ainda precisa ser investigada.',
    plan: 'Conferiria tendência da relação albumina/creatinina urinária e eGFR, pressão arterial, eletrólitos e revisão medicamentosa. Discutiria cuidado cardiorrenal integrado e reavaliação após mudanças terapêuticas, sem interpretar a creatinina isoladamente.',
    reference: 'KDIGO 2024 Clinical Practice Guideline for CKD', createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
  }
];

function carregarComentarios() {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => item && typeof item.id === 'string'
      && typeof item.assessment === 'string' && typeof item.plan === 'string'
      && typeof item.reference === 'string' && Number.isFinite(Date.parse(item.createdAt))).slice(0, 100);
  } catch { return []; }
}

function carregarVotos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function salvarComentario(comment) {
  const posts = carregarComentarios();
  posts.unshift(comment);
  localStorage.setItem(POSTS_KEY, JSON.stringify(posts.slice(0, 100)));
}

function nomeAutor() {
  const user = window.clinicalMindCurrentUser?.();
  return user?.name || t('Participante Protocolum', 'Protocolum participant');
}

function formatDate(date) {
  return new Intl.DateTimeFormat(isEnglish() ? 'en-US' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
}

function renderizarComentario(comment, votes) {
  const support = Array.isArray(votes[comment.id]?.supported) ? votes[comment.id].supported : [];
  const citation = Array.isArray(votes[comment.id]?.citation) ? votes[comment.id].citation : [];
  const currentId = window.clinicalMindCurrentUser?.()?.email || 'local-participant';
  return `<article class="case-post ${comment.demo ? 'is-demo' : ''}" data-post-id="${esc(comment.id)}">
    <header class="case-post-head"><div><strong>${esc(comment.author || t('Participante', 'Participant'))}</strong>${comment.demo ? `<span class="case-demo-badge">${esc(t('Exemplo simulado', 'Sample post'))}</span>` : ''}</div><time datetime="${esc(comment.createdAt)}">${esc(formatDate(comment.createdAt))}</time></header>
    <section class="case-post-block"><h4>${esc(t('Avaliação e hipóteses', 'Assessment and hypotheses'))}</h4><p>${esc(comment.assessment)}</p></section>
    <section class="case-post-block"><h4>${esc(t('Plano terapêutico', 'Management plan'))}</h4><p>${esc(comment.plan)}</p></section>
    <div class="case-reference"><span aria-hidden="true">↗</span><div><small>${esc(t('Referência bibliográfica', 'Evidence reference'))}</small><strong>${esc(comment.reference)}</strong></div></div>
    <footer class="case-votes"><button type="button" data-vote="supported" data-id="${esc(comment.id)}" aria-pressed="${support.includes(currentId)}">${esc(t('Conduta apoiada pela literatura', 'Supported by the literature'))}<span>${support.length}</span></button><button type="button" data-vote="citation" data-id="${esc(comment.id)}" aria-pressed="${citation.includes(currentId)}">${esc(t('Necessita citação', 'Needs a citation'))}<span>${citation.length}</span></button></footer>
  </article>`;
}

function renderizarFeed(root) {
  const feed = root.querySelector('#caseFeed');
  const votes = carregarVotos();
  const comments = [...carregarComentarios(), ...examplePosts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  feed.innerHTML = comments.map(comment => renderizarComentario(comment, votes)).join('');
  root.querySelector('#casePostCount').textContent = t(`${comments.length} contribuições`, `${comments.length} contributions`);
}

function renderEvidenceCommunity() {
  const root = document.getElementById('recommendations');
  if (!root) return;
  document.getElementById('app')?.classList.add('case-mobile-active');
  root.classList.remove('list');
  root.classList.add('community');
  root.innerHTML = `<section class="case-forum" aria-labelledby="caseForumTitle">
    <header class="case-mobile-header"><button class="case-back" id="caseBack" type="button" aria-label="${esc(t('Voltar à biblioteca', 'Back to library'))}">‹</button><h1>${esc(t('Sessão clínica', 'Clinical session'))}</h1><span class="case-header-spacer"></span></header>
    <nav class="case-bottom-nav" aria-label="${esc(t('Navegação principal', 'Main navigation'))}"><button type="button" data-case-route="Diretrizes"><span aria-hidden="true">▤</span><small>${esc(t('Biblioteca', 'Library'))}</small></button><button type="button" data-case-route="Comunidade" aria-current="page"><span aria-hidden="true">♧</span><small>${esc(t('Casos', 'Cases'))}</small></button><button type="button" data-case-route="Favoritos"><span aria-hidden="true">♡</span><small>${esc(t('Favoritos', 'Favorites'))}</small></button><button type="button" data-case-profile><span aria-hidden="true">♙</span><small>${esc(t('Perfil', 'Profile'))}</small></button></nav>
    <header class="case-forum-hero"><div><span class="case-kicker">${esc(t('SESSÃO CLÍNICA · GRAND ROUNDS', 'CLINICAL SESSION · GRAND ROUNDS'))}</span><h2 id="caseForumTitle">${esc(t('Discussão de caso baseada em evidências', 'Evidence-based case discussion'))}</h2><p>${esc(t('Organize hipóteses, conduta e evidências em uma discussão acadêmica estruturada.', 'Structure diagnostic reasoning, management, and evidence in an academic discussion.'))}</p></div><div class="case-forum-tools"><span class="case-forum-mark" aria-hidden="true">✚</span><button class="btn case-legacy-open" id="openLegacyCommunity" type="button">${esc(t('Mural geral', 'General forum'))}</button></div></header>
    <details class="case-vignette" aria-labelledby="caseTitle" open><summary class="case-vignette-head"><div><span>${esc(t('VINHETA CLÍNICA', 'CLINICAL VIGNETTE'))}</span><h3 id="caseTitle">${esc(t('Caso cardiorrenal: dispneia, congestão e função renal reduzida', 'Cardiorenal case: dyspnea, congestion, and reduced kidney function'))}</h3></div><span class="case-fictional">${esc(t('Caso inteiramente fictício', 'Entirely fictional case'))}</span><span class="case-toggle-copy"><span class="case-open-copy">${esc(t('Ocultar detalhes', 'Hide details'))}</span><span class="case-closed-copy">${esc(t('Ver detalhes do caso', 'View case details'))}</span></span></summary><div class="case-vignette-content">
      <dl class="case-data">
        <div><dt>${esc(t('Identificação', 'Patient profile'))}</dt><dd>${esc(t('Homem, 68 anos; diabetes tipo 2 e hipertensão há mais de 10 anos.', '68-year-old man; type 2 diabetes and hypertension for over 10 years.'))}</dd></div>
        <div><dt>${esc(t('Queixa principal', 'Chief concern'))}</dt><dd>${esc(t('Falta de ar progressiva e inchaço nas pernas.', 'Progressive shortness of breath and leg swelling.'))}</dd></div>
        <div><dt>${esc(t('História da moléstia atual', 'History of present illness'))}</dt><dd>${esc(t('Dispneia aos pequenos esforços há três semanas, ortopneia com dois travesseiros e edema crescente. Sem febre ou dor torácica. DRC previamente documentada por mais de seis meses.', 'Three weeks of dyspnea on mild exertion, two-pillow orthopnea, and increasing edema. No fever or chest pain. CKD previously documented for over six months.'))}</dd></div>
        <div><dt>${esc(t('Exame físico', 'Physical examination'))}</dt><dd>${esc(t('PA 104/68 mmHg; pulso irregular, 92 bpm; SpO₂ 94% em ar ambiente; turgência jugular, estertores bibasais e edema periférico 2+.', 'BP 104/68 mmHg; irregular pulse, 92 bpm; SpO₂ 94% on room air; elevated jugular venous pressure, bibasilar crackles, and 2+ peripheral edema.'))}</dd></div>
        <div><dt>${esc(t('Laboratório', 'Laboratory'))}</dt><dd>${esc(t('Creatinina 1,8 mg/dL; eGFR 38 mL/min/1,73 m²; potássio 4,8 mEq/L; relação albumina/creatinina urinária 420 mg/g; HbA1c 7,2%; NT-proBNP 920 pg/mL.', 'Creatinine 1.8 mg/dL; eGFR 38 mL/min/1.73 m²; potassium 4.8 mEq/L; urine albumin-to-creatinine ratio 420 mg/g; HbA1c 7.2%; NT-proBNP 920 pg/mL.'))}</dd></div>
        <div><dt>${esc(t('Imagem e outros exames', 'Imaging and other tests'))}</dt><dd>${esc(t('ECG: fibrilação atrial. Ecocardiograma: FEVE 35%, hipocinesia global. Radiografia de tórax: congestão intersticial.', 'ECG: atrial fibrillation. Echocardiogram: LVEF 35%, global hypokinesis. Chest X-ray: interstitial congestion.'))}</dd></div>
      </dl><p class="case-question">${esc(t('Questão para discussão: como organizar a avaliação cardiorrenal e uma conduta fundamentada, considerando congestão, ICFEr, DRC e segurança terapêutica?', 'Discussion prompt: how would you organize the cardiorenal assessment and evidence-based management, considering congestion, HFrEF, CKD, and treatment safety?'))}</p>
      <p class="case-safety-note">${esc(t('Exercício educacional fictício. Não use dados reais ou identificáveis de pacientes nesta comunidade local.', 'Fictional educational exercise. Do not enter real or identifiable patient information in this local community.'))}</p>
    </div></details>
    <div class="case-forum-grid"><section class="case-compose" aria-labelledby="caseComposeTitle"><div class="case-section-heading"><div><span class="case-kicker">${esc(t('SUA CONTRIBUIÇÃO', 'YOUR CONTRIBUTION'))}</span><h3 id="caseComposeTitle">${esc(t('Estruture seu raciocínio', 'Structure your reasoning'))}</h3></div></div>
      <form id="casePostForm"><label>${esc(t('Avaliação e hipóteses diagnósticas', 'Assessment and diagnostic hypotheses'))}<textarea name="assessment" minlength="10" maxlength="2400" required placeholder="${esc(t('Sintetize os problemas, hipóteses e dados que sustentam sua avaliação…', 'Summarize the problems, hypotheses, and findings supporting your assessment…'))}"></textarea></label>
        <label>${esc(t('Plano terapêutico (conduta)', 'Management plan'))}<textarea name="plan" minlength="10" maxlength="2400" required placeholder="${esc(t('Descreva próximos passos, prioridades e como monitoraria benefícios e riscos…', 'Describe next steps, priorities, and how you would monitor benefits and risks…'))}"></textarea></label>
        <label>${esc(t('Referência / diretriz que fundamenta a conduta', 'Reference / guideline supporting your plan'))}<input name="reference" type="text" minlength="3" maxlength="240" required placeholder="${esc(t('Ex.: KDIGO 2024; AHA/ACC/HFSA 2022; DAPA-HF', 'e.g., KDIGO 2024; AHA/ACC/HFSA 2022; DAPA-HF'))}"></label>
        <p class="case-form-note">${esc(t('As referências tornam o debate verificável e ajudam a separar evidência, interpretação e preferência clínica.', 'Citations make the discussion verifiable and help distinguish evidence, interpretation, and clinical preference.'))}</p>
        <button class="btn primary case-submit-button" type="submit">${esc(t('Publicar Conduta', 'Post your plan'))}</button><div class="case-status" id="caseStatus" role="status" aria-live="polite"></div>
      </form></section>
      <section class="case-discussion" aria-labelledby="caseDiscussionTitle"><header class="case-section-heading"><div><span class="case-kicker">${esc(t('PEER REVIEW LOCAL', 'LOCAL PEER REVIEW'))}</span><h3 id="caseDiscussionTitle">${esc(t('Discussão da sessão', 'Session discussion'))}</h3></div><span id="casePostCount" class="case-count"></span></header><p class="case-voting-guide">${esc(t('Use os votos para sinalizar apoio baseado em literatura ou pedir uma citação mais clara.', 'Use votes to signal literature-supported reasoning or request a clearer citation.'))}</p><div id="caseFeed" class="case-feed" aria-live="polite"></div></section></div>
    <footer class="case-local-footer">${esc(t('As publicações e os votos são armazenados somente neste navegador e não são compartilhados com outros usuários.', 'Posts and votes are stored only in this browser and are not shared with other users.'))}</footer>
  </section>`;

  const form = root.querySelector('#casePostForm');
  root.querySelector('#openLegacyCommunity').addEventListener('click', () => window.renderLegacyCommunity?.());
  root.querySelector('#caseBack').addEventListener('click', () => document.querySelector('[data-section="Diretrizes"]')?.click());
  root.querySelectorAll('[data-case-route]').forEach(button => button.addEventListener('click', () => {
    document.querySelector(`[data-section="${button.dataset.caseRoute}"]`)?.click();
  }));
  root.querySelector('[data-case-profile]').addEventListener('click', () => document.getElementById('accountBtn')?.click());
  const resizeTextarea = textarea => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 96)}px`;
  };
  root.querySelectorAll('#casePostForm textarea').forEach(textarea => {
    resizeTextarea(textarea);
    textarea.addEventListener('input', () => resizeTextarea(textarea));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!window.clinicalMindUser) {
        root.querySelector('#caseStatus').textContent = t('Por favor, faa login com Google para publicar.', 'Please log in with Google to post.');
        root.querySelector('#caseStatus').style.color = '#ff8d9e';
        return;
    }
    const { assessment, plan, reference } = Object.fromEntries(new FormData(form).entries());
    const comment = {
      id: crypto.randomUUID?.() || 'case-' + Date.now() + '-' + Math.random().toString(16).slice(2),
      author: nomeAutor(), assessment: String(assessment).trim(), plan: String(plan).trim(),
      reference: String(reference).trim(), createdAt: new Date().toISOString()
    };
    try {
      salvarComentario(comment);
      if (window.saveForumPostToCloud) {
         await window.saveForumPostToCloud(comment);
      }
      form.reset();
      form.querySelectorAll('textarea').forEach(resizeTextarea);
      root.querySelector('#caseStatus').textContent = t('Conduta publicada.', 'Plan posted.');
      root.querySelector('#caseStatus').style.color = '#39d9a0';
      renderizarFeed(root);
    } catch(e) {
      root.querySelector('#caseStatus').textContent = t('Erro ao salvar na nuvem: ', 'Could not save to cloud: ') + e.message;
      root.querySelector('#caseStatus').style.color = '#ff8d9e';
    }
  });

  root.querySelector('#caseFeed').addEventListener('click', event => {
    const button = event.target.closest('[data-vote]');
    if (!button) return;
    const votes = carregarVotos();
    const postId = button.dataset.id;
    const type = button.dataset.vote;
    const userId = window.clinicalMindCurrentUser?.()?.email || 'local-participant';
    votes[postId] ||= { supported: [], citation: [] };
    votes[postId][type] = Array.isArray(votes[postId][type]) ? votes[postId][type] : [];
    votes[postId][type] = votes[postId][type].includes(userId)
      ? votes[postId][type].filter(id => id !== userId)
      : [...votes[postId][type], userId];
    try { localStorage.setItem(VOTES_KEY, JSON.stringify(votes)); renderizarFeed(root); }
    catch { root.querySelector('#caseStatus').textContent = t('Não foi possível salvar o voto local.', 'Could not save the local vote.'); }
  });

  renderizarFeed(root);
}

window.renderEvidenceCommunity = renderEvidenceCommunity;
document.getElementById('appLanguage')?.addEventListener('click', () => {
  if (document.querySelector('.nav-btn.active')?.dataset.section === 'Comunidade') renderEvidenceCommunity();
});
