import { NextRequest, NextResponse } from 'next/server';
import { saveFeedback } from '@/lib/grok/chat-logger';

export async function POST(req: NextRequest) {
  const { chatId, rating, isHelpful, comment } = await req.json();
  if (!chatId) {
    return NextResponse.json({ error: '缺少 chatId' }, { status: 400 });
  }
  const result = await saveFeedback(chatId, rating ?? null, isHelpful ?? null, comment ?? null);
  return NextResponse.json(result);
}
