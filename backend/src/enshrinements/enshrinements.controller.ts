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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EnshrinementsService } from './enshrinements.service';
import { CreateEnshrinementDto } from './dto/create-enshrinement.dto';
import { UpdateEnshrinementDto } from './dto/update-enshrinement.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/** 봉안일 API (E1.6, FR-FUN-01~04). RBAC enshrinement:* 서버 강제. */
@ApiTags('enshrinements')
@ApiBearerAuth()
@Controller('enshrinements')
export class EnshrinementsController {
  private readonly tenantId = 1n;

  constructor(private readonly service: EnshrinementsService) {}

  @Get()
  @RequirePermissions('enshrinement:read')
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('order') order?: 'asc' | 'desc',
  ) {
    // 이상값(비숫자·0·음수)은 기본값으로 클램프 — NaN 이 Prisma 로 흘러 500 나던 문제 방지.
    const clamp = (v: string | undefined, dflt: number, max: number) => {
      const n = Math.trunc(Number(v));
      return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : dflt;
    };
    return this.service.list(
      this.tenantId,
      clamp(page, 1, 1_000_000),
      clamp(pageSize, 50, 100_000),
      order === 'asc' ? 'asc' : 'desc',
    );
  }

  @Get(':id')
  @RequirePermissions('enshrinement:read')
  getOne(@Param('id') id: string) {
    return this.service.getById(this.tenantId, BigInt(id));
  }

  @Get(':id/members')
  @RequirePermissions('enshrinement:read')
  roster(@Param('id') id: string) {
    return this.service.roster(this.tenantId, BigInt(id));
  }

  @Post()
  @RequirePermissions('enshrinement:create')
  create(
    @Body() dto: CreateEnshrinementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Put(':id')
  @RequirePermissions('enshrinement:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEnshrinementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('enshrinement:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
