import {
  documentEmbeddingInput,
  queryEmbeddingInput,
  toVectorLiteral,
} from './embedding-text.js';

describe('embedding text', () => {
  it('prefixes documents and queries for Gemini retrieval', () => {
    expect(documentEmbeddingInput('Cold chain', 'Store below 8C')).toBe(
      'title: Cold chain | text: Store below 8C',
    );
    expect(queryEmbeddingInput('reorder policy')).toBe(
      'task: search result | query: reorder policy',
    );
  });

  it('rejects a vector that is not 768 finite numbers', () => {
    expect(() => toVectorLiteral([1])).toThrow(/768/);
    expect(() => toVectorLiteral(Array.from({ length: 768 }, () => Number.NaN))).toThrow(
      /finite/,
    );
  });
});
