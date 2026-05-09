import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TripGenerationInput {
  destination: string;
  memberCount: number;
  budget: number;
  currency: string;
  duration: number;
  tripType: string;
  startDate: string;
  preferences: string[];
  mustVisit?: string;
  avoidActivities?: string;
  dietaryRestrictions?: string[];
  budgetPriority?: string;
  pace?: string;
}

interface ActivityRecommendationInput {
  destination: string;
  tripType: string;
  groupSize: number;
  budgetPerActivity: number;
  currency: string;
  timeOfDay: string;
  existingActivities?: string[];
}

interface ItineraryAnalysisInput {
  destination: string;
  duration: number;
  activities: Array<{
    day: number;
    title: string;
    startTime?: string;
    durationMinutes?: number;
    estimatedCost?: number;
    category?: string;
  }>;
  budget: number;
  currency: string;
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const url = `https://api.groq.com/openai/v1/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function buildItineraryPrompt(input: TripGenerationInput): string {
  const startDate = new Date(input.startDate);
  const days = Array.from({ length: input.duration }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const activitySchema = `{"time": "HH:MM AM/PM", "title": "string", "description": "string", "duration": "string", "estimatedCost": number, "costPerPerson": number, "category": "activity|food|transport|sightseeing", "reason": "string"}`;

  return `You are an expert travel planner. Generate a detailed ${input.duration}-day trip itinerary for ${input.destination} for ${input.memberCount} people with a total budget of ${input.currency} ${input.budget}.

Trip Details:
- Type: ${input.tripType}
- Duration: ${input.duration} days
- Start Date: ${input.startDate}
- Group Size: ${input.memberCount} people
- Total Budget: ${input.currency} ${input.budget}
- Budget Per Person: ${input.currency} ${Math.round(input.budget / input.memberCount)}
- Preferences: ${input.preferences.join(", ") || "General"}
- Must Visit: ${input.mustVisit || "None specified"}
- Activities to Avoid: ${input.avoidActivities || "None"}
- Dietary Restrictions: ${input.dietaryRestrictions?.join(", ") || "None"}
- Budget Priority: ${input.budgetPriority || "Balanced"}
- Pace: ${input.pace || "moderate"}
- Dates: ${days.join(", ")}

CRITICAL: Return ONLY a raw valid JSON object. No markdown. No code blocks. No explanation. No trailing commas. No comments. Just pure JSON.

The JSON must follow this schema exactly:
{
  "destination": "string",
  "duration": number,
  "totalBudget": number,
  "estimatedTotal": number,
  "currency": "string",
  "days": [
    {
      "day": number,
      "date": "YYYY-MM-DD",
      "morning": [${activitySchema}],
      "afternoon": [${activitySchema}],
      "evening": [${activitySchema}],
      "dayTotal": number
    }
  ],
  "budgetBreakdown": {
    "accommodation": number,
    "food": number,
    "activities": number,
    "transport": number
  },
  "hotelSuggestions": [
    {"name": "string", "pricePerNight": number, "description": "string"}
  ],
  "transportSuggestions": [
    {"type": "string", "description": "string", "cost": number}
  ],
  "aiInsights": ["string", "string", "string"]
}

Generate all ${input.duration} days. Each day must have at least 1 activity in morning, afternoon, and evening arrays. All arrays must contain real objects, never use "..." or placeholders.`;
}

function buildActivityPrompt(input: ActivityRecommendationInput): string {
  return `Suggest 5 activities for ${input.destination} suitable for a ${input.tripType} with ${input.groupSize} people during ${input.timeOfDay}. Budget per activity: ${input.currency} ${input.budgetPerActivity} total (${input.currency} ${Math.round(input.budgetPerActivity / input.groupSize)} per person).

Existing activities to avoid duplicating: ${input.existingActivities?.join(", ") || "None"}

Return ONLY valid JSON array (no markdown):
[
  {
    "title": "Activity name",
    "description": "What it involves",
    "duration": "2-3 hours",
    "totalCost": <number>,
    "costPerPerson": <number>,
    "category": "adventure|relaxation|cultural|food|shopping|nightlife|nature",
    "bestFor": "Description of ideal group",
    "reason": "Why perfect for this group type",
    "distance": "Distance from city center or hotel",
    "tips": "Practical tip for this activity"
  }
]`;
}

function buildItineraryAnalysisPrompt(input: ItineraryAnalysisInput): string {
  return `Analyze this trip itinerary for ${input.destination} (${input.duration} days, ${input.currency} ${input.budget} budget).

Activities: ${JSON.stringify(input.activities)}

Check for these issues:
1. Overloaded days (>6 activities or >12 hours total)
2. Budget imbalance across days
3. Lack of variety in activity types
4. Logical flow issues (e.g., very late end + very early start)

Return ONLY valid JSON (no markdown):
{
  "issues": [
    {
      "type": "overloaded|budget_imbalance|variety|flow|route",
      "severity": "high|medium|low",
      "title": "Issue title",
      "description": "Detailed explanation",
      "affectedDay": <day number or null>,
      "suggestion": "Specific fix suggestion",
      "actionLabel": "Button label e.g. Apply fix"
    }
  ],
  "overallScore": <1-10>,
  "summary": "One sentence overall assessment"
}`;
}

function buildInsightsPrompt(destination: string, month: string, groupSize: number, budget: number, currency: string): string {
  return `Provide 6 travel insights for ${destination} in ${month} for a group of ${groupSize} people with budget ${currency} ${budget}.

Return ONLY valid JSON array (no markdown):
[
  {
    "type": "weather|seasonal|cost_saving|cultural|safety|timing|group_tips",
    "title": "Insight title",
    "content": "2-3 sentence detailed tip",
    "relevance": "high|medium|low",
    "actionable": true|false,
    "actionLabel": "Optional action label or null"
  }
]`;
}

function extractJSON(text: string): unknown {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ||
    text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  const raw = jsonMatch ? (jsonMatch[1] || jsonMatch[0]).trim() : text.trim();
  return JSON.parse(raw);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GROQ_API_KEY") ?? "";
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    const body = await req.json();

    let result: unknown;

    if (action === "generate-itinerary") {
      if (!apiKey) throw new Error("AI service not configured");
      const input = body as TripGenerationInput;
      const prompt = buildItineraryPrompt(input);
      const raw = await callGroq(prompt, apiKey);
      result = extractJSON(raw);
    } else if (action === "activity-recommendations") {
      if (!apiKey) throw new Error("AI service not configured");
      const input = body as ActivityRecommendationInput;
      const prompt = buildActivityPrompt(input);
      const raw = await callGroq(prompt, apiKey);
      result = extractJSON(raw);
    } else if (action === "analyze-itinerary") {
      if (!apiKey) throw new Error("AI service not configured");
      const input = body as ItineraryAnalysisInput;
      const prompt = buildItineraryAnalysisPrompt(input);
      const raw = await callGroq(prompt, apiKey);
      result = extractJSON(raw);
    } else if (action === "travel-insights") {
      if (!apiKey) throw new Error("AI service not configured");
      const { destination, month, groupSize, budget, currency } = body;
      const prompt = buildInsightsPrompt(destination, month, groupSize, budget, currency);
      const raw = await callGroq(prompt, apiKey);
      result = extractJSON(raw);
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
