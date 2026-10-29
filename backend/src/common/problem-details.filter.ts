import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** RFC 7807 Problem Details 응답 본문. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  traceId: string;
}

/**
 * ProblemDetailsFilter — 전역 예외 필터(NFR-API-02). 모든 오류를 RFC 7807 형식으로 통일.
 * HttpException 은 상태/메시지를 매핑하고, 그 외(원시 Error)는 500으로 처리하되
 * 원시 메시지/스택을 노출하지 않는다(레거시 `throw new Exception(ex.Message)` 대체).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const header = req.headers['x-request-id'];
    const traceId =
      (Array.isArray(header) ? header[0] : header) ?? randomUUID();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let title = 'Internal Server Error';
    let detail: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = exception.name;
      const r = exception.getResponse();
      if (typeof r === 'string') {
        detail = r;
      } else if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        const msg = obj.message;
        detail = Array.isArray(msg)
          ? msg.join(', ')
          : typeof msg === 'string'
            ? msg
            : undefined;
        if (typeof obj.error === 'string') title = obj.error;
      }
    } else if (exception instanceof Error) {
      // 원시 메시지/스택은 응답에 노출하지 않고 서버 로그로만 남긴다.
      this.logger.error(exception.message, exception.stack);
    }

    const body: ProblemDetails = {
      type: 'about:blank',
      title,
      status,
      detail,
      instance: req.originalUrl,
      traceId,
    };
    res.status(status).json(body);
  }
}
