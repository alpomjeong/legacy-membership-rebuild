import { IsDefined } from 'class-validator';

/** 설정 저장 본문 — value 는 임의 JSON(캔버스 스토어 등). */
export class SetUserSettingDto {
  @IsDefined()
  value!: unknown;
}
