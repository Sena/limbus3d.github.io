# Spec — Importar do MakerWorld e orçar vários pratos

**Status:** proposta para implementação
**Repositórios envolvidos:** `calculadora-3d` (este) + `../mini-commerce` (rota `/api/import`)
**Entrega:** os dois lados juntos, só publicando quando ambos estiverem prontos.

---

## 1. Resumo

Hoje a calculadora importa peso e tempo de links do STLFlix: a rota
`https://limbus.com.br/api/import` resolve o link, o cliente extrai peso/tempo da
descrição e o resultado preenche `#weight` e `#minutes`.

A mudança faz o **mesmo campo de link** aceitar STLFlix **e** MakerWorld. Para o
MakerWorld, o fluxo passa a ser:

1. colar o link do modelo;
2. escolher **um** perfil de impressão (o MakerWorld tem vários por modelo);
3. escolher **quais pratos** daquele perfil entram no orçamento (com imagem,
   peso e tempo de cada um);
4. ver a lista de itens, o preço **individual** de cada prato, um **desconto em
   lote** (setup cobrado uma vez) e o **total**.

Tudo isso vive numa **terceira aba, "Orçamento"**. O campo de link **sai** da
aba Calculadora, que volta a ser só peso/tempo manuais. O **modo cliente é
removido por completo**.

---

## 2. Contexto técnico levantado

### 2.1 O que já existe

| Peça | Arquivo | Papel |
| --- | --- | --- |
| Validação/parse do link | `src/core/importer.js` (`parseStlflixLink`) | Só aceita `platform.stlflix.com` |
| Busca no resolvedor | `src/core/importer.js` (`fetchImport`) | `GET https://limbus.com.br/api/import?url=…` |
| Normalização da resposta | `src/core/importer.js` (`hydrateImportResult`) | Exige `items[]` |
| Parse da descrição STLFlix | `src/core/importer.js` (`parseStlflixDescription`) | Extrai versões Monocolor/Multiparts/Multicolor |
| Folha de escolha | `src/ui/importer.js` + `#importSheet` | Cartões de modelo + botões de versão |
| Campo de link | `index.html` (`#importForm`) | Fica no card "Dados da peça" da Calculadora |
| Cálculo | `src/core/pricing.js` (`calculateQuote`) | Peça única; setup por lote |
| Rota do servidor | `../mini-commerce/src/pages/api/import.ts` | CORS por origem, cache de 5 min |
| Resolvedor do servidor | `../mini-commerce/src/utils/import/*` | `index.ts` → `stlflix.ts` (GraphQL) |

### 2.2 O que a API pública do MakerWorld entrega (verificado em 2026-10-29)

`GET https://makerworld.com/api/v1/design-service/design/{id}` responde `200`
sem autenticação e **sem cabeçalhos CORS** (por isso a resolução tem que ser no
servidor, como já é com o STLFlix).

Para `https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams?profiled=3639209#profileId-3158330`:

```
design.id             = 2834113
design.title          = "Alien mit hochgezogener Augenbraue (7 Gramm)"
design.titleTranslated= "Alien with a raised eyebrow (7 grams)"
design.coverUrl       = https://makerworld.bblmw.com/.../design/9848165f2702a17e.png
design.instances[]    -> perfis de impressão
```

Cada `instances[i]` (perfil):

| Campo | Exemplo | Uso |
| --- | --- | --- |
| `id` | `3158330` | Casa com `#profileId-3158330` |
| `title` | `"Alien (komplett grün/einfarbig)"` | Título no idioma do autor |
| `titleTranslated` | `"Alien (completely green/single-color)"` | Tradução (inglês) |
| `cover` | `.../instance/5aee503b814303df.jpg` | Imagem do perfil |
| `weight` | `7` | Peso total do perfil, em gramas |
| `prediction` | `2090` | Tempo total, em **segundos** |
| `needAms` | `false` | Informativo (multicolor) |
| `materialColorCnt` | `1` | Informativo |
| `extention.modelInfo.plates[]` | ver abaixo | Pratos |

Cada prato (`plates[]`):

| Campo | Exemplo | Uso |
| --- | --- | --- |
| `index` | `1` | Rótulo "Prato 1" quando não há nome |
| `name` | `""` | Nome do prato (frequentemente vazio) |
| `weight` | `8` | Gramas |
| `prediction` | `3117` | Segundos |
| `thumbnail.url` | `.../955200099/instance/plate_1.png` | Imagem do prato |
| `filaments[]` | `[{type:"PLA", color:"#3F8E43", usedG:"8"}]` | **Ignorado** nesta versão |

Amostra real do modelo de exemplo (3 perfis):

| id | título | peso | tempo | pratos |
| --- | --- | --- | --- | --- |
| 3158330 | Alien (completely green/single-color) | 7 g | 2090 s (35 min) | 1 (7 g, 2090 s) |
| 3158469 | Alien (Dual-Color) | 36 g | 7982 s (2h13) | 1 (36 g, 7982 s) |
| 3639209 | Multipart - 0.2mm layer, 2 walls, 8% infill | 9 g | 3706 s (1h02) | 2 (8 g/3117 s, 1 g/589 s) |

Outras observações verificadas:

- `titleTranslated` vem em **inglês**, mesmo pedindo `Accept-Language: pt-BR`.
  Ou seja: "mostrar só a tradução" = títulos em inglês quando o autor é alemão.
  Fallback para `title` quando a tradução vier vazia.
- Imagens do CDN (`makerworld.bblmw.com`) respondem `200` sem `Referer`, com
  `content-type: binary/octet-stream` — o navegador renderiza normalmente;
  mesmo assim, manter o `onerror` que remove a imagem (comportamento atual).
- ID inexistente devolve `404` com `{ code: 404, error: "..." }` (JSON).
- `?profiled=<id>` é o id do perfil selecionado; `#profileId-<id>` é a âncora do
  perfil na página. Os dois apontam para o mesmo `instances[].id`.

---

## 3. Decisões de produto (fechadas)

