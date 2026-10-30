import test from 'node:test';
import assert from 'node:assert/strict';

import {
	MAX_BATCH_ITEMS,
	addBatchItems,
	calculateBatch,
	removeBatchItem,
} from '../src/core/batch.js';

const filaments = [{ name: 'Cor padrão', price: 120, weight: 1000 }];

const baseConfig = {
	energyKwh: '0.92',
	consumoKw: '0.07',
	markup: '2.0',
	machineCost: '8',
	hourRate: '2.00',
	failureRate: '5',
	postProcessing: '0',
	taxRate: '0',
	cardFeeRate: '0',
};

const items = [
	{ id: 'mw:3639209:1', title: 'Prato 1', weightG: 8, minutes: 52 },
	{ id: 'mw:3639209:2', title: 'Prato 2', weightG: 1, minutes: 10 },
];

/**
 * @param {Record<string, string>} [config]
 * @param {number|string} [quantity]
 * @param {any[]} [list]
 */
function batch(config = {}, quantity = 1, list = items) {
	return calculateBatch({
		items: list,
		quantity,
		filaments,
		selected: [0],
		config: { ...baseConfig, ...config },
	});
}

test('um item vira o preço dele, sem desconto', () => {
	const result = batch({}, 1, [items[0]]);

	assert.equal(result.items.length, 1);
	assert.equal(result.subtotal, 21.77);
	assert.equal(result.total, 21.77);
	assert.equal(result.discount, 0);
	assert.equal(result.showDiscount, false);
	assert.equal(result.pieces, 1);
	assert.equal(result.weightGrams, 8);
	assert.equal(result.minutes, 52);
});

test('dois pratos somam os individuais e descontam o setup repetido', () => {
	const result = batch();

	assert.deepEqual(
		result.items.map((line) => Math.round(line.quote.total * 100) / 100),
		[21.77, 16.97],
	);
	assert.equal(result.subtotal, 38.74);
	assert.equal(result.total, 22.75);
	assert.equal(result.discount, 15.99);
	assert.equal(result.showDiscount, true);
	assert.equal(result.pieces, 2);
	assert.equal(result.weightGrams, 9);
	assert.equal(result.minutes, 62);
});

test('caso A: quantidade 2 e pós-processamento por peça', () => {
	const result = batch({ postProcessing: '3' }, 2);

	assert.deepEqual(
		result.items.map((line) => Math.round(line.quote.total * 100) / 100),
		[39.55, 29.95],
	);
	assert.equal(result.subtotal, 69.5);
	assert.equal(result.total, 53.5);
	assert.equal(result.discount, 16);
	assert.equal(result.pieces, 4);
	assert.equal(result.weightGrams, 18);
	assert.equal(result.minutes, 124);

	// Pós-processamento das linhas (6 + 6) é o mesmo do lote (4 peças × 3).
	assert.equal(
		result.items.reduce((total, line) => total + line.quote.postProcessingCost, 0),
		result.batchQuote.postProcessingCost,
	);
	assert.equal(result.batchQuote.postProcessingCost, 12);
});

test('caso B: quantidade 3, pós-processamento e taxas', () => {
	const result = batch({ postProcessing: '2', taxRate: '6', cardFeeRate: '4' }, 3);

	assert.deepEqual(
		result.items.map((line) => Math.round(line.quote.total * 100) / 100),
		[50.36, 34.36],
	);
	assert.equal(result.subtotal, 84.72);
	assert.equal(result.total, 66.94);
	assert.equal(result.discount, 17.78);
	assert.equal(result.pieces, 6);
	assert.equal(result.weightGrams, 27);
	assert.equal(result.minutes, 186);
	assert.equal(result.batchQuote.postProcessingCost, 12);
	assert.equal(result.batchQuote.feeRate, 0.1);
});

test('caso C: quantidade 1 ainda tem uma peça por prato no pós-processamento', () => {
	const result = batch({ postProcessing: '3' }, 1);

	assert.deepEqual(
		result.items.map((line) => Math.round(line.quote.total * 100) / 100),
		[27.77, 22.97],
	);
	assert.equal(result.subtotal, 50.74);
	assert.equal(result.total, 34.75);
	assert.equal(result.discount, 15.99);
	assert.equal(result.pieces, 2);
	assert.equal(result.batchQuote.postProcessingCost, 6);
});

test('sem itens ou sem filamento utilizável não há orçamento', () => {
	assert.equal(batch({}, 1, []), null);
	assert.equal(
		calculateBatch({
			items,
			quantity: 1,
			filaments: [{ name: 'quebrado', price: 0, weight: 0 }],
			selected: [],
			config: baseConfig,
		}),
		null,
	);
});

test('item sem peso ou tempo é descartado do lote', () => {
	const result = batch({}, 1, [
		items[0],
		{ id: 'zero', title: 'Zero', weightG: 0, minutes: 10 },
		{ id: 'sem-tempo', title: 'Sem tempo', weightG: 5, minutes: 0 },
	]);

	assert.equal(result.items.length, 1);
	assert.equal(result.pieces, 1);
	assert.equal(result.subtotal, 21.77);
});

test('addBatchItems ignora duplicados e avisa quando bate no limite', () => {
	const first = addBatchItems([], [items[0]]);
	assert.equal(first.added, 1);
	assert.equal(first.items.length, 1);

	const duplicate = addBatchItems(first.items, [items[0]]);
	assert.equal(duplicate.added, 0);
	assert.equal(duplicate.duplicates.length, 1);

	const many = Array.from({ length: MAX_BATCH_ITEMS + 2 }, (_, index) => ({
		id: `item-${index}`,
		weightG: 1,
		minutes: 1,
	}));
	const limited = addBatchItems([], many);
	assert.equal(limited.items.length, MAX_BATCH_ITEMS);
	assert.equal(limited.limitReached, true);
});

test('removeBatchItem devolve uma lista nova', () => {
	const list = [items[0], items[1]];
	const removed = removeBatchItem(list, items[0].id);

	assert.equal(removed.length, 1);
	assert.equal(removed[0].id, items[1].id);
	assert.equal(list.length, 2);
});
