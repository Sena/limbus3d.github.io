# Calculadora de Impressão 3D

Calculadora de preço para impressão 3D FDM. A partir do peso e do tempo que o
fatiador mostra, ela soma filamento, energia, setup, hora de máquina, taxa de
falha e pós-processamento, e aplica a margem.

O app **funciona sem nenhuma configuração**: vem com custos e um filamento
padrão razoáveis, então basta informar peso e tempo para ver o preço.

## Rodando localmente

O projeto é estático: nada é compilado. Só precisa de um servidor HTTP, porque
as tabelas em `src/data` são carregadas via `fetch()`.

```bash
npm run dev          # sobe em http://localhost:8000
```

Qualquer servidor estático serve:

```bash
npx serve . -l 8000
python -m http.server 8000
```

No VS Code, a extensão **Live Server** em `index.html` também funciona.

## Testes

```bash
npm test             # node --test, sem dependências
```

Os testes cobrem a leitura dos campos (`parser`), o cálculo (`pricing`), o
orçamento de vários itens (`batch`), o link compartilhável (`url`), a formatação
(`format`) e a importação de links (`importer`, `makerworld`).

```bash
npm run test:e2e     # Playwright, desktop e telefone
```

## Como usar

### Calculadora

| Campo | O que aceita |
| --- | --- |
| **Quantidade** | Número de cópias idênticas |
| **Peso** | `50g`, `1kg`, `1,5kg` ou só o número (gramas) |
| **Tempo** | `45m`, `2h`, `2h30`, `1:10` (uma hora e dez) ou minutos |

**Cores usadas nesta peça** são os filamentos marcados. Com mais de um marcado,
o cálculo usa o **mais caro por grama** entre eles, para não vender abaixo do
custo em peça multicolor. Sem nenhum marcado, vale o primeiro filamento da lista.

### Orçamento

A aba **Orçamento** importa peso e tempo de links do **MakerWorld** e do
**STLFlix**, no mesmo campo — o sistema identifica a fonte.

No MakerWorld a pessoa escolhe **um perfil de impressão** e marca **quais
pratos** entram no orçamento, com imagem, peso e tempo de cada um. No STLFlix,
escolhe o modelo/drop e a versão, como antes.

Cada item tem preço individual, como se fosse um orçamento sozinho. No fim, o
lote é recalculado com peso e tempo somados e **um único setup**, e a diferença
aparece como **desconto em lote**:

| Linha | O que é |
| --- | --- |
| Subtotal | Soma dos preços individuais |
| Desconto em lote | Subtotal − total com setup único (só com 2+ itens) |
| Preço total | O valor do lote |

A **quantidade** vale para todos os itens (cópias de cada prato) e as **cores**
são as mesmas da Calculadora. O orçamento fica só na sessão: recarregar limpa a
lista.

### Configurações

| Grupo | Para quê |
| --- | --- |
| **Energia** | Tarifa média do estado ou valor da sua fatura |
| **Impressora** | Modelo (ajusta o consumo) ou consumo em kW na mão |
| **Custos fixos** | Setup por impressão, R$/h de máquina e margem |
| **Perdas e acabamento** | Taxa de falha (%) e pós-processamento por peça |
| **Meus filamentos** | Nome, preço do rolo e peso do rolo |
| **Presets** | Salvar e reusar uma configuração inteira com nome |
| **Compartilhar** | Link e QR Code com a configuração atual |

A aba **Configurações** mostra um ponto ao lado do nome até você abri-la pela
primeira vez — é o convite para revisar os padrões. Depois disso ele não
incomoda mais.

### Pós-processamento

É o que acontece **depois** que a impressão termina: remover suportes, lixar,
preencher, pintar, polir. Informe o valor médio **por peça** e ele é
multiplicado pela quantidade.

## Parâmetros na URL

| Parâmetro | Campo | Exemplo |
| --- | --- | --- |
| `q` | Quantidade | `?q=3` |
| `w` | Peso | `?w=50g` |
| `t` | Tempo | `?t=1:10` |
| `data` | Configuração completa em base64 | gerado pelo botão *Copiar link* |

```
https://calculadora.limbus.com.br/?q=3&w=50g&t=1:10
```

## Estrutura

```
index.html                página única, com as três abas
src/
  main.js                 ponto de entrada: carrega dados e inicializa módulos
  core/                   regra de negócio, sem DOM (é o que os testes cobrem)
    constants.js          chaves de armazenamento, eventos, limites
    config.js             campos, valores padrão, filamento padrão
    parser.js             leitura de peso, tempo e quantidade
    pricing.js            cálculo do orçamento
    importer.js           link externo vira peso e tempo (STLFlix e MakerWorld)
    makerworld.js         link, perfis e pratos do MakerWorld
    batch.js              orçamento de vários itens e desconto de lote
    import-error.js       erro de importação com mensagem pronta
    url.js                link compartilhável e parâmetros de URL
    format.js             moeda, data, peso e duração em pt-BR
    storage.js            localStorage tolerante a falhas
    bus.js                barramento de eventos interno
    state.js              estado compartilhado
  ui/                     interface; cada arquivo cuida de um pedaço da tela
    import-sheet.js       folha com perfis, pratos e versões
    batch.js              aba Orçamento: lista, totais, histórico e PDF
  styles/
    tokens.css            cores, tipografia, espaços, movimento
    base.css              reset e estados de foco
    layout.css            casca, abas, grades
    components.css        cartões, campos, botões, resultado, histórico
  data/
    energy.json           tarifas por estado
    printers.json         impressoras por fabricante, com consumo médio
tests/                    testes de node --test
```

Os módulos de `core` são funções puras: não conhecem o DOM e podem rodar em
qualquer ambiente. Os módulos de `ui` conversam entre si pelo barramento de
eventos (`bus.js`), e quem grava no `localStorage` é somente `ui/settings.js`,
para não haver dois escritores no mesmo registro.

A importação de links passa pela rota `GET /api/import?url=`, do repositório
`mini-commerce`. Ela resolve o link no servidor (o navegador não consegue falar
direto com STLFlix nem MakerWorld) e devolve peso e tempo já normalizados.
`?refresh=1` rebusca ignorando o cache.

## Editando as tabelas

`src/data/energy.json` guarda a tarifa média por estado:

```json
{ "sp": { "name": "São Paulo", "value": 0.92 } }
```

`src/data/printers.json` guarda o consumo médio de cada modelo, em kW:

```json
{ "Bambu Lab": [{ "model": "A1 Mini", "watts": 0.045 }] }
```

O campo se chama `watts` por histórico, mas o valor está em kW.

## Publicação

O site é servido direto do repositório, sem build e sem passo de compilação.
Qualquer alteração em `main` entra no ar como está. O domínio está em `CNAME`.