| Tema | Decisão |
| --- | --- |
| Campo de link | Único, aceita STLFlix e MakerWorld; o sistema detecta a fonte |
| Onde fica | **Terceira aba "Orçamento"**; o campo sai da Calculadora |
| Escolha no MakerWorld | Um **perfil** por orçamento, depois **N pratos** daquele perfil |
| Seleção de pratos | Nenhum vem marcado; botão de adicionar desabilitado com 0 |
| Pré-seleção pela URL | Usa `?profiled=`, senão `#profileId-`; rola até o perfil |
| Sempre abre a folha | Mesmo com 1 perfil e 1 prato; com 1 perfil, pula direto para os pratos |
| Imagens | Capa do perfil na lista de perfis; thumbnail na grade de pratos e na lista de itens |
| Preço por item | Cada prato tem preço **individual**, como se fosse um orçamento sozinho |
| Total | Recálculo do lote inteiro (peso/tempo somados, setup uma vez) |
| Desconto | Linha "Desconto em lote" = **soma dos individuais − total do lote** (delta exato); só com 2+ itens |
| Quantidade | Campo próprio da aba Orçamento, global para todos os itens (q cópias de cada prato) |
| Cores/filamentos | Mesma seleção compartilhada com a Calculadora (chips espelhados) |
| Peso/tempo dos itens | Fixos, vindos do site; sem edição por item |
| Perfil sem pratos/peso/tempo | Fica desabilitado na lista, com aviso |
| Duplicado | Ignorado, com toast |
| Fontes misturadas | Não: um orçamento por fonte; trocar de fonte limpa a lista |
| Outro link do MakerWorld | Substitui perfil e pratos anteriores (um perfil por orçamento) |
| Persistência | Só na sessão; recarregar limpa a lista |
| Histórico/PDF | Sim, com detalhamento por prato, subtotal, desconto e total |
| Link compartilhável | Continua guardando só a configuração de custos |
| Cache | Longo (90 dias) para acertos, dos dois sites; erro nunca é cacheado; botão "Atualizar" ignora o cache |
| Modo cliente | Removido completamente (botão, estado, CSS, script inline, testes, README) |
| Falha do MakerWorld | Mensagem clara sugerindo preencher peso/tempo na Calculadora |

---

## 4. Fluxo do usuário

### 4.1 Aba Calculadora (sem importação)

- O card "Dados da peça" perde o `#importForm` e o rótulo "Pelo fatiador ou por link" passa a "Pelo fatiador".
- Resto igual: cores, quantidade, peso, tempo, card de resultado, histórico, PDF, link, presets.
- Sem modo cliente: as abas ficam sempre visíveis e os custos sempre aparecem.

### 4.2 Aba Orçamento — estado vazio

Estrutura de uma coluna, no mesmo `calc-layout` da Calculadora:

```
┌ Modelo e pratos ──────────────────────────────────────┐
│ Importar de um link            STLFlix · MakerWorld   │
│ [ https://makerworld.com/... ou platform.stlflix.com ]│
│ [ Importar ]                                          │
│ Cole o link do modelo/perfil do MakerWorld ou do      │
│ modelo/drop do STLFlix.                               │
└───────────────────────────────────────────────────────┘
┌ Itens do orçamento ───────────────────────────────────┐
│ (vazio) Importe um link para escolher os pratos.      │
└───────────────────────────────────────────────────────┘
┌ Resultado (oculto até ter item) ──────────────────────┐
```

- Sem total zerado, sem botões desabilitados à mostra.
- Texto de apoio explica o fluxo: perfil → pratos → total.

### 4.3 Importar do MakerWorld

1. Cola o link e clica em **Importar** → botão vira "Importando…",
   `aria-busy="true"`, depois volta ao normal.
2. Abre a folha (`#importSheet`) no **passo 1 — perfis**:
   - título "Escolha o perfil";
   - subtítulo: nome do design + "N perfis";
   - dica: "Preço para N un · MakerWorld" (ou "Preço por peça");
   - cada linha: capa (quadrada, 56 px), título traduzido, meta
     `"3 pratos · 9 g · 1h02"`; perfis sem pratos ficam desabilitados com a meta
     "Sem dados de prato".
   - se a URL trouxe `?profiled=` (ou `#profileId-`), aquele perfil é
     **pré-selecionado** (destaque `aria-current`) e a folha rola até ele, sem
     abrir os pratos sozinha.
   - se o design tiver **um único perfil**, a folha abre direto no passo 2.
3. Clicar num perfil leva ao **passo 2 — pratos**:
   - título "Escolha os pratos"; subtítulo: título do perfil;
   - grade de cartões (2 colunas no desktop, 1 no mobile), cada cartão é um
     `<label>` com `<input type="checkbox">`, imagem 4:3 (`loading="lazy"`,
     `decoding="async"`, proporção reservada) e meta `"8 g · 52 min"`;
   - nenhum vem marcado;
   - rodapé fixo da folha: **Voltar** e **Adicionar N pratos** (desabilitado com
     0; singular "Adicionar 1 prato").
4. Ao adicionar: a folha **fecha**, os itens entram na lista, o total aparece e
   a página volta ao topo da lista de itens.

### 4.4 Importar do STLFlix (na aba Orçamento, unificação visual)

- Mesma folha e mesmos cartões com imagem de hoje (`import-item` /
  `variant-option`).
- Escolher uma versão **adiciona um único item** à lista (título
  `"Modelo — Monocolor"`) e fecha a folha. Não preenche mais os campos da
  Calculadora.
- Drop com vários modelos continua mostrando todos; escolher um adiciona só ele.
- Peso/tempo/formatação continuam vindo de `parseStlflixDescription`.

### 4.5 Lista de itens

Cada linha:

```
[thumb] Prato 1                        8 g · 52 min      R$ 21,77   [x]
        Multipart - 0.2mm layer…        (× 2 un)
```

- Thumbnail 40 px, título do item, linha secundária com o perfil (MakerWorld) ou
  a versão (STLFlix).
- Peso e tempo **do item**, já multiplicados pela quantidade? **Não**: meta
  mostra o valor unitário e, quando `q > 1`, um sufixo "× N un".
- Preço do item = orçamento individual daquele item com a quantidade global.
- Botão remover por linha (`aria-label="Remover Prato 1"`).
- Ações da lista: **Limpar orçamento** (com confirmação em dois toques, igual ao
  "Limpar histórico").
- Máximo de 20 itens (proteção de layout); ao bater o limite, toast
  "Limite de 20 itens por orçamento." e os checkboxes ficam desabilitados.

