// grokmain.ts - 核心聊天邏輯（RAG + Groq）

import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from './embedding';
import { saveChatWithLearning } from './chat-logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';

const SYNONYMS: Record<string, string[]> = {
  '包裹': ['包裹', '郵件', '快遞', '宅配', '包包', '貨物', '寄件', '收件', '掛號'],
  '管費': ['管理費', '繳費', '費用', '管費', '月費', '社區費', '大樓費用', '管委會費用', '公共基金'],
  '訪客': ['訪客', '來訪', '客人', '訪問', '拜訪', '朋友來', '親友', '訪友'],
  '設施': ['設施', '公設', '公共設施', '健身房', '游泳池', '大廳', '會議室', '交誼廳', '閱覽室', '停車場'],
  '停車': ['停車', '車位', '停車場', '停車位', '車庫', '汽車', '機車', '停車費'],
  '維修': ['維修', '修理', '故障', '壞掉', '報修', '損壞', '不能用', '維護', '保養'],
  '投訴': ['投訴', '抱怨', '檢舉', '申訴', '反應', '反映', '建議', '意見'],
  '安全': ['安全', '保全', '門禁', '監視器', '警衛', '安全性', '防盜', '巡邏'],
  '垃圾': ['垃圾', '回收', '資源回收', '廚餘', '清潔', '打掃', '環境'],
  '寵物': ['寵物', '狗', '貓', '動物', '毛小孩', '養寵物'],
  '噪音': ['噪音', '吵', '聲音', '太吵', '噪音問題', '擾民', '安寧'],
  '會議': ['會議', '住戶大會', '區權會', '管委會', '開會', '會議紀錄'],
  '公告': ['公告', '通知', '消息', '最新消息', '公布', '佈告欄'],
  '其他': [],
};

function normalizeQuestion(text: string): string {
  let normalized = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/\s+/g, ' ').trim();

  for (const [mainWord, synonyms] of Object.entries(SYNONYMS)) {
    for (const synonym of synonyms) {
      if (normalized.includes(synonym.toLowerCase())) {
        normalized = normalized.replace(new RegExp(synonym.toLowerCase(), 'g'), mainWord);
      }
    }
  }
  return normalized;
}

function classifyIntent(text: string): { intent: string | null; confidence: number } {
  const lowerText = text.toLowerCase();
  const intentPatterns = [
    { intent: '包裹', keywords: ['包裹', '郵件', '快遞', '宅配', '收件', '寄件', '掛號'], confidence: 0.9 },
    { intent: '管費', keywords: ['管理費', '繳費', '費用', '管費', '月費', '社區費', '滯納金'], confidence: 0.9 },
    { intent: '訪客', keywords: ['訪客', '來訪', '客人', '訪問', '拜訪', '親友'], confidence: 0.85 },
    { intent: '設施', keywords: ['設施', '公設', '健身房', '游泳池', '大廳', '會議室', '交誼廳', '停車場'], confidence: 0.85 },
    { intent: '停車', keywords: ['停車', '車位', '停車場', '車庫', '汽車', '機車'], confidence: 0.85 },
    { intent: '維修', keywords: ['維修', '修理', '故障', '壞掉', '報修', '損壞', '不能用'], confidence: 0.85 },
    { intent: '投訴', keywords: ['投訴', '抱怨', '檢舉', '申訴', '反應', '反映'], confidence: 0.8 },
    { intent: '安全', keywords: ['安全', '保全', '門禁', '監視器', '警衛', '防盜'], confidence: 0.85 },
    { intent: '垃圾', keywords: ['垃圾', '回收', '資源回收', '廚餘', '清潔'], confidence: 0.85 },
    { intent: '寵物', keywords: ['寵物', '狗', '貓', '動物', '毛小孩'], confidence: 0.85 },
    { intent: '噪音', keywords: ['噪音', '吵', '太吵', '擾民', '安寧'], confidence: 0.85 },
    { intent: '會議', keywords: ['會議', '住戶大會', '區權會', '管委會', '開會'], confidence: 0.85 },
    { intent: '公告', keywords: ['公告', '通知', '消息', '最新消息', '佈告欄'], confidence: 0.8 },
  ];

  let bestMatch: { intent: string | null; confidence: number } = { intent: null, confidence: 0 };
  for (const pattern of intentPatterns) {
    let matchCount = 0;
    for (const keyword of pattern.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) matchCount++;
    }
    if (matchCount > 0) {
      const confidence = Math.min(pattern.confidence * (matchCount / pattern.keywords.length * 2), 1.0);
      if (confidence > bestMatch.confidence) bestMatch = { intent: pattern.intent, confidence };
    }
  }
  return bestMatch;
}

