// 可用性分拣（Phase 3b）：found 自愈 / missing 保留首见时间 / 未评估跳过。
import test from "node:test";
import assert from "node:assert/strict";
import { buildAvailabilityUpdates } from "../src/lib/availability.ts";

const now = new Date("2026-06-12T00:00:00.000Z");
const earlier = new Date("2026-06-01T00:00:00.000Z");

test("buildAvailabilityUpdates：found → available + missingSince 清空（自愈）", () => {
  const out = buildAvailabilityUpdates(
    [{ id: "i1", externalId: "a", missingSince: earlier }],
    new Set(["a"]),
    new Set(),
    now,
  );
  assert.deepEqual(out, [
    { id: "i1", availability: "available", lastCheckedAt: now, missingSince: null },
  ]);
});

test("buildAvailabilityUpdates：missing 首见记 now，已有首见时间不覆盖", () => {
  const out = buildAvailabilityUpdates(
    [
      { id: "i1", externalId: "a", missingSince: null },
      { id: "i2", externalId: "b", missingSince: earlier },
    ],
    new Set(),
    new Set(["a", "b"]),
    now,
  );
  assert.equal(out[0].missingSince, now);
  assert.equal(out[1].missingSince, earlier); // 只记一次
  assert.ok(out.every((u) => u.availability === "unavailable" && u.lastCheckedAt === now));
});

test("buildAvailabilityUpdates：两边都不在 → 未评估，跳过（绝不默认 unavailable）", () => {
  const out = buildAvailabilityUpdates(
    [{ id: "i1", externalId: "a", missingSince: null }],
    new Set(["x"]),
    new Set(["y"]),
    now,
  );
  assert.deepEqual(out, []);
});
