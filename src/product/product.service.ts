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
  DEFAULT_PRODUCT_PAGE,
  DEFAULT_PRODUCT_PAGE_SIZE,
  PRODUCT_CATEGORY_NOT_FOUND_MESSAGE,
  PRODUCT_CODE_EXISTS_MESSAGE,
  PRODUCT_CONTENT_UNIT_NOT_FOUND_MESSAGE,
  PRODUCT_DETAILS_EXIST_MESSAGE,
  PRODUCT_NAME_PACK_EXISTS_MESSAGE,
  PRODUCT_NOT_FOUND_MESSAGE,
  PRODUCT_PACK_TYPE_NOT_FOUND_MESSAGE,
  PRODUCT_UPDATE_EMPTY_MESSAGE,
} from './product.constants.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.query.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const activeProductWhere = {
  isDeleted: false,
} as const;

const catalogUnitSelect = {
  id: true,
  name: true,
  code: true,
  singularLabel: true,
  pluralLabel: true,
} as const;

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      code: true,
      divisionId: true,
      division: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  packType: {
    select: catalogUnitSelect,
  },
  contentUnit: {
    select: catalogUnitSelect,
  },
} as const;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: LocalFileStorageService,
  ) {}

  async create(createProductDto: CreateProductDto, image?: Express.Multer.File) {
    const {
      name,
      code,
      description,
      brandName,
      composition,
      packSize,
      packTypeId,
      contentQuantity,
      contentUnitId,
      reorderLevel,
      mrp,
      discountPercent,
      categoryId,
    } = createProductDto;

    await this.ensureActiveCategory(categoryId);
    await this.ensureActivePackType(packTypeId);
    await this.ensureActiveContentUnit(contentUnitId);
    await this.assertUniqueCode(code);
    await this.assertUniqueNameAndPack(categoryId, name, packSize);

    const imageUrl = image
      ? await this.files.saveProductImage(image)
      : undefined;

    try {
      const created = await this.prisma.product.create({
        data: {
          name,
          code,
          description,
          brandName,
          composition,
          packSize,
          packTypeId,
          contentQuantity,
          contentUnitId,
          ...(reorderLevel !== undefined ? { reorderLevel } : {}),
          mrp,
          ...(discountPercent !== undefined ? { discountPercent } : {}),
          categoryId,
          imageUrl,
        },
        include: productInclude,
      });

      return this.toProductResponse(created);
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleForeignKeyError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async findAll(query: ListProductsQueryDto) {
    const page = query.page ?? DEFAULT_PRODUCT_PAGE;
    const limit = query.limit ?? DEFAULT_PRODUCT_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {
      ...activeProductWhere,
      category: {
        isDeleted: false,
        ...(query.divisionId ? { divisionId: query.divisionId } : {}),
      },
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: data.map((product) => this.toProductResponse(product)),
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
    updateProductDto: UpdateProductDto,
    image?: Express.Multer.File,
  ) {
    const {
      name,
      code,
      description,
      brandName,
      composition,
      packSize,
      packTypeId,
      contentQuantity,
      contentUnitId,
      reorderLevel,
      mrp,
      discountPercent,
      status,
      categoryId,
    } = updateProductDto;

    if (
      name === undefined &&
      code === undefined &&
      description === undefined &&
      brandName === undefined &&
      composition === undefined &&
      packSize === undefined &&
      packTypeId === undefined &&
      contentQuantity === undefined &&
      contentUnitId === undefined &&
      reorderLevel === undefined &&
      mrp === undefined &&
      discountPercent === undefined &&
      status === undefined &&
      categoryId === undefined &&
      !image
    ) {
      throw new BadRequestException(PRODUCT_UPDATE_EMPTY_MESSAGE);
    }

    const existing = await this.ensureActiveProduct(id);
    const targetCategoryId = categoryId ?? existing.categoryId;

    if (categoryId !== undefined) {
      await this.ensureActiveCategory(categoryId);
    }

    if (packTypeId !== undefined) {
      await this.ensureActivePackType(packTypeId);
    }

    if (contentUnitId !== undefined) {
      await this.ensureActiveContentUnit(contentUnitId);
    }

    if (code !== undefined) {
      await this.assertUniqueCode(code, id);
    }

    if (name !== undefined || packSize !== undefined || categoryId !== undefined) {
      await this.assertUniqueNameAndPack(
        targetCategoryId,
        name ?? existing.name,
        packSize ?? existing.packSize,
        id,
      );
    }

    const imageUrl = image
      ? await this.files.saveProductImage(image)
      : undefined;

    try {
      const updated = await this.prisma.product.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(code !== undefined ? { code } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(brandName !== undefined ? { brandName } : {}),
          ...(composition !== undefined ? { composition } : {}),
          ...(packSize !== undefined ? { packSize } : {}),
          ...(packTypeId !== undefined ? { packTypeId } : {}),
          ...(contentQuantity !== undefined ? { contentQuantity } : {}),
          ...(contentUnitId !== undefined ? { contentUnitId } : {}),
          ...(reorderLevel !== undefined ? { reorderLevel } : {}),
          ...(mrp !== undefined ? { mrp } : {}),
          ...(discountPercent !== undefined ? { discountPercent } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(categoryId !== undefined ? { categoryId } : {}),
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
        include: productInclude,
      });

      if (imageUrl) {
        await this.files.removeIfManaged(existing.imageUrl);
      }

      return this.toProductResponse(updated);
    } catch (error) {
      await this.files.removeIfManaged(imageUrl);
      this.handleNotFoundError(error);
      this.handleForeignKeyError(error);
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  async remove(id: string) {
    const result = await this.prisma.product.updateMany({
      where: {
        id,
        ...activeProductWhere,
      },
      data: {
        isDeleted: true,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE);
    }
  }

  private toProductResponse(product: ProductRecord) {
    const mrp = this.toNumber(product.mrp);
    const discountPercent = this.toNumber(product.discountPercent);

    return {
      ...product,
      mrp,
      discountPercent,
      contentQuantity: this.toNumber(product.contentQuantity),
      sellingPrice: this.toSellingPrice(mrp, discountPercent),
    };
  }

  private toSellingPrice(mrp: number, discountPercent: number): number {
    return Number((mrp * (1 - discountPercent / 100)).toFixed(2));
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }

  private async ensureActiveProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        ...activeProductWhere,
      },
    });

    if (!product) {
      throw new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE);
    }

    return product;
  }

  private async ensureActiveCategory(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!category) {
      throw new BadRequestException(PRODUCT_CATEGORY_NOT_FOUND_MESSAGE);
    }

    return category;
  }

  private async ensureActivePackType(id: string) {
    const packType = await this.prisma.packType.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!packType) {
      throw new BadRequestException(PRODUCT_PACK_TYPE_NOT_FOUND_MESSAGE);
    }

    return packType;
  }

  private async ensureActiveContentUnit(id: string) {
    const contentUnit = await this.prisma.contentUnit.findFirst({
      where: {
        id,
        isDeleted: false,
      },
    });

    if (!contentUnit) {
      throw new BadRequestException(PRODUCT_CONTENT_UNIT_NOT_FOUND_MESSAGE);
    }

    return contentUnit;
  }

  private async assertUniqueCode(code: string, excludeId?: string) {
    const existing = await this.prisma.product.findFirst({
      where: {
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(PRODUCT_CODE_EXISTS_MESSAGE);
    }
  }

  private async assertUniqueNameAndPack(
    categoryId: string,
    name: string,
    packSize: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.product.findFirst({
      where: {
        categoryId,
        name,
        packSize,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new ConflictException(PRODUCT_NAME_PACK_EXISTS_MESSAGE);
    }
  }

  private handleNotFoundError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE);
    }
  }

  private handleForeignKeyError(error: unknown): void {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2003'
    ) {
      return;
    }

    const field = String(error.meta?.field_name ?? '');

    if (field.includes('packTypeId')) {
      throw new BadRequestException(PRODUCT_PACK_TYPE_NOT_FOUND_MESSAGE);
    }

    if (field.includes('contentUnitId')) {
      throw new BadRequestException(PRODUCT_CONTENT_UNIT_NOT_FOUND_MESSAGE);
    }

    throw new BadRequestException(PRODUCT_CATEGORY_NOT_FOUND_MESSAGE);
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

    if (fields.includes('code')) {
      throw new ConflictException(PRODUCT_CODE_EXISTS_MESSAGE);
    }

    if (fields.includes('name') || fields.includes('packSize')) {
      throw new ConflictException(PRODUCT_NAME_PACK_EXISTS_MESSAGE);
    }

    throw new ConflictException(PRODUCT_DETAILS_EXIST_MESSAGE);
  }
}
