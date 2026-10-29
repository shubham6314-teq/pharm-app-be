import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  InventoryAlertStatus,
  Prisma,
  RecommendationStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RecommendationDecision } from './dto/update-recommendation.dto.js';
import {
  INVENTORY_ALERT_CREATED,
  INVENTORY_ALERT_DISMISS_MESSAGE,
  INVENTORY_ALERT_NOT_FOUND_MESSAGE,
  INVENTORY_ALERT_RECOMMENDATION_MESSAGE,
  INVENTORY_ALERT_RECOMMENDATION_QUANTITY_MESSAGE,
  INVENTORY_ALERT_RESOLVED,
} from './inventory-alert.constants.js';
import { InventoryAlertService } from './inventory-alert.service.js';

describe('InventoryAlertService', () => {
  let service: InventoryAlertService;
  const productId = '33333333-3333-4333-8333-333333333333';
  const alertId = '66666666-6666-4666-8666-666666666666';
  const emit = vi.fn();
  const userId = '77777777-7777-4777-8777-777777777777';
  const analysisId = '88888888-8888-4888-8888-888888888888';
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
    inventoryAnalysis: {
      update: vi.fn(),
    },
    stockMovement: {
      create: vi.fn(),
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

  it('approves a pending recommendation without creating a stock movement', async () => {
    const pending = {
      id: alertId,
      status: InventoryAlertStatus.READY,
      product: { isDeleted: false },
      analysis: {
        id: analysisId,
        recommendedQuantity: 10,
        recommendationStatus: RecommendationStatus.PENDING,
      },
    };
    const approved = {
      ...pending,
      analysis: {
        ...pending.analysis,
        recommendationStatus: RecommendationStatus.APPROVED,
        decidedQuantity: 8,
      },
    };
    prisma.inventoryAlert.findFirst
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(approved);
    prisma.inventoryAnalysis.update.mockResolvedValue(approved.analysis);

    await expect(
      service.decideRecommendation(alertId, userId, {
        decision: RecommendationDecision.APPROVE,
        quantity: 8,
      }),
    ).resolves.toEqual(approved);
    expect(prisma.inventoryAnalysis.update).toHaveBeenCalledWith({
      where: { id: analysisId },
      data: expect.objectContaining({
        recommendationStatus: RecommendationStatus.APPROVED,
        decidedQuantity: 8,
        decidedById: userId,
      }),
    });
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects approving when recommended quantity is missing', async () => {
    prisma.inventoryAlert.findFirst.mockResolvedValue({
      id: alertId,
      status: InventoryAlertStatus.READY,
      product: { isDeleted: false },
      analysis: {
        id: analysisId,
        recommendedQuantity: null,
        recommendationStatus: RecommendationStatus.PENDING,
      },
    });

    await expect(
      service.decideRecommendation(alertId, userId, {
        decision: RecommendationDecision.APPROVE,
      }),
    ).rejects.toThrow(INVENTORY_ALERT_RECOMMENDATION_QUANTITY_MESSAGE);
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a pending recommendation without creating a stock movement', async () => {
    const pending = {
      id: alertId,
      status: InventoryAlertStatus.READY,
      product: { isDeleted: false },
      analysis: {
        id: analysisId,
        recommendedQuantity: 10,
        recommendationStatus: RecommendationStatus.PENDING,
      },
    };
    const rejected = {
      ...pending,
      analysis: {
        ...pending.analysis,
        recommendationStatus: RecommendationStatus.REJECTED,
        decidedQuantity: null,
      },
    };
    prisma.inventoryAlert.findFirst
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(rejected);
    prisma.inventoryAnalysis.update.mockResolvedValue(rejected.analysis);

    await expect(
      service.decideRecommendation(alertId, userId, {
        decision: RecommendationDecision.REJECT,
      }),
    ).resolves.toEqual(rejected);
    expect(prisma.inventoryAnalysis.update).toHaveBeenCalledWith({
      where: { id: analysisId },
      data: expect.objectContaining({
        recommendationStatus: RecommendationStatus.REJECTED,
        decidedQuantity: null,
        decidedById: userId,
      }),
    });
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('does not allow approving a rejected recommendation', async () => {
    prisma.inventoryAlert.findFirst.mockResolvedValue({
      id: alertId,
      status: InventoryAlertStatus.READY,
      product: { isDeleted: false },
      analysis: {
        id: analysisId,
        recommendedQuantity: 10,
        recommendationStatus: RecommendationStatus.REJECTED,
      },
    });

    await expect(
      service.decideRecommendation(alertId, userId, {
        decision: RecommendationDecision.APPROVE,
        quantity: 10,
      }),
    ).rejects.toThrow(INVENTORY_ALERT_RECOMMENDATION_MESSAGE);
    expect(prisma.inventoryAnalysis.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });
});
