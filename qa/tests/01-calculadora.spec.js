import { expect, test } from '@playwright/test';

const PRECO_UMA_PECA = /R\$\s*33,66/;
const PRECO_TRES_PECAS = /R\$\s*68,97/;

test('abre no estado vazio e mostra o preço ao informar peso e tempo', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('#calcEmpty')).toBeVisible();
	await expect(page.locator('#calcResult')).toBeHidden();

	await page.locator('#weight').fill('50g');
	await page.locator('#minutes').fill('1:10');

	await expect(page.locator('#calcResult')).toBeVisible();
	await expect(page.locator('#calcEmpty')).toBeHidden();
	await expect(page.locator('#finalPrice')).toHaveText(PRECO_UMA_PECA);
});

test('a quantidade multiplica a peça, mas o setup entra uma vez por lote', async ({ page }) => {
	await page.goto('/?q=3&w=50g&t=1:10');

	await expect(page.locator('#quantity')).toHaveValue('3');
	await expect(page.locator('#finalPrice')).toHaveText(PRECO_TRES_PECAS);
});

test('as três abas ficam sempre visíveis e não existe modo cliente', async ({ page }) => {
	await page.goto('/');

	await expect(page.locator('.tab')).toHaveCount(3);
	await expect(page.locator('#tab-calc')).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('#clientToggle')).toHaveCount(0);

	await page.locator('#tab-batch').click();
	await expect(page.locator('#panel-batch')).toBeVisible();
	await expect(page.locator('#panel-calc')).toBeHidden();

	await page.locator('#tab-settings').click();
	await expect(page.locator('#panel-settings')).toBeVisible();
	await expect(page.locator('.tabs')).toBeVisible();
});

test('abre pronto, sem se mexer, com tema e aba salvos', async ({ page }) => {
	await page.addInitScript(() => {
		try {
			localStorage.setItem('calc3d_theme', 'dark');
			localStorage.setItem('calc3d_tab', 'settings');
		} catch {
		}

		window.__deslocamento = 0;
		new PerformanceObserver((lista) => {
			for (const entrada of lista.getEntries()) {
				if (!entrada.hadRecentInput) window.__deslocamento += entrada.value;
			}
		}).observe({ type: 'layout-shift', buffered: true });
	});

	await page.goto('/');

	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(page.locator('#panel-settings')).toBeVisible();

	await page.waitForTimeout(700);
	expect(await page.evaluate(() => window.__deslocamento)).toBeLessThan(0.01);
});

test('sem escolha salva, o tema segue o sistema', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

	await page.emulateMedia({ colorScheme: 'dark' });
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('quando não dá para saber a preferência, o tema é o escuro', async ({ page }) => {
	await page.addInitScript(() => {
		try {
			window.matchMedia = undefined;
		} catch {
		}
	});

	await page.goto('/');

	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
