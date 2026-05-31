# Knowledge Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual action that captures a completed assistant message into `knowledge/chat-captures/` as an auditable Markdown file.

**Architecture:** Add a focused backend API module that validates session messages, formats Markdown, and writes unique files under the knowledge directory. Add frontend API/store wiring and a message-level button that calls the backend and opens the captured file in the inspector.

**Tech Stack:** FastAPI, Pydantic, Python `unittest`, Next.js 14, React 18, TypeScript, Tailwind CSS, lucide-react.

---

### Task 1: Backend Capture API

**Files:**
- Create: `backend/api/knowledge_capture.py`
- Modify: `backend/app.py`
- Test: `backend/tests/test_knowledge_capture.py`

- [ ] **Step 1: Write backend tests**

Create `backend/tests/test_knowledge_capture.py` with tests that create a temporary `SessionManager`, save an assistant message with retrieval evidence, call `capture_assistant_message`, and assert the file path and Markdown content.

- [ ] **Step 2: Run the failing backend tests**

Run: `cd backend && uv run python -m unittest tests.test_knowledge_capture`

Expected: FAIL because `api.knowledge_capture` does not exist.

- [ ] **Step 3: Implement the backend module**

Create `backend/api/knowledge_capture.py` with:

- `CaptureKnowledgeRequest`
- `CaptureKnowledgeResponse`
- `capture_assistant_message`
- `build_knowledge_markdown`
- `POST /knowledge/captures`

The helper should write Markdown under `knowledge/chat-captures/` and reject invalid, non-assistant, or empty messages with `ValueError`.

- [ ] **Step 4: Wire the router**

Modify `backend/app.py` to import `knowledge_capture_router` and include it with prefix `/api`.

- [ ] **Step 5: Run backend tests**

Run: `cd backend && uv run python -m unittest tests.test_knowledge_capture`

Expected: PASS.

### Task 2: Frontend Capture Action

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/store.tsx`
- Modify: `frontend/src/components/chat/ChatMessage.tsx`
- Modify: `frontend/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Add frontend API client**

Add `captureMessageAsKnowledge(sessionId, messageIndex)` to call `POST /knowledge/captures`.

- [ ] **Step 2: Track message indexes**

Extend the UI message type with `sessionIndex?: number` and set it inside `toUiMessages` from the persisted history index.

- [ ] **Step 3: Add store action**

Add `captureMessageAsKnowledge(messageId)` to the app store. It should find the message, call the API, then call `loadInspectorFile(response.path)` so the captured Markdown opens for review.

- [ ] **Step 4: Add message button**

Render a `沉淀为知识` button on assistant messages that have non-empty content and a numeric `sessionIndex`. Disable it while saving and show `已沉淀` after success.

- [ ] **Step 5: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

### Task 3: Final Verification and Commit

**Files:**
- Review all modified files with `git diff`

- [ ] **Step 1: Run backend unit tests**

Run: `cd backend && uv run python -m unittest tests.test_knowledge_capture`

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend && npm run build`

Expected: PASS.

- [ ] **Step 3: Inspect git status**

Run: `git status --short`

Expected: Only intentional feature, test, and documentation files are modified or added.

- [ ] **Step 4: Commit and push**

Run: `git add ... && git commit -m "feat: capture chat answers as knowledge" && git push origin main`

Expected: Commit succeeds and push updates `origin/main`.
