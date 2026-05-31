# Knowledge Capture Design

## Goal

Add a manual "capture as knowledge" action for assistant messages so valuable answers can be written back into the local `knowledge/` directory as auditable Markdown files.

## Scope

The first version captures a complete assistant message. It does not capture arbitrary text selections, auto-save every answer, or run an LLM summarization pass.

## User Flow

1. The user sees a `沉淀为知识` action on completed assistant messages.
2. Clicking the action sends the current session ID and the message index to the backend.
3. The backend validates that the target message is an assistant message with non-empty content.
4. The backend writes a Markdown file under `knowledge/chat-captures/`.
5. The frontend opens the created file in the inspector so the user can review or edit it.
6. The user can use the existing `重建索引` button when they want the new file included in retrieval.

## Architecture

The backend owns capture formatting and file naming through a new `api.knowledge_capture` module. The frontend adds a store action and a small message-level button. Existing session persistence, file editing, and knowledge index rebuild flows remain unchanged.

## Markdown Format

Each captured file contains:

- YAML-like frontmatter with title, source type, session ID, message index, capture timestamp, and evidence count.
- Source section with session title and audit metadata.
- Answer section with the original assistant content.
- Retrieval evidence section with source path, locator, channel, score, and snippets.
- Tool calls section when the message has tool-call metadata.

## Error Handling

The API returns a 400 response for invalid message indexes, user messages, or empty assistant answers. The frontend shows a temporary inline status on the clicked message.

## Testing

Backend unit tests cover Markdown generation, file creation, source metadata, retrieval evidence inclusion, and invalid message rejection. Frontend verification is covered by TypeScript build checks.
