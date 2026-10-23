import { join } from 'node:path';

export const DEFAULT_UPLOADS_DIR = join(process.cwd(), 'uploads');
export const UPLOADS_PUBLIC_PREFIX = '/uploads';
export const DIVISION_UPLOADS_SUBDIR = 'divisions';
export const CATEGORY_UPLOADS_SUBDIR = 'categories';
export const PRODUCT_UPLOADS_SUBDIR = 'products';
export const MANAGED_UPLOAD_SUBDIRS = [
  DIVISION_UPLOADS_SUBDIR,
  CATEGORY_UPLOADS_SUBDIR,
  PRODUCT_UPLOADS_SUBDIR,
] as const;
export const IMAGE_FIELD = 'image';
export const DIVISION_IMAGE_FIELD = IMAGE_FIELD;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const DIVISION_IMAGE_MAX_BYTES = IMAGE_MAX_BYTES;

export const IMAGE_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
} as const;

export const DIVISION_IMAGE_MIME_TYPES = IMAGE_MIME_TYPES;

export type ImageMimeType = keyof typeof IMAGE_MIME_TYPES;
export type DivisionImageMimeType = ImageMimeType;

export const IMAGE_INVALID_TYPE_MESSAGE =
  'Image must be JPEG, PNG, WebP, or GIF';
export const DIVISION_IMAGE_INVALID_TYPE_MESSAGE = IMAGE_INVALID_TYPE_MESSAGE;
export const IMAGE_TOO_LARGE_MESSAGE = 'Image must be at most 5MB';
export const DIVISION_IMAGE_TOO_LARGE_MESSAGE = IMAGE_TOO_LARGE_MESSAGE;

export function getUploadsRoot(uploadsDir?: string): string {
  return uploadsDir ?? process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR;
}

export function isImageMimeType(mimeType: string): mimeType is ImageMimeType {
  return mimeType in IMAGE_MIME_TYPES;
}

export function isDivisionImageMimeType(
  mimeType: string,
): mimeType is DivisionImageMimeType {
  return isImageMimeType(mimeType);
}
