// Hand-authored types for the hackathon.
// Replace with: npx supabase gen types typescript --project-id <id> > types/database.ts

export type TrustTier = 'wanderer' | 'explorer' | 'champion';
export type QuestStatus = 'open' | 'in_progress' | 'completed' | 'expired' | 'disputed';
export type QuestTag = 'food' | 'transport' | 'social' | 'skills' | 'errands';
export type FulfilmentMode = 'meetup' | 'dropoff';
export type StrikeReason = 'non_payment' | 'abandonment';

export interface Profile {
  id: string;
  matric_number: string;
  display_name: string;
  rc: string;
  skills: string[];
  trust_score: number;
  trust_tier: TrustTier;
  strikes: number;
  quests_completed: number;
  avg_rating: number;
  streak_count: number;
  last_active_date: string | null;
  avatar_url: string | null;
  push_token: string | null;
  created_at: string;
}

export interface Quest {
  id: string;
  poster_id: string;
  acceptor_id: string | null;
  title: string;
  description: string;
  tag: QuestTag;
  fulfilment_mode: FulfilmentMode;
  reward_amount: number;
  deadline: string;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  geohash: string | null;
  status: QuestStatus;
  drop_off_photo_url: string | null;
  ai_generated_title: string | null;
  is_flash: boolean;
  flash_expires_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  quest_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  created_at: string;
}

export interface Strike {
  id: string;
  user_id: string;
  quest_id: string;
  reason: StrikeReason;
  created_at: string;
}

export interface Message {
  id: string;
  quest_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

type ProfileInsert = {
  id: string;
  matric_number: string;
  display_name: string;
  rc: string;
  skills?: string[];
  trust_score?: number;
  trust_tier?: TrustTier;
  strikes?: number;
  quests_completed?: number;
  avg_rating?: number;
  streak_count?: number;
  last_active_date?: string | null;
  avatar_url?: string | null;
  push_token?: string | null;
};

type QuestInsert = {
  poster_id: string;
  title: string;
  description: string;
  tag?: QuestTag;
  fulfilment_mode: FulfilmentMode;
  reward_amount?: number;
  deadline: string;
  location_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  status?: QuestStatus;
  is_flash?: boolean;
  flash_expires_at?: string | null;
};

// Supabase Database type wrapper (used by the supabase client generic)
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      quests: {
        Row: Quest;
        Insert: QuestInsert;
        Update: Partial<QuestInsert> & {
          acceptor_id?: string | null;
          ai_generated_title?: string | null;
          drop_off_photo_url?: string | null;
          status?: QuestStatus;
        };
        Relationships: [];
      };
      ratings: {
        Row: Rating;
        Insert: { quest_id: string; rater_id: string; ratee_id: string; stars: number };
        Update: Record<string, never>;
        Relationships: [];
      };
      strikes: {
        Row: Strike;
        Insert: { user_id: string; quest_id: string; reason: StrikeReason };
        Update: Record<string, never>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: { quest_id: string; sender_id: string; content: string };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_quests: {
        Args: { query_embedding: number[]; match_threshold: number; match_count: number };
        Returns: { id: string; title: string; similarity: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
