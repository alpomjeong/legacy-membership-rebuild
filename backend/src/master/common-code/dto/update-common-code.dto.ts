import { PartialType } from '@nestjs/swagger';
import { CreateCommonCodeDto } from './create-common-code.dto';

/** 공통코드 수정 DTO — 생성 필드의 부분집합. */
export class UpdateCommonCodeDto extends PartialType(CreateCommonCodeDto) {}
