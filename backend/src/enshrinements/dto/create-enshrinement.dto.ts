import {
  IsISO8601,
  IsNumberString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/** 봉안일 생성 DTO (FR-FUN-01). 양력 일시만(음력/간지/반복은 Phase 2). */
export class CreateEnshrinementDto {
  @IsISO8601()
  eventDateSolar!: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  label?: string;

  @IsOptional()
  @IsString()
  remark?: string;

  @IsOptional()
  @IsNumberString()
  defaultBuddhistServiceItemId?: string;
}
