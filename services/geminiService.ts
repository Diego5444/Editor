
import { GoogleGenAI } from "@google/genai";
import { Language } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getInlineSuggestions = async (
  code: string,
  language: Language,
  cursorPos: number
): Promise<string[]> => {
  const ai = getAI();
  const contextBefore = code.substring(Math.max(0, cursorPos - 500), cursorPos);
  
  const prompt = `
    Context: ${language} developer coding.
    Code before cursor: "${contextBefore}"
    Task: Provide 3 short, relevant code completions (keywords, functions, or snippets).
    For Python, focus on common libraries (math, os, sys) and PEP 8 style.
    Format: Return ONLY a JSON array of strings.
    Example: ["print(", "import math", "def main():"]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });
    
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    return [];
  }
};

export const getCodeSuggestions = async (
  code: string, 
  language: Language, 
  context: string = ""
): Promise<string> => {
  const ai = getAI();
  const prompt = `
    You are an expert ${language} engineer. 
    Review this code:
    \`\`\`${language}
    ${code}
    \`\`\`
    
    Task: ${context || "Optimize this code, follow best practices (like PEP 8 for Python), and provide the full improved version inside a code block."}
    Return ONLY the code block.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.2,
      }
    });
    return response.text || "";
  } catch (error) {
    return "Error generating suggestions.";
  }
};

export const explainCode = async (code: string, language: Language): Promise<string> => {
  const ai = getAI();
  const prompt = `Explica este código ${language} de forma concisa para un desarrollador móvil: \n\n ${code}`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });
    return response.text || "No hay explicación disponible.";
  } catch (error) {
    return "Error al conectar con la IA.";
  }
};

export const simulateExecution = async (code: string, language: Language): Promise<string> => {
  const ai = getAI();
  const prompt = `Act like a ${language} interpreter. Execute this code and return only the EXACT console output (stdout/stderr). If there's an error, show the traceback like a real terminal would: \n\n ${code}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.1
      }
    });
    return response.text || ">>> No output.";
  } catch (error) {
    return ">>> Critical execution error.";
  }
};
