import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '../generated/prisma/client.js';
import { InventoryAlertService } from '../inventory-alert/inventory-alert.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto.js';
import { ListInventoryQueryDto } from './dto/list-inventory.query.js';
import { UpdateInventoryDto } from './dto/update-inventory.dto.js';
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
  INVENTORY_UPDATE_EMPTY_MESSAGE,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryAlertService: InventoryAlertService,
  ) {}

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

    await this.inventoryAlertService.evaluateProduct(dto.productId);
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

  async update(id: string, dto: UpdateInventoryDto) {
    const { batchNumber, manufacturingDate, expiryDate, purchaseRate, note } =
      dto;

    if (
      batchNumber === undefined &&
      manufacturingDate === undefined &&
      expiryDate === undefined &&
      purchaseRate === undefined
    ) {
      throw new BadRequestException(INVENTORY_UPDATE_EMPTY_MESSAGE);
    }

    const existing = await this.prisma.inventoryBatch.findFirst({
      where: {
        id,
        product: { isDeleted: false },
      },
    });

    if (!existing) {
      throw new NotFoundException(INVENTORY_BATCH_NOT_FOUND_MESSAGE);
    }

    const nextManufacturingDate =
      manufacturingDate !== undefined
        ? parseDateOnly(manufacturingDate)
        : existing.manufacturingDate;
    const nextExpiryDate =
      expiryDate !== undefined
        ? parseDateOnly(expiryDate)
        : existing.expiryDate;

    if (nextManufacturingDate > nextExpiryDate) {
      throw new BadRequestException(
        INVENTORY_EXPIRY_BEFORE_MANUFACTURING_MESSAGE,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventoryBatch.update({
          where: { id },
          data: {
            ...(batchNumber !== undefined
              ? { batchNumber: batchNumber.toUpperCase() }
              : {}),
            ...(manufacturingDate !== undefined
              ? { manufacturingDate: nextManufacturingDate }
              : {}),
            ...(expiryDate !== undefined
              ? { expiryDate: nextExpiryDate }
              : {}),
            ...(purchaseRate !== undefined ? { purchaseRate } : {}),
          },
        });

        if (note) {
          await tx.stockMovement.create({
            data: {
              inventoryBatchId: id,
              type: StockMovementType.ADJUSTMENT,
              quantity: 0,
              note,
            },
          });
        }
      });
    } catch (error) {
      this.handleUniqueConstraintError(error);
      throw error;
    }

    await this.inventoryAlertService.evaluateProduct(existing.productId);
    return this.findOne(id);
  }

  async getProductFact(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        code: true,
        packSize: true,
        reorderLevel: true,
        status: true,
        packType: {
          select: {
            pluralLabel: true,
          },
        },
        category: {
          select: {
            name: true,
            division: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(INVENTORY_PRODUCT_NOT_FOUND_MESSAGE);
    }

    return {
      id: product.id,
      name: product.name,
      code: product.code,
      packSize: product.packSize,
      packLabel: product.packType.pluralLabel,
      reorderLevel: product.reorderLevel,
      status: product.status,
      categoryName: product.category.name,
      divisionName: product.category.division.name,
    };
  }

  async getInventoryFact(productId: string) {
    const product = await this.getProductFact(productId);
    const today = startOfInventoryDay();
    const batches = await this.prisma.inventoryBatch.findMany({
      where: { productId },
      orderBy: { expiryDate: 'asc' },
      select: {
        batchNumber: true,
        quantityOnHand: true,
        expiryDate: true,
      },
    });
    const availableQuantity = batches
      .filter((batch) => batch.expiryDate >= today)
      .reduce((sum, batch) => sum + batch.quantityOnHand, 0);

    return {
      availableQuantity,
      reorderLevel: product.reorderLevel,
      batches: batches.map((batch) => ({
        batchNumber: batch.batchNumber,
        quantityOnHand: batch.quantityOnHand,
        expiryDate: toDateOnlyString(batch.expiryDate),
        expired: batch.expiryDate < today,
      })),
    };
  }

  async findProducts(input: {
    productId?: string;
    code?: string;
    query?: string;
  }) {
    if (input.productId) {
      return [await this.getProductFact(input.productId)];
    }

    if (input.code) {
      const product = await this.prisma.product.findFirst({
        where: {
          isDeleted: false,
          code: { equals: input.code.trim(), mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (!product) {
        return [];
      }

      return [await this.getProductFact(product.id)];
    }

    const query = input.query?.trim();
    if (!query) {
      return [];
    }

    const matches = await this.prisma.product.findMany({
      where: {
        isDeleted: false,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
      take: 5,
      orderBy: { name: 'asc' },
    });

    return Promise.all(matches.map((product) => this.getProductFact(product.id)));
  }

  async listLowStock(limit = 20) {
    const context = await this.loadStockContext(DEFAULT_EXPIRING_WITHIN_DAYS);
    const ids = [...context.lowProductIds].slice(0, limit);
    if (ids.length === 0) {
      return [];
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: {
        id: true,
        name: true,
        code: true,
        reorderLevel: true,
      },
      orderBy: { name: 'asc' },
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      code: product.code,
      reorderLevel: product.reorderLevel,
      availableQuantity: context.availableByProduct.get(product.id) ?? 0,
    }));
  }

  async listExpiring(limit = 20) {
    const context = await this.loadStockContext(DEFAULT_EXPIRING_WITHIN_DAYS);
    const batches = await this.prisma.inventoryBatch.findMany({
      where: {
        quantityOnHand: { gt: 0 },
        expiryDate: { gte: context.today, lte: context.expiringUntil },
        product: { isDeleted: false },
      },
      take: limit,
      orderBy: { expiryDate: 'asc' },
      select: {
        batchNumber: true,
        quantityOnHand: true,
        expiryDate: true,
        product: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    return batches.map((batch) => ({
      productId: batch.product.id,
      name: batch.product.name,
      code: batch.product.code,
      batchNumber: batch.batchNumber,
      quantityOnHand: batch.quantityOnHand,
      expiryDate: toDateOnlyString(batch.expiryDate),
    }));
  }

  async getConsumptionFact(productId: string, since: Date, lookbackDays: number) {
    await this.getProductFact(productId);
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: since },
        inventoryBatch: { productId },
      },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const byType = new Map(
      grouped.map((row) => [
        row.type,
        {
          quantity: row._sum.quantity ?? 0,
          count: row._count._all,
        },
      ]),
    );
    const packs = (type: StockMovementType) =>
      Math.abs(byType.get(type)?.quantity ?? 0);

    return {
      lookbackDays,
      since: since.toISOString(),
      salePacks: packs(StockMovementType.SALE),
      saleCount: byType.get(StockMovementType.SALE)?.count ?? 0,
      returnPacks: packs(StockMovementType.RETURN),
      damagePacks: packs(StockMovementType.DAMAGE),
      expiryPacks: packs(StockMovementType.EXPIRY),
    };
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
