import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { buildSheet } from '@infrastructure/excel/sheet-export';
import { renderCertificatePdf } from '@infrastructure/pdf/certificate-renderer';
import { BuddhistServicesService } from './buddhist-services.service';
import { CreateBuddhistServiceDto } from './dto/create-buddhist-service.dto';
import { UpdateBuddhistServiceDto } from './dto/update-buddhist-service.dto';
import { QueryBuddhistServicesDto } from './dto/query-buddhist-services.dto';
import { RequirePermissions } from '../rbac/decorators';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CurrentUser, actorIdOf } from '../common/current-user.decorator';

/**
 * 불사 신청 API (E1.2, FR-BUD-*). 인가는 @RequirePermissions 로 서버 강제(전역 가드).
 * 1단계 단일 사찰 — tenantId=1n(추후 인증 컨텍스트로 대체).
 */
@ApiTags('buddhist-services')
@ApiBearerAuth()
@Controller('buddhist-services')
export class BuddhistServicesController {
  private readonly tenantId = 1n;

  constructor(private readonly service: BuddhistServicesService) {}

  @Get()
  @RequirePermissions('buddhist_service:read')
  list(@Query() query: QueryBuddhistServicesDto) {
    return this.service.list(this.tenantId, query);
  }

  @Get('export')
  @RequirePermissions('buddhist_service:export')
  async exportXlsx(
    @Query() query: QueryBuddhistServicesDto,
  ): Promise<StreamableFile> {
    const rows = await this.service.listForExport(this.tenantId, query);
    const buf = await buildSheet(
      '제사·불사현황',
      [
        { header: '봉안일', key: 'enshrinement' },
        { header: '불사목록', key: 'item' },
        { header: '회원', key: 'member' },
        { header: '단번호', key: 'altar' },
        { header: '복위자', key: 'bogwija' },
        { header: '복전자', key: 'bokjunja' },
        { header: '영가', key: 'spiritual' },
        { header: '제자 재', key: 'yesujae' },
        { header: '12성주', key: 'seongju12' },
        { header: '시주', key: 'donation' },
        { header: '신청일', key: 'date' },
        { header: '상태', key: 'status' },
      ],
      rows.map((r) => ({
        enshrinement: r.enshrinementLabel ?? '',
        item: r.buddhistServiceItemName ?? '',
        member: r.memberName ?? '',
        altar: r.altarNumber ?? '',
        bogwija: r.bogwija ?? '',
        bokjunja: r.bokjunja ?? '',
        spiritual: r.spiritual ?? '',
        yesujae: r.yesujae ?? '',
        seongju12: r.seongju12 ?? '',
        donation: r.donationAmount ?? '',
        date: r.registrationDate
          ? new Date(r.registrationDate).toISOString().slice(0, 10)
          : '',
        status: r.isCanceled ? '취소' : r.isCertificateIssued ? '증서' : '신청',
      })),
    );
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment; filename="buddhist-services.xlsx"',
    });
  }

  @Get(':id')
  @RequirePermissions('buddhist_service:read')
  getOne(@Param('id') id: string) {
    return this.service.getById(this.tenantId, BigInt(id));
  }

  /** 불사 증서 PDF 발급(FR-RPT-09) — 한글 폰트 임베드. 발급 상태만 허용. */
  @Get(':id/certificate')
  @RequirePermissions('buddhist_service:print')
  async certificate(@Param('id') id: string): Promise<StreamableFile> {
    const v = await this.service.getById(this.tenantId, BigInt(id));
    if (!v.isCertificateIssued) {
      throw new BadRequestException('증서 미발급 상태입니다.');
    }
    const pdf = await renderCertificatePdf({
      memberName: v.memberName ?? '',
      itemName: v.buddhistServiceItemName ?? '',
      altarNumber: v.altarNumber,
      issuedDate: v.certificateIssuedDate
        ? new Date(v.certificateIssuedDate).toISOString().slice(0, 10)
        : null,
    });
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="certificate-${id}.pdf"`,
    });
  }

  @Post()
  @RequirePermissions('buddhist_service:create')
  create(
    @Body() dto: CreateBuddhistServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(this.tenantId, actorIdOf(user), dto);
  }

  @Put(':id')
  @RequirePermissions('buddhist_service:update')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBuddhistServiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(this.tenantId, actorIdOf(user), BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('buddhist_service:delete')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.softDelete(this.tenantId, actorIdOf(user), BigInt(id));
  }
}
