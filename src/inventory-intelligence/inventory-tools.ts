import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { InventoryService } from '../inventory/inventory.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';

const productSchema = z.object({
  productId: z.string().uuid(),
});

const searchSchema = z.object({
  query: z.string().min(1).max(500),
});

const findProductSchema = z.object({
  productId: z.string().uuid().optional(),
  code: z.string().min(1).max(30).optional(),
  query: z.string().min(1).max(100).optional(),
});

function failure(error: unknown): string {
  return JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'The tool failed.',
  });
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

export function createSearchKnowledgeTool(knowledgeService: KnowledgeService) {
  return tool(
    async ({ query }) => {
      const result = await knowledgeService.search(query);
      return json({ ok: true, ...result });
    },
    {
      name: 'searchKnowledge',
      description:
        'Search uploaded inventory policy and supplier documents. An empty chunk list means no matching document was uploaded. This does not change inventory.',
      schema: searchSchema,
    },
  );
}

export function createInventoryTools(input: {
  productId: string;
  lookbackDays: number;
  inventoryService: InventoryService;
  knowledgeService: KnowledgeService;
}): StructuredToolInterface[] {
  const matchesAlert = (productId: string) => productId === input.productId;

  return [
    tool(
      async ({ productId }) => {
        if (!matchesAlert(productId)) {
          return json({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          return json({
            ok: true,
            ...(await input.inventoryService.getProductFact(productId)),
          });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'getProduct',
        description:
          'Read the current catalog record for the alerted product, including its reorder level. This does not change inventory.',
        schema: productSchema,
      },
    ),
    tool(
      async ({ productId }) => {
        if (!matchesAlert(productId)) {
          return json({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          return json({
            ok: true,
            ...(await input.inventoryService.getInventoryFact(productId)),
          });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'getInventory',
        description:
          'Read live batch quantities from the database. Available quantity excludes expired batches. This does not change inventory.',
        schema: productSchema,
      },
    ),
    tool(
      async ({ productId }) => {
        if (!matchesAlert(productId)) {
          return json({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          const since = new Date(
            Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000,
          );
          return json({
            ok: true,
            ...(await input.inventoryService.getConsumptionFact(
              productId,
              since,
              input.lookbackDays,
            )),
          });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'getConsumption',
        description:
          'Sum stock-ledger movements for the alerted product during the configured lookback. This is recorded history, not a forecast, and it does not change inventory.',
        schema: productSchema,
      },
    ),
    createSearchKnowledgeTool(input.knowledgeService),
  ];
}

export function createCopilotTools(input: {
  lookbackDays: number;
  inventoryService: InventoryService;
  knowledgeService: KnowledgeService;
}): StructuredToolInterface[] {
  return [
    tool(
      async ({ productId, code, query }) => {
        if (!productId && !code && !query) {
          return json({
            ok: false,
            error: 'Provide productId, code, or query.',
          });
        }

        try {
          const products = await input.inventoryService.findProducts({
            productId,
            code,
            query,
          });
          return json({ ok: true, products });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'findProduct',
        description:
          'Find catalog products by id, exact code, or a name/code search. Returns at most 5 matches. This does not change inventory.',
        schema: findProductSchema,
      },
    ),
    tool(
      async ({ productId }) => {
        try {
          return json({
            ok: true,
            ...(await input.inventoryService.getInventoryFact(productId)),
          });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'getInventory',
        description:
          'Read live batch quantities for a product id from findProduct. Available quantity excludes expired batches. This does not change inventory.',
        schema: productSchema,
      },
    ),
    tool(
      async ({ productId }) => {
        try {
          const since = new Date(
            Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000,
          );
          return json({
            ok: true,
            ...(await input.inventoryService.getConsumptionFact(
              productId,
              since,
              input.lookbackDays,
            )),
          });
        } catch (error) {
          return failure(error);
        }
      },
      {
        name: 'getConsumption',
        description:
          'Sum stock-ledger movements for a product id during the configured lookback. This is recorded history, not a forecast, and it does not change inventory.',
        schema: productSchema,
      },
    ),
    tool(
      async () => {
        const products = await input.inventoryService.listLowStock();
        return json({ ok: true, products });
      },
      {
        name: 'listLowStock',
        description:
          'List products whose non-expired available quantity is at or below the reorder level. This does not change inventory.',
        schema: z.object({}),
      },
    ),
    tool(
      async () => {
        const batches = await input.inventoryService.listExpiring();
        return json({ ok: true, batches });
      },
      {
        name: 'listExpiring',
        description:
          'List batches that expire within the configured window and still have quantity on hand. This does not change inventory.',
        schema: z.object({}),
      },
    ),
    createSearchKnowledgeTool(input.knowledgeService),
  ];
}

export function copilotToolNames(): string[] {
  return [
    'findProduct',
    'getInventory',
    'getConsumption',
    'listLowStock',
    'listExpiring',
    'searchKnowledge',
  ];
}
