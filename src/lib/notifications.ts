export async function sendPushNotification(
  pushToken: string | null | undefined,
  title: string,
  body: string
) {
  if (!pushToken) return;
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
