// embedding.ts - 使用 Cohere API 生成 embedding

import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export type EmbeddingUsageResult = {
  embedding: number[] | null
  inputTokens: number
  billedInputTokens: number
  cacheHit: boolean
  durationMs: number
  model: string
  inputType: string
}

const EMBEDDING_MODEL = 'embed-multilingual-v3.0';
const embeddingCache = new Map<string, { embedding: number[]; inputTokens: number; timestamp: number }>();
const CACHE_MAX_SIZE = 50;
const CACHE_TTL = 60 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000;

export async function getEmbeddingWithUsage(text: string, inputType = 'search_query'): Promise<EmbeddingUsageResult> {
  const startedAt = Date.now();
  const cacheKey = `${inputType}:${text}`;

  if (embeddingCache.has(cacheKey)) {
    const cached = embeddingCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Embedding] 使用快取結果');
      return {
        embedding: cached.embedding,
        inputTokens: cached.inputTokens,
        billedInputTokens: 0,
        cacheHit: true,
        durationMs: Date.now() - startedAt,
        model: EMBEDDING_MODEL,
        inputType,
      };
    }
    embeddingCache.delete(cacheKey);
  }

  try {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
    }
    lastRequestTime = Date.now();

    const response = await cohere.embed({
      model: EMBEDDING_MODEL,
      texts: [text],
      inputType: inputType as any,
    });

    const embedding = (response.embeddings as number[][])[0];
    const responseMeta = (response as any).meta;
    const inputTokens = Number(
      responseMeta?.tokens?.inputTokens ??
      responseMeta?.billedUnits?.inputTokens ??
      0
    );
    const billedInputTokens = Number(responseMeta?.billedUnits?.inputTokens ?? inputTokens);

    embeddingCache.set(cacheKey, { embedding, inputTokens, timestamp: Date.now() });
    if (embeddingCache.size > CACHE_MAX_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) embeddingCache.delete(firstKey);
    }

    console.log(`[Embedding] 成功（快取: ${embeddingCache.size}/${CACHE_MAX_SIZE}）`);
    return {
      embedding,
      inputTokens,
      billedInputTokens,
      cacheHit: false,
      durationMs: Date.now() - startedAt,
      model: EMBEDDING_MODEL,
      inputType,
    };
  } catch (error: any) {
    console.error('[Embedding] 生成失敗:', error.message);
    return {
      embedding: null,
      inputTokens: 0,
      billedInputTokens: 0,
      cacheHit: false,
      durationMs: Date.now() - startedAt,
      model: EMBEDDING_MODEL,
      inputType,
    };
  }
}

export async function getEmbedding(text: string, inputType = 'search_query'): Promise<number[] | null> {
  return (await getEmbeddingWithUsage(text, inputType)).embedding;
}
