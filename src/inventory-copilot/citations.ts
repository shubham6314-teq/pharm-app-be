import { ToolMessage, type BaseMessage } from '@langchain/core/messages';

export type CopilotCitation = {
  source: 'inventory' | 'ledger' | 'document' | 'catalog';
  title?: string;
};

type ToolPayload = {
  ok?: boolean;
  chunks?: Array<{ title?: string }>;
  products?: unknown[];
  batches?: unknown[];
};

export function citationsFromMessages(messages: BaseMessage[]): CopilotCitation[] {
  const citations: CopilotCitation[] = [];
  const seen = new Set<string>();

  const add = (citation: CopilotCitation) => {
    const key = `${citation.source}:${citation.title ?? ''}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    citations.push(citation);
  };

  for (const message of messages) {
    if (!ToolMessage.isInstance(message) || !message.name) {
      continue;
    }

    let payload: ToolPayload = {};
    try {
      payload = JSON.parse(String(message.content)) as ToolPayload;
    } catch {
      continue;
    }

    if (payload.ok === false) {
      continue;
    }

    if (message.name === 'searchKnowledge') {
      for (const chunk of payload.chunks ?? []) {
        if (chunk.title) {
          add({ source: 'document', title: chunk.title });
        }
      }
      continue;
    }

    if (message.name === 'getConsumption') {
      add({ source: 'ledger', title: 'Ledger' });
      continue;
    }

    if (message.name === 'getInventory') {
      add({ source: 'inventory', title: 'Inventory' });
      continue;
    }

    if (
      (message.name === 'listLowStock' && (payload.products?.length ?? 0) > 0) ||
      (message.name === 'listExpiring' && (payload.batches?.length ?? 0) > 0)
    ) {
      add({ source: 'inventory', title: 'Inventory' });
      continue;
    }

    if (
      message.name === 'findProduct' &&
      (payload.products?.length ?? 0) > 0
    ) {
      add({ source: 'catalog', title: 'Catalog' });
    }
  }

  return citations;
}
