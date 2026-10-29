import { Module } from '@nestjs/common';
import { LegacyMigrationController } from './legacy-migration.controller';
import { LegacyMigrationService } from './legacy-migration.service';

/**
 * LegacyMigrationModule — 최초 세팅 시 레거시 MSSQL → PostgreSQL 즉시 이관.
 * 검증된 apps/migration/*.cjs 를 컨테이너에서 구동한다.
 */
@Module({
  controllers: [LegacyMigrationController],
  providers: [LegacyMigrationService],
})
export class LegacyMigrationModule {}
