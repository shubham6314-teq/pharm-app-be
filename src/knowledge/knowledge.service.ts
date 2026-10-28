import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { randomUUID } from 'node:crypto';
import { KnowledgeDocumentKind } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateKnowledgeDocumentDto } from './dto/create-knowledge-document.dto.js';
import {
  documentEmbeddingInput,
  queryEmbeddingInput,
  toVectorLiteral,
} from './embedding-text.js';
import { extractDocumentText } from './extract-document-text.js';
import {
  KNOWLEDGE_CHUNK_OVERLAP,
  KNOWLEDGE_CHUNK_SIZE,
  KNOWLEDGE_EMBEDDING_UNAVAILABLE_MESSAGE,
  KNOWLEDGE_EMPTY_MESSAGE,
  KNOWLEDGE_FILE_MESSAGE,
  KNOWLEDGE_SEARCH_LIMIT,
} from './knowledge.constants.js';

export type KnowledgeChunkMatch = {
  id: string;
  title: string;
  kind: KnowledgeDocumentKind;
  content: string;
  score: number;
};

export type KnowledgeSearchResult = {
  unavailable: boolean;
  chunks: KnowledgeChunkMatch[];
};

type ChunkRow = {
  id: string;
  content: string;
  title: string;
  kind: KnowledgeDocumentKind;
  score: number | string;
};

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private embeddings: GoogleGenerativeAIEmbeddings | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    dto: CreateKnowledgeDocumentDto,
    file: Express.Multer.File | undefined,
    uploadedById: string,
  ) {
    if (!file) {
      throw new BadRequestException(KNOWLEDGE_FILE_MESSAGE);
    }

    const text = await extractDocumentText(file);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: KNOWLEDGE_CHUNK_SIZE,
      chunkOverlap: KNOWLEDGE_CHUNK_OVERLAP,
    });
    const parts = (await splitter.splitText(text))
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      throw new BadRequestException(KNOWLEDGE_EMPTY_MESSAGE);
    }

    let vectors: number[][];
    try {
      vectors = await this.embeddingModel().embedDocuments(
        parts.map((part) => documentEmbeddingInput(dto.title, part)),
      );
      vectors.forEach((vector) => toVectorLiteral(vector));
    } catch (error) {
      this.logger.error('Document embedding failed', error);
      throw new ServiceUnavailableException(
        KNOWLEDGE_EMBEDDING_UNAVAILABLE_MESSAGE,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.knowledgeDocument.create({
        data: {
          title: dto.title,
          kind: dto.kind,
          filename: file.originalname,
          uploadedById,
        },
        select: {
          id: true,
          title: true,
          kind: true,
          filename: true,
          createdAt: true,
        },
      });

      for (const [ordinal, content] of parts.entries()) {
        await tx.$executeRaw`
          INSERT INTO knowledge_chunks (
            id,
            "documentId",
            ordinal,
            content,
            embedding,
            "createdAt"
          )
          VALUES (
            ${randomUUID()}::uuid,
            ${document.id}::uuid,
            ${ordinal},
            ${content},
            ${toVectorLiteral(vectors[ordinal] ?? [])}::vector,
            NOW()
          )
        `;
      }

      return document;
    });
  }

  async findAll() {
    return this.prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        kind: true,
        filename: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    });
  }

  async search(
    query: string,
    limit = KNOWLEDGE_SEARCH_LIMIT,
  ): Promise<KnowledgeSearchResult> {
    try {
      const vector = await this.embeddingModel().embedQuery(
        queryEmbeddingInput(query),
      );
      const literal = toVectorLiteral(vector);
      const rows = await this.prisma.$queryRaw<ChunkRow[]>`
        SELECT
          c.id,
          c.content,
          d.title,
          d.kind::text AS kind,
          (1 - (c.embedding <=> ${literal}::vector)) AS score
        FROM knowledge_chunks c
        INNER JOIN knowledge_documents d ON d.id = c."documentId"
        ORDER BY c.embedding <=> ${literal}::vector
        LIMIT ${limit}
      `;

      return {
        unavailable: false,
        chunks: rows.map((row) => ({
          id: row.id,
          title: row.title,
          kind: row.kind,
          content: row.content,
          score: Number(row.score),
        })),
      };
    } catch (error) {
      this.logger.error('Knowledge search failed', error);
      return { unavailable: true, chunks: [] };
    }
  }

  private embeddingModel(): GoogleGenerativeAIEmbeddings {
    if (!this.embeddings) {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (!apiKey) {
        throw new ServiceUnavailableException(
          KNOWLEDGE_EMBEDDING_UNAVAILABLE_MESSAGE,
        );
      }

      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model:
          this.configService.get<string>('GEMINI_EMBEDDING_MODEL') ??
          'gemini-embedding-2',
        outputDimensionality: 768,
      });
    }

    return this.embeddings;
  }
}
