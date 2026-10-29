-- CreateTable
CREATE TABLE "buddhist_service_item" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "reference_amount" DECIMAL(18,2),
    "service_type_code" VARCHAR(20),
    "photo_url" VARCHAR(500),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "buddhist_service_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_type_slot_rule" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "service_type_code" VARCHAR(20) NOT NULL,
    "slot_key" VARCHAR(20) NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "label_override" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "search_indexed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "service_type_slot_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sexagenary_year" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "code" INTEGER NOT NULL,
    "ganji_name_ko" VARCHAR(40) NOT NULL,
    "ganji_name_hanja" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sexagenary_year_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enshrinement_event" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "event_date_solar" TIMESTAMPTZ(6) NOT NULL,
    "event_date_lunar" DATE,
    "is_lunar_leap_month" BOOLEAN NOT NULL DEFAULT false,
    "sexagenary_year_id" BIGINT,
    "recurrence_type" VARCHAR(20),
    "recurrence_rule" VARCHAR(200),
    "default_buddhist_service_item_id" BIGINT,
    "label" VARCHAR(200),
    "remark" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "enshrinement_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buddhist_service_reg" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "registration_date" DATE NOT NULL,
    "staff_id" BIGINT,
    "enshrinement_event_id" BIGINT,
    "member_id" BIGINT NOT NULL,
    "buddhist_service_item_id" BIGINT NOT NULL,
    "altar_number" TEXT,
    "bogwija" VARCHAR(200),
    "relationship" VARCHAR(100),
    "bokjunja" TEXT,
    "spiritual" TEXT,
    "yesujae" TEXT,
    "seongju12" VARCHAR(100),
    "sexagenary_year_id" BIGINT,
    "donation_amount" DECIMAL(18,2),
    "memo" TEXT,
    "is_canceled" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMPTZ(6),
    "canceled_by" BIGINT,
    "is_certificate_issued" BOOLEAN NOT NULL DEFAULT false,
    "certificate_issued_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "buddhist_service_reg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buddhist_service_item_tenant_id_idx" ON "buddhist_service_item"("tenant_id");

-- CreateIndex
CREATE INDEX "buddhist_service_item_tenant_id_service_type_code_idx" ON "buddhist_service_item"("tenant_id", "service_type_code");

-- CreateIndex
CREATE UNIQUE INDEX "service_type_slot_rule_tenant_id_service_type_code_slot_key_key" ON "service_type_slot_rule"("tenant_id", "service_type_code", "slot_key");

-- CreateIndex
CREATE UNIQUE INDEX "sexagenary_year_tenant_id_code_key" ON "sexagenary_year"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "enshrinement_event_tenant_id_event_date_solar_idx" ON "enshrinement_event"("tenant_id", "event_date_solar");

-- CreateIndex
CREATE INDEX "buddhist_service_reg_tenant_id_member_id_idx" ON "buddhist_service_reg"("tenant_id", "member_id");

-- CreateIndex
CREATE INDEX "buddhist_service_reg_tenant_id_enshrinement_event_id_idx" ON "buddhist_service_reg"("tenant_id", "enshrinement_event_id");

-- CreateIndex
CREATE INDEX "buddhist_service_reg_tenant_id_buddhist_service_item_id_idx" ON "buddhist_service_reg"("tenant_id", "buddhist_service_item_id");

-- AddForeignKey
ALTER TABLE "enshrinement_event" ADD CONSTRAINT "enshrinement_event_sexagenary_year_id_fkey" FOREIGN KEY ("sexagenary_year_id") REFERENCES "sexagenary_year"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enshrinement_event" ADD CONSTRAINT "enshrinement_event_default_buddhist_service_item_id_fkey" FOREIGN KEY ("default_buddhist_service_item_id") REFERENCES "buddhist_service_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddhist_service_reg" ADD CONSTRAINT "buddhist_service_reg_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddhist_service_reg" ADD CONSTRAINT "buddhist_service_reg_buddhist_service_item_id_fkey" FOREIGN KEY ("buddhist_service_item_id") REFERENCES "buddhist_service_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddhist_service_reg" ADD CONSTRAINT "buddhist_service_reg_enshrinement_event_id_fkey" FOREIGN KEY ("enshrinement_event_id") REFERENCES "enshrinement_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddhist_service_reg" ADD CONSTRAINT "buddhist_service_reg_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buddhist_service_reg" ADD CONSTRAINT "buddhist_service_reg_sexagenary_year_id_fkey" FOREIGN KEY ("sexagenary_year_id") REFERENCES "sexagenary_year"("id") ON DELETE SET NULL ON UPDATE CASCADE;
