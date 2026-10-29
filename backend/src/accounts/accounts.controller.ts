import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { RequirePermissions } from '../rbac/decorators';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

/** 계정 관리 API (FR-AUTH-13) — 관리자(account:*) 전용. */
@ApiTags('accounts')
@ApiBearerAuth()
@Controller('admin/accounts')
export class AccountsController {
  private readonly tenantId = 1n;

  constructor(private readonly service: AccountsService) {}

  @Get()
  @RequirePermissions('account:read')
  list() {
    return this.service.list(this.tenantId);
  }

  @Post()
  @RequirePermissions('account:create')
  create(
    @Body() dto: CreateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Patch(':id')
  @RequirePermissions('account:update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
    return { ok: true };
  }

  @Post(':id/reset-password')
  @RequirePermissions('account:update')
  resetPassword(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resetPassword(
      this.tenantId,
      actorIdOf(user),
      BigInt(id),
    );
  }

  @Post(':id/logout-all')
  @RequirePermissions('account:update')
  forceLogout(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.forceLogout(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
