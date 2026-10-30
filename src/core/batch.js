/**
 * batch.js — orçamento de vários itens, com o setup cobrado uma vez.
 *
 * Cada item é calculado sozinho, como se fosse um orçamento isolado. O lote é
 * um segundo cálculo, com peso e tempo somados e um único setup. O desconto é
 * a diferença entre os dois — nunca uma fórmula fixa, para fechar centavo a
 * centavo com o que aparece na tela.
 */

import { calculateQuote, toNumber } from './pricing.js';

/** Proteção de layout: acima disso a lista fica impraticável. */
export const MAX_BATCH_ITEMS = 20;

/**
 * @param {number} value
 * @returns {number}
 */
export function round2(value) {
	return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Cria um orçamento vazio.
 * @returns {{
 *   source: string|null, url: string, title: string, profileId: string|null,
 *   profileTitle: string, profileCover: string|null, items: any[],
 *   quantity: string, result: any
 * }}
 */
export function createBatch() {
	return {
		source: null,
		url: '',
		title: '',
		profileId: null,
		profileTitle: '',
		profileCover: null,
		items: [],
		quantity: '1',
		result: null,
	};
}

/**
 * Junta itens novos sem duplicar. Devolve uma lista nova.
 * @param {any[]} existing
 * @param {any[]} incoming
 */
export function addBatchItems(existing, incoming) {
	const items = Array.isArray(existing) ? [...existing] : [];
	const list = Array.isArray(incoming) ? incoming : [];
	const duplicates = [];
	let added = 0;
	let limitReached = false;

	for (const item of list) {
		if (!item?.id) continue;
		if (items.some((current) => current.id === item.id)) {
			duplicates.push(item);
			continue;
		}
		if (items.length >= MAX_BATCH_ITEMS) {
			limitReached = true;
			break;
		}
		items.push(item);
		added += 1;
	}

	return { items, added, duplicates, limitReached };
}

/**
 * @param {any[]} items
 * @param {string} id
 */
export function removeBatchItem(items, id) {
	return (Array.isArray(items) ? items : []).filter((item) => item.id !== id);
}

/**
 * Calcula linhas, subtotal, desconto e total.
 *
 * Devolve `null` quando não há item ou nenhum filamento utilizável — é o sinal
 * para a tela esconder o resultado, como na Calculadora.
 *
 * @param {{
 *   items: any[],
 *   quantity: number|string,
 *   filaments: import('./pricing.js').Filament[],
 *   selected: number[],
 *   config: any,
 * }} input
 */
export function calculateBatch(input) {
	const items = Array.isArray(input?.items) ? input.items : [];
	if (items.length === 0) return null;

	const quantity = Math.max(1, Math.floor(toNumber(input?.quantity) || 1));
	const usable = items.filter(
		(item) => Number(item?.weightG) > 0 && Number(item?.minutes) > 0,
	);
	if (usable.length === 0) return null;

	const lines = usable.map((item) => ({
		...item,
		quote: calculateQuote({
			weightGrams: Number(item.weightG),
			minutes: Number(item.minutes),
			quantity,
			pieces: quantity,
			filaments: input.filaments,
			selected: input.selected,
			config: input.config,
		}),
	}));

	if (lines.some((line) => !line.quote)) return null;

	const weightGrams = lines.reduce((total, line) => total + Number(line.weightG), 0);
	const minutes = lines.reduce((total, line) => total + Number(line.minutes), 0);

	const batchQuote = calculateQuote({
		weightGrams,
		minutes,
		quantity,
		pieces: quantity * lines.length,
		filaments: input.filaments,
		selected: input.selected,
		config: input.config,
	});

	if (!batchQuote) return null;

	const subtotal = round2(
		lines.reduce((total, line) => total + round2(line.quote.total), 0),
	);
	const total = round2(batchQuote.total);

	return {
		items: lines,
		quantity,
		pieces: quantity * lines.length,
		weightGrams: weightGrams * quantity,
		minutes: minutes * quantity,
		subtotal,
		total,
		discount: Math.max(0, round2(subtotal - total)),
		showDiscount: lines.length > 1,
		batchQuote,
	};
}
