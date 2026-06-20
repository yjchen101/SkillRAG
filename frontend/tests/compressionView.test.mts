import assert from "node:assert/strict";
import test from "node:test";

import { getCompressionSavingsLabel } from "../src/lib/compressionView.ts";

test("getCompressionSavingsLabel reports saved token percentage", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 1000,
      postCompressTokens: 250
    }),
    "节省 75%"
  );
});

test("getCompressionSavingsLabel does not show negative savings", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 1000,
      postCompressTokens: 1200
    }),
    "节省 0%"
  );
});

test("getCompressionSavingsLabel handles missing token baselines", () => {
  assert.equal(
    getCompressionSavingsLabel({
      preCompressTokens: 0,
      postCompressTokens: 0
    }),
    "节省 --"
  );
});
