import { Test, TestingModule } from '@nestjs/testing';
import { PackTypeStatus } from '../generated/prisma/client.js';
import { CreatePackTypeDto } from './dto/create-pack-type.dto.js';
import { PackTypeController } from './pack-type.controller.js';
import { PackTypeService } from './pack-type.service.js';

describe('PackTypeController', () => {
  let controller: PackTypeController;
  let packTypeService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const packType = {
    id: 'aaaaaaaa-0001-4000-8000-000000000002',
    name: 'Bottle',
    code: 'BOTTLE',
    singularLabel: 'bottle',
    pluralLabel: 'bottles',
    sortOrder: 20,
    status: PackTypeStatus.ACTIVE,
  };

  beforeEach(async () => {
    packTypeService = {
      create: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackTypeController],
      providers: [{ provide: PackTypeService, useValue: packTypeService }],
    }).compile();

    controller = module.get(PackTypeController);
  });

  it('creates a pack type', async () => {
    const dto: CreatePackTypeDto = {
      name: 'Bottle',
      code: 'BOTTLE',
      singularLabel: 'bottle',
      pluralLabel: 'bottles',
    };
    packTypeService.create.mockResolvedValue(packType);

    await expect(controller.create(dto)).resolves.toEqual(packType);
  });

  it('lists pack types', async () => {
    const page = { data: [packType], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } };
    packTypeService.findAll.mockResolvedValue(page);

    await expect(controller.findAll({})).resolves.toEqual(page);
  });

  it('updates a pack type', async () => {
    packTypeService.update.mockResolvedValue({ ...packType, name: 'Bottles' });

    await expect(
      controller.update(packType.id, { name: 'Bottles' }),
    ).resolves.toMatchObject({ name: 'Bottles' });
  });

  it('deletes a pack type', async () => {
    packTypeService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(packType.id)).resolves.toBeUndefined();
  });
});
