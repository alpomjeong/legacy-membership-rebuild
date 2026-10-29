import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MenusService } from './menus.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser } from '../common/current-user.decorator';

/** 메뉴 API (DM-14/15). 인증된 사용자의 보유 권한 기반 메뉴 트리(@RequirePermissions 없음=인증만). */
@ApiTags('menus')
@ApiBearerAuth()
@Controller('menus')
export class MenusController {
  private readonly tenantId = 1n;

  constructor(private readonly service: MenusService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.forUser(this.tenantId, user.roles);
  }
}
