import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/** 회원 생성 DTO (FR-MEM-04/05). 이름 필수, 그 외 선택. 소속/포교원장 존재는 서비스에서 검증. */
export class CreateMemberDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  memberName!: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  affiliationCode?: string;

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
  @IsString()
  @Length(1, 20)
  zipCode?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'missionaryId 는 숫자 문자열이어야 합니다' })
  missionaryId?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
