import { Module } from '@nestjs/common';
import { MastersService } from './masters.service';
import { MastersController } from './masters.controller';

/** 마스터 조회 모듈 (E1.x) — 폼 룩업(포교원장/불사목록/슬롯규칙/육십갑자). */
@Module({
  controllers: [MastersController],
  providers: [MastersService],
  exports: [MastersService],
})
export class MastersModule {}
