import OpenAI from 'https://deno.land/x/openai@v4.69.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY')! });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { quest_id } = await req.json();

    const { data: quest, error: fetchError } = await supabase
      .from('quests')
      .select('title, description, reward_amount')
      .eq('id', quest_id)
      .single();

    if (fetchError || !quest) {
      return new Response(JSON.stringify({ error: 'Quest not found' }), { status: 404 });
    }

    // 1. GPT-4o: tag, suggested price range, adventure title
    let tag = 'errands';
    let ai_title = quest.title;
    let suggested_price_min = 0;
    let suggested_price_max = 0;

    try {
      const taggingResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an AI for Ripple, a university peer-request platform in NUS UTown.
Given a quest title and description, return a JSON object with:
- tag: one of "food" | "transport" | "social" | "skills" | "errands"
- suggested_price_min: number (SGD)
- suggested_price_max: number (SGD)
- ai_title: a short fun adventure-story style title (max 10 words)`,
          },
          {
            role: 'user',
            content: `Title: ${quest.title}\nDescription: ${quest.description}`,
          },
        ],
      });

      const parsed = JSON.parse(taggingResponse.choices[0].message.content ?? '{}');
      if (parsed.tag) tag = parsed.tag;
      if (parsed.ai_title) ai_title = parsed.ai_title;
      if (typeof parsed.suggested_price_min === 'number') suggested_price_min = parsed.suggested_price_min;
      if (typeof parsed.suggested_price_max === 'number') suggested_price_max = parsed.suggested_price_max;
    } catch (aiErr) {
      console.error('GPT-4o tagging failed:', aiErr);
      // Continue with defaults — quest is still usable
    }

    // 2. Embed description for semantic search
    let embedding: number[] | null = null;
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: `${quest.title}. ${quest.description}`,
      });
      embedding = embeddingResponse.data[0].embedding;
    } catch (embErr) {
      console.error('Embedding failed:', embErr);
      // Non-fatal — quest is searchable by keyword, just not semantically
    }

    // 3. Update quest row
    const updatePayload: Record<string, unknown> = { tag, ai_generated_title: ai_title };
    if (embedding) updatePayload.embedding = embedding;

    const { data: updatedQuest } = await supabase
      .from('quests')
      .update(updatePayload)
      .eq('id', quest_id)
      .select('latitude, longitude, title')
      .single();

    // 4. Notify helpers with a nearby route offer (fire-and-forget)
    if (updatedQuest?.latitude && updatedQuest?.longitude) {
      const notifyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-route-offers`;
      fetch(notifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          quest_id,
          quest_lat: updatedQuest.latitude,
          quest_lng: updatedQuest.longitude,
          quest_title: updatedQuest.title ?? ai_title,
          quest_tag: tag,
        }),
      }).catch((e) => console.error('notify-route-offers invoke failed:', e));
    }

    return new Response(
      JSON.stringify({ tag, ai_title, suggested_price_min, suggested_price_max }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('process-quest error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
 