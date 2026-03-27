import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase'; // Adjust this path to your supabase client

// 1. Define the shape of our matched Quest
export interface QuestMatch {
  id: string;
  location_name: string;
  description: string;
  bounty: number;
  ai_match_score: number;
  is_at_destination: boolean;
}

export type TransportMode = 'walking' | 'bus';
export type JourneyStatus = 'idle' | 'waiting' | 'loading' | 'finalized';

interface LocationCoord {
  latitude: number;
  longitude: number;
  name?: string;
}

export const useTrajectory = (user: any, currentLocation: LocationCoord) => {
  const [journeyStatus, setJourneyStatus] = useState<JourneyStatus>('idle');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [matches, setMatches] = useState<QuestMatch[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to start the 5/10/15 min broadcast
  const startBroadcast = async (
    dest: LocationCoord, 
    delayMins: number, 
    transport: TransportMode
  ) => {
    const departureTime = new Date(Date.now() + delayMins * 60000);
    
    // Insert into your existing route_offers table
    const { error } = await supabase.from('route_offers').insert({
      user_id: user.id,
      destination_name: dest.name || 'Unknown Destination',
      start_latitude: currentLocation.latitude,
      start_longitude: currentLocation.longitude,
      destination_latitude: dest.latitude,
      destination_longitude: dest.longitude,
      transport_type: transport,
      departure_time: departureTime.toISOString(),
      status: 'waiting'
    });

    if (error) {
      console.error("Error starting broadcast:", error);
      return;
    }

    if (delayMins > 0) {
      setTimeLeft(delayMins * 60);
      setJourneyStatus('waiting');
    } else {
      getAIGuidedResults(dest, transport);
    }
  };

  // The "Leave Now" interrupt or timer completion
  const getAIGuidedResults = async (dest: LocationCoord, transport: TransportMode) => {
    setJourneyStatus('loading');

    // Calling the PostGIS + pgvector RPC function we created in SQL
    const { data, error } = await supabase.rpc('get_ai_ranked_route_quests', {
      user_origin_lon: currentLocation.longitude,
      user_origin_lat: currentLocation.latitude,
      user_dest_lon: dest.longitude,
      user_dest_lat: dest.latitude,
      user_pref_vector: user.embedding, // Ensure your user object has the preference vector
      transport_mode: transport
    });

    if (error) {
      console.error("AI Routing Error:", error);
      setJourneyStatus('idle');
    } else {
      setMatches(data as QuestMatch[]);
      setJourneyStatus('finalized');
    }
  };

  // Timer Logic
  useEffect(() => {
    if (journeyStatus === 'waiting' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && journeyStatus === 'waiting') {
      // Time is up! You can either auto-trigger or notify user
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, journeyStatus]);

  return { 
    journeyStatus, 
    timeLeft, 
    matches, 
    startBroadcast, 
    getAIGuidedResults 
  };
};