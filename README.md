# Protocolum

Aplicação web educacional de medicina baseada em evidências, construída com HTML, CSS e JavaScript Vanilla.

## Recursos

- Biblioteca de diretrizes, literatura e referências.
- Comparador de diretrizes e fluxogramas interativos.
- Feed PubMed e laboratório de leitura crítica.
- Discussões de casos clínicos.
- Perfil acadêmico com Lattes, ORCID e vitrine de artigos por DOI.
- Login Google com Firebase Authentication.
- PWA com modo escuro e interface responsiva.

## Executar localmente

Sirva esta pasta por um servidor HTTP local. Não abra index.html por file://: módulos JavaScript e autenticação precisam de HTTP/HTTPS.

Exemplo, com Node.js:

```sh
npx --yes http-server . -p 8080 -c-1
```

Abra http://localhost:8080.

## Firebase

A configuração em firebase-config.js é a configuração pública do cliente web, não uma credencial administrativa. Não adicione chaves de conta de serviço, tokens ou arquivos .env ao repositório.

O projeto de Hosting está indicado em .firebaserc. A publicação é manual:

```sh
firebase deploy --only hosting
```

Enviar alterações ao GitHub não publica automaticamente no Firebase.

## Dados e limites

Perfis, lista pessoal de amigos e vitrine DOI ficam neste navegador, separados por conta. Links Lattes e ORCID são autodeclarados; não autenticam a titularidade. Metadados DOI são consultados na Crossref. Algumas funções utilizam Firestore e dependem das regras de acesso configuradas no projeto.

O conteúdo é educacional. Consulte as fontes completas e os protocolos locais.

## Direitos

Direitos reservados a Leonardo Spolon Ulson. Nenhuma licença de redistribuição foi concedida neste repositório.
