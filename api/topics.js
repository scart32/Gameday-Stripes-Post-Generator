export default async function handler(req, res) {
  const bearer = process.env.X_BEARER_TOKEN;

  const fallbackTopics = [
    {
      category: "pregame",
      topic: "LSU baseball needs to look like the better team early",
      vibe: "this should feel like LSU needs to handle business from the jump",
      type: "Gameday",
      sport: "Baseball",
      opponent: "Oklahoma",
      reason: "Pregame angle"
    },
    {
      category: "pregame",
      topic: "Statement game feel for LSU softball",
      vibe: "this should feel like a tone-setting game for LSU softball",
      type: "Gameday",
      sport: "Softball",
      opponent: "Texas",
      reason: "Pregame angle"
    },
    {
      category: "postgame",
      topic: "What that LSU result actually said about the team",
      vibe: "fans are going to split hard on what that game actually said about LSU",
      type: "Result",
      sport: "Basketball",
      opponent: "Alabama",
      reason: "Postgame debate"
    },
    {
      category: "postgame",
      topic: "Real fans still showed up after a frustrating loss",
      vibe: "real fans stayed loud after a bad loss",
      type: "Fan",
      sport: "Baseball",
      opponent: "Texas A&M",
      reason: "Postgame fan angle"
    },
    {
      category: "merch",
      topic: "Call out bad LSU merch without sounding too salesy",
      vibe: "a lot of LSU gear is too loud and forced",
      type: "Product",
      sport: "Baseball",
      opponent: "Arkansas",
      reason: "Merch tie-in"
    },
    {
      category: "merch",
      topic: "Tie a current LSU moment back to clean wearable gear",
      vibe: "this should feel like real LSU gear for real fans not random loud merch",
      type: "Product",
      sport: "Football",
      opponent: "Alabama",
      reason: "Merch tie-in"
    },
    {
      category: "controversial",
      topic: "Some LSU fans only get loud when things are easy",
      vibe: "this should call out selective fandom without overexplaining it",
      type: "Fan",
      sport: "Football",
      opponent: "Ole Miss",
      reason: "Controversial take"
    },
    {
      category: "controversial",
      topic: "LSU merch is mostly too loud and overdesigned",
      vibe: "this should feel blunt and opinionated about bad LSU merch",
      type: "Product",
      sport: "Baseball",
      opponent: "Auburn",
      reason: "Controversial take"
    }
  ];

  if (!bearer) {
    return res.status(200).json({
      source: "fallback",
      topics: fallbackTopics
    });
  }

  try {
    const query = [
      "(LSU OR #LSU OR \"LSU Tigers\" OR \"LSU baseball\" OR \"LSU football\" OR \"LSU basketball\" OR \"LSU softball\")",
      "-is:retweet",
      "-is:reply",
      "lang:en"
    ].join(" ");

    const url = new URL("https://api.x.com/2/tweets/search/recent");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "24");
    url.searchParams.set("tweet.fields", "public_metrics,created_at,text");
    url.searchParams.set("sort_order", "relevancy");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${bearer}`
      }
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`X API error: ${response.status} ${txt}`);
    }

    const data = await response.json();
    const tweets = Array.isArray(data.data) ? data.data : [];

    const topics = tweets
      .filter(t => t.text)
      .slice(0, 12)
      .map((tweet) => {
        const text = tweet.text.replace(/\s+/g, " ").trim();
        const lower = text.toLowerCase();

        let sport = "Baseball";
        if (lower.includes("football")) sport = "Football";
        else if (lower.includes("softball")) sport = "Softball";
        else if (lower.includes("basketball")) sport = "Basketball";

        let type = "Fan";
        if (lower.includes("vs") || lower.includes("tonight") || lower.includes("pregame") || lower.includes("matchup")) type = "Gameday";
        if (lower.includes("win") || lower.includes("loss") || lower.includes("final") || lower.includes("fell") || lower.includes("beat")) type = "Result";

        let opponent = "";
        const knownOpponents = [
          "Oklahoma", "Texas", "Texas A&M", "Arkansas", "Alabama",
          "Florida", "Ole Miss", "Kentucky", "Duke", "Vanderbilt", "Auburn"
        ];
        for (const team of knownOpponents) {
          if (lower.includes(team.toLowerCase())) {
            opponent = team;
            break;
          }
        }

        const category = categorizeTopic(lower, type);
        const trimmed = text.length > 115 ? text.slice(0, 115).trim() + "..." : text;

        return {
          category,
          topic: trimmed,
          vibe: summarizeTweetIntoVibe(text, category),
          type: mapTypeFromCategory(category, type),
          sport,
          opponent,
          reason: categoryLabel(category)
        };
      });

    return res.status(200).json({
      source: "x_api",
      topics: topics.length ? topics : fallbackTopics
    });
  } catch (error) {
    return res.status(200).json({
      source: "fallback",
      topics: fallbackTopics,
      error: error.message
    });
  }
}

function categorizeTopic(lower, type) {
  if (
    lower.includes("merch") ||
    lower.includes("shirt") ||
    lower.includes("hat") ||
    lower.includes("hoodie") ||
    lower.includes("gear") ||
    lower.includes("apparel")
  ) return "merch";

  if (
    lower.includes("pregame") ||
    lower.includes("tonight") ||
    lower.includes("vs") ||
    lower.includes("matchup") ||
    lower.includes("first pitch") ||
    lower.includes("tipoff") ||
    type === "Gameday"
  ) return "pregame";

  if (
    lower.includes("win") ||
    lower.includes("loss") ||
    lower.includes("final") ||
    lower.includes("fell") ||
    lower.includes("beat") ||
    type === "Result"
  ) return "postgame";

  if (
    lower.includes("overrated") ||
    lower.includes("underwhelming") ||
    lower.includes("soft") ||
    lower.includes("fraud") ||
    lower.includes("not as good") ||
    lower.includes("exposed") ||
    lower.includes("bad merch")
  ) return "controversial";

  if (
    lower.includes("real fans") ||
    lower.includes("still here") ||
    lower.includes("showed up") ||
    lower.includes("loud")
  ) return "controversial";

  return "pregame";
}

function mapTypeFromCategory(category, detectedType) {
  if (category === "merch") return "Product";
  if (category === "postgame") return "Result";
  if (category === "controversial") return detectedType === "Product" ? "Product" : "Fan";
  return detectedType === "Result" ? "Gameday" : detectedType;
}

function categoryLabel(category) {
  if (category === "pregame") return "Pregame angle";
  if (category === "postgame") return "Postgame angle";
  if (category === "merch") return "Merch tie-in";
  if (category === "controversial") return "Controversial take";
  return "Suggested angle";
}

function summarizeTweetIntoVibe(text, category) {
  const lower = text.toLowerCase();

  if (category === "merch") {
    return "this should tie a current LSU moment back to clean gear without sounding too salesy";
  }

  if (category === "controversial") {
    return "this should feel blunt opinionated and strong enough to get replies";
  }

  if (category === "postgame") {
    return "this should feel like fans are going to debate what that game actually said about LSU";
  }

  if (lower.includes("baseball")) {
    return "this should feel like LSU baseball needs to look sharp and play like the better team";
  }

  if (lower.includes("football")) {
    return "this should feel big and physical like LSU football needs to set the tone";
  }

  if (lower.includes("softball")) {
    return "this should feel like LSU softball is in a statement spot";
  }

  if (lower.includes("basketball")) {
    return "this should feel emotional and debate-heavy around what LSU basketball really is";
  }

  return "this should feel like a real LSU fan reacting honestly not polished brand copy";
}
