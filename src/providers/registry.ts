import type { ProviderAdapter, CompletionRequest, CompletionResponse, ProviderConfig } from './types.js';

/**
 * Provider registry — manages available LLM provider adapters.
 * Models are interchangeable stateless execution engines.
 */
export class ProviderRegistry {
  private providers = new Map<string, ProviderAdapter>();
  private defaultProvider: string | null = null;

  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
    if (!this.defaultProvider) {
      this.defaultProvider = adapter.name;
    }
  }

  unregister(name: string): void {
    this.providers.delete(name);
    if (this.defaultProvider === name) {
      this.defaultProvider = this.providers.keys().next().value ?? null;
    }
  }

  get(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' is not registered`);
    }
    this.defaultProvider = name;
  }

  getDefault(): ProviderAdapter | undefined {
    return this.defaultProvider ? this.providers.get(this.defaultProvider) : undefined;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  listAllModels(): Array<{ provider: string; model: string }> {
    const models: Array<{ provider: string; model: string }> = [];
    for (const [, adapter] of this.providers) {
      for (const model of adapter.models) {
        models.push({ provider: adapter.name, model });
      }
    }
    return models;
  }

  async complete(request: CompletionRequest, providerName?: string): Promise<CompletionResponse> {
    const name = providerName ?? this.defaultProvider;
    if (!name) throw new Error('No provider available');

    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider '${name}' not found`);

    return provider.complete(request);
  }
}
