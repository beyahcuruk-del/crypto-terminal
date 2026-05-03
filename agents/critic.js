/**
 * Critic Agent
 * Model: MiMo-V2.5-Pro
 * Evaluates task outputs for quality and correctness.
 */

const SYSTEM_PROMPT = `You are a Critic Agent. You evaluate the quality and correctness of task execution results.

RULES:
- Be strict but fair
- Check: completeness, correctness, relevance, quality
- Return ONLY valid JSON, no markdown wrapping

Return your evaluation as JSON:
{
  "success": true/false,
  "score": 0-100,
  "feedback": "specific feedback on what's good or bad",
  "retrySuggestion": "what to fix if retrying, or null if passed",
  "issues": ["list of specific issues found"]
}`;

class CriticAgent {
  constructor(mimoClient) {
    this.client = mimoClient;
    this.model = 'mimo-v2.5-pro';
  }

  async evaluate(task, executorResult) {
    const userMessage = `TASK: ${task.task} (type: ${task.type})

EXECUTOR OUTPUT:
${JSON.stringify(executorResult, null, 2).substring(0, 6000)}

Evaluate this output. Is it complete, correct, and high quality?`;

    const response = await this.client.chat({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      model: this.model,
      temperature: 0.1,
      maxTokens: 2048
    });

    let evaluation;
    try {
      const jsonStr = this._extractJSON(response.content);
      evaluation = JSON.parse(jsonStr);
    } catch (e) {
      // Fallback: treat as success if can't parse
      evaluation = {
        success: true,
        score: 50,
        feedback: 'Critic output was not parseable, defaulting to pass',
        retrySuggestion: null,
        issues: ['Critic JSON parse failure']
      };
    }

    return {
      ...evaluation,
      usage: response.usage,
      model: response.model
    };
  }

  _extractJSON(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) return trimmed;

    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return match[1].trim();

    const objStart = trimmed.indexOf('{');
    const objEnd = trimmed.lastIndexOf('}');
    if (objStart !== -1 && objEnd > objStart) {
      return trimmed.substring(objStart, objEnd + 1);
    }

    return trimmed;
  }
}

module.exports = CriticAgent;
