import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtAccessPayload } from '../auth/auth.types.js';
import { MulterExceptionFilter } from '../storage/multer-exception.filter.js';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto.js';
import { KNOWLEDGE_FILE_FIELD } from './knowledge.constants.js';
import { KnowledgeService } from './knowledge.service.js';
import { knowledgeUploadOptions } from './knowledge.upload.js';

@Controller('knowledge/documents')
@UseFilters(MulterExceptionFilter)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  findAll() {
    return this.knowledgeService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor(KNOWLEDGE_FILE_FIELD, knowledgeUploadOptions))
  create(
    @Body() dto: CreateKnowledgeDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtAccessPayload,
  ) {
    return this.knowledgeService.create(dto, file, user.sub);
  }
}
