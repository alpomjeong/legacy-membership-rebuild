import {
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** 계정 생성 — 관리자 발급(FR-AUTH-13). 임시 비밀번호 자동발급·최초 변경 강제. */
export class CreateAccountDto {
  @IsString()
  @Length(3, 60)
  loginId!: string;

  @IsOptional()
  @IsNumberString()
  staffId?: string;

  @IsArray()
  @IsNumberString({}, { each: true })
  roleIds!: string[];
}

/** 계정 수정 — 활성여부·역할 재할당. */
export class UpdateAccountDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumberString({}, { each: true })
  roleIds?: string[];
}
