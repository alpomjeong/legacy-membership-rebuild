import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { buildMemberWorkbook } from '@infrastructure/excel/member-export';
import { MembersService } from './members.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { QueryMembersDto } from './dto/query-members.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/**
 * 회원 API (E1.1, FR-MEM-*). 인가는 @RequirePermissions 로 서버 강제(전역 가드).
 * 1단계 단일 사찰 — tenantId=1n(추후 인증 컨텍스트로 대체).
 */
@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  private readonly tenantId = 1n;

  constructor(private readonly service: MembersService) {}

  @Get()
  @RequirePermissions('member:read')
  list(@Query() query: QueryMembersDto) {
    return this.service.list(this.tenantId, query);
  }

  @Get('duplicate-candidates')
  @RequirePermissions('member:read')
  duplicates(
    @Query('name') name: string,
    @Query('missionaryId') missionaryId?: string,
  ) {
    return this.service.findDuplicateCandidates(
      this.tenantId,
      name,
      missionaryId ? BigInt(missionaryId) : null,
    );
  }

  @Get('export')
  @RequirePermissions('member:export')
  async exportXlsx(@Query() query: QueryMembersDto): Promise<StreamableFile> {
    const rows = await this.service.listForExport(this.tenantId, query);
    const buf = await buildMemberWorkbook(rows);
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="members.xlsx"',
    });
  }

  @Get(':id')
  @RequirePermissions('member:read')
  getOne(@Param('id') id: string) {
    return this.service.getById(this.tenantId, BigInt(id));
  }

  @Post()
  @RequirePermissions('member:create')
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Put(':id')
  @RequirePermissions('member:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('member:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
