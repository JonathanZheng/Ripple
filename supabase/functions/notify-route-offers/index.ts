import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  try {
    const { quest_id, quest_lat, quest_lng, quest_title, quest_tag } = await req.json();

    if (!quest_lat || !quest_lng) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Find helpers with an active route offer near the quest
    const { data: offers, error } = await supabase.rpc('find_nearby_route_offers', {
      quest_lat,
      quest_lng,
    });

    if (error || !offers) {
      console.error('find_nearby_route_offers error:', error);
      return new Response(JSON.stringify({ error: 'RPC failed' }), { status: 500 });
    }

    let notified = 0;
    const notifications = [];

    for (const offer of offers as { user_id: string; push_token: string; tags: string[]; destination_name: string }[]) {
      // Match if no tag preference or tag matches
      if (offer.tags.length > 0 && !offer.tags.includes(quest_tag)) continue;
      if (!offer.push_token) continue;

      notifications.push({
        to: offer.push_token,
        title: 'Quest on your route! 🗺',
        body: `A ${quest_tag} quest near ${offer.destination_name} just dropped`,
        data: { quest_id },
      });
      notified++;
    }

    if (notifications.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications),
      });
    }

    return new Response(JSON.stringify({ notified }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-route-offers error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
 