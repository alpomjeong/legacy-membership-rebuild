import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { StaffDto } from './dto/staff.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/** 사원 API (DM-08). 주민번호 암호화/마스킹·복호화 감사. RBAC staff:* (관리자 전용). */
@ApiTags('staff')
@ApiBearerAuth()
@Controller('admin/staff')
export class StaffController {
  private readonly tenantId = 1n;

  constructor(private readonly service: StaffService) {}

  @Get()
  @RequirePermissions('staff:read')
  list() {
    return this.service.list(this.tenantId);
  }

  @Get(':id/jumin')
  @RequirePermissions('staff:pii:read')
  revealJumin(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.revealJumin(this.tenantId, actorIdOf(user), BigInt(id));
  }

  @Post()
  @RequirePermissions('staff:create')
  create(@Body() dto: StaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Put(':id')
  @RequirePermissions('staff:update')
  update(
    @Param('id') id: string,
    @Body() dto: StaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('staff:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
