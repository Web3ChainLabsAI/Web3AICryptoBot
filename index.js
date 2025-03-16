const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const path = require('path');
const { createHmac } = require('crypto');

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Binance API настройки
const BINANCE_API_KEY = process.env.BINANCE_API_KEY; // Взема от environment variables
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY; // Взема от environment variables
const BINANCE_API_URL = 'https://api.binance.com'; // Остава както е

// Функция за генериране на Binance HMAC сигнатура
function generateSignature(queryString) {
    return createHmac('sha256', BINANCE_SECRET_KEY)
        .update(queryString)
        .digest('hex');
}

// Функция за вземане на реалновременни цени от Binance
async function getBinancePrices() {
    try {
        const response = await axios.get(`${BINANCE_API_URL}/api/v3/ticker/price`, {
            params: {
                symbols: JSON.stringify(["BTCUSDT", "ETHUSDT", "BNBUSDT"])
            },
            headers: {
                'X-MBX-APIKEY': BINANCE_API_KEY
            }
        });
        return response.data;
    } catch (error) {
        console.error('Binance API error:', error);
        return null;
    }
}

app.get('/api/prices', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
        res.json({ prices: `BTC: $${response.data.bitcoin.usd} | ETH: $${response.data.ethereum.usd}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch prices' });
    }
});

app.get('/api/forecast', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=7');
        const prices = response.data.prices;
        const currentPrice = prices[prices.length - 1][1];
        const avgPrice = prices.slice(-7).reduce((a, b) => a + b[1], 0) / 7;
        res.json({ forecast: `Bitcoin: ${currentPrice > avgPrice ? 'bullish' : 'bearish'}, Price: $${currentPrice.toLocaleString()}` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch forecast' });
    }
});

app.get('/api/chat', async (req, res) => {
    const message = req.query.message || "Hello!";
    const type = req.query.type || "general";

    let prompt = "";
    switch (type) {
        case "smartcontract":
            prompt = "Provide a detailed explanation or example of a smart contract based on this input: ";
            break;
        case "business":
            prompt = "Generate a business idea or advice based on this input: ";
            break;
        case "cv":
            prompt = "Create a CV section or provide CV writing advice based on this input: ";
            break;
        case "other":
            prompt = "Provide information or assistance on this topic: ";
            break;
        case "ai-business":
            prompt = "Provide a business analysis based on this input, incorporating real-time Binance market data: ";
            break;
        default:
            prompt = "Respond as a helpful assistant: ";
    }

    try {
        let binanceData = '';
        if (type === "ai-business") {
            const prices = await getBinancePrices();
            if (prices) {
                binanceData = `Current Binance prices: ${prices.map(p => `${p.symbol}: $${p.price}`).join(', ')}. `;
            } else {
                binanceData = 'Unable to fetch Binance data at this time. ';
            }
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant. Respond in the same language as the user\'s message.' },
                { role: 'user', content: `${prompt}${message}\n${binanceData}` }
            ],
            max_tokens: 300
        });
        res.json({ response: completion.choices[0].message.content.trim() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get response' });
    }
});

app.get('/api/generate-pdf', (req, res) => {
    const content = decodeURIComponent(req.query.content || "No content provided");
    const doc = new PDFDocument({ bufferPages: true });

    doc.registerFont('DejaVuSans', path.join(__dirname, 'fonts', 'DejaVuSans.ttf'));

    res.setHeader('Content-disposition', 'attachment; filename=Business_Report.pdf');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);

    doc.font('DejaVuSans').fontSize(16).text('AI Business Report', { align: 'center' });
    doc.moveDown();
    doc.font('DejaVuSans').fontSize(12).text(content, { align: 'left' });

    doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
