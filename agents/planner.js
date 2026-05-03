/**
 * Planner Agent
 * Model: MiMo-V2.5-Pro
 * Breaks user goal into structured task list.
 */

const SYSTEM_PROMPT = `You are a Planner Agent. Your job is to break a high-level user goal into a minimal, actionable task list.

RULES:
- Output ONLY valid JSON array, no markdown, no explanation
- Each task must have: id (number), task (string), type (string)
- Valid types: coding, frontend, backend, api, data, content, research, testing, deployment
- Tasks should be ordered by dependency (prerequisite tasks first)
- Keep tasks atomic and specific
- Max 15 tasks per plan

Example output:
[
  {"id": 1, "task": "Initialize project with required dependencies", "type": "coding"},
  {"id": 2, "task": "Create database schema and models", "type": "backend"},
  {"id": 3, "task": "Build REST API endpoints", "type": "api"}
]`;

class PlannerAgent {
  constructor(mimoClient) {
    this.client = mimoClient;
    this.model = 'mimo-v2.5-pro';
  }

  async plan(goal) {
    const response = await this.client.chat({
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Goal: ${goal}`,
      model: this.model,
      temperature: 0.2,
      maxTokens: 4096
    });

    let tasks;
    try {
      // Extract JSON from response (handle potential wrapping)
      const jsonStr = this._extractJSON(response.content);
      tasks = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error(`Planner failed to produce valid JSON: ${e.message}\nRaw: ${response.content.substring(0, 500)}`);
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Planner returned empty or non-array tasks');
    }

    return {
      tasks,
      usage: response.usage,
      model: response.model
    };
  }

  _extractJSON(text) {
    // Try direct parse first
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) return trimmed;

    // Try to find JSON block in markdown code fence
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return match[1].trim();

    // Try finding array in text
    const arrStart = trimmed.indexOf('[');
    const arrEnd = trimmed.lastIndexOf(']');
    if (arrStart !== -1 && arrEnd > arrStart) {
      return trimmed.substring(arrStart, arrEnd + 1);
    }

    return trimmed;
  }
}

module.exports = PlannerAgent;
