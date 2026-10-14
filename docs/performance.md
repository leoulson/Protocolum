# Otimização do carregamento com REA

O REA 6.4.0 foi usado para reconstruir as dependências estáticas do JavaScript antes e depois da alteração:

```sh
rea analyze-javascript-application /workspace/Protocolum --analysis-timeout-ms 30000 --format json
```

A análise confirmou que `profile-data.js` importava o módulo completo de interface acadêmica para normalizar dados. Essa dependência agora aponta para `profile-academic-data.js`, que não monta a interface nem faz consultas. Os exports anteriores continuam disponíveis em `profile-academic.js`.

Evidências REA da análise local:

- Antes: `ev_c1d86ddbcb56f65d21ed037ce45e3f5eb726d2a06363b61f577c284a55414629`.
- Depois: `ev_bffc66bfa9ba5fda7d42fbe83540c087750f5cd082924d658b5607258abce586`.

A análise estática não prova execução nem desempenho. O grafo também inclui testes, referências externas e relações com cobertura parcial. As verificações de navegação e as medições abaixo foram feitas separadamente no Chromium.

## Medição da entrada

Com Playwright, service worker desativado e autenticação externa simulada, registramos os módulos JavaScript locais solicitados até o estado `networkidle`, tanto na apresentação quanto na biblioteca de uma conta local. Somamos o tamanho dos arquivos locais correspondentes, sem compressão.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Arquivos JavaScript locais solicitados | 24 | 11 |
| Tamanho desses módulos | 205.615 bytes | 45.323 bytes |

A redução foi de aproximadamente 78%. A medição exclui o JavaScript embutido no HTML, SDKs externos, CSS e o tráfego de instalação do service worker. Ela não é uma medição de tempo de carregamento em produção; tempos de execução variam com a rede e o aparelho.

## Comportamento e validação

`feature-loader.js` carrega perfil, comparador, fluxogramas, laboratório PubMed, comunidade e arquitetura do leitor na primeira utilização. As importações são reaproveitadas, respostas atrasadas não reabrem telas já abandonadas, e falhas apresentam um botão para recarregar a página. O leitor também se inicializa quando sua importação termina depois da abertura da ficha.

O service worker continua preparando as ferramentas para uso offline. Por isso, a primeira instalação ainda baixa os módulos opcionais em segundo plano; a otimização evita avaliá-los na entrada. Buscas online continuam exigindo conexão. A fonte local recebe preload.

Foram verificados abertura sob demanda, troca de tela durante importação, recuperação de falha, primeira abertura offline das ferramentas, leitura de artigos, perfil, paginação, preferência de aparência entre dispositivos e contraste nos dois temas em desktop e celular. Firebase e PubMed foram simulados nos testes funcionais. Os 52 testes unitários também passaram.
