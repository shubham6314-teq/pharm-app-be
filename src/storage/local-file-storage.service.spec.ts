import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalFileStorageService } from './local-file-storage.service.js';
import {
  CATEGORY_UPLOADS_SUBDIR,
  DIVISION_IMAGE_INVALID_TYPE_MESSAGE,
  DIVISION_UPLOADS_SUBDIR,
  PRODUCT_UPLOADS_SUBDIR,
} from './storage.constants.js';

const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function makeFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname: 'card.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: pngBuffer.length,
    buffer: pngBuffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
    ...overrides,
  };
}

describe('LocalFileStorageService', () => {
  let uploadsDir: string;
  let service: LocalFileStorageService;

  beforeEach(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'pharma-uploads-'));
    service = new LocalFileStorageService({
      get: () => uploadsDir,
    } as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(uploadsDir, { recursive: true, force: true });
  });

  it('saves an image and returns a public uploads path', async () => {
    const publicUrl = await service.saveDivisionImage(makeFile());

    expect(publicUrl).toMatch(
      /^\/uploads\/divisions\/[0-9a-f-]+\.png$/i,
    );
    const filename = publicUrl.split('/').at(-1);
    const stored = await readFile(
      join(uploadsDir, DIVISION_UPLOADS_SUBDIR, filename ?? ''),
    );
    expect(stored.equals(pngBuffer)).toBe(true);
  });

  it('rejects a non-image file', async () => {
    await expect(
      service.saveDivisionImage(
        makeFile({
          mimetype: 'text/plain',
          originalname: 'notes.txt',
        }),
      ),
    ).rejects.toThrow(new BadRequestException(DIVISION_IMAGE_INVALID_TYPE_MESSAGE));
  });

  it('removes a managed image file', async () => {
    const publicUrl = await service.saveDivisionImage(makeFile());

    await service.removeIfManaged(publicUrl);

    await expect(
      readFile(
        join(uploadsDir, DIVISION_UPLOADS_SUBDIR, publicUrl.split('/').at(-1) ?? ''),
      ),
    ).rejects.toThrow();
  });

  it('saves a category image under the categories folder', async () => {
    const publicUrl = await service.saveCategoryImage(makeFile());

    expect(publicUrl).toMatch(
      /^\/uploads\/categories\/[0-9a-f-]+\.png$/i,
    );
    const filename = publicUrl.split('/').at(-1);
    const stored = await readFile(
      join(uploadsDir, CATEGORY_UPLOADS_SUBDIR, filename ?? ''),
    );
    expect(stored.equals(pngBuffer)).toBe(true);
  });

  it('saves a product image under the products folder', async () => {
    const publicUrl = await service.saveProductImage(makeFile());

    expect(publicUrl).toMatch(
      /^\/uploads\/products\/[0-9a-f-]+\.png$/i,
    );
    const filename = publicUrl.split('/').at(-1);
    const stored = await readFile(
      join(uploadsDir, PRODUCT_UPLOADS_SUBDIR, filename ?? ''),
    );
    expect(stored.equals(pngBuffer)).toBe(true);
  });

  it('ignores unmanaged urls', async () => {
    await expect(
      service.removeIfManaged('https://example.com/cardiology.png'),
    ).resolves.toBeUndefined();
  });
});
