import test from 'node:test';
import assert from 'node:assert/strict';

import { buildShareUrl, decodeSettings, encodeSettings, readUrlInputs } from '../src/core/url.js';

test('codifica e decodifica mantendo acentos e emoji', () => {
	const settings = { filaments: [{ name: 'Cor padrão 🎨', price: 120, weight: 1000 }], margin: '2.0' };
	const roundTrip = decodeSettings(encodeSettings(settings));

	assert.deepEqual(roundTrip, settings);
});

test('decodifica links gerados pela versão antiga, em latin-1', () => {
	const legacy = btoa(JSON.stringify({ filaments: [{ name: 'Cor padrão', price: 120, weight: 1000 }] }));
	const decoded = decodeSettings(legacy);

	assert.equal(decoded.filaments[0].name, 'Cor padrão');
});

test('monta o link a partir da configuração', () => {
	const url = buildShareUrl({ origin: 'https://calculadora.limbus.com.br', pathname: '/' }, { margin: '2' });

	assert.ok(url.startsWith('https://calculadora.limbus.com.br/?data='));
	assert.deepEqual(decodeSettings(url.split('?data=')[1]), { margin: '2' });
});

test('lê os atalhos q, w e t', () => {
	const input = readUrlInputs('?q=3&w=50g&t=1:10');

	assert.equal(input.quantity, '3');
	assert.equal(input.weight, '50g');
	assert.equal(input.time, '1:10');
	assert.equal(input.settings, null);
});

test('lê a configuração completa em data', () => {
	const payload = encodeSettings({ margin: '3', filaments: [] });
	const input = readUrlInputs(`?data=${payload}&q=2`);

	assert.equal(input.settings.margin, '3');
	assert.equal(input.quantity, '2');
});

test('parâmetro vazio é ignorado em vez de apagar o valor atual', () => {
	const input = readUrlInputs('?q=&w=&t=');

	assert.equal(input.quantity, null);
	assert.equal(input.weight, null);
	assert.equal(input.time, null);
});

test('link inválido não quebra a leitura dos outros parâmetros', () => {
	const input = readUrlInputs('?data=%%%invalido%%%&w=80g');

	assert.equal(input.settings, null);
	assert.equal(input.weight, '80g');
});

test('sem query string nada é definido', () => {
	const input = readUrlInputs('');

	assert.deepEqual(input, { settings: null, quantity: null, weight: null, time: null });
});
