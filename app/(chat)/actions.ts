import { generateText, LanguageModelV1 } from 'ai'
import { customModel } from '@/lib/ai'
import { saveModelId as saveModelIdToDb } from '@/lib/db/queries'
import { models } from '@/lib/ai/models'

export async function saveModelId({ modelId }: { modelId: string }) {
  return saveModelIdToDb({ modelId })
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: string
}) {
  const model = models.find(m => m.id === 'claude-3-5-sonnet-20241022')
  if (!model) {
    throw new Error('Model not found')
  }

  const anthropicModel: LanguageModelV1 = {
    invoke: async (prompt: string) => {
      const result = await customModel(model.apiIdentifier)(prompt)
      return { text: result }
    }
  }

  const { text: title } = await generateText({
    model: anthropicModel,
    system: `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be concise and descriptive
    `,
    prompt: `Generate a title for this message: ${message}`,
  })

  return title.trim()
}