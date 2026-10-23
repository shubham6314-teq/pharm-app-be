import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorageService } from '../storage/local-file-storage.service.js';
import {
  DEFAULT_PRODUCT_PAGE,
  DEFAULT_PRODUCT_PAGE_SIZE,
  PRODUCT_CATEGORY_NOT_FOUND_MESSAGE,
  PRODUCT_NOT_FOUND_MESSAGE,
  PRODUCT_UPDATE_EMPTY_MESSAGE,
} from './product.constants.js';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    product: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    category: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    packType: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    contentUnit: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  let files: {
    saveProductImage: ReturnType<typeof vi.fn>;
    removeIfManaged: ReturnType<typeof vi.fn>;
  };

  const createDto: CreateProductDto = {
    name: 'Crocin',
    code: 'CRO100ML',
    description: 'Paracetamol syrup',
    brandName: 'GSK',
    composition: 'Paracetamol 125 mg/5 ml',
    packSize: '100 ML',
    packTypeId: 'aaaaaaaa-0001-4000-8000-000000000002',
    contentQuantity: 100,
    contentUnitId: 'bbbbbbbb-0001-4000-8000-000000000003',
    reorderLevel: 20,
    mrp: 80,
    discountPercent: 10,
    categoryId: '22222222-2222-4222-8222-222222222222',
  };

  const category = {
    id: createDto.categoryId,
    name: 'Antipyretics',
    code: 'ANTIPYR',
    divisionId: '11111111-1111-4111-8111-111111111111',
    division: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'General Medicines',
      code: 'GEN',
    },
  };

  const packType = {
    id: createDto.packTypeId,
    name: 'Bottle',
    code: 'BOTTLE',
    singularLabel: 'bottle',
    pluralLabel: 'bottles',
  };

  const contentUnit = {
    id: createDto.contentUnitId,
    name: 'Millilitre',
    code: 'ML',
    singularLabel: 'ml',
    pluralLabel: 'ml',
  };

  const createdProduct = {
    id: '33333333-3333-4333-8333-333333333333',
    name: createDto.name,
    code: createDto.code,
    description: createDto.description,
    imageUrl: null as string | null,
    brandName: createDto.brandName,
    composition: createDto.composition,
    packSize: createDto.packSize,
    packTypeId: createDto.packTypeId,
    packType,
    contentQuantity: createDto.contentQuantity,
    contentUnitId: createDto.contentUnitId,
    contentUnit,
    reorderLevel: createDto.reorderLevel,
    mrp: createDto.mrp,
    discountPercent: createDto.discountPercent,
    status: ProductStatus.ACTIVE,
    isDeleted: false,
    categoryId: createDto.categoryId,
    category,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const productResponse = {
    ...createdProduct,
    sellingPrice: 72,
  };

  const imageFile = {
    originalname: 'crocin.png',
    mimetype: 'image/png',
    buffer: Buffer.from('png'),
    size: 3,
  } as Express.Multer.File;

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
      select: {
        id: true,
        name: true,
        code: true,
        singularLabel: true,
        pluralLabel: true,
      },
    },
    contentUnit: {
      select: {
        id: true,
        name: true,
        code: true,
        singularLabel: true,
        pluralLabel: true,
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
      },
      packType: {
        findFirst: vi.fn(),
      },
      contentUnit: {
        findFirst: vi.fn(),
      },
    };
    files = {
      saveProductImage: vi.fn(),
      removeIfManaged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: LocalFileStorageService, useValue: files },
      ],
    }).compile();

    service = module.get(ProductService);
    prisma.packType.findFirst.mockResolvedValue(packType);
    prisma.contentUnit.findFirst.mockResolvedValue(contentUnit);
  });

  it('creates a product successfully', async () => {
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.packType.findFirst.mockResolvedValue(packType);
    prisma.contentUnit.findFirst.mockResolvedValue(contentUnit);
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(createdProduct);

    await expect(service.create(createDto)).resolves.toEqual(productResponse);
    expect(files.saveProductImage).not.toHaveBeenCalled();
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: {
        name: createDto.name,
        code: createDto.code,
        description: createDto.description,
        brandName: createDto.brandName,
        composition: createDto.composition,
        packSize: createDto.packSize,
        packTypeId: createDto.packTypeId,
        contentQuantity: createDto.contentQuantity,
        contentUnitId: createDto.contentUnitId,
        reorderLevel: createDto.reorderLevel,
        mrp: createDto.mrp,
        discountPercent: createDto.discountPercent,
        categoryId: createDto.categoryId,
        imageUrl: undefined,
      },
      include: productInclude,
    });
  });

  it('creates a product with an uploaded image', async () => {
    const imageUrl = '/uploads/products/crocin.png';
    const withImage = { ...createdProduct, imageUrl };
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.product.findFirst.mockResolvedValue(null);
    files.saveProductImage.mockResolvedValue(imageUrl);
    prisma.product.create.mockResolvedValue(withImage);

    await expect(service.create(createDto, imageFile)).resolves.toEqual({
      ...productResponse,
      imageUrl,
    });
    expect(files.saveProductImage).toHaveBeenCalledWith(imageFile);
  });

  it('returns 400 when the selected category is missing', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toThrow(
      new BadRequestException(PRODUCT_CATEGORY_NOT_FOUND_MESSAGE),
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the product code already exists', async () => {
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.product.findFirst.mockResolvedValue({
      ...createdProduct,
      name: 'Other',
    });

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('lists products with default pagination', async () => {
    prisma.product.findMany.mockResolvedValue([createdProduct]);
    prisma.product.count.mockResolvedValue(1);

    await expect(service.findAll({})).resolves.toEqual({
      data: [productResponse],
      meta: {
        page: DEFAULT_PRODUCT_PAGE,
        limit: DEFAULT_PRODUCT_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false, category: { isDeleted: false } },
      skip: 0,
      take: DEFAULT_PRODUCT_PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    });
  });

  it('lists products filtered by category and division', async () => {
    prisma.product.findMany.mockResolvedValue([createdProduct]);
    prisma.product.count.mockResolvedValue(1);

    await expect(
      service.findAll({
        categoryId: createDto.categoryId,
        divisionId: category.divisionId,
      }),
    ).resolves.toEqual({
      data: [productResponse],
      meta: {
        page: DEFAULT_PRODUCT_PAGE,
        limit: DEFAULT_PRODUCT_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        category: { isDeleted: false, divisionId: category.divisionId },
        categoryId: createDto.categoryId,
      },
      skip: 0,
      take: DEFAULT_PRODUCT_PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: productInclude,
    });
  });

  it('updates a product including its category', async () => {
    const nextCategoryId = '44444444-4444-4444-8444-444444444444';
    const updated = {
      ...createdProduct,
      name: 'Updated product',
      categoryId: nextCategoryId,
    };
    prisma.product.findFirst
      .mockResolvedValueOnce(createdProduct)
      .mockResolvedValueOnce(null);
    prisma.category.findFirst.mockResolvedValue({
      ...category,
      id: nextCategoryId,
    });
    prisma.product.update.mockResolvedValue(updated);

    await expect(
      service.update(createdProduct.id, {
        name: 'Updated product',
        categoryId: nextCategoryId,
      }),
    ).resolves.toEqual({ ...updated, sellingPrice: 72 });
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: createdProduct.id },
      data: {
        name: 'Updated product',
        categoryId: nextCategoryId,
      },
      include: productInclude,
    });
  });

  it('replaces an image on update', async () => {
    const existing = {
      ...createdProduct,
      imageUrl: '/uploads/products/old.png',
    };
    const imageUrl = '/uploads/products/new.png';
    const updated = { ...existing, imageUrl };
    prisma.product.findFirst.mockResolvedValueOnce(existing);
    files.saveProductImage.mockResolvedValue(imageUrl);
    prisma.product.update.mockResolvedValue(updated);

    await expect(
      service.update(createdProduct.id, {}, imageFile),
    ).resolves.toEqual({ ...productResponse, imageUrl });
    expect(files.removeIfManaged).toHaveBeenCalledWith(existing.imageUrl);
  });

  it('rejects an empty update payload', async () => {
    await expect(service.update(createdProduct.id, {})).rejects.toThrow(
      new BadRequestException(PRODUCT_UPDATE_EMPTY_MESSAGE),
    );
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(
      service.update(createdProduct.id, { name: 'Updated product' }),
    ).rejects.toThrow(new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE));
  });

  it('soft-deletes a product', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove(createdProduct.id)).resolves.toBeUndefined();
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: {
        id: createdProduct.id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });
  });

  it('returns 404 when deleting a missing product', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(createdProduct.id)).rejects.toThrow(
      new NotFoundException(PRODUCT_NOT_FOUND_MESSAGE),
    );
  });

  it('returns 409 when create hits a unique code constraint', async () => {
    prisma.category.findFirst.mockResolvedValue(category);
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['code'] },
      }),
    );

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
