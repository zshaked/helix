import type { CanonicalMessage } from '../canonical/builder.js';

export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  [key: string]: unknown;
}

export interface CompletionRequest {
  messages: CanonicalMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface CompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  finishReason?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * Provider adapter interface.
 * Each LLM provider implements this to integrate with Helix.
 */
export interface ProviderAdapter {
  readonly name: string;
  readonly models: string[];

  configure(config: ProviderConfig): void;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream?(request: CompletionRequest): AsyncIterable<StreamChunk>;
  validateConfig(): boolean;
}
