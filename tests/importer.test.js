import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
	ImportRequestError,
	fetchImport,
	formatGrams,
	formatTimeInput,
	hydrateImportResult,
	parseStlflixDescription,
	parseStlflixLink,
	sourceLabel,
	variantValues,
} from '../src/core/importer.js';

const drop = JSON.parse(
	await readFile(new URL('./fixtures/stlflix-drop-378.json', import.meta.url), 'utf8'),
);
const product = JSON.parse(
	await readFile(new URL('./fixtures/stlflix-product-kitten.json', import.meta.url), 'utf8'),
);

/** @param {unknown} body @param {number} [status] */
function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

test('parseStlflixLink canonicaliza drop e produto', () => {
	assert.deepEqual(parseStlflixLink('https://platform.stlflix.com/pt-BR/drops/drop-378'), {
		kind: 'drop',
		slug: 'drop-378',
		locale: 'pt-BR',
		url: 'https://platform.stlflix.com/pt-BR/drops/drop-378',
	});

	assert.deepEqual(
		parseStlflixLink('https://platform.stlflix.com/en/product/kitten-ornament-table-lamp?utm=1#x'),
		{
			kind: 'product',
			slug: 'kitten-ornament-table-lamp',
			locale: 'en',
			url: 'https://platform.stlflix.com/en/product/kitten-ornament-table-lamp',
		},
	);

	// Sem locale no link, assume o português.
	assert.equal(
		parseStlflixLink('https://platform.stlflix.com/product/snowman-shine-table-lamp')?.url,
		'https://platform.stlflix.com/pt-BR/product/snowman-shine-table-lamp',
	);
});

test('parseStlflixLink recusa outros sites e caminhos', () => {
	const rejected = [
		'',
		'platform.stlflix.com/pt-BR/drops/drop-378',
		'ftp://platform.stlflix.com/pt-BR/drops/drop-378',
		'https://platform.stlflix.com.evil.example/pt-BR/drops/drop-378',
		'https://example.com/pt-BR/drops/drop-378',
		'https://platform.stlflix.com/pt-BR/collection/natal',
		'https://platform.stlflix.com/pt-BR/drops/',
		'https://platform.stlflix.com/pt-BR/product/kitten-ornament-table-lamp/download',
	];

	for (const url of rejected) {
		assert.equal(parseStlflixLink(url), null, url);
	}
});

test('parseStlflixDescription extrai as versões reais do Drop #378', () => {
	const expected = {
		'Gatinho de Natal - Luminária de Mesa': [['Monocolor', 137.41, 442]],
		'Galho Congelante - Luminária de Mesa': [['Monocolor', 196.03, 807]],
		'Presépio com Luz - Luminária de Mesa': [['Multiparts', 139.19, 282]],
		'Anjo Guardião - Luminária de Mesa': [['Monocolor', 95.73, 295]],
		'Presentes Brilhantes - Luminária de Mesa': [
			['Monocolor', 67.05, 220],
			['Multiparts', 79.06, 285],
			['Multicolor', 577.68, 1828],
		],
		'Brilho do Boneco de Neve - Luminária de Mesa': [
			['Monocolor', 45.02, 163],
			['Multiparts', 53.53, 202],
			['Multicolor', 257.48, 803],
		],
	};

	for (const item of drop.items) {
		const variants = parseStlflixDescription(item.descriptionHtml);
		assert.deepEqual(
			variants.map(({ label, weightG, minutes }) => [label, weightG, minutes]),
			expected[item.title],
			item.title,
		);
	}
});

test('parseStlflixDescription entende dias, decimais e inglês', () => {
	const portuguese = parseStlflixDescription(
		'<p>Tempo de Impressão:&nbsp;<strong>Multicolor</strong> - <strong>01</strong> Dia, <strong>06</strong> Horas <strong>28</strong> Minutos</p>' +
			'<p>Consumo de filamento: <strong>Multicolor - 1.234,56&nbsp;</strong>gramas</p>' +
			'<p>Altura Aproximada: 10 cm</p>',
	);
	assert.deepEqual(portuguese, [{ label: 'Multicolor', weightG: 1234.56, minutes: 1828 }]);

	const english = parseStlflixDescription(
		'<ul><li>Printing Time: <strong>Monocolor</strong> - 02 Hours 43 Minutes</li>' +
			'<li>Filament consumption: <strong>Monocolor - 45.02 grams</strong></li></ul>',
	);
	assert.deepEqual(english, [{ label: 'Monocolor', weightG: 45.02, minutes: 163 }]);
});

test('parseStlflixDescription ignora descrição sem os campos', () => {
	assert.deepEqual(parseStlflixDescription(''), []);
	assert.deepEqual(parseStlflixDescription('<p>Só uma descrição qualquer.</p>'), []);
	assert.deepEqual(parseStlflixDescription('<p>Tempo de Impressão: 2 horas</p>'), []);
});

test('hydrateImportResult hidrata o drop e mantém a ordem', () => {
	const result = hydrateImportResult(drop);

	assert.equal(result.kind, 'drop');
	assert.equal(result.title, 'Drop #378 — Natal Iluminado');
	assert.equal(result.items.length, 6);
	assert.equal(result.items[0].variants[0].weightG, 137.41);
	assert.equal(result.items[4].variants[2].minutes, 1828);
	assert.equal(result.items[5].variants[1].weightG, 53.53);
});

