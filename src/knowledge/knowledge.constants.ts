export const KNOWLEDGE_FILE_FIELD = 'file';
export const KNOWLEDGE_MAX_BYTES = 5 * 1024 * 1024;
export const KNOWLEDGE_CHUNK_SIZE = 1000;
export const KNOWLEDGE_CHUNK_OVERLAP = 150;
export const KNOWLEDGE_SEARCH_LIMIT = 4;

export const KNOWLEDGE_FILE_MESSAGE =
  'Upload a plain text, Markdown, or PDF document';
export const KNOWLEDGE_EMPTY_MESSAGE =
  'The document did not contain any readable text';
export const KNOWLEDGE_EMBEDDING_UNAVAILABLE_MESSAGE =
  'Document embedding is unavailable';
export const KNOWLEDGE_TITLE_MESSAGE = 'Enter a document title';

export const KnowledgeDocumentKindValues = ['POLICY', 'SUPPLIER'] as const;
