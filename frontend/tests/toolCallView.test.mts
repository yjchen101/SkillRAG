import assert from "node:assert/strict";
import test from "node:test";

import { summarizeToolCalls } from "../src/lib/toolCallView.ts";

test("summarizeToolCalls counts finished and running calls", () => {
  assert.deepEqual(
    summarizeToolCalls([
      { tool: "read_file", input: "{}", output: "done" },
      { tool: "terminal", input: "{}", output: "" },
      { tool: "read_file", input: "{}", output: "done again" }
    ]),
    {
      totalCalls: 3,
      finishedCalls: 2,
      runningCalls: 1,
      toolNames: ["read_file", "terminal"]
    }
  );
});
