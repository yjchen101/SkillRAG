import assert from "node:assert/strict";
import test from "node:test";

import { getStarterPrompts } from "../src/lib/starterPrompts.ts";

test("getStarterPrompts exposes several actionable prompts", () => {
  const prompts = getStarterPrompts();

  assert.ok(prompts.length >= 3);
  for (const prompt of prompts) {
    assert.ok(prompt.id.trim());
    assert.ok(prompt.title.trim());
    assert.ok(prompt.prompt.trim().length > prompt.title.trim().length);
  }
});

test("getStarterPrompts includes system, knowledge, and session-oriented prompts", () => {
  assert.deepEqual(
    getStarterPrompts().map((prompt) => prompt.id),
    ["explain-system", "inspect-knowledge", "summarize-session"]
  );
});
