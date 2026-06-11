-- AlterTable
ALTER TABLE "AuthProfile" ADD COLUMN "isDefault" BOOLEAN;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN "availability" TEXT;
ALTER TABLE "Item" ADD COLUMN "lastCheckedAt" DATETIME;
ALTER TABLE "Item" ADD COLUMN "lastSeenAt" DATETIME;
ALTER TABLE "Item" ADD COLUMN "metadataStatus" TEXT;
ALTER TABLE "Item" ADD COLUMN "missingSince" DATETIME;

-- AlterTable
ALTER TABLE "SourceBinding" ADD COLUMN "authProfileId" TEXT;

-- 回填：youtubeKind → videoKind 归并（仅 youtube 平台、仅 videoKind 为空的行）。
-- youtubeKind 列保留为 deprecated（双写 + 读回退），物理删除留给将来的表重建窗口。
UPDATE "Item" SET "videoKind" = "youtubeKind"
WHERE "platform" = 'youtube' AND "youtubeKind" IS NOT NULL AND "videoKind" IS NULL;
