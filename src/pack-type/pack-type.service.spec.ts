import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PackTypeStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePackTypeDto } from './dto/create-pack-type.dto.js';
import {
  DEFAULT_PACK_TYPE_PAGE,
  DEFAULT_PACK_TYPE_PAGE_SIZE,
  PACK_TYPE_HAS_PRODUCTS_MESSAGE,
  PACK_TYPE_NOT_FOUND_MESSAGE,
  PACK_TYPE_UPDATE_EMPTY_MESSAGE,
} from './pack-type.constants.js';
import { PackTypeService } from './pack-type.service.js';

describe('PackTypeService', () => {
  let service: PackTypeService;
  let prisma: {
    packType: {
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

  const createDto: CreatePackTypeDto = {
    name: 'Blister',
    code: 'BLISTER',
    singularLabel: 'blister',
    pluralLabel: 'blisters',
    sortOrder: 15,
  };

  const created = {
    id: 'aaaaaaaa-0001-4000-8000-0000000000ff',
    name: createDto.name,
    code: createDto.code,
    singularLabel: createDto.singularLabel,
    pluralLabel: createDto.pluralLabel,
    sortOrder: createDto.sortOrder,
    status: PackTypeStatus.ACTIVE,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      packType: {
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
        PackTypeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PackTypeService);
  });

  it('creates a pack type', async () => {
    prisma.packType.findFirst.mockResolvedValue(null);
    prisma.packType.create.mockResolvedValue(created);

    await expect(service.create(createDto)).resolves.toEqual(created);
    expect(prisma.packType.create).toHaveBeenCalledWith({
      data: {
        name: createDto.name,
        code: createDto.code,
        singularLabel: createDto.singularLabel,
        pluralLabel: createDto.pluralLabel,
        sortOrder: createDto.sortOrder,
      },
    });
  });

  it('returns 409 when the name already exists', async () => {
    prisma.packType.findFirst.mockResolvedValue(created);

    await expect(service.create(createDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.packType.create).not.toHaveBeenCalled();
  });

  it('lists pack types in sort order', async () => {
    prisma.packType.findMany.mockResolvedValue([created]);
    prisma.packType.count.mockResolvedValue(1);

    await expect(service.findAll({})).resolves.toEqual({
      data: [created],
      meta: {
        page: DEFAULT_PACK_TYPE_PAGE,
        limit: DEFAULT_PACK_TYPE_PAGE_SIZE,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prisma.packType.findMany).toHaveBeenCalledWith({
      where: { isDeleted: false },
      skip: 0,
      take: DEFAULT_PACK_TYPE_PAGE_SIZE,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('rejects an empty update', async () => {
    await expect(service.update(created.id, {})).rejects.toThrow(
      new BadRequestException(PACK_TYPE_UPDATE_EMPTY_MESSAGE),
    );
  });

  it('blocks delete when products still use the pack type', async () => {
    prisma.product.count.mockResolvedValue(2);

    await expect(service.remove(created.id)).rejects.toThrow(
      new ConflictException(PACK_TYPE_HAS_PRODUCTS_MESSAGE),
    );
    expect(prisma.packType.updateMany).not.toHaveBeenCalled();
  });

  it('soft-deletes an unused pack type', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.packType.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.remove(created.id)).resolves.toBeUndefined();
  });

  it('returns 404 when deleting a missing pack type', async () => {
    prisma.product.count.mockResolvedValue(0);
    prisma.packType.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.remove(created.id)).rejects.toThrow(
      new NotFoundException(PACK_TYPE_NOT_FOUND_MESSAGE),
    );
  });
});
