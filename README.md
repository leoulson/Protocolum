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
## Rede acadêmica — ativação

A rede utiliza Firebase Authentication (Google), network_profiles e network_connections no Firestore.

O Firestore padrão do projeto está ativo em São Paulo (southamerica-east1). As regras completas estão em firestore.rules e são referenciadas por firebase.json. Para atualizar as regras: firebase deploy --only firestore:rules. O arquivo network-rules.fragment.txt é apenas uma referência dos blocos da rede, não um arquivo completo para deploy.

Perfis são publicados somente por ação explícita do titular. A busca retorna até 20 perfis pelo início do nome. Pedidos usam um documento por par de usuários; apenas o destinatário pode aceitar. Participantes podem cancelar, recusar e desfazer a amizade. A retirada do perfil do buscador mantém as conexões.

O perfil público é uma cópia da versão local: após editar, use Publicar / atualizar perfil. E-mail, contatos pessoais e credenciais não são enviados ao diretório.
