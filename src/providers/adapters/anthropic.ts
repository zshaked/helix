import type {
  ProviderAdapter,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
} from '../types.js';

/**
 * Anthropic provider adapter stub.
 * Implements the wire format for Claude API integration.
 */
export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  readonly models = [
    'claude-opus-4-20250514',
    'claude-sonnet-4-20250514',
    'claude-haiku-4-5-20251001',
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
      throw new Error('Anthropic API key not configured');
    }

    // Transform canonical messages to Anthropic wire format
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const conversationMessages = request.messages.filter(m => m.role !== 'system');

    const body = {
      model: request.model ?? this.config.defaultModel ?? this.models[0],
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature,
      stop_sequences: request.stopSequences,
      system: systemMessages.map(m => m.content).join('\n\n') || undefined,
      messages: conversationMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const response = await fetch(
      `${this.config.baseUrl ?? 'https://api.anthropic.com'}/v1/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;

    return {
      content: data.content?.[0]?.text ?? '',
      model: data.model ?? body.model,
      provider: this.name,
      usage: data.usage ? {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      } : undefined,
      finishReason: data.stop_reason,
    };
  }
}
