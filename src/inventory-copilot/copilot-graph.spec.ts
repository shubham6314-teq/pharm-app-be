import { AIMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createCopilotGraph, type CopilotModel } from './copilot-graph.js';
import { copilotToolNames } from '../inventory-intelligence/inventory-tools.js';

const productId = '33333333-3333-4333-8333-333333333333';

function scriptedModel(): CopilotModel {
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
                {
                  id: 'find',
                  name: 'findProduct',
                  args: { code: 'CRO500' },
                },
              ],
            });
          }

          return new AIMessage({
            content: 'CRO500 has 42 boxes available. I cannot change stock.',
          });
        },
      };
    },
  };
}

describe('copilot graph', () => {
  it('calls findProduct then answers from the tool result', async () => {
    const findProduct = tool(
      async () =>
        JSON.stringify({
          ok: true,
          products: [{ id: productId, code: 'CRO500', name: 'Crocin 500' }],
        }),
      {
        name: 'findProduct',
        description: 'find',
        schema: z.object({
          code: z.string().optional(),
          query: z.string().optional(),
          productId: z.string().optional(),
        }),
      },
    );
    const graph = createCopilotGraph(scriptedModel(), [findProduct]);
    const result = await graph.invoke({
      messages: [],
      steps: 0,
    });
    const last = result.messages.at(-1);

    expect(last).toBeInstanceOf(AIMessage);
    expect(String(last?.content)).toContain('42 boxes');
  });

  it('leaves an empty catalog lookup as unavailable rather than invented stock', async () => {
    const findProduct = tool(
      async () => JSON.stringify({ ok: true, products: [] }),
      {
        name: 'findProduct',
        description: 'find',
        schema: z.object({
          query: z.string().optional(),
        }),
      },
    );
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
                  { id: 'find', name: 'findProduct', args: { query: 'ghost' } },
                ],
              });
            }

            return new AIMessage({
              content: 'That information is unavailable.',
            });
          },
        };
      },
    };
    const graph = createCopilotGraph(model, [findProduct]);
    const result = await graph.invoke({ messages: [], steps: 0 });
    const last = result.messages.at(-1);

    expect(String(last?.content)).toContain('unavailable');
    expect(String(last?.content)).not.toMatch(/\d+\s+boxes/i);
  });

  it('does not bind inventory write tools', () => {
    expect(copilotToolNames()).toEqual([
      'findProduct',
      'getInventory',
      'getConsumption',
      'listLowStock',
      'listExpiring',
      'searchKnowledge',
    ]);
    expect(copilotToolNames()).not.toContain('createMovement');
  });
});