### 4.6 Resultado

```
Peso total    9 g
Tempo total   1h02
Peças         2
─────────────────────────
Subtotal                 R$ 38,74
Desconto em lote         −R$ 15,99
Preço total              R$ 22,75
[ Salvar no histórico ] [ Gerar PDF ]
```

- "Desconto em lote" só aparece com 2+ itens; texto auxiliar
  "Setup cobrado uma vez por impressão." (tooltip ou `field-hint`).
- O total recebe a animação `is-updated` que já existe no preço da Calculadora.
- Os botões usam os mesmos handlers de histórico/PDF, com o payload do lote.

### 4.7 Trocar de fonte / reimportar

- Já existe lista de **outra fonte** (ex.: itens do MakerWorld e chega link do
  STLFlix) → limpa a lista e mostra toast
  "Orçamento anterior substituído: um orçamento por site."
- Já existe lista do **mesmo** MakerWorld e chega outro modelo/perfil →
  substitui os itens e mostra "Orçamento atualizado com o novo perfil."
- Duplicado exato (mesmo `profileId` + `plate.index`) → não entra, toast
  "Esse prato já está no orçamento."

---

## 5. Modelo de cálculo

### 5.1 Individual

Para cada item `i`, com quantidade global `q`:

```js
quote_i = calculateQuote({
  weightGrams: w_i,
  minutes: m_i,
  quantity: q,
  filaments,
  selected,
  config,
})
```

Igual ao cálculo de hoje: setup entra uma vez **por item**, falha, markup e
taxas incidem sobre cada orçamento individual. `quote_i.total` é o preço da
linha.

### 5.2 Lote

```js
batchQuote = calculateQuote({
  weightGrams: Σ w_i,
  minutes: Σ m_i,
  quantity: q,
  pieces: q * N,        // NOVO
  filaments,
  selected,
  config,
})
```

Com uma única chamada de setup para o lote inteiro.

**Mudança necessária em `calculateQuote`:** `postProcessingCost` hoje é
`postProcessing * quantity`. Em um lote de `N` itens com `q` cópias cada, o
número de peças é `q * N` — sem isso o pós-processamento fica subcontado.
Adicionar `pieces` opcional em `QuoteInput`:

```js
const pieces = Math.max(1, Math.floor(toNumber(input?.pieces) || quantity));
...
const postProcessingCost = toNumber(config.postProcessing) * pieces;
```

Sem `pieces`, o comportamento atual permanece idêntico (`pieces === quantity`),
então nenhum teste existente muda de valor.

### 5.3 Desconto e total

```js
subtotal = Σ quote_i.total
total    = batchQuote.total
desconto = subtotal - total      // exibido só com N >= 2
```

Como todas as parcelas são lineares exceto o setup, o delta teórico é

```
desconto = (N - 1) * setup * markup / (1 - taxaTotal)
```

Mas os tempos são arredondados para minutos **por item** antes de calcular, e o
lote usa a soma dos minutos já arredondados; por isso o resultado real pode
diferir alguns centavos da fórmula (ver §5.5). A implementação usa a diferença
dos dois cálculos, nunca a fórmula, para o número bater com o que a tela mostra.

### 5.4 Exemplo de aceitação

Padrões de fábrica (`energyKwh 0.92`, `consumoKw 0.07`, `markup 2.0`,
`machineCost 8`, `hourRate 2.00`, `failureRate 5`, `postProcessing 0`,
`taxRate 0`, `cardFeeRate 0`) e o filamento padrão (R$ 120 / 1000 g = R$ 0,12/g),
com `q = 1`, perfil 3639209:

| Item | Peso | Tempo | Individual |
| --- | --- | --- | --- |
| Prato 1 | 8 g | 3117 s → 52 min | R$ 21,77 |
| Prato 2 | 1 g | 589 s → 10 min | R$ 16,97 |
| **Subtotal** | 9 g | 61 min | **R$ 38,74** |
| **Lote** | 9 g | 3706 s → 62 min | **R$ 22,75** |
| **Desconto** | | | **R$ 15,99** |

Esse trio (38,74 / 15,99 / 22,75) é o caso de teste do spec. O delta bruto dos
cálculos é R$ 16,00 exatos; o R$ 0,01 de diferença na tela vem do arredondamento
a centavos de cada linha (21,7732 → 21,77 e 16,9745 → 16,97). Por isso o
desconto exibido é `subtotal - total` sobre os valores já arredondados, e não a
fórmula teórica.

### 5.5 Arredondamentos

- Segundos → minutos: `Math.max(1, Math.round(segundos / 60))`.
- Peso: número positivo; `0` ou ausente = item inválido.
- Preços: `formatBRL` (2 casas) na tela e no PDF; o cálculo usa os valores cheios.
- A soma exibida é `Σ round(quote_i.total)`, e o total é `round(batchQuote.total)`;
  o desconto é `subtotal - total` já sobre os valores arredondados, para as três
  linhas fecharem na tela (exemplo do §5.4: 38,74 − 22,75 = 15,99).
- O desconto é sempre ≥ 0; se por arredondamento der negativo, exibir R$ 0,00.

### 5.6 Casos de teste numéricos do lote

Premissas de todos os casos:

- filamento padrão R$ 120 / 1000 g = R$ 0,12/g;
- config de fábrica: `energyKwh 0.92`, `consumoKw 0.07`, `markup 2.0`,
  `machineCost 8`, `hourRate 2.00`, `failureRate 5`;
- itens do perfil 3639209: **Prato 1** 8 g / 3117 s → 52 min; **Prato 2** 1 g /
  589 s → 10 min (mesmo arredondamento do §5.5);
- `N = 2` itens; o lote usa `Σ w = 9 g`, `Σ min = 62`;
- valores em reais, arredondados a centavos na exibição; o cálculo usa os valores
  cheios.

#### Caso A — `q = 2`, `postProcessing = 3` (R$ 3 por peça), sem taxas

Peças por item = 2; peças do lote = `q * N` = 4.

