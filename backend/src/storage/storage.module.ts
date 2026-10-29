import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** 스토리지 모듈 (전역) — 어디서나 StorageService 주입(NFR-FILE-01). */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
