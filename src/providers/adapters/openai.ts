import type {
  ProviderAdapter,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
} from '../types.js';

/**
 * OpenAI provider adapter stub.
 * Implements the wire format for OpenAI API integration.
 */
export class OpenAIAdapter implements ProviderAdapter {
  readonly name = 'openai';
  readonly models = [
    'gpt-4o',
    'gpt-4o-mini',
    'o1',
    'o1-mini',
  ];

  private config: ProviderConfig = {};

  configure(config: ProviderConfig): void {
    this.config = config;
  }

  validateConfig(): boolean {
    return typeof this.config.apiKey === 'string' && this.config.apiKey.length > 0;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.validateConfig()) {
      throw new Error('OpenAI API key not configured');
    }

    const body = {
      model: request.model ?? this.config.defaultModel ?? this.models[0],
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
      stop: request.stopSequences,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(
      `${this.config.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      content: data.choices?.[0]?.message?.content ?? '',
      model: data.model ?? body.model,
      provider: this.name,
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      } : undefined,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }
}
