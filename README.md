# 🧠 Multi-Agent System

Autonomous multi-agent assistant powered by MiMo API.

## Architecture

```
User Goal
    ↓
┌─────────────┐
│  Orchestrator │ ← Core engine, controls flow
└──────┬──────┘
       ↓
┌─────────────┐
│   Planner    │ ← MiMo-V2.5-Pro: breaks goal into tasks
└──────┬──────┘
       ↓
┌─────────────┐
│  Executor    │ ← MiMo-V2.5: runs each task
└──────┬──────┘
       ↓
┌─────────────┐
│   Critic     │ ← MiMo-V2.5-Pro: evaluates results
└──────┬──────┘
       ↓
   Retry or Next → Final Result
```

## Agents

| Agent    | Model          | Role                              |
|----------|----------------|-----------------------------------|
| Planner  | MiMo-V2.5-Pro  | Breaks goal into structured tasks |
| Executor | MiMo-V2.5      | Executes individual tasks         |
| Critic   | MiMo-V2.5-Pro  | Evaluates quality, suggests fixes |

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env, add your MIMO_API_KEY

# 3. Run
npm start
# or with auto-reload:
npm run dev

# 4. Test
curl -X POST http://localhost:3000/run-task \
  -H "Content-Type: application/json" \
  -d '{"goal": "Create a simple hello world Express API with 3 endpoints"}'
```

## API Endpoints

| Method | Path              | Description              |
|--------|-------------------|--------------------------|
| POST   | /run-task         | Run a goal through agents |
| GET    | /status           | Health check + stats      |
| GET    | /results          | All stored task results   |
| GET    | /results/:taskId  | Specific task result      |

### POST /run-task

**Request:**
```json
{
  "goal": "Build a crypto dashboard website"
}
```

**Response:**
```json
{
  "sessionId": "uuid",
  "status": "completed",
  "elapsed": "45.2s",
  "totalTasks": 5,
  "completed": 5,
  "failed": 0,
  "steps": [...],
  "logs": [...]
}
```

## Retry Logic

- Max 3 retries per task
- Critic provides feedback on failure
- Executor receives feedback on retry
- Failed tasks don't block subsequent tasks

## Project Structure

```
multi-agent-system/
├── agents/
│   ├── planner.js      # Goal → Task list
│   ├── executor.js     # Task → Result
│   └── critic.js       # Result → Evaluation
├── core/
│   └── orchestrator.js # Workflow engine
├── services/
│   └── mimoClient.js   # MiMo API client
├── memory/
│   └── store.js        # In-memory state
├── routes/
│   └── taskRoutes.js   # Express routes
├── index.js            # Entry point
├── package.json
└── .env
```

## Environment Variables

| Variable       | Default                                          | Description       |
|----------------|--------------------------------------------------|-------------------|
| MIMO_API_KEY   | (required)                                       | MiMo API key      |
| MIMO_BASE_URL  | https://token-plan-sgp.xiaomimimo.com/v1         | API base URL      |
| PORT           | 3000                                             | Server port       |

## License

Private — Internal use only.
