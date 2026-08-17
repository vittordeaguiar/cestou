# Fontes iniciais de preços

Pesquisa exploratória realizada em 11 de agosto de 2026 para preparar a V-56. A
configuração executável fica centralizada em `lib/pricing/sources.ts`; este documento
registra também as fontes descartadas para evitar que sejam reintroduzidas sem revisão.

Não havia `FIRECRAWL_API_KEY` no ambiente. Os testes abaixo usaram páginas públicas,
resultados indexados, requisições HTTP pequenas e leitura de `robots.txt`. Portanto, a
compatibilidade real com a renderização do Firecrawl ainda precisa de validação manual.
Nenhum CAPTCHA, login, cookie autenticado ou mecanismo de evasão foi usado.

## Fontes configuradas

### Angeloni

- **Domínio:** `super.angeloni.com.br`
- **Categoria e recomendação:** mercado, habilitada, prioridade 10.
- **Busca:** `https://super.angeloni.com.br/{termo}`.
- **Localização:** requer loja/região; preço e disponibilidade não são nacionais.
- **Conteúdo:** catálogo, nome, embalagem, preço normal/promocional e página do produto.
- **JavaScript:** sim, storefront VTEX com conteúdo também renderizado no HTML público.
- **Limitações:** campanhas podem depender de clube, loja ou meio de pagamento.
- **Teste:** HTTP 200 após redirecionamento para o host canônico; catálogo e páginas de
  produto retornaram preços. O `robots.txt` canônico bloqueia `/busca`, parâmetros de
  filtros e áreas privadas, mas não o padrão por path adotado.

### Super Muffato

- **Domínio:** `www.supermuffato.com.br`
- **Categoria e recomendação:** mercado, habilitada, prioridade 20.
- **Busca:** `https://www.supermuffato.com.br/{termo}`.
- **Localização:** exige seleção de loja e atende um raio regional.
- **Conteúdo:** catálogo e produto com nome, preço, oferta, quantidade e disponibilidade.
- **JavaScript:** sim, storefront VTEX.
- **Limitações:** preço depende da loja; pesáveis podem ser ajustados no fechamento.
- **Teste:** HTTP 200 e conteúdo público com produtos e preços. Foram evitados os paths e
  parâmetros de busca/filtros bloqueados no `robots.txt`.

### Zona Sul

- **Domínio:** `www.zonasul.com.br`
- **Categoria e recomendação:** mercado, habilitada, prioridade 30.
- **Busca:** `https://www.zonasul.com.br/{termo}`.
- **Localização:** depende de CEP e da cobertura regional no Rio de Janeiro.
- **Conteúdo:** nome, código, preço normal/promocional e descrição do produto.
- **JavaScript:** sim, storefront VTEX.
- **Limitações:** preço online pode divergir da loja física; estoque é regional.
- **Teste:** HTTP 200 e páginas públicas com preços. O padrão não usa `/busca`, que está
  bloqueado no `robots.txt`.

### Drogaria Venancio

- **Domínio:** `www.drogariavenancio.com.br`
- **Categoria e recomendação:** farmácia, habilitada, prioridade 10.
- **Busca:** `https://www.drogariavenancio.com.br/{termo}`.
- **Localização:** disponibilidade, entrega e promoções dependem do CEP.
- **Conteúdo:** nome, fabricante, apresentação, preço anterior/atual e promoção.
- **JavaScript:** sim, storefront VTEX.
- **Limitações:** atuação regional e promoções condicionadas a quantidade.
- **Teste:** HTTP 200; busca e páginas de produto expuseram preços em conteúdo público. O
  path adotado não consta entre os bloqueios observados no `robots.txt`.

### Drogasil

- **Domínio:** `www.drogasil.com.br`
- **Categoria e recomendação:** farmácia, experimental e desabilitada, prioridade 20.
- **Busca:** `https://www.drogasil.com.br/search?w={termo}`.
- **Localização:** preço, estoque e benefícios dependem de CEP/loja.
- **Conteúdo:** a busca retornou nomes, marcas e apresentações; preços não apareceram no
  conteúdo principal capturado.
