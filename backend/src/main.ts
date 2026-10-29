import './common/bigint-serializer';
import * as crypto from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // 프록시(cloudflared 등) 뒤 실제 클라이언트 IP 인식 — 레이트리밋·로그인이력·
  //   Secure 쿠키 판정에 X-Forwarded-For/Proto 를 신뢰(첫 홉만).
  app.set('trust proxy', 1);

  // 데모 접근 게이트 — DEMO_BASIC_AUTH="user:pass" 설정 시 사이트 전체를 HTTP Basic Auth 로 1차 차단.
  //   공개 데모 URL 보호용(앱 JWT 로그인의 앞단). 미설정(온프레 실운영)이면 완전 비활성.
  //   /health 는 Render/프록시 헬스체크가 막히지 않도록 제외.
  const demoAuth = process.env.DEMO_BASIC_AUTH;
  if (demoAuth) {
    const expected = 'Basic ' + Buffer.from(demoAuth).toString('base64');
    const expBuf = Buffer.from(expected);
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/health' || req.path === '/health/ready') return next();
      // HTML 페이지(네비게이션) 요청만 Basic 게이트. 앱의 XHR/API·정적 서브리소스는 통과시켜,
      //   앱 로그인(JWT) 등 fetch 요청에 Basic 팝업이 재출현하는 문제를 방지한다(브라우저가 XHR 에
      //   Basic 자격을 preemptive 로 안 싣는 경우가 있음). 앱 페이지 자체가 게이트 뒤라 앱은 숨겨지고,
      //   데이터는 JWT/RBAC 로 보호되므로 보안 손실 없음.
      const wantsHtml = (req.headers.accept ?? '').includes('text/html');
      if (!wantsHtml) return next();
      const got = Buffer.from(req.headers.authorization ?? '');
      if (got.length === expBuf.length && crypto.timingSafeEqual(got, expBuf)) {
        return next();
      }
      res.set('WWW-Authenticate', 'Basic realm="bulsa-demo"');
      res.status(401).send('인증이 필요합니다.');
    });
    // ServeStaticModule 미들웨어가 모듈 초기화 때 먼저 등록돼, 정적 SPA(/, /assets…)가
    //   게이트를 우회하는 문제 방지 — 방금 등록한 게이트 레이어를 Express 라우터 스택 맨 앞으로
    //   이동시켜 모든 요청(정적 포함)이 게이트를 먼저 통과하게 한다.
    const inst = app.getHttpAdapter().getInstance() as unknown as {
      router?: { stack: unknown[] };
      _router?: { stack: unknown[] };
    };
    const stack = inst.router?.stack ?? inst._router?.stack;
    if (stack && stack.length > 1) stack.unshift(stack.pop());
  }

  // 보안 헤더(NFR-SEC) — HSTS·noSniff·frameguard 등. helmet 기본 CSP 는 끈다
  // (Swagger UI·정적 SPA 인라인 리소스 호환. SPA CSP 강화는 별도 과제).
  app.use(helmet({ contentSecurityPolicy: false }));

  // CORS — 네이티브(RN, Origin 없음)·서버간 호출은 항상 허용. 브라우저(Origin 동반)는
  // CORS_ALLOWED_ORIGINS(쉼표구분) 화이트리스트로 제한해 PII 노출면 축소. 미설정(개발)이면 reflect.
  // 웹 refresh 는 HttpOnly 쿠키 → credentials:true. origin 콜백이 특정 오리진만 반영('*' 아님)이라
  //   자격증명 CORS 규칙 위반 없음. 동일 오리진(웹/PWA)·네이티브(Origin 없음)는 영향 없음.
  const isProd = process.env.APP_ENV === 'production';
  const corsAllowed = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // 미설정 시 reflect-all 은 개발(APP_ENV!=production)에서만. 운영에선 미설정=교차출처 거부(안전측).
  // 동일 오리진(웹/PWA)·네이티브(Origin 없음)는 영향 없음.
  const reflectAll = corsAllowed.length === 0 && !isProd;
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin || reflectAll || corsAllowed.includes(origin)) cb(null, true);
      else cb(null, false);
    },
    credentials: true,
  });

  // 구조적 로깅(Pino) — 요청 단위 traceId 상관 (NFR-OBS-01)
  app.useLogger(app.get(Logger));

  // 운영 보안 점검 — 기본/미설정 시크릿은 토큰 위조·스토리지 탈취 위험.
  //   APP_ENV=production → 기본값이면 부팅 중단(fail-closed). 그 외(로컬) → 경고만.
  const weak: (string | undefined)[] = [
    undefined,
    '',
    'local-dev-access-secret-change-me',
    'local-dev-refresh-secret-change-me',
  ];
  const insecure: string[] = [];
  if (weak.includes(process.env.JWT_ACCESS_SECRET))
    insecure.push('JWT_ACCESS_SECRET');
  if (weak.includes(process.env.JWT_REFRESH_SECRET))
    insecure.push('JWT_REFRESH_SECRET');
  // 주민번호 암호화 키 — 미설정/기본이면 소스에 박힌 공개 키로 암호화되어 사실상 평문. 반드시 검사.
  if (
    [undefined, '', 'local-dev-jumin-key-change-me'].includes(
      process.env.JUMIN_ENC_KEY,
    )
  )
    insecure.push('JUMIN_ENC_KEY');
  // DB 가 약한 기본 비밀번호를 쓰는지 — DATABASE_URL 에 그대로 들어있으면 취약.
  const WEAK_DB_PW = ['postgres', 'password', 'changeme', 'admin', 'app'];
  if (WEAK_DB_PW.some((pw) => (process.env.DATABASE_URL ?? '').includes(':' + pw + '@')))
    insecure.push('POSTGRES_PASSWORD(약한 기본값)');
  if (insecure.length > 0) {
    const msg = `기본/미설정 시크릿 감지: ${insecure.join(', ')}. infra/native/.env 에 강한 값을 설정하세요.`;
    if (isProd) {
      // 운영에서는 절대 기동 금지 — 조용한 취약 부팅 차단.
      throw new Error(`[보안] ${msg} (APP_ENV=production 부팅 중단)`);
    }
    app
      .get(Logger)
      .warn(
        `[보안 경고] ${msg} 운영 배포 시 APP_ENV=production + 강한 시크릿 필수.`,
      );
  }

  // 자원 중심 URL + API 버전(NFR-API-01). 헬스는 프록시 프로브용으로 prefix 제외.
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });

  // 입력 검증(class-validator) — 알 수 없는 필드 차단(FR-AUTH-01)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 표준 오류 포맷 RFC 7807 Problem Details (NFR-API-02)
  app.useGlobalFilters(new ProblemDetailsFilter());

  // OpenAPI 문서(NFR-API-04) — /api/docs. 운영(APP_ENV=production)에서는 기본 비활성해
  // API 표면 정보노출을 줄인다. 필요하면 ENABLE_API_DOCS=true 로 강제 활성.
  if (!isProd || process.env.ENABLE_API_DOCS === 'true') {
    const config = new DocumentBuilder()
      .setTitle('불사 · 회원관리 API')
      .setDescription('불사 · 회원관리 시스템 REST API')
      .setVersion('v1')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, config),
    );
  }

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