test('hydrateImportResult prefere versões já estruturadas pelo servidor', () => {
	const result = hydrateImportResult({
		source: 'stlflix',
		kind: 'product',
		title: 'Modelo',
		url: 'https://platform.stlflix.com/pt-BR/product/modelo',
		items: [
			{
				id: '1',
				title: 'Modelo',
				url: 'https://platform.stlflix.com/pt-BR/product/modelo',
				descriptionHtml: '',
				variants: [{ label: 'Monocolor', weightG: 10, minutes: 5 }],
			},
		],
	});

	assert.deepEqual(result.items[0].variants, [{ label: 'Monocolor', weightG: 10, minutes: 5 }]);
});

test('hydrateImportResult recusa resposta inválida ou vazia', () => {
	assert.throws(() => hydrateImportResult(null), ImportRequestError);
	assert.throws(() => hydrateImportResult({ items: [] }), /Não encontrei modelos nesse link/);
	assert.throws(
		() =>
			hydrateImportResult({
				items: [{ id: '1', title: 'X', url: 'http://inseguro.example', descriptionHtml: '' }],
			}),
		/Não encontrei modelos nesse link/,
	);
});

test('variantValues formata os campos de peso e tempo', () => {
	assert.deepEqual(variantValues({ weightG: 137.41, minutes: 442 }), {
		weight: '137,41g',
		time: '7:22',
	});
	assert.deepEqual(variantValues({ weightG: 577.68, minutes: 1828 }), {
		weight: '577,68g',
		time: '30:28',
	});
	assert.deepEqual(variantValues({ weightG: null, minutes: 0 }), { weight: '', time: '' });

	assert.equal(formatGrams(137.41), '137,41 g');
	assert.equal(formatTimeInput(163), '2:43');
	assert.equal(sourceLabel('stlflix'), 'STLFlix');
	assert.equal(sourceLabel('makerworld'), 'MakerWorld');
	assert.equal(sourceLabel('outro'), 'Link');
});

test('fetchImport recusa link inválido antes de chamar a rede', async () => {
	let calls = 0;

	await assert.rejects(
		fetchImport('https://example.com/modelo', {
			fetchImpl: async () => {
				calls += 1;
				throw new Error('não deveria chamar');
			},
			signal: new AbortController().signal,
		}),
		(error) =>
			error instanceof ImportRequestError &&
			error.code === 'invalid_url' &&
			error.status === 0,
	);

	assert.equal(calls, 0);
});

test('fetchImport chama a rota certa e devolve o resultado hidratado', async () => {
	let requested = '';

	const result = await fetchImport(
		'https://platform.stlflix.com/en/product/kitten-ornament-table-lamp?utm=1',
		{
			fetchImpl: async (url) => {
				requested = String(url);
				return jsonResponse(product);
			},
			signal: new AbortController().signal,
		},
	);

	assert.equal(
		requested,
		'https://limbus.com.br/api/import?url=' +
			encodeURIComponent('https://platform.stlflix.com/en/product/kitten-ornament-table-lamp'),
	);
	assert.equal(result.items[0].variants[0].weightG, 137.41);
	assert.equal(result.items[0].variants[0].minutes, 442);
});

test('fetchImport repassa a mensagem de erro da API', async () => {
	await assert.rejects(
		fetchImport('https://platform.stlflix.com/pt-BR/product/nao-existe', {
			fetchImpl: async () =>
				jsonResponse(
					{ error: 'not_found', message: 'Não encontrei esse modelo no STLFlix. Confira o link.' },
					404,
				),
			signal: new AbortController().signal,
		}),
		(error) =>
			error instanceof ImportRequestError &&
			error.code === 'not_found' &&
			error.status === 404 &&
			error.message === 'Não encontrei esse modelo no STLFlix. Confira o link.',
	);

	await assert.rejects(
		fetchImport('https://platform.stlflix.com/pt-BR/product/qualquer', {
			fetchImpl: async () => new Response('oops', { status: 502 }),
			signal: new AbortController().signal,
		}),
		(error) =>
			error instanceof ImportRequestError &&
			error.code === 'http_error' &&
			error.message === 'Não consegui importar esse link.',
	);
});

test('fetchImport separa falha de rede de resposta inesperada', async () => {
	await assert.rejects(
		fetchImport('https://platform.stlflix.com/pt-BR/product/qualquer', {
			fetchImpl: async () => {
				throw new TypeError('fetch failed');
			},
			signal: new AbortController().signal,
		}),
		(error) =>
			error instanceof ImportRequestError &&
			error.code === 'network' &&
			error.message === 'Não consegui falar com o importador. Tente de novo.',
	);

	await assert.rejects(
		fetchImport('https://platform.stlflix.com/pt-BR/product/qualquer', {
			fetchImpl: async () => new Response('não é json', { status: 200 }),
			signal: new AbortController().signal,
		}),
		(error) => error instanceof ImportRequestError && error.code === 'invalid_response',
	);
});
