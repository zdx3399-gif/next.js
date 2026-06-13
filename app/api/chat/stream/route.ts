import { NextRequest } from 'next/server';
import { chat } from '@/lib/grok/grokmain';

const MAX_QUESTION_LENGTH = 75;

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message || typeof message !== 'string') {
    return new Response('缺少 message 欄位', { status: 400 });
  }
  const normalizedMessage = message.trim();
  if (normalizedMessage.length > MAX_QUESTION_LENGTH) {
    return new Response(`每個問題最多 ${MAX_QUESTION_LENGTH} 字`, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await chat(normalizedMessage, (status: string) => {
        sendEvent({ type: 'status', status });
      })
        .then((result) => {
          sendEvent({ type: 'result', ...result });
          controller.close();
        })
        .catch((err: any) => {
          sendEvent({ type: 'error', content: err.message || '發生錯誤' });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
