/**
 * share.js — link da configuração, cópia e QR Code.
 */

import { EVENTS } from '../core/constants.js';
import { state } from '../core/state.js';
import { buildShareUrl } from '../core/url.js';
import { on } from '../core/bus.js';
import { getSnapshot } from './settings.js';
import { toast } from './notice.js';

/** Reconstrói o link a partir da configuração atual. */
export function refreshLink() {
	const output = /** @type {HTMLTextAreaElement} */ (document.getElementById('linkOutput'));
	state.shareUrl = buildShareUrl(globalThis.location, getSnapshot());
	if (output) output.value = state.shareUrl;
}

async function copyLink() {
	const output = /** @type {HTMLTextAreaElement} */ (document.getElementById('linkOutput'));

	try {
		if (navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(state.shareUrl);
		} else if (output) {
			output.select();
			document.execCommand('copy');
		}
		toast('Link copiado.');
	} catch {
		output?.select();
		toast('Não foi possível copiar. Selecione o link e copie à mão.');
	}
}

function showQrCode() {
	const container = document.getElementById('qrContainer');
	if (!container) return;

	if (!globalThis.QRCode) {
		toast('O gerador de QR Code não carregou. Verifique a conexão.');
		return;
	}

	if (!state.shareUrl) refreshLink();

	container.replaceChildren();
	new globalThis.QRCode(container, {
		text: state.shareUrl,
		width: 168,
		height: 168,
		correctLevel: globalThis.QRCode.CorrectLevel?.M,
	});

	container.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function initShare() {
	document.getElementById('copyLink')?.addEventListener('click', copyLink);
	document.getElementById('qrButton')?.addEventListener('click', showQrCode);

	for (const event of [EVENTS.CONFIG_CHANGED, EVENTS.FILAMENTS_CHANGED]) {
		on(event, refreshLink);
	}

	refreshLink();
}
