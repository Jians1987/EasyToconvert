import { NextResponse } from 'next/server';

const NVIDIA_NEMOTRON_KEY = "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";
const NVIDIA_DEEPSEEK_KEY = "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";

// Define a size limit to prevent abuse (e.g. 5MB)
export const maxDuration = 60; // Max execution time for Vercel

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, prompt, systemPrompt, imageBase64 } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (action === "nemotron-ocr") {
      if (!imageBase64) {
        return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
      }

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NVIDIA_NEMOTRON_KEY}`,
          "Accept": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-parse",
          messages: [
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `NVIDIA API ${res.status}: ${errText.slice(0, 200)}` }, { status: res.status });
      }

      const data = await res.json();
      let markdown = "";
      if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
        markdown = data.choices[0].message.tool_calls[0].function.arguments;
      } else if (data.choices?.[0]?.message?.content) {
        markdown = data.choices[0].message.content;
      }

      try {
        const parsed = JSON.parse(markdown);
        if (typeof parsed === "string") markdown = parsed;
      } catch(e) {}

      return NextResponse.json({ text: markdown.trim() });

    } else if (action === "deepseek-chat") {
      if (!prompt) {
        return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
      }

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${NVIDIA_DEEPSEEK_KEY}`,
          "Accept": "application/json"
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v4-flash",
          messages: messages,
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 4000,
          extra_body: { "chat_template_kwargs": { "thinking": true, "reasoning_effort": "high" } },
          stream: false
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json({ error: `NVIDIA API ${res.status}: ${errText.slice(0, 200)}` }, { status: res.status });
      }

      const data = await res.json();
      
      const messageObj = data.choices?.[0]?.message || {};
      const reasoning = messageObj.reasoning || messageObj.reasoning_content || "";
      const content = messageObj.content || "";

      return NextResponse.json({
        content: content.trim(),
        reasoning: reasoning.trim()
      });

    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
