import { Test, TestingModule } from '@nestjs/testing';
import { StockMovementType } from '../generated/prisma/client.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { InventoryController } from './inventory.controller.js';
import { StockStatus } from './inventory.constants.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: {
    createMovement: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    inventoryService = {
      createMovement: vi.fn(),
      findAll: vi.fn(),
      findOne: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: inventoryService }],
    }).compile();

    controller = module.get(InventoryController);
  });

  it('records a stock movement', async () => {
    const dto: CreateStockMovementDto = {
      productId: '33333333-3333-4333-8333-333333333333',
      batchNumber: 'B-1',
      type: StockMovementType.SALE,
      quantity: 2,
    };
    const created = { id: '44444444-4444-4444-8444-444444444444' };
    inventoryService.createMovement.mockResolvedValue(created);

    await expect(controller.createMovement(dto)).resolves.toEqual(created);
    expect(inventoryService.createMovement).toHaveBeenCalledWith(dto);
  });

  it('lists inventory', async () => {
    const query = { status: StockStatus.LOW };
    const page = { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } };
    inventoryService.findAll.mockResolvedValue(page);

    await expect(controller.findAll(query)).resolves.toEqual(page);
  });

  it('returns one batch', async () => {
    const batch = { id: '44444444-4444-4444-8444-444444444444' };
    inventoryService.findOne.mockResolvedValue(batch);

    await expect(controller.findOne(batch.id)).resolves.toEqual(batch);
  });
});
