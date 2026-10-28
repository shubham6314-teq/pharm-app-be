import {
  MissingFact,
  parseAnalysisDraft,
  validateAnalysisDraft,
  type InvestigationObservations,
} from './analysis-draft.js';

const productId = '33333333-3333-4333-8333-333333333333';
const chunkId = '55555555-5555-4555-8555-555555555555';

const observations: InvestigationObservations = {
  getProduct: {
    ok: true,
    id: productId,
    name: 'Crocin',
    code: 'CRO',
    packSize: '10 tablets',
    packLabel: 'boxes',
    reorderLevel: 50,
    status: 'ACTIVE',
    categoryName: 'Antipyretics',
    divisionName: 'General',
  },
  getInventory: {
    ok: true,
    availableQuantity: 40,
    reorderLevel: 50,
    batches: [],
  },
  getConsumption: {
    ok: true,
    lookbackDays: 30,
    since: '2026-09-27T00:00:00.000Z',
    salePacks: 0,
    saleCount: 0,
    returnPacks: 0,
    damagePacks: 0,
    expiryPacks: 0,
  },
  searchKnowledge: {
    ok: true,
    unavailable: false,
    chunks: [],
  },
};

const validDraft = {
  explanation: 'Available stock is below the reorder level.',
  recommendedQuantity: 10,
  calculationExplanation:
    'Available quantity is 40 and the reorder level is 50, so 10 packs restore the reorder level.',
  missingInformation: [
    MissingFact.SALES_HISTORY_UNAVAILABLE,
    MissingFact.POLICY_DOCUMENTS_UNAVAILABLE,
    MissingFact.SUPPLIER_TERMS_UNAVAILABLE,
  ],
  citedChunkIds: [],
};

describe('analysis draft validation', () => {
  it('accepts a restore-to-reorder-level recommendation grounded in tool output', () => {
    expect(validateAnalysisDraft(validDraft, observations)).toEqual([]);
  });

  it('rejects an invented lead time and a quantity that was not observed', () => {
    const errors = validateAnalysisDraft(
      {
        ...validDraft,
        recommendedQuantity: 90,
        calculationExplanation:
          'Available quantity is 40 and the reorder level is 50. Assume a 14 day lead time.',
      },
      observations,
    );

    expect(errors.some((error) => error.includes('must be 10'))).toBe(true);
    expect(errors.some((error) => error.includes('lead time'))).toBe(true);
  });

  it('requires the sales and document gaps to be stated when those tools are empty', () => {
    const errors = validateAnalysisDraft(
      { ...validDraft, missingInformation: [] },
      observations,
    );

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(MissingFact.SALES_HISTORY_UNAVAILABLE),
        expect.stringContaining(MissingFact.POLICY_DOCUMENTS_UNAVAILABLE),
        expect.stringContaining(MissingFact.SUPPLIER_TERMS_UNAVAILABLE),
      ]),
    );
  });

  it('allows a quantity that a cited document states', () => {
    const errors = validateAnalysisDraft(
      {
        ...validDraft,
        recommendedQuantity: 24,
        calculationExplanation:
          'Available quantity is 40 and the reorder level is 50. The cited policy states 24.',
        citedChunkIds: [chunkId],
        missingInformation: [
          MissingFact.SALES_HISTORY_UNAVAILABLE,
          MissingFact.SUPPLIER_TERMS_UNAVAILABLE,
        ],
      },
      {
        ...observations,
        searchKnowledge: {
          ok: true,
          unavailable: false,
          chunks: [
            {
              id: chunkId,
              title: 'Reorder policy',
              kind: 'POLICY',
              content: 'The standard replenishment quantity is 24 packs.',
            },
          ],
        },
      },
    );

    expect(errors).toEqual([]);
  });

  it('extracts the JSON object from a fenced reply', () => {
    const parsed = parseAnalysisDraft(
      '```json\n' + JSON.stringify(validDraft) + '\n```',
    );

    expect(parsed.ok).toBe(true);
  });
});
