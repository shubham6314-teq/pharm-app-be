import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import {
  CopilotMessageRole,
  Prisma,
} from '../generated/prisma/client.js';
import {
  DEFAULT_CONSUMPTION_LOOKBACK_DAYS,
  DEFAULT_GEMINI_CHAT_MODEL,
} from '../inventory-intelligence/inventory-intelligence.constants.js';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { createCopilotTools } from '../inventory-intelligence/inventory-tools.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { citationsFromMessages } from './citations.js';
import { createCopilotGraph, type CopilotModel } from './copilot-graph.js';
import { copilotPublicError, withTimeout } from './copilot-timeout.js';
import {
  COPILOT_SERVICE_UNAVAILABLE_MESSAGE,
  COPILOT_THREAD_NOT_FOUND_MESSAGE,
  COPILOT_TIMEOUT_MESSAGE,
  COPILOT_UNAVAILABLE_ANSWER,
  DEFAULT_COPILOT_MODEL_TIMEOUT_MS,
  DEFAULT_COPILOT_TIMEOUT_MS,
} from './inventory-copilot.constants.js';

export type CopilotStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'token'; text: string }
  | {
      type: 'done';
      message: {
        id: string;
        role: 'ASSISTANT';
        content: string;
        citations: unknown;
        createdAt: Date;
      };
    }
  | { type: 'error'; message: string };

const threadInclude = {
  messages: {
    orderBy: { createdAt: 'asc' as const },
  },
};

@Injectable()
export class InventoryCopilotService {
  private readonly logger = new Logger(InventoryCopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
    private readonly knowledgeService: KnowledgeService,
  ) {}

  createThread(userId: string) {
    return this.prisma.copilotThread.create({
      data: { userId },
      include: threadInclude,
    });
  }

  async findThread(id: string, userId: string) {
    const thread = await this.prisma.copilotThread.findFirst({
      where: { id, userId },
      include: threadInclude,
    });

    if (!thread) {
      throw new NotFoundException(COPILOT_THREAD_NOT_FOUND_MESSAGE);
    }

    return thread;
  }

  ensureAvailable(): void {
    if (!this.configService.get<string>('GOOGLE_API_KEY')) {
      throw new ServiceUnavailableException(
        COPILOT_SERVICE_UNAVAILABLE_MESSAGE,
      );
    }
  }

  async *ask(
    threadId: string,
    userId: string,
    content: string,
    model?: CopilotModel,
  ): AsyncGenerator<CopilotStreamEvent> {
    const thread = await this.findThread(threadId, userId);
    await this.prisma.copilotMessage.create({
      data: {
        threadId: thread.id,
        role: CopilotMessageRole.USER,
        content,
      },
    });

    this.logger.log(`Copilot question on thread ${thread.id}`);

    const history: BaseMessage[] = [
      ...thread.messages.map((message) =>
        message.role === CopilotMessageRole.USER
          ? new HumanMessage(message.content)
          : new AIMessage(message.content),
      ),
      new HumanMessage(content),
    ];

    const events: CopilotStreamEvent[] = [];
    let notify: (() => void) | undefined;
    let finished = false;
    let settled = false;

    const push = (event: CopilotStreamEvent) => {
      events.push(event);
      notify?.();
    };

    const tools = this.withToolLogs(
      createCopilotTools({
        lookbackDays: this.lookbackDays(),
        inventoryService: this.inventoryService,
        knowledgeService: this.knowledgeService,
      }),
      (text) => {
        this.logger.log(text);
        push({ type: 'status', text });
      },
    );

    const running = (async () => {
      try {
        const graph = createCopilotGraph(model ?? this.createGeminiModel(), tools, {
          modelTimeoutMs: this.modelTimeoutMs(),
          onToken: (text) => {
            push({ type: 'token', text });
          },
          onStatus: (text) => {
            this.logger.log(text);
            push({ type: 'status', text });
          },
        });
        const result = await withTimeout(
          graph.invoke({
            messages: history,
            steps: 0,
          }),
          this.timeoutMs(),
          COPILOT_TIMEOUT_MESSAGE,
        );
        if (settled) {
          this.logger.warn('Copilot finished after timeout; answer was not saved.');
          return;
        }
        settled = true;
        const last = result.messages.at(-1);
        const answer = AIMessage.isInstance(last)
          ? typeof last.content === 'string'
            ? last.content.trim()
            : ''
          : '';
        const contentToSave = answer || COPILOT_UNAVAILABLE_ANSWER;
        const citations = citationsFromMessages(result.messages);
        const saved = await this.prisma.copilotMessage.create({
          data: {
            threadId: thread.id,
            role: CopilotMessageRole.ASSISTANT,
            content: contentToSave,
            citations: citations as Prisma.InputJsonValue,
          },
        });
        await this.prisma.copilotThread.update({
          where: { id: thread.id },
          data: { updatedAt: new Date() },
        });

        if (!events.some((event) => event.type === 'token')) {
          push({ type: 'token', text: contentToSave });
        }

        push({
          type: 'done',
          message: {
            id: saved.id,
            role: 'ASSISTANT',
            content: saved.content,
            citations: saved.citations,
            createdAt: saved.createdAt,
          },
        });
      } catch (error) {
        const message = copilotPublicError(error);
        this.logger.error(`Copilot failed: ${message}`, error);
        if (settled) {
          return;
        }
        settled = true;
        push({ type: 'error', message });
      } finally {
        finished = true;
        notify?.();
      }
    })();

    while (!finished || events.length > 0) {
      if (events.length > 0) {
        const event = events.shift();
        if (event) {
          yield event;
        }
        continue;
      }

      await new Promise<void>((resolve) => {
        notify = resolve;
      });
    }

    await running;
  }

  private createGeminiModel(): CopilotModel {
    const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        COPILOT_SERVICE_UNAVAILABLE_MESSAGE,
      );
    }

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model:
        this.configService.get<string>('GEMINI_CHAT_MODEL') ??
        DEFAULT_GEMINI_CHAT_MODEL,
      temperature: 0,
      maxRetries: 0,
    });

    return {
      bindTools(tools) {
        const bound = model.bindTools(tools);
        return {
          invoke: async (messages) =>
            (await bound.invoke(messages)) as AIMessage,
          async *stream(messages) {
            const chunks = await bound.stream(messages);
            for await (const chunk of chunks) {
              yield chunk;
            }
          },
        };
      },
    };
  }

  private timeoutMs(): number {
    return this.readPositiveMs(
      'COPILOT_TIMEOUT_MS',
      DEFAULT_COPILOT_TIMEOUT_MS,
    );
  }

  private modelTimeoutMs(): number {
    return this.readPositiveMs(
      'COPILOT_MODEL_TIMEOUT_MS',
      DEFAULT_COPILOT_MODEL_TIMEOUT_MS,
    );
  }

  private readPositiveMs(key: string, fallback: number): number {
    const configured = Number(this.configService.get<string>(key));
    return Number.isInteger(configured) && configured > 0
      ? configured
      : fallback;
  }

  private withToolLogs(
    tools: StructuredToolInterface[],
    log: (text: string) => void,
  ): StructuredToolInterface[] {
    for (const tool of tools) {
      const invoke = tool.invoke.bind(tool);
      tool.invoke = async (input, config) => {
        log(`Running ${tool.name}`);
        const result = await invoke(input, config);
        log(`Finished ${tool.name}`);
        return result;
      };
    }

    return tools;
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
