import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { UserSettingsService } from './user-settings.service';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SetUserSettingDto } from './dto/set-user-setting.dto';

/** 개인 설정 API — 인증만으로 자신의 설정 조회/저장(@RequirePermissions 없음). */
@ApiTags('user-settings')
@ApiBearerAuth()
@Controller('me/settings')
export class UserSettingsController {
  constructor(private readonly service: UserSettingsService) {}

  @Get(':key')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('key') key: string) {
    return { value: await this.service.get(BigInt(user.sub), key) };
  }

  @Put(':key')
  async set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: SetUserSettingDto,
  ) {
    await this.service.set(
      BigInt(user.sub),
      key,
      dto.value as Prisma.InputJsonValue,
    );
    return { ok: true };
  }
}