| Item | Peças | Peso × q | Tempo × q | Pós-processamento | Custo | **Preço** |
| --- | --- | --- | --- | --- | --- | --- |
| Prato 1 | 2 | 16 g | 104 min | R$ 6,00 | R$ 19,77 | **R$ 39,55** |
| Prato 2 | 2 | 2 g | 20 min | R$ 6,00 | R$ 14,97 | **R$ 29,95** |

| Lote | Valor |
| --- | --- |
| Filamento | R$ 2,16 |
| Energia | R$ 0,13 |
| Máquina | R$ 4,13 |
| Falha (5%) | R$ 0,32 |
| Setup (1×) | R$ 8,00 |
| Pós-processamento (4 peças × R$ 3) | R$ 12,00 |
| Custo | R$ 26,75 |
| Markup 2,0 | R$ 53,50 |

| Resumo | Valor |
| --- | --- |
| Subtotal (soma das linhas) | **R$ 69,50** |
| Desconto em lote | **−R$ 16,00** |
| **Preço total** | **R$ 53,50** |

Verificações: pós-processamento das linhas (6 + 6) = pós do lote (12); desconto
bruto = `setup 8 × markup 2 / (1 − 0)` = R$ 16,00; sem sobra de arredondamento.

#### Caso B — `q = 3`, `postProcessing = 2`, `taxRate = 6`, `cardFeeRate = 4`

Peças por item = 3; peças do lote = 6; taxa total = 10% (divisor 0,9).

| Item | Peças | Peso × q | Tempo × q | Pós-processamento | Custo | Bruto | **Preço** |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Prato 1 | 3 | 24 g | 156 min | R$ 6,00 | R$ 22,66 | R$ 45,32 | **R$ 50,36** |
| Prato 2 | 3 | 3 g | 30 min | R$ 6,00 | R$ 15,46 | R$ 30,92 | **R$ 34,36** |

| Lote | Valor |
| --- | --- |
| Filamento | R$ 3,24 |
| Energia | R$ 0,20 |
| Máquina | R$ 6,20 |
| Falha (5%) | R$ 0,48 |
| Setup (1×) | R$ 8,00 |
| Pós-processamento (6 peças × R$ 2) | R$ 12,00 |
| Custo | R$ 30,12 |
| Bruto (× 2) | R$ 60,24 |
| Total (÷ 0,9) | R$ 66,94 |

| Resumo | Valor |
| --- | --- |
| Subtotal | **R$ 84,72** |
| Desconto em lote | **−R$ 17,78** |
| **Preço total** | **R$ 66,94** |

Verificações: `Σ pós linhas = 6 + 6 = 12 = pós do lote`; desconto bruto =
`8 × 2 / 0,9` = R$ 17,7778, exibido como R$ 17,78 (84,72 − 66,94); as taxas só
saem do preço e **não** multiplicam o desconto além do previsto.

#### Caso C — `q = 1`, `postProcessing = 3`, sem taxas (prova do `pieces`)

Mesmo com uma cópia de cada prato, o lote tem **2 peças** e o pós-processamento
do lote é R$ 6,00 (duas linhas de R$ 3,00).

| Item | Peças | Pós | **Preço** |
| --- | --- | --- | --- |
| Prato 1 | 1 | R$ 3,00 | **R$ 27,77** |
| Prato 2 | 1 | R$ 3,00 | **R$ 22,97** |

| Resumo | Valor |
| --- | --- |
| Subtotal | **R$ 50,74** |
| Desconto em lote | **−R$ 15,99** |
| **Preço total** | **R$ 34,75** |

O desconto bruto aqui é R$ 15,9999 (16,00) e vira 15,99 na tela porque as linhas
arredondam para 27,77 e 22,97; é o caso que protege contra “consertar” o desconto
com fórmula fixa em vez do delta dos dois cálculos.

#### Asserções que os testes unitários devem cobrir

1. `calculateBatch(items, q)` devolve `pieces === q * N`.
2. `Σ (postProcessing × q)` das linhas == `postProcessing × q × N` do lote.
3. `subtotal = Σ round(quote_i.total)`, `total = round(batchQuote.total)`,
   `desconto = subtotal - total`, `desconto >= 0`.
4. `desconto` (valores cheios) == `(N - 1) × setup × markup / (1 - taxa)`, com
   tolerância de 1e-9 — apenas como checagem interna, nunca como fonte do valor.
5. Com `N = 1`, `desconto === 0` e `showDiscount === false`.
6. Os três casos acima batem centavo a centavo.

---

## 6. Contrato da API (`/api/import`)

### 6.1 Rota

Mesma rota, mesma origem, mesmo parâmetro: `GET /api/import?url=<link>`.
A detecção da fonte é do servidor. Nada de `?source=`.

### 6.2 STLFlix — inalterado

```json
{
  "source": "stlflix",
  "kind": "drop",
  "title": "Drop #378 — Natal Iluminado",
  "url": "https://platform.stlflix.com/pt-BR/drops/drop-378",
  "items": [ { "id": "4541", "title": "...", "url": "...", "thumbnail": "...", "multipart": false, "descriptionHtml": "..." } ]
}
```

Nenhum campo removido ou renomeado. Clientes antigos seguem funcionando.

### 6.3 MakerWorld — novo

```json
{
  "source": "makerworld",
  "kind": "model",
  "title": "Alien with a raised eyebrow (7 grams)",
  "url": "https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams",
  "selectedProfileId": "3639209",
  "profiles": [
    {
      "id": "3158330",
      "title": "Alien (completely green/single-color)",
      "cover": "https://makerworld.bblmw.com/.../5aee503b814303df.jpg",
      "weightG": 7,
      "minutes": 35,
      "needAms": false,
      "colorCount": 1,
      "plates": [
        { "index": 1, "title": "Prato 1", "weightG": 7, "minutes": 35, "thumbnail": "https://makerworld.bblmw.com/.../plate_1.png" }
      ]
    }
  ]
}
```

Regras de normalização no servidor:

- `title` = `titleTranslated || title` do design (fallback `"Modelo do MakerWorld"`).
- `url` = link canônico `https://makerworld.com/{locale}/models/{id}-{slug}`
  (locale preservado do link; default `pt`).
- `selectedProfileId`: `profiled` (ou `#profileId-`) quando existir; `null` caso
  contrário. O cliente usa para pré-selecionar/rolar.
