import test from "node:test";
import assert from "node:assert/strict";

import {
  divideDecimal,
  multiplyDecimal,
  roundDecimal,
  subtractDecimal,
  sumDecimal,
} from "../src/shared/math/decimal-money.js";

test("sumDecimal avoids binary floating point drift", () => {
  assert.equal(sumDecimal([0.1, 0.2, 0.3]), 0.6);
});

test("multiplyDecimal and divideDecimal preserve expected pricing precision", () => {
  assert.equal(multiplyDecimal(0.1, 0.2, 6), 0.02);
  assert.equal(divideDecimal(1, 3, 6), 0.333333);
});

test("roundDecimal and subtractDecimal keep money scale stable", () => {
  assert.equal(roundDecimal(10.005, 2), 10.01);
  assert.equal(subtractDecimal(1.0, 0.42, 2), 0.58);
});
