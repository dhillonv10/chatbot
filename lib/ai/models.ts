// Define your models here.

export interface Model {
  id: string;
  label: string;
  apiIdentifier: string;
  description: string;
}

export const models: Array<Model> = [
  {
    id: 'claude-3-sonnet',
    label: 'Claude 3 Sonnet',
    apiIdentifier: 'claude-3-5-sonnet-20241022',
    description: 'Latest Claude model for advanced reasoning and conversation',
  }
] as const;

export const DEFAULT_MODEL_NAME: string = 'claude-3-sonnet';
