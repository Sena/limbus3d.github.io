/**
 * Objeto de Configuração Mestra
 */
const ConfigApp = {
    energyData: {},
    printerData: {},

    async init() {
        this.setInitialState();
        this.bindEvents();
        await this.loadRemoteData();
        this.generateLink();
    },

    setInitialState() {
        ['selEst', 'selImp'].forEach(id => {
            const el = document.getElementById(id);
            const placeholder = document.createElement('option');
            placeholder.value = "placeholder";
            placeholder.textContent = "-- Selecione uma opção --";
            placeholder.disabled = true;
            placeholder.selected = true;
            el.prepend(placeholder);
        });
    },

    async loadRemoteData() {
        try {
            const [energyRes, printerRes] = await Promise.all([
                fetch('energy.json'),
                fetch('printers.json')
            ]);
            this.energyData = await energyRes.json();
            this.printerData = await printerRes.json();
            this.populateEnergy();
            this.populatePrinters();
        } catch (e) {
            console.warn("Dedução: Falha ao carregar JSONs. Operando em modo manual.");
        }
    },

    populateEnergy() {
        const select = document.getElementById('selEst');
        for (const key in this.energyData) {
            const opt = document.createElement('option');
            opt.value = this.energyData[key].value;
            opt.textContent = `${this.energyData[key].name} (R$ ${this.energyData[key].value.toFixed(2)})`;
            select.insertBefore(opt, select.lastElementChild);
        }
    },

    populatePrinters() {
        const select = document.getElementById('selImp');
        for (const brand in this.printerData) {
            const group = document.createElement('optgroup');
            group.label = brand;
            this.printerData[brand].forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.watts;
                opt.textContent = `${brand} - ${p.model} (${(p.watts * 1000)}W)`;
                group.appendChild(opt);
            });
            select.insertBefore(group, select.lastElementChild);
        }
    },

    bindEvents() {
        const form = document.getElementById('configForm');
        form.addEventListener('input', (e) => {
            const targetId = e.target.id;
            if (targetId === 'energyKwh') document.getElementById('selEst').value = 'outros';
            if (targetId === 'consumoKw') document.getElementById('selImp').value = 'outros';

            if ((targetId === 'selEst' || targetId === 'selImp') && !['outros', 'placeholder'].includes(e.target.value)) {
                const valInput = (targetId === 'selEst') ? 'energyKwh' : 'consumoKw';
                document.getElementById(valInput).value = e.target.value;
            }
            this.generateLink();
        });
    },

    generateLink() {
        const pRolo = parseFloat(document.getElementById('pRolo').value) || 0;
        const wRolo = parseFloat(document.getElementById('wRolo').value) || 1000;
        const pKg = ((pRolo / wRolo) * 1000).toFixed(2);

        const data = {
            priceKg: pKg,
            energyKwh: document.getElementById('energyKwh').value,
            machineCost: document.getElementById('machineCost').value,
            margin: document.getElementById('margin').value,
            consumoKw: document.getElementById('consumoKw').value
        };

        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const url = window.location.href.split('?')[0].replace('config.html', 'index.html') + '?data=' + b64;
        document.getElementById('linkOutput').value = url;
        document.getElementById('btnGo').href = url;
    },

    copy() {
        const output = document.getElementById('linkOutput');
        output.select();
        document.execCommand('copy');
        alert("Link copiado!");
    }
};

window.onload = () => ConfigApp.init();
