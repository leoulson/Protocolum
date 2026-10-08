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

Com login Google, o nome, perfil, contatos pessoais e vitrine DOI são salvos no documento privado `private_profiles/{uid}` do Firestore e carregados ao entrar em outro dispositivo. Contas locais continuam com armazenamento apenas no navegador. Na primeira sincronização, o perfil existente do navegador é migrado somente se não houver perfil na nuvem. Links Lattes e ORCID são autodeclarados; não autenticam a titularidade. Metadados DOI são consultados na Crossref. Algumas funções utilizam Firestore e dependem das regras de acesso configuradas no projeto.

O conteúdo é educacional. Consulte as fontes completas e os protocolos locais.

## Direitos

Direitos reservados a Leonardo Spolon Ulson. Nenhuma licença de redistribuição foi concedida neste repositório.
## Rede acadêmica — ativação

A rede utiliza Firebase Authentication (Google), network_profiles e network_connections no Firestore.

O Firestore padrão do projeto está ativo em São Paulo (southamerica-east1). As regras completas estão em firestore.rules e são referenciadas por firebase.json. Para atualizar as regras: firebase deploy --only firestore:rules. O arquivo network-rules.fragment.txt é apenas uma referência dos blocos da rede, não um arquivo completo para deploy.

Para ativar o salvamento privado em nuvem, publique as regras atualizadas com `firebase deploy --only firestore:rules`. O aplicativo não confirma salvamento em nuvem sem resposta do Firestore; falhas de leitura impedem sobrescrever um perfil remoto com dados locais.

Perfis são publicados somente por ação explícita do titular. A busca retorna até 20 perfis pelo início do nome. Pedidos usam um documento por par de usuários; apenas o destinatário pode aceitar. Participantes podem cancelar, recusar e desfazer a amizade. A retirada do perfil do buscador mantém as conexões.

O perfil público é uma cópia da versão local: após editar, use Publicar / atualizar perfil. E-mail, contatos pessoais e credenciais não são enviados ao diretório.

## Testes de perfil

A sincronização privada é testada sem credenciais de produção:

```sh
node --experimental-vm-modules --test tests/profile-store.test.cjs
```

O teste de interface usa `@playwright/test`, Chromium em `/usr/bin/chromium` e o servidor local na porta 8080. Execute com o pacote disponível no ambiente Node (por exemplo, `NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/profile-ui.browser.cjs`). O adaptador do Firestore é simulado: o teste cobre edição, confirmação de gravação, falha de gravação e restauração em outro contexto de navegador, sem gravar dados reais. As regras de acesso devem ser validadas no emulador do Firestore antes de publicar.

## Favoritos e anotações na nuvem

Com Google, os favoritos são guardados em `private_study/{uid}` e as notas em `private_study/{uid}/notes/{referência}`. As regras permitem acesso somente ao titular. Os favoritos são recuperados ao entrar; a nota é recuperada ao abrir a referência. Dados locais existentes são migrados sem sobrescrever uma versão já presente na nuvem. Contas locais continuam usando apenas este navegador.

Alterações de favoritos usam transações para preservar favoritos adicionados em outro dispositivo. Uma nota só recebe a confirmação “Salvo na nuvem” após a gravação no Firestore. Em caso de falha, seu rascunho permanece no navegador e pode ser reenviado pelo botão “Tentar novamente”. Edições simultâneas da mesma nota usam a última gravação confirmada.

Publique o Hosting e as regras atualizadas para ativar a integração. Teste a sincronização sem dados de produção com:

```sh
node --experimental-vm-modules --test tests/profile-store.test.cjs tests/study-sync.test.cjs
```

O teste de interface de estudo usa o mesmo servidor e as dependências do teste de perfil: `NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/study-ui.browser.cjs`. O Firestore é simulado e nenhum dado de produção é alterado.
