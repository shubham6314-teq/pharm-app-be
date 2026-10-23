import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  CATEGORY_UPLOADS_SUBDIR,
  DIVISION_UPLOADS_SUBDIR,
  IMAGE_INVALID_TYPE_MESSAGE,
  IMAGE_MAX_BYTES,
  IMAGE_MIME_TYPES,
  IMAGE_TOO_LARGE_MESSAGE,
  MANAGED_UPLOAD_SUBDIRS,
  PRODUCT_UPLOADS_SUBDIR,
  UPLOADS_PUBLIC_PREFIX,
  getUploadsRoot,
  isImageMimeType,
} from './storage.constants.js';

@Injectable()
export class LocalFileStorageService {
  private readonly uploadsRoot: string;

  constructor(config: ConfigService) {
    this.uploadsRoot = getUploadsRoot(config.get<string>('UPLOADS_DIR'));
  }

  async saveDivisionImage(file: Express.Multer.File): Promise<string> {
    return this.saveImage(file, DIVISION_UPLOADS_SUBDIR);
  }

  async saveCategoryImage(file: Express.Multer.File): Promise<string> {
    return this.saveImage(file, CATEGORY_UPLOADS_SUBDIR);
  }

  async saveProductImage(file: Express.Multer.File): Promise<string> {
    return this.saveImage(file, PRODUCT_UPLOADS_SUBDIR);
  }

  async saveImage(
    file: Express.Multer.File,
    subdir: (typeof MANAGED_UPLOAD_SUBDIRS)[number],
  ): Promise<string> {
    if (!isImageMimeType(file.mimetype)) {
      throw new BadRequestException(IMAGE_INVALID_TYPE_MESSAGE);
    }

    if (file.size > IMAGE_MAX_BYTES) {
      throw new BadRequestException(IMAGE_TOO_LARGE_MESSAGE);
    }

    const extension = IMAGE_MIME_TYPES[file.mimetype];
    const filename = `${randomUUID()}${extension}`;
    const directory = join(this.uploadsRoot, subdir);

    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);

    return `${UPLOADS_PUBLIC_PREFIX}/${subdir}/${filename}`;
  }

  async removeIfManaged(publicUrl: string | null | undefined): Promise<void> {
    const managed = this.getManagedFile(publicUrl);
    if (!managed) {
      return;
    }

    await unlink(join(this.uploadsRoot, managed.subdir, managed.filename)).catch(
      () => undefined,
    );
  }

  private getManagedFile(publicUrl: string | null | undefined): {
    subdir: string;
    filename: string;
  } | null {
    if (!publicUrl) {
      return null;
    }

    const prefix = `${UPLOADS_PUBLIC_PREFIX}/`;
    if (!publicUrl.startsWith(prefix)) {
      return null;
    }

    const rest = publicUrl.slice(prefix.length);
    const [subdir, filename] = rest.split('/');
    if (
      !subdir ||
      !filename ||
      rest.split('/').length !== 2 ||
      filename.includes('..') ||
      !MANAGED_UPLOAD_SUBDIRS.includes(
        subdir as (typeof MANAGED_UPLOAD_SUBDIRS)[number],
      )
    ) {
      return null;
    }

    return { subdir, filename };
  }
}
