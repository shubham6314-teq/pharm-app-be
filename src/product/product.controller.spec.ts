import { Test, TestingModule } from '@nestjs/testing';
import { ProductStatus } from '../generated/prisma/client.js';
import { ProductController } from './product.controller.js';
import { ProductService } from './product.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';

describe('ProductController', () => {
  let controller: ProductController;
  let productService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const product = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Crocin',
    code: 'CRO100ML',
    description: null,
    imageUrl: null,
    brandName: 'GSK',
    composition: 'Paracetamol 125 mg/5 ml',
    packSize: '100 ML',
    mrp: 80,
    discountPercent: 10,
    sellingPrice: 72,
    status: ProductStatus.ACTIVE,
    isDeleted: false,
    categoryId: '22222222-2222-4222-8222-222222222222',
    category: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Antipyretics',
      code: 'ANTIPYR',
      divisionId: '11111111-1111-4111-8111-111111111111',
      division: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'General Medicines',
        code: 'GEN',
      },
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    productService = {
      create: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: productService }],
    }).compile();

    controller = module.get(ProductController);
  });

  it('creates a product', async () => {
    const dto: CreateProductDto = {
      name: 'Crocin',
      code: 'CRO100ML',
      brandName: 'GSK',
      composition: 'Paracetamol 125 mg/5 ml',
      packSize: '100 ML',
      packTypeId: 'aaaaaaaa-0001-4000-8000-000000000002',
      contentQuantity: 100,
      contentUnitId: 'bbbbbbbb-0001-4000-8000-000000000003',
      mrp: 80,
      categoryId: product.categoryId,
    };

    productService.create.mockResolvedValue(product);

    await expect(controller.create(dto)).resolves.toEqual(product);
    expect(productService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('creates a product with an image file', async () => {
    const dto: CreateProductDto = {
      name: 'Crocin',
      code: 'CRO100ML',
      brandName: 'GSK',
      composition: 'Paracetamol 125 mg/5 ml',
      packSize: '100 ML',
      packTypeId: 'aaaaaaaa-0001-4000-8000-000000000002',
      contentQuantity: 100,
      contentUnitId: 'bbbbbbbb-0001-4000-8000-000000000003',
      mrp: 80,
      categoryId: product.categoryId,
    };
    const image = { originalname: 'crocin.png' } as Express.Multer.File;
    const created = {
      ...product,
      imageUrl: '/uploads/products/crocin.png',
    };
    productService.create.mockResolvedValue(created);

    await expect(controller.create(dto, image)).resolves.toEqual(created);
    expect(productService.create).toHaveBeenCalledWith(dto, image);
  });

  it('lists products', async () => {
    const query = { page: 1, limit: 10, categoryId: product.categoryId };
    const result = {
      data: [product],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    productService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(query)).resolves.toEqual(result);
    expect(productService.findAll).toHaveBeenCalledWith(query);
  });

  it('updates a product', async () => {
    const dto = { name: 'Updated product' };
    const updated = { ...product, name: dto.name };
    productService.update.mockResolvedValue(updated);

    await expect(controller.update(product.id, dto)).resolves.toEqual(updated);
    expect(productService.update).toHaveBeenCalledWith(
      product.id,
      dto,
      undefined,
    );
  });

  it('deletes a product', async () => {
    productService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(product.id)).resolves.toBeUndefined();
    expect(productService.remove).toHaveBeenCalledWith(product.id);
  });
});
