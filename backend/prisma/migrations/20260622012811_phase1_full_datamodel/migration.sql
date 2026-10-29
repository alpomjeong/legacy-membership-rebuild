-- AlterTable
ALTER TABLE "missionary" ADD COLUMN     "address" VARCHAR(200),
ADD COLUMN     "phone" VARCHAR(30);

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "appellation_div_code" VARCHAR(20),
ADD COLUMN     "birth_date" DATE,
ADD COLUMN     "duty_code" VARCHAR(20),
ADD COLUMN     "job_group_code" VARCHAR(20),
ADD COLUMN     "join_date" DATE,
ADD COLUMN     "photo_url" VARCHAR(500),
ADD COLUMN     "position_code" VARCHAR(20),
ADD COLUMN     "retire_date" DATE,
ADD COLUMN     "sms_receive_yn" BOOLEAN,
ADD COLUMN     "solar_lunar_code" VARCHAR(20),
ADD COLUMN     "staff_div_code" VARCHAR(20);

-- AlterTable
ALTER TABLE "user_account" ADD COLUMN     "password_salt" TEXT;

-- CreateTable
CREATE TABLE "sexagenary_year_mapping" (
    "id" BIGSERIAL NOT NULL,
    "sexagenary_year_id" BIGINT NOT NULL,
    "gregorian_year" INTEGER NOT NULL,

    CONSTRAINT "sexagenary_year_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deceased" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "clan_name" VARCHAR(100),
    "relation_to_member" VARCHAR(100),
    "member_id" BIGINT,
    "sexagenary_year_id" BIGINT,
    "memorial_event_id" BIGINT,
    "altar_number" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT,
    "updated_at" TIMESTAMPTZ(6),
    "updated_by" BIGINT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "deceased_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" BIGINT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "parent_id" BIGINT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_permission" (
    "id" BIGSERIAL NOT NULL,
    "menu_id" BIGINT NOT NULL,
    "permission_id" BIGINT NOT NULL,

    CONSTRAINT "menu_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sexagenary_year_mapping_sexagenary_year_id_gregorian_year_key" ON "sexagenary_year_mapping"("sexagenary_year_id", "gregorian_year");

-- CreateIndex
CREATE INDEX "deceased_tenant_id_name_idx" ON "deceased"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "menu_tenant_id_code_key" ON "menu"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "menu_permission_menu_id_permission_id_key" ON "menu_permission"("menu_id", "permission_id");

-- AddForeignKey
ALTER TABLE "sexagenary_year_mapping" ADD CONSTRAINT "sexagenary_year_mapping_sexagenary_year_id_fkey" FOREIGN KEY ("sexagenary_year_id") REFERENCES "sexagenary_year"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deceased" ADD CONSTRAINT "deceased_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deceased" ADD CONSTRAINT "deceased_sexagenary_year_id_fkey" FOREIGN KEY ("sexagenary_year_id") REFERENCES "sexagenary_year"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deceased" ADD CONSTRAINT "deceased_memorial_event_id_fkey" FOREIGN KEY ("memorial_event_id") REFERENCES "enshrinement_event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu" ADD CONSTRAINT "menu_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_permission" ADD CONSTRAINT "menu_permission_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_permission" ADD CONSTRAINT "menu_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
