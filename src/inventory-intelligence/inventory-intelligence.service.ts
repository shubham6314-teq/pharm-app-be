import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { InventoryAlertStatus, Prisma } from '../generated/prisma/client.js';
import {
  INVENTORY_ALERT_ANALYSIS_FAILED,
  INVENTORY_ALERT_ANALYSIS_READY,
  INVENTORY_ALERT_CREATED,
  type InventoryAlertEvent,
} from '../inventory-alert/inventory-alert.constants.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AnalysisDraft } from './analysis-draft.js';
import { createInventoryTools } from './inventory-tools.js';
import {
  DEFAULT_CONSUMPTION_LOOKBACK_DAYS,
  DEFAULT_GEMINI_CHAT_MODEL,
} from './inventory-intelligence.constants.js';
import {
  createInvestigationGraph,
  type InvestigationModel,
} from './investigation-graph.js';

@Injectable()
export class InventoryIntelligenceService {
  private readonly logger = new Logger(InventoryIntelligenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
    private readonly knowledgeService: KnowledgeService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(INVENTORY_ALERT_CREATED)
  handleAlertCreated(event: InventoryAlertEvent): void {
    void this.investigate(event.alertId);
  }

  async investigate(
    alertId: string,
    model: InvestigationModel = this.createModel(),
  ): Promise<void> {
    const claimed = await this.prisma.inventoryAlert.updateMany({
      where: {
        id: alertId,
        status: InventoryAlertStatus.OPEN,
      },
      data: { status: InventoryAlertStatus.ANALYZING },
    });

    if (claimed.count === 0) {
      return;
    }

    const alert = await this.prisma.inventoryAlert.findUnique({
      where: { id: alertId },
      select: { id: true, productId: true },
    });

    if (!alert) {
      return;
    }

    try {
      const lookbackDays = this.lookbackDays();
      const tools = createInventoryTools({
        productId: alert.productId,
        lookbackDays,
        inventoryService: this.inventoryService,
        knowledgeService: this.knowledgeService,
      });
      const graph = createInvestigationGraph(model, tools);
      const result = await graph.invoke({
        alertId: alert.id,
        productId: alert.productId,
        messages: [],
        observations: {},
        draft: null,
        validationErrors: [],
        steps: 0,
      });

      if (!result.draft || result.validationErrors.length > 0) {
        await this.markFailed(alert.id, alert.productId);
        return;
      }

      await this.markReady(alert.id, alert.productId, result.draft, {
        observations: result.observations,
        validationErrors: result.validationErrors,
      });
    } catch (error) {
      this.logger.error(`Inventory investigation failed for ${alertId}`, error);
      await this.markFailed(alert.id, alert.productId);
    }
  }

  private async markReady(
    alertId: string,
    productId: string,
    draft: AnalysisDraft,
    evidence: Prisma.InputJsonValue,
  ): Promise<void> {
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryAlert.updateMany({
        where: {
          id: alertId,
          status: InventoryAlertStatus.ANALYZING,
        },
        data: { status: InventoryAlertStatus.READY },
      });

      if (updated.count === 0) {
        return false;
      }

      await tx.inventoryAnalysis.create({
        data: {
          alertId,
          explanation: draft.explanation,
          recommendedQuantity: draft.recommendedQuantity,
          calculationExplanation: draft.calculationExplanation,
          missingInformation: draft.missingInformation,
          citedChunkIds: draft.citedChunkIds,
          model: this.chatModelName(),
          evidence,
        },
      });
      return true;
    });

    if (saved) {
      this.eventEmitter.emit(INVENTORY_ALERT_ANALYSIS_READY, {
        alertId,
        productId,
      } satisfies InventoryAlertEvent);
    }
  }

  private async markFailed(alertId: string, productId: string): Promise<void> {
    const updated = await this.prisma.inventoryAlert.updateMany({
      where: {
        id: alertId,
        status: InventoryAlertStatus.ANALYZING,
      },
      data: { status: InventoryAlertStatus.FAILED },
    });

    if (updated.count === 0) {
      return;
    }

    this.eventEmitter.emit(INVENTORY_ALERT_ANALYSIS_FAILED, {
      alertId,
      productId,
    } satisfies InventoryAlertEvent);
  }

  private createModel(): ChatGoogleGenerativeAI {
    return new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GOOGLE_API_KEY'),
      model: this.chatModelName(),
      temperature: 0,
    });
  }

  private chatModelName(): string {
    return (
      this.configService.get<string>('GEMINI_CHAT_MODEL') ??
      DEFAULT_GEMINI_CHAT_MODEL
    );
  }

  private lookbackDays(): number {
    const configured = Number(
      this.configService.get<string>('INVENTORY_CONSUMPTION_LOOKBACK_DAYS'),
    );
    return Number.isInteger(configured) && configured > 0
      ? configured
      : DEFAULT_CONSUMPTION_LOOKBACK_DAYS;
  }
}
