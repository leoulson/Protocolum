// Each entry represents one specific recommendation, not an entire guideline.
// Grades retain the issuing society's own framework; they are never normalized.
export const VERIFIED_ON = '2026-10-04';
const bi = (pt, en) => ({ pt, en });
export const localize = (value, language = 'pt') => typeof value === 'string' ? value : value?.[language] || value?.pt || '';

const kdigoSource = {
  society: 'KDIGO', year: 2024, framework: 'GRADE',
  title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of CKD',
  url: 'https://kdigo.org/wp-content/uploads/2024/03/KDIGO-2024-CKD-Guideline.pdf#page=44'
};
const escSource = {
  society: 'ESC', year: 2023, framework: 'ESC',
  title: '2023 Focused Update of the 2021 ESC Guidelines for acute and chronic heart failure',
  url: 'https://doi.org/10.1093/eurheartj/ehad195'
};
export const QUESTIONS = [
  {
    id: 'sglt2-diabetic-ckd',
    title: bi('Quando considerar iSGLT2 na DRC com diabetes tipo 2?', 'When should SGLT2 inhibitors be considered in CKD with type 2 diabetes?'),
    keywords: 'renal rim nefrologia kidney diabetes kdigo ada sglt2 drc ckd',
    agreement: bi('Ambas as edições recomendam iSGLT2 com benefício demonstrado nesse contexto.', 'Both editions recommend SGLT2 inhibitors with demonstrated benefit in this setting.'),
    difference: bi('KDIGO usa GRADE; ADA usa sua classificação própria. “1A” e “A” expressam critérios diferentes e não devem ser convertidos numa escala única.', 'KDIGO uses GRADE; ADA uses its own grading system. “1A” and “A” use different criteria and must not be converted to a single scale.'),
    context: bi('Comparação entre edições de 2024 e 2026. Os critérios abaixo se referem à introdução, não à suspensão automática durante o seguimento.', 'Comparison of 2024 and 2026 editions. The criteria below concern initiation, not automatic discontinuation during follow-up.'),
    sources: [
      { ...kdigoSource, id: 'kdigo-dm', section: '3.7.1', strength: bi('1 · recomendação forte', '1 · strong recommendation'), evidence: bi('A · certeza alta', 'A · high certainty'),
        population: bi('Pessoas com DM2 e DRC.', 'People with T2D and CKD.'),
        criteria: bi('TFGe ≥20 mL/min/1,73 m² para introdução.', 'eGFR ≥20 mL/min/1.73 m² for initiation.'),
        recommendation: bi('Recomenda tratamento com iSGLT2.', 'Recommends SGLT2 inhibitor treatment.'),
        limits: bi('Confira tolerância e pontos de prática na seção 3.7.', 'Review tolerability and practice points in section 3.7.') },
      { id: 'ada-dm', society: 'ADA', year: 2026, framework: 'ADA',
        title: 'Chronic Kidney Disease and Risk Management: Standards of Care in Diabetes—2026',
        url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12690176/', section: '11.7a',
        strength: bi('Recomendado · sem classe numérica', 'Recommended · no numerical class'), evidence: bi('A · classificação ADA', 'A · ADA grading'),
        population: bi('Pessoas com DM2 e DRC.', 'People with T2D and CKD.'),
        criteria: bi('Introdução com TFGe ≥20 mL/min/1,73 m².', 'Initiation at eGFR ≥20 mL/min/1.73 m².'),
        recommendation: bi('Recomenda iSGLT2 com benefício demonstrado para reduzir progressão renal e eventos cardiovasculares.', 'Recommends SGLT2 inhibitors with demonstrated benefit to reduce kidney progression and cardiovascular events.'),
        limits: bi('A recomendação permite manutenção até falência renal; consultar situações especiais no capítulo.', 'The recommendation permits continuation until kidney failure; consult special situations in the chapter.') }
    ]
  },
  {
    id: 'sglt2-hfpef',
    title: bi('Qual o papel dos iSGLT2 na IC com fração de ejeção preservada?', 'What is the role of SGLT2 inhibitors in HF with preserved ejection fraction?'),
    keywords: 'cardio coração heart failure esc aha acc hfsa icfep hfpef sglt2',
    agreement: bi('As duas edições apoiam o uso nessa população, mas atribuem classes distintas.', 'Both editions support use in this population but assign different classes.'),
    difference: bi('ESC 2023: classe I, nível A. AHA/ACC/HFSA 2022: classe 2a, nível B-R. A comparação é documental; a diferença não demonstra oposição terapêutica.', 'ESC 2023: class I, level A. AHA/ACC/HFSA 2022: class 2a, level B-R. This document comparison does not imply opposing therapeutic advice.'),
    context: bi('As edições têm datas e conjuntos de evidências diferentes. Confirme atualizações posteriores na sociedade antes de usar a comparação.', 'The editions have different dates and evidence sets. Check subsequent society updates before using the comparison.'),
    sources: [
      { ...escSource, id: 'esc-hfpef', section: 'HFpEF · recommendation table',
        strength: bi('Classe I · recomendado', 'Class I · recommended'), evidence: bi('Nível A · classificação ESC', 'Level A · ESC grading'),
        population: bi('Pessoas com ICFEp.', 'People with HFpEF.'),
        criteria: bi('Diagnóstico de ICFEp; conferir critérios clínicos e dos estudos na diretriz.', 'HFpEF diagnosis; check clinical and trial criteria in the guideline.'),
        recommendation: bi('Recomenda dapagliflozina ou empagliflozina para reduzir hospitalização por IC ou morte cardiovascular.', 'Recommends dapagliflozin or empagliflozin to reduce HF hospitalization or cardiovascular death.'),
        limits: bi('Verificar função renal, tolerância e elegibilidade individual na fonte.', 'Check kidney function, tolerability and individual eligibility in the source.') },
      { id: 'aha-hfpef', society: 'AHA/ACC/HFSA', year: 2022, framework: 'AHA/ACC',
        title: '2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure · slide set',
        url: 'https://professional.heart.org/en/science-news/-/media/PHD-Files-2/Science-News/2/2022/2022-Heart-Failure-Guideline-Slide-Set.pdf#page=111',
        section: 'HFpEF · recommendation 2',
        strength: bi('Classe 2a · pode ser benéfico', 'Class 2a · can be beneficial'), evidence: bi('B-R · evidência randomizada', 'B-R · randomized evidence'),
        population: bi('Pessoas com ICFEp.', 'People with HFpEF.'),
        criteria: bi('ICFEp; consultar definição e avaliação diagnóstica na diretriz.', 'HFpEF; consult guideline definitions and diagnostic assessment.'),
        recommendation: bi('iSGLT2 podem reduzir hospitalizações por IC e mortalidade cardiovascular.', 'SGLT2 inhibitors can reduce HF hospitalization and cardiovascular mortality.'),
        limits: bi('Edição de 2022, anterior à atualização ESC 2023 selecionada.', '2022 edition, preceding the selected 2023 ESC update.') }
    ]
  },
  {
    id: 'sglt2-nondiabetic-ckd',
    title: bi('Quando considerar iSGLT2 na DRC sem diabetes?', 'When should SGLT2 inhibitors be considered in CKD without diabetes?'),
    keywords: 'renal kidney nefrologia kdigo drc ckd sem diabetes sglt2',
    agreement: bi('', ''), difference: bi('', ''),
    context: bi('Uma fonte cadastrada. O escopo da ADA acima é DM2 e DRC; não pode ser extrapolado para preencher esta comparação.', 'One curated source. The ADA entry above concerns T2D and CKD and cannot be extrapolated to fill this comparison.'),
    sources: [
      { ...kdigoSource, id: 'kdigo-no-dm', section: '3.7.2', strength: bi('1 · recomendação forte', '1 · strong recommendation'), evidence: bi('A · certeza alta', 'A · high certainty'),
        population: bi('Adultos com DRC, incluindo sem DM2.', 'Adults with CKD, including without T2D.'),
        criteria: bi('TFGe ≥20 e RAC ≥200 mg/g; ou IC, independentemente da albuminúria.', 'eGFR ≥20 and ACR ≥200 mg/g; or HF irrespective of albuminuria.'),
        recommendation: bi('Recomenda iSGLT2 nos grupos definidos.', 'Recommends SGLT2 inhibitors in these groups.'),
        limits: bi('A seção 3.7.3 aborda outros perfis com força distinta; não extrapolar o grau 1A.', 'Section 3.7.3 addresses other profiles with a different grade; do not extrapolate 1A.') }
    ]
  }
];

