import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const MODEL_URL =
	'https://makerworld.com/pt/models/2834113-alien-with-a-raised-eyebrow-7-grams?profiled=3639209#profileId-3158330';

const design = JSON.parse(
	readFileSync(
		new URL('../../tests/fixtures/makerworld-design-2834113.json', import.meta.url),
		'utf8',
	),
);
const drop = JSON.parse(
	readFileSync(new URL('../../tests/fixtures/stlflix-drop-378.json', import.meta.url), 'utf8'),
);

/** PNG 1×1 transparente, para as thumbnails não dependerem do CDN. */
const PIXEL = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

/**
 * @param {import('@playwright/test').Page} page
 * @param {any} payload
 */
async function mockImport(page, payload) {
	const calls = [];

	await page.route('https://limbus.com.br/api/import**', async (route) => {
		calls.push(route.request().url());
		await route.fulfill({
			status: 200,
			json: payload,
			headers: { 'access-control-allow-origin': '*' },
		});
	});

	await page.route('https://makerworld.bblmw.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
	);

	return calls;
}

/** @param {import('@playwright/test').Page} page */
async function abrirOrcamento(page) {
	await page.goto('/');
	await page.locator('#tab-batch').click();
	await expect(page.locator('#panel-batch')).toBeVisible();
}

/** @param {import('@playwright/test').Page} page */
async function importarModelo(page) {
	await page.locator('#batchImportUrl').fill(MODEL_URL);
	await page.locator('#batchImportSubmit').click();
	await expect(page.locator('#importSheet')).toBeVisible();
}

test('abre nos perfis, pré-seleciona o perfil da URL e mostra os pratos com imagem', async ({
	page,
}) => {
	await mockImport(page, design);
	await abrirOrcamento(page);

	await expect(page.locator('#batchEmpty')).toBeVisible();
	await expect(page.locator('#batchResult')).toBeHidden();
	await expect(page.locator('#importUrl')).toHaveCount(0);

	await importarModelo(page);

	await expect(page.locator('#importTitle')).toHaveText('Escolha o perfil');
	await expect(page.locator('#importSubtitle')).toContainText('3 perfis');
	await expect(page.locator('#importHint')).toContainText('MakerWorld');
	await expect(page.locator('.profile-option')).toHaveCount(3);
	await expect(page.locator('.profile-thumb')).toHaveCount(3);
	await expect(page.locator('#importRefresh')).toBeVisible();

	const selecionado = page.locator('.profile-option.is-selected');
	await expect(selecionado).toHaveCount(1);
	await expect(selecionado).toContainText('Multipart - 0.2mm layer');
	await expect(selecionado).toContainText('2 pratos · 9 g · 1h02');

	await selecionado.click();

	await expect(page.locator('#importTitle')).toHaveText('Escolha os pratos');
	await expect(page.locator('.plate-card')).toHaveCount(2);
	await expect(page.locator('.plate-card').first()).toContainText('Prato 1');
	await expect(page.locator('.plate-card').first()).toContainText('8 g · 52 min');
	await expect(page.locator('.plate-card').nth(1)).toContainText('1 g · 10 min');
	await expect(page.locator('.plate-card img')).toHaveCount(2);
	await expect(page.locator('#importAdd')).toBeDisabled();
	await expect(page.locator('#importAdd')).toHaveText('Adicionar pratos');
	await expect(page.locator('#importFooter')).toBeVisible();
});

