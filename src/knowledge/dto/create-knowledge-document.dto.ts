import { Transform } from 'class-transformer';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { KnowledgeDocumentKind } from '../../generated/prisma/client.js';
import { trimString } from '../../inventory/dto/transform-strings.js';
import { KNOWLEDGE_TITLE_MESSAGE } from '../knowledge.constants.js';

export class CreateKnowledgeDocumentDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1, { message: KNOWLEDGE_TITLE_MESSAGE })
  @MaxLength(200)
  title!: string;

  @IsEnum(KnowledgeDocumentKind)
  kind!: KnowledgeDocumentKind;
}
