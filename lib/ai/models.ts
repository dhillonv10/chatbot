// lib/ai/models.ts
export const DEFAULT_MODEL_NAME = 'claude-3-5-sonnet-20241022';

export const models = [
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    apiIdentifier: 'claude-3-5-sonnet-20241022'
  }
];

export const encodeFileToBase64 = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1] || '';
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};