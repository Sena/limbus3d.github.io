/**
 * combobox.js — um select que também é campo de busca.
 * A marcação fica no HTML; este módulo só liga o comportamento.
 */

/**
 * Texto comparável: sem acento, sem caixa.
 * @param {unknown} text
 * @returns {string}
 */
function comparable(text) {
	return String(text ?? '')
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/**
 * @typedef {Object} ComboOption
 * @property {string} value
 * @property {string} label
 * @property {string} [group]
 */

/**
 * Liga o combobox de um campo.
 * @param {string} id identificador do campo (os elementos usam `${id}-search`, `${id}` e `${id}-list`)
 * @param {ComboOption[]} options
 * @param {(value: string) => void} onChange
 */
export function createCombobox(id, options, onChange) {
	const input = /** @type {HTMLInputElement} */ (document.getElementById(`${id}-search`));
	const hidden = /** @type {HTMLInputElement} */ (document.getElementById(id));
	const list = document.getElementById(`${id}-list`);

	if (!input || !hidden || !list) {
		console.warn(`Combobox "${id}": marcação não encontrada.`);
		return null;
	}

	const items = options.map((option) => ({
		...option,
		search: comparable(`${option.label} ${option.group ?? ''}`),
	}));

	/** @type {typeof items} */
	let visible = items;
	let active = -1;

	/**
	 * @param {string} value
	 * @returns {string}
	 */
	const labelOf = (value) => items.find((item) => item.value === value)?.label ?? '';

	function close() {
		list.hidden = true;
		input.setAttribute('aria-expanded', 'false');
		input.removeAttribute('aria-activedescendant');
		active = -1;
	}

	function open() {
		list.hidden = false;
		input.setAttribute('aria-expanded', 'true');
		render();
	}

	function select(value) {
		hidden.value = value;
		input.value = labelOf(value);
		close();
		onChange(value);
	}

	function setActive(index) {
		const elements = /** @type {HTMLElement[]} */ ([...list.querySelectorAll('.combobox-option')]);
		if (elements.length === 0) return;

		active = (index + elements.length) % elements.length;
		elements.forEach((element, i) => element.classList.toggle('is-active', i === active));

		const current = elements[active];
		input.setAttribute('aria-activedescendant', current.id);
		current.scrollIntoView({ block: 'nearest' });
	}

	function render() {
		const query = comparable(input.value).trim();
		const isCurrentLabel = input.value === labelOf(hidden.value);
		visible = !query || isCurrentLabel ? items : items.filter((item) => item.search.includes(query));

		list.replaceChildren();
		active = -1;

		if (visible.length === 0) {
			const empty = document.createElement('li');
			empty.className = 'combobox-empty';
			empty.textContent = 'Nada encontrado.';
			list.append(empty);
			return;
		}

		visible.forEach((item, index) => {
			const option = document.createElement('li');
			option.className = 'combobox-option';
			option.id = `${id}-opt-${index}`;
			option.setAttribute('role', 'option');
			option.setAttribute('aria-selected', String(item.value === hidden.value));

			const label = document.createElement('span');
			label.className = 'combobox-label';
			label.textContent = item.label;
			option.append(label);

			if (item.group) {
				const group = document.createElement('span');
				group.className = 'combobox-group';
				group.textContent = item.group;
				option.append(group);
			}

			// preventDefault mantém o foco no campo enquanto a lista fecha.
			option.addEventListener('mousedown', (event) => event.preventDefault());
			option.addEventListener('click', () => select(item.value));

			list.append(option);
		});
	}

	input.addEventListener('focus', () => {
		input.select();
		open();
	});

	input.addEventListener('input', () => {
		if (list.hidden) open();
		else render();
	});

	input.addEventListener('blur', () => {
		close();
		input.value = labelOf(hidden.value);
	});

	input.addEventListener('keydown', (event) => {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			if (list.hidden) open();
			else setActive(active + 1);
			return;
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			setActive(active - 1);
			return;
		}

		if (event.key === 'Enter') {
			event.preventDefault();
			const chosen = visible[active] ?? visible[0];
			if (chosen) select(chosen.value);
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			input.value = labelOf(hidden.value);
		}
	});

	return {
		/**
		 * Define o valor sem disparar onChange — usado ao carregar preset ou link.
		 * @param {string} value
		 */
		setValue(value) {
			hidden.value = value ?? '';
			input.value = labelOf(hidden.value);
		},
		/** @returns {string} */
		getValue() {
			return hidden.value;
		},
	};
}