- `profiles[]`: apenas `instances` com `status === 1`, na ordem da API, com o
  `defaultInstanceId` movido para o topo (fallback de pré-seleção).
- `profiles[].title` = `titleTranslated || title || "Perfil N"`.
- `profiles[].weightG` / `minutes`: valores do perfil; se ausentes, soma dos pratos.
- `profiles[].plates[]`: de `extention.modelInfo.plates`, ordenados por `index`;
  `title` = `name.trim() || "Prato " + index`; `minutes` arredondado com mínimo 1;
  `weightG` numérico; `thumbnail` só `https`.
- Perfil sem nenhum prato com peso **e** tempo válidos: `plates: []` (o cliente
  desabilita e explica).
- `title` de prato limitado a 60 caracteres; remover HTML do `name` se vier.

### 6.4 Erros

Formato atual preservado: `{ "error": "<code>", "message": "<texto>" }`.

Códigos existentes: `invalid_url`, `not_found`, `empty`, `upstream_error`.
Acrescentar `unsupported_host`? **Não** — links de outros sites continuam como
`invalid_url` com a mensagem nova (ver §8).

### 6.5 Cache

- Sucesso (STLFlix e MakerWorld):
  `cache-control: public, max-age=7776000, s-maxage=7776000, stale-while-revalidate=86400`
  (90 dias, "cache máximo").
- Erro (qualquer status 4xx/5xx): `cache-control: no-store`.
- `refresh=1` na query:
  - o servidor busca o upstream com `cache: "no-store"`;
  - a resposta sai com `cache-control: no-store` (para não gravar o refresh no
    CDN sob a chave `?refresh=1`);
  - a chave de cache já difere por causa do parâmetro, então o `refresh` sempre
    chega ao servidor.
- O cabeçalho CORS (`ALLOWED_ORIGINS`, `OPTIONS`) fica como está.

---

## 7. Detecção e parsing do link no cliente

`src/core/importer.js` (ou um `src/core/import-link.js` novo) passa a expor:

```js
detectSource(raw) -> { source: 'stlflix' | 'makerworld', ...target } | null
```

### 7.1 MakerWorld

Hosts aceitos: `makerworld.com`, `www.makerworld.com` (https/http).

Caminho:

```
^/(?:[a-z]{2}(?:[-_][a-z]{2})?/)?models/(?<id>\d+)(?:-(?<slug>[a-z0-9][a-z0-9-]*))?/?$
```

Aceita:

- `https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams`
- `https://makerworld.com/en/models/2834113`
- com `?profiled=3639209` e/ou `#profileId-3158330`
- com `?utm_source=...` (descartado)

Recusa: `/collections/...`, `/@autor`, `/pt/models/abc`, outros hosts, http sem
host conhecido. Mensagem única para qualquer link não suportado:

> **Cole um link do STLFlix ou do MakerWorld.**

### 7.2 `fetchImport`

- Sempre chama `${IMPORT_ENDPOINT}?url=${encodeURIComponent(urlCanonica)}`.
- Com `{ refresh: true }`, acrescenta `&refresh=1`.
- Timeout de 15 s, tratamento de `TimeoutError`/`network`/`invalid_response`
  permanece.
- `hydrateImportResult` passa a devolver união discriminada:

```js
{ source: 'stlflix', kind, title, url, items }
{ source: 'makerworld', kind: 'model', title, url, selectedProfileId, profiles }
```

- Se `source === 'makerworld'` e `profiles` não for array → `ImportRequestError`
  `invalid_response` com "O importador devolveu uma resposta inesperada."
- Filtra perfis/pratos inválidos (sem peso/tempo, imagem não https) antes de
  entregar à UI; se sobrar zero perfil → `ImportRequestError('empty', 'Esse
  modelo não tem perfis de impressão com peso e tempo.')`.

---

## 8. Mensagens (pt-BR)

| Situação | Texto |
| --- | --- |
| Link vazio | "Cole o link do modelo ou do drop." |
| Host não suportado | "Cole um link do STLFlix ou do MakerWorld." |
| MakerWorld 404 | "Não encontrei esse modelo no MakerWorld. Confira o link." |
| MakerWorld sem perfis válidos | "Esse modelo não tem perfis de impressão com peso e tempo." |
| MakerWorld fora do ar | "Não consegui falar com o MakerWorld agora. Preencha peso e tempo na Calculadora." |
| STLFlix 404 | "Não encontrei esse modelo no STLFlix. Confira o link." (atual) |
| Sem peso/tempo na resposta | "Não encontrei peso e tempo nesse link." (atual) |
| Adicionar sem prato | botão desabilitado; sem toast |
| Prato duplicado | "Esse prato já está no orçamento." |
| Limite | "Limite de 20 itens por orçamento." |
| Trocou de fonte | "Orçamento anterior substituído: um orçamento por site." |
| Trocou de perfil/modelo | "Orçamento atualizado com o novo perfil." |
| Adicionou | "2 pratos adicionados ao orçamento." (singular: "1 prato adicionado…") |
| Perfil desabilitado | meta "Sem dados de prato" + `title` "Esse perfil não informa peso e tempo dos pratos." |
| Cache | botão/link "Atualizar" na folha de perfis: "Buscar dados novos, ignorando o cache." |

---

## 9. Interface — detalhes de implementação

### 9.1 `index.html`

- Adicionar aba `#tab-batch` (`data-tab="orcamento"`), entre Calculadora e
  Configurações, com `<section class="panel" id="panel-batch" role="tabpanel">`.
- Remover `#importForm` (form, input, botão, hint) do card "Dados da peça".
- Remover o botão `#clientToggle` do cabeçalho.
- Remover do script inline:
  - `client: localStorage.getItem('calc3d_client_mode')`;
  - `const client = saved.client === 'true';`
  - `root.dataset.tab = !client && saved.tab === 'settings' ? 'settings' : 'calc';`
  - `if (client) root.dataset.client = 'on';`
  - Passar a aplicar `root.dataset.tab = saved.tab === 'settings' ? 'settings' : 'calc'`
    e aceitar também `'orcamento'` como aba salva.
- Reutilizar `#importSheet` para as duas fontes, com dois contêineres:
  - `#importItems` (passo atual, STLFlix e perfis MakerWorld);
  - `#importPlates` (grade de pratos, oculto por padrão);
  - rodapé `#importFooter` com `#importBack` e `#importAdd` (oculto no fluxo STLFlix).
