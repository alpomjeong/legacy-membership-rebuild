import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { PasswordService } from '../auth/password.service';

/** 계정 관리 모듈 (FR-AUTH-13). */
@Module({
  controllers: [AccountsController],
  providers: [AccountsService, PasswordService],
})
export class AccountsModule {}
