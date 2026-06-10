-- CreateTable
CREATE TABLE "AuthProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profileDir" TEXT NOT NULL,
    "proxyMode" TEXT NOT NULL DEFAULT 'none',
    "proxyUrl" TEXT,
    "refreshRegion" TEXT NOT NULL DEFAULT 'auto',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastResult" TEXT,
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
