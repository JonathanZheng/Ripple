import OpenAI from 'https://deno.land/x/openai@v4.69.0/mod.ts';

interface QuestFields {
  title: string | null;
  description: string | null;
  tag: string | null;
  fulfilment_mode: 'meetup' | 'dropoff' | null;
  reward_amount: number | null;
  deadline_label: '1 hour' | '3 hours' | 'Tonight (10 PM)' | 'Tomorrow noon' | null;
  location_name: string | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const REQUIRED_FIELDS: (keyof QuestFields)[] = [
  'title',
  'description',
  'fulfilment_mode',
  'deadline_label',
];

function isComplete(fields: Partial<QuestFields>): boolean {
  return REQUIRED_FIELDS.every((f) => {
    if (f === 'description') {
      return typeof fields.description === 'string' && fields.description.length >= 20;
    }
    return fields[f] != null;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

  try {
    const { messages, collected_fields, current_time } = await req.json() as {
      messages: ChatMessage[];
      collected_fields: Partial<QuestFields>;
      current_time: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const systemPrompt = `You are an AI assistant for Ripple, a peer-request platform for NUS UTown Residential Colleges.
The current time is: ${current_time ?? new Date().toISOString()}.

Your job is to collect quest details through conversation and extract them into structured fields.

LOCATIONS in UTown: Tembusu College, CAPT, RC4, RVRC, Acacia, NUSC, UTR, The Deck, Frontier, Fine Food, UTown Green, Stephen Riady Centre.

FIELD RULES:
- title: Short (≤10 words), action-oriented
- description: Must be ≥20 characters, clearly describe what needs doing
- fulfilment_mode: "dropoff" = leaving item at location; "meetup" = meeting in person
- deadline_label: Pick closest from exactly: "1 hour", "3 hours", "Tonight (10 PM)", "Tomorrow noon". Note your mapping in the reply.
- tag: one of "food", "transport", "social", "skills", "errands"
- reward_amount: numeric SGD amount, or omit for favour-only
- location_name: UTown venue name, or omit if unspecified

BEHAVIOUR:
1. You MUST always call the update_quest tool.
2. Merge fields from collected_fields (already known) with anything new you extract from the latest message.
3. If required fields are still missing: set complete=false and ask a natural follow-up question for AT MOST 2 missing fields at once. Be brief and friendly.
4. If ALL required fields are filled (title, description ≥20 chars, fulfilment_mode, deadline_label): set complete=true and write a short summary. Do NOT ask further questions.
5. Keep replies conversational and brief (1-3 sentences).

REQUIRED for complete=true: title, description (≥20 chars), fulfilment_mode, deadline_label.
OPTIONAL: tag, reward_amount, location_name.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'update_quest',
            description: 'Update the known quest fields and reply to the user',
            parameters: {
              type: 'object',
              properties: {
                reply: {
                  type: 'string',
                  description: 'Conversational reply to show the user in the chat',
                },
                complete: {
                  type: 'boolean',
                  description: 'True when all required fields are filled',
                },
                title: {
                  type: 'string',
                  description: 'Short quest title (≤10 words)',
                },
                description: {
                  type: 'string',
                  description: 'Clear description of what needs to be done (≥20 chars)',
                },
                tag: {
                  type: 'string',
                  enum: ['food', 'transport', 'social', 'skills', 'errands'],
                  description: 'Category',
                },
                fulfilment_mode: {
                  type: 'string',
                  enum: ['meetup', 'dropoff'],
                  description: 'meetup = meet in person; dropoff = leave item at location',
                },
                reward_amount: {
                  type: 'number',
                  description: 'SGD reward amount (omit if favour-only)',
                },
                deadline_label: {
                  type: 'string',
                  enum: ['1 hour', '3 hours', 'Tonight (10 PM)', 'Tomorrow noon'],
                  description: 'Deadline preset',
                },
                location_name: {
                  type: 'string',
                  description: 'UTown location name (omit if unspecified)',
                },
              },
              required: ['reply', 'complete'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'update_quest' } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({ error: 'AI did not return structured output' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    const extracted = JSON.parse(toolCall.function.arguments) as Partial<QuestFields> & {
      reply: string;
      complete: boolean;
    };

    // Merge: start from collected_fields, overlay with newly extracted non-null fields
    const merged: Partial<QuestFields> = { ...(collected_fields ?? {}) };
    const fieldKeys: (keyof QuestFields)[] = [
      'title', 'description', 'tag', 'fulfilment_mode',
      'reward_amount', 'deadline_label', 'location_name',
    ];
    for (const key of fieldKeys) {
      const val = (extracted as Record<string, unknown>)[key];
      if (val != null) {
        (merged as Record<string, unknown>)[key] = val;
      }
    }

    // Server-side truth: only mark complete if required fields are truly present
    const complete = extracted.complete === true && isComplete(merged);

    return new Response(
      JSON.stringify({ reply: extracted.reply, fields: merged, complete }),
      {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (err) {
    console.error('chat-quest error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});
