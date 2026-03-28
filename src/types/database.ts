// Hand-authored types for the hackathon.
// Replace with: npx supabase gen types typescript --project-id <id> > types/database.ts

export type TrustTier = 'wanderer' | 'explorer' | 'champion';

export interface RouteOffer {
  id: string;
  user_id: string;
  destination_name: string;
  latitude: number;
  longitude: number;
  geohash: string;
  tags: string[];
  note: string | null;
  expires_at: string;
  is_active: boolean;
  transport_type: 'walking' | 'bus' | 'location';
  status: string;
  departure_delay_seconds: number;
  created_at: string;
}

export interface RouteOfferInsert {
  user_id: string;
  destination_name: string;
  latitude: number;
  longitude: number;
  geohash: string;
  tags?: string[];
  note?: string | null;
  expires_at: string;
}
export type QuestStatus = 'open' | 'in_progress' | 'completed' | 'expired' | 'disputed';
export type QuestTag = 'food' | 'transport' | 'social' | 'skills' | 'errands';
export type FulfilmentMode = 'meetup' | 'dropoff';
export type StrikeReason = 'non_payment' | 'abandonment';
export type QuestType = 'standard' | 'social' | 'crew';
export type MessageType = 'text' | 'image' | 'location';
export type ReportType = 'inappropriate_content' | 'harassment' | 'dispute' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';
export type CrewMemberStatus = 'active' | 'dropped_out';

export interface NotificationPreferences {
  new_quest?: boolean;
  quest_accepted?: boolean;
  quest_complete?: boolean;
  chat_message?: boolean;
  route_offer_nearby?: boolean;
  flash_quests?: boolean;
  categories?: string[];
}

export interface Profile {
  id: string;
  display_name: string;
  rc: string;
  matric_number: string | null;
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
  completion_rate: number;
  avg_response_time_mins: number | null;
  notification_preferences: NotificationPreferences;
  cross_rc_bonus: number;
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
  quest_type: QuestType;
  max_acceptors: number;
  suggested_reward: number | null;
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
  type: MessageType;
  image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
}

export interface CrewMember {
  id: string;
  quest_id: string;
  user_id: string;
  joined_at: string;
  status: CrewMemberStatus;
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: MessageType;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  quest_id: string | null;
  report_type: ReportType;
  description: string | null;
  status: ReportStatus;
  created_at: string;
}

type ProfileInsert = {
  id: string;
  display_name: string;
  rc: string;
  matric_number?: string | null;
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
  completion_rate?: number;
  avg_response_time_mins?: number | null;
  notification_preferences?: NotificationPreferences;
  cross_rc_bonus?: number;
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
  quest_type?: QuestType;
  max_acceptors?: number;
  suggested_reward?: number | null;
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
        Insert: {
          quest_id: string;
          sender_id: string;
          content: string;
          type?: MessageType;
          image_url?: string | null;
          latitude?: number | null;
          longitude?: number | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      direct_messages: {
        Row: DirectMessage;
        Insert: {
          sender_id: string;
          recipient_id: string;
          content: string;
          message_type?: MessageType;
          latitude?: number | null;
          longitude?: number | null;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      contacts: {
        Row: Contact;
        Insert: { user_id: string; contact_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      crew_members: {
        Row: CrewMember;
        Insert: { quest_id: string; user_id: string; status?: CrewMemberStatus };
        Update: { status?: CrewMemberStatus };
        Relationships: [];
      };
      reports: {
        Row: Report;
        Insert: {
          reporter_id: string;
          reported_user_id?: string | null;
          quest_id?: string | null;
          report_type: ReportType;
          description?: string | null;
        };
        Update: { status?: ReportStatus };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      search_quests: {
        Args: { query_embedding: number[]; match_threshold: number; match_count: number };
        Returns: { id: string; title: string; similarity: number }[];
      };
      update_trust_tier: {
        Args: { user_id: string };
        Returns: void;
      };
      update_trust_score: {
        Args: { p_user_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
 