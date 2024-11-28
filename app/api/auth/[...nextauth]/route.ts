import { NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';

export async function GET(request: Request) {
  const response = await auth(request);
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const response = await auth(request);
  return NextResponse.json(response);
}