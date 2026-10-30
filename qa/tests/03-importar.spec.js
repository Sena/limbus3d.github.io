import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const DROP_URL = 'https://platform.stlflix.com/pt-BR/drops/drop-378';
const PRODUCT_URL = 'https://platform.stlflix.com/pt-BR/product/kitten-ornament-table-lamp';

const drop = JSON.parse(
	readFileSync(new URL('../../tests/fixtures/stlflix-drop-378.json', import.meta.url), 'utf8'),
);
const product = JSON.parse(
	readFileSync(
		new URL('../../tests/fixtures/stlflix-product-kitten.json', import.meta.url),
		'utf8',
	),
);

/** @param {import('@playwright/test').Page} page */
async function mockImport(page, payload, status = 200) {
	const calls = [];

	await page.route('https://limbus.com.br/api/import**', async (route) => {
		calls.push(route.request().url());
		await route.fulfill({
			status,
			json: payload,
			headers: { 'access-control-allow-origin': '*' },
		});
	});

	return calls;
}

/** @param {import('@playwright/test').Page} page */
async function abrirOrcamento(page) {
	await page.goto('/');
	await page.locator('#tab-batch').click();
	await expect(page.locator('#panel-batch')).toBeVisible();
}

test('importa um drop, mostra as versões com preço e adiciona uma ao orçamento', async ({
	page,
}) => {
	await mockImport(page, drop);
	await abrirOrcamento(page);

	await page.locator('#batchQuantity').fill('2');
	await page.locator('#batchImportUrl').fill(`${DROP_URL}?utm=email`);
	await page.locator('#batchImportSubmit').click();

	const sheet = page.locator('#importSheet');
	await expect(sheet).toBeVisible();
	await expect(page.locator('#importTitle')).toHaveText('Escolha o modelo');
	await expect(page.locator('#importSubtitle')).toContainText('Drop #378');
	await expect(page.locator('#importSubtitle')).toContainText('10 versões');
	await expect(page.locator('.import-item')).toHaveCount(6);
	await expect(page.locator('#importHint')).toContainText('Preço para 2 un');
	await expect(page.locator('#importHint')).toContainText('STLFlix');

	const presente = page
		.locator('.import-item')
		.filter({ hasText: 'Presentes Brilhantes - Luminária de Mesa' });
	await expect(presente.locator('.variant-option')).toHaveCount(3);
	await expect(presente.locator('.variant-option').nth(0)).toContainText('Monocolor');
	await expect(presente.locator('.variant-option').nth(0)).toContainText('67,05 g · 3h40');
	await expect(presente.locator('.variant-option').nth(2)).toContainText('Multicolor');
	await expect(presente.locator('.variant-option').nth(2)).toContainText('577,68 g · 30h28');

	const gatinho = page
		.locator('.import-item')
		.filter({ hasText: 'Gatinho de Natal - Luminária de Mesa' });
	const gatinhoLinha = gatinho.locator('.variant-option').first();
	await expect(gatinhoLinha).toContainText('137,41 g · 7h22');
	await expect(gatinhoLinha.locator('.variant-price')).toHaveText(/R\$\s*\d/);
	const preco = (await gatinhoLinha.locator('.variant-price').textContent())?.trim();

	await gatinhoLinha.click();

	await expect(sheet).toBeHidden();
	await expect(page.locator('.batch-item')).toHaveCount(1);
	await expect(page.locator('.batch-item-title')).toContainText(
		'Gatinho de Natal - Luminária de Mesa — Monocolor',
	);
	await expect(page.locator('.batch-item-meta')).toContainText('137,41 g · 7h22');
	await expect(page.locator('.batch-item-meta')).toContainText('2 un');
	await expect(page.locator('#batchResult')).toBeVisible();
	await expect(page.locator('#batchTotal')).toHaveText(preco ?? '');
	await expect(page.locator('#batchDiscountRow')).toBeHidden();
	await expect(page.locator('#batchPieces')).toHaveText('2');
});

test('produto com uma única versão também passa pela folha antes de entrar', async ({ page }) => {
	const calls = await mockImport(page, product);
	await abrirOrcamento(page);

	await page.locator('#batchImportUrl').fill(`${PRODUCT_URL}?utm=email`);
	await page.locator('#batchImportSubmit').click();

	await expect(page.locator('#importTitle')).toHaveText('Escolha a versão');
	await expect(page.locator('.variant-option')).toHaveCount(1);

	await page.locator('.variant-option').click();

	await expect(page.locator('#importSheet')).toBeHidden();
	await expect(page.locator('.batch-item')).toHaveCount(1);
	await expect(page.locator('#batchResult')).toBeVisible();
	await expect(page.locator('#toast')).toContainText('1 item adicionado ao orçamento');

	expect(calls).toHaveLength(1);
	expect(calls[0]).toBe(
		`https://limbus.com.br/api/import?url=${encodeURIComponent(PRODUCT_URL.replace('?utm=email', ''))}`,
	);
});

test('erro da API aparece no aviso e mantém o orçamento como estava', async ({ page }) => {
	await mockImport(
		page,
		{ error: 'not_found', message: 'Não encontrei esse modelo no STLFlix. Confira o link.' },
		404,
	);
	await abrirOrcamento(page);

	await page.locator('#batchImportUrl').fill('https://platform.stlflix.com/pt-BR/product/nao-existe');
	await page.locator('#batchImportSubmit').click();

	await expect(page.locator('#toast')).toHaveText(
		'Não encontrei esse modelo no STLFlix. Confira o link.',
	);
	await expect(page.locator('.batch-item')).toHaveCount(0);
	await expect(page.locator('#batchResult')).toBeHidden();
	await expect(page.locator('#batchImportSubmit')).toBeEnabled();
	await expect(page.locator('#batchImportSubmit')).toHaveText('Importar');
});

test('link de outro site é recusado antes de chamar a API', async ({ page }) => {
	const calls = await mockImport(page, drop);
	await abrirOrcamento(page);

	await page.locator('#batchImportUrl').fill('https://example.com/pt-BR/drops/drop-378');
	await page.locator('#batchImportSubmit').click();

	await expect(page.locator('#toast')).toHaveText('Cole um link do STLFlix ou do MakerWorld.');
	await expect(page.locator('#importSheet')).toBeHidden();
	expect(calls).toHaveLength(0);
});
