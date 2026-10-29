import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { JwtStrategy } from './jwt.strategy';

/**
 * AuthModule — 인증 기반(E0.4). 비밀번호 해시/JWT 발급/로그인/passport-jwt 전략 묶음.
 * 시크릿/TTL 은 per-sign 으로 ConfigService(전역) 에서 주입하므로 JwtModule 은 빈 설정으로 등록.
 */
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService, PasswordService],
})
export class AuthModule {}
