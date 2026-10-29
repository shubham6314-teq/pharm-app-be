import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  InventoryAlertStatus,
  Prisma,
  RecommendationStatus,
} from '../generated/prisma/client.js';
import { startOfInventoryDay } from '../inventory/inventory-dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ListInventoryAlertsQueryDto } from './dto/list-inventory-alerts.query.js';
import {
  RecommendationDecision,
  UpdateRecommendationDto,
} from './dto/update-recommendation.dto.js';
import {
  DEFAULT_ALERT_PAGE,
  DEFAULT_ALERT_PAGE_SIZE,
  INVENTORY_ALERT_CREATED,
  INVENTORY_ALERT_DISMISS_MESSAGE,
  INVENTORY_ALERT_NOT_FOUND_MESSAGE,
  INVENTORY_ALERT_RECOMMENDATION_MESSAGE,
  INVENTORY_ALERT_RECOMMENDATION_QUANTITY_MESSAGE,
  INVENTORY_ALERT_RESOLVED,
  type InventoryAlertEvent,
} from './inventory-alert.constants.js';

const ACTIVE_ALERT_STATUSES: InventoryAlertStatus[] = [
  InventoryAlertStatus.OPEN,
  InventoryAlertStatus.ANALYZING,
  InventoryAlertStatus.READY,
  InventoryAlertStatus.FAILED,
];

const DISMISSABLE_STATUSES: InventoryAlertStatus[] = [
  InventoryAlertStatus.OPEN,
  InventoryAlertStatus.READY,
  InventoryAlertStatus.FAILED,
];

const alertInclude = {
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      packSize: true,
      reorderLevel: true,
      category: {
        select: {
          id: true,
          name: true,
          division: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  analysis: true,
} as const;

@Injectable()
export class InventoryAlertService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InventoryAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.backfillOpenAlerts();
    } catch (error) {
      this.logger.error('Low-stock alert backfill failed', error);
    }
  }

  async evaluateProduct(productId: string): Promise<void> {
    try {
      await this.evaluateProductUnsafe(productId);
    } catch (error) {
      this.logger.error(
        `Low-stock evaluation failed for product ${productId}`,
        error,
      );
    }
  }

  async backfillOpenAlerts(): Promise<void> {
    const products = await this.prisma.product.findMany({
      where: {
        isDeleted: false,
        reorderLevel: { gt: 0 },
      },
      select: { id: true },
    });

    for (const product of products) {
      await this.evaluateProductUnsafe(product.id);
    }
  }

  async findAll(query: ListInventoryAlertsQueryDto) {
    const page = query.page ?? DEFAULT_ALERT_PAGE;
    const limit = query.limit ?? DEFAULT_ALERT_PAGE_SIZE;
    const where: Prisma.InventoryAlertWhereInput = {
      ...(query.status
        ? { status: query.status }
        : query.active
          ? { status: { in: ACTIVE_ALERT_STATUSES } }
          : {}),
      product: { isDeleted: false },
    };

    const [data, total] = await Promise.all([
      this.prisma.inventoryAlert.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: alertInclude,
      }),
      this.prisma.inventoryAlert.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const alert = await this.prisma.inventoryAlert.findFirst({
      where: {
        id,
        product: { isDeleted: false },
      },
      include: alertInclude,
    });

    if (!alert) {
      throw new NotFoundException(INVENTORY_ALERT_NOT_FOUND_MESSAGE);
    }

    return alert;
  }

  async dismiss(id: string) {
    const alert = await this.findOne(id);

    if (!DISMISSABLE_STATUSES.includes(alert.status)) {
      throw new BadRequestException(INVENTORY_ALERT_DISMISS_MESSAGE);
    }

    return this.prisma.inventoryAlert.update({
      where: { id },
      data: {
        status: InventoryAlertStatus.DISMISSED,
        activeProductKey: null,
        resolvedAt: new Date(),
      },
      include: alertInclude,
    });
  }

  async decideRecommendation(
    id: string,
    userId: string,
    dto: UpdateRecommendationDto,
  ) {
    // Intent only; a later LangGraph interrupt can pause before READY and reuse this API.
    const alert = await this.findOne(id);
    const analysis = alert.analysis;

    if (
      alert.status !== InventoryAlertStatus.READY ||
      !analysis ||
      analysis.recommendationStatus !== RecommendationStatus.PENDING
    ) {
      throw new BadRequestException(INVENTORY_ALERT_RECOMMENDATION_MESSAGE);
    }

    if (dto.decision === RecommendationDecision.REJECT) {
      await this.prisma.inventoryAnalysis.update({
        where: { id: analysis.id },
        data: {
          recommendationStatus: RecommendationStatus.REJECTED,
          decidedQuantity: null,
          decidedAt: new Date(),
          decidedById: userId,
        },
      });
      return this.findOne(id);
    }

    const decidedQuantity = dto.quantity ?? analysis.recommendedQuantity;
    if (decidedQuantity == null || decidedQuantity < 1) {
      throw new BadRequestException(
        INVENTORY_ALERT_RECOMMENDATION_QUANTITY_MESSAGE,
      );
    }

    await this.prisma.inventoryAnalysis.update({
      where: { id: analysis.id },
      data: {
        recommendationStatus: RecommendationStatus.APPROVED,
        decidedQuantity,
        decidedAt: new Date(),
        decidedById: userId,
      },
    });
    return this.findOne(id);
  }

  private async evaluateProductUnsafe(productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isDeleted: false,
      },
      select: {
        id: true,
        reorderLevel: true,
      },
    });
    const active = await this.findActiveAlert(productId);

    if (!product || product.reorderLevel <= 0) {
      await this.resolveActive(active);
      return;
    }

    const available = await this.availableQuantity(productId);
    const isLow = available > 0 && available <= product.reorderLevel;

    if (!isLow) {
      await this.resolveActive(active);
      return;
    }

    if (active) {
      return;
    }

    try {
      const created = await this.prisma.inventoryAlert.create({
        data: {
          productId,
          availableQuantity: available,
          reorderLevel: product.reorderLevel,
          status: InventoryAlertStatus.OPEN,
          activeProductKey: productId,
        },
      });
      const event: InventoryAlertEvent = {
        alertId: created.id,
        productId,
      };
      this.eventEmitter.emit(INVENTORY_ALERT_CREATED, event);
    } catch (error) {
      if (this.isActiveAlertConflict(error)) {
        return;
      }

      throw error;
    }
  }

  private async availableQuantity(productId: string): Promise<number> {
    const totals = await this.prisma.inventoryBatch.aggregate({
      where: {
        productId,
        expiryDate: { gte: startOfInventoryDay() },
      },
      _sum: { quantityOnHand: true },
    });

    return totals._sum.quantityOnHand ?? 0;
  }

  private findActiveAlert(productId: string) {
    return this.prisma.inventoryAlert.findFirst({
      where: {
        productId,
        status: { in: ACTIVE_ALERT_STATUSES },
      },
    });
  }

  private async resolveActive(
    active: { id: string; productId: string } | null,
  ): Promise<void> {
    if (!active) {
      return;
    }

    await this.prisma.inventoryAlert.update({
      where: { id: active.id },
      data: {
        status: InventoryAlertStatus.RESOLVED,
        activeProductKey: null,
        resolvedAt: new Date(),
      },
    });
    const event: InventoryAlertEvent = {
      alertId: active.id,
      productId: active.productId,
    };
    this.eventEmitter.emit(INVENTORY_ALERT_RESOLVED, event);
  }

  private isActiveAlertConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
