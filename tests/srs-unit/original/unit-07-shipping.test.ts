
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateShippingFee } from "../../../business/pricing.js";

type WeightTier = "light" | "medium" | "heavy";
type Zone = "inCity" | "upcountry" | "remote";
type Speed = "standard" | "express";
type MemberTier = "normal" | "prime";

// Expected base rates จาก SRS FR-4.6
const baseRates: Record<WeightTier, Record<Zone, number>> = {
  light: {
    inCity: 30,
    upcountry: 50,
    remote: 80,
  },
  medium: {
    inCity: 50,
    upcountry: 80,
    remote: 120,
  },
  heavy: {
    inCity: 80,
    upcountry: 120,
    remote: 180,
  },
};

const weightTiers: WeightTier[] = [
  "light",
  "medium",
  "heavy",
];

const zones: Zone[] = [
  "inCity",
  "upcountry",
  "remote",
];

const speeds: Speed[] = [
  "standard",
  "express",
];

const memberTiers: MemberTier[] = [
  "normal",
  "prime",
];

// ค่าคาดหวังคำนวณตาม FR-4.7 โดยไม่เรียกฟังก์ชันที่กำลังทดสอบ
function expectedShipping(
  base: number,
  speed: Speed,
  member: MemberTier,
): number {
  if (member === "prime" && speed === "standard") {
    return 0;
  }

  if (member === "prime" && speed === "express") {
    return Math.floor(base / 2);
  }

  if (speed === "express") {
    return Math.floor(base * 3 / 2);
  }

  return base;
}

// Full combination: 3 × 3 × 2 × 2 = 36 cases
let testNumber = 74;

for (const weightTier of weightTiers) {
  for (const zone of zones) {
    for (const speed of speeds) {
      for (const memberTier of memberTiers) {
        const id = `UT-${String(testNumber).padStart(3, "0")}`;
        testNumber++;

        test(
          `${id}: ${weightTier}, ${zone}, ${speed}, ${memberTier}`,
          () => {
            const base = baseRates[weightTier][zone];

            const expected = expectedShipping(
              base,
              speed,
              memberTier,
            );

            const actual = calculateShippingFee(
              weightTier,
              zone,
              speed,
              memberTier,
            );

            assert.equal(actual, expected);
          },
        );
      }
    }
  }
}
