import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { StorageService } from '../storage/storage.service';
import { Public, RequirePermissions } from '../rbac/decorators';

interface UploadedImg {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_BYTES = 5 * 1024 * 1024;
/** 공개 서빙 허용 키 = 업로드가 생성한 이미지 네임스페이스만(버킷 내 타 객체 읽기 차단). */
const IMAGE_KEY_RE =
  /^img_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$/;

/**
 * 이미지 업로드/서빙 (FR-MST-08/FR-HR-04, NFR-FILE-01) — 오브젝트 스토리지(MinIO/S3) 외부화.
 * 업로드는 인증 필요, 서빙(GET)은 <img> 로딩 위해 공개(키=UUID 비유추). DB엔 URL/메타만.
 */
@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('image')
  // 쓰기 권한(사원·불사목록 편집자)만 업로드 허용 — 데코레이터 없으면 PermissionsGuard 통과라
  //   조회 전용 계정도 업로드되던 문제 차단. service_item:update 는 ADMIN·STAFF 보유, READONLY 미보유.
  @RequirePermissions('service_item:update')
  // 인터셉터 상한은 극단 크기(DoS)만 차단하는 하드캡(수동 체크보다 넉넉히). 정상 초과(5~10MB)는
  // 아래 수동 체크가 친절한 400 메시지로 처리 — 인터셉터 413 이 이를 가리지 않게 2배로 둔다.
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 2 * MAX_BYTES } }),
  )
  async image(
    @UploadedFile() file?: UploadedImg,
  ): Promise<{ key: string; url: string }> {
    if (!file) throw new BadRequestException('파일이 필요합니다(field: file)');
    const ext = EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        '이미지 파일만 업로드 가능합니다(png/jpg/webp/gif)',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('이미지는 5MB 이하만 가능합니다');
    }
    const key = `img_${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    return { key, url: `/api/v1/uploads/image/${key}` };
  }

  @Public()
  @Get('image/:key')
  async serve(@Param('key') key: string): Promise<StreamableFile> {
    // 키를 이미지 네임스페이스로 제한 — 임의 버킷 객체(예: 업로드 원본 xlsx) 읽기 방지.
    if (!IMAGE_KEY_RE.test(key)) throw new NotFoundException();
    let obj: { body: Buffer; contentType: string };
    try {
      obj = await this.storage.getObject(key);
    } catch {
      throw new NotFoundException();
    }
    // 저장 콘텐츠가 이미지가 아니면 거부(이중 방어).
    if (!obj.contentType.startsWith('image/')) throw new NotFoundException();
    return new StreamableFile(obj.body, {
      type: obj.contentType,
      disposition: 'inline',
    });
  }
}
