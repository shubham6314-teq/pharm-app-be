import { Test, TestingModule } from '@nestjs/testing';
import { DivisionStatus } from '../generated/prisma/client.js';
import { DivisionController } from './division.controller.js';
import { DivisionService } from './division.service.js';
import { CreateDivisionDto } from './dto/create-division.dto.js';

describe('DivisionController', () => {
  let controller: DivisionController;
  let divisionService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  const division = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Cardiology Division',
    code: 'CARD',
    description: null,
    imageUrl: null,
    status: DivisionStatus.ACTIVE,
    isDeleted: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    divisionService = {
      create: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DivisionController],
      providers: [{ provide: DivisionService, useValue: divisionService }],
    }).compile();

    controller = module.get(DivisionController);
  });

  it('creates a division', async () => {
    const dto: CreateDivisionDto = {
      name: 'Cardiology Division',
      code: 'CARD',
    };

    divisionService.create.mockResolvedValue(division);

    await expect(controller.create(dto)).resolves.toEqual(division);
    expect(divisionService.create).toHaveBeenCalledWith(dto, undefined);
  });

  it('creates a division with an image file', async () => {
    const dto: CreateDivisionDto = {
      name: 'Cardiology Division',
      code: 'CARD',
    };
    const image = { originalname: 'card.png' } as Express.Multer.File;
    const created = {
      ...division,
      imageUrl: '/uploads/divisions/card.png',
    };
    divisionService.create.mockResolvedValue(created);

    await expect(controller.create(dto, image)).resolves.toEqual(created);
    expect(divisionService.create).toHaveBeenCalledWith(dto, image);
  });

  it('lists divisions', async () => {
    const query = { page: 1, limit: 10 };
    const result = {
      data: [division],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };
    divisionService.findAll.mockResolvedValue(result);

    await expect(controller.findAll(query)).resolves.toEqual(result);
    expect(divisionService.findAll).toHaveBeenCalledWith(query);
  });

  it('updates a division', async () => {
    const dto = { name: 'Updated Cardiology' };
    const updated = { ...division, name: dto.name };
    divisionService.update.mockResolvedValue(updated);

    await expect(controller.update(division.id, dto)).resolves.toEqual(updated);
    expect(divisionService.update).toHaveBeenCalledWith(
      division.id,
      dto,
      undefined,
    );
  });

  it('deletes a division', async () => {
    divisionService.remove.mockResolvedValue(undefined);

    await expect(controller.remove(division.id)).resolves.toBeUndefined();
    expect(divisionService.remove).toHaveBeenCalledWith(division.id);
  });
});
