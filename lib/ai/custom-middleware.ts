import { NextRequest, NextResponse } from 'next/server';

export async function customMiddleware(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicKey) {
    return new NextResponse('Anthropic API key is required', { status: 500 });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (!body.messages || !Array.isArray(body.messages)) {
        return new NextResponse('Messages are required', { status: 400 });
      }
    } catch (error) {
      return new NextResponse('Invalid JSON', { status: 400 });
    }
  }

  return NextResponse.next();
}