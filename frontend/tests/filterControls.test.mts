import assert from "node:assert/strict";
import test from "node:test";

import { hasActiveFilter } from "../src/lib/filterControls.ts";

test("hasActiveFilter ignores empty and whitespace filters", () => {
  assert.equal(hasActiveFilter(""), false);
  assert.equal(hasActiveFilter("   \n"), false);
});

test("hasActiveFilter accepts visible filter text", () => {
  assert.equal(hasActiveFilter("session"), true);
  assert.equal(hasActiveFilter("  memory  "), true);
});
