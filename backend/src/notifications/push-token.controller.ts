import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PushTokenService } from './push-token.service';

export class RegisterPushTokenDto {
  @IsString() @MinLength(1) @MaxLength(255) token!: string;
  @IsOptional() @IsString() @MaxLength(20) platform?: string;
}

export class RemovePushTokenDto {
  @IsString() @MinLength(1) @MaxLength(255) token!: string;
}

/** 기기 푸시 토큰 등록/해제 (`/me/push-token`) — 인증된 사용자 본인 기기. */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/push-token')
export class PushTokenController {
  constructor(private readonly svc: PushTokenService) {}

  @Post()
  @HttpCode(204)
  async register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.svc.register(BigInt(user.sub), dto.token, dto.platform);
  }

  @Delete()
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RemovePushTokenDto,
  ): Promise<void> {
    await this.svc.remove(BigInt(user.sub), dto.token);
  }
}
