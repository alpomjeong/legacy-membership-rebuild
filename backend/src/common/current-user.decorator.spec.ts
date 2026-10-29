import { ExecutionContext } from '@nestjs/common';
import { currentUserFactory, actorIdOf } from './current-user.decorator';

const ctxWith = (user: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as ExecutionContext;

describe('currentUserFactory', () => {
  it('req.user 를 반환', () => {
    const user = { sub: '42', roles: ['STAFF'] };
    expect(currentUserFactory(undefined, ctxWith(user))).toEqual(user);
  });
});

describe('actorIdOf', () => {
  it('sub 를 BigInt 로 변환', () => {
    expect(actorIdOf({ sub: '42', roles: [] })).toBe(42n);
  });
});
