import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { RequirePermissions } from '../rbac/decorators';

/**
 * 통합 검색 API (E1.4, FR-MEM-14/FR-BUD-15). 회원 본인 + 인물 슬롯 매칭으로 소유 회원 노출.
 * 인가: member:read 서버 강제.
 */
@ApiTags('search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  private readonly tenantId = 1n;

  constructor(private readonly service: SearchService) {}

  @Get('members')
  @RequirePermissions('member:read')
  searchMembers(
    @Query('q') q: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.searchMembers(
      this.tenantId,
      q ?? '',
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }
}