test('soma os pratos com desconto de lote e recalcula com a quantidade', async ({ page }) => {
	await mockImport(page, design);
	await abrirOrcamento(page);
	await importarModelo(page);

	await page.locator('.profile-option.is-selected').click();
	await page.locator('.plate-card input').nth(0).check();
	await page.locator('.plate-card input').nth(1).check();
	await expect(page.locator('#importAdd')).toHaveText('Adicionar 2 pratos');
	await page.locator('#importAdd').click();

	await expect(page.locator('#importSheet')).toBeHidden();
	await expect(page.locator('.batch-item')).toHaveCount(2);
	await expect(page.locator('#batchProfileSummary')).toContainText('Multipart - 0.2mm layer');
	await expect(page.locator('#batchResult')).toBeVisible();

	await expect(page.locator('#batchWeight')).toHaveText('9 g');
	await expect(page.locator('#batchTime')).toHaveText('1h02');
	await expect(page.locator('#batchPieces')).toHaveText('2');
	await expect(page.locator('#batchSubtotal')).toHaveText(/R\$\s*38,74/);
	await expect(page.locator('#batchDiscountRow')).toBeVisible();
	await expect(page.locator('#batchDiscount')).toHaveText(/15,99/);
	await expect(page.locator('#batchTotal')).toHaveText(/R\$\s*22,75/);

	await page.locator('#batchQuantity').fill('2');

	await expect(page.locator('#batchPieces')).toHaveText('4');
	await expect(page.locator('#batchSubtotal')).toHaveText(/R\$\s*45,50/);
	await expect(page.locator('#batchDiscount')).toHaveText(/16,00/);
	await expect(page.locator('#batchTotal')).toHaveText(/R\$\s*29,50/);

	await page.locator('.batch-item-remove').first().click();

	await expect(page.locator('.batch-item')).toHaveCount(1);
	await expect(page.locator('.batch-item-title')).toHaveText('Prato 2');
	await expect(page.locator('#batchDiscountRow')).toBeHidden();
	await expect(page.locator('#batchTotal')).toHaveText(/R\$\s*17,95/);
});

test('prato repetido é ignorado e perfil sem dados fica desabilitado', async ({ page }) => {
	const semDados = {
		...design,
		selectedProfileId: null,
		profiles: [design.profiles[0], { ...design.profiles[1], plates: [] }, design.profiles[2]],
	};

	await mockImport(page, semDados);
	await abrirOrcamento(page);
	await importarModelo(page);

	const vazio = page.locator('.profile-option').filter({ hasText: 'Alien (Dual-Color)' });
	await expect(vazio).toBeDisabled();
	await expect(vazio).toContainText('Sem dados de prato');

	const multipart = page.locator('.profile-option').filter({ hasText: 'Multipart - 0.2mm layer' });
	await multipart.click();
	await page.locator('.plate-card input').first().check();
	await page.locator('#importAdd').click();
	await expect(page.locator('.batch-item')).toHaveCount(1);

	await page.locator('#batchImportUrl').fill(MODEL_URL);
	await page.locator('#batchImportSubmit').click();
	await transitionarParaPratos(page);
	await page.locator('.plate-card input').first().check();
	await page.locator('#importAdd').click();

	await expect(page.locator('#toast')).toContainText('Esse prato já está no orçamento.');
	await expect(page.locator('.batch-item')).toHaveCount(1);
});

test('trocar de fonte substitui o orçamento com aviso', async ({ page }) => {
	await page.route('https://limbus.com.br/api/import**', async (route) => {
		const url = route.request().url();
		const payload = url.includes('makerworld') ? design : drop;
		await route.fulfill({
			status: 200,
			json: payload,
			headers: { 'access-control-allow-origin': '*' },
		});
	});
	await page.route('https://makerworld.bblmw.com/**', (route) =>
		route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }),
	);

	await abrirOrcamento(page);
	await importarModelo(page);
	await transitionarParaPratos(page);
	await page.locator('.plate-card input').first().check();
	await page.locator('#importAdd').click();
	await expect(page.locator('.batch-item')).toHaveCount(1);

	await page.locator('#batchImportUrl').fill('https://platform.stlflix.com/pt-BR/drops/drop-378');
	await page.locator('#batchImportSubmit').click();
	await expect(page.locator('#importTitle')).toHaveText('Escolha o modelo');
	await page.locator('.variant-option').first().click();

	await expect(page.locator('#toast')).toContainText('Orçamento anterior substituído');
	await expect(page.locator('.batch-item')).toHaveCount(1);
	await expect(page.locator('.batch-item-title')).toContainText('Gatinho de Natal');
});

test('o botão Atualizar rebusca ignorando o cache', async ({ page }) => {
	const calls = await mockImport(page, design);
	await abrirOrcamento(page);
	await importarModelo(page);

	await page.locator('#importRefresh').click();
	await expect(page.locator('#importTitle')).toHaveText('Escolha o perfil');
	await expect(page.locator('.profile-option')).toHaveCount(3);

	expect(calls.some((call) => call.includes('refresh=1'))).toBe(true);
});

/** @param {import('@playwright/test').Page} page */
async function transitionarParaPratos(page) {
	await expect(page.locator('#importSheet')).toBeVisible();
	const perfil = page.locator('.profile-option').filter({ hasText: 'Multipart - 0.2mm layer' });
	await perfil.click();
	await expect(page.locator('.plate-card')).toHaveCount(2);
}
