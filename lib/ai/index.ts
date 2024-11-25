import { Anthropic } from '@anthropic-ai/sdk'

// Initialize the Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Custom model function (adjust as needed for your use case)
export const customModel = (model: string) => {
  return async (prompt: string) => {
    const response = await anthropic.completions.create({
      model: model,
      prompt: prompt,
      max_tokens_to_sample: 1000,
    })
    return response.completion
  }
}