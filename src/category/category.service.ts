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
  CATEGORY_CODE_EXISTS_MESSAGE,
  CATEGORY_DETAILS_EXIST_MESSAGE,
  CATEGORY_DIVISION_NOT_FOUND_MESSAGE,
  CATEGORY_HAS_PRODUCTS_MESSAGE,
  CATEGORY_NAME_EXISTS_MESSAGE,
  CATEGORY_NOT_FOUND_MESSAGE,
  CATEGORY_UPDATE_EMPTY_MESSAGE,
  DEFAULT_CATEGORY_PAGE,
  DEFAULT_CATEGORY_PAGE_SIZE,
} from './category.constants.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesQueryDto } from './dto/list-categories.query.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

const activeCategoryWhere = {
  isDeleted: false,
} as const;

const categoryInclude = {
  division: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} as const;

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: LocalFileStorageService,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    image?: Express.Multer.File,
  ) {
    const { name, code, description, divisionId } = createCategoryDto;

    await this.ensureActiveDivision(divisionId);
    await this.assertUniqueNameAndCode(divisionId, name, code);

    const imageUrl = image
      ? await this.files.saveCategoryImage(image)
      : undefined;

    try {
      return await this.prisma.category.create({
        data: {
          name,
          code,
          description,
          divisionId,
          imageUrl,
        },
        include: categoryInclude,
      });
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleForeignKeyError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListCategoriesQueryDto) {
    const page = query.page ?? DEFAULT_CATEGORY_PAGE;
    const limit = query.limit ?? DEFAULT_CATEGORY_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const where = {
      ...activeCategoryWhere,
      ...(query.divisionId ? { divisionId: query.divisionId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: categoryInclude,
      }),
      this.prisma.category.count({ where }),
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
    updateCategoryDto: UpdateCategoryDto,
    image?: Express.Multer.File,
  ) {
    const { name, code, description, status, divisionId } = updateCategoryDto;

    if (
      name === undefined &&
      code === undefined &&
      description === undefined &&
      status === undefined &&
      divisionId === undefined &&
      !image
    ) {
      throw new BadRequestException(CATEGORY_UPDATE_EMPTY_MESSAGE);
    }

    const existing = await this.ensureActiveCategory(id);
    const targetDivisionId = divisionId ?? existing.divisionId;

    if (divisionId !== undefined) {
      await this.ensureActiveDivision(divisionId);
    }

    await this.assertUniqueNameAndCode(
      targetDivisionId,
      name ?? (divisionId !== undefined ? existing.name : undefined),
      code ?? (divisionId !== undefined ? existing.code : undefined),
      id,
    );

    const imageUrl = image
      ? await this.files.saveCategoryImage(image)
      : undefined;

    try {
      const updated = await this.prisma.category.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(divisionId !== undefined ? { divisionId } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        include: categoryInclude,
      });

      if (imageUrl) {
        await this.files.removeIfManaged(existing.imageUrl);
      }

      return updated;
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleNotFoundError(error);
      this.handleForeignKeyError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async remove(id: string) {
    const productCount = await this.prisma.product.count({
      where: {
        categoryId: id,
        isDeleted: false,
      },
    });

    if (productCount > 0) {
      throw new ConflictException(CATEGORY_HAS_PRODUCTS_MESSAGE);
    }

    const result = await this.prisma.category.updateMany({
      where: {
        id,
        ...activeCategoryWhere,
      },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }
  }

  private async ensureActiveCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        ...activeCategoryWhere,
      },
    });

    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }

    return category;
  }

  private async ensureActiveDivision(id: string) {
    const division = await this.prisma.division.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!division) {
      throw new BadRequestException(CATEGORY_DIVISION_NOT_FOUND_MESSAGE);
    }

    return division;
  }

  private async assertUniqueNameAndCode(
    divisionId: string,
    name?: string,
    code?: string,
    excludeId?: string,
  ) {
    if (name === undefined && code === undefined) {
      return;
    }

    const existing = await this.prisma.category.findFirst({
      where: {
        divisionId,
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
      throw new ConflictException(CATEGORY_NAME_EXISTS_MESSAGE);
    }

    throw new ConflictException(CATEGORY_CODE_EXISTS_MESSAGE);
  }

  private handleNotFoundError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE);
    }
  }

  private handleForeignKeyError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(CATEGORY_DIVISION_NOT_FOUND_MESSAGE);
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
      throw new ConflictException(CATEGORY_NAME_EXISTS_MESSAGE);
    }

    if (fields.includes('code')) {
      throw new ConflictException(CATEGORY_CODE_EXISTS_MESSAGE);
    }

    throw new ConflictException(CATEGORY_DETAILS_EXIST_MESSAGE);
  }
}
