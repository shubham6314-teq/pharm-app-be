import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePackTypeDto } from './dto/create-pack-type.dto.js';
import { ListPackTypesQueryDto } from './dto/list-pack-types.query.js';
import { UpdatePackTypeDto } from './dto/update-pack-type.dto.js';
import {
  DEFAULT_PACK_TYPE_PAGE,
  DEFAULT_PACK_TYPE_PAGE_SIZE,
  PACK_TYPE_CODE_EXISTS_MESSAGE,
  PACK_TYPE_DETAILS_EXIST_MESSAGE,
  PACK_TYPE_HAS_PRODUCTS_MESSAGE,
  PACK_TYPE_NAME_EXISTS_MESSAGE,
  PACK_TYPE_NOT_FOUND_MESSAGE,
  PACK_TYPE_UPDATE_EMPTY_MESSAGE,
} from './pack-type.constants.js';

const activePackTypeWhere = {
  isDeleted: false,
} as const;

@Injectable()
export class PackTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePackTypeDto) {
    await this.assertUniqueNameAndCode(dto.name, dto.code);

    try {
      return await this.prisma.packType.create({
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

  async findAll(query: ListPackTypesQueryDto) {
    const page = query.page ?? DEFAULT_PACK_TYPE_PAGE;
    const limit = query.limit ?? DEFAULT_PACK_TYPE_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const where = activePackTypeWhere;

    const [data, total] = await Promise.all([
      this.prisma.packType.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.packType.count({ where }),
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

  async update(id: string, dto: UpdatePackTypeDto) {
    const { name, code, singularLabel, pluralLabel, sortOrder, status } = dto;

    if (
      name === undefined &&
      code === undefined &&
      singularLabel === undefined &&
      pluralLabel === undefined &&
      sortOrder === undefined &&
      status === undefined
    ) {
      throw new BadRequestException(PACK_TYPE_UPDATE_EMPTY_MESSAGE);
    }

    await this.ensureActive(id);
    await this.assertUniqueNameAndCode(name, code, id);

    try {
      return await this.prisma.packType.update({
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
        packTypeId: id,
        isDeleted: false,
      },
    });

    if (productCount > 0) {
      throw new ConflictException(PACK_TYPE_HAS_PRODUCTS_MESSAGE);
    }

    const result = await this.prisma.packType.updateMany({
      where: {
        id,
        ...activePackTypeWhere,
      },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(PACK_TYPE_NOT_FOUND_MESSAGE);
    }
  }

  private async ensureActive(id: string) {
    const packType = await this.prisma.packType.findFirst({
      where: {
        id,
        ...activePackTypeWhere,
      },
    });

    if (!packType) {
      throw new NotFoundException(PACK_TYPE_NOT_FOUND_MESSAGE);
    }

    return packType;
  }

  private async assertUniqueNameAndCode(
    name?: string,
    code?: string,
    excludeId?: string,
  ) {
    if (name === undefined && code === undefined) {
      return;
    }

    const existing = await this.prisma.packType.findFirst({
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
      throw new ConflictException(PACK_TYPE_NAME_EXISTS_MESSAGE);
    }

    throw new ConflictException(PACK_TYPE_CODE_EXISTS_MESSAGE);
  }

  private handleNotFoundError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(PACK_TYPE_NOT_FOUND_MESSAGE);
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
      throw new ConflictException(PACK_TYPE_NAME_EXISTS_MESSAGE);
    }

    if (fields.includes('code')) {
      throw new ConflictException(PACK_TYPE_CODE_EXISTS_MESSAGE);
    }

    throw new ConflictException(PACK_TYPE_DETAILS_EXIST_MESSAGE);
  }
}
