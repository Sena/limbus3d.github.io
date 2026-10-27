/**
 * pricing.js — o cálculo de preço, isolado do DOM.
 *
 * A ordem das contas é a mesma da versão anterior:
 *   filamento + energia + setup + máquina + pós-processamento
 *   → taxa de falha
 *   → margem
 *
 * O setup é cobrado uma vez por impressão (não por peça); tudo que depende de
 * tempo ou de quantidade é multiplicado.
 */

/**
 * @typedef {Object} Filament
 * @property {string} name
 * @property {number|string} price preço do rolo
 * @property {number|string} weight peso do rolo, em gramas
 */

/**
 * @typedef {Object} QuoteConfig
 * @property {number|string} energyKwh custo do kWh
 * @property {number|string} consumoKw consumo médio da máquina, em kW
 * @property {number|string} margin multiplicador aplicado no fim
 * @property {number|string} machineCost setup por impressão
 * @property {number|string} hourRate custo por hora de máquina
 * @property {number|string} failureRate percentual de perda
 * @property {number|string} postProcessing valor por peça, após imprimir
 */

/**
 * @typedef {Object} QuoteInput
 * @property {number} weightGrams
 * @property {number} minutes
 * @property {number} quantity
 * @property {Filament[]} filaments
 * @property {number[]} selected índices dos filamentos marcados
 * @property {QuoteConfig} config
 */

/**
 * @param {unknown} value
 * @returns {number}
 */
export function toNumber(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	const parsed = parseFloat(String(value ?? '').replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Custo de um grama do filamento. Zero quando o cadastro está incompleto,
 * para um rolo sem peso não virar preço infinito.
 * @param {Filament} filament
 * @returns {number} R$ por grama
 */
export function costPerGram(filament) {
	const price = toNumber(filament?.price);
	const grams = toNumber(filament?.weight);
	if (price <= 0 || grams <= 0) return 0;
	return price / grams;
}

/**
 * Calcula o orçamento de uma impressão.
 *
 * Sem peso informado ou sem nenhum filamento utilizável devolve `null`, que é
 * o sinal para a interface mostrar o estado vazio em vez de um preço.
 *
 * Com filamentos marcados, usa o mais caro por grama entre os marcados — é a
 * regra que já existia e que evita vender abaixo do custo em peça multicolor.
 *
 * @param {QuoteInput} input
 * @returns {(null | {
 *   total: number,
 *   unitPrice: number,
 *   quantity: number,
 *   minutes: number,
 *   hours: number,
 *   weightGrams: number,
 *   pricePerGram: number,
 *   filamentCost: number,
 *   energyCost: number,
 *   setupCost: number,
 *   machineCost: number,
 *   postProcessingCost: number,
 *   failureCost: number,
 *   baseCost: number,
 *   subtotal: number,
 *   margin: number
 * })}
 */
export function calculateQuote(input) {
	const weightGrams = toNumber(input?.weightGrams);
	const minutes = toNumber(input?.minutes);
	const quantity = Math.max(1, Math.floor(toNumber(input?.quantity) || 1));
	const filaments = Array.isArray(input?.filaments) ? input.filaments : [];
	const config = input?.config ?? {};

	const usable = filaments.filter((filament) => costPerGram(filament) > 0);
	if (weightGrams <= 0 || usable.length === 0) return null;

	const selected = Array.isArray(input?.selected) ? input.selected : [];
	const chosen = selected
		.map((index) => filaments[index])
		.filter((filament) => costPerGram(filament) > 0);

	const pool = chosen.length > 0 ? chosen : [usable[0]];
	const pricePerGram = Math.max(...pool.map(costPerGram));

	const hours = (minutes * quantity) / 60;
	const filamentCost = weightGrams * quantity * pricePerGram;
	const energyCost = toNumber(config.consumoKw) * hours * toNumber(config.energyKwh);
	const setupCost = toNumber(config.machineCost);
	const machineCost = hours * toNumber(config.hourRate);
	const postProcessingCost = toNumber(config.postProcessing) * quantity;

	const baseCost = filamentCost + energyCost + setupCost + machineCost + postProcessingCost;

	const failureRate = toNumber(config.failureRate);
	const failureCost = failureRate > 0 ? baseCost * (failureRate / 100) : 0;
	const subtotal = baseCost + failureCost;

	const margin = toNumber(config.margin);
	const total = subtotal * margin;

	return {
		total,
		unitPrice: total / quantity,
		quantity,
		minutes,
		hours,
		weightGrams,
		pricePerGram,
		filamentCost,
		energyCost,
		setupCost,
		machineCost,
		postProcessingCost,
		failureCost,
		baseCost,
		subtotal,
		margin,
	};
}
