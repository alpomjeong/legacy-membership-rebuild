import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface MenuItem {
  code: string;
  name: string;
}
export interface MenuGroup {
  code: string;
  name: string;
  items: MenuItem[];
}

/**
 * MenusService — DM-14/15. 메뉴 트리를 호출자 보유 권한으로 필터링(서버 강제, FR-IA-04).
 * 권한 링크 없는 메뉴는 항상 노출, 빈 그룹은 캐스케이드 숨김.
 */
@Injectable()
export class MenusService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(tenantId: bigint, roleCodes: string[]): Promise<MenuGroup[]> {
    const grantedRows =
      roleCodes.length > 0
        ? await this.prisma.permission.findMany({
            where: { roles: { some: { role: { code: { in: roleCodes } } } } },
            select: { code: true },
          })
        : [];
    const granted = new Set(grantedRows.map((p) => p.code));

    const menus = await this.prisma.menu.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }],
      include: {
        permissions: { include: { permission: { select: { code: true } } } },
      },
    });

    const visible = (permCodes: string[]) =>
      permCodes.length === 0 || permCodes.some((c) => granted.has(c));

    const groups = menus.filter((m) => m.level === 0);
    const result: MenuGroup[] = [];
    for (const g of groups) {
      const items = menus
        .filter(
          (m) =>
            m.parentId === g.id &&
            visible(m.permissions.map((p) => p.permission.code)),
        )
        .map((m) => ({ code: m.code, name: m.name }));
      if (items.length > 0) result.push({ code: g.code, name: g.name, items });
    }
    return result;
  }
}
