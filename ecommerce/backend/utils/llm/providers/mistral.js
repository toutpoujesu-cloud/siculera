'use strict';

/**
 * Mistral AI provider.
 * Normalises to the shared LLMProvider interface:
 *   chat(messages, tools, config) → { content, tool_calls, usage }
 */

let _Mistral = null;
function getSDK() {
  if (!_Mistral) {
    try { _Mistral = require('@mistralai/mistralai'); }
    catch (_) { throw new Error('Mistral SDK not installed. Run: npm install @mistralai/mistralai'); }
  }
  return _Mistral;
}

const MODELS = [
  'mistral-large-latest',
  'mistral-small-latest',
  'open-mistral-nemo',
  'open-mixtral-8x22b',
  'codestral-latest'
];

class MistralProvider {
  constructor(apiKey) {
    const SDK      = getSDK();
    // SDK v1 exports a class named Mistral
    const MistralClass = SDK.Mistral || SDK.default || SDK;
    this.client    = new MistralClass({ apiKey });
    this.name      = 'mistral';
  }

  async chat(messages, tools, config = {}) {
    // Mistral uses OpenAI-compatible message format
    const mistralMessages = messages.map(msg => {
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
          content:    msg.content || '',
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
      model:       config.model      || 'mistral-small-latest',
      maxTokens:   config.max_tokens || 1024,
      temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
      messages:    mistralMessages
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

    const response = await this.client.chat.complete(params);
    return this._normalise(response);
  }

  _normalise(response) {
    const choice = response.choices?.[0];
    const msg    = choice?.message || {};

    let content   = msg.content || null;
    let toolCalls = null;

    if (msg.toolCalls && msg.toolCalls.length) {
      toolCalls = msg.toolCalls.map(tc => ({
        id:   tc.id,
        name: tc.function.name,
        args: (() => { try { return JSON.parse(tc.function.arguments || '{}'); } catch { return {}; } })()
      }));
    }

    return {
      content,
      tool_calls:  toolCalls,
      usage: {
        prompt_tokens:     response.usage?.promptTokens     || 0,
        completion_tokens: response.usage?.completionTokens || 0
      },
      stop_reason: choice?.finishReason
    };
  }

  listModels() {
    return MODELS;
  }
}

module.exports = MistralProvider;
