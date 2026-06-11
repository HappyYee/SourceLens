import test from "node:test";
import assert from "node:assert/strict";
import {
  formatBackfillResult,
  formatRefreshLatestResult,
  formatSyncTagsResult,
} from "../src/lib/format-result.ts";

test("formatRefreshLatestResult：成功/失败文案保持 SourceItem 原样", () => {
  assert.equal(
    formatRefreshLatestResult(true, { networkLabel: "国外刷新", added: 2, updated: 3 }),
    "国外刷新 · 最新：+2 新 · 3 更",
  );
  assert.equal(formatRefreshLatestResult(true, {}), "最新：+0 新 · 0 更");
  assert.equal(
    formatRefreshLatestResult(false, {
      networkLabel: "国外刷新",
      error: "fetch failed",
      hint: "检查代理",
    }),
    "国外刷新 · fetch failed。检查代理",
  );
  assert.equal(formatRefreshLatestResult(false, {}), "刷新失败");
});

test("formatBackfillResult：成功条件段顺序与失败文案保持 SourceItem 原样", () => {
  assert.equal(
    formatBackfillResult(true, {
      networkLabel: "国外刷新",
      createdCount: 4,
      updatedCount: 5,
      fetchedCount: 30,
      shortsCount: 2,
      skippedCount: 1,
      playlistTaggedCount: 7,
      hasMore: true,
    }),
    "国外刷新 · 回溯：+4 新 · 5 更 · 已扫描 30 · Shorts 2 · 跳过 1 · 打标 7 · 还有更多",
  );
  assert.equal(
    formatBackfillResult(true, { createdCount: 0, updatedCount: 3, fetchedCount: 50 }),
    "回溯：+0 新 · 3 更 · 已扫描 50",
  );
  assert.equal(
    formatBackfillResult(false, {
      networkLabel: "国内刷新",
      error: "B 站风控",
      hint: "稍后重试",
    }),
    "国内刷新 · B 站风控。稍后重试",
  );
  assert.equal(formatBackfillResult(false, {}), "回溯失败");
});

test("formatSyncTagsResult：成功/失败文案保持 SourceItem 原样", () => {
  assert.equal(
    formatSyncTagsResult(true, {
      networkLabel: "国外刷新",
      playlistCount: 12,
      taggedCount: 49,
    }),
    "国外刷新 · 播放列表：12 个 · 打标 49 条",
  );
  assert.equal(
    formatSyncTagsResult(false, {
      error: "同步坏了",
      hint: "检查 API key",
    }),
    "同步坏了。检查 API key",
  );
  assert.equal(formatSyncTagsResult(false, {}), "同步失败");
});
