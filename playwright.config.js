import { defineConfig } from '@playwright/test';

/**
 * Suíte de ponta a ponta: telefone (390×844) e desktop (1280×800).
 * Com QA_BASE_URL aponta para um alvo já no ar e não sobe servidor.
 */
const BASE_URL = process.env.QA_BASE_URL ?? 'http://127.0.0.1:8000';

export default defineConfig({
	testDir: 'qa/tests',
	outputDir: 'qa/.artifacts/run',
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	timeout: 30_000,
	expect: { timeout: 5_000 },
	reporter: process.env.CI
		? [['list'], ['html', { outputFolder: 'qa/.artifacts/report', open: 'never' }]]
		: [['list']],
	use: {
		baseURL: BASE_URL,
		locale: 'pt-BR',
		timezoneId: 'America/Sao_Paulo',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'desktop',
			use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
		},
		{
			name: 'telefone',
			use: {
				viewport: { width: 390, height: 844 },
				deviceScaleFactor: 2,
				isMobile: true,
				hasTouch: true,
			},
		},
	],
	webServer: process.env.QA_BASE_URL
		? undefined
		: {
				command: 'npm run dev',
				url: BASE_URL,
				reuseExistingServer: !process.env.CI,
				timeout: 30_000,
			},
});
