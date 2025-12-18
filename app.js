/**
 * Data Processing Engine
 */
const AppEngine = {
    // Basic units regex
    patterns: {
        weight: /^(\d+\.?\d*)\s*(g|kg|kilos|gramas)?$/,
        time: /^(\d+\.?\d*)\s*(m|min|minutos|h|hora|horas)?$/
    },

    /**
     * Parse text input into numeric values (grams or minutes)
     */
    parseInput(value, type) {
        const cleanValue = value.trim().toLowerCase().replace(',', '.');
        if (!cleanValue || cleanValue === "0") return 0;

        const match = cleanValue.match(this.patterns[type]);
        if (!match) return null;

        const num = parseFloat(match[1]);
        const unit = match[2];

        if (type === 'weight') {
            return (unit === 'kg' || unit === 'kilos') ? num * 1000 : num;
        } else {
            return (unit === 'h' || unit === 'hora' || unit === 'horas') ? num * 60 : num;
        }
    },

    /**
     * Core 3D Price Calculation Logic
     */
    calculatePrice(params) {
        const hours = params.totalMinutes / 60;
        const filamentCost = (params.totalGrams / 1000) * params.priceKg;
        const energyCost = params.machineKw * hours * params.energyPriceKwh;
        const subtotal = filamentCost + energyCost + params.fixedCost;
        
        return (subtotal * params.margin).toFixed(2);
    },

    /**
     * Base64 URL Handling
     */
    encodeData(obj) {
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    },

    decodeData(base64) {
        try {
            return JSON.parse(decodeURIComponent(escape(atob(base64))));
        } catch (e) {
            console.error("Engine Error: Failed to decode data");
            return null;
        }
    }
};
