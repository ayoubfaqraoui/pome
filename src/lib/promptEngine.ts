import OpenAI from "openai";

export interface EnhancementConfig {
  tone?: string;
  role?: string;
  format?: string;
}

export interface EnhancementResult {
  enhancedPrompt: string;
  explanation: string;
}

export async function enhancePrompt(rawPrompt: string, config: EnhancementConfig = {}): Promise<EnhancementResult> {
  const { tone = "professional", role = "expert assistant", format = "structured markdown" } = config;

  const systemInstruction = `You are "Pome", an elite, intuitive Prompt Engineer. Your core objective is to deeply understand the true intention behind the user's raw, vague, or fragmented idea, and transform it into a high-performance LLM prompt.

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

  try {
    const apiKey = import.meta.env.VITE_NVIDIA_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("Missing NVIDIA API Key. Please check your Vercel Environment Variables.");
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://integrate.api.nvidia.com/v1",
      dangerouslyAllowBrowser: true,
    });

    const completion = await openai.chat.completions.create({
      model: "mistralai/devstral-2-123b-instruct-2512",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Raw Prompt: "${rawPrompt}"` }
      ],
      temperature: 0.7,
      max_tokens: 4096,
    });

    let responseText = completion.choices[0]?.message?.content || "{}";
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const result = JSON.parse(responseText);
    
    return {
      enhancedPrompt: result.enhancedPrompt || "Failed to generate prompt.",
      explanation: result.explanation || "No explanation provided."
    };
  } catch (error: any) {
    console.error("NIM API Error details:", error);
    const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
    throw new Error(`AI Error: ${errorMessage}`);
  }
}
