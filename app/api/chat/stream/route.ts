import { NextRequest } from 'next/server';
import { chat } from '@/lib/grok/grokmain';

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message || typeof message !== 'string') {
    return new Response('缺少 message 欄位', { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await chat(message, (status: string) => {
        sendEvent({ type: 'status', content: status });
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
