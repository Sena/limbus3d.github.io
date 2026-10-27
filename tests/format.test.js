import test from 'node:test';
import assert from 'node:assert/strict';

import { formatBRL, formatDateTime, formatDuration, formatWeight } from '../src/core/format.js';
import { DEFAULT_CONFIG, createDefaultConfig, isDefaultConfig } from '../src/core/config.js';

/** O Intl usa espaço não separável entre "R$" e o número. */
const plain = (value) => value.replace(/\u00a0/g, ' ');

test('formatBRL escreve em real', () => {
	assert.equal(plain(formatBRL(32.14)), 'R$ 32,14');
	assert.equal(plain(formatBRL(0)), 'R$ 0,00');
	assert.equal(plain(formatBRL(1234.5)), 'R$ 1.234,50');
	assert.equal(plain(formatBRL(Number.NaN)), 'R$ 0,00');
});

test('formatWeight alterna entre gramas e quilos', () => {
	assert.equal(formatWeight(150), '150 g');
	assert.equal(formatWeight(999), '999 g');
	assert.equal(formatWeight(1000), '1 kg');
	assert.equal(formatWeight(1500), '1,5 kg');
	assert.equal(formatWeight(0), '—');
});

test('formatDuration escreve horas e minutos', () => {
	assert.equal(formatDuration(45), '45 min');
	assert.equal(formatDuration(120), '2h00');
	assert.equal(formatDuration(130), '2h10');
	assert.equal(formatDuration(605), '10h05');
	assert.equal(formatDuration(0), '—');
});

test('formatDateTime devolve a data legível e preserva texto desconhecido', () => {
	assert.match(formatDateTime('2026-10-27T14:03:00.000Z'), /2026/);
	assert.equal(formatDateTime('ontem'), 'ontem');
	assert.equal(formatDateTime(''), '');
});

test('a configuração padrão permite calcular sem nenhum ajuste', () => {
	const config = createDefaultConfig();

	assert.deepEqual(config, { ...DEFAULT_CONFIG });
	assert.equal(isDefaultConfig(config), true);
	assert.notEqual(config, DEFAULT_CONFIG, 'deve devolver uma cópia');
});

test('isDefaultConfig reconhece quando o usuário personalizou', () => {
	assert.equal(isDefaultConfig({ ...createDefaultConfig(), margin: '3' }), false);
	assert.equal(isDefaultConfig({ ...createDefaultConfig(), margin: '2' }), false, 'valor diferente do padrão textual');
	assert.equal(isDefaultConfig(null), true);
});
