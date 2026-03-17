import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RouteOffer, RouteOfferInsert } from '@/types/database';

export function useRouteOffer(userId: string | undefined) {
  const [activeOffer, setActiveOffer] = useState<RouteOffer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOffer = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('route_offers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();
    setActiveOffer(data as RouteOffer | null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchOffer();
  }, [fetchOffer]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`route_offers:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'route_offers', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setActiveOffer(null);
          } else {
            const row = payload.new as RouteOffer;
            if (row.is_active) {
              setActiveOffer(row);
            } else {
              setActiveOffer((prev) => (prev?.id === row.id ? null : prev));
            }
          }
        },
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [userId]);

  const createOffer = useCallback(
    async (insert: Omit<RouteOfferInsert, 'user_id'>): Promise<RouteOffer | null> => {
      if (!userId) return null;
      // Deactivate any existing offer first
      await supabase
        .from('route_offers')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('route_offers')
        .insert({ ...insert, user_id: userId })
        .select()
        .single();

      if (error || !data) return null;
      const offer = data as RouteOffer;
      setActiveOffer(offer);
      return offer;
    },
    [userId],
  );

  const cancelOffer = useCallback(async () => {
    if (!userId || !activeOffer) return;
    setActiveOffer(null); // optimistic
    await supabase
      .from('route_offers')
      .update({ is_active: false })
      .eq('id', activeOffer.id);
  }, [userId, activeOffer]);

  return { activeOffer, loading, createOffer, cancelOffer };
}
