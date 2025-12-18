async function loadData() {
    try {
        const [energyRes, printerRes] = await Promise.all([
            fetch('energy.json'),
            fetch('printers.json')
        ]);

        const energyData = await energyRes.json();
        const printerData = await printerRes.json();

        populateEnergy(energyData);
        populatePrinters(printerData);
    } catch (error) {
        console.error("Erro ao carregar arquivos JSON:", error);
    }
}

function populateEnergy(data) {
    const select = document.getElementById('selEst');
    select.innerHTML = ''; // Limpa atual

    for (const key in data) {
        const opt = document.createElement('option');
        opt.value = data[key].value;
        opt.textContent = `${data[key].name} (R$ ${data[key].value.toFixed(2).replace('.', ',')})`;
        select.appendChild(opt);
    }
    
    const manual = document.createElement('option');
    manual.value = 'outros';
    manual.textContent = 'Inserir Manualmente';
    select.appendChild(manual);
}

function populatePrinters(data) {
    const select = document.getElementById('selImp');
    select.innerHTML = '';

    for (const brand in data) {
        const group = document.createElement('optgroup');
        group.label = brand;
        
        data[brand].forEach(printer => {
            const opt = document.createElement('option');
            opt.value = printer.watts;
            opt.textContent = `${brand} - ${printer.model} (${(printer.watts * 1000)}W)`;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    const manual = document.createElement('option');
    manual.value = 'outros';
    manual.textContent = 'Personalizado (Manual)';
    select.appendChild(manual);
}

function gerar() {
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
    document.getElementById('linkOutput').innerText = window.location.href.replace('config.html', 'simulador.html') + '?data=' + b64;
}

function copy() { 
    navigator.clipboard.writeText(document.getElementById('linkOutput').innerText); 
    alert("Link configurado com sucesso e copiado!"); 
}

// Event Listeners
document.getElementById('configForm').addEventListener('input', (e) => {
    if(e.target.id === 'selEst' && e.target.value !== 'outros') document.getElementById('energyKwh').value = e.target.value;
    if(e.target.id === 'selImp' && e.target.value !== 'outros') document.getElementById('consumoKw').value = e.target.value;
    gerar();
});

window.onload = async () => {
    await loadData();
    gerar();
};
