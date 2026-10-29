import { Module } from '@nestjs/common';
import { CounselsService } from './counsels.service';
import { CounselsController } from './counsels.controller';

/** 상담 모듈 (E1.7). */
@Module({
  controllers: [CounselsController],
  providers: [CounselsService],
  exports: [CounselsService],
})
export class CounselsModule {}
