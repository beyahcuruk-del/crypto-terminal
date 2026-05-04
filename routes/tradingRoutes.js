/**
 * Trading Terminal Routes — Full Feature
 * Dashboard, Markets, Trade, Portfolio, Signals
 */

const express = require('express');
const https = require('https');

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'AI-Trading-Terminal/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function callMiMo(mimoClient, messages, maxTokens = 4096) {
  const body = JSON.stringify({
    model: mimoClient.defaultModel,
    messages,
    temperature: 0.3,
    max_tokens: maxTokens
  });
  const url = new URL(`${mimoClient.baseUrl}/chat/completions`);
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? require('https') : require('http');
  return new Promise((resolve, reject) => {
    const req = lib.request({
      hostname: url.hostname, port: url.port || (isHttps ? 443 : 80),
      path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${mimoClient.apiKey}`, 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) reject(new Error(parsed.error.message));
          else resolve(parsed.choices?.[0]?.message?.content || '');
        } catch (e) { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function createTradingRoutes(mimoClient) {
  const router = express.Router();

  // Cache
  let coinsCache = null;
  let coinsCacheTime = 0;
  let globalCache = null;
  let globalCacheTime = 0;
  const CACHE_TTL = 30000;

  // ===== MARKETS =====
  router.get('/api/coins', async (req, res) => {
    try {
      if (coinsCache && Date.now() - coinsCacheTime < CACHE_TTL) return res.json(coinsCache);
      const data = await fetchJSON('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d');
      coinsCache = data;
      coinsCacheTime = Date.now();
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== GLOBAL STATS =====
  router.get('/api/global', async (req, res) => {
    try {
      if (globalCache && Date.now() - globalCacheTime < CACHE_TTL) return res.json(globalCache);
      const data = await fetchJSON('https://api.coingecko.com/api/v3/global');
      globalCache = data;
      globalCacheTime = Date.now();
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== COIN DETAILS =====
  router.get('/api/coins/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const days = req.query.days || '7';
      const [details, chart] = await Promise.all([
        fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`),
        fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`)
      ]);
      res.json({
        id: details.id, symbol: details.symbol, name: details.name,
        image: details.image?.large, market_cap_rank: details.market_cap_rank,
        current_price: details.market_data?.current_price?.usd,
        market_cap: details.market_data?.market_cap?.usd,
        total_volume: details.market_data?.total_volume?.usd,
        high_24h: details.market_data?.high_24h?.usd,
        low_24h: details.market_data?.low_24h?.usd,
        price_change_24h: details.market_data?.price_change_24h,
        price_change_percentage_24h: details.market_data?.price_change_percentage_24h,
        price_change_percentage_7d: details.market_data?.price_change_percentage_7d,
        price_change_percentage_30d: details.market_data?.price_change_percentage_30d,
        ath: details.market_data?.ath?.usd,
        ath_change_percentage: details.market_data?.ath_change_percentage?.usd,
        atl: details.market_data?.atl?.usd,
        circulating_supply: details.market_data?.circulating_supply,
        total_supply: details.market_data?.total_supply,
        max_supply: details.market_data?.max_supply,
        description: details.description?.en?.replace(/<[^>]*>/g, '').substring(0, 500),
        chart: chart.prices || []
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== TRENDING =====
  router.get('/api/trending', async (req, res) => {
    try {
      const data = await fetchJSON('https://api.coingecko.com/api/v3/search/trending');
      res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== AI ANALYSIS =====
  router.post('/api/analyze', async (req, res) => {
    const { coin, price, change24h, change7d, marketCap, volume, high24h, low24h } = req.body;
    if (!coin) return res.status(400).json({ error: 'Missing coin data' });

    const systemPrompt = `You are an expert crypto trading analyst with 10+ years of experience. Analyze the given coin data and provide a detailed trading analysis.

Format your response EXACTLY like this:

**Market Sentiment:** [Bullish/Bearish/Neutral]

**Key Levels:**
- Support: $X, $X
- Resistance: $X, $X

**Technical Analysis:**
[2-3 sentences about price action, trend, volume]

**Short-term Outlook (1-7 days):**
[What to expect]

**Risk Assessment:** [Low/Medium/High]

**Trading Signal:** [Strong Buy/Buy/Hold/Sell/Strong Sell]

**Entry Zone:** $X - $X
**Stop Loss:** $X
**Take Profit:** $X, $X

Be specific with numbers. Use the price data provided to calculate levels.`;

    try {
      const analysis = await callMiMo(mimoClient, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze ${coin}:\n- Price: $${price}\n- 24h Change: ${change24h}%\n- 7d Change: ${change7d}%\n- Market Cap: $${marketCap}\n- 24h Volume: $${volume}\n- 24h High: $${high24h}\n- 24h Low: $${low24h}` }
      ]);
      res.json({ analysis });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== AI SIGNALS =====
  router.post('/api/signals', async (req, res) => {
    const { coins: coinsData } = req.body;
    if (!coinsData) return res.status(400).json({ error: 'Missing coins data' });

    const systemPrompt = `You are a crypto trading analyst. Analyze the coins and output a JSON array of trading signals. Each signal: {"coin":"Name","signal":"Buy/Sell","reason":"1 sentence","confidence":"High/Medium/Low","target":"$price"}. Output ONLY valid JSON array, no markdown.`;

    const summary = coinsData.slice(0, 10).map(c =>
      `${c.name}: $${c.current_price} (${c.price_change_percentage_24h?.toFixed(1)}% 24h)`
    ).join('\n');

    try {
      const result = await callMiMo(mimoClient, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: summary }
      ], 1024);

      let signals;
      try {
        const jsonStr = result.trim().startsWith('[') ? result.trim() : result.match(/\[[\s\S]*\]/)?.[0] || '[]';
        signals = JSON.parse(jsonStr);
      } catch { signals = [{ coin: 'Market', signal: 'Hold', reason: result.substring(0, 200), confidence: 'Medium', target: '—' }]; }
      res.json({ signals });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // ===== CHAT =====
  router.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    if (!messages) return res.status(400).json({ error: 'Missing messages' });
    try {
      const content = await callMiMo(mimoClient, [
        { role: 'system', content: 'You are a crypto trading assistant. Be concise and helpful. Give practical trading advice with specific price levels when possible.' },
        ...messages.slice(-10)
      ]);
      res.json({ content });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
}

module.exports = createTradingRoutes;
