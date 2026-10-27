/**
 * state.js — estado compartilhado, em um lugar só.
 * Os módulos de UI leem e escrevem aqui; nenhum deles guarda cópia própria.
 */

import { createDefaultConfig } from './config.js';

export const state = {
	/** Tarifas por estado, vindas de src/data/energy.json */
	/** @type {Record<string, {name: string, value: number}>} */
	energy: {},

	/** Catálogo por fabricante, vindo de src/data/printers.json */
	/** @type {Record<string, Array<{model: string, watts: number}>>} */
	printers: {},

	/** Filamentos cadastrados pelo usuário */
	/** @type {import('./pricing.js').Filament[]} */
	filaments: [],

	/** Índices dos filamentos marcados para esta peça */
	/** @type {Set<number>} */
	selected: new Set(),

	/** Custos configurados, sempre em string, como saem dos campos */
	/** @type {Record<string, string>} */
	config: createDefaultConfig(),

	/** Valores digitados no simulador, como o usuário escreveu */
	/** @type {{quantity: string, weight: string, time: string}} */
	inputs: { quantity: '1', weight: '', time: '' },

	/** Último orçamento calculado, ou null quando não há o que calcular */
	/** @type {ReturnType<import('./pricing.js').calculateQuote>} */
	quote: null,

	/** Link compartilhável da configuração atual */
	shareUrl: '',

	/** Histórico de cálculos */
	/** @type {Array<{id: number, createdAt: string, quantity: number, weightGrams: number, minutes: number, total: number}>} */
	history: [],

	/** Presets salvos, indexados pelo nome */
	/** @type {Record<string, unknown>} */
	presets: {},

	/** Esconde as configurações internas de custo */
	clientMode: false,

	/** Se o usuário já abriu as configurações alguma vez */
	settingsSeen: false,
};
