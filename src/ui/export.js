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

/** Orçamento de vários itens: lista os pratos e fecha com subtotal, desconto e total. */
export function generateBatchPdf() {
	const result = state.batch.result;

	if (!result) {
		toast('Monte um orçamento antes de gerar o PDF.');
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
	document_.text(`Origem: ${state.batch.title || 'Link'}`, 14, line, { maxWidth: 182 });

	if (state.batch.profileTitle) {
		line += 8;
		document_.text(`Perfil: ${state.batch.profileTitle}`, 14, line, { maxWidth: 182 });
	}

	line += 12;
	document_.setFontSize(12);
	document_.text('Itens', 14, line);

	line += 8;
	document_.setFontSize(10);

	for (const item of result.items) {
		document_.text(
			`${item.title} - ${formatWeight(item.weightG)} · ${formatDuration(item.minutes)} - ${formatBRL(item.quote.total)}`,
			14,
			line,
			{ maxWidth: 182 },
		);
		line += 8;

		if (line > 268) {
			document_.addPage();
			line = 20;
		}
	}

	line += 6;
	document_.setFontSize(11);
	document_.text(`Quantidade: ${result.quantity} de cada`, 14, line);

	line += 8;
	document_.text(`Peso total: ${formatWeight(result.weightGrams)}`, 14, line);

	line += 8;
	document_.text(`Tempo total: ${formatDuration(result.minutes)}`, 14, line);

	line += 8;
	document_.text(`Subtotal: ${formatBRL(result.subtotal)}`, 14, line);

	if (result.showDiscount) {
		line += 8;
		document_.text(`Desconto em lote: -${formatBRL(result.discount)}`, 14, line);
	}

	line += 14;
	document_.setFontSize(14);
	document_.text(`Preço total: ${formatBRL(result.total)}`, 14, line);

	document_.save('orcamento-lote-impressao-3d.pdf');
}

export function initExport() {
	document.getElementById('exportPdf')?.addEventListener('click', generatePdf);
}
