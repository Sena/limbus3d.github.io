# Calculadora de Impressão 3D

Calculadora para estimar preço de impressão 3D FDM com base em peso, tempo, filamento, energia e custos da máquina.

## Como testar localmente

Como o app carrega `energy.json` e `printers.json` via `fetch()`, é necessário servir os arquivos com um servidor HTTP.

### Com Node.js (serve)

```bash
npx serve . -l 8000
```

Acesse: [http://localhost:8000](http://localhost:8000)

### Com Python

```bash
# Python 3
python -m http.server 8000
```

Acesse: [http://localhost:8000](http://localhost:8000)

### Com VS Code

Instale a extensão **Live Server**, clique com o botão direito em `index.html` → **Open with Live Server**.

## Como usar

### 1) Configurar custos (painel ⚙️)

Clique na engrenagem no canto inferior esquerdo para abrir o **painel de configuração**.

Campos principais:

| Campo | Descrição |
|---|---|
| **Estado (Tarifa)** | Seleciona tarifa média por estado. Pode usar "Manual" para colocar o valor direto. |
| **kWh (R$)** | Valor do kWh na sua fatura (com impostos). |
| **Impressora** | Seleciona sua impressora para sugerir consumo. Ou "Personalizado". |
| **Consumo (kW)** | Consumo médio da impressora em impressão. |
| **Margem** | Fator multiplicador. Ex: `2.0` = dobra o custo (100% de margem). |
| **Meus Filamentos** | Cadastre seus rolos (nome, preço e peso do rolo). Selecione quais cores/filamentos vão ser usados na peça. |
| **Setup (R$)** | Custo fixo por impressão (fatiamento/setup). |
| **Máquina (R$/h)** | Custo por hora de máquina ligada (depreciação/manutenção). |
| **Taxa de falha (%)** | Percentual para cobrir falhas, retrabalhos e desperdício. |
| **Pós-processamento (R$)** | Custos após impressão: remoção de suportes, lixamento, acabamento, pintura etc. (valor por peça/lote). |

### 2) Calcular preço

No simulador principal:

1. **Cores utilizadas nesta peça** - Selecione os filamentos que serão usados
2. **Quantidade de Peças** - Quantas cópias idênticas
3. **Peso** - Peso total indicado pelo fatiador. Aceita `g`, `kg` ou número
4. **Tempo** - Tempo total indicado pelo fatiador. Aceita `m`, `h`, `HH:MM` ou número (em minutos)

Exemplos válidos:

- Peso: `50g`, `1kg`, `75`
- Tempo: `45m`, `2h`, `1:10`, `90`

O preço total aparece automaticamente assim que peso e filamentos estiverem preenchidos.

## Parâmetros via URL

É possível preencher os campos direto pela URL usando parâmetros curtos:

| Parâmetro | Campo |
|---|---|
| `q` | Quantidade de peças |
| `w` | Peso |
| `t` | Tempo |

**Exemplo:**

```
http://localhost:8000/?q=3&w=50g&t=1:10
```

Também é possível compartilhar a configuração completa usando o botão **"Copiar Link"** no painel de configuração. Esse link já salva filamentos, valores e configurações.

## Recursos adicionais

| Recurso | Como usar |
|---|---|
| **Tema claro/escuro** | Botão `Tema` no topo da tela |
| **Modo Cliente** | Botão `Modo Cliente: ON/OFF` - alterna visualização |
| **Histórico** | Botão `Histórico` para ver últimos cálculos salvos. Use `Salvar no Histórico` no resultado |
| **Presets** | No painel de config, salve/carregue/exclua configurações completas |
| **QR Code** | Gere QR do link compartilhável para abrir em outro dispositivo |
| **Gerar PDF** | Gere orçamento em PDF direto do resultado |
| **Compartilhar config** | Use `Copiar Link` ou `Gerar QR Code` no painel de configuração |

## Dicas

- **Múltiplas cores**: Ao selecionar mais de um filamento, o cálculo usa o filamento **mais caro por grama** entre os selecionados.
- **Taxa de falha**: Aplica sobre o subtotal (filamento + energia + setup + máquina + pós-processamento) antes da margem.
- **Pós-processamento**: Geralmente é um valor fixo por peça. Multiplica pela quantidade automaticamente.
- **Margem**: `2.0` é comum para cobrir lucro + custos. Ajuste conforme seu negócio.
- **Link compartilhado**: Perfeito para enviar orçamento/configuração para outra pessoa.