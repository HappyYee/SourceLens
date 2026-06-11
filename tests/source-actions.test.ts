import test from "node:test";
import assert from "node:assert/strict";
import { sourceActionFlags } from "../src/lib/source-actions.ts";

test("sourceActionFlags：8 平台按钮能力矩阵", () => {
  assert.deepEqual(sourceActionFlags("youtube"), {
    canRefreshLatest: true,
    canBackfill: true,
    allowBackfillAll: true,
    canSyncTags: true,
  });
  assert.deepEqual(sourceActionFlags("bilibili"), {
    canRefreshLatest: true,
    canBackfill: true,
    allowBackfillAll: true,
    canSyncTags: false,
  });
  assert.deepEqual(sourceActionFlags("x"), {
    canRefreshLatest: true,
    canBackfill: true,
    allowBackfillAll: false,
    canSyncTags: false,
  });
  for (const platform of ["rss", "podcast", "github", "arxiv"]) {
    assert.deepEqual(sourceActionFlags(platform), {
      canRefreshLatest: true,
      canBackfill: false,
      allowBackfillAll: false,
      canSyncTags: false,
    });
  }
  assert.deepEqual(sourceActionFlags("manual"), {
    canRefreshLatest: false,
    canBackfill: false,
    allowBackfillAll: false,
    canSyncTags: false,
  });
});
