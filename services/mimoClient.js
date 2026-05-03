/**
 * MiMo API Client
 * Modular, reusable client for all MiMo model calls.
 */

const https = require('https');
const http = require('http');

class MiMoClient {
  constructor({ apiKey, baseUrl }) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultModel = 'mimo-v2.5-pro';
  }

  /**
   * Send a chat completion request to MiMo API.
   * @param {Object} options
   * @param {string} options.systemPrompt - System message
   * @param {string} options.userMessage - User message
   * @param {string} [options.model] - Model override
   * @param {number} [options.temperature=0.3] - Temperature
   * @param {number} [options.maxTokens=4096] - Max tokens
   * @returns {Promise<{content: string, usage: Object, model: string}>}
   */
  async chat({ systemPrompt, userMessage, model, temperature = 0.3, maxTokens = 4096 }) {
    const body = JSON.stringify({
      model: model || this.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature,
      max_tokens: maxTokens
    });

    const url = new URL(`${this.baseUrl}/chat/completions`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Length': Buffer.byteLength(body)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(`MiMo API Error: ${parsed.error.message || JSON.stringify(parsed.error)}`));
              return;
            }
            const choice = parsed.choices?.[0];
            resolve({
              content: choice?.message?.content || '',
              usage: parsed.usage || {},
              model: parsed.model || model
            });
          } catch (e) {
            reject(new Error(`Failed to parse MiMo response: ${data.substring(0, 500)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(120000, () => {
        req.destroy();
        reject(new Error('MiMo API request timeout (120s)'));
      });
      req.write(body);
      req.end();
    });
  }
}

module.exports = MiMoClient;
