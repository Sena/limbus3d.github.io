import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
	hydrateMakerworldPayload,
	makerworldItem,
	parseMakerworldLink,
} from '../src/core/makerworld.js';
import { ImportRequestError, hydrateImportResult } from '../src/core/importer.js';

const design = JSON.parse(
	await readFile(new URL('./fixtures/makerworld-design-2834113.json', import.meta.url), 'utf8'),
);

test('parseMakerworldLink canonicaliza o link do modelo', () => {
	assert.deepEqual(
		parseMakerworldLink(
			'https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams?profiled=3639209#profileId-3158330',
		),
		{
			designId: '2834113',
			slug: 'alien-with-a-raised-eyebrow-7-grams',
			locale: 'pt',
			profileId: '3639209',
			url: 'https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams',
		},
	);

	assert.equal(
		parseMakerworldLink('https://makerworld.com/en/models/2834113')?.url,
		'https://makerworld.com/en/models/2834113',
	);

	assert.equal(
		parseMakerworldLink('https://www.makerworld.com/pt/models/2834113#profileId-3158330')?.profileId,
		'3158330',
	);
});

test('parseMakerworldLink recusa outros hosts e caminhos', () => {
	const rejected = [
		'',
		'makerworld.com/pt/models/2834113',
		'ftp://makerworld.com/pt/models/2834113',
		'https://makerworld.com.evil.example/pt/models/2834113',
		'https://example.com/pt/models/2834113',
		'https://makerworld.com/pt/collections/123',
		'https://makerworld.com/@autor',
		'https://makerworld.com/pt/models/alien',
		'https://makerworld.com/pt/models/',
	];

	for (const url of rejected) {
		assert.equal(parseMakerworldLink(url), null, url);
	}
});

test('parseMakerworldLink ignora profiled inválido', () => {
	assert.equal(
		parseMakerworldLink('https://makerworld.com/pt/models/2834113?profiled=abc')?.profileId,
		null,
	);
});

test('hydrateMakerworldPayload preserva a ordem dos perfis e dos pratos', () => {
	const result = hydrateMakerworldPayload(design);

	assert.equal(result.source, 'makerworld');
	assert.equal(result.kind, 'model');
	assert.equal(result.title, 'Alien with a raised eyebrow (7 grams)');
	assert.equal(result.selectedProfileId, '3639209');
	assert.equal(result.profiles.length, 3);

	const multipart = result.profiles[2];
	assert.equal(multipart.id, '3639209');
	assert.equal(multipart.weightG, 9);
	assert.equal(multipart.minutes, 62);
	assert.deepEqual(
		multipart.plates.map((plate) => [plate.index, plate.weightG, plate.minutes]),
		[
			[1, 8, 52],
			[2, 1, 10],
		],
	);
	assert.match(multipart.plates[0].thumbnail, /^https:\/\//);
});

test('hydrateMakerworldPayload descarta pratos sem peso, tempo ou imagem insegura', () => {
	const result = hydrateMakerworldPayload({
		source: 'makerworld',
		title: 'Modelo',
		url: 'https://makerworld.com/pt/models/1',
		profiles: [
			{
				id: '1',
				title: 'Perfil',
				plates: [
					{ index: 1, title: '', weightG: 10, minutes: 5 },
					{ index: 2, weightG: 0, minutes: 5 },
					{ index: 3, weightG: 5, minutes: 0 },
				],
			},
			{ id: '2', title: 'Sem pratos', plates: [] },
		],
	});

	assert.equal(result.profiles.length, 2);
	assert.deepEqual(result.profiles[0].plates, [
		{
			index: 1,
			title: 'Prato 1',
			weightG: 10,
			minutes: 5,
			thumbnail: null,
		},
	]);
	assert.equal(result.profiles[1].plates.length, 0);
});

test('hydrateMakerworldPayload exige o contrato e pelo menos um perfil', () => {
	assert.throws(
		() => hydrateMakerworldPayload(null),
		(error) =>
			error instanceof ImportRequestError &&
			error.code === 'invalid_response',
	);
	assert.throws(
		() => hydrateMakerworldPayload({ profiles: [] }),
		(error) => error instanceof ImportRequestError && error.code === 'empty',
	);
});

test('hydrateImportResult reconhece a resposta do MakerWorld', () => {
	const result = hydrateImportResult(design);
	assert.equal(result.source, 'makerworld');
	assert.equal(result.profiles.length, 3);
});

test('makerworldItem monta o item do orçamento com id estável', () => {
	const result = hydrateMakerworldPayload(design);
	const profile = result.profiles[2];
	const item = makerworldItem(result, profile, profile.plates[1]);

	assert.equal(item.id, 'mw:3639209:2');
	assert.equal(item.source, 'makerworld');
	assert.equal(item.title, 'Prato 2');
	assert.equal(item.subtitle, 'Multipart - 0.2mm layer, 2 walls, 8% infill');
	assert.equal(item.weightG, 1);
	assert.equal(item.minutes, 10);
	assert.equal(item.profileId, '3639209');
	assert.equal(item.plateIndex, 2);
	assert.equal(item.url, design.url);
});
