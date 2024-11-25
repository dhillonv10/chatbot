import { AnthropicStream, StreamingTextResponse, Message } from 'ai'
import { Anthropic } from '@anthropic-ai/sdk'
import { auth } from '@/app/(auth)/auth'
import { models } from '@/lib/ai/models'
import { systemPrompt } from '@/lib/ai/prompts'
import {
  deleteChatById,
  getChatById,
  getDocumentById,
  saveChat,
  saveDocument,
  saveMessages,
  saveSuggestions,
} from '@/lib/db/queries'
import type { Suggestion } from '@/lib/db/schema'
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils'
import { generateTitleFromUserMessage } from '../../actions'

export const maxDuration = 60

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

export async function POST(request: Request) {
  const { id, messages, modelId }: { id: string; messages: Array<Message>; modelId: string } = await request.json()

  const session = await auth()

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const model = models.find((model) => model.id === modelId)

  if (!model) {
    return new Response('Model not found', { status: 404 })
  }

  const userMessage = getMostRecentUserMessage(messages)

  if (!userMessage) {
    return new Response('No user message found', { status: 400 })
  }

  const chat = await getChatById({ id })

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage.content })
    await saveChat({ id, userId: session.user.id, title })
  }

  await saveMessages({
    messages: [
      { ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id },
    ],
  })

  const response = await anthropic.completions.create({
    model: model.apiIdentifier,
    max_tokens_to_sample: 1000,
    prompt: `${systemPrompt}\n\nHuman: ${userMessage.content}\n\nAssistant:`,
    stream: true,
  })

  const stream = AnthropicStream(response)

  return new StreamingTextResponse(stream)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Not Found', { status: 404 })
  }

  const session = await auth()

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const chat = await getChatById({ id })

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 })
    }

    await deleteChatById({ id })

    return new Response('Chat deleted', { status: 200 })
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    })
  }
}