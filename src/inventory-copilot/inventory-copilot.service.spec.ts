import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIMessage } from '@langchain/core/messages';
import { CopilotMessageRole } from '../generated/prisma/client.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CopilotModel } from './copilot-graph.js';
import { InventoryCopilotService } from './inventory-copilot.service.js';
import {
  COPILOT_TIMEOUT_MESSAGE,
  COPILOT_UNAVAILABLE_ANSWER,
} from './inventory-copilot.constants.js';

const threadId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('InventoryCopilotService', () => {
  let service: InventoryCopilotService;
  const prisma = {
    copilotThread: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    copilotMessage: {
      create: vi.fn(),
    },
  };
  const inventoryService = {
    findProducts: vi.fn(),
    getInventoryFact: vi.fn(),
    getConsumptionFact: vi.fn(),
    listLowStock: vi.fn(),
    listExpiring: vi.fn(),
  };
  const knowledgeService = {
    search: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryCopilotService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: InventoryService, useValue: inventoryService },
        { provide: KnowledgeService, useValue: knowledgeService },
      ],
    }).compile();

    service = module.get(InventoryCopilotService);
    prisma.copilotThread.findFirst.mockResolvedValue({
      id: threadId,
      userId,
      messages: [],
    });
    prisma.copilotMessage.create.mockImplementation(async ({ data }) => ({
      id: 'msg-1',
      createdAt: new Date('2026-10-28T00:00:00.000Z'),
      citations: [],
      ...data,
    }));
    prisma.copilotThread.update.mockResolvedValue({});
  });

  it('saves an assistant reply after a scripted tool call', async () => {
    inventoryService.findProducts.mockResolvedValue([]);
    const model: CopilotModel = {
      bindTools() {
        let step = 0;
        return {
          async invoke() {
            step += 1;
            if (step === 1) {
              return new AIMessage({
                content: '',
                tool_calls: [
                  { id: '1', name: 'findProduct', args: { query: 'ghost' } },
                ],
              });
            }

            return new AIMessage({
              content: 'No matching product was found.',
            });
          },
        };
      },
    };

    const events = [];
    for await (const event of service.ask(
      threadId,
      userId,
      'Where is ghost stock?',
      model,
    )) {
      events.push(event);
    }

    const done = events.find((event) => event.type === 'done');
    expect(done).toMatchObject({
      type: 'done',
      message: { content: 'No matching product was found.' },
    });
    expect(prisma.copilotMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          role: CopilotMessageRole.ASSISTANT,
          content: 'No matching product was found.',
        }),
      }),
    );
  });

  it('does not invent stock when the model returns an empty answer', async () => {
    const model: CopilotModel = {
      bindTools() {
        return {
          async invoke() {
            return new AIMessage({ content: '' });
          },
        };
      },
    };

    const events = [];
    for await (const event of service.ask(threadId, userId, 'Stock?', model)) {
      events.push(event);
    }

    const done = events.find((event) => event.type === 'done');
    expect(done).toMatchObject({
      type: 'done',
      message: { content: COPILOT_UNAVAILABLE_ANSWER },
    });
  });

  it('emits an error instead of hanging when Gemini never returns', async () => {
    const config = (service as unknown as { configService: { get: ReturnType<typeof vi.fn> } })
      .configService;
    config.get.mockImplementation((key: string) =>
      key === 'COPILOT_TIMEOUT_MS' || key === 'COPILOT_MODEL_TIMEOUT_MS'
        ? '50'
        : undefined,
    );
    const model: CopilotModel = {
      bindTools() {
        return {
          invoke: () => new Promise(() => undefined),
        };
      },
    };

    const events = [];
    for await (const event of service.ask(threadId, userId, 'Stock?', model)) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'error')).toBe(true);
    expect(events.find((event) => event.type === 'error')).toMatchObject({
      type: 'error',
      message: COPILOT_TIMEOUT_MESSAGE,
    });
    expect(prisma.copilotMessage.create).toHaveBeenCalledTimes(1);
  });
});
