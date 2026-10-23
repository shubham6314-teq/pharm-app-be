import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ContentUnitStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentUnitService } from './content-unit.service.js';
import {
  CONTENT_UNIT_HAS_PRODUCTS_MESSAGE,
  CONTENT_UNIT_NOT_FOUND_MESSAGE,
} from './content-unit.constants.js';

describe('ContentUnitService', () => {
  let service: ContentUnitService;
  let prisma: {
    contentUnit: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    product: {
      count: ReturnType<typeof vi.fn>;
    };
  };

  const created = {
    id: 'bbbbbbbb-0001-4000-8000-000000000003',
    name: 'Millilitre',
    code: 'ML',
    singularLabel: 'ml',
    pluralLabel: 'ml',
    sortOrder: 30,
    status: ContentUnitStatus.ACTIVE,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      contentUnit: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      product: {
        count: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentUnitService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(ContentUnitService);
  });

  it('creates a content unit', async () => {
    prisma.contentUnit.findFirst.mockResolvedValue(null);
    prisma.contentUnit.create.mockResolvedValue(created);

    await expect(
      service.create({
        name: 'Millilitre',
        code: 'ML',
        singularLabel: 'ml',
        pluralLabel: 'ml',
        sortOrder: 30,
      }),
    ).resolves.toEqual(created);
  });

  it('blocks delete when products still use the content unit', async () => {
    prisma.product.count.mockResolvedValue(1);

    await expect(service.remove(created.id)).rejects.toThrow(
      new ConflictException(CONTENT_UNIT_HAS_PRODUCTS_MESSAGE),
    );
  });

  it('returns 404 when deleting a missing content unit', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.contentUnit.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(created.id)).rejects.toThrow(
      new NotFoundException(CONTENT_UNIT_NOT_FOUND_MESSAGE),
    );
  });
});
