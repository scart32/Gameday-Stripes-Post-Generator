export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY environment variable." });
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

Brand voice:
- LSU-focused
- short, punchy, opinionated, natural
- sounds like a real LSU fan account on X
- not corporate
- not generic sports marketing
- no hashtags unless absolutely necessary
- almost never emojis
- avoid filler like "How we feeling?" unless it truly fits
- avoid repeating the user's seed back with minor edits

Important:
The user's text is a seed, stat, angle, feeling, or observation.
Do NOT just rephrase it.
Interpret it into stronger fan-native post ideas.

Examples:
Input seed: "Derek Curiel is 7 for 7"
Bad: "Derek Curiel is 7 for 7. How we feeling?"
Good style:
- Derek Curiel is 7 for 7 and somehow it still feels like he's just getting started.
- Derek Curiel being 7 for 7 is getting ridiculous fast.
- At some point "hot start" stops covering it. Derek Curiel is just cooking.

Input seed: "real fans stayed loud after a bad loss"
Good style:
- A loss clears out the fake ones. The real ones are still here.
- Some people get quiet after one bad night. Real fans don't.
- This brand is for the LSU fans who stay loud when it doesn't go their way.

Input seed: "lsu merch is too loud and overdone"
Good style:
- Most LSU merch is doing too much.
- A lot of LSU gear feels loud for the sake of being loud.
- The goal was never more LSU merch. It was better LSU merch.

Adapt to the full selection set together:
- post type
- mode
- sport
- opponent
- result
- product
- seed text

Return structured JSON only.
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

Requirements:
1. Infer the real angle behind the seed.
2. Write one best primary post.
3. Write 3 distinct variations:
   - Variation 1: cleanest / most on-brand
   - Variation 2: more engaging / reply-driving
   - Variation 3: more aggressive / more opinionated
4. Write 4 hooks.
5. Write 4 short replies.
6. Write 1 short thread of 2-3 posts.
7. Keep most single posts under 240 characters if possible.

Return JSON in this exact shape:
{
  "interpreted_angle": "string",
  "primary": "string",
  "variations": ["string","string","string"],
  "hooks": ["string","string","string","string"],
  "replies": ["string","string","string","string"],
  "thread": ["string","string"]
}
`;

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
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
      })
    });

    const raw = await openaiRes.text();

    if (!openaiRes.ok) {
      return res.status(500).json({
        error: `OpenAI API error: ${raw}`
      });
    }

    let parsedApi;
    try {
      parsedApi = JSON.parse(raw);
    } catch (e) {
      return res.status(500).json({
        error: `Could not parse OpenAI response: ${raw}`
      });
    }

    const outputText = parsedApi.output_text;
    if (!outputText) {
      return res.status(500).json({
        error: `No output_text returned: ${raw}`
      });
    }

    let finalJson;
    try {
      finalJson = JSON.parse(outputText);
    } catch (e) {
      return res.status(500).json({
        error: `Model did not return valid JSON: ${outputText}`
      });
    }

    return res.status(200).json(finalJson);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Server function failed."
    });
  }
}
