export type DatabaseOperationUsage = {
  name: string
  kind: "read" | "write" | "rpc"
  rows: number
  durationMs: number
  error?: string
}

export type ChatUsage = {
  cohere: {
    model: string
    inputType: string
    inputTokens: number
    billedInputTokens: number
    cacheHit: boolean
    requestCount: number
    durationMs: number
  }
  groq: {
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cachedPromptTokens: number
    reasoningTokens: number
    systemPromptCharacters: number
    userPromptCharacters: number
    estimatedSystemPromptTokens: number
    estimatedUserPromptTokens: number
    queueTimeMs: number | null
    promptTimeMs: number | null
    completionTimeMs: number | null
    totalTimeMs: number | null
    requestCount: number
  }
  rag: {
    questionCharacters: number
    normalizedQuestionCharacters: number
    contextCharacters: number
    estimatedContextTokens: number
    sourceCount: number
    searchMethod: string
  }
  database: {
    tokenUsage: 0
    queryCount: number
    readCount: number
    writeCount: number
    rpcCount: number
    rowsRead: number
    rowsWritten: number
    totalDurationMs: number
    operations: DatabaseOperationUsage[]
  }
  totals: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
    requestDurationMs: number
  }
  notes: string[]
}

export function createEmptyChatUsage(model: string, question: string): ChatUsage {
  return {
    cohere: {
      model: "embed-multilingual-v3.0",
      inputType: "search_query",
      inputTokens: 0,
      billedInputTokens: 0,
      cacheHit: false,
      requestCount: 0,
      durationMs: 0,
    },
    groq: {
      model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cachedPromptTokens: 0,
      reasoningTokens: 0,
      systemPromptCharacters: 0,
      userPromptCharacters: 0,
      estimatedSystemPromptTokens: 0,
      estimatedUserPromptTokens: 0,
      queueTimeMs: null,
      promptTimeMs: null,
      completionTimeMs: null,
      totalTimeMs: null,
      requestCount: 0,
    },
    rag: {
      questionCharacters: question.length,
      normalizedQuestionCharacters: 0,
      contextCharacters: 0,
      estimatedContextTokens: 0,
      sourceCount: 0,
      searchMethod: "vector",
    },
    database: {
      tokenUsage: 0,
      queryCount: 0,
      readCount: 0,
      writeCount: 0,
      rpcCount: 0,
      rowsRead: 0,
      rowsWritten: 0,
      totalDurationMs: 0,
      operations: [],
    },
    totals: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      requestDurationMs: 0,
    },
    notes: [
      "Groq 與 Cohere token 來自供應商回傳的 usage。",
      "資料庫查詢不消耗模型 token，因此以查詢次數、資料筆數與耗時統計。",
      "RAG context token 為字元數換算估計值，實際 prompt token 以 Groq usage 為準。",
    ],
  }
}

export function finalizeChatUsage(usage: ChatUsage, startedAt: number): ChatUsage {
  usage.database.queryCount = usage.database.operations.length
  usage.database.readCount = usage.database.operations.filter((item) => item.kind === "read").length
  usage.database.writeCount = usage.database.operations.filter((item) => item.kind === "write").length
  usage.database.rpcCount = usage.database.operations.filter((item) => item.kind === "rpc").length
  usage.database.rowsRead = usage.database.operations
    .filter((item) => item.kind !== "write")
    .reduce((sum, item) => sum + item.rows, 0)
  usage.database.rowsWritten = usage.database.operations
    .filter((item) => item.kind === "write")
    .reduce((sum, item) => sum + item.rows, 0)
  usage.database.totalDurationMs = usage.database.operations.reduce((sum, item) => sum + item.durationMs, 0)
  usage.totals.inputTokens = usage.cohere.billedInputTokens + usage.groq.promptTokens
  usage.totals.outputTokens = usage.groq.completionTokens
  usage.totals.totalTokens = usage.totals.inputTokens + usage.totals.outputTokens
  usage.totals.requestDurationMs = Date.now() - startedAt
  return usage
}

export function estimateTokensFromCharacters(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 2)
}
