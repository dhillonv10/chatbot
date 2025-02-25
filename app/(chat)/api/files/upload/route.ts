// File: /app/(chat)/api/files/upload/route.ts
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';

import { auth } from '@/app/(auth)/auth';

// Update the file schema to prioritize PDFs
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

        // Get filename from formData since Blob doesn't have name property
        const originalFilename = (formData.get('file') as File).name;
        
        // Add a hash to the filename to avoid collisions
        const filenameParts = originalFilename.split('.');
        const extension = filenameParts.pop() || '';
        const nameWithoutExtension = filenameParts.join('.');
        const hash = crypto.randomBytes(8).toString('hex');
        const filename = `${nameWithoutExtension}-${hash}.${extension}`;
        
        const fileBuffer = await file.arrayBuffer();
        
        // Set appropriate caching headers based on file type
        const cacheControl = file.type === 'application/pdf' 
            ? 'public, max-age=31536000' // 1 year for PDFs
            : 'public, max-age=604800';  // 1 week for other files

        try {
            console.log(`Uploading file: ${filename} (${file.type})`);
            
            const data = await put(filename, fileBuffer, {
                access: 'public',
                cacheControl,
                contentType: file.type,
            });

            console.log(`File uploaded successfully: ${data.url}`);

            // Return both the URL and file metadata
            return NextResponse.json({
                url: data.url,
                contentType: file.type,
                name: originalFilename,
                size: file.size,
            });
        } catch (error) {
            console.error('Upload failed:', error);
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }
    } catch (error) {
        console.error('Failed to process request:', error);
        return NextResponse.json(
            { error: 'Failed to process request' },
            { status: 500 },
        );
    }
}