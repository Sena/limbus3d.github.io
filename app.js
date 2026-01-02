const App = {
    energyData: {},
    printerData: {},
    storageKey: 'calc3d_settings_v2',
    panelStateKey: 'calc3d_panel_open',
    configFields: ['energyKwh', 'consumoKw', 'margin', 'machineCost', 'hourRate', 'selEst', 'selImp'],
    filaments: [],
    selectedFilaments: new Set(),

    async init() {
        this.bindEvents();
        await this.loadData();

        this.loadFromStorage();
        this.parseUrlParams();
        this.restorePanelState();
        this.renderFilamentList();
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
        const clean = val.toLowerCase().replace(',', '.');
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
    }
};

window.onload = () => App.init();
