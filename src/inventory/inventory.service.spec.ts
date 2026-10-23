import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ContentUnit,
  PackUnit,
  Prisma,
  StockMovementType,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { addUtcDays, startOfInventoryDay } from './inventory-dates.js';
import {
  DEFAULT_EXPIRING_WITHIN_DAYS,
  DEFAULT_INVENTORY_PAGE,
  DEFAULT_INVENTORY_PAGE_SIZE,
  INVENTORY_BATCH_EXISTS_MESSAGE,
  INVENTORY_BATCH_NOT_FOUND_MESSAGE,
  INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE,
  INVENTORY_PRODUCT_NOT_FOUND_MESSAGE,
  StockStatus,
} from './inventory.constants.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
    product: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    inventoryBatch: {
      findUnique: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
    stockMovement: {
      create: ReturnType<typeof vi.fn>;
    };
  };

  const productId = '33333333-3333-4333-8333-333333333333';
  const batchId = '44444444-4444-4444-8444-444444444444';
  const today = startOfInventoryDay();

  const product = {
    id: productId,
    name: 'Crocin',
    code: 'CRO100ML',
    packSize: '100 ML',
    packUnit: PackUnit.BOTTLE,
    contentQuantity: 100,
    contentUnit: ContentUnit.ML,
    reorderLevel: 5,
    mrp: 80,
    category: {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Antipyretics',
      divisionId: '11111111-1111-4111-8111-111111111111',
      division: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'General Medicines',
      },
    },
  };

  const batch = {
    id: batchId,
    productId,
    batchNumber: 'B-1',
    manufacturingDate: new Date('2026-01-01T00:00:00.000Z'),
    expiryDate: addUtcDays(today, 200),
    quantityOnHand: 10,
    purchaseRate: 40,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    product,
  };

  const openingDto: CreateStockMovementDto = {
    productId,
    batchNumber: 'b-1',
    manufacturingDate: '2026-01-01',
    expiryDate: '2027-01-01',
    purchaseRate: 40,
    type: StockMovementType.OPENING,
    quantity: 10,
    note: 'Opening count',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      product: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      inventoryBatch: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      stockMovement: {
        create: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it('records opening stock as a new batch', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryBatch.findUnique.mockResolvedValue(null);
    prisma.inventoryBatch.create.mockResolvedValue(batch);
    prisma.inventoryBatch.groupBy.mockResolvedValue([
      { productId, _sum: { quantityOnHand: 10 } },
    ]);

    const result = await service.createMovement(openingDto);

    expect(result.batchNumber).toBe('B-1');
    expect(result.quantityOnHand).toBe(10);
    expect(result.status).toBe(StockStatus.IN_STOCK);
    expect(result.product.availableQuantity).toBe(10);
    expect(prisma.inventoryBatch.create).toHaveBeenCalledWith({
      data: {
        productId,
        batchNumber: 'B-1',
        manufacturingDate: new Date('2026-01-01T00:00:00.000Z'),
        expiryDate: new Date('2027-01-01T00:00:00.000Z'),
        quantityOnHand: 10,
        purchaseRate: 40,
        movements: {
          create: {
            type: StockMovementType.OPENING,
            quantity: 10,
            note: 'Opening count',
          },
        },
      },
      include: expect.any(Object),
    });
  });

  it('reduces an existing batch on a sale', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryBatch.findUnique.mockResolvedValue(batch);
    prisma.inventoryBatch.updateMany.mockResolvedValue({ count: 1 });
    prisma.inventoryBatch.findUniqueOrThrow.mockResolvedValue({
      ...batch,
      quantityOnHand: 8,
    });
    prisma.inventoryBatch.groupBy.mockResolvedValue([
      { productId, _sum: { quantityOnHand: 8 } },
    ]);

    const result = await service.createMovement({
      productId,
      batchNumber: 'B-1',
      type: StockMovementType.SALE,
      quantity: 2,
    });

    expect(result.quantityOnHand).toBe(8);
    expect(prisma.inventoryBatch.updateMany).toHaveBeenCalledWith({
      where: { id: batchId, quantityOnHand: { gte: 2 } },
      data: { quantityOnHand: { increment: -2 } },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        inventoryBatchId: batchId,
        type: StockMovementType.SALE,
        quantity: -2,
        note: undefined,
      },
    });
  });

  it('rejects a sale that would take the batch below zero', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryBatch.findUnique.mockResolvedValue({
      ...batch,
      quantityOnHand: 1,
    });

    await expect(
      service.createMovement({
        productId,
        batchNumber: 'B-1',
        type: StockMovementType.SALE,
        quantity: 2,
      }),
    ).rejects.toThrow(
      new BadRequestException(INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE),
    );
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects opening stock for a batch that already exists', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryBatch.findUnique.mockResolvedValue(batch);

    await expect(service.createMovement(openingDto)).rejects.toThrow(
      new ConflictException(INVENTORY_BATCH_EXISTS_MESSAGE),
    );
  });

  it('returns 404 when the product is missing', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.createMovement(openingDto)).rejects.toThrow(
      new NotFoundException(INVENTORY_PRODUCT_NOT_FOUND_MESSAGE),
    );
  });

  it('lists batches with near-expiry filtering', async () => {
    const expiringUntil = addUtcDays(today, DEFAULT_EXPIRING_WITHIN_DAYS);
    prisma.inventoryBatch.findMany.mockResolvedValue([
      { ...batch, expiryDate: addUtcDays(today, 10), quantityOnHand: 4 },
    ]);
    prisma.inventoryBatch.count.mockResolvedValue(1);
    prisma.inventoryBatch.groupBy.mockResolvedValue([
      { productId, _sum: { quantityOnHand: 4 } },
    ]);

    const result = await service.findAll({ status: StockStatus.EXPIRING });

    expect(result.data[0]?.status).toBe(StockStatus.EXPIRING);
    expect(result.meta).toEqual({
      page: DEFAULT_INVENTORY_PAGE,
      limit: DEFAULT_INVENTORY_PAGE_SIZE,
      total: 1,
      totalPages: 1,
    });
    expect(prisma.inventoryBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              product: {
                isDeleted: false,
                category: { isDeleted: false },
              },
            },
            {
              quantityOnHand: { gt: 0 },
              expiryDate: { gte: today, lte: expiringUntil },
            },
          ],
        },
      }),
    );
  });

  it('returns a batch with its movements', async () => {
    const movement = {
      id: '55555555-5555-4555-8555-555555555555',
      type: StockMovementType.OPENING,
      quantity: 10,
      note: null,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    prisma.inventoryBatch.findFirst.mockResolvedValue({
      ...batch,
      movements: [movement],
    });

    await expect(service.findOne(batchId)).resolves.toMatchObject({
      id: batchId,
      movements: [movement],
    });
  });

  it('returns 404 when the batch is missing', async () => {
    prisma.inventoryBatch.findFirst.mockResolvedValue(null);

    await expect(service.findOne(batchId)).rejects.toThrow(
      new NotFoundException(INVENTORY_BATCH_NOT_FOUND_MESSAGE),
    );
  });

  it('maps a unique batch constraint to a conflict', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId });
    prisma.inventoryBatch.findUnique.mockResolvedValue(null);
    prisma.inventoryBatch.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['productId', 'batchNumber'] },
      }),
    );

    await expect(service.createMovement(openingDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
