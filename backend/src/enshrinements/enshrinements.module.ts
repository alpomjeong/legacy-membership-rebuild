import { Module } from '@nestjs/common';
import { EnshrinementsService } from './enshrinements.service';
import { EnshrinementsController } from './enshrinements.controller';

/** 봉안일 모듈 (E1.6). */
@Module({
  controllers: [EnshrinementsController],
  providers: [EnshrinementsService],
  exports: [EnshrinementsService],
})
export class EnshrinementsModule {}
