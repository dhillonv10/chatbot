// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: 'claude-3-opus',
    label: 'Claude 3 Opus',
    apiIdentifier: 'claude-3-opus-20240229',
    description: 'Most powerful Claude model for complex tasks requiring deep analysis',
  },
  {
    id: 'claude-3-sonnet',
    label: 'Claude 3 Sonnet',
    apiIdentifier: 'claude-3-sonnet-20240229',
    description: 'Balanced Claude model for most tasks with excellent performance',
  },
  {
    id: 'claude-3-haiku',
    label: 'Claude 3 Haiku',
    apiIdentifier: 'claude-3-haiku-20240307',
    description: 'Fastest Claude model optimized for quick responses and simple tasks',
  }
] as const;

export const DEFAULT_MODEL_NAME: string = 'claude-3-sonnet';
