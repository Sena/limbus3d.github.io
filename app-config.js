const ConfigApp = {
    energyData: {},
    printerData: {},

    async init() {
        this.bindEvents();
        await this.loadRemoteData();
        this.generateLink();
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
            console.warn("Dedução: Arquivos JSON não encontrados ou erro de rede. Operando em modo manual.");
        }
    },

    populateEnergy() {
        const select = document.getElementById('selEst');
        // Mantém o 'outros' que já está no HTML e adiciona os novos antes dele
        const fragment = document.createDocumentFragment();
        for (const key in this.energyData) {
            const opt = document.createElement('option');
            opt.value = this.energyData[key].value;
            opt.textContent = `${this.energyData[key].name} (R$ ${this.energyData[key].value.toFixed(2)})`;
            fragment.appendChild(opt);
        }
        select.prepend(fragment);
    },

    populatePrinters() {
        const select = document.getElementById('selImp');
        const fragment = document.createDocumentFragment();
        for (const brand in this.printerData) {
            const group = document.createElement('optgroup');
            group.label = brand;
            this.printerData[brand].forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.watts;
                opt.textContent = `${brand} - ${p.model} (${(p.watts * 1000)}W)`;
                fragment.appendChild(opt);
            });
            fragment.appendChild(group);
        }
        select.prepend(fragment);
    },

    bindEvents() {
        const form = document.getElementById('configForm');
        
        form.addEventListener('input', (e) => {
            const targetId = e.target.id;

            // Se o usuário digitar manualmente no valor de energia, volta o select para 'outros'
            if (targetId === 'energyKwh') {
                document.getElementById('selEst').value = 'outros';
            }
            // Se o usuário digitar manualmente no consumo, volta o select para 'outros'
            if (targetId === 'consumoKw') {
                document.getElementById('selImp').value = 'outros';
            }

            // Se a mudança for no SELECT, atualiza o campo de valor
            if (targetId === 'selEst' && e.target.value !== 'outros') {
                document.getElementById('energyKwh').value = e.target.value;
            }
            if (targetId === 'selImp' && e.target.value !== 'outros') {
                document.getElementById('consumoKw').value = e.target.value;
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
        const url = window.location.href.replace('config.html', 'simulador.html') + '?data=' + b64;
        document.getElementById('linkOutput').innerText = url;
    }
};

function copy() { 
    navigator.clipboard.writeText(document.getElementById('linkOutput').innerText); 
    alert("Link copiado!"); 
}

window.onload = () => ConfigApp.init();
