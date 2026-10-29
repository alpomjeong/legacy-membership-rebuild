import {
  IsBoolean,
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/**
 * 불사 신청 생성 DTO (FR-BUD-01~14). 입력일(registrationDate)은 서버 KST 자동이므로 제외.
 * id 류는 JSON BigInt 호환 위해 숫자 문자열로 받고 서비스에서 BigInt 변환.
 */
export class CreateBuddhistServiceDto {
  @IsOptional()
  @IsISO8601()
  registrationDate?: string;

  @IsNumberString()
  memberId!: string;

  @IsNumberString()
  buddhistServiceItemId!: string;

  @IsOptional()
  @IsNumberString()
  enshrinementEventId?: string;

  /** 봉안일 날짜(YYYY-MM-DD 또는 ISO) — 지정 시 그 날짜의 봉안일 이벤트를 찾거나 생성해 연결. */
  @IsOptional()
  @IsISO8601()
  enshrinementDate?: string;

  @IsOptional()
  @IsNumberString()
  staffId?: string;

  @IsOptional()
  @IsNumberString()
  sexagenaryYearId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  altarNumber?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  bogwija?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  relationship?: string;

  @IsOptional()
  @IsString()
  bokjunja?: string;

  @IsOptional()
  @IsString()
  spiritual?: string;

  @IsOptional()
  @IsString()
  yesujae?: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  seongju12?: string;

  @IsOptional()
  @IsNumberString()
  donationAmount?: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsBoolean()
  isCanceled?: boolean;

  @IsOptional()
  @IsBoolean()
  isCertificateIssued?: boolean;

  @IsOptional()
  @IsISO8601()
  certificateIssuedDate?: string;
}
