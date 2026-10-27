/**
 * format.js — formatação para leitura, em pt-BR.
 */

const currency = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL',
});

/**
 * @param {number} value
 * @returns {string} ex.: "R$ 32,14"
 */
export function formatBRL(value) {
	return currency.format(Number.isFinite(value) ? value : 0);
}

/**
 * @param {string|number|Date} value
 * @returns {string} data e hora legíveis; devolve o valor cru se não for data
 */
export function formatDateTime(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value ?? '');
	return date.toLocaleString('pt-BR');
}

/**
 * @param {number} grams
 * @returns {string} ex.: "150 g" ou "1,2 kg"
 */
export function formatWeight(grams) {
	if (!Number.isFinite(grams) || grams <= 0) return '—';
	if (grams < 1000) return `${Math.round(grams)} g`;
	const kg = grams / 1000;
	return `${kg.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
}

/**
 * @param {number} minutes
 * @returns {string} ex.: "2h10" ou "45 min"
 */
export function formatDuration(minutes) {
	if (!Number.isFinite(minutes) || minutes <= 0) return '—';
	const total = Math.round(minutes);
	const hours = Math.floor(total / 60);
	const rest = total % 60;
	if (hours === 0) return `${rest} min`;
	return `${hours}h${String(rest).padStart(2, '0')}`;
}
