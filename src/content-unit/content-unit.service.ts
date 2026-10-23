import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContentUnitDto } from './dto/create-content-unit.dto.js';
import { ListContentUnitsQueryDto } from './dto/list-content-units.query.js';
import { UpdateContentUnitDto } from './dto/update-content-unit.dto.js';
import {
  CONTENT_UNIT_CODE_EXISTS_MESSAGE,
  CONTENT_UNIT_DETAILS_EXIST_MESSAGE,
  CONTENT_UNIT_HAS_PRODUCTS_MESSAGE,
  CONTENT_UNIT_NAME_EXISTS_MESSAGE,
  CONTENT_UNIT_NOT_FOUND_MESSAGE,
  CONTENT_UNIT_UPDATE_EMPTY_MESSAGE,
  DEFAULT_CONTENT_UNIT_PAGE,
  DEFAULT_CONTENT_UNIT_PAGE_SIZE,
} from './content-unit.constants.js';

const activeContentUnitWhere = {
  isDeleted: false,
} as const;

@Injectable()
export class ContentUnitService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContentUnitDto) {
    await this.assertUniqueNameAndCode(dto.name, dto.code);

    try {
      return await this.prisma.contentUnit.create({
        data: {
          name: dto.name,
          code: dto.code,
          singularLabel: dto.singularLabel,
          pluralLabel: dto.pluralLabel,
          ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        },
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListContentUnitsQueryDto) {
    const page = query.page ?? DEFAULT_CONTENT_UNIT_PAGE;
    const limit = query.limit ?? DEFAULT_CONTENT_UNIT_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const where = activeContentUnitWhere;

    const [data, total] = await Promise.all([
      this.prisma.contentUnit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.contentUnit.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: UpdateContentUnitDto) {
    const { name, code, singularLabel, pluralLabel, sortOrder, status } = dto;

    if (
      name === undefined &&
      code === undefined &&
      singularLabel === undefined &&
      pluralLabel === undefined &&
      sortOrder === undefined &&
      status === undefined
    ) {
      throw new BadRequestException(CONTENT_UNIT_UPDATE_EMPTY_MESSAGE);
    }

    await this.ensureActive(id);
    await this.assertUniqueNameAndCode(name, code, id);

    try {
      return await this.prisma.contentUnit.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(singularLabel !== undefined ? { singularLabel } : {}),
          ...(pluralLabel !== undefined ? { pluralLabel } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
          ...(status !== undefined ? { status } : {}),
        },
      });
    } catch (error) {
      this.handleNotFoundError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async remove(id: string) {
    const productCount = await this.prisma.product.count({
      where: {
        contentUnitId: id,
        isDeleted: false,
      },
    });

    if (productCount > 0) {
      throw new ConflictException(CONTENT_UNIT_HAS_PRODUCTS_MESSAGE);
    }

    const result = await this.prisma.contentUnit.updateMany({
      where: {
        id,
        ...activeContentUnitWhere,
      },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(CONTENT_UNIT_NOT_FOUND_MESSAGE);
    }
  }

  private async ensureActive(id: string) {
    const contentUnit = await this.prisma.contentUnit.findFirst({
      where: {
        id,
        ...activeContentUnitWhere,
      },
    });

    if (!contentUnit) {
      throw new NotFoundException(CONTENT_UNIT_NOT_FOUND_MESSAGE);
    }

    return contentUnit;
  }

  private async assertUniqueNameAndCode(
    name?: string,
    code?: string,
    excludeId?: string,
  ) {
    if (name === undefined && code === undefined) {
      return;
    }

    const existing = await this.prisma.contentUnit.findFirst({
      where: {
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          ...(name !== undefined ? [{ name }] : []),
          ...(code !== undefined ? [{ code }] : []),
        ],
      },
    });

    if (!existing) {
      return;
    }

    if (name !== undefined && existing.name === name) {
      throw new ConflictException(CONTENT_UNIT_NAME_EXISTS_MESSAGE);
    }

    throw new ConflictException(CONTENT_UNIT_CODE_EXISTS_MESSAGE);
  }

  private handleNotFoundError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(CONTENT_UNIT_NOT_FOUND_MESSAGE);
    }
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return;
    }

    const target = error.meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [];

    if (fields.includes('name')) {
      throw new ConflictException(CONTENT_UNIT_NAME_EXISTS_MESSAGE);
    }

    if (fields.includes('code')) {
      throw new ConflictException(CONTENT_UNIT_CODE_EXISTS_MESSAGE);
    }

    throw new ConflictException(CONTENT_UNIT_DETAILS_EXIST_MESSAGE);
  }
}
