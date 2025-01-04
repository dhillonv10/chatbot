// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: 'claude-3-5-sonnet',
    label: 'Claude 3.5 Sonnet',
    apiIdentifier: 'claude-3-5-sonnet-20241022',
    description: 'Latest Claude model optimized for complex tasks with excellent performance',
  },
  {
    id: 'claude-3-5-haiku',
    label: 'Claude 3.5 Haiku',
    apiIdentifier: 'claude-3-5-haiku-20241022',
    description: 'Fast and efficient Claude model for quick responses and simple tasks',
  }
] as const;

export const DEFAULT_MODEL_NAME: string = 'claude-3-5-sonnet';