- Manter `#importTitle`, `#importSubtitle`, `#importHint`, `#importClose`.
- Card "Modelo e pratos" novo, com `#batchImportForm`, `#batchImportUrl`,
  `#batchImportSubmit`, `#batchRefresh` (Atualizar), `#batchProfileSummary`
  (capa, título, "2 pratos", "Trocar perfil").
- Card "Itens do orçamento": `#batchEmpty`, `#batchItems`, `#batchQuantity`,
  `#batchColors` (chips), `#batchClear`.
- Card de resultado: `#batchResult` (hidden), `#batchWeight`, `#batchTime`,
  `#batchPieces`, `#batchSubtotal`, `#batchDiscountRow`, `#batchDiscount`,
  `#batchTotal`, `#batchSaveHistory`, `#batchExportPdf`.

### 9.2 Módulos novos na calculadora

| Arquivo | Responsabilidade |
| --- | --- |
| `src/core/makerworld.js` | `parseMakerworldLink`, `hydrateMakerworldResult`, formatação de segundos → minutos, rótulo de prato |
| `src/core/batch.js` | Estrutura do orçamento, dedupe, remoção, `calculateBatch` |
| `src/ui/import-sheet.js` | Folha compartilhada: passo de perfis, passo de pratos, cartões STLFlix, "Adicionar" |
| `src/ui/batch.js` | Aba Orçamento: form, resumo do perfil, lista, quantidade, total, botões |

`src/ui/importer.js` atual é absorvido por `import-sheet.js` + `batch.js` e
removido. `src/core/importer.js` mantém o que é STLFlix e passa a delegar a
detecção/normalização.

### 9.3 Estado (`src/core/state.js`)

```js
batch: {
  source: null,          // 'stlflix' | 'makerworld'
  url: '',
  title: '',
  profileId: null,
  profileTitle: '',
  profileCover: null,
  plates: [],            // opcional, para "Escolher outros pratos"
  items: [],             // [{ id, source, title, subtitle, weightG, minutes, thumbnail, profileId, plateIndex }]
  quantity: '1',
  quote: null,           // resultado de calculateBatch
},
```

- `items` é a fonte da verdade da lista; `quote` é derivado.
- Nada vai para `localStorage` (só sessão).
- Eventos novos em `constants.js`:
  - `EVENTS.BATCH_CHANGED` (`'batch:changed'`) — dispara recálculo da aba;
  - `EVENTS.BATCH_IMPORTED` (`'batch:imported'`) — dispara render do resumo.
- A quantidade do lote (`batch.quantity`) é independente de `state.inputs.quantity`.

### 9.4 Filamentos compartilhados

- `src/ui/filaments.js` passa a renderizar os chips em **todos** os contêineres
  com `[data-color-choices]` (hoje é um `#colorChoices` fixo).
- Calculadora mantém `#colorChoices`; Orçamento ganha `#batchColors`.
- Um único `state.selected`; clicar em qualquer chip atualiza os dois e emite
  `EVENTS.SELECTION_CHANGED` (que já recalcula a Calculadora). A aba Orçamento
  escuta o mesmo evento e recalcula o lote.
- Texto do hint igual nos dois lugares.

### 9.5 Recálculo

- `calculateBatch` roda quando: muda item, quantidade, seleção de filamento,
  configuração (`CONFIG_CHANGED`), `FILAMENTS_CHANGED`, `BATCH_CHANGED`.
- Se `items.length === 0` → esconde `#batchResult` e mostra `#batchEmpty`.
- Se algum item tiver peso 0 (não deve acontecer após normalização) → ignora o
  item no lote e mostra toast, sem quebrar o total.

### 9.6 Estilos (`src/styles/components.css`)

Novos blocos, reusando tokens:

- `.batch-import` (variação do `import-strip`);
- `.profile-list`, `.profile-option` (linha com capa 56 px, título, meta,
  estado `is-selected`, `[disabled]` com opacidade e cursor `not-allowed`);
- `.plate-grid` (`grid-template-columns: repeat(2, minmax(0, 1fr))`; 1 coluna
  abaixo de 640 px), `.plate-card` (`label` com borda, `input` visualmente
  escondido mas focável, `:has(input:checked)` para destaque e
  `:focus-visible` no cartão), `.plate-thumb` (`aspect-ratio: 4/3`,
  `object-fit: cover`);
- `.batch-items`, `.batch-item`, `.batch-item-remove`, `.batch-item-meta`;
- `.batch-summary`, `.batch-summary-row`, `.batch-summary-row.is-discount`,
  `.batch-total`;
- `.sheet-footer` (rodapé fixo do diálogo com Voltar/Adicionar).
- Remover `html[data-client='on'] .tabs` de `layout.css`.

Sem novas dependências, sem CDN novo.

### 9.7 Histórico (`src/ui/history.js`)

- Entrada nova ganha campos opcionais:

```js
{
  id, createdAt, quantity, weightGrams, minutes, total,
  itemsCount,                 // N itens
  source: 'makerworld' | 'stlflix' | null,
  items: [{ title, weightGrams, minutes, total }],
  subtotal, discount,
}
```

- Entradas antigas continuam renderizando (campos opcionais ausentes).
- Linha do histórico: `"29/10/2026 14:02 · 2 itens · 9 g · 1h02"` (ou o formato
  atual quando não houver `itemsCount`).
- `saveCurrent()` da Calculadora não muda; `saveBatch()` novo.

### 9.8 PDF (`src/ui/export.js`)

- `generatePdf()` da Calculadora não muda.
- `generateBatchPdf()` novo:
  - título "Orçamento — impressão 3D";
  - data, origem (link do modelo) e perfil;
  - uma linha por item: `"Prato 1 — 8 g · 52 min — R$ 21,77"`;
  - `"Quantidade: 2 de cada"`;
  - `"Subtotal: R$ 38,74"`, `"Desconto em lote: -R$ 15,99"` (só com 2+),
    `"Preço total: R$ 22,75"`;
  - arquivo `orcamento-lote-impressao-3d.pdf`.
- Usar só ASCII no texto do PDF (`-` em vez de `−`), porque a fonte padrão do
  jsPDF não cobre todos os glifos.

