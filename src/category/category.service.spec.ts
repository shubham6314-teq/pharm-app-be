import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LocalFileStorageService } from '../storage/local-file-storage.service.js';
import {
  CATEGORY_DIVISION_NOT_FOUND_MESSAGE,
  CATEGORY_NOT_FOUND_MESSAGE,
  CATEGORY_UPDATE_EMPTY_MESSAGE,
  DEFAULT_CATEGORY_PAGE,
  DEFAULT_CATEGORY_PAGE_SIZE,
} from './category.constants.js';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

describe('CategoryService', () => {
  let service: CategoryService;
  let prisma: {
    category: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    division: {
      findFirst: ReturnType<typeof vi.fn>;
    };
    product: {
      count: ReturnType<typeof vi.fn>;
    };
  };
  let files: {
    saveCategoryImage: ReturnType<typeof vi.fn>;
    removeIfManaged: ReturnType<typeof vi.fn>;
  };

  const createDto: CreateCategoryDto = {
    name: 'Antihypertensives',
    code: 'ANTIHTN',
    description: 'Blood pressure medicines',
    divisionId: '11111111-1111-4111-8111-111111111111',
  };

  const division = {
    id: createDto.divisionId,
    name: 'Cardiology Division',
    code: 'CARD',
  };

  const createdCategory = {
    id: '22222222-2222-4222-8222-222222222222',
    name: createDto.name,
    code: createDto.code,
    description: createDto.description,
    imageUrl: null as string | null,
    status: CategoryStatus.ACTIVE,
    isDeleted: false,
    divisionId: createDto.divisionId,
    division,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const imageFile = {
    originalname: 'antihtn.png',
    mimetype: 'image/png',
    buffer: Buffer.from('png'),
    size: 3,
  } as Express.Multer.File;

  const categoryInclude = {
    division: {
      select: {
        id: true,
        name: true,
        code: true,
      },
    },
  };

  beforeEach(async () => {
    prisma = {
      category: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      division: {
        findFirst: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    };
    files = {
      saveCategoryImage: vi.fn(),
      removeIfManaged: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: LocalFileStorageService, useValue: files },
      ],
    }).compile();

    service = module.get(CategoryService);
  });

  it('creates a category successfully', async () => {
    prisma.division.findFirst.mockResolvedValue(division);
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue(createdCategory);

    await expect(service.create(createDto)).resolves.toEqual(createdCategory);
    expect(files.saveCategoryImage).not.toHaveBeenCalled();
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        name: createDto.name,
        code: createDto.code,
        description: createDto.description,
        divisionId: createDto.divisionId,
        imageUrl: undefined,
      },
      include: categoryInclude,
    });
  });

  it('creates a category with an uploaded image', async () => {
    const imageUrl = '/uploads/categories/antihtn.png';
    const withImage = { ...createdCategory, imageUrl };
    prisma.division.findFirst.mockResolvedValue(division);
    prisma.category.findFirst.mockResolvedValue(null);
    files.saveCategoryImage.mockResolvedValue(imageUrl);
    prisma.category.create.mockResolvedValue(withImage);

    await expect(service.create(createDto, imageFile)).resolves.toEqual(
      withImage,
    );
    expect(files.saveCategoryImage).toHaveBeenCalledWith(imageFile);
  });

  it('returns 400 when the selected division is missing', async () => {
    prisma.division.findFirst.mockResolvedValue(null);

    await expect(service.create(createDto)).rejects.toThrow(
      new BadRequestException(CATEGORY_DIVISION_NOT_FOUND_MESSAGE),
    );
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('returns 409 when the category name already exists in the division', async () => {
    prisma.division.findFirst.mockResolvedValue(division);
    prisma.category.findFirst.mockResolvedValue({
      ...createdCategory,
      code: 'OTHER',
    });

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('lists categories with default pagination', async () => {
    prisma.category.findMany.mockResolvedValue([createdCategory]);
    prisma.category.count.mockResolvedValue(1);

    await expect(service.findAll({})).resolves.toEqual({
      data: [createdCategory],
      meta: {
        page: DEFAULT_CATEGORY_PAGE,
        limit: DEFAULT_CATEGORY_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      skip: 0,
      take: DEFAULT_CATEGORY_PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: categoryInclude,
    });
  });

  it('lists categories filtered by division', async () => {
    prisma.category.findMany.mockResolvedValue([createdCategory]);
    prisma.category.count.mockResolvedValue(1);

    await expect(
      service.findAll({ divisionId: createDto.divisionId }),
    ).resolves.toEqual({
      data: [createdCategory],
      meta: {
        page: DEFAULT_CATEGORY_PAGE,
        limit: DEFAULT_CATEGORY_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false, divisionId: createDto.divisionId },
      skip: 0,
      take: DEFAULT_CATEGORY_PAGE_SIZE,
      orderBy: { createdAt: 'desc' },
      include: categoryInclude,
    });
  });

  it('updates a category including its division', async () => {
    const nextDivisionId = '33333333-3333-4333-8333-333333333333';
    const updated = {
      ...createdCategory,
      name: 'Updated category',
      divisionId: nextDivisionId,
    };
    prisma.category.findFirst
      .mockResolvedValueOnce(createdCategory)
      .mockResolvedValueOnce(null);
    prisma.division.findFirst.mockResolvedValue({
      id: nextDivisionId,
      name: 'Neurology Division',
      code: 'NEURO',
    });
    prisma.category.update.mockResolvedValue(updated);

    await expect(
      service.update(createdCategory.id, {
        name: 'Updated category',
        divisionId: nextDivisionId,
      }),
    ).resolves.toEqual(updated);
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: createdCategory.id },
      data: {
        name: 'Updated category',
        divisionId: nextDivisionId,
      },
      include: categoryInclude,
    });
  });

  it('replaces an image on update', async () => {
    const existing = {
      ...createdCategory,
      imageUrl: '/uploads/categories/old.png',
    };
    const imageUrl = '/uploads/categories/new.png';
    const updated = { ...existing, imageUrl };
    prisma.category.findFirst.mockResolvedValueOnce(existing);
    files.saveCategoryImage.mockResolvedValue(imageUrl);
    prisma.category.update.mockResolvedValue(updated);

    await expect(
      service.update(createdCategory.id, {}, imageFile),
    ).resolves.toEqual(updated);
    expect(files.removeIfManaged).toHaveBeenCalledWith(existing.imageUrl);
  });

  it('rejects an empty update payload', async () => {
    await expect(service.update(createdCategory.id, {})).rejects.toThrow(
      new BadRequestException(CATEGORY_UPDATE_EMPTY_MESSAGE),
    );
    expect(prisma.category.update).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing category', async () => {
    prisma.category.findFirst.mockResolvedValue(null);

    await expect(
      service.update(createdCategory.id, { name: 'Updated category' }),
    ).rejects.toThrow(new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE));
  });

  it('soft-deletes a category', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.category.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove(createdCategory.id)).resolves.toBeUndefined();
    expect(prisma.product.count).toHaveBeenCalledWith({
      where: {
        categoryId: createdCategory.id,
        isDeleted: false,
      },
    });
    expect(prisma.category.updateMany).toHaveBeenCalledWith({
      where: {
        id: createdCategory.id,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });
  });

  it('returns 404 when deleting a missing category', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.category.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(createdCategory.id)).rejects.toThrow(
      new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE),
    );
  });

  it('returns 409 when deleting a category that has products', async () => {
    prisma.product.count.mockResolvedValue(2);

    await expect(service.remove(createdCategory.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.category.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 when create hits a unique name constraint', async () => {
    prisma.division.findFirst.mockResolvedValue(division);
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['divisionId', 'name'] },
      }),
    );

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
