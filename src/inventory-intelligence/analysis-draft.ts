import { z } from 'zod';

export const MissingFact = {
  SALES_HISTORY_UNAVAILABLE: 'SALES_HISTORY_UNAVAILABLE',
  POLICY_DOCUMENTS_UNAVAILABLE: 'POLICY_DOCUMENTS_UNAVAILABLE',
  SUPPLIER_TERMS_UNAVAILABLE: 'SUPPLIER_TERMS_UNAVAILABLE',
  KNOWLEDGE_RETRIEVAL_UNAVAILABLE: 'KNOWLEDGE_RETRIEVAL_UNAVAILABLE',
} as const;

export const analysisDraftSchema = z.object({
  explanation: z.string().min(1),
  recommendedQuantity: z.number().int().nullable(),
  calculationExplanation: z.string().min(1),
  missingInformation: z.array(z.string()),
  citedChunkIds: z.array(z.string().uuid()),
});

export type AnalysisDraft = z.infer<typeof analysisDraftSchema>;

export type ProductObservation = {
  ok: true;
  id: string;
  name: string;
  code: string;
  packSize: string;
  packLabel: string;
  reorderLevel: number;
  status: string;
  categoryName: string;
  divisionName: string;
};

export type InventoryObservation = {
  ok: true;
  availableQuantity: number;
  reorderLevel: number;
  batches: Array<{
    batchNumber: string;
    quantityOnHand: number;
    expiryDate: string;
    expired: boolean;
  }>;
};

export type ConsumptionObservation = {
  ok: true;
  lookbackDays: number;
  since: string;
  salePacks: number;
  saleCount: number;
  returnPacks: number;
  damagePacks: number;
  expiryPacks: number;
};

export type KnowledgeObservation = {
  ok: true;
  unavailable: boolean;
  chunks: Array<{
    id: string;
    title: string;
    kind: string;
    content: string;
  }>;
};

export type ToolFailure = {
  ok: false;
  error: string;
};

export type InvestigationObservations = {
  getProduct?: ProductObservation | ToolFailure;
  getInventory?: InventoryObservation | ToolFailure;
  getConsumption?: ConsumptionObservation | ToolFailure;
  searchKnowledge?: KnowledgeObservation | ToolFailure;
};

const UNSUPPORTED_CLAIM = /lead time|days of cover|coverage days/i;

export function parseAnalysisDraft(
  content: unknown,
): { ok: true; draft: AnalysisDraft } | { ok: false; error: string } {
  const text = typeof content === 'string' ? content.trim() : '';
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return { ok: false, error: 'Reply with a single JSON object.' };
  }

  try {
    const parsed = analysisDraftSchema.safeParse(
      JSON.parse(text.slice(start, end + 1)),
    );
    if (!parsed.success) {
      return { ok: false, error: 'The JSON object does not match the analysis schema.' };
    }

    return { ok: true, draft: parsed.data };
  } catch {
    return { ok: false, error: 'The analysis reply was not valid JSON.' };
  }
}

export function validateAnalysisDraft(
  draft: AnalysisDraft,
  observations: InvestigationObservations,
): string[] {
  const errors: string[] = [];
  const product = observations.getProduct;
  const inventory = observations.getInventory;
  const consumption = observations.getConsumption;
  const knowledge = observations.searchKnowledge;

  if (!product?.ok) {
    errors.push('Call getProduct for the alerted product.');
  }
  if (!inventory?.ok) {
    errors.push('Call getInventory for the alerted product.');
  }
  if (!consumption?.ok) {
    errors.push('Call getConsumption for the alerted product.');
  }
  if (!knowledge?.ok) {
    errors.push('Call searchKnowledge before finishing.');
  }
  if (!product?.ok || !inventory?.ok || !consumption?.ok || !knowledge?.ok) {
    return errors;
  }

  if (product.reorderLevel !== inventory.reorderLevel) {
    errors.push('Product and inventory reorder levels do not match.');
  }

  const restoreQuantity = inventory.reorderLevel - inventory.availableQuantity;
  const citedChunks = knowledge.chunks.filter((chunk) =>
    draft.citedChunkIds.includes(chunk.id),
  );
  if (citedChunks.length !== draft.citedChunkIds.length) {
    errors.push('citedChunkIds must be ids returned by searchKnowledge.');
  }

  const statedInDocument = citedChunks.some((chunk) =>
    draft.recommendedQuantity === null
      ? false
      : chunk.content.includes(String(draft.recommendedQuantity)),
  );
  if (draft.recommendedQuantity !== restoreQuantity && !statedInDocument) {
    errors.push(
      `recommendedQuantity must be ${restoreQuantity}, the packs required to reach the reorder level, unless a cited document states that quantity.`,
    );
  }

  if (
    !draft.calculationExplanation.includes(String(inventory.availableQuantity))
  ) {
    errors.push(
      'calculationExplanation must include the available quantity from getInventory.',
    );
  }
  if (!draft.calculationExplanation.includes(String(inventory.reorderLevel))) {
    errors.push(
      'calculationExplanation must include the reorder level from getInventory.',
    );
  }

  if (
    consumption.saleCount === 0 &&
    !draft.missingInformation.includes(MissingFact.SALES_HISTORY_UNAVAILABLE)
  ) {
    errors.push(
      'missingInformation must include SALES_HISTORY_UNAVAILABLE when the ledger has no sale movements.',
    );
  }

  if (
    knowledge.unavailable &&
    !draft.missingInformation.includes(
      MissingFact.KNOWLEDGE_RETRIEVAL_UNAVAILABLE,
    )
  ) {
    errors.push(
      'missingInformation must include KNOWLEDGE_RETRIEVAL_UNAVAILABLE when retrieval fails.',
    );
  }

  if (
    !knowledge.unavailable &&
    knowledge.chunks.length === 0 &&
    !draft.missingInformation.includes(MissingFact.POLICY_DOCUMENTS_UNAVAILABLE)
  ) {
    errors.push(
      'missingInformation must include POLICY_DOCUMENTS_UNAVAILABLE when no documents are found.',
    );
  }

  const supplierRetrieved = knowledge.chunks.some(
    (chunk) => chunk.kind === 'SUPPLIER',
  );
  if (
    !supplierRetrieved &&
    !draft.missingInformation.includes(MissingFact.SUPPLIER_TERMS_UNAVAILABLE)
  ) {
    errors.push(
      'missingInformation must include SUPPLIER_TERMS_UNAVAILABLE when no supplier document was retrieved.',
    );
  }

  if (UNSUPPORTED_CLAIM.test(draft.calculationExplanation)) {
    const citedText = citedChunks.map((chunk) => chunk.content).join('\n');
    if (!UNSUPPORTED_CLAIM.test(citedText)) {
      errors.push(
        'Do not mention lead time or coverage unless a cited document states it.',
      );
    }
  }

  return errors;
}
