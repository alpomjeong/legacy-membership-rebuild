import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** 로그인 요청 DTO — class-validator 로 서버측 입력 검증(FR-AUTH-01, NFR-API). */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  loginId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;

  /** true(웹): refresh 토큰을 HttpOnly 쿠키로 받고 응답 바디엔 넣지 않음. 네이티브는 미지정. */
  @IsOptional()
  @IsBoolean()
  cookieMode?: boolean;
}
