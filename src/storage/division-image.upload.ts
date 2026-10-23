import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  IMAGE_FIELD,
  IMAGE_INVALID_TYPE_MESSAGE,
  IMAGE_MAX_BYTES,
  isImageMimeType,
} from './storage.constants.js';

type MulterFileFilterFile = {
  mimetype: string;
};

export const imageUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: IMAGE_MAX_BYTES,
    files: 1,
  },
  fileFilter: (
    _request: unknown,
    file: MulterFileFilterFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!isImageMimeType(file.mimetype)) {
      callback(new BadRequestException(IMAGE_INVALID_TYPE_MESSAGE), false);
      return;
    }

    callback(null, true);
  },
};

export const divisionImageUploadOptions = imageUploadOptions;
export { IMAGE_FIELD as DIVISION_IMAGE_FIELD, IMAGE_FIELD };
