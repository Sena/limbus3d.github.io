import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateQuote, costPerGram, feeRateOf } from '../src/core/pricing.js';

const config = (overrides = {}) => ({
	energyKwh: '1',
	consumoKw: '0.07',
	markup: '2',
	machineCost: '8',
	hourRate: '2',
	failureRate: '0',
	postProcessing: '0',
	taxRate: '0',
	cardFeeRate: '0',
	...overrides,
});

const filamentA = { name: 'A', price: 120, weight: 1000 };
const filamentB = { name: 'B', price: 200, weight: 1000 };

const base = (overrides = {}) => ({
	weightGrams: 50,
	minutes: 60,
	quantity: 1,
	filaments: [filamentA],
	selected: [],
	config: config(),
	...overrides,
});

/**
 * @param {number} actual
 * @param {number} expected
 */
const near = (actual, expected) =>
	assert.ok(Math.abs(actual - expected) < 1e-9, `esperado ${expected}, veio ${actual}`);

test('costPerGram lê preço e peso, inclusive em texto', () => {
	assert.equal(costPerGram(filamentA), 0.12);
	assert.equal(costPerGram({ price: '120', weight: '1000' }), 0.12);
	assert.equal(costPerGram({ price: 0, weight: 1000 }), 0);
	assert.equal(costPerGram({ price: 120, weight: 0 }), 0);
	assert.equal(costPerGram({ price: 'abc', weight: 1000 }), 0);
	assert.equal(costPerGram(undefined), 0);
});

test('sem peso ou sem filamento utilizável não há orçamento', () => {
	assert.equal(calculateQuote(base({ weightGrams: 0 })), null);
	assert.equal(calculateQuote(base({ filaments: [] })), null);
	assert.equal(calculateQuote(base({ filaments: [{ name: 'vazio', price: 0, weight: 0 }] })), null);
});

test('soma filamento, energia, setup e máquina, e aplica o markup', () => {
	const quote = calculateQuote(base());

	assert.equal(quote.filamentCost, 6);
	assert.equal(quote.energyCost, 0.07);
	assert.equal(quote.setupCost, 8);
	assert.equal(quote.machineCost, 2);
	assert.equal(quote.costTotal, 16.07);
	assert.equal(quote.grossPrice, 32.14);
	assert.equal(quote.total, 32.14);
});

test('a quantidade multiplica material, tempo e pós-processamento, mas não o setup', () => {
	const quote = calculateQuote(base({ quantity: 2 }));

	assert.equal(quote.filamentCost, 12);
	assert.equal(quote.energyCost, 0.14);
	assert.equal(quote.machineCost, 4);
	assert.equal(quote.setupCost, 8);
	assert.equal(quote.costTotal, 24.14);
	assert.equal(quote.total, 48.28);
	assert.equal(quote.unitPrice, 24.14);
});

test('o pós-processamento é cobrado por peça', () => {
	const quote = calculateQuote(base({ quantity: 2, config: config({ postProcessing: '5' }) }));

	assert.equal(quote.postProcessingCost, 10);
	assert.equal(quote.costTotal, 34.14);
	assert.equal(quote.total, 68.28);
});

test('a taxa de falha incide só sobre material, energia e máquina', () => {
	const quote = calculateQuote(base({ config: config({ failureRate: '10', postProcessing: '5' }) }));

	assert.equal(quote.failureBase, 8.07);
	near(quote.failureCost, 0.807);
	assert.equal(quote.costTotal, 8.07 + 0.807 + 8 + 5);
	assert.equal(quote.total, quote.costTotal * 2);
});

test('imposto e taxa do cartão saem do preço, sem comer o markup', () => {
	const quote = calculateQuote(base({ config: config({ taxRate: '10' }) }));

	assert.equal(quote.feeRate, 0.1);
	near(quote.fees, 32.14 / 0.9 - 32.14);
	assert.equal(quote.total, 32.14 / 0.9);
	assert.equal(quote.total * 0.9, 32.14);
});

test('imposto e taxa do cartão somam num percentual só', () => {
	assert.equal(feeRateOf({ taxRate: '6', cardFeeRate: '4' }), 0.1);
	assert.equal(feeRateOf({}), 0);
	assert.equal(feeRateOf({ taxRate: '-3' }), 0);
	assert.equal(feeRateOf({ taxRate: '150' }), 0.95);
});

test('com filamentos marcados, vale o mais caro por grama', () => {
	const quote = calculateQuote(base({ filaments: [filamentA, filamentB], selected: [0, 1] }));

	assert.equal(quote.pricePerGram, 0.2);
	assert.equal(quote.filamentCost, 10);
	assert.equal(quote.total, 40.14);
});

test('sem filamento marcado, usa o primeiro utilizável da lista', () => {
	const quote = calculateQuote(base({ filaments: [filamentA, filamentB], selected: [] }));
	assert.equal(quote.pricePerGram, 0.12);
});

test('filamento marcado inválido é ignorado na escolha', () => {
	const broken = { name: 'quebrado', price: 0, weight: 0 };
	const quote = calculateQuote(base({ filaments: [filamentA, broken], selected: [1] }));
	assert.equal(quote.pricePerGram, 0.12);
});

test('markup igual a 1 vende pelo custo', () => {
	const quote = calculateQuote(base({ config: config({ markup: '1' }) }));
	assert.equal(quote.total, 16.07);
});

test('tempo em horas é convertido a partir dos minutos', () => {
	const quote = calculateQuote(base({ minutes: 90 }));
	assert.equal(quote.hours, 1.5);
	assert.equal(quote.machineCost, 3);
});

test('sem pieces, o pós-processamento segue a quantidade', () => {
	const quote = calculateQuote(base({ quantity: 2, config: config({ postProcessing: '5' }) }));

	assert.equal(quote.pieces, 2);
	assert.equal(quote.postProcessingCost, 10);
});

test('pieces multiplica só o pós-processamento', () => {
	const reference = calculateQuote(
		base({ quantity: 2, config: config({ postProcessing: '3' }) }),
	);
	const quote = calculateQuote(
		base({ quantity: 2, pieces: 4, config: config({ postProcessing: '3' }) }),
	);

	assert.equal(quote.pieces, 4);
	assert.equal(quote.postProcessingCost, 12);
	assert.equal(reference.postProcessingCost, 6);
	assert.equal(quote.filamentCost, reference.filamentCost);
	assert.equal(quote.machineCost, reference.machineCost);
	// A diferença de R$ 6 de pós entra no custo e é multiplicada pelo markup 2.
	assert.equal(quote.total - reference.total, 12);
	assert.equal(quote.unitPrice, quote.total / 4);
});

test('pieces inválido cai na quantidade', () => {
	const quote = calculateQuote(base({ quantity: 2, pieces: 0 }));
	assert.equal(quote.pieces, 2);
});
