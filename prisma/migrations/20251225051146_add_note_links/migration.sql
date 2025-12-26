/*
  Warnings:

  - You are about to drop the column `contextId` on the `Note` table. All the data in the column will be lost.
  - You are about to drop the column `contextType` on the `Note` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Note" DROP COLUMN "contextId",
DROP COLUMN "contextType";

-- CreateTable
CREATE TABLE "NoteLink" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NoteLink_noteId_contextType_contextId_key" ON "NoteLink"("noteId", "contextType", "contextId");

-- AddForeignKey
ALTER TABLE "NoteLink" ADD CONSTRAINT "NoteLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
