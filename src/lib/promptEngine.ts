export interface EnhancementConfig {
  tone?: string;
  role?: string;
  format?: string;
}

export interface EnhancementResult {
  enhancedPrompt: string;
  explanation: string;
}

export type ModelProvider = 'nvidia' | 'gemini';

export interface ModelDefinition {
  id: string;
  label: string;
  description: string;
  provider: ModelProvider;
  apiModel: string;
  apiKeyEnvName?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  reasoning_budget?: number;
  chat_template_kwargs?: Record<string, unknown>;
}

export const AVAILABLE_MODELS: ModelDefinition[] = [
  {
    id: 'gpt-oss-20b',
    label: 'GPT OSS 20B',
    description: 'OpenAI open-source 20B model',
    provider: 'nvidia',
    apiModel: 'openai/gpt-oss-20b',
    apiKeyEnvName: 'VITE_NVIDIA_API_KEY_1',
    temperature: 1,
    top_p: 1,
    max_tokens: 4096,
  },
  {
    id: 'nemotron-nano-30b',
    label: 'Nemotron Nano 30B',
    description: 'NVIDIA Nemotron reasoning model',
    provider: 'nvidia',
    apiModel: 'nvidia/nemotron-3-nano-30b-a3b',
    apiKeyEnvName: 'VITE_NVIDIA_API_KEY_2',
    temperature: 1,
    top_p: 1,
    max_tokens: 16384,
    reasoning_budget: 16384,
    chat_template_kwargs: { enable_thinking: true },
  },
  {
    id: 'devstral-123b',
    label: 'Devstral 123B',
    description: 'Mistral DevStral 2 instruction model',
    provider: 'nvidia',
    apiModel: 'mistralai/devstral-2-123b-instruct-2512',
    apiKeyEnvName: 'VITE_NVIDIA_API_KEY_3',
    temperature: 0.15,
    top_p: 0.95,
    max_tokens: 8192,
  },
  {
    id: 'gemini-2-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Google Gemini 2.0 Flash',
    provider: 'gemini',
    apiModel: 'gemini-2.0-flash',
    apiKeyEnvName: 'VITE_GEMINI_API_KEY',
    temperature: 0.7,
    max_tokens: 4096,
  },
];

function getApiKey(model: ModelDefinition): string {
  // First, check local storage for custom keys
  try {
    const localKeys = JSON.parse(localStorage.getItem('pome_api_keys') || '{}');
    if (localKeys[model.id] && localKeys[model.id].trim() !== '') {
      return localKeys[model.id].trim();
    }
  } catch (e) {
    console.error('Failed to parse local API keys');
  }

  // Fallback to environment variables
  if (model.apiKeyEnvName) {
    // @ts-ignore
    const envKey = import.meta.env[model.apiKeyEnvName] as string;
    if (envKey && !envKey.includes('placeholder')) {
      return envKey;
    }
  }

  throw new Error(`API Key for ${model.label} not found. Please add it in Settings.`);
}

// ─── NVIDIA NIM call ────────────────────────────────────────────────────────

