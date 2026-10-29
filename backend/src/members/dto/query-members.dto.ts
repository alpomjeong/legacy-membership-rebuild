import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const toArray = (v: string | string[] | undefined): string[] | undefined =>
  v === undefined ? undefined : Array.isArray(v) ? v : [v];

/** 회원 목록 쿼리 — 키워드·다중필터·페이지네이션. 캐럿(^code^) 매직 폐기. */
export class QueryMembersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsString({ each: true })
  affiliationCodes?: string[];

  @IsOptional()
  @Transform(({ value }) => toArray(value))
  @IsString({ each: true })
  missionaryIds?: string[];

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
  @IsIn(['memberName', 'createdAt'])
  sort: 'memberName' | 'createdAt' = 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}
