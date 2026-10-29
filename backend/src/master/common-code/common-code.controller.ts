import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommonCodeService } from './common-code.service';
import { CreateCommonCodeDto } from './dto/create-common-code.dto';
import { UpdateCommonCodeDto } from './dto/update-common-code.dto';
import { RequirePermissions } from '../../rbac/decorators';

/**
 * 공통코드 마스터 CRUD (E0.6, FR-MST-01/02/03). 그룹/값 2단계.
 * 매직 컨벤션(0000 메타그룹·^code^ 캐럿·4자 고정) 폐기 — groupCode/code 를 명시 관리.
 * 인가: common_code:read/create/update 권한을 서버에서 강제(NFR-SEC-04).
 */
@ApiTags('common-codes')
@ApiBearerAuth()
@Controller('common-codes')
export class CommonCodeController {
  // 1단계 단일 테넌트. 추후 인증 컨텍스트의 테넌트로 대체.
  private readonly tenantId = 1n;

  constructor(private readonly service: CommonCodeService) {}

  @Get()
  @RequirePermissions('common_code:read')
  list(@Query('group') group: string, @Query('all') all?: string) {
    return this.service.listByGroup(this.tenantId, group, all === 'true');
  }

  @Post()
  @RequirePermissions('common_code:create')
  create(@Body() dto: CreateCommonCodeDto) {
    return this.service.create(this.tenantId, dto);
  }

  @Patch(':id')
  @RequirePermissions('common_code:update')
  update(@Param('id') id: string, @Body() dto: UpdateCommonCodeDto) {
    return this.service.update(BigInt(id), dto);
  }

  @Delete(':id')
  @RequirePermissions('common_code:update')
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(BigInt(id));
  }
}
