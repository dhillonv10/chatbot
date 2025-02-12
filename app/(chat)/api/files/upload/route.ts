// File: /app/(chat)/api/files/upload/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import type { Attachment } from '@/types/chat';

// Update the file schema to include PDFs and images
const FileSchema = z.object({
    file: z
        .instanceof(Blob)
        .refine((file) => file.size <= 32 * 1024 * 1024, {
            message: 'File size should be less than 32MB',
        })
        .refine((file) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type), {
            message: 'File type should be PDF, JPEG, or PNG',
        }),
});

export async function POST(request: Request) {
    const session = await auth();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (request.body === null) {
        return new Response('Request body is empty', { status: 400 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const validatedFile = FileSchema.safeParse({ file });

        if (!validatedFile.success) {
            const errorMessage = validatedFile.error.errors
                .map((error) => error.message)
                .join(', ');

            return NextResponse.json({ error: errorMessage }, { status: 400 });
        }

        // Convert file to base64
        const fileBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

        // Prepare the message for Claude
        const message = {
            id: crypto.randomUUID(),
            role: 'user' as const,
            content: `I'm sending you a ${file.type} file named "${file.name}". Please analyze its contents and provide a detailed response.\n\nFile contents (base64): ${base64}`
        };

        // Send to Claude and get streaming response
        const model = customModel('claude-3-sonnet-20240229');
        const stream = await model.invoke({ 
            messages: [message],
            options: {
                system: "You are an expert at analyzing files. For images, describe what you see in detail. For PDFs, summarize the key points and provide relevant insights."
            }
        });

        // Return the stream with appropriate headers
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('File processing error:', error);
        return NextResponse.json(
            { error: 'Failed to process file' },
            { status: 500 },
        );
    }
}
