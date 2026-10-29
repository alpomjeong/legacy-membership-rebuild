-- CreateTable
CREATE TABLE "counsel" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "member_id" BIGINT NOT NULL,
    "counseled_at" TIMESTAMPTZ(6) NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "counsel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counsel_tenant_id_member_id_idx" ON "counsel"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "counsel_tenant_id_counseled_at_idx" ON "counsel"("tenant_id", "counseled_at");

-- AddForeignKey
ALTER TABLE "counsel" ADD CONSTRAINT "counsel_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
