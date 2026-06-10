-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bindingId" TEXT,
    "roomId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "aiTitle" TEXT,
    "customTitle" TEXT,
    "titleSource" TEXT,
    "excerpt" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "durationSec" INTEGER,
    "author" TEXT,
    "publishedAt" DATETIME NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" TEXT,
    CONSTRAINT "Item_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "SourceBinding" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Item_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Item" ("aiTitle", "author", "bindingId", "customTitle", "durationSec", "excerpt", "externalId", "fetchedAt", "id", "platform", "publishedAt", "raw", "roomId", "thumbnailUrl", "title", "titleSource", "url") SELECT "aiTitle", "author", "bindingId", "customTitle", "durationSec", "excerpt", "externalId", "fetchedAt", "id", "platform", "publishedAt", "raw", "roomId", "thumbnailUrl", "title", "titleSource", "url" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE INDEX "Item_roomId_publishedAt_idx" ON "Item"("roomId", "publishedAt");
CREATE UNIQUE INDEX "Item_roomId_externalId_key" ON "Item"("roomId", "externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
