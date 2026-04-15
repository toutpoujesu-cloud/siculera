'use strict';

/**
 * LLM Provider Factory
 * Returns a unified provider instance for any supported backend.
 *
 * Usage:
 *   const { getLLMProvider } = require('./llmProvider');
 *   const provider = getLLMProvider('anthropic', apiKey, { ollamaBaseUrl });
 *   const result   = await provider.chat(messages, tools, config);
 */

const PROVIDER_NAMES = ['anthropic', 'openai', 'gemini', 'mistral', 'groq', 'ollama', 'deepseek'];

/**
 * Factory — returns a provider instance.
 *
 * @param {string} providerName  - 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'groq' | 'ollama'
 * @param {string} apiKey        - API key (may be empty for Ollama)
 * @param {object} opts
 * @param {string} [opts.ollamaBaseUrl] - Override for Ollama (default: process.env.OLLAMA_BASE_URL)
 * @returns {LLMProvider}
 */
function getLLMProvider(providerName, apiKey, opts = {}) {
  const name = (providerName || 'anthropic').toLowerCase();

  switch (name) {
    case 'anthropic': {
      const AnthropicProvider = require('./providers/anthropic');
      return new AnthropicProvider(apiKey || process.env.ANTHROPIC_API_KEY || '');
    }

    case 'openai': {
      const OpenAIProvider = require('./providers/openai');
      return new OpenAIProvider(apiKey || process.env.OPENAI_API_KEY || '', 'openai');
    }

    case 'groq': {
      const OpenAIProvider = require('./providers/openai');
      return new OpenAIProvider(
        apiKey || process.env.GROQ_API_KEY || '',
        'groq',
        'https://api.groq.com/openai/v1'
      );
    }

    case 'ollama': {
      const OpenAIProvider = require('./providers/openai');
      const baseURL = opts.ollamaBaseUrl
        || process.env.OLLAMA_BASE_URL
        || 'http://localhost:11434';
      return new OpenAIProvider('ollama', 'ollama', `${baseURL}/v1`);
    }

    case 'deepseek': {
      const OpenAIProvider = require('./providers/openai');
      return new OpenAIProvider(
        apiKey || process.env.DEEPSEEK_API_KEY || '',
        'deepseek',
        'https://api.deepseek.com/v1'
      );
    }

    case 'gemini': {
      const GeminiProvider = require('./providers/gemini');
      return new GeminiProvider(apiKey || process.env.GOOGLE_AI_API_KEY || '');
    }

    case 'mistral': {
      const MistralProvider = require('./providers/mistral');
      return new MistralProvider(apiKey || process.env.MISTRAL_API_KEY || '');
    }

    default:
      throw new Error(`Unknown LLM provider: "${providerName}". Valid: ${PROVIDER_NAMES.join(', ')}`);
  }
}

/**
 * Return static model list for a given provider without instantiating it
 * (safe to call even when no API key is configured).
 */
function getModelList(providerName) {
  try {
    const provider = getLLMProvider(providerName, 'dummy-key-for-model-list');
    return provider.listModels ? provider.listModels() : [];
  } catch {
    return [];
  }
}

module.exports = { getLLMProvider, getModelList, PROVIDER_NAMES };