async function callNvidiaAPI(
  model: ModelDefinition,
  messages: { role: string; content: string }[]
): Promise<string> {
  const apiKey = getApiKey(model);

  const bodyParams: Record<string, unknown> = {
    model: model.apiModel,
    messages,
    temperature: model.temperature ?? 0.7,
    top_p: model.top_p ?? 1,
    max_tokens: model.max_tokens ?? 4096,
    stream: false,
  };
  if (model.reasoning_budget) bodyParams.reasoning_budget = model.reasoning_budget;
  if (model.chat_template_kwargs) bodyParams.chat_template_kwargs = model.chat_template_kwargs;

  const response = await fetch('/nvidia-api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(bodyParams),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP Error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '{}';
}

// ─── Gemini API call ────────────────────────────────────────────────────────

async function callGeminiAPI(
  model: ModelDefinition,
  systemInstruction: string,
  userContent: string
): Promise<string> {
  const apiKey = getApiKey(model);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model.apiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: {
          temperature: model.temperature ?? 0.7,
          maxOutputTokens: model.max_tokens ?? 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini HTTP Error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
}

// ─── Shared JSON parse helper ────────────────────────────────────────────────

function parseJsonResult(raw: string): EnhancementResult {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  try {
    const result = JSON.parse(cleaned);
    return {
      enhancedPrompt: result.enhancedPrompt || 'Failed to generate prompt.',
      explanation: result.explanation || 'No explanation provided.',
    };
  } catch {
    // If JSON parsing fails, treat the whole response as the prompt
    return {
      enhancedPrompt: cleaned || 'Failed to generate prompt.',
      explanation: 'Model returned a plain response (not JSON).',
    };
  }
}

// ─── Build system instruction ────────────────────────────────────────────────

function buildSystemInstruction(config: EnhancementConfig): string {
  const { tone = 'professional', role = 'expert assistant', format = 'structured markdown' } = config;
  return `You are "Pome", an elite, intuitive Prompt Engineer. Your core objective is to deeply understand the true intention behind the user's raw, vague, or fragmented idea, and transform it into a high-performance LLM prompt.

Key Principles & Rules:
1. INTENT PRESERVATION (CRITICAL): Never change the user's core goal. 
   - If they want an image prompt (e.g., for Midjourney/DALL-E/Stable Diffusion), the enhanced prompt MUST be a direct, pure visual description. Do NOT instruct the target AI to write an article, explanation, or markdown structure about the image strategy.
   - If they want code written or fixed, write a prompt that asks the target AI to output the code directly. Do NOT instruct the target AI to write a tutorial or article on how to fix it unless specifically asked.
2. NO UNWANTED STRUCTURE: Do not instruct the target AI to "explain its reasoning", "provide a breakdown", or "use markdown" UNLESS the user explicitly asked for it or it's absolutely necessary for the task.
3. GET STRAIGHT TO THE POINT: Do NOT start prompts with cliché preambles like "You are an expert...". Dive immediately into the core task, context, and constraints.
4. CONTEXT & CODE: If the user provides code, data, or specific examples, KEEP them in the enhanced prompt. 
5. TONE: Apply the requested '${tone}' tone to the expected output of the target AI.
6. PERSONA: Embed the requested '${role}' implicitly in the instructions.
7. FORMAT: The user selected '${format}'. 
   - IMPORTANT: Only apply this format if it aligns with the user's intent. 
   - If the intent is image generation, IGNORE the format and just write a visual prompt. 
   - If the intent is coding, ensure the primary output is the code itself, using the format only to structure the response (e.g., code in markdown blocks).

OUTPUT REQUIREMENTS:
You must output ONLY a valid JSON object with exactly two keys:
- "enhancedPrompt": The final, beautiful, ready-to-use prompt text. (No headers like "# Enhanced Prompt", just the prompt).
- "explanation": A brief explanation of how you improved their prompt without changing their original goal.

Ensure the JSON is strictly valid. No markdown wrapping the JSON.`;
}

function buildExtendSystemInstruction(config: EnhancementConfig): string {
  const { tone = 'professional', role = 'expert assistant', format = 'structured markdown' } = config;
  return `You are "Pome", an elite, intuitive Prompt Engineer. Your objective is to EXTEND and IMPROVE an existing prompt based on new instructions from the user.

Key Principles & Rules:
1. PRESERVE THE CORE: Keep the core intent, context, and structure of the original prompt intact. Do not rewrite it completely unless necessary to integrate the new instructions smoothly.
2. SEAMLESS INTEGRATION: The new additions should flow naturally within the existing prompt. Do not just append them at the end if they belong in the middle.
3. GET STRAIGHT TO THE POINT: No preambles. Output the extended prompt directly.
4. TONE & PERSONA: Maintain the requested '${tone}' tone and '${role}' persona.
5. FORMAT: Use '${format}' format.

OUTPUT REQUIREMENTS:
You must output ONLY a valid JSON object with exactly two keys:
- "enhancedPrompt": The final, extended prompt text.
- "explanation": A brief explanation of how you integrated the new details.

Ensure the JSON is strictly valid. No markdown wrapping the JSON.`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function enhancePrompt(
  rawPrompt: string,
  config: EnhancementConfig = {},
  model: ModelDefinition = AVAILABLE_MODELS[2]
): Promise<EnhancementResult> {
  const systemInstruction = buildSystemInstruction(config);
  const userContent = `Raw Prompt: "${rawPrompt}"`;

  try {
    let rawResponse: string;
    if (model.provider === 'gemini') {
      rawResponse = await callGeminiAPI(model, systemInstruction, userContent);
    } else {
      rawResponse = await callNvidiaAPI(model, [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ]);
    }
    return parseJsonResult(rawResponse);
  } catch (error: any) {
    console.error('Prompt Engine Error:', error);
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`AI Error: ${msg}`);
  }
}

export async function extendPrompt(
  originalPrompt: string,
  extensionInstruction: string,
  config: EnhancementConfig = {},
  model: ModelDefinition = AVAILABLE_MODELS[2]
): Promise<EnhancementResult> {
  const systemInstruction = buildExtendSystemInstruction(config);
  const userContent = `Original Prompt:\n"""\n${originalPrompt}\n"""\n\nExtension Request:\n"${extensionInstruction}"`;

  try {
    let rawResponse: string;
    if (model.provider === 'gemini') {
      rawResponse = await callGeminiAPI(model, systemInstruction, userContent);
    } else {
      rawResponse = await callNvidiaAPI(model, [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent },
      ]);
    }
    return parseJsonResult(rawResponse);
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`AI Error: ${msg}`);
  }
}
