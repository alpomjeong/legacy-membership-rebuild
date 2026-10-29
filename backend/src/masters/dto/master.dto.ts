import {
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** 포교원장 생성/수정 — DM-07. 이름 필수. */
export class MissionaryDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  address?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  addressDetail?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** 불사목록 생성/수정 — DM-06. 이름 필수, 서비스 타입(슬롯 규칙 구동) 선택. */
export class ServiceItemDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  serviceTypeCode?: string;

  @IsOptional()
  @IsNumberString()
  referenceAmount?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  photoUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
