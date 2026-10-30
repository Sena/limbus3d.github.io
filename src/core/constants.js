/**
 * constants.js — chaves de armazenamento, eventos e limites do app.
 * As chaves mantêm os nomes usados pela versão anterior para que quem já
 * configurou a ferramenta não perca nada ao atualizar.
 */

export const STORAGE_KEYS = Object.freeze({
	settings: 'calc3d_settings_v2',
	theme: 'calc3d_theme',
	history: 'calc3d_history',
	presets: 'calc3d_presets',
	tab: 'calc3d_tab',
	settingsSeen: 'calc3d_settings_seen',
});

export const TABS = Object.freeze({
	CALC: 'calc',
	BATCH: 'orcamento',
	SETTINGS: 'settings',
});

/** Eventos do barramento interno. Módulos de UI conversam só por aqui. */
export const EVENTS = Object.freeze({
	CONFIG_CHANGED: 'config:changed',
	FILAMENTS_CHANGED: 'filaments:changed',
	SELECTION_CHANGED: 'selection:changed',
	TAB_CHANGED: 'tab:changed',
	BATCH_CHANGED: 'batch:changed',
});

/** Histórico guarda no máximo esta quantidade de cálculos. */
export const MAX_HISTORY = 20;
