const express = require('express');
const OpenAI = require('openai');
const axios = require('axios');
const PDFDocument = require('pdfkit');

const app = express();

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
            prompt = "Provide a business analysis based on this input: ";
            break;
        default:
            prompt = "Respond as a helpful assistant: ";
    }

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant. Respond in the same language as the user\'s message.' },
                { role: 'user', content: `${prompt}${message}` }
            ],
            max_tokens: 300
        });
        res.json({ response: completion.choices[0].message.content.trim() });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get response' });
    }
});

app.get('/api/generate-pdf', (req, res) => {
    const content = decodeURIComponent(req.query.content || "No content provided"); // Декодираме URL параметъра
    const doc = new PDFDocument({ font: 'Helvetica' }); // Изрично задаваме шрифт с UTF-8 поддръжка
    res.setHeader('Content-disposition', 'attachment; filename=Business_Report.pdf');
    res.setHeader('Content-type', 'application/pdf');
    doc.pipe(res);
    doc.fontSize(16).text('AI Business Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(content, { align: 'left', encoding: 'utf8' }); // Указваме UTF-8 енкодинг
    doc.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
