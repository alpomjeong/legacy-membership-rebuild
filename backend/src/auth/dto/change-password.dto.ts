import { IsString, MinLength } from 'class-validator';

/** 본인 비밀번호 변경 DTO — 최초 로그인 강제 변경 포함. */
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: '새 비밀번호는 8자 이상이어야 합니다.' })
  newPassword!: string;
}
