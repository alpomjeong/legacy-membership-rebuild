import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

/** 사원 생성/수정 — DM-08. 한글명 필수. 주민번호는 암호화 저장(평문 금지). */
export class StaffDto {
  @IsString()
  @Length(1, 100)
  staffNameKo!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  staffNameEn?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  positionCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  dutyCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  jobGroupCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  staffDivCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  appellationDivCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  solarLunarCode?: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  authLevelCode?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @IsOptional()
  @IsDateString()
  retireDate?: string;

  @IsOptional()
  @IsBoolean()
  smsReceiveYn?: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  photoUrl?: string;

  @IsOptional()
  @Matches(/^\d{6}-?\d{7}$/, {
    message: '주민번호 형식이 올바르지 않습니다(13자리)',
  })
  jumin?: string;

  @IsOptional()
  @IsBoolean()
  isWorking?: boolean;
}
