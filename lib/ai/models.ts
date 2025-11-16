// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    apiIdentifier: 'claude-sonnet-4-5-20250929',
    description: 'Latest Claude Sonnet 4.5 model with superior performance and capabilities',
  },
  {
    id: 'claude-3-5-haiku',
    label: 'Claude 3.5 Haiku',
    apiIdentifier: 'claude-3-5-haiku-20241022',
    description: 'Fast and efficient Claude model for quick responses and simple tasks',
  }
] as const;

export const DEFAULT_MODEL_NAME: string = 'claude-sonnet-4-5';
