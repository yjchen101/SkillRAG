# Long Context Compression Design

Date: 2026-05-19
Scope: SkillRAG backend post-turn long-context compression for chat sessions
Status: Approved design, not yet implemented

## Goal

Implement automatic long-context compression for chat sessions with these fixed product choices:

- Answer quality first
- Automatic trigger
- Structured summary output
- Compression visible to the frontend
- Post-turn only; no pre-turn emergency compression

The purpose is to keep the next turn's prompt context within a target budget while preserving the most useful recent conversation in raw form.

## Current State

The current backend has a manual compression endpoint at `POST /api/sessions/{session_id}/compress`.
It summarizes `max(4, len(messages) // 2)` messages from the front of the session, appends the result into `compressed_context`, archives the removed messages, and keeps the remainder in `messages`.

This has four major gaps:

1. Compression is manual rather than automatic.
2. Triggering is based on message count rather than real prompt token budget.
3. Repeated compressions fragment context because summaries are appended with `---`.
4. The token endpoint undercounts actual runtime context because it does not include `compressed_context` in the same way runtime prompt assembly does.

## Design Summary

Version 1 adds a post-turn automatic compression flow:

1. Let the current turn complete normally.
2. Save the user and assistant messages to the session.
3. Compute the next turn's prompt token estimate from the real runtime context shape.
4. If the estimate exceeds a configured budget, compress older history.
5. Regenerate one fresh structured summary from:
   - the previous summary, and
   - the newly compressed history slice
6. Persist compression metadata and emit a visible compression event to the frontend.

This design intentionally does not try to rescue the current turn if it is already too large. It only prepares cleaner context for the next turn.

## Non-Goals

- No pre-turn compression fallback
- No hierarchical multi-level summaries
- No selective semantic retention rules in V1
- No background asynchronous compression worker
- No silent compression hidden from the frontend

## Product Behavior

### Trigger Timing

Compression runs only after the current LLM turn has finished streaming and the conversation has been saved successfully.

The sequence is:

1. The model streams a reply.
2. The backend persists the user message and assistant message segments.
3. The backend evaluates whether the saved session now exceeds the prompt budget for a future turn.
4. If yes, compression runs immediately in the same request lifecycle.
5. The backend emits a `compression` SSE event.
6. The backend emits `done` as the final event for the request.

### Compression Visibility

Compression is visible to the frontend. The user should be able to see that compression happened and inspect the resulting structured summary.

The frontend should receive enough metadata to render:

- why compression happened
- how many messages were compressed
- token counts before and after compression
- how many recent turns were preserved
- the new summary text

## Architecture

### 1. Prompt Budget Estimator

Add a shared token estimation path that reflects the actual runtime prompt shape used by chat.

The estimator must count:

- the system prompt
- the injected `compressed_context`
- preserved conversation history
- the current message when needed for request-time estimates
- tool call payloads and retrieval metadata if they are persisted and replayed into future turns

This logic should become the canonical source for both:

- post-turn compression decisions
- `GET /api/tokens/session/{session_id}`

The current token endpoint should be corrected to align with this shared logic.

### 2. Context Compressor

Add a new component, recommended path:

- `graph/context_compressor.py`

Responsibilities:

- compute prompt token usage before and after compression
- decide whether compression is needed
- choose a compression window from old history
- call the LLM to generate a structured summary
- persist the updated summary and compression metadata

This component owns compression policy. `SessionManager` should stay focused on persistence mechanics, not budget rules.

### 3. Session Persistence Extensions

Keep `compressed_context` for compatibility, but extend the session record with metadata.

Recommended new fields:

- `compression_state`
  - `version`
  - `updated_at`
  - `trigger_reason`
  - `pre_compress_tokens`
  - `post_compress_tokens`
  - `target_budget_tokens`
  - `kept_recent_turn_count`
  - `compressed_message_count`
- `compression_events`
  - append-only list for audit and frontend history

The archive behavior for removed messages should be retained.

### 4. SSE Integration

Add a new SSE event type:

- `compression`

