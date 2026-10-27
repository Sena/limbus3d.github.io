import test from 'node:test';
import assert from 'node:assert/strict';

import { parseQuantity, parseTime, parseWeight } from '../src/core/parser.js';

test('parseWeight devolve gramas', () => {
	assert.equal(parseWeight('50g'), 50);
	assert.equal(parseWeight('75'), 75);
	assert.equal(parseWeight('1kg'), 1000);
	assert.equal(parseWeight('1,5kg'), 1500);
	assert.equal(parseWeight('2 KG'), 2000);
	assert.equal(parseWeight(' 120 g '), 120);
});

test('parseWeight ignora entrada inválida', () => {
	assert.equal(parseWeight(''), 0);
	assert.equal(parseWeight(null), 0);
	assert.equal(parseWeight(undefined), 0);
	assert.equal(parseWeight('abc'), 0);
	assert.equal(parseWeight('0'), 0);
	assert.equal(parseWeight('-10'), 0);
});

test('parseTime entende o formato HH:MM', () => {
	assert.equal(parseTime('1:10'), 70);
	assert.equal(parseTime('0:30'), 30);
	assert.equal(parseTime('2:00'), 120);
	assert.equal(parseTime('10:05'), 605);
});

test('parseTime entende horas, minutos e combinações', () => {
	assert.equal(parseTime('2h'), 120);
	assert.equal(parseTime('2h30'), 150);
	assert.equal(parseTime('2h30m'), 150);
	assert.equal(parseTime('1,5h'), 90);
	assert.equal(parseTime('2 horas'), 120);
	assert.equal(parseTime('45m'), 45);
	assert.equal(parseTime('90'), 90);
});

test('parseTime ignora entrada inválida', () => {
	assert.equal(parseTime(''), 0);
	assert.equal(parseTime(null), 0);
	assert.equal(parseTime('abc'), 0);
	assert.equal(parseTime('-5'), 0);
});

test('parseQuantity garante inteiro de no mínimo 1', () => {
	assert.equal(parseQuantity('1'), 1);
	assert.equal(parseQuantity('12'), 12);
	assert.equal(parseQuantity('2.9'), 2);
	assert.equal(parseQuantity('0'), 1);
	assert.equal(parseQuantity('-4'), 1);
	assert.equal(parseQuantity(''), 1);
	assert.equal(parseQuantity('abc'), 1);
});
