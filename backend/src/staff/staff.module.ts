import { Module } from '@nestjs/common';
import { StaffService } from './staff.service';
import { StaffController } from './staff.controller';
import { CryptoService } from '../common/crypto.service';

/** 사원 모듈 (DM-08). 주민번호 암호화는 CryptoService. */
@Module({
  controllers: [StaffController],
  providers: [StaffService, CryptoService],
  exports: [StaffService],
})
export class StaffModule {}
