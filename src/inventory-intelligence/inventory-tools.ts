import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { InventoryService } from '../inventory/inventory.service.js';
import { KnowledgeService } from '../knowledge/knowledge.service.js';

const productSchema = z.object({
  productId: z.string().uuid(),
});

const searchSchema = z.object({
  query: z.string().min(1).max(500),
});

function failure(error: unknown): string {
  return JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : 'The tool failed.',
  });
}

export function createInventoryTools(input: {
  productId: string;
  lookbackDays: number;
  inventoryService: InventoryService;
  knowledgeService: KnowledgeService;
}) {
  const matchesAlert = (productId: string) => productId === input.productId;

  return [
    tool(
      async ({ productId }) => {
        if (!matchesAlert(productId)) {
          return JSON.stringify({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          return JSON.stringify({
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
          return JSON.stringify({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          return JSON.stringify({
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
          return JSON.stringify({
            ok: false,
            error: 'This tool can only read the alerted product.',
          });
        }

        try {
          const since = new Date(
            Date.now() - input.lookbackDays * 24 * 60 * 60 * 1000,
          );
          return JSON.stringify({
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
    tool(
      async ({ query }) => {
        const result = await input.knowledgeService.search(query);
        return JSON.stringify({ ok: true, ...result });
      },
      {
        name: 'searchKnowledge',
        description:
          'Search uploaded inventory policy and supplier documents. An empty chunk list means no matching document was uploaded. This does not change inventory.',
        schema: searchSchema,
      },
    ),
  ];
}
