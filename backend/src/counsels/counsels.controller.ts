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
import { buildSheet } from '@infrastructure/excel/sheet-export';
import { CounselsService } from './counsels.service';
import { CreateCounselDto } from './dto/create-counsel.dto';
import { UpdateCounselDto } from './dto/update-counsel.dto';
import { QueryCounselsDto } from './dto/query-counsels.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/** 상담 API (E1.7, FR-CNS-01~09). RBAC counsel:* 서버 강제. */
@ApiTags('counsels')
@ApiBearerAuth()
@Controller('counsels')
export class CounselsController {
  private readonly tenantId = 1n;

  constructor(private readonly service: CounselsService) {}

  @Get()
  @RequirePermissions('counsel:read')
  list(@Query() query: QueryCounselsDto) {
    return this.service.list(this.tenantId, query);
  }

  @Get('by-member/:memberId')
  @RequirePermissions('counsel:read')
  byMember(@Param('memberId') memberId: string) {
    return this.service.byMember(this.tenantId, BigInt(memberId));
  }

  @Get('export')
  @RequirePermissions('counsel:export')
  async exportXlsx(@Query() query: QueryCounselsDto): Promise<StreamableFile> {
    const rows = await this.service.listForExport(this.tenantId, query);
    const buf = await buildSheet(
      '상담현황',
      [
        { header: '상담일시', key: 'when' },
        { header: '회원', key: 'member' },
        { header: '상담내용', key: 'content' },
      ],
      rows.map((r) => ({
        when: r.counseledAt
          ? new Date(r.counseledAt).toISOString().slice(0, 16).replace('T', ' ')
          : '',
        member: r.memberDisplayName ?? r.memberName ?? '',
        content: r.content,
      })),
    );
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="counsels.xlsx"',
    });
  }

  @Get(':id')
  @RequirePermissions('counsel:read')
  getOne(@Param('id') id: string) {
    return this.service.getById(this.tenantId, BigInt(id));
  }

  @Post()
  @RequirePermissions('counsel:create')
  create(
    @Body() dto: CreateCounselDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Put(':id')
  @RequirePermissions('counsel:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCounselDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('counsel:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
