const App = {
    energyData: {},
    printerData: {},
    storageKey: 'calc3d_settings_v2',
    panelStateKey: 'calc3d_panel_open',
    themeKey: 'calc3d_theme',
    clientModeKey: 'calc3d_client_mode',
    historyKey: 'calc3d_history',
    presetsKey: 'calc3d_presets',
    configFields: ['energyKwh', 'consumoKw', 'margin', 'machineCost', 'hourRate', 'selEst', 'selImp'],
    filaments: [],
    selectedFilaments: new Set(),
    clientMode: false,
    history: [],
    presets: {},

    async init() {
        this.bindEvents();
        this.loadTheme();
        this.loadClientMode();
        this.loadHistory();
        this.loadPresets();
        await this.loadData();

        this.loadFromStorage();
        this.parseUrlParams();
        this.restorePanelState();
        this.renderFilamentList();
        this.renderPresetSelect();
        this.calculate();
    },

    async loadData() {
        try {
            const [e, p] = await Promise.all([fetch('energy.json'), fetch('printers.json')]);
            this.energyData = await e.json();
            this.printerData = await p.json();
            this.populateSelectors();
        } catch (err) { console.warn("Modo manual: falha ao ler JSONs"); }
    },

    populateSelectors() {
        const sEst = document.getElementById('selEst');
        const sImp = document.getElementById('selImp');
        Object.entries(this.energyData).forEach(([k, v]) => sEst.add(new Option(`${v.name} (R$${v.value})`, v.value)));
        Object.entries(this.printerData).forEach(([brand, models]) => {
            let g = document.createElement('optgroup');
            g.label = brand;
            models.forEach(p => g.appendChild(new Option(`${p.model} (${p.watts * 1000}W)`, p.watts)));
            sImp.add(g);
        });
    },

    bindEvents() {
        document.getElementById('toggleConfig').onclick = () => {
            const p = document.getElementById('configPanel');
            p.classList.toggle('hidden');
            localStorage.setItem(this.panelStateKey, !p.classList.contains('hidden'));
        };
        const toggleTheme = document.getElementById('toggleTheme');
        if (toggleTheme) toggleTheme.onclick = () => this.toggleTheme();
        const toggleClient = document.getElementById('toggleClientMode');
        if (toggleClient) toggleClient.onclick = () => this.toggleClientMode();
        const toggleHist = document.getElementById('toggleHistory');
        if (toggleHist) toggleHist.onclick = () => this.toggleHistory();
        document.getElementById('simulatorForm').oninput = () => this.calculate();
        document.getElementById('configForm').oninput = (e) => {
            if (e.target.id === 'selEst' && e.target.value !== 'outros') document.getElementById('energyKwh').value = e.target.value;
            if (e.target.id === 'selImp' && e.target.value !== 'outros') document.getElementById('consumoKw').value = e.target.value;
            this.saveToStorage();
            this.calculate();
        };
    },

    addFilamentRow(name = '', price = 100, weight = 1000) {
        this.filaments.push({name, price, weight});
        this.renderFilamentList();
        this.saveToStorage();
    },

    removeFilament(i) {
        this.filaments.splice(i, 1);
        this.selectedFilaments.delete(i);
        this.renderFilamentList();
        this.saveToStorage();
        this.calculate();
        this.renderColorChoices();
    },

    updateFilament(i, f, v) {
        this.filaments[i][f] = v;
        this.saveToStorage();
        this.calculate();
        this.renderColorChoices();
    },

    restorePanelState() {
        const isOpen = localStorage.getItem(this.panelStateKey) === 'true';
        if (isOpen) {
            document.getElementById('configPanel').classList.remove('hidden');
        }
    },

    renderFilamentList() {
        const cont = document.getElementById('filamentList');
        cont.innerHTML = '';
        this.filaments.forEach((f, i) => {
            const div = document.createElement('div');
            div.className = 'filament-item';
            div.innerHTML = `
                <input type="text" value="${f.name}" oninput="App.updateFilament(${i}, 'name', this.value)">
                <input type="number" value="${f.price}" oninput="App.updateFilament(${i}, 'price', this.value)">
                <input type="number" value="${f.weight}" oninput="App.updateFilament(${i}, 'weight', this.value)">
                <button type="button" class="btn-remove" onclick="App.removeFilament(${i})">×</button>`;
            cont.appendChild(div);
        });
    },

    renderColorChoices() {
        const cont = document.getElementById('colorChoices');
        cont.innerHTML = '';
        this.filaments.forEach((f, i) => {
            if (!f.name) return;
            const chip = document.createElement('div');
            chip.className = `color-chip ${this.selectedFilaments.has(i) ? 'selected' : ''}`;
            chip.innerText = f.name;
            chip.onclick = () => {
                this.selectedFilaments.has(i) ? this.selectedFilaments.delete(i) : this.selectedFilaments.add(i);
                this.renderColorChoices();
                this.calculate();
            };
            cont.appendChild(chip);
        });
    },

    saveToStorage() {
        const data = {filaments: this.filaments};
        this.configFields.forEach(f => data[f] = document.getElementById(f).value);
        localStorage.setItem(this.storageKey, JSON.stringify(data));
        this.generateLink();
    },

    loadFromStorage() {
        const saved = localStorage.getItem(this.storageKey);
        if (!saved) {
            document.getElementById('toggleConfig').classList.add('attention-mode');
            this.addFilamentRow('Cor padrão', 120, 1000);
            this.renderColorChoices();
            return false;
        }
        const data = JSON.parse(saved);
        this.filaments = data.filaments || [];
        this.configFields.forEach(k => {
            if (data[k]) document.getElementById(k).value = data[k];
        });
        this.renderColorChoices();
    },

    parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('data');
        if (raw) {
            try {
                const data = JSON.parse(atob(raw));
                this.filaments = data.filaments || [];
                this.configFields.forEach(k => {
                    if (data[k]) document.getElementById(k).value = data[k];
                });
                this.renderFilamentList();
            } catch (e) {
                console.error("Erro decode URL");
            }
        }

        const quantityParam = params.get('q');
        if (quantityParam !== null) {
            const qtyInput = document.getElementById('quantity');
            if (qtyInput) qtyInput.value = quantityParam;
        }

        const weightParam = params.get('w');
        if (weightParam !== null) {
            const weightInput = document.getElementById('weight');
            if (weightInput) weightInput.value = weightParam;
        }

        const timeParam = params.get('t');
        if (timeParam !== null) {
            const timeInput = document.getElementById('minutes');
            if (timeInput) timeInput.value = timeParam;
        }
    },

    generateLink() {
        const data = {filaments: this.filaments};
        this.configFields.forEach(f => data[f] = document.getElementById(f).value);
        document.getElementById('linkOutput').value = `${window.location.origin}${window.location.pathname}?data=${btoa(JSON.stringify(data))}`;
    },

    calculate() {
        const weight = this.parseUnit(document.getElementById('weight').value, 'w');
        const mins = this.parseUnit(document.getElementById('minutes').value, 't');
        const qty = parseFloat(document.getElementById('quantity').value) || 1;

        if (!weight || this.filaments.length === 0) {
            document.getElementById('resultBox').classList.add('hidden');
            document.getElementById('instruction').classList.remove('hidden');
            return;
        }

        let maxPriceG = 0;
        if (this.selectedFilaments.size > 0) {
            this.selectedFilaments.forEach(i => {
                const f = this.filaments[i];
                maxPriceG = Math.max(maxPriceG, (f.price / f.weight));
            });
        } else {
            maxPriceG = (this.filaments[0].price / this.filaments[0].weight);
        }

        const h = (mins * qty) / 60;
        const filament = (weight * qty) * maxPriceG;
        const energy = parseFloat(document.getElementById('consumoKw').value) * h * parseFloat(document.getElementById('energyKwh').value);
        const setupCost = parseFloat(document.getElementById('machineCost').value) || 0;
        const machineUsage = h * (parseFloat(document.getElementById('hourRate').value) || 0);
        const total = (filament + energy + setupCost + machineUsage) * parseFloat(document.getElementById('margin').value);

        document.getElementById('instruction').classList.add('hidden');
        document.getElementById('resultBox').classList.remove('hidden');
        document.getElementById('finalPrice').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
    },

    parseUnit(val, type) {
        if (!val) return 0;
        const clean = String(val).toLowerCase().replace(',', '.').trim();

        if (type === 't' && clean.includes(':')) {
            const parts = clean.split(':');
            if (parts.length === 2) {
                const horas = parseFloat(parts[0]) || 0;
                const minutos = parseFloat(parts[1]) || 0;
                if (!isNaN(horas) && !isNaN(minutos)) {
                    return horas * 60 + minutos;
                }
            }
        }

        const num = parseFloat(clean);
        if (isNaN(num)) return 0;
        if (type === 'w') return clean.includes('kg') ? num * 1000 : num;
        if (type === 't') return clean.includes('h') ? num * 60 : num;
        return num;
    },

    copyLink() {
        const out = document.getElementById('linkOutput');
        out.select();
        document.execCommand('copy');
        alert("Link de configuração copiado e salvo no seu navegador!");
    },

    loadTheme() {
        const theme = localStorage.getItem(this.themeKey) || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(this.themeKey, next);
    },

    loadClientMode() {
        this.clientMode = localStorage.getItem(this.clientModeKey) === 'true';
        const status = document.getElementById('clientModeStatus');
        if (status) status.innerText = this.clientMode ? 'ON' : 'OFF';
    },

    toggleClientMode() {
        this.clientMode = !this.clientMode;
        localStorage.setItem(this.clientModeKey, this.clientMode);
        const status = document.getElementById('clientModeStatus');
        if (status) status.innerText = this.clientMode ? 'ON' : 'OFF';
    },

    loadHistory() {
        const saved = localStorage.getItem(this.historyKey);
        if (saved) {
            try {
                this.history = JSON.parse(saved);
            } catch (e) {
                this.history = [];
            }
        }
    },

    saveToHistory() {
        const weight = document.getElementById('weight').value;
        const time = document.getElementById('minutes').value;
        const qty = document.getElementById('quantity').value;
        const price = document.getElementById('finalPrice').innerText;
        if (!price || price.includes('0,00')) {
            alert('Calcule um valor primeiro');
            return;
        }
        const entry = {
            id: Date.now(),
            date: new Date().toLocaleString('pt-BR'),
            weight, time, qty, price
        };
        this.history.unshift(entry);
        if (this.history.length > 20) this.history = this.history.slice(0, 20);
        localStorage.setItem(this.historyKey, JSON.stringify(this.history));
        this.renderHistory();
        alert('Cálculo salvo no histórico');
    },

    toggleHistory() {
        const panel = document.getElementById('historyPanel');
        if (panel) panel.classList.toggle('hidden');
        this.renderHistory();
    },

    renderHistory() {
        const list = document.getElementById('historyList');
        if (!list) return;
        list.innerHTML = '';
        if (this.history.length === 0) {
            list.innerHTML = '<div style="color: var(--text-muted); text-align:center; padding:10px;">Nenhum histórico</div>';
            return;
        }
        this.history.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div style="font-weight:600">${h.price}</div>
                <div style="font-size:0.8rem; color:var(--text-muted)">${h.date} | Qtd: ${h.qty} | Peso: ${h.weight} | Tempo: ${h.time}</div>
            `;
            list.appendChild(div);
        });
    },

    clearHistory() {
        this.history = [];
        localStorage.removeItem(this.historyKey);
        this.renderHistory();
    },

    loadPresets() {
        const saved = localStorage.getItem(this.presetsKey);
        if (saved) {
            try {
                this.presets = JSON.parse(saved);
            } catch (e) {
                this.presets = {};
            }
        }
    },

    savePreset() {
        const name = document.getElementById('presetName').value.trim();
        if (!name) {
            alert('Digite um nome para o preset');
            return;
        }
        const data = {filaments: this.filaments};
        this.configFields.forEach(f => data[f] = document.getElementById(f).value);
        this.presets[name] = data;
        localStorage.setItem(this.presetsKey, JSON.stringify(this.presets));
        document.getElementById('presetName').value = '';
        this.renderPresetSelect();
        alert('Preset salvo');
    },

    renderPresetSelect() {
        const select = document.getElementById('presetSelect');
        if (!select) return;
        select.innerHTML = '<option value="">Carregar preset...</option>';
        Object.keys(this.presets).forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            select.appendChild(opt);
        });
    },

    loadPreset(name) {
        if (!name || !this.presets[name]) return;
        const data = this.presets[name];
        this.filaments = data.filaments || [];
        this.configFields.forEach(k => {
            if (data[k] !== undefined) document.getElementById(k).value = data[k];
        });
        this.renderFilamentList();
        this.renderColorChoices();
        this.saveToStorage();
        this.calculate();
        alert('Preset carregado');
    },

    deletePreset() {
        const select = document.getElementById('presetSelect');
        const name = select.value;
        if (!name) {
            alert('Selecione um preset');
            return;
        }
        if (confirm(`Excluir preset "${name}"?`)) {
            delete this.presets[name];
            localStorage.setItem(this.presetsKey, JSON.stringify(this.presets));
            this.renderPresetSelect();
        }
    },

    showQRCode() {
        const out = document.getElementById('linkOutput');
        if (!out.value) {
            alert('Gere um link primeiro');
            return;
        }
        const container = document.getElementById('qrContainer');
        container.innerHTML = '';
        new QRCode(container, {
            text: out.value,
            width: 128,
            height: 128
        });
    },

    generatePDF() {
        const price = document.getElementById('finalPrice').innerText;
        if (!price || price.includes('0,00')) {
            alert('Calcule um valor primeiro');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Orçamento - Calculadora Impressão 3D', 10, 10);
        doc.setFontSize(12);
        doc.text(`Data: ${new Date().toLocaleString('pt-BR')}`, 10, 20);
        doc.text(`Quantidade: ${document.getElementById('quantity').value}`, 10, 30);
        doc.text(`Peso: ${document.getElementById('weight').value}`, 10, 40);
        doc.text(`Tempo: ${document.getElementById('minutes').value}`, 10, 50);
        doc.text(`Valor Total: ${price}`, 10, 65);
        doc.save('orcamento-impressao-3d.pdf');
    }
};

window.onload = () => App.init();
