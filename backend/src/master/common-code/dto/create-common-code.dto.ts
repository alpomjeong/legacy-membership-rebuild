import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/** 공통코드 생성 DTO (FR-MST-01/03). 4자 고정·매직 컨벤션 폐기 — 가변 길이 명시. */
export class CreateCommonCodeDto {
  @IsString()
  @Length(1, 20)
  groupCode!: string;

  @IsString()
  @Length(1, 20)
  code!: string;

  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  shortName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
