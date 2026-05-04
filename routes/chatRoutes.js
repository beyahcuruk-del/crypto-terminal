/**
 * Chat Routes — Single Agent
 * POST /chat — Send conversation, get AI response
 */

const express = require('express');

const SYSTEM_PROMPT = `You are a helpful AI assistant. Be concise, clear, and direct. Answer the user's questions accurately. When writing code, use proper formatting with code blocks. Keep responses focused and practical.`;

function createChatRoutes(mimoClient) {
  const router = express.Router();

  /**
   * POST /chat
   * Body: { messages: [{role, content}], model?: string }
   * Returns: { content, model, usage }
   */
  router.post('/chat', async (req, res) => {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages array' });
    }

    try {
      // Build messages array with system prompt
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.slice(-20) // Keep last 20 messages to avoid token overflow
      ];

      const body = JSON.stringify({
        model: model || mimoClient.defaultModel,
        messages: apiMessages,
        temperature: 0.4,
        max_tokens: 4096
      });

      const https = require('https');
      const http = require('http');
      const url = new URL(`${mimoClient.baseUrl}/chat/completions`);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const apiReq = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mimoClient.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              return res.status(500).json({ error: parsed.error.message || 'API error' });
            }
            const choice = parsed.choices?.[0];
            res.json({
              content: choice?.message?.content || '',
              model: parsed.model,
              usage: parsed.usage
            });
          } catch (e) {
            res.status(500).json({ error: 'Failed to parse API response' });
          }
        });
      });

      apiReq.on('error', (err) => {
        res.status(500).json({ error: err.message });
      });

      apiReq.setTimeout(120000, () => {
        apiReq.destroy();
        res.status(504).json({ error: 'Request timeout' });
      });

      apiReq.write(body);
      apiReq.end();

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /status
   */
  router.get('/status', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  return router;
}

module.exports = createChatRoutes;
