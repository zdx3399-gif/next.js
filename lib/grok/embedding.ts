// embedding.ts - 使用 Cohere API 生成 embedding

import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();
const CACHE_MAX_SIZE = 50;
const CACHE_TTL = 60 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000;

export async function getEmbedding(text: string, inputType = 'search_query'): Promise<number[] | null> {
  const cacheKey = `${inputType}:${text}`;

  if (embeddingCache.has(cacheKey)) {
    const cached = embeddingCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[Embedding] 使用快取結果');
      return cached.embedding;
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
      model: 'embed-multilingual-v3.0',
      texts: [text],
      inputType: inputType as any,
    });

    const embedding = (response.embeddings as number[][])[0];

    embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
    if (embeddingCache.size > CACHE_MAX_SIZE) {
      const firstKey = embeddingCache.keys().next().value;
      if (firstKey) embeddingCache.delete(firstKey);
    }

    console.log(`[Embedding] 成功（快取: ${embeddingCache.size}/${CACHE_MAX_SIZE}）`);
    return embedding;
  } catch (error: any) {
    console.error('[Embedding] 生成失敗:', error.message);
    return null;
  }
}
