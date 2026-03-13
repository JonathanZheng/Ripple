import OpenAI from 'https://deno.land/x/openai@v4.69.0/mod.ts';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

Deno.serve(async (req) => {
  try {
    const { prompt, current_time } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant for Ripple, a peer-request platform for NUS UTown Residential Colleges.
The current time is: ${current_time ?? new Date().toISOString()}.
Extract structured quest fields from the user's natural language request.
UTown locations include: Tembusu College, CAPT, RC4, RVRC, Acacia, NUSC, UTR, The Deck, Frontier, Fine Food, UTown Green, Stephen Riady Centre.
For deadline_label, choose the closest match from: "1 hour", "3 hours", "Tonight (10 PM)", "Tomorrow noon".
For fulfilment_mode: "dropoff" means leaving something at a location; "meetup" means meeting in person.
If you cannot confidently infer a field, return null for it.
Generate a concise title and an elaborated description from the prompt.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'create_quest',
            description: 'Extract structured quest fields from a natural language request',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Short quest title (max 10 words)',
                },
                description: {
                  type: 'string',
                  description: 'Clear elaborated description of what needs to be done',
                },
                tag: {
                  type: 'string',
                  enum: ['food', 'transport', 'social', 'skills', 'errands'],
                  description: 'Category that best fits the quest',
                },
                fulfilment_mode: {
                  type: 'string',
                  enum: ['meetup', 'dropoff'],
                  description: 'meetup = parties meet in person; dropoff = item left at a location',
                },
                reward_amount: {
                  type: ['number', 'null'],
                  description: 'Cash reward in SGD, or null if not mentioned',
                },
                deadline_label: {
                  type: ['string', 'null'],
                  enum: ['1 hour', '3 hours', 'Tonight (10 PM)', 'Tomorrow noon', null],
                  description: 'Closest deadline option, or null if not mentioned',
                },
                location_name: {
                  type: ['string', 'null'],
                  description: 'Location name (UTown venue or RC name), or null if not mentioned',
                },
              },
              required: ['title', 'description', 'tag', 'fulfilment_mode'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'create_quest' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: 'AI did not return structured output' }), { status: 500 });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(parsed), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('parse-quest error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
