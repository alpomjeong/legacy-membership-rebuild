import { Module } from '@nestjs/common';
import { CommonCodeService } from './common-code.service';
import { CommonCodeController } from './common-code.controller';

/** 공통코드 마스터 모듈 (E0.6). PrismaModule 전역으로 PrismaService 주입. */
@Module({
  controllers: [CommonCodeController],
  providers: [CommonCodeService],
  exports: [CommonCodeService],
})
export class CommonCodeModule {}
