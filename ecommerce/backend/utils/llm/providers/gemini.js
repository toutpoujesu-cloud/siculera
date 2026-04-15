'use strict';

/**
 * Google Gemini provider.
 * Normalises to the shared LLMProvider interface:
 *   chat(messages, tools, config) → { content, tool_calls, usage }
 */

let _GoogleAI = null;
function getSDK() {
  if (!_GoogleAI) {
    try { _GoogleAI = require('@google/generative-ai'); }
    catch (_) { throw new Error('Google AI SDK not installed. Run: npm install @google/generative-ai'); }
  }
  return _GoogleAI;
}

const MODELS = [
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.0-pro'
];

/**
 * Convert canonical messages to Gemini format.
 * Gemini uses 'user' / 'model' roles and Parts arrays.
 * System messages are extracted and passed separately.
 */
function toGeminiHistory(messages) {
  let systemText = '';
  const history  = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + (msg.content || '');
      continue;
    }

    if (msg.role === 'tool') {
      // Function response — must follow model turn as user turn
      history.push({
        role:  'user',
        parts: [{
          functionResponse: {
            name:     msg.tool_name || 'tool',
            response: { result: (() => {
              try { return typeof msg.tool_result === 'string'
                ? JSON.parse(msg.tool_result)
                : (msg.tool_result || {}); }
              catch { return { result: msg.tool_result }; }
            })() }
          }
        }]
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length) {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const tc of msg.tool_calls) {
        parts.push({ functionCall: { name: tc.name, args: tc.args || {} } });
      }
      history.push({ role: 'model', parts });
      continue;
    }

    history.push({
      role:  msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }]
    });
  }

  // Gemini requires history to start with 'user' — drop leading model turns
  while (history.length && history[0].role !== 'user') history.shift();

  return { systemText, history };
}

/**
 * Convert OpenAI-style tool definitions to Gemini functionDeclarations.
 */
function toGeminiTools(tools) {
  if (!tools || !tools.length) return [];
  return [{
    functionDeclarations: tools.map(t => ({
      name:        t.name,
      description: t.description,
      parameters:  t.parameters || t.input_schema || { type: 'object', properties: {} }
    }))
  }];
}

class GeminiProvider {
  constructor(apiKey) {
    const SDK    = getSDK();
    this.genAI   = new SDK.GoogleGenerativeAI(apiKey);
    this.name    = 'gemini';
  }

  async chat(messages, tools, config = {}) {
    const modelName = config.model || 'gemini-1.5-flash';
    const { systemText, history } = toGeminiHistory(messages);

    const modelOpts = {
      model:              modelName,
      generationConfig: {
        maxOutputTokens: config.max_tokens  || 1024,
        temperature:     typeof config.temperature === 'number' ? config.temperature : 0.7
      }
    };

    if (systemText) {
      modelOpts.systemInstruction = { parts: [{ text: systemText }] };
    }

    const geminiTools = toGeminiTools(tools);
    if (geminiTools.length) modelOpts.tools = geminiTools;

    const model = this.genAI.getGenerativeModel(modelOpts);

    // Pop last user message to send as the current turn
    const lastMsg = history.length && history[history.length - 1].role === 'user'
      ? history.pop()
      : { role: 'user', parts: [{ text: '' }] };

    const chat   = model.startChat({ history });
    const result = await chat.sendMessage(lastMsg.parts);
    return this._normalise(result.response);
  }

  _normalise(response) {
    let content   = null;
    const toolCalls = [];

    const candidate = response.candidates?.[0];
    for (const part of (candidate?.content?.parts || [])) {
      if (part.text) {
        content = (content || '') + part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id:   part.functionCall.name + '_' + Date.now(),
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
      }
    }

    const meta = response.usageMetadata || {};
    return {
      content,
      tool_calls:  toolCalls.length ? toolCalls : null,
      usage: {
        prompt_tokens:     meta.promptTokenCount     || 0,
        completion_tokens: meta.candidatesTokenCount || 0
      },
      stop_reason: candidate?.finishReason
    };
  }

  listModels() {
    return MODELS;
  }
}

module.exports = GeminiProvider;
