import { CreateMemberDto } from './create-member.dto';

/** 회원 수정 DTO — PUT 전체 교체(이름 필수 유지). */
export class UpdateMemberDto extends CreateMemberDto {}
