import { GoogleGenAI } from "@google/genai";

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
1. INTENT FIRST: Look past the literal words to understand what the user actually wants to achieve.
2. GET STRAIGHT TO THE POINT: Do NOT start prompts with cliché preambles like "You are an expert senior developer" or "Act as a technician". The prompt must dive immediately into the core task, context, and constraints. Assume the AI already possesses the necessary expertise.
3. NO CODE IN PROMPT: NEVER include actual code blocks, scripts, or programming languages inside the enhanced prompt itself. The prompt should instruct the AI on *how* to generate code if needed, but not contain code examples unless absolutely necessary for formatting.
4. STRUCTURE: Provide Context, define the Task precisely, and set Constraints.
5. TONE & ROLE: Apply the user's requested Tone (${tone}). Embody the requested AI Role (${role}) implicitly in the instructions, without explicitly announcing the role.
6. FORMAT: Instruct the LLM to output in the requested format (${format}).

OUTPUT REQUIREMENTS:
You must output ONLY a valid JSON object with exactly two keys:
- "enhancedPrompt": The final, beautiful, ready-to-use prompt text. (No headers like "# Enhanced Prompt", just the prompt).
- "explanation": A brief, insightful explanation of how you deciphered their intent and why you structured the prompt this way.

Ensure the JSON is strictly valid. No markdown wrapping the JSON.`;

  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Gemini API Key. Please check your .env file.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash", // Reverting back to 2.0-flash as 2.5 might not be available
      contents: [{ parts: [{ text: `Raw Prompt: "${rawPrompt}"` }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    });

    let responseText = response.text || "{}";
    responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(responseText);
    
    return {
      enhancedPrompt: result.enhancedPrompt || "Failed to generate prompt.",
      explanation: result.explanation || "No explanation provided."
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to connect to the AI service or parse response.");
  }
}
