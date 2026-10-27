import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Contraste mínimo de cada par de tokens, pela WCAG 2.1. */
const MINIMOS = [
	['--ink', '--surface-1', 7, 'texto principal sobre o cartão'],
	['--ink', '--bg', 7, 'texto principal sobre o fundo da página'],
	['--ink-2', '--surface-1', 4.5, 'rótulo de campo'],
	['--muted', '--surface-1', 4.5, 'dica de campo e placeholder'],
	['--muted', '--bg', 4.5, 'texto de apoio fora do cartão'],
	['--muted', '--surface-3', 4.5, 'aba não selecionada'],
	['--brand', '--surface-1', 4.5, 'link e ação'],
	['--brand', '--accent-soft', 4.5, 'chip de cor marcado'],
	['--accent-ink', '--accent', 4.5, 'texto do botão principal'],
	['--danger', '--surface-1', 4.5, 'ação destrutiva'],
	['--danger', '--danger-soft', 4.5, 'texto sobre o fundo de perigo'],
	['--border-strong', '--surface-1', 3, 'contorno de campo e botão'],
	['--border-strong', '--surface-3', 3, 'contorno sobre superfície tonal'],
	['--result-ink', '--result-bg', 7, 'preço'],
	['--result-muted', '--result-bg', 4.5, 'rótulo e apoio do painel de preço'],
	['--result-link', '--result-bg', 4.5, 'link dentro do painel de preço'],
];

/**
 * @param {number} channel
 * @returns {number}
 */
function toLinear(channel) {
	const value = channel / 255;
	return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/**
 * @param {string} hex
 * @returns {number} luminância relativa
 */
function luminance(hex) {
	const int = parseInt(hex.slice(1), 16);
	const r = (int >> 16) & 255;
	const g = (int >> 8) & 255;
	const b = int & 255;
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number} razão de contraste entre 1 e 21
 */
export function contrast(a, b) {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
}

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');

/**
 * Lê os tokens de cor de um bloco do arquivo.
 * @param {string} selector
 * @returns {Record<string, string>}
 */
function readTokens(selector) {
	const start = css.indexOf(selector);
	assert.notEqual(start, -1, `bloco ${selector} não encontrado em tokens.css`);

	const open = css.indexOf('{', start);
	const end = css.indexOf('\n}', open);
	const body = css.slice(open + 1, end);

	/** @type {Record<string, string>} */
	const tokens = {};
	for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
		tokens[name] = value;
	}
	return tokens;
}

for (const [theme, selector] of [
	['claro', ':root {'],
	['escuro', "[data-theme='dark'] {"],
]) {
	const tokens = readTokens(selector);

	test(`tema ${theme}: todo par obrigatório passa`, () => {
		const falhas = [];

		for (const [frente, fundo, minimo, uso] of MINIMOS) {
			const foreground = tokens[frente];
			const background = tokens[fundo];

			assert.ok(foreground, `${frente} não definido no tema ${theme}`);
			assert.ok(background, `${fundo} não definido no tema ${theme}`);

			const ratio = contrast(foreground, background);
			if (ratio < minimo) {
				falhas.push(
					`${frente} sobre ${fundo} (${uso}): ${ratio.toFixed(2)}:1, mínimo ${minimo}:1`,
				);
			}
		}

		assert.deepEqual(falhas, [], `contraste insuficiente no tema ${theme}`);
	});
}

test('a razão de contraste bate com a referência', () => {
	assert.equal(Number(contrast('#000000', '#ffffff').toFixed(2)), 21);
	assert.equal(Number(contrast('#123456', '#123456').toFixed(2)), 1);
});
