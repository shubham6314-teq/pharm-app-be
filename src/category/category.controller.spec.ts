import { Test, TestingModule } from '@nestjs/testing';
import { CategoryStatus } from '../generated/prisma/client.js';
import { CategoryController } from './category.controller.js';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

describe('CategoryController', () => {
  let controller: CategoryController;
  let categoryService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const category = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Antihypertensives',
    code: 'ANTIHTN',
    description: null,
    imageUrl: null,
    status: CategoryStatus.ACTIVE,
    isDeleted: false,
    divisionId: '11111111-1111-4111-8111-111111111111',
    division: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Cardiology Division',
      code: 'CARD',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    categoryService = {
      create: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: categoryService }],
    }).compile();

    controller = module.get(CategoryController);
  });

  it('creates a category', async () => {
    const dto: CreateCategoryDto = {
      name: 'Antihypertensives',
      code: 'ANTIHTN',
      divisionId: category.divisionId,
    };

    categoryService.create.mockResolvedValue(category);

    await expect(controller.create(dto)).resolves.toEqual(category);
    expect(categoryService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('creates a category with an image file', async () => {
    const dto: CreateCategoryDto = {
      name: 'Antihypertensives',
      code: 'ANTIHTN',
      divisionId: category.divisionId,
    };
    const image = { originalname: 'antihtn.png' } as Express.Multer.File;
    const created = {
      ...category,
      imageUrl: '/uploads/categories/antihtn.png',
    };
    categoryService.create.mockResolvedValue(created);

    await expect(controller.create(dto, image)).resolves.toEqual(created);
    expect(categoryService.create).toHaveBeenCalledWith(dto, image);
  });

  it('lists categories', async () => {
    const query = { page: 1, limit: 10, divisionId: category.divisionId };
    const result = {
      data: [category],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    categoryService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(query)).resolves.toEqual(result);
    expect(categoryService.findAll).toHaveBeenCalledWith(query);
  });

  it('updates a category', async () => {
    const dto = { name: 'Updated category' };
    const updated = { ...category, name: dto.name };
    categoryService.update.mockResolvedValue(updated);

    await expect(controller.update(category.id, dto)).resolves.toEqual(updated);
    expect(categoryService.update).toHaveBeenCalledWith(
      category.id,
      dto,
      undefined,
    );
  });

  it('deletes a category', async () => {
    categoryService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(category.id)).resolves.toBeUndefined();
    expect(categoryService.remove).toHaveBeenCalledWith(category.id);
  });
});
