import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENAI_API_KEY environment variable."
    });
  }

  try {
    const {
      type = "Gameday",
      mode = "Normal",
      sport = "Baseball",
      opponent = "",
      result = "",
      product = "",
      vibe = ""
    } = req.body || {};

    const prompt = `
You are writing for Shane's brand Gameday Stripes.

Brand/context:
- Gameday Stripes is LSU-focused.
- Voice is short, punchy, natural, opinionated, and fan-first.
- Tone should feel like a real LSU fan account on X, not polished brand copy.
- Avoid generic sports-marketing phrases.
- Avoid repeating the user's vibe text verbatim unless a very short phrase is worth preserving.
- Interpret the vibe as a brief, not as final copy.

Writing rules:
- Prefer short lines and clean rhythm.
- Sound confident, human, and slightly barstool-ish, but not corny.
- No hashtags unless absolutely necessary.
- No emojis unless mode is Funny and even then use them sparingly.
- Do not sound like a corporation.
- Product posts should still feel like an opinion or fan take, not an ad.

Input selections:
- Post type: ${type}
- Mode: ${mode}
- Sport: ${sport}
- Opponent: ${opponent || "N/A"}
- Result: ${result || "N/A"}
- Product: ${product || "N/A"}
- User brief / vibe: ${vibe || "None provided"}

What to do:
1. Infer the real angle behind the brief.
2. Write one best primary post.
3. Write 3 distinct variations:
   - Variation 1: safest / most on-brand
   - Variation 2: more engaging / comment-driving
   - Variation 3: more aggressive / more debate
4. Write 4 hooks only.
5. Write 4 short replies Shane could use under his own post or in conversation.
6. Write 1 short thread of 3 posts max.
7. Make sure all outputs adapt to the actual selections together, not just the vibe field.

Important:
- Do not just restate the vibe.
- Reformulate it into actual post ideas.
- Make each variation meaningfully different.
- Keep most single-post outputs under 240 chars if possible.
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      reasoning: { effort: "medium" },
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "gameday_stripes_post_pack",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              primary: { type: "string" },
              variations: {
                type: "array",
                items: { type: "string" },
                minItems: 3,
                maxItems: 3
              },
              hooks: {
                type: "array",
                items: { type: "string" },
                minItems: 4,
                maxItems: 4
              },
              replies: {
                type: "array",
                items: { type: "string" },
                minItems: 4,
                maxItems: 4
              },
              thread: {
                type: "array",
                items: { type: "string" },
                minItems: 2,
                maxItems: 3
              }
            },
            required: ["primary", "variations", "hooks", "replies", "thread"]
          }
        }
      }
    });

    const raw = response.output_text;
    const parsed = JSON.parse(raw);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Generation failed."
    });
  }
}
