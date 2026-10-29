import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ProblemDetailsFilter,
  type ProblemDetails,
} from './problem-details.filter';

function mockHost(url = '/api/v1/x', headers: Record<string, unknown> = {}) {
  let captured: ProblemDetails | undefined;
  const json = (body: ProblemDetails): void => {
    captured = body;
  };
  const status = jest.fn().mockReturnValue({ json });
  const req = { originalUrl: url, headers };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => req,
    }),
  } as never;
  return {
    host,
    status,
    body: (): ProblemDetails => captured as ProblemDetails,
  };
}

describe('ProblemDetailsFilter (NFR-API-02 / RFC 7807)', () => {
  it('HttpException → RFC7807 본문 + traceId(헤더 반영)', () => {
    const f = new ProblemDetailsFilter();
    const { host, status, body } = mockHost('/api/v1/members', {
      'x-request-id': 'tid-1',
    });
    f.catch(new NotFoundException('회원 없음'), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(body()).toMatchObject({
      status: 404,
      detail: '회원 없음',
      traceId: 'tid-1',
      instance: '/api/v1/members',
    });
  });

  it('원시 Error → 500, 원시 메시지/스택 미노출', () => {
    const f = new ProblemDetailsFilter();
    const { host, status, body } = mockHost();
    f.catch(new Error('DB connection secret leak'), host);
    expect(status).toHaveBeenCalledWith(500);
    const b = body();
    expect(b.status).toBe(500);
    expect(b.detail).toBeUndefined();
    expect(JSON.stringify(b)).not.toContain('secret leak');
    expect(b.traceId).toBeTruthy();
  });

  it('validation 배열 메시지를 detail 로 합친다', () => {
    const f = new ProblemDetailsFilter();
    const { host, body } = mockHost();
    f.catch(
      new BadRequestException({
        message: ['loginId 필수', 'password 필수'],
        error: 'Bad Request',
      }),
      host,
    );
    expect(body().detail).toContain('loginId 필수');
    expect(body().title).toBe('Bad Request');
  });
});
