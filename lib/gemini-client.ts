type GeminiGenerateResult = {
  data: any
  model: string
  apiVersion: "v1beta" | "v1"
}

type GenerateGeminiContentParams = {
  apiKey: string
  payload: any
  debugLabel?: string
}

const DEFAULT_MODEL_PREFERENCES = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro",
]

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

async function listGenerateModels(apiKey: string): Promise<string[]> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    if (!res.ok) return []

    const json = await res.json()
    const models: any[] = Array.isArray(json?.models) ? json.models : []

    return models
      .filter((m) => {
        const methods = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : []
        return methods.includes("generateContent")
      })
      .map((m) => String(m?.name || "").replace(/^models\//, ""))
      .filter((name) => name.startsWith("gemini-"))
  } catch {
    return []
  }
}

function getModelOrder(availableModels: string[]) {
  const envModel = process.env.GEMINI_MODEL?.trim()
  const preferred = uniqueStrings([envModel || "", ...DEFAULT_MODEL_PREFERENCES])
  const available = uniqueStrings(availableModels)
  const merged = uniqueStrings([...preferred, ...available])

  return merged.filter((name) => name.startsWith("gemini-"))
}

export async function generateGeminiContent({ apiKey, payload, debugLabel }: GenerateGeminiContentParams): Promise<GeminiGenerateResult> {
  const availableModels = await listGenerateModels(apiKey)
  const modelOrder = getModelOrder(availableModels)
  const versions: Array<"v1beta" | "v1"> = ["v1beta", "v1"]
  const errors: string[] = []

  for (const model of modelOrder) {
    for (const version of versions) {
      const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const bodyText = await response.text()
          errors.push(`${version}/${model}: ${response.status} ${response.statusText} ${bodyText.slice(0, 200)}`)
          continue
        }

        const data = await response.json()
        if (debugLabel) {
          console.log(`[v0] ${debugLabel} 使用模型: ${model} (${version})`)
        }

        return {
          data,
          model,
          apiVersion: version,
        }
      } catch (error: any) {
        errors.push(`${version}/${model}: network_error ${error?.message || "unknown"}`)
      }
    }
  }

  throw new Error(`Gemini API all model attempts failed. ${errors.slice(0, 8).join(" | ")}`)
}
