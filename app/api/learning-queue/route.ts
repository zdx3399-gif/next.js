import { NextRequest, NextResponse } from 'next/server';
import { getLearningQueue, updateLearningQueueStatus, getPerformanceMetrics } from '@/lib/grok/chat-logger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  if (type === 'metrics') {
    const metrics = await getPerformanceMetrics();
    return NextResponse.json(metrics);
  }

  const status = searchParams.get('status') || 'needs_review';
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const queue = await getLearningQueue(status, limit);
  return NextResponse.json(queue);
}

export async function PATCH(req: NextRequest) {
  const { id, status, adminNotes } = await req.json();
  if (!id || !status) {
    return NextResponse.json({ error: '缺少 id 或 status' }, { status: 400 });
  }
  const result = await updateLearningQueueStatus(id, status, adminNotes ?? null);
  return NextResponse.json(result);
}
