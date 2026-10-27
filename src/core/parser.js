/**
 * parser.js — leitura dos campos digitados.
 * Aceita o que o fatiador mostra na tela: 50g, 1kg, 45m, 2h, 2h30, 1:10.
 */

/**
 * @param {unknown} value
 * @returns {number} número finito ou 0
 */
function toNumber(value) {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	const parsed = parseFloat(String(value ?? '').replace(',', '.'));
	return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Lê um peso e devolve sempre em gramas.
 * "50g" → 50 · "1kg" → 1000 · "1,5kg" → 1500 · "75" → 75
 * @param {unknown} raw
 * @returns {number} gramas
 */
export function parseWeight(raw) {
	if (raw === null || raw === undefined) return 0;
	const text = String(raw).toLowerCase().replace(',', '.').trim();
	if (!text) return 0;

	const value = toNumber(text);
	if (value <= 0) return 0;

	return /kg|quilo/.test(text) ? value * 1000 : value;
}

/**
 * Lê um tempo e devolve sempre em minutos.
 * "1:10" → 70 · "2h" → 120 · "2h30" → 150 · "45m" → 45 · "90" → 90
 *
 * O formato HH:MM tem prioridade para não ser confundido com a contagem
 * de horas solta.
 * @param {unknown} raw
 * @returns {number} minutos
 */
export function parseTime(raw) {
	if (raw === null || raw === undefined) return 0;
	const text = String(raw).toLowerCase().replace(',', '.').trim();
	if (!text) return 0;

	const clock = text.match(/^(\d+):(\d{1,2})$/);
	if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

	const hours = text.match(/^(\d+(?:\.\d+)?)\s*h(?:oras?|rs?)?\s*(\d+(?:\.\d+)?)?/);
	if (hours) return Number(hours[1]) * 60 + (hours[2] ? Number(hours[2]) : 0);

	const minutes = toNumber(text);
	return minutes > 0 ? minutes : 0;
}

/**
 * Lê a quantidade: inteiro, no mínimo 1.
 * @param {unknown} raw
 * @returns {number}
 */
export function parseQuantity(raw) {
	const value = toNumber(raw);
	if (value < 1) return 1;
	return Math.floor(value);
}
