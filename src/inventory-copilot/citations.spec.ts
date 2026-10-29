import { AIMessage, HumanMessage, ToolMessage } from '@langchain/core/messages';
import { citationsFromMessages } from './citations.js';

describe('citationsFromMessages', () => {
  it('maps tool observations to inventory, ledger, and document sources', () => {
    const citations = citationsFromMessages([
      new HumanMessage('How many boxes?'),
      new AIMessage({ content: '', tool_calls: [] }),
      new ToolMessage({
        tool_call_id: '1',
        name: 'getInventory',
        content: JSON.stringify({ ok: true, availableQuantity: 42 }),
      }),
      new ToolMessage({
        tool_call_id: '2',
        name: 'getConsumption',
        content: JSON.stringify({ ok: true, saleCount: 1 }),
      }),
      new ToolMessage({
        tool_call_id: '3',
        name: 'searchKnowledge',
        content: JSON.stringify({
          ok: true,
          chunks: [{ title: 'Reorder policy' }],
        }),
      }),
    ]);

    expect(citations).toEqual([
      { source: 'inventory', title: 'Inventory' },
      { source: 'ledger', title: 'Ledger' },
      { source: 'document', title: 'Reorder policy' },
    ]);
  });
});
