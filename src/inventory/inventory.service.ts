import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { ListInventoryQueryDto } from './dto/list-inventory.query.js';
import {
  addUtcDays,
  parseDateOnly,
  startOfInventoryDay,
  toDateOnlyString,
} from './inventory-dates.js';
import { resolveBatchStatus } from './inventory-status.js';
import {
  DEFAULT_EXPIRING_WITHIN_DAYS,
  DEFAULT_INVENTORY_PAGE,
  DEFAULT_INVENTORY_PAGE_SIZE,
  INVENTORY_BATCH_EXISTS_MESSAGE,
  INVENTORY_BATCH_NOT_FOUND_MESSAGE,
  INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE,
  INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE,
  INVENTORY_NEW_BATCH_FIELDS_MESSAGE,
  INVENTORY_NEW_BATCH_TYPE_MESSAGE,
  INVENTORY_PRODUCT_NOT_FOUND_MESSAGE,
  INVENTORY_QUANTITY_MESSAGE,
  StockStatus,
} from './inventory.constants.js';

const batchInclude = {
  product: {
    select: {
      id: true,
      name: true,
      code: true,
      packSize: true,
      packType: {
        select: {
          id: true,
          name: true,
          code: true,
          singularLabel: true,
          pluralLabel: true,
        },
      },
      contentQuantity: true,
      contentUnit: {
        select: {
          id: true,
          name: true,
          code: true,
          singularLabel: true,
          pluralLabel: true,
        },
      },
      reorderLevel: true,
      mrp: true,
      category: {
        select: {
          id: true,
          name: true,
          divisionId: true,
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
} as const;

const movementSelect = {
  id: true,
  type: true,
  quantity: true,
  note: true,
  createdAt: true,
} as const;

type BatchWithProduct = Prisma.InventoryBatchGetPayload<{
  include: typeof batchInclude;
}>;

type MovementRecord = {
  id: string;
  type: StockMovementType;
  quantity: number;
  note: string | null;
  createdAt: Date;
};

type BatchRecord = BatchWithProduct & {
  movements?: MovementRecord[];
};

type StockContext = {
  today: Date;
  expiringUntil: Date;
  availableByProduct: Map<string, number>;
  lowProductIds: Set<string>;
};

const INBOUND_TYPES = new Set<StockMovementType>([
  StockMovementType.OPENING,
  StockMovementType.PURCHASE,
]);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createMovement(dto: CreateStockMovementDto) {
    const batchNumber = dto.batchNumber.trim().toUpperCase();
    const delta = this.toDelta(dto.type, dto.quantity);
    await this.ensureActiveProduct(dto.productId);

    const batch = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryBatch.findUnique({
        where: {
          productId_batchNumber: {
            productId: dto.productId,
            batchNumber,
          },
        },
      });

      if (!existing) {
        return this.createBatch(tx, dto, batchNumber, delta);
      }

      if (dto.type === StockMovementType.OPENING) {
        throw new ConflictException(INVENTORY_BATCH_EXISTS_MESSAGE);
      }

      if (existing.quantityOnHand + delta < 0) {
        throw new BadRequestException(INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE);
      }

      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id: existing.id,
          quantityOnHand: { gte: delta < 0 ? -delta : 0 },
        },
        data: {
          quantityOnHand: { increment: delta },
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException(INVENTORY_INSUFFICIENT_QUANTITY_MESSAGE);
      }

      await tx.stockMovement.create({
        data: {
          inventoryBatchId: existing.id,
          type: dto.type,
          quantity: delta,
          note: dto.note,
        },
      });

      return tx.inventoryBatch.findUniqueOrThrow({
        where: { id: existing.id },
        include: batchInclude,
      });
    });

    const context = await this.loadStockContext(DEFAULT_EXPIRING_WITHIN_DAYS);
    return this.toBatchResponse(batch, context);
  }

  async findAll(query: ListInventoryQueryDto) {
    const page = query.page ?? DEFAULT_INVENTORY_PAGE;
    const limit = query.limit ?? DEFAULT_INVENTORY_PAGE_SIZE;
    const skip = (page - 1) * limit;
    const expiringWithinDays =
      query.expiringWithinDays ?? DEFAULT_EXPIRING_WITHIN_DAYS;
    const context = await this.loadStockContext(expiringWithinDays);
    const where = this.listWhere(query, context);

    const [data, total] = await Promise.all([
      this.prisma.inventoryBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expiryDate: 'asc' }, { batchNumber: 'asc' }],
        include: batchInclude,
      }),
      this.prisma.inventoryBatch.count({ where }),
    ]);

    return {
      data: data.map((batch) => this.toBatchResponse(batch, context)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: {
        id,
        product: { isDeleted: false },
      },
      include: {
        ...batchInclude,
        movements: {
          select: movementSelect,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(INVENTORY_BATCH_NOT_FOUND_MESSAGE);
    }

    const context = await this.loadStockContext(DEFAULT_EXPIRING_WITHIN_DAYS);
    return this.toBatchResponse(batch, context);
  }

  private async createBatch(
    tx: Prisma.TransactionClient,
    dto: CreateStockMovementDto,
    batchNumber: string,
    delta: number,
  ) {
    if (!INBOUND_TYPES.has(dto.type) || delta <= 0) {
      throw new BadRequestException(INVENTORY_NEW_BATCH_TYPE_MESSAGE);
    }

    if (
      dto.manufacturingDate === undefined ||
      dto.expiryDate === undefined ||
      dto.purchaseRate === undefined
    ) {
      throw new BadRequestException(INVENTORY_NEW_BATCH_FIELDS_MESSAGE);
    }

    const manufacturingDate = parseDateOnly(dto.manufacturingDate);
    const expiryDate = parseDateOnly(dto.expiryDate);

    if (manufacturingDate > expiryDate) {
      throw new BadRequestException(INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE);
    }

    try {
      return await tx.inventoryBatch.create({
        data: {
          productId: dto.productId,
          batchNumber,
          manufacturingDate,
          expiryDate,
          quantityOnHand: delta,
          purchaseRate: dto.purchaseRate,
          movements: {
            create: {
              type: dto.type,
              quantity: delta,
              note: dto.note,
            },
          },
        },
        include: batchInclude,
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }
  }

  private listWhere(
    query: ListInventoryQueryDto,
    context: StockContext,
  ): Prisma.InventoryBatchWhereInput {
    const statusWhere = this.statusWhere(query.status, context);

    return {
      AND: [
        {
          product: {
            isDeleted: false,
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
            category: {
              isDeleted: false,
              ...(query.divisionId ? { divisionId: query.divisionId } : {}),
            },
          },
        },
        ...(query.productId ? [{ productId: query.productId }] : []),
        ...(query.search
          ? [
              {
                OR: [
                  {
                    batchNumber: {
                      contains: query.search,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    product: {
                      name: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                  {
                    product: {
                      code: {
                        contains: query.search,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                ],
              },
            ]
          : []),
        ...(statusWhere ? [statusWhere] : []),
      ],
    };
  }

  private statusWhere(
    status: StockStatus | undefined,
    context: StockContext,
  ): Prisma.InventoryBatchWhereInput | undefined {
    if (!status) {
      return undefined;
    }

    const lowProductIds = [...context.lowProductIds];

    switch (status) {
      case StockStatus.EXPIRED:
        return { expiryDate: { lt: context.today } };
      case StockStatus.OUT:
        return {
          quantityOnHand: 0,
          expiryDate: { gte: context.today },
        };
      case StockStatus.EXPIRING:
        return {
          quantityOnHand: { gt: 0 },
          expiryDate: { gte: context.today, lte: context.expiringUntil },
        };
      case StockStatus.LOW:
        return {
          quantityOnHand: { gt: 0 },
          expiryDate: { gt: context.expiringUntil },
          productId: { in: lowProductIds },
        };
      case StockStatus.IN_STOCK:
        return {
          quantityOnHand: { gt: 0 },
          expiryDate: { gt: context.expiringUntil },
          ...(lowProductIds.length > 0
            ? { productId: { notIn: lowProductIds } }
            : {}),
        };
      default:
        return undefined;
    }
  }

  private async loadStockContext(expiringWithinDays: number): Promise<StockContext> {
    const today = startOfInventoryDay();
    const expiringUntil = addUtcDays(today, expiringWithinDays);
    const [products, totals] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          isDeleted: false,
          reorderLevel: { gt: 0 },
        },
        select: {
          id: true,
          reorderLevel: true,
        },
      }),
      this.prisma.inventoryBatch.groupBy({
        by: ['productId'],
        where: {
          expiryDate: { gte: today },
          product: { isDeleted: false },
        },
        _sum: { quantityOnHand: true },
      }),
    ]);

    const availableByProduct = new Map(
      totals.map((row) => [row.productId, row._sum.quantityOnHand ?? 0]),
    );
    const lowProductIds = new Set(
      products
        .filter((product) => {
          const available = availableByProduct.get(product.id) ?? 0;
          return available > 0 && available <= product.reorderLevel;
        })
        .map((product) => product.id),
    );

    return { today, expiringUntil, availableByProduct, lowProductIds };
  }

  private toBatchResponse(batch: BatchRecord, context: StockContext) {
    const productAvailable = context.availableByProduct.get(batch.productId) ?? 0;
    const { movements, ...rest } = batch;

    return {
      ...rest,
      manufacturingDate: toDateOnlyString(batch.manufacturingDate),
      expiryDate: toDateOnlyString(batch.expiryDate),
      purchaseRate: this.toNumber(batch.purchaseRate),
      status: resolveBatchStatus({
        quantityOnHand: batch.quantityOnHand,
        expiryDate: batch.expiryDate,
        today: context.today,
        expiringUntil: context.expiringUntil,
        productAvailable,
        reorderLevel: batch.product.reorderLevel,
      }),
      product: {
        ...batch.product,
        mrp: this.toNumber(batch.product.mrp),
        contentQuantity: this.toNumber(batch.product.contentQuantity),
        availableQuantity: productAvailable,
      },
      ...(movements ? { movements } : {}),
    };
  }

  private toDelta(type: StockMovementType, quantity: number): number {
    if (!Number.isInteger(quantity) || quantity === 0) {
      throw new BadRequestException(INVENTORY_QUANTITY_MESSAGE);
    }

    if (type === StockMovementType.ADJUSTMENT) {
      return quantity;
    }

    if (quantity < 0) {
      throw new BadRequestException(INVENTORY_QUANTITY_MESSAGE);
    }

    if (
      type === StockMovementType.SALE ||
      type === StockMovementType.DAMAGE ||
      type === StockMovementType.EXPIRY
    ) {
      return -quantity;
    }

    return quantity;
  }

  private async ensureActiveProduct(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(INVENTORY_PRODUCT_NOT_FOUND_MESSAGE);
    }

    return product;
  }

  private handleUniqueConstraintError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(INVENTORY_BATCH_EXISTS_MESSAGE);
    }
  }

  private toNumber(value: Prisma.Decimal | number | string): number {
    return Number(value);
  }
}
