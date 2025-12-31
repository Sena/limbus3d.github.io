const App = {
    energyData: {},
    printerData: {},
    storageKey: 'calc3d_settings',

    async init() {
        this.bindEvents();
        await this.loadData();
        
        // 1. Carrega do Storage primeiro
        this.loadFromStorage();
        // 2. Sobrescreve com a URL se houver dados novos
        this.parseUrlParams();
        
        this.checkConfigState();
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
        for (let k in this.energyData) {
            let o = new Option(`${this.energyData[k].name} (R$${this.energyData[k].value})`, this.energyData[k].value);
            sEst.add(o, sEst.options[sEst.options.length - 1]);
        }
        for (let brand in this.printerData) {
            let g = document.createElement('optgroup'); g.label = brand;
            this.printerData[brand].forEach(p => g.appendChild(new Option(`${p.model} (${p.watts * 1000}W)`, p.watts)));
            sImp.add(g, sImp.options[sImp.options.length - 1]);
        }
    },

    bindEvents() {
        document.getElementById('toggleConfig').onclick = () => {
            document.getElementById('configPanel').classList.toggle('hidden');
            // Remove a animação de atenção ao abrir pela primeira vez
            document.getElementById('toggleConfig').classList.remove('attention-mode');
        };

        document.getElementById('simulatorForm').oninput = () => this.calculate();
        
        document.getElementById('configForm').oninput = (e) => {
            if (e.target.id === 'selEst' && e.target.value !== 'outros') document.getElementById('energyKwh').value = e.target.value;
            if (e.target.id === 'selImp' && e.target.value !== 'outros') document.getElementById('consumoKw').value = e.target.value;
            
            this.updatePriceKg();
            this.saveToStorage();
            this.generateLink();
            this.calculate();
        };
    },

    updatePriceKg() {
        const pR = parseFloat(document.getElementById('pRolo').value) || 0;
        const wR = parseFloat(document.getElementById('wRolo').value) || 1000;
        document.getElementById('priceKg').value = ((pR / wR) * 1000).toFixed(2);
    },

    saveToStorage() {
        const fields = ['energyKwh', 'consumoKw', 'margin', 'pRolo', 'wRolo', 'machineCost', 'selEst', 'selImp'];
        const data = {};
        fields.forEach(f => data[f] = document.getElementById(f).value);
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    },

    loadFromStorage() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            const data = JSON.parse(saved);
            this.fillFields(data);
        }
    },

    parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('data');
        if (raw) {
            try {
                const data = JSON.parse(atob(raw));
                this.fillFields(data);
                this.saveToStorage(); // Salva os dados vindos da URL
            } catch (e) { console.error("Erro decode URL"); }
        }
    },

    fillFields(data) {
        Object.keys(data).forEach(k => {
            const el = document.getElementById(k);
            if (el) el.value = data[k];
        });
        this.updatePriceKg();
    },

    checkConfigState() {
        // Se não houver nada no storage, ativa animação de "atenção"
        if (!localStorage.getItem(this.storageKey)) {
            document.getElementById('toggleConfig').classList.add('attention-mode');
        }
    },

    generateLink() {
        const fields = ['energyKwh', 'consumoKw', 'margin', 'pRolo', 'wRolo', 'machineCost'];
        const data = {};
        fields.forEach(f => data[f] = document.getElementById(f).value);
        const b64 = btoa(JSON.stringify(data));
        document.getElementById('linkOutput').value = `${window.location.origin}${window.location.pathname}?data=${b64}`;
    },

    calculate() {
        const weightRaw = document.getElementById('weight').value;
        const timeRaw = document.getElementById('minutes').value;
        const qty = parseFloat(document.getElementById('quantity').value) || 1;

        const grams = this.parseUnit(weightRaw, 'w');
        const mins = this.parseUnit(timeRaw, 't');

        if (!grams) {
            document.getElementById('instruction').classList.remove('hidden');
            document.getElementById('resultBox').classList.add('hidden');
            return;
        }

        const h = (mins * qty) / 60;
        const filament = ((grams * qty) / 1000) * parseFloat(document.getElementById('priceKg').value);
        const energy = parseFloat(document.getElementById('consumoKw').value) * h * parseFloat(document.getElementById('energyKwh').value);
        const total = (filament + energy + parseFloat(document.getElementById('machineCost').value)) * parseFloat(document.getElementById('margin').value);

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