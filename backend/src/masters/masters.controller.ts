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
import { MastersService } from './masters.service';
import { MissionaryDto, ServiceItemDto } from './dto/master.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/** 마스터 조회 + CRUD API (E1.x). 폼 룩업 + 관리자 마스터 관리. RBAC 서버 강제. */
@ApiTags('masters')
@ApiBearerAuth()
@Controller()
export class MastersController {
  private readonly tenantId = 1n;

  constructor(private readonly service: MastersService) {}

  // ---- 룩업(드롭다운) ----
  @Get('missionaries')
  @RequirePermissions('missionary:read')
  missionaries() {
    return this.service.missionaries(this.tenantId);
  }

  @Get('buddhist-service-items')
  @RequirePermissions('service_item:read')
  buddhistServiceItems() {
    return this.service.buddhistServiceItems(this.tenantId);
  }

  @Get('buddhist-service-items/:id/slot-rules')
  @RequirePermissions('service_item:read')
  slotRules(@Param('id') id: string) {
    return this.service.slotRulesForItem(this.tenantId, BigInt(id));
  }

  @Get('sexagenary-years')
  @RequirePermissions('buddhist_service:read')
  sexagenaryYears() {
    return this.service.sexagenaryYears(this.tenantId);
  }

  // ---- 관리자: 포교원장 ----
  @Get('admin/missionaries')
  @RequirePermissions('missionary:read')
  missionariesAll() {
    return this.service.missionariesAll(this.tenantId);
  }

  @Post('admin/missionaries')
  @RequirePermissions('missionary:create')
  createMissionary(
    @Body() dto: MissionaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createMissionary(this.tenantId, actorIdOf(user), dto);
  }

  @Put('admin/missionaries/:id')
  @RequirePermissions('missionary:update')
  updateMissionary(
    @Param('id') id: string,
    @Body() dto: MissionaryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateMissionary(
      this.tenantId,
      actorIdOf(user),
      BigInt(id),
      dto,
    );
  }

  @Delete('admin/missionaries/:id')
  @HttpCode(204)
  @RequirePermissions('missionary:delete')
  deleteMissionary(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteMissionary(
      this.tenantId,
      actorIdOf(user),
      BigInt(id),
    );
  }

  // ---- 관리자: 불사목록 ----
  @Get('admin/buddhist-service-items')
  @RequirePermissions('service_item:read')
  serviceItemsAll() {
    return this.service.serviceItemsAll(this.tenantId);
  }

  @Post('admin/buddhist-service-items')
  @RequirePermissions('service_item:create')
  createServiceItem(
    @Body() dto: ServiceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createServiceItem(this.tenantId, actorIdOf(user), dto);
  }

  @Put('admin/buddhist-service-items/:id')
  @RequirePermissions('service_item:update')
  updateServiceItem(
    @Param('id') id: string,
    @Body() dto: ServiceItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateServiceItem(
      this.tenantId,
      actorIdOf(user),
      BigInt(id),
      dto,
    );
  }

  @Delete('admin/buddhist-service-items/:id')
  @HttpCode(204)
  @RequirePermissions('service_item:delete')
  deleteServiceItem(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteServiceItem(
      this.tenantId,
      actorIdOf(user),
      BigInt(id),
    );
  }

  // ---- 관리자: 역할 ----
  @Get('admin/roles')
  @RequirePermissions('role:read')
  roles() {
    return this.service.roles(this.tenantId);
  }
}
