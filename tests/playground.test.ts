import test from "node:test";
import assert from "node:assert/strict";
// The exact browser-worker kernel is exercised in Node; no server-side simulated result.
import { inputs, multiply, verify } from "../public/lab/compute.mjs";
test("matrix worker calculates known products and rejects corrupted output", () => {
  assert.deepEqual(
    Array.from(
      multiply(
        new Float32Array([1, 2, 3, 4]),
        new Float32Array([5, 6, 7, 8]),
        2,
      ),
    ),
    [19, 22, 43, 50],
  );
  const { a, b } = inputs(64);
  const output = multiply(a, b, 64);
  assert.ok(verify(a, b, output, 64) < 0.001);
  output[0] = NaN;
  assert.throws(() => verify(a, b, output, 64));
  assert.throws(() => inputs(99999));
});
