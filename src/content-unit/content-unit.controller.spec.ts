import { Test, TestingModule } from '@nestjs/testing';
import { ContentUnitController } from './content-unit.controller.js';
import { ContentUnitService } from './content-unit.service.js';

describe('ContentUnitController', () => {
  let controller: ContentUnitController;
  let contentUnitService: {
    create: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    contentUnitService = {
      create: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentUnitController],
      providers: [{ provide: ContentUnitService, useValue: contentUnitService }],
    }).compile();

    controller = module.get(ContentUnitController);
  });

  it('lists content units', async () => {
    const page = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    contentUnitService.findAll.mockResolvedValue(page);

    await expect(controller.findAll({})).resolves.toEqual(page);
  });
});
