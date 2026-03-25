import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENAI_API_KEY environment variable."
    });
  }

  try {
    const body = req.body || {};

    const {
      type = "Gameday",
      mode = "Normal",
      sport = "Baseball",
      opponent = "",
      result = "",
      product = "",
      vibe = ""
    } = body;

    const systemPrompt = `
You are writing for Shane's brand Gameday Stripes.

Voice:
- LSU-focused
- short, punchy, opinionated, natural
- sounds like a real LSU fan account on X
- not corporate
- not generic sports marketing
- do not just restate the user's seed
- interpret the seed into a stronger fan-native post

Rules:
- avoid filler like "How we feeling?" unless it truly fits
- avoid parroting the vibe box
- if the user gives a stat, turn it into a sharp observation/reaction
- keep most single posts under 240 characters
- make the 3 variations genuinely different
`;

    const userPrompt = `
Selections:
- Post type: ${type}
- Mode: ${mode}
- Sport: ${sport}
- Opponent: ${opponent || "N/A"}
- Result: ${result || "N/A"}
- Product: ${product || "N/A"}

User seed:
${String(vibe || "").trim() || "None provided"}

Return:
- interpreted_angle
- primary
- 3 variations
- 4 hooks
- 4 replies
- 1 thread (2 to 3 posts)
`;

    const response = await client.responses.create({
      model: "gpt-5.4",
      reasoning: { effort: "medium" },
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "gameday_stripes_post_pack",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              interpreted_angle: { type: "string" },
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
            required: [
              "interpreted_angle",
              "primary",
              "variations",
              "hooks",
              "replies",
              "thread"
            ]
          }
        }
      }
    });

    const raw = response.output_text || "";
    const parsed = JSON.parse(raw);

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Generation failed."
    });
  }
}
