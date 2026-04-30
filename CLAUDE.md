# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ragclaw — a local-first, file-observable, audit-friendly Agent workbench. The core design is **Skill-First Hybrid RAG**: skill retrieval always runs first; only when skill evidence is insufficient does the system fall back to vector + BM25 + RRF fusion.

Key principles:
- **File is the source of truth** — memory, sessions, skills, knowledge are all local files
- **Skills are readable** — each skill is a `skills/*/SKILL.md` file, not a black-box function
- **Observable retrieval** — frontend shows each retrieval step, evidence source, and tool call

## Commands

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then edit .env with API keys
uvicorn app:app --host 127.0.0.1 --port 8004 --reload

# Frontend
cd frontend
npm install
npm run dev                # defaults to http://localhost:3000

# Evaluation scripts (run from backend/)
python scripts/evaluate_faq_retrieval.py
python scripts/evaluate_faq_agent_retrieval.py
python scripts/evaluate_faq_system_accuracy.py
```

Health check: `http://127.0.0.1:8004/health`

## Project Structure

```
ragclaw/
├── backend/
│   ├── app.py                         # FastAPI entry, lifespan init (index build, agent init)
│   ├── config.py                      # Settings from .env, RuntimeConfigManager (RAG mode toggle)
│   ├── api/                           # FastAPI route handlers
│   │   ├── chat.py                    #   SSE streaming chat endpoint
│   │   ├── sessions.py                #   Session CRUD
│   │   ├── files.py                   #   File listing/reading under backend/
│   │   ├── tokens.py                  #   Token counting/compression
│   │   ├── config_api.py              #   RAG mode toggle
│   │   └── knowledge_index.py         #   Index status + rebuild trigger
│   ├── graph/                         # Agent orchestration + prompt assembly
│   │   ├── agent.py                   #   AgentManager: LangChain agent streaming, knowledge routing
│   │   ├── prompt_builder.py          #   Assembles system prompt from workspace/ components
│   │   ├── session_manager.py         #   Session CRUD + persistence to sessions/*.json
│   │   └── memory_indexer.py          #   LlamaIndex vector index over memory/MEMORY.md
│   ├── knowledge_retrieval/           # Skill-first hybrid retrieval pipeline
│   │   ├── orchestrator.py            #   KnowledgeOrchestrator: skill → hybrid fallback
│   │   ├── skill_retriever_agent.py   #   SkillRetrieverAgent: reads SKILL.md, inspects knowledge/ locally
│   │   ├── hybrid_retriever.py        #   Dispatches to vector + BM25
│   │   ├── indexer.py                 #   KnowledgeIndexer: build/load vector + BM25 indices
│   │   ├── fusion.py                  #   reciprocal_rank_fusion (RRF)
│   │   └── types.py                   #   Evidence, RetrievalStep, SkillRetrievalResult, etc.
│   ├── tools/                         # LangChain tools available to agents
│   │   ├── terminal_tool.py           #   Shell command execution (sandboxed to backend/)
│   │   ├── python_repl_tool.py        #   Python REPL
│   │   ├── read_file_tool.py          #   File reader
│   │   ├── fetch_url_tool.py          #   HTTP fetch
│   │   └── skills_scanner.py          #   Scans skills/*/SKILL.md to produce SKILLS_SNAPSHOT.md
│   ├── skills/                        # One directory per skill, each with SKILL.md
│   │   ├── rag-skill/                 #   Knowledge retrieval skill (primary)
│   │   ├── web-search/                #   Tavily-based web search
│   │   ├── get_weather/               #   Weather query
│   │   └── retry-lesson-capture/     #   Failure retrospection
│   ├── workspace/                     # System prompt components
│   │   ├── SOUL.md                    #   Agent persona / values
│   │   ├── IDENTITY.md                #   Agent identity
│   │   ├── USER.md                    #   User profile
│   │   └── AGENTS.md                  #   Agent coordination guide
│   ├── knowledge/                     # Local knowledge base files
│   ├── memory/MEMORY.md               # Long-term memory (editable Markdown)
│   ├── sessions/                      # Chat session JSON files
│   └── storage/                       # Cached indices + eval outputs
├── frontend/                          # Next.js 14 three-panel workbench
└── README.md
```

## Retrieval Pipeline

```
User query → AgentManager detects knowledge keywords
  → SkillRetrieverAgent reads skills/rag-skill/SKILL.md, inspects knowledge/ files
  → If skill status = success: answer directly from skill evidence
  → If partial/not_found/uncertain: fallback to hybrid retrieval
      → Vector search (LlamaIndex, OpenAI-compatible embedding)
      → BM25 search (custom implementation)
      → RRF fusion → final answer
```

Evidence and tool call steps are streamed to the frontend as SSE events for visualization.

## Configuration

Settings are resolved from `backend/.env` (priority) then system environment. Supports multiple providers via aliasing (e.g., `glm` → `zhipu`, `dashscope` → `bailian`). See `config.py` for the full mapping.

- **LLM providers**: zhipu, bailian, deepseek, openai
- **Embedding providers**: zhipu, bailian, openai
- **RAG mode**: toggled at runtime via `PUT /api/config/rag-mode`, writes to `backend/config.json`

## Adding a Skill

1. Create `skills/<name>/SKILL.md` with the skill workflow in Markdown
2. If the skill needs scripts, add them in `skills/<name>/scripts/`
3. The skill will be auto-discovered on next startup via `skills_scanner.py`

## Evaluation

FAQ retrieval evaluation scripts in `scripts/` use Ragas metrics. Results go to `storage/eval_outputs/`. No test framework is configured — evaluation is run ad-hoc.
