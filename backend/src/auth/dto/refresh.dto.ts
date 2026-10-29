import { IsOptional, IsString } from 'class-validator';

/** refresh 토큰 재발급 DTO. 웹은 쿠키에서 읽으므로 바디는 선택(네이티브만 사용). */
export class RefreshDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
