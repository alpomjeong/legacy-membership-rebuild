import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('정의되어 있고 Prisma 수명주기 훅을 노출한다', () => {
    const service = new PrismaService();

    expect(service).toBeDefined();
    expect(typeof service.onModuleInit).toBe('function');
    expect(typeof service.onModuleDestroy).toBe('function');
    // PrismaClient 를 확장하므로 connect/disconnect 가 존재해야 한다(실제 호출은 DB 필요).
    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');
  });
});
