import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MissingFact } from './analysis-draft.js';
import {
  createInvestigationGraph,
  type InvestigationModel,
} from './investigation-graph.js';

const productId = '33333333-3333-4333-8333-333333333333';
const alertId = '66666666-6666-4666-8666-666666666666';

const observations = {
  getProduct: {
    ok: true,
    id: productId,
    reorderLevel: 50,
  },
  getInventory: {
    ok: true,
    availableQuantity: 40,
    reorderLevel: 50,
    batches: [],
  },
  getConsumption: {
    ok: true,
    saleCount: 0,
    salePacks: 0,
  },
  searchKnowledge: {
    ok: true,
    unavailable: false,
    chunks: [],
  },
};

function scriptedModel(): InvestigationModel {
  let step = 0;

  return {
    bindTools() {
      return {
        async invoke() {
          step += 1;
          if (step === 1) {
            return new AIMessage({
              content: '',
              tool_calls: [
                { id: 'product', name: 'getProduct', args: { productId } },
                { id: 'inventory', name: 'getInventory', args: { productId } },
                {
                  id: 'consumption',
                  name: 'getConsumption',
                  args: { productId },
                },
                {
                  id: 'knowledge',
                  name: 'searchKnowledge',
                  args: { query: 'reorder policy' },
                },
              ],
            });
          }

          return new AIMessage({
            content: JSON.stringify({
              explanation: 'Available stock is below the reorder level.',
              recommendedQuantity: 10,
              calculationExplanation:
                'Available quantity is 40 and the reorder level is 50, so 10 packs restore it.',
              missingInformation: [
                MissingFact.SALES_HISTORY_UNAVAILABLE,
                MissingFact.POLICY_DOCUMENTS_UNAVAILABLE,
                MissingFact.SUPPLIER_TERMS_UNAVAILABLE,
              ],
              citedChunkIds: [],
            }),
          });
        },
      };
    },
  };
}

describe('investigation graph', () => {
  it('calls the read tools and accepts a grounded recommendation', async () => {
    const schema = z.object({ productId: z.string() });
    const tools = [
      tool(async () => JSON.stringify(observations.getProduct), {
        name: 'getProduct',
        description: 'product',
        schema,
      }),
      tool(async () => JSON.stringify(observations.getInventory), {
        name: 'getInventory',
        description: 'inventory',
        schema,
      }),
      tool(async () => JSON.stringify(observations.getConsumption), {
        name: 'getConsumption',
        description: 'consumption',
        schema,
      }),
      tool(async () => JSON.stringify(observations.searchKnowledge), {
        name: 'searchKnowledge',
        description: 'knowledge',
        schema: z.object({ query: z.string() }),
      }),
    ];
    const graph = createInvestigationGraph(scriptedModel(), tools);
    const result = await graph.invoke({
      alertId,
      productId,
      messages: [],
      observations: {},
      draft: null,
      validationErrors: [],
      steps: 0,
    });

    expect(result.draft?.recommendedQuantity).toBe(10);
    expect(result.validationErrors).toEqual([]);
    expect(result.observations.getInventory).toMatchObject({
      availableQuantity: 40,
    });
  });
});
