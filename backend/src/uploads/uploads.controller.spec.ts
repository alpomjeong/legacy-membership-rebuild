import {
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { StorageService } from '../storage/storage.service';

function build() {
  const put = jest.fn().mockResolvedValue('key');
  const getObject = jest.fn();
  const storage = { put, getObject } as unknown as StorageService;
  return { controller: new UploadsController(storage), put, getObject };
}

const VALID_KEY = 'img_00000000-0000-0000-0000-000000000000.png';

const img = (
  over: Partial<{ buffer: Buffer; mimetype: string; size: number }> = {},
) => ({
  buffer: Buffer.from('x'),
  mimetype: 'image/png',
  size: 100,
  ...over,
});

describe('UploadsController.image', () => {
  it('파일이 없으면 400', async () => {
    const { controller } = build();
    await expect(controller.image(undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('이미지가 아닌 MIME 은 거부', async () => {
    const { controller, put } = build();
    await expect(
      controller.image(img({ mimetype: 'application/pdf' })),
    ).rejects.toThrow(BadRequestException);
    expect(put).not.toHaveBeenCalled();
  });

  it('5MB 초과는 거부', async () => {
    const { controller } = build();
    await expect(
      controller.image(img({ size: 6 * 1024 * 1024 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('유효 이미지 → 저장 후 key/url 반환', async () => {
    const { controller, put } = build();
    const res = await controller.image(img({ mimetype: 'image/jpeg' }));
    expect(put).toHaveBeenCalledTimes(1);
    expect(res.key).toMatch(/^img_.*\.jpg$/);
    expect(res.url).toMatch(/^\/api\/v1\/uploads\/image\/img_.*\.jpg$/);
  });
});

describe('UploadsController.serve (IDOR 방어)', () => {
  it('이미지 네임스페이스 밖 키는 404 + 스토리지 미접근', async () => {
    const { controller, getObject } = build();
    await expect(controller.serve('imports/secret.xlsx')).rejects.toThrow(
      NotFoundException,
    );
    await expect(controller.serve('certificate-1.pdf')).rejects.toThrow(
      NotFoundException,
    );
    expect(getObject).not.toHaveBeenCalled();
  });

  it('형식상 이미지 키여도 저장 콘텐츠가 비이미지면 404', async () => {
    const { controller, getObject } = build();
    getObject.mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'application/json',
    });
    await expect(controller.serve(VALID_KEY)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('유효 이미지 키 → StreamableFile', async () => {
    const { controller, getObject } = build();
    getObject.mockResolvedValue({
      body: Buffer.from('x'),
      contentType: 'image/png',
    });
    const res = await controller.serve(VALID_KEY);
    expect(res).toBeInstanceOf(StreamableFile);
  });
});