This event should be emitted only after successful persistence of the new compressed state.

Recommended payload fields:

- `session_id`
- `reason`
- `pre_compress_tokens`
- `post_compress_tokens`
- `target_budget_tokens`
- `compressed_message_count`
- `kept_recent_turn_count`
- `summary`
- `degraded`

`done` remains the final event in the stream.

## Compression Strategy

### Window Selection

Compression should target older history only.

Rules for V1:

- Keep the most recent `K` user-assistant turns in raw form.
- Compress a contiguous older prefix of the message history.
- Do not use a simple "first half of all messages" rule.
- Keep the most recent tool output together with its nearby assistant response if it falls within preserved recent turns.

`K` should be configured in turns rather than raw message count. The default recommendation is 2 to 4 recent turns.

### Summary Generation

The new summary must be regenerated fresh, not appended as fragments.

Inputs to summary generation:

- previous `compressed_context`
- newly compressed message slice

Required output structure:

- Current goal
- Confirmed facts
- Key decisions
- Completed work
- Open issues
- Next steps

If summary generation fails, V1 should not mutate the session history. It should record a failed compression event and leave the session untouched.

## Execution Flow

### Chat Request Path

The recommended integration point is the save path inside `api/chat.py`.

Flow:

1. `chat` request starts.
2. History loads normally.
3. Agent streams normally.
4. `persist_segments()` saves the current turn.
5. A post-turn compression check runs against the saved session.
6. If compression succeeds:
   - session state is updated
   - a `compression` event is queued for SSE output
7. The request ends with `done`.

The compression check must run only after persistence succeeds so that the session state being evaluated is complete and stable.

## Configuration

Add explicit runtime settings for compression, for example:

- `compression_enabled`
- `compression_target_budget_tokens`
- `compression_keep_recent_turns`
- `compression_summary_max_tokens` or equivalent size guard

These may live in `.env` and be surfaced through the existing settings/config layer.

V1 does not require a runtime UI toggle unless product wants one later.

## Failure Handling

Failure policy:

- If token estimation fails, skip compression and log the error.
- If summary generation fails, do not delete or rewrite session messages.
- If archive write fails, treat compression as failed and keep the original session intact.
- If SSE emission fails after persistence, the session still remains compressed; this is a visibility failure, not a data rollback case.

The design prioritizes session integrity over always compressing.

## Testing Strategy

Minimum backend coverage should include:

1. Token accounting includes `compressed_context` and matches runtime prompt assembly assumptions.
2. Post-turn compression runs only after the current turn is saved.
3. Recent `K` turns remain uncompressed.
4. Recompression regenerates a fresh structured summary instead of appending `---`.
5. Archive records are written for compressed message slices.
6. `compression` SSE events are emitted with the expected payload.
7. Summary-generation failure leaves the session unchanged.

Recommended test scopes:

- unit tests for token estimation
- unit tests for compression window planning
- unit tests for session rewrite behavior
- integration tests for chat request plus SSE event ordering

## Tradeoffs

This design is intentionally conservative.

Advantages:

- aligns with the user's preferred post-turn timing
- preserves current turn latency
- fits the existing session and SSE architecture
- improves observability and auditability

Known limitation:

- if a given turn is already too large before generation, V1 does not fix that turn; it only improves the next one

This limitation is accepted by design.

## Implementation Boundaries For V1

Implement:

- automatic post-turn compression
- structured summary regeneration
- corrected token accounting
- session metadata for compression state
- visible compression SSE event

Do not implement:

- pre-turn fallback compression
- hierarchical summary stacks
- semantic importance classifiers
- frontend redesign beyond rendering the new event

## Acceptance Criteria

The design is considered implemented correctly when:

1. A long conversation can exceed the configured budget and automatically compress after the turn completes.
2. The next turn loads a fresh structured summary plus preserved recent raw turns.
3. Token reporting reflects the compressed summary in a way that matches runtime context more closely than the current endpoint.
4. The frontend can show that compression happened and display the resulting summary.
5. Compression failures never corrupt or partially rewrite the session.
