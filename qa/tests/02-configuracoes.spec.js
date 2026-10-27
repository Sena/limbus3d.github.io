import { expect, test } from '@playwright/test';

async function abrirConfiguracoes(page) {
	await page.goto('/');
	await page.locator('#tab-settings').click();
	await expect(page.locator('#panel-settings')).toBeVisible();
}

test('o estado é um campo de busca: filtra por qualquer trecho, sem acento', async ({ page }) => {
	await abrirConfiguracoes(page);

	const campo = page.locator('#selEst-search');
	const opcoes = page.locator('#selEst-list .combobox-option');

	await campo.fill('parana');
	await expect(opcoes).toHaveCount(1);
	await expect(opcoes.first()).toContainText('Paraná');
	await opcoes.first().click();

	await expect(page.locator('#selEst')).toHaveValue('pr');
	await expect(page.locator('#energyKwh')).toHaveValue('0.82');

	await campo.fill('grande do sul');
	await expect(opcoes).toHaveCount(1);
	await expect(opcoes.first()).toContainText('Rio Grande do Sul');
});

test('a impressora é um campo de busca por marca e por modelo', async ({ page }) => {
	await abrirConfiguracoes(page);

	const campo = page.locator('#selImp-search');
	const opcoes = page.locator('#selImp-list .combobox-option');

	await campo.fill('bambu');
	const daMarca = await opcoes.count();
	expect(daMarca).toBeGreaterThan(5);

	await campo.fill('a1 mini');
	const doModelo = await opcoes.count();
	expect(doModelo).toBeLessThan(daMarca);
	await expect(opcoes.filter({ hasText: 'A1 Mini' })).not.toHaveCount(0);

	await opcoes.filter({ hasText: 'A1 Mini' }).first().click();
	await expect(page.locator('#consumoKw')).toHaveValue('0.045');
});

test('filamento novo entra na lista e vira cor da peça', async ({ page }) => {
	await abrirConfiguracoes(page);

	const linhas = page.locator('#filamentList .filament-row');
	await expect(linhas).toHaveCount(1);

	await page.locator('#addFilament').click();
	await expect(linhas).toHaveCount(2);
	await expect(page.locator('#colorChoices .chip')).toHaveCount(1);

	await linhas.nth(1).locator('input').nth(0).fill('PETG preto');
	await expect(page.locator('#colorChoices .chip')).toHaveCount(2);
	await expect(page.locator('#colorChoices .chip').nth(1)).toContainText('PETG preto');

	await linhas
		.nth(1)
		.getByRole('button')
		.click();
	await expect(linhas).toHaveCount(1);
	await expect(page.locator('#colorChoices .chip')).toHaveCount(1);
});