// Only known recommendations may participate; feed articles cannot be inserted
// as guideline statements. Missing coverage is explicit instead of inferred.
export function buildComparison(questionId, selectedIds) {
  const question = QUESTIONS.find(item => item.id === questionId);
  if (!question) return { question: null, sources: [], complete: false };
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  const sources = question.sources.filter(source => selected.has(source.id));
  return { question, sources, complete: sources.length >= 2 };
}

export function buildReport(comparison, language = 'pt', notes = '') {
  const { question, sources, complete } = comparison;
  if (!question) return '';
  const t = value => localize(value, language);
  const labels = language === 'en'
    ? ['Population', 'Criteria', 'Recommendation', 'Strength', 'Evidence', 'Limits']
    : ['População', 'Critérios', 'Recomendação', 'Força', 'Evidência', 'Limites'];
  const fields = ['population', 'criteria', 'recommendation', 'strength', 'evidence', 'limits'];
  const lines = ['Protocolum', t(question.title), (language === 'en' ? 'Sources checked: ' : 'Fontes verificadas: ') + VERIFIED_ON, '', t(question.context)];
  if (complete) lines.push(t(question.agreement), t(question.difference));
  else lines.push(language === 'en' ? 'Insufficient curated sources for comparison.' : 'Fontes cadastradas insuficientes para comparação.');
  sources.forEach(source => {
    lines.push('', source.society + ' · ' + source.year + ' · ' + source.framework,
      ...fields.map((field, i) => labels[i] + ': ' + t(source[field])),
      source.title + ' · ' + source.section, source.url);
  });
  if (notes.trim()) lines.push('', language === 'en' ? 'Personal notes:' : 'Anotações pessoais:', notes.trim());
  lines.push('', language === 'en' ? 'Educational comparison of selected editions; consult complete sources and local protocols.' : 'Comparação educacional de edições selecionadas; consulte as fontes integrais e protocolos locais.');
  return lines.join('\n');
}
