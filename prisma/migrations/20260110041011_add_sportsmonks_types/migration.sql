-- CreateTable
CREATE TABLE "sportsmonks_types" (
    "id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "developer_name" TEXT NOT NULL,
    "model_type" TEXT NOT NULL,
    "group" TEXT,
    "stat_group" TEXT,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sportsmonks_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sportsmonks_types_model_type_idx" ON "sportsmonks_types"("model_type");

-- CreateIndex
CREATE INDEX "sportsmonks_types_code_idx" ON "sportsmonks_types"("code");

-- CreateIndex
CREATE INDEX "sportsmonks_types_developer_name_idx" ON "sportsmonks_types"("developer_name");

-- AddForeignKey
ALTER TABLE "sportsmonks_types" ADD CONSTRAINT "sportsmonks_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sportsmonks_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
