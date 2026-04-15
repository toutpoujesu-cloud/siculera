'use strict';

/**
 * Anthropic Claude provider — DEFAULT for Siculera AI Chat.
 * Normalises to the shared LLMProvider interface:
 *   chat(messages, tools, config) → { content, tool_calls, usage }
 */

let _Anthropic = null;
function getSDK() {
  if (!_Anthropic) {
    try { _Anthropic = require('@anthropic-ai/sdk'); }
    catch (_) { throw new Error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk'); }
  }
  return _Anthropic;
}

// Canonical model list (shown in admin dropdown)
const MODELS = [
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
];

/**
 * Convert OpenAI-style tool definitions to Anthropic format.
 * OpenAI:    { name, description, parameters: { type:'object', properties, required } }
 * Anthropic: { name, description, input_schema: { type:'object', properties, required } }
 */
function toAnthropicTools(tools) {
  return (tools || []).map(t => ({
    name:         t.name,
    description:  t.description,
    input_schema: t.parameters || t.input_schema || { type: 'object', properties: {} }
  }));
}

/**
 * Convert canonical message array to Anthropic format.
 * - Extracts 'system' messages (Anthropic takes system as a top-level param)
 * - Converts role:'tool' → role:'user' with tool_result content block
 * - Converts assistant tool_calls → assistant content with tool_use blocks
 */
function toAnthropicMessages(messages) {
  let systemText = '';
  const anthropicMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + (msg.content || '');
      continue;
    }

    if (msg.role === 'tool') {
      // Tool result — must follow as a user message with tool_result block
      anthropicMessages.push({
        role: 'user',
        content: [{
          type:        'tool_result',
          tool_use_id: msg.tool_call_id || '',
          content:     typeof msg.tool_result === 'string'
                         ? msg.tool_result
                         : JSON.stringify(msg.tool_result || {})
        }]
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length) {
      // Assistant message with tool call(s)
      const content = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const tc of msg.tool_calls) {
        content.push({
          type:  'tool_use',
          id:    tc.id,
          name:  tc.name,
          input: tc.args || {}
        });
      }
      anthropicMessages.push({ role: 'assistant', content });
      continue;
    }

    // Regular user/assistant text message
    anthropicMessages.push({
      role:    msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content || ''
    });
  }

  return { systemText, anthropicMessages };
}

/**
 * Normalise Anthropic response to canonical format.
 */
function normaliseResponse(response) {
  let content   = null;
  const toolCalls = [];

  for (const block of (response.content || [])) {
    if (block.type === 'text') {
      content = (content || '') + block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id:   block.id,
        name: block.name,
        args: block.input || {}
      });
    }
  }

  return {
    content:    content,
    tool_calls: toolCalls.length ? toolCalls : null,
    usage: {
      prompt_tokens:     response.usage?.input_tokens     || 0,
      completion_tokens: response.usage?.output_tokens    || 0
    },
    stop_reason: response.stop_reason
  };
}

class AnthropicProvider {
  constructor(apiKey) {
    const SDK = getSDK();
    this.client = new SDK.Anthropic({ apiKey });
    this.name   = 'anthropic';
  }

  async chat(messages, tools, config = {}) {
    const { systemText, anthropicMessages } = toAnthropicMessages(messages);
    const anthropicTools = toAnthropicTools(tools);

    const params = {
      model:      config.model       || 'claude-3-5-sonnet-20241022',
      max_tokens: config.max_tokens  || 1024,
      temperature: typeof config.temperature === 'number' ? config.temperature : 0.7,
      messages:   anthropicMessages
    };

    if (systemText)              params.system = systemText;
    if (anthropicTools.length)   params.tools  = anthropicTools;

    const response = await this.client.messages.create(params);
    return normaliseResponse(response);
  }

  listModels() {
    return MODELS;
  }
}

module.exports = AnthropicProvider;
