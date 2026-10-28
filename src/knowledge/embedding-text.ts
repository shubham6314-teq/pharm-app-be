export const EMBEDDING_DIMENSIONS = 768;

export function documentEmbeddingInput(title: string, content: string): string {
  const safeTitle = title.trim() || 'none';
  return `title: ${safeTitle} | text: ${content}`;
}

export function queryEmbeddingInput(query: string): string {
  return `task: search result | query: ${query}`;
}

export function toVectorLiteral(values: number[]): string {
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} embedding dimensions and received ${values.length}`,
    );
  }

  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Embedding values must be finite numbers');
  }

  return `[${values.join(',')}]`;
}