---

## 10. Remoção do modo cliente (checklist completo)

| Arquivo | O que remover/ajustar |
| --- | --- |
| `index.html` | botão `#clientToggle` + `.switch` correspondente; leitura de `calc3d_client_mode` e `data-client` no script inline |
| `src/main.js` | `applyClientMode`, `toggleClientMode`, chamada em `init`, listener do botão, `state.clientMode` no boot |
| `src/core/state.js` | campo `clientMode` |
| `src/core/constants.js` | `STORAGE_KEYS.clientMode` e `EVENTS.CLIENT_MODE_CHANGED` |
| `src/ui/calculator.js` | `hint.hidden = state.settingsSeen` (sem `state.clientMode`) |
| `src/styles/layout.css` | regra `html[data-client='on'] .tabs` |
| `qa/tests/01-calculadora.spec.js` | remover o teste "o modo cliente esconde as abas…"; tirar `calc3d_client_mode` do teste de abertura sem layout shift |
| `README.md` | remover a seção "Modo cliente" |
| CSS | se houver `.switch`/`.switch-*` usados só por ele, remover junto |

Observação: `data-client` não é usado por nenhum outro módulo (verificado por
busca). Nada de migração de dados é necessário; chaves antigas no `localStorage`
simplesmente ficam órfãs.

---

## 11. Backend (`../mini-commerce`)

### 11.1 Arquivos

| Arquivo | Mudança |
| --- | --- |
| `src/utils/import/types.ts` | `ImportSource = "stlflix" \| "makerworld"`; `ImportKind` ganha `"model"`; `ImportProfile`/`ImportPlate`; `ImportResult.profiles?`; `selectedProfileId?` |
| `src/utils/import/makerworld.ts` | **novo**: `parseMakerworldUrl` + `resolveMakerworld` |
| `src/utils/import/index.ts` | detecta host (STLFlix → MakerWorld) e delega |
| `src/pages/api/import.ts` | cache longo no sucesso, `no-store` no erro, suporte a `refresh=1` |

### 11.2 `makerworld.ts`

- `parseMakerworldUrl`: mesma regex do cliente (§7.1), devolve
  `{ designId, slug, locale, profileId, url }`.
- `resolveMakerworld`:
  - `GET https://makerworld.com/api/v1/design-service/design/${designId}`;
  - headers: `accept: application/json`, `user-agent` identificando a calculadora
    (ex.: `LimbusCalculadora/1.0 (+https://calculadora.limbus.com.br)`);
  - `AbortSignal.timeout(10_000)`;
  - `refresh` → `cache: "no-store"`;
  - 404 → `ImportError("not_found", "Não encontrei esse modelo no MakerWorld. Confira o link.", 404)`;
  - erro de rede/timeout/JSON → `ImportError("upstream_error", "Não consegui falar com o MakerWorld agora. Preencha peso e tempo na Calculadora.", 502)`;
  - monta `profiles` conforme §6.3, sem repassar o payload cru.
- Proibido vazar campos internos (compatibilidade, URLs de download, autor).

### 11.3 `index.ts`

```ts
const stlflix = parseStlflixUrl(target);
if (stlflix) return resolveStlflix(stlflix);

const makerworld = parseMakerworldUrl(target);
if (makerworld) return resolveMakerworld(makerworld);

throw new ImportError("invalid_url", "Cole um link do STLFlix ou do MakerWorld.", 400);
```

### 11.4 `import.ts`

```ts
const refresh = url.searchParams.get("refresh") === "1";
const result = await resolveImport(target, { refresh });
return json(result, 200, origin, {
  "cache-control": refresh
    ? "no-store"
    : "public, max-age=7776000, s-maxage=7776000, stale-while-revalidate=86400",
});
```

No `catch`, todas as respostas de erro levam `"cache-control": "no-store"`
(hoje os erros herdam o cache padrão do CDN).

### 11.5 Compatibilidade

- A rota continua aceitando e respondendo STLFlix exatamente como hoje.
- O cliente antigo (versão publicada hoje) nunca manda link do MakerWorld, então
  não há quebra.
- Nenhuma migração de banco, nenhum novo secret, nenhuma dependência.

---

## 12. Testes

### 12.1 Calculadora — unitários (`node --test`)

**`tests/makerworld.test.js`** (novo)

- `parseMakerworldLink` aceita pt/en, com e sem slug, com `profiled`, com hash,
  com query de tracking; canonicaliza a URL.
- Recusa: outro host, `/collections/...`, `/@autor`, id não numérico, caminho
  `/models/` sem id, `ftp://`.
- Extrai `profileId` de `?profiled=` e, na falta, de `#profileId-`.
- `hydrateImportResult` com fixture real: 3 perfis, 2 pratos no terceiro,
  títulos traduzidos, `minutes` arredondado, imagem ignorada se não https.
- Payload sem `profiles` e sem `items` → `invalid_response`.
- `profiles` vazio → `empty`.

**`tests/batch.test.js`** (novo)

- Caso base (`q = 1`, `postProcessing = 0`): 2 itens → subtotal 38,74,
  desconto 15,99, total 22,75.
- **Caso A** (`q = 2`, `postProcessing = 3`, sem taxas) → itens 39,55 e 29,95;
  subtotal 69,50; desconto 16,00; total 53,50; `pieces = 4`; pós das linhas
  (6 + 6) igual ao do lote (12).
- **Caso B** (`q = 3`, `postProcessing = 2`, `taxRate = 6`, `cardFeeRate = 4`) →
  itens 50,36 e 34,36; subtotal 84,72; desconto 17,78; total 66,94;
  `pieces = 6`; bruto do lote 60,24 e total 66,94 (divisor 0,9).
- **Caso C** (`q = 1`, `postProcessing = 3`) → 27,77 e 22,97; subtotal 50,74;
  desconto 15,99; total 34,75; `pieces = 2` mesmo com `q = 1`.
- 1 item → `desconto === 0` e `showDiscount === false`.
- Duplicado é rejeitado por `addItem`.
- Remover item recalcula; lista vazia devolve `null`.
- Item com peso 0 é descartado.
- Os seis pontos de asserção do §5.6 devem aparecer como testes nomeados.

**`tests/pricing.test.js`** (ajuste)

