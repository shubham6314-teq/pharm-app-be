import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, StockMovementType } from '../generated/prisma/client.js';
import { InventoryAlertService } from '../inventory-alert/inventory-alert.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { addUtcDays, startOfInventoryDay } from './inventory-dates.js';
import {
  DEFAULT_EXPIRING_WITHIN_DAYS,
  DEFAULT_INVENTORY_PAGE,
  DEFAULT_INVENTORY_PAGE_SIZE,
  INVENTORY_BATCH_EXISTS_MESSAGE,
  INVENTORY_BATCH_NOT_FOUND_MESSAGE,
  INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE,
  INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE,
  INVENTORY_PRODUCT_NOT_FOUND_MESSAGE,
  INVENTORY_UPDATE_EMPTY_MESSAGE,
  StockStatus,
} from './inventory.constants.js';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let evaluateProduct: ReturnType<typeof vi.fn>;
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
      update: ReturnType<typeof vi.fn>;
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
    packType: {
      id: 'aaaaaaaa-0001-4000-8000-000000000002',
      name: 'Bottle',
      code: 'BOTTLE',
      singularLabel: 'bottle',
      pluralLabel: 'bottles',
    },
    contentQuantity: 100,
    contentUnit: {
      id: 'bbbbbbbb-0001-4000-8000-000000000003',
      name: 'Millilitre',
      code: 'ML',
      singularLabel: 'ml',
      pluralLabel: 'ml',
    },
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
        update: vi.fn(),
        updateMany: vi.fn(),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      stockMovement: {
        create: vi.fn(),
      },
    };

    evaluateProduct = vi.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: InventoryAlertService,
          useValue: { evaluateProduct },
        },
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
    expect(evaluateProduct).toHaveBeenCalledWith(productId);
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

  it('updates batch details without changing quantity', async () => {
    const updatedBatch = {
      ...batch,
      batchNumber: 'B-2',
      expiryDate: new Date('2027-06-01T00:00:00.000Z'),
      purchaseRate: 45.5,
      movements: [],
    };
    prisma.inventoryBatch.findFirst
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce(updatedBatch);
    prisma.inventoryBatch.update.mockResolvedValue(updatedBatch);
    prisma.inventoryBatch.groupBy.mockResolvedValue([
      { productId, _sum: { quantityOnHand: 10 } },
    ]);

    const result = await service.update(batchId, {
      batchNumber: 'b-2',
      expiryDate: '2027-06-01',
      purchaseRate: 45.5,
    });

    expect(result.batchNumber).toBe('B-2');
    expect(result.expiryDate).toBe('2027-06-01');
    expect(result.purchaseRate).toBe(45.5);
    expect(result.quantityOnHand).toBe(10);
    expect(prisma.inventoryBatch.update).toHaveBeenCalledWith({
      where: { id: batchId },
      data: {
        batchNumber: 'B-2',
        expiryDate: new Date('2027-06-01T00:00:00.000Z'),
        purchaseRate: 45.5,
      },
    });
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('records a correction note without changing on-hand quantity', async () => {
    const movement = {
      id: '55555555-5555-4555-8555-555555555555',
      type: StockMovementType.ADJUSTMENT,
      quantity: 0,
      note: 'Corrected expiry',
      createdAt: new Date('2026-01-03T00:00:00.000Z'),
    };
    prisma.inventoryBatch.findFirst
      .mockResolvedValueOnce(batch)
      .mockResolvedValueOnce({
        ...batch,
        expiryDate: new Date('2027-06-01T00:00:00.000Z'),
        movements: [movement],
      });
    prisma.inventoryBatch.groupBy.mockResolvedValue([
      { productId, _sum: { quantityOnHand: 10 } },
    ]);

    const result = await service.update(batchId, {
      expiryDate: '2027-06-01',
      note: 'Corrected expiry',
    });

    expect(result.quantityOnHand).toBe(10);
    expect(result.movements).toEqual([movement]);
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        inventoryBatchId: batchId,
        type: StockMovementType.ADJUSTMENT,
        quantity: 0,
        note: 'Corrected expiry',
      },
    });
  });

  it('rejects an empty inventory update', async () => {
    await expect(service.update(batchId, {})).rejects.toThrow(
      new BadRequestException(INVENTORY_UPDATE_EMPTY_MESSAGE),
    );
    expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it('rejects a note-only inventory update', async () => {
    await expect(
      service.update(batchId, { note: 'Forgot the date' }),
    ).rejects.toThrow(new BadRequestException(INVENTORY_UPDATE_EMPTY_MESSAGE));
    expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it('rejects an expiry date before manufacturing date', async () => {
    prisma.inventoryBatch.findFirst.mockResolvedValue(batch);

    await expect(
      service.update(batchId, { expiryDate: '2025-01-01' }),
    ).rejects.toThrow(
      new BadRequestException(INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE),
    );
    expect(prisma.inventoryBatch.update).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a missing batch', async () => {
    prisma.inventoryBatch.findFirst.mockResolvedValue(null);

    await expect(
      service.update(batchId, { expiryDate: '2027-06-01' }),
    ).rejects.toThrow(new NotFoundException(INVENTORY_BATCH_NOT_FOUND_MESSAGE));
  });

  it('maps a unique batch number on update to a conflict', async () => {
    prisma.inventoryBatch.findFirst.mockResolvedValue(batch);
    prisma.inventoryBatch.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['productId', 'batchNumber'] },
      }),
    );

    await expect(
      service.update(batchId, { batchNumber: 'B-EXISTS' }),
    ).rejects.toBeInstanceOf(ConflictException);
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
