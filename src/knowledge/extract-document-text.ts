import { BadRequestException } from '@nestjs/common';
import { extractText, getDocumentProxy } from 'unpdf';
import {
  KNOWLEDGE_EMPTY_MESSAGE,
  KNOWLEDGE_FILE_MESSAGE,
} from './knowledge.constants.js';

export async function extractDocumentText(file: {
  mimetype: string;
  originalname: string;
  buffer: Buffer;
}): Promise<string> {
  const name = file.originalname.toLowerCase();
  const isPdf = file.mimetype === 'application/pdf' || name.endsWith('.pdf');
  const text = isPdf
    ? await extractPdfText(file.buffer)
    : file.buffer.toString('utf8');
  const trimmed = text.split('\u0000').join('').trim();

  if (!trimmed) {
    throw new BadRequestException(KNOWLEDGE_EMPTY_MESSAGE);
  }

  if (!isPdf && file.mimetype.startsWith('image/')) {
    throw new BadRequestException(KNOWLEDGE_FILE_MESSAGE);
  }

  return trimmed;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const extracted = await extractText(pdf, { mergePages: true });
    return extracted.text;
  } catch {
    throw new BadRequestException(KNOWLEDGE_FILE_MESSAGE);
  }
}
