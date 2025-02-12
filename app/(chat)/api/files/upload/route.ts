// File: /app/(chat)/api/files/upload/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai/index';

// Update the file schema to include PDFs
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
        const file = formData.get('file') as Blob;

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

        const uploadedFile = formData.get('file') as File;
        const filename = uploadedFile.name;
        const fileBuffer = await file.arrayBuffer();

        // Convert the file buffer to a base64 encoded string
        const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

        // Prepare a message with attached file content in base64 format
        const message = {
            role: 'user',
            content: `User uploaded file: ${filename}\nContent (base64): ${base64}`
        };

        // Invoke Anthropic Claude API using the customModel with identifier 'claude-v1'
        const model = customModel('claude-v1');
        const stream = await model.invoke({ messages: [message] });

        // Return streaming response with proper headers for SSE
        return new Response(stream, {
            headers: { 'Content-Type': 'text/event-stream' }
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 },
        );
    }
}