- **JavaScript:** necessário para confirmar os preços.
- **Limitações:** precisa de uma chamada real do Firecrawl antes de ser habilitada.
- **Teste:** HTTP 200 e `/search?w=*` explicitamente permitido no `robots.txt`, porém sem
  preço por produto na extração exploratória.

### Drogaria Araujo

- **Domínio:** `www.araujo.com.br`
- **Categoria e recomendação:** farmácia, experimental e desabilitada, prioridade 30.
- **Busca:** `https://www.araujo.com.br/busca?q={termo}`.
- **Localização:** entrega, estoque e ofertas podem variar por CEP.
- **Conteúdo:** resultados indexados exibiram nomes, apresentações e preços.
- **JavaScript:** sim.
- **Limitações:** a chamada HTTP direta e o `robots.txt` retornaram 403; não usar bypass.
- **Teste:** catálogo publicamente indexado, mas acesso automatizado não confirmado.

## Fontes descartadas

| Fonte                    | Categoria | Motivo                                                                                                                            |
| ------------------------ | --------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Carrefour                | Mercado   | Os termos de uso proíbem explicitamente spiders e mineração automatizada, mesmo que preços estejam públicos.                      |
| Pão de Açúcar            | Mercado   | `robots.txt` bloqueia `/busca`; páginas de produto não substituem uma descoberta genérica autorizada.                             |
| Savegnago                | Mercado   | `robots.txt` bloqueia `/busca`, full-text query e parâmetros de mapa para o user-agent geral.                                     |
| Pague Menos / Extrafarma | Farmácia  | As permissões específicas citam alguns bots de IA, mas o `FirecrawlAgent` cai nas regras gerais que bloqueiam busca e parâmetros. |
| Panvel                   | Farmácia  | `robots.txt` bloqueia o endpoint real `/panvel/buscarProduto.do`.                                                                 |

Fontes descartadas não entram na configuração executável. Uma mudança futura de termos,
robots ou oferta de API oficial exige nova revisão antes de alterar essa decisão.

## Validação manual dos provedores

As chamadas abaixo são pequenas e não devem ser incluídas nos testes automatizados. Elas
exigem chaves válidas no shell e não imprimem os valores das credenciais.

```bash
curl --fail-with-body --request POST https://api.firecrawl.dev/v2/search \
  --header "Authorization: Bearer ${FIRECRAWL_API_KEY:?configure FIRECRAWL_API_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"query":"arroz 1kg","limit":1,"includeDomains":["super.angeloni.com.br"],"country":"BR"}'
```

```bash
curl --fail-with-body --request POST https://api.deepseek.com/chat/completions \
  --header "Authorization: Bearer ${DEEPSEEK_API_KEY:?configure DEEPSEEK_API_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"model":"deepseek-v4-flash","messages":[{"role":"system","content":"Responda somente com JSON válido."},{"role":"user","content":"Retorne {\"ok\":true}."}],"thinking":{"type":"disabled"},"response_format":{"type":"json_object"},"max_tokens":32}'
```

Ao validar, registrar a data, status HTTP, formato retornado e se o preço observado exige
CEP/loja. Não armazenar respostas completas, prompts ou headers em logs de produção.

## V-58 — Coleta específica via Scrape

A V-58 usa o endpoint `/v2/scrape` para consultar a URL específica construída para
cada fonte habilitada. O cliente solicita Markdown com `onlyMainContent` e timeout
explícito de 30 segundos. O resultado é normalizado no servidor antes de ser enviado
ao DeepSeek; conteúdo vazio é classificado como `not_found`, enquanto erros do
provedor permanecem classificados por fonte e não expõem detalhes ao cliente.
Todas as chamadas de `collect` da mesma instância do coletor compartilham um
limitador FIFO global de duas raspagens simultâneas; não há timeout adicional para
a fila.

Nesta execução, a variável `FIRECRAWL_API_KEY` não estava disponível. Portanto, não
foi feita validação real do provedor; a suíte usa mocks e valida o payload, o contrato
de resposta, os domínios permitidos, a normalização e a concorrência global limitada.

Para uma validação manual pequena, sem registrar credenciais ou respostas completas:

