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

    const userBrief = String(vibe || "").trim();

    const systemPrompt = `
You are writing for Shane's brand Gameday Stripes.

About the brand:
- LSU-focused
- voice is short, punchy, opinionated, natural
- should feel like a real LSU fan account on X
- not polished brand copy
- not corporate
- not "social media manager" language
- no hashtags unless absolutely necessary
- almost never use emojis
- avoid corny sports clichés
- avoid generic filler like "How we feeling?" unless it truly fits
- avoid obvious CTA spam on every post

Core rule:
The user's text box is NOT final copy.
It is a seed, angle, news peg, stat, opinion, or feeling.
You must interpret it and expand it into stronger posts.

Very important behavior:
- If the user gives a stat or fact like "Derek Curiel is 7 for 7", do NOT repeat it with one extra sentence.
- Turn it into a sharper fan observation, reaction, brag, take, or conversation starter.
- Sound like someone actually watching LSU and reacting in real time.

How to think about the user's input:
- Sometimes it is a stat seed
- Sometimes it is a postgame feeling
- Sometimes it is a challenge/callout
- Sometimes it is a product angle
- Sometimes it is just a rough vibe
You must infer the best use.

Output philosophy:
- Primary = best overall post
- Variation 1 = cleanest / most on-brand
- Variation 2 = more engaging / more likely to get replies
- Variation 3 = more aggressive / more opinionated
- Hooks = sharp opening lines only
- Replies = short natural replies Shane could realistically post
- Thread = 2 to 3 post mini-thread if there is enough substance

Adaptation rules by post type:
- Gameday: anticipation, matchup feel, expectation, tone-setting
- Result: reaction, takeaway, fan emotion, what it means
- Product: opinion-led and wearable, not ad copy
- Fan: identity, loyalty, callout, real fan behavior
- Hook: treat the input as a seed fact or angle and EXPAND it into full post ideas, not just one-line hooks
- Thread: build a compact 2-3 post thought progression
- Reply: short conversational responses, not full tweets

Tone rules by mode:
- Normal: clean, sharp, natural
- Controversial: more challenging, more willing to draw a line
- Funny: dry and relatable, not cartoonish
- Aggressive: blunt, confident, direct

Hard bans:
- do not sound like "content"
- do not say "built different"
- do not say "let that sink in"
- do not say "special player" unless truly unavoidable
- do not parrot the user brief back with "feels like..."
- do not write generic sports-brand filler
`;

    const userPrompt = `
Selections:
- Post type: ${type}
- Mode: ${mode}
- Sport: ${sport}
- Opponent: ${opponent || "N/A"}
- Result: ${result || "N/A"}
- Product: ${product || "N/A"}

Seed / vibe / fact from user:
${userBrief || "None provided"}

Specific instruction:
Use all selections together.
Do not overweight the seed text and ignore the rest.
If the seed is a stat or fact, turn it into a stronger fan-native post angle.

Few-shot style examples:

Example 1
Input seed: "Derek Curiel is 7 for 7"
Bad output: "Derek Curiel is 7 for 7. How we feeling?"
Good output style:
- Derek Curiel is 7 for 7 and somehow it still feels like he's not missing a barrel.
- Derek Curiel being 7 for 7 is getting ridiculous fast.
- At some point "hot start" stops covering it. Derek Curiel is just cooking.

Example 2
Input seed: "real fans stayed loud after a bad loss"
Good output style:
- A loss clears out the fake ones. The real ones are still here.
- Some people get quiet after one bad night. Real fans don't.
- This brand is for the LSU fans who stay loud when it doesn't go their way.

Example 3
Input seed: "lsu merch is too loud and overdone"
Good output style:
- Most LSU merch is doing too much.
- A lot of LSU gear feels loud for the sake of being loud.
- The goal was never more LSU merch. It was better LSU merch.

Now produce a structured content pack.
Keep most single-post outputs under 240 characters when possible.
Make the three variations actually different in angle and rhythm.
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
            required: ["interpreted_angle", "primary", "variations", "hooks", "replies", "thread"]
          }
        }
      }
    });

    const parsed = JSON.parse(response.output_text);
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Generation failed."
    });
  }
}
