import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

/** 업로드 모듈 — StorageService 는 전역(StorageModule). */
@Module({ controllers: [UploadsController] })
export class UploadsModule {}
