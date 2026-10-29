import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

/** 불사 신청 목록 쿼리 — 회원/불사목록/봉안일 필터 + 페이지네이션. */
export class QueryBuddhistServicesDto {
  @IsOptional()
  @IsNumberString()
  memberId?: string;

  @IsOptional()
  @IsNumberString()
  buddhistServiceItemId?: string;

  @IsOptional()
  @IsNumberString()
  enshrinementEventId?: string;

  /** 'true' 면 취소건도 포함(기본은 포함하되 플래그로 제외 가능). */
  @IsOptional()
  @IsBooleanString()
  includeCanceled?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100000)
  pageSize = 20;

  @IsOptional()
  @IsIn(['registrationDate', 'createdAt'])
  sort: 'registrationDate' | 'createdAt' = 'registrationDate';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
