import type { Experimental_LanguageModelV1Middleware } from 'ai';

export const customMiddleware: Experimental_LanguageModelV1Middleware = {
  async chatCompletion(request, next) {
    // Ensure messages are properly formatted for Claude
    const formattedMessages = request.messages.map(message => ({
      ...message,
      role: message.role === 'user' ? 'user' : 'assistant',
      content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    }));

    // Call the next middleware with formatted messages
    const response = await next({
      ...request,
      messages: formattedMessages,
    });

    return response;
  }
};