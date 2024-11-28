export const models = {
  claude: {
    id: 'claude-2',
    name: 'Claude 2',
    description: 'Most capable model for complex tasks',
    maxTokens: 100000
  },
  claudeInstant: {
    id: 'claude-instant-1',
    name: 'Claude Instant',
    description: 'Faster and more cost-effective for simpler tasks',
    maxTokens: 100000
  }
} as const;

export type ModelId = keyof typeof models;