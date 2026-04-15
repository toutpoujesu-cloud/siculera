'use strict';

/**
 * OpenAI provider — also covers Groq and Ollama via baseURL override.
 * Normalises to the shared LLMProvider interface:
 *   chat(messages, tools, config) → { content, tool_calls, usage }
 */

let _OpenAI = null;
function getSDK() {
  if (!_OpenAI) {
    try { _OpenAI = require('openai'); }
    catch (_) { throw new Error('OpenAI SDK not installed. Run: npm install openai'); }
  }
  return _OpenAI;
}

const MODELS = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-reasoner'
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ],
  ollama: [
    'llama3.2',
    'llama3.1',
    'mistral',
    'gemma2',
    'qwen2.5'
  ]
};

class OpenAIProvider {
  constructor(apiKey, subProvider = 'openai', baseURL = null) {
    const SDK = getSDK();
    const opts = { apiKey: apiKey || 'no-key' };
    if (baseURL) opts.baseURL = baseURL;
    this.client      = new SDK.default ? new SDK.default(opts) : new SDK(opts);
    this.subProvider = subProvider; // 'openai' | 'groq' | 'ollama'
    this.name        = subProvider;
  }

  async chat(messages, tools, config = {}) {
    // Convert canonical messages → OpenAI format
    const oaiMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role:         'tool',
          tool_call_id: msg.tool_call_id || '',
          content:      typeof msg.tool_result === 'string'
                          ? msg.tool_result
                          : JSON.stringify(msg.tool_result || {})
        };
      }
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length) {
        return {
          role:       'assistant',
          content:    msg.content || null,
          tool_calls: msg.tool_calls.map(tc => ({
            id:       tc.id,
            type:     'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) }
          }))
        };
      }
      return { role: msg.role, content: msg.content || '' };
    });

    const params = {
      model:       config.model       || 'gpt-4o-mini',
      max_tokens:  config.max_tokens  || 1024,
      temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
      messages:    oaiMessages
    };

    if (tools && tools.length) {
      params.tools = tools.map(t => ({
        type:     'function',
        function: {
          name:        t.name,
          description: t.description,
          parameters:  t.parameters || t.input_schema || { type: 'object', properties: {} }
        }
      }));
    }

    const response = await this.client.chat.completions.create(params);
    return this._normalise(response);
  }

  _normalise(response) {
    const choice = response.choices?.[0];
    const msg    = choice?.message || {};

    let content    = msg.content || null;
    let toolCalls  = null;

    if (msg.tool_calls && msg.tool_calls.length) {
      toolCalls = msg.tool_calls.map(tc => ({
        id:   tc.id,
        name: tc.function.name,
        args: (() => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return {}; } })()
      }));
    }

    return {
      content,
      tool_calls:  toolCalls,
      usage: {
        prompt_tokens:     response.usage?.prompt_tokens     || 0,
        completion_tokens: response.usage?.completion_tokens || 0
      },
      stop_reason: choice?.finish_reason
    };
  }

  listModels() {
    return MODELS[this.subProvider] || MODELS.openai;
  }
}

module.exports = OpenAIProvider;
