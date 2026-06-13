import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/grok/grokmain';

const MAX_QUESTION_LENGTH = 75;

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: '缺少 message 欄位' }, { status: 400 });
  }
  const normalizedMessage = message.trim();
  if (normalizedMessage.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json(
      { error: `每個問題最多 ${MAX_QUESTION_LENGTH} 字` },
      { status: 400 },
    );
  }
  const result = await chat(normalizedMessage);
  return NextResponse.json(result);
}
