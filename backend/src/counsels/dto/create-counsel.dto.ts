import {
  IsISO8601,
  IsNotEmpty,
  IsNumberString,
  IsString,
} from 'class-validator';

/** 상담 생성 DTO (FR-CNS-01). 회원·상담일시·내용 필수. 상담일시는 ISO8601(KST 입력→UTC 저장). */
export class CreateCounselDto {
  @IsNumberString()
  memberId!: string;

  @IsISO8601()
  counseledAt!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
