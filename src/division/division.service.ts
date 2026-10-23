import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorageService } from '../storage/local-file-storage.service.js';
import {
  DEFAULT_DIVISION_PAGE,
  DEFAULT_DIVISION_PAGE_SIZE,
  DIVISION_CODE_EXISTS_MESSAGE,
  DIVISION_DETAILS_EXIST_MESSAGE,
  DIVISION_HAS_CATEGORIES_MESSAGE,
  DIVISION_NAME_EXISTS_MESSAGE,
  DIVISION_NOT_FOUND_MESSAGE,
  DIVISION_UPDATE_EMPTY_MESSAGE,
} from './division.constants.js';
import { CreateDivisionDto } from './dto/create-division.dto.js';
import { ListDivisionsQueryDto } from './dto/list-divisions.query.js';
import { UpdateDivisionDto } from './dto/update-division.dto.js';

const activeDivisionWhere = {
  isDeleted: false,
} as const;

@Injectable()
export class DivisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: LocalFileStorageService,
  ) {}

  async create(
    createDivisionDto: CreateDivisionDto,
    image?: Express.Multer.File,
  ) {
    const { name, code, description } = createDivisionDto;

    await this.assertUniqueNameAndCode(name, code);

    const imageUrl = image
      ? await this.files.saveDivisionImage(image)
      : undefined;

    try {
      return await this.prisma.division.create({
        data: {
          name,
          code,
          description,
          imageUrl,
        },
      });
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListDivisionsQueryDto) {
    const page = query.page ?? DEFAULT_DIVISION_PAGE;
    const limit = query.limit ?? DEFAULT_DIVISION_PAGE_SIZE;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.division.findMany({
        where: activeDivisionWhere,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.division.count({
        where: activeDivisionWhere,
      }),
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

  async update(
    id: string,
    updateDivisionDto: UpdateDivisionDto,
    image?: Express.Multer.File,
  ) {
    const { name, code, description, status } = updateDivisionDto;

    if (
      name === undefined &&
      code === undefined &&
      description === undefined &&
      status === undefined &&
      !image
    ) {
      throw new BadRequestException(DIVISION_UPDATE_EMPTY_MESSAGE);
    }

    const existing = await this.ensureActiveDivision(id);
    await this.assertUniqueNameAndCode(name, code, id);

    const imageUrl = image
      ? await this.files.saveDivisionImage(image)
      : undefined;

    try {
      const updated = await this.prisma.division.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      });

      if (imageUrl) {
        await this.files.removeIfManaged(existing.imageUrl);
      }

      return updated;
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleNotFoundError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async remove(id: string) {
    const categoryCount = await this.prisma.category.count({
      where: {
        divisionId: id,
        isDeleted: false,
      },
    });

    if (categoryCount > 0) {
      throw new ConflictException(DIVISION_HAS_CATEGORIES_MESSAGE);
    }

    const result = await this.prisma.division.updateMany({
      where: {
        id,
        ...activeDivisionWhere,
      },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(DIVISION_NOT_FOUND_MESSAGE);
    }
  }

  private async ensureActiveDivision(id: string) {
    const division = await this.prisma.division.findFirst({
      where: {
        id,
        ...activeDivisionWhere,
      },
    });

    if (!division) {
      throw new NotFoundException(DIVISION_NOT_FOUND_MESSAGE);
    }

    return division;
  }

  private async assertUniqueNameAndCode(
    name?: string,
    code?: string,
    excludeId?: string,
  ) {
    if (name === undefined && code === undefined) {
      return;
    }

    const existing = await this.prisma.division.findFirst({
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
      throw new ConflictException(DIVISION_NAME_EXISTS_MESSAGE);
    }

    throw new ConflictException(DIVISION_CODE_EXISTS_MESSAGE);
  }

  private handleNotFoundError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(DIVISION_NOT_FOUND_MESSAGE);
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
      throw new ConflictException(DIVISION_NAME_EXISTS_MESSAGE);
    }

    if (fields.includes('code')) {
      throw new ConflictException(DIVISION_CODE_EXISTS_MESSAGE);
    }

    throw new ConflictException(DIVISION_DETAILS_EXIST_MESSAGE);
  }
}
