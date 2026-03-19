import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';

export interface ContactWithProfile {
  contact_id: string;
  display_name: string;
  avatar_url: string | null;
  trust_tier: string;
  rc: string;
}

export function useContacts(userId: string | undefined) {
  const [contacts, setContacts] = useState<ContactWithProfile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchContacts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from('contacts')
      .select('contact_id, profiles!contacts_contact_id_fkey(id, display_name, avatar_url, trust_tier, rc)')
      .eq('user_id', userId);
    if (data) {
      setContacts(
        data
          .filter((c: any) => c.profiles)
          .map((c: any) => ({
            contact_id: c.contact_id,
            display_name: c.profiles.display_name,
            avatar_url: c.profiles.avatar_url,
            trust_tier: c.profiles.trust_tier,
            rc: c.profiles.rc,
          }))
      );
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  const addContact = useCallback(async (contactId: string) => {
    if (!userId) return;
    await supabase.from('contacts').insert({ user_id: userId, contact_id: contactId });
    await fetchContacts();
  }, [userId, fetchContacts]);

  const removeContact = useCallback(async (contactId: string) => {
    if (!userId) return;
    await supabase.from('contacts').delete().eq('user_id', userId).eq('contact_id', contactId);
    setContacts(prev => prev.filter(c => c.contact_id !== contactId));
  }, [userId]);

  const isContact = useCallback((contactId: string) => {
    return contacts.some(c => c.contact_id === contactId);
  }, [contacts]);

  return { contacts, loading, addContact, removeContact, isContact, refetch: fetchContacts };
}
