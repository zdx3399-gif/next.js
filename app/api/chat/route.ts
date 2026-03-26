import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/grok/grokmain';

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message || typeof message !== 'string') {
    return NextResponse.json({ error: '缺少 message 欄位' }, { status: 400 });
  }
  const result = await chat(message);
  return NextResponse.json(result);
}
