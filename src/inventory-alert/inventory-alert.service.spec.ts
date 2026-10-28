import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InventoryAlertStatus,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  INVENTORY_ALERT_CREATED,
  INVENTORY_ALERT_DISMISS_MESSAGE,
  INVENTORY_ALERT_NOT_FOUND_MESSAGE,
  INVENTORY_ALERT_RESOLVED,
} from './inventory-alert.constants.js';
import { InventoryAlertService } from './inventory-alert.service.js';

describe('InventoryAlertService', () => {
  let service: InventoryAlertService;
  const productId = '33333333-3333-4333-8333-333333333333';
  const alertId = '66666666-6666-4666-8666-666666666666';
  const emit = vi.fn();
  const prisma = {
    product: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryBatch: {
      aggregate: vi.fn(),
    },
    inventoryAlert: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryAlertService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: { emit } },
      ],
    }).compile();

    service = module.get(InventoryAlertService);
  });

  it('creates one alert when available quantity crosses the reorder level', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 50 });
    prisma.inventoryAlert.findFirst.mockResolvedValue(null);
    prisma.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 40 },
    });
    prisma.inventoryAlert.create.mockResolvedValue({ id: alertId, productId });

    await service.evaluateProduct(productId);

    expect(prisma.inventoryAlert.create).toHaveBeenCalledWith({
      data: {
        productId,
        availableQuantity: 40,
        reorderLevel: 50,
        status: InventoryAlertStatus.OPEN,
        activeProductKey: productId,
      },
    });
    expect(emit).toHaveBeenCalledWith(INVENTORY_ALERT_CREATED, {
      alertId,
      productId,
    });
  });

  it('does not create a second alert while one is already open', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 50 });
    prisma.inventoryAlert.findFirst.mockResolvedValue({
      id: alertId,
      productId,
      status: InventoryAlertStatus.OPEN,
    });
    prisma.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 20 },
    });

    await service.evaluateProduct(productId);

    expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('resolves the alert when stock is no longer low', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 50 });
    prisma.inventoryAlert.findFirst.mockResolvedValue({
      id: alertId,
      productId,
      status: InventoryAlertStatus.READY,
    });
    prisma.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 80 },
    });

    await service.evaluateProduct(productId);

    expect(prisma.inventoryAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: alertId },
        data: expect.objectContaining({
          status: InventoryAlertStatus.RESOLVED,
          activeProductKey: null,
        }),
      }),
    );
    expect(emit).toHaveBeenCalledWith(INVENTORY_ALERT_RESOLVED, {
      alertId,
      productId,
    });
  });

  it('does not alert when the product is out of stock or has no reorder level', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 50 });
    prisma.inventoryAlert.findFirst.mockResolvedValue(null);
    prisma.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 0 },
    });

    await service.evaluateProduct(productId);

    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 0 });
    await service.evaluateProduct(productId);

    expect(prisma.inventoryAlert.create).not.toHaveBeenCalled();
  });

  it('ignores a concurrent alert insert', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: productId, reorderLevel: 50 });
    prisma.inventoryAlert.findFirst.mockResolvedValue(null);
    prisma.inventoryBatch.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 10 },
    });
    prisma.inventoryAlert.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.evaluateProduct(productId)).resolves.toBeUndefined();
  });

  it('rejects dismissing an alert that is already resolved', async () => {
    prisma.inventoryAlert.findFirst.mockResolvedValue({
      id: alertId,
      status: InventoryAlertStatus.RESOLVED,
      product: { isDeleted: false },
    });

    await expect(service.dismiss(alertId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.dismiss(alertId)).rejects.toThrow(
      INVENTORY_ALERT_DISMISS_MESSAGE,
    );
  });

  it('returns not found for an unknown alert', async () => {
    prisma.inventoryAlert.findFirst.mockResolvedValue(null);

    await expect(service.findOne(alertId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOne(alertId)).rejects.toThrow(
      INVENTORY_ALERT_NOT_FOUND_MESSAGE,
    );
  });
});