- `pieces` ausente = `quantity` (valores atuais intactos).
- `pieces` maior que `quantity` multiplica só o pós-processamento.
- `pieces` inválido/0 cai em `quantity`.

**Fixture** `tests/fixtures/makerworld-design-2834113.json`: resposta real
reduzida (3 instâncias, campos usados, pratos com thumbnail).

### 12.2 Calculadora — QA Playwright

**`qa/tests/04-orcamento.spec.js`** (novo), mockando `**/api/import**`:

1. Aba Orçamento existe, abre no estado vazio e a Calculadora **não** tem mais
   campo de link.
2. Link do MakerWorld → folha abre no passo de perfis com 3 linhas, capas e meta
   "3 pratos · 9 g · 1h02"; perfil pré-selecionado quando `?profiled=3639209`.
3. Escolher "Multipart…" → 2 cartões de prato com `img` apontando para o CDN,
   "Adicionar 2 pratos" habilitado só após marcar.
4. Adicionar → folha fecha, lista com 2 itens, subtotal/desconto/total conforme
   §5.4, peças = 2.
5. Quantidade 2 → peças 4, preços dobram a parte variável.
6. Remover um item → desconto some, total vira o individual restante.
7. Duplicado → toast e lista inalterada; "Limpar orçamento" pede confirmação.
8. Link do STLFlix na mesma aba → item único na lista, toast de substituição
   quando havia itens do MakerWorld.
9. "Atualizar" chama a API com `refresh=1`.
10. Erro 404 do MakerWorld → toast e lista anterior intacta.

**Ajustes**:

- `03-importar.spec.js`: mover o fluxo para a aba Orçamento; STLFlix agora
  adiciona item em vez de preencher `#weight`/`#minutes`.
- `01-calculadora.spec.js`: remover teste do modo cliente; adicionar asserção de
  que existem 3 abas.
- `02-configuracoes.spec.js`: revisar seletores de aba, se houver.

### 12.3 Backend

- Não há suíte unitária no `mini-commerce` para o importador. Mínimo:
  - `npm run typecheck` (`astro check`) verde;
  - teste manual documentado com os três links: modelo do exemplo, modelo de 1
    perfil/1 prato, modelo inexistente;
  - conferir `cache-control` de sucesso e de erro com `curl -D -`;
  - QA Playwright existente do site não cobre a rota, então a validação fica no
    `04-orcamento.spec.js` com mock + uma verificação manual em preview.

---

## 13. Critérios de aceitação

1. Um único campo de link aceita STLFlix e MakerWorld; link de outro site mostra
   "Cole um link do STLFlix ou do MakerWorld.".
2. Colar o link do exemplo abre a folha com os 3 perfis, cada um com imagem,
   título traduzido, nº de pratos, peso e tempo.
3. O perfil de `?profiled=` chega destacado e visível na folha.
4. Escolher o perfil "Multipart…" mostra 2 pratos com imagem, peso e tempo; nada
   vem marcado.
5. Adicionar os 2 pratos gera: subtotal R$ 38,74, desconto R$ 15,99, total
   R$ 22,75, com os padrões de fábrica.
6. O total muda ao trocar cor/filamento, quantidade ou configuração, igual à
   Calculadora.
7. Com 1 item, a linha de desconto não aparece e o total é o individual.
8. Prato repetido não duplica; trocar de fonte limpa a lista com aviso.
9. Salvar no histórico e gerar PDF listam os pratos, o subtotal, o desconto e o
   total; o histórico antigo continua legível.
10. Recarregar a página limpa o orçamento (nada em `localStorage` além do que já
    existia).
11. O modo cliente não existe mais: sem botão, sem `data-client`, sem aba oculta,
    sem teste referenciando `calc3d_client_mode`.
12. `npm test` verde; `npm run test:e2e` verde; `astro check` verde no
    `mini-commerce`.
13. Resposta de sucesso do `/api/import` vem com `max-age=7776000`; resposta de
    erro vem com `no-store`.

---

## 14. Fora de escopo

- Quantidade por item (só global).
- Misturar STLFlix e MakerWorld no mesmo orçamento.
- Link compartilhável com a seleção de pratos.
- Persistir o orçamento entre sessões.
- Editar peso/tempo de um prato importado.
- Casar cores do MakerWorld com filamentos cadastrados (as cores do prato são
  ignoradas no preço).
- Baixar/arquivar o 3MF, autenticação, modelos pagos/exclusivos, links de
  coleção ou de perfil de autor.
- Reescrever a aba Calculadora além da remoção do importador e do modo cliente.
- Novo provedor além de STLFlix/MakerWorld.

---

## 15. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| API interna do MakerWorld mudar/bloquear | Resolvedor isolado em `makerworld.ts`, timeout, erro claro com fallback manual; cache longo reduz exposição |
| Cache de 90 dias mascarar atualização de peso/tempo | Botão "Atualizar" com `refresh=1` |
| `titleTranslated` só em inglês | Fallback para original; aceitar como limitação conhecida |
| Thumbnail com `content-type` genérico ou hotlink bloqueado | `img.onerror` remove a imagem (comportamento atual), layout prevê ausência |
| Peso/tempo arredondados pelo MakerWorld | Valores fixos por decisão; a pessoa pode montar o orçamento manual na Calculadora |
| Confusão entre preço individual e total | Linhas separadas "Subtotal", "Desconto em lote", "Preço total" + hint "Setup cobrado uma vez por impressão." |
| `postProcessing` subcontado no lote | Campo `pieces` em `calculateQuote` (§5.2), coberto por teste |

---

## 16. Ordem de implementação sugerida

1. `mini-commerce`: tipos + `makerworld.ts` + roteamento + cache/refresh.
2. Calculadora, núcleo: parse/hidratação do MakerWorld, `batch.js`, `pieces` em
   `pricing.js` — com os testes unitários.
3. Calculadora, UI: aba Orçamento, folha em dois passos, lista e resultado.
4. Migração do STLFlix para a aba Orçamento e remoção do importador da Calculadora.
5. Remoção do modo cliente.
6. Histórico/PDF do lote.
7. QA Playwright, README e ajustes de texto.
8. Publicação conjunta (backend e frontend) e verificação manual com o link do
   exemplo em produção.
