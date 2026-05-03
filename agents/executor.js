/**
 * Executor Agent
 * Model: MiMo-V2.5 (lightweight, fast)
 * Executes a single task and returns structured output.
 */

const SYSTEM_PROMPT = `You are an Executor Agent. You execute ONE specific task precisely and return a structured result.

RULES:
- Focus ONLY on the given task, nothing else
- Be deterministic and practical
- For coding tasks: provide working code with file paths
- For API tasks: provide endpoint specs and sample calls
- For data tasks: provide data structures and processing logic
- For content tasks: produce the actual content

Return your result as JSON with this structure:
{
  "output": "your detailed result or code here",
  "artifacts": ["list of files or outputs created"],
  "notes": "any important notes or caveats"
}`;

class ExecutorAgent {
  constructor(mimoClient) {
    this.client = mimoClient;
    this.model = 'mimo-v2.5';
  }

  async execute(task, context = {}) {
    const userMessage = this._buildPrompt(task, context);

    const response = await this.client.chat({
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      model: this.model,
      temperature: 0.1,
      maxTokens: 8192
    });

    let result;
    try {
      const jsonStr = this._extractJSON(response.content);
      result = JSON.parse(jsonStr);
    } catch (e) {
      // If JSON parse fails, wrap raw output
      result = {
        output: response.content,
        artifacts: [],
        notes: 'Output was not structured JSON, wrapping raw response'
      };
    }

    return {
      ...result,
      taskId: task.id,
      usage: response.usage,
      model: response.model
    };
  }

  _buildPrompt(task, context) {
    let prompt = `TASK #${task.id}: ${task.task}\nType: ${task.type}\n`;

    if (context.previousResults && context.previousResults.length > 0) {
      prompt += `\nContext from previous tasks:\n`;
      for (const prev of context.previousResults) {
        prompt += `- Task #${prev.taskId}: ${prev.output?.substring(0, 300)}...\n`;
      }
    }

    if (context.feedback) {
      prompt += `\nFeedback from critic (retry): ${context.feedback}\n`;
    }

    prompt += `\nExecute this task now.`;
    return prompt;
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

module.exports = ExecutorAgent;
