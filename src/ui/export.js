/**
 * export.js — orçamento em PDF.
 * Usa o jsPDF carregado por CDN; se ele não vier, avisa em vez de falhar mudo.
 */

import { state } from '../core/state.js';
import { formatBRL, formatDuration, formatWeight } from '../core/format.js';
import { toast } from './notice.js';

export function generatePdf() {
	const quote = state.quote;

	if (!quote) {
		toast('Informe peso e tempo antes de gerar o PDF.');
		return;
	}

	const jsPDF = globalThis.jspdf?.jsPDF;
	if (!jsPDF) {
		toast('O gerador de PDF não carregou. Verifique a conexão.');
		return;
	}

	const document_ = new jsPDF();
	let line = 18;

	document_.setFontSize(16);
	document_.text('Orçamento — impressão 3D', 14, line);

	line += 12;
	document_.setFontSize(11);
	document_.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 14, line);

	line += 8;
	document_.text(`Quantidade: ${quote.quantity}`, 14, line);

	line += 8;
	document_.text(`Peso total: ${formatWeight(quote.weightGrams * quote.quantity)}`, 14, line);

	line += 8;
	document_.text(`Tempo total: ${formatDuration(quote.minutes * quote.quantity)}`, 14, line);

	line += 14;
	document_.setFontSize(14);
	document_.text(`Preço total: ${formatBRL(quote.total)}`, 14, line);

	document_.save('orcamento-impressao-3d.pdf');
}

export function initExport() {
	document.getElementById('exportPdf')?.addEventListener('click', generatePdf);
}
