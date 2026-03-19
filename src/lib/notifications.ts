import { supabase } from '@/lib/supabase';
import type { NotificationPreferences } from '@/types/database';

export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  options?: {
    notifType?: keyof NotificationPreferences;
    recipientId?: string;
    questCategory?: string;
  }
) {
  if (!pushToken) return;

  // Check notification preferences if we know who the recipient is
  if (options?.recipientId && options?.notifType) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', options.recipientId)
      .single();

    if (profile?.notification_preferences) {
      const prefs = profile.notification_preferences as NotificationPreferences;
      const typeKey = options.notifType;

      // Check if the specific notification type is enabled (default true if not set)
      if (prefs[typeKey] === false) return;

      // Check category filter if applicable
      if (
        options.questCategory &&
        prefs.categories &&
        Array.isArray(prefs.categories) &&
        prefs.categories.length > 0 &&
        !prefs.categories.includes(options.questCategory)
      ) {
        return;
      }
    }
  }

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: pushToken, title, body }),
    });
  } catch {
    // Silently fail — push is best-effort
  }
}
 