import { createCopilotTools } from './inventory-tools.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import type { KnowledgeService } from '../knowledge/knowledge.service.js';

describe('createCopilotTools', () => {
  it('returns no products instead of inventing a catalog match', async () => {
    const inventoryService = {
      findProducts: vi.fn().mockResolvedValue([]),
    } as unknown as InventoryService;
    const knowledgeService = {
      search: vi.fn(),
    } as unknown as KnowledgeService;
    const tools = createCopilotTools({
      lookbackDays: 30,
      inventoryService,
      knowledgeService,
    });
    const findProduct = tools.find((tool) => tool.name === 'findProduct');

    expect(findProduct).toBeDefined();
    const result = JSON.parse(
      String(await findProduct!.invoke({ query: 'ghost-stock' })),
    );

    expect(result).toEqual({ ok: true, products: [] });
    expect(inventoryService.findProducts).toHaveBeenCalled();
  });
});
