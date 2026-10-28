import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';
import {
  KNOWLEDGE_FILE_MESSAGE,
  KNOWLEDGE_MAX_BYTES,
} from './knowledge.constants.js';

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
]);

type UploadFile = {
  mimetype: string;
  originalname: string;
};

export function isKnowledgeFile(file: UploadFile): boolean {
  if (TEXT_MIME_TYPES.has(file.mimetype)) {
    return true;
  }

  if (file.mimetype === 'application/pdf') {
    return true;
  }

  const name = file.originalname.toLowerCase();
  return name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.pdf');
}

export const knowledgeUploadOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: KNOWLEDGE_MAX_BYTES,
    files: 1,
  },
  fileFilter: (
    _request: unknown,
    file: UploadFile,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!isKnowledgeFile(file)) {
      callback(new BadRequestException(KNOWLEDGE_FILE_MESSAGE), false);
      return;
    }

    callback(null, true);
  },
};
