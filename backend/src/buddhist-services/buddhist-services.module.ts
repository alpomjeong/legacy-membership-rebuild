import { Module } from '@nestjs/common';
import { BuddhistServicesService } from './buddhist-services.service';
import { BuddhistServicesController } from './buddhist-services.controller';

/** 불사 신청 모듈 (E1.2). PrismaModule 전역으로 PrismaService 주입. */
@Module({
  controllers: [BuddhistServicesController],
  providers: [BuddhistServicesService],
  exports: [BuddhistServicesService],
})
export class BuddhistServicesModule {}