export interface ChatResult {
  answer?: string;
  images?: string[];
  sources?: any[];
  chatId?: number | null;
  error?: string;
}

export async function chat(query: string, onStatus?: (status: string) => void): Promise<ChatResult> {
  const sendStatus = (status: string) => { if (typeof onStatus === 'function') onStatus(status); };
  const startTime = Date.now();
  let searchMethod = 'vector';
  let maxSimilarity = 0;
  let matchCount = 0;
  const apiUsed = { cohere: false, groq: false };

  const normalized_question = normalizeQuestion(query);
  const intentResult = classifyIntent(query);
  const intent = intentResult.intent;
  const intent_confidence = intentResult.confidence > 0 ? intentResult.confidence : null;
  let answered = false;

  sendStatus('正在理解您的問題...');

  // 1. 生成 embedding
  const queryEmbedding = await getEmbedding(query, 'search_query');
  if (queryEmbedding) apiUsed.cohere = true;

  // Fallback: embedding 失敗 → 純關鍵字搜尋
  if (!queryEmbedding) {
    searchMethod = 'fallback';
    sendStatus('正在使用關鍵字搜尋...');
    const words = query.match(/[\u4e00-\u9fa5]|\w+/g) || [];
    const ngrams: string[] = [];
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) ngrams.push(words.slice(i, i + n).join(''));
    }

    const { data: allData } = await supabase.from('knowledge').select('id, content').not('embedding', 'is', null);
    if (allData && allData.length > 0) {
      const keywordMatches = allData.filter(item => ngrams.some(kw => item.content.includes(kw)));
      matchCount = keywordMatches.length;
      if (keywordMatches.length > 0) {
        const context = keywordMatches.slice(0, 3).map(item => item.content).join('\n\n---\n\n');
        sendStatus('找到相關資料，正在生成回答...');
        try {
          apiUsed.groq = true;
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({
              model: GROQ_MODEL,
              messages: [
                { role: 'system', content: '你是檢索增強型助理，回答一律使用繁體中文，只能根據參考資料回答。' },
                { role: 'user', content: `問題：${query}\n\n參考資料：\n${context}` },
              ],
              temperature: 0.3,
            }),
          });
          const data = await res.json();
          const answer = data.choices[0].message.content;
          const saveResult = await saveChatWithLearning({
            question: query, question_embedding: null, answer,
            sources: null, images: [], search_method: searchMethod,
            similarity: 0, match_count: matchCount,
            response_ms: Date.now() - startTime, api_used: apiUsed,
          });
          return { answer, images: [], chatId: saveResult.chatId };
        } catch {
          return { answer: '抱歉，AI 服務暫時無法使用，請稍後再試。', images: [] };
        }
      }
    }
    return { answer: '抱歉，我找不到相關資料來回答這個問題。', images: [] };
  }

  sendStatus('正在搜尋知識庫...');

  // 2. 向量搜尋
  const { data: searchResults, error: searchError } = await supabase.rpc('search_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: 0.25,
    match_count: 5,
  });
  if (searchError) return { error: '搜尋失敗' };

  let finalResults = searchResults;
  const maxSim = searchResults?.[0]?.similarity || 0;
  maxSimilarity = maxSim;

  // 3. 相似度不足 → 關鍵字 fallback
  if (!searchResults || searchResults.length === 0 || maxSim < 0.35) {
    searchMethod = 'keyword';
    sendStatus('相似度不足，切換至關鍵字搜尋...');
    const words = query.match(/[\u4e00-\u9fa5]|\w+/g) || [];
    const ngrams: string[] = [];
    for (let n = 1; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) ngrams.push(words.slice(i, i + n).join(''));
    }
    const { data: allData } = await supabase.from('knowledge').select('id, content').not('embedding', 'is', null);
    if (allData) {
      const keywordMatches = allData.filter(item => ngrams.some(kw => item.content.includes(kw)));
      matchCount = keywordMatches.length;
      if (keywordMatches.length > 0) {
        finalResults = keywordMatches.slice(0, 3).map((item, idx) => ({
          id: item.id, content: item.content, similarity: 0.5 - idx * 0.1,
        }));
        maxSimilarity = finalResults[0]?.similarity || 0;
      }
    }
  }

  // 4. 完全找不到 → 試圖用圖片回答
  if (!finalResults || finalResults.length === 0) {
    const { data: imageResults } = await supabase.rpc('search_images', {
      query_embedding: queryEmbedding, match_threshold: 0.4, match_count: 1,
    });
    const images = imageResults?.map((img: any) => img.url) || [];
    if (images.length > 0) {
      const imgDesc = imageResults[0]?.description || '相關設施';
      return { answer: `以下是${imgDesc}的相關圖片。`, images };
    }
    return { answer: '抱歉，我找不到相關資料來回答這個問題。', images: [] };
  }

  const context = finalResults.slice(0, 3).map((item: any) => item.content).join('\n\n---\n\n');

  // 5. 搜尋相關圖片
  const { data: imageResults } = await supabase.rpc('search_images', {
    query_embedding: queryEmbedding, match_threshold: 0.65, match_count: 3,
  });
  const images = imageResults?.map((img: any) => img.url) || [];

  sendStatus('正在生成回答...');

  // 6. Groq API 生成回答
  try {
    let systemPrompt = '你是檢索增強型助理，回答一律使用繁體中文，只能根據參考資料回答，不可補充或推測任何未在參考資料中的內容。';
    if (images.length > 0) {
      const imgDesc = imageResults[0]?.description || '相關設施';
      systemPrompt += `\n\n【圖片已附加】使用者可以看到${imgDesc}的圖片。請在回答中提及「如圖所示」或「請參考圖片」。`;
    }

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `問題：${query}\n\n參考資料：\n${context}` },
        ],
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    apiUsed.groq = true;
    const answer = data.choices[0].message.content;

    const negativePatterns = ['找不到相關資料', '沒有找到', '無法回答', '沒有提及', '並無提及', '無相關', '未提及', '沒有提到', '無法提供', '抱歉'];
    const isNotFoundAnswer = negativePatterns.some(p => answer.includes(p));
    answered = !isNotFoundAnswer && finalResults.length > 0;

    // 寫入 chat_log
    await supabase.from('chat_log').insert([{
      raw_question: query, normalized_question, intent, intent_confidence,
      answered, created_at: new Date().toISOString(),
    }]);

    // 儲存對話記錄 + 學習佇列判斷
    matchCount = searchResults?.length || 0;
    const saveResult = await saveChatWithLearning({
      question: query, question_embedding: queryEmbedding, answer,
      sources: searchResults?.slice(0, 3) || null, images,
      search_method: searchMethod, similarity: maxSimilarity,
      match_count: matchCount, response_ms: Date.now() - startTime, api_used: apiUsed,
    });

    return { answer, images, sources: searchResults?.slice(0, 3), chatId: saveResult.chatId };
  } catch (error: any) {
    console.error('[Error] Groq API:', error.message);
    await supabase.from('chat_log').insert([{
      raw_question: query, normalized_question, intent, intent_confidence,
      answered: false, created_at: new Date().toISOString(),
    }]);
    return { error: 'AI 回答生成失敗' };
  }
}