```bash
curl --fail-with-body --request POST https://api.firecrawl.dev/v2/scrape \
  --header "Authorization: Bearer ${FIRECRAWL_API_KEY:?configure FIRECRAWL_API_KEY}" \
  --header "Content-Type: application/json" \
  --data '{"url":"https://super.angeloni.com.br/arroz%201kg","formats":["markdown"],"onlyMainContent":true,"timeout":30000}'
```

Ao executar, registrar somente a data, status HTTP, URL retornada, preço observado e
se o conteúdo depende de CEP ou loja. Não armazenar payloads completos, prompts ou
headers de produção.

## V-59 — Busca genérica como fallback

Quando nenhuma fonte específica retornar evidência encontrada, o coletor executa, para
cada item, uma única busca genérica no endpoint Search do Firecrawl com a query `{item} preço`, limite
de cinco resultados, conteúdo Markdown e país `BR`. A busca genérica não substitui o
Scrape das fontes configuradas e não é chamada quando a coleta específica já produziu
evidência.

Antes do DeepSeek, cada resultado é normalizado pelo mesmo pipeline do Scrape. São
aceitos somente resultados com URL HTTP(S) sem credenciais, ao menos um termo relevante
do item e um preço brasileiro claro no formato `R$`. URLs duplicadas, conteúdo sem preço
ou resultados irrelevantes são descartados. As evidências aceitas recebem o identificador
`firecrawl-search` e permanecem com localização `unresolved`, pois a lista ainda não
fornece CEP ou loja.

Scrape e Search compartilham o limitador FIFO global de duas chamadas Firecrawl por
instância do coletor. Falhas do provedor continuam tipadas internamente e não expõem
mensagens, payloads ou credenciais ao usuário. A validação automatizada usa mocks; a
validação real depende de `FIRECRAWL_API_KEY` e deve registrar somente status, URL e
preço observado.

## V-60 — Estruturação definitiva pelo DeepSeek

As evidências encontradas são enviadas ao DeepSeek com um prompt fixo que proíbe
inferências e exige exatamente o objeto JSON abaixo:

```json
{
  "item": "Arroz",
  "found": true,
  "unitPrice": 10.9,
  "sourceUrl": "https://exemplo.test/arroz"
}
```

`item` precisa corresponder ao item solicitado, `unitPrice` deve ser um número positivo
e `sourceUrl` deve ser uma URL presente nas evidências encaminhadas. Promoção só é
aceita quando estiver claramente vigente e aplicável; preço antigo, condição promocional
não confirmada, variante ambígua, conflito entre valores ou indisponibilidade produzem
`found: false` com `unitPrice` e `sourceUrl` nulos.

Se a resposta do DeepSeek for inválida ou incompatível com esse contrato, a estimativa
faz uma única nova chamada com as mesmas evidências e uma instrução de correção. Falhas
de transporte, autenticação, limite ou timeout não são repetidas nessa camada e seguem
como falhas tipadas para o tratamento posterior. Todas as chamadas iniciais e de
recuperação passam por uma fila FIFO de no máximo duas requisições simultâneas por
instância do cliente DeepSeek; o timeout começa somente após a chamada adquirir espaço.

## V-62 — Itens não encontrados e falhas de busca

Cada item da estimativa termina internamente em um de três estados: `found`, `not_found` ou
`failed`. A ausência de preço, inclusive quando o DeepSeek responde `found: false`, é
`not_found` e não aumenta a contagem de falhas. Um item só é `failed` quando as tentativas
relevantes terminam tecnicamente sem uma conclusão útil; se houver uma fonte
`not_found` junto de falhas parciais, a ausência de preço prevalece.

Itens `failed` só são processados novamente uma vez quando todas as falhas que determinaram
o resultado são recuperáveis segundo os erros tipados das integrações. Itens `found` e
`not_found` não são repetidos, e a recuperação única de JSON inválido do V-60 continua
limitada à chamada inicial do DeepSeek. Depois da segunda passada, o total parcial preserva
somente os preços encontrados, `missing_items` recebe apenas itens `not_found` e a Action
expõe apenas contagens seguras de itens sem preço e falhos.
