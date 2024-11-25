import { auth } from '@/app/(auth)/auth'
import { saveDocument, getDocumentById } from '@/lib/db/queries'
import { generateUUID } from '@/lib/utils'

export async function POST(request: Request) {
  const { title, content } = await request.json()
  const session = await auth()

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const id = generateUUID()
  await saveDocument({
    id,
    title,
    content,
    userId: session.user.id,
  })

  return new Response(JSON.stringify({ id, title }), { status: 200 })
}

export async function PUT(request: Request) {
  const { id, content } = await request.json()
  const session = await auth()

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const document = await getDocumentById({ id })

  if (!document || document.userId !== session.user.id) {
    return new Response('Not Found', { status: 404 })
  }

  await saveDocument({
    id,
    title: document.title,
    content,
    userId: session.user.id,
  })

  return new Response(JSON.stringify({ id, title: document.title }), { status: 200 })
}