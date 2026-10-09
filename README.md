# Protocolum

Aplicação web educacional de medicina baseada em evidências, construída com HTML, CSS e JavaScript Vanilla.

## Recursos

- Biblioteca online de diretrizes, literatura e referências consultadas no PubMed/NCBI.
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

A rede utiliza Firebase Authentication (Google), network_profiles e network_connections no Firestore. As preferências de compartilhamento ficam no perfil privado, em private_profiles/{uid}.

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

## Comunidade compartilhada

A sessão clínica e o mural geral usam o mesmo feed do Firestore. Posts ficam em `forum_posts/{id}`; respostas e votos ficam nas subcoleções `replies` e `votes`. Leitura e participação exigem login Google. Publicações e respostas incluem o nome de exibição e o UID do autor, sem enviar seu e-mail. Cada usuário pode gravar apenas o próprio voto; posts e respostas são criados com o UID autenticado e data do servidor. As regras proíbem a alteração de posts ou respostas existentes.

O feed mostra as 50 publicações mais recentes, de ambos os formatos. Cada discussão carrega até 200 respostas em ordem cronológica. Mudanças chegam em tempo real, sem apagar o texto que está sendo escrito. Falhas de gravação mantêm o formulário e não são anunciadas como publicações concluídas. Ao sair, os listeners e o feed são limpos.

Posts antigos guardados somente no navegador não são publicados automaticamente. Use a opção de recuperar uma contribuição ou discussão antiga no formulário, revise o texto e publique para compartilhá-lo. Os três exemplos da sessão clínica permanecem identificados como demonstrações e não são enviados à nuvem.

Publique o Hosting e as regras atualizadas para ativar esse fluxo:

```sh
firebase deploy --only hosting,firestore:rules
```

Verificações sem dados de produção:

```sh
node --experimental-vm-modules --test tests/community-cloud.test.cjs
NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/community-ui.browser.cjs
```

O teste de navegador usa Chromium e o servidor HTTP na porta 8080. Simula o Firestore e verifica a troca de posts, respostas e votos entre duas contas, preservação de rascunhos durante atualizações remotas e falha de publicação. As regras de acesso precisam de validação no emulador antes da publicação; esses testes simulados não substituem essa validação.

## Biblioteca online e estado do perfil

A biblioteca inicia vazia e obtém títulos, autores, resumos, datas, tipos de publicação e links pela API pública E-utilities do PubMed/NCBI. Não utiliza as antigas fichas incorporadas ao HTML nem o cache antigo da biblioteca. As fontes e os destaques são gerados pelos resultados online. Cada registro tem um PMID estável para favoritos e notas. Favoritos e histórico com IDs PubMed são recuperados pela API, mesmo quando a publicação não faz parte dos resultados recentes. IDs das antigas fichas fixas continuam guardados no armazenamento, mas suas fichas não fazem parte da biblioteca online.

A consulta inicial procura até 40 diretrizes dos últimos cinco anos e 40 ensaios/revisões do último ano nas áreas clínicas do site. “Buscar na internet” pesquisa o tema digitado sem limitar a data; um PMID numérico consulta diretamente o registro e abre a aba Literatura. Os filtros de revista e população vêm dos metadados recebidos. CID e cenário não são inferidos. A API não exige credenciais e suas requisições são espaçadas conforme o limite do NCBI.

Em uma falha inicial, a biblioteca exibe um erro com nova tentativa, sem preencher o feed com dados do arquivo do site. Se a atualização de uma consulta já concluída falhar, os resultados dessa consulta online permanecem identificados como anteriores. PubMed indexa publicações; isso não confirma vigência, força de recomendação ou aplicabilidade clínica.

No perfil, um indicador mostra “Salvando”, “Salvo na nuvem”, “Falha ao salvar” ou alterações pendentes. “Tentar novamente” repete a operação que falhou, inclusive nome, apresentação, artigos e contatos, sem apagar o formulário. Uma nova edição cancela a tentativa anterior para não reenviar valores desatualizados. Contas locais mostram salvamento no navegador.

Testes de interface:

```sh
NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/library-ui.browser.cjs
NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/profile-ui.browser.cjs
```

Esses testes usam respostas controladas de PubMed e Firestore, sem alterar dados de produção. O teste da biblioteca cobre falhas sem dados fixos, recuperação de favoritos, busca remota, PMID, conteúdo escapado e XML inválido. O teste de perfil cobre estados de salvamento, falha, nova tentativa e restauração em outro contexto.

### Visualizar perfis de amigos

Em **Perfil → Rede acadêmica → Amigos**, use **Ver perfil** para abrir o perfil compartilhado do colega. A janela mostra bio, formação, instituição, cidade, ORCID, Lattes e artigos, com as publicações em destaque primeiro. Pode ser fechada pelo botão ou pela tecla Escape. Falhas de consulta oferecem nova tentativa; perfis retirados da rede aparecem como indisponíveis.

Nos contatos pessoais, **Buscar perfil** consulta os perfis publicados pelo nome e permite escolher o colega correto; um contato por e-mail não é automaticamente vinculado a uma conta. É necessário entrar com Google e o colega precisa publicar seu perfil na rede. E-mail, contatos pessoais, favoritos e notas privados não são exibidos. As permissões existentes de `network_profiles` são mantidas.

Validação de interface: `NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/friends-network.browser.cjs` (Firestore simulado; não comprova acesso no Firebase de produção).

### Atualização automática e visibilidade do perfil

Em **Perfil → Rede acadêmica → Compartilhamento do perfil**, escolha quais campos serão visíveis e clique em **Publicar / salvar compartilhamento**. Nome e tema identificam o perfil; formação, especialidade, instituição, cidade, bio, ORCID, Lattes e artigos têm controles individuais. E-mail, contatos, favoritos e notas não fazem parte do documento compartilhado. Ocultar um campo remove seu conteúdo do perfil da rede, preservando o dado privado.

Com **Atualizar o perfil publicado automaticamente ao salvar alterações** ativado, salvar o perfil, nome, links acadêmicos ou artigos atualiza o documento compartilhado. Desative para manter atualizações manuais; use o botão de compartilhamento para publicar a versão atual. **Retirar perfil da rede** interrompe a publicação e mantém amizades e dados privados. Novos perfis começam sem publicação. Perfis legados já publicados são reconhecidos com os campos anteriormente compartilhados; a atualização automática passa a acompanhá-los ao salvar.

Preferências, dados privados e conteúdo público são salvos em uma transação Firestore. Se a operação falhar, nenhum desses documentos muda. As preferências atuais do servidor prevalecem sobre as de um editor antigo ao salvar dados privados; um perfil retirado não é recriado automaticamente. As opções permanecem disponíveis para repetir uma tentativa que falhou.

**Publicação necessária:** as novas regras em `firestore.rules` aceitam e validam o campo privado `sharing`. Publique as regras junto ao site (`firebase deploy --only firestore:rules,hosting`) com autenticação autorizada antes de usar esta versão em produção. O ambiente de desenvolvimento não possui autenticação de implantação; o envio ao GitHub não publica essas regras.

Testes: `node --experimental-vm-modules --test tests/*.test.cjs` e `NODE_PATH=/workspace/.protocolum-tools/node_modules node tests/profile-sharing.browser.cjs`. Os testes de navegador simulam o Firestore; não validam regras ou salvamentos no projeto de produção.
