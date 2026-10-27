
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyWeight } from "../../../backend/api/business/pricing.js";

const weightTierCases = [
  { id: "UT-060", weight: 1, expected: "light" },
  { id: "UT-061", weight: 500, expected: "light" },
  { id: "UT-062", weight: 999, expected: "light" },
  { id: "UT-063", weight: 1000, expected: "light" },

  { id: "UT-064", weight: 1001, expected: "medium" },
  { id: "UT-065", weight: 3000, expected: "medium" },
  { id: "UT-066", weight: 4999, expected: "medium" },
  { id: "UT-067", weight: 5000, expected: "medium" },

  { id: "UT-068", weight: 5001, expected: "heavy" },
  { id: "UT-069", weight: 10000, expected: "heavy" },
  { id: "UT-070", weight: 19999, expected: "heavy" },
  { id: "UT-071", weight: 20000, expected: "heavy" },

  { id: "UT-072", weight: 20001, expected: "overLimit" },
  { id: "UT-073", weight: 24000, expected: "overLimit" },
] as const;

for (const tc of weightTierCases) {
  test(`${tc.id}: weight ${tc.weight} grams => ${tc.expected}`, () => {
    const actual = classifyWeight(tc.weight);
    assert.equal(actual, tc.expected);
  });
}
