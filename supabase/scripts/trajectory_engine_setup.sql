-- 1. ENABLE SPATIAL DATA (Required for distance math)
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. UPDATE TABLES (Adds the new infrastructure)
-- Ensures quests have spatial coordinates
ALTER TABLE quests ADD COLUMN IF NOT EXISTS coords geography(POINT);
UPDATE quests SET coords = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography 
WHERE coords IS NULL AND longitude IS NOT NULL AND latitude IS NOT NULL;

-- 3. Add journey tracking columns
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS start_latitude FLOAT;
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS start_longitude FLOAT;
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS destination_latitude FLOAT;
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS destination_longitude FLOAT;
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS transport_type TEXT DEFAULT 'walking';
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'waiting';
ALTER TABLE route_offers ADD COLUMN IF NOT EXISTS departure_delay_seconds INT DEFAULT 0;

-- 4. CREATE THE AI TRAJECTORY ENGINE
-- This single function handles the routing logic, distance math, and AI ranking
DROP FUNCTION IF EXISTS get_ai_ranked_route_quests(float, float, float, float, vector, text);

CREATE OR REPLACE FUNCTION get_ai_ranked_route_quests(
  user_origin_lon FLOAT,
  user_origin_lat FLOAT,
  user_dest_lon FLOAT,
  user_dest_lat FLOAT,
  user_pref_vector vector(1536) DEFAULT NULL,
  transport_mode TEXT DEFAULT 'walking'
)
RETURNS TABLE (
  id uuid, 
  location_name text, 
  description text, 
  reward_amount numeric, 
  ai_match_score float, 
  is_at_destination boolean,
  distance_meters float
) AS $$
DECLARE
  origin geography := ST_SetSRID(ST_MakePoint(user_origin_lon, user_origin_lat), 4326)::geography;
  destination geography := ST_SetSRID(ST_MakePoint(user_dest_lon, user_dest_lat), 4326)::geography;
  route_line geometry := ST_MakeLine(ST_SetSRID(ST_MakePoint(user_origin_lon, user_origin_lat), 4326), ST_SetSRID(ST_MakePoint(user_dest_lon, user_dest_lat), 4326));
BEGIN
  RETURN QUERY
  SELECT 
    q.id, 
    q.location_name, 
    q.description, 
    q.reward_amount,
    CASE 
      WHEN user_pref_vector IS NULL THEN 1.0 
      ELSE (1 - (q.embedding <=> user_pref_vector))::float 
    END as ai_match_score,
    ST_DWithin(q.coords, destination, 300) as is_at_destination,
    CASE 
      WHEN transport_mode = 'bus' THEN LEAST(ST_Distance(q.coords, origin), ST_Distance(q.coords, destination))::float
      ELSE ST_Distance(q.coords, route_line::geography)::float
    END as distance_meters
  FROM quests q
  WHERE q.status = 'open'
    AND (
      -- Bus mode: endpoints only (300m radius)
      (transport_mode = 'bus' AND (ST_DWithin(q.coords, origin, 300) OR ST_DWithin(q.coords, destination, 300)))
      OR
      -- Walking mode: 100m wide corridor around the path
      (transport_mode = 'walking' AND ST_DWithin(q.coords, route_line::geography, 100))
      OR 
      -- Fallback: if user is at start/end
      (ST_DWithin(q.coords, destination, 300))
    )
  ORDER BY ai_match_score DESC;
END;
$$ LANGUAGE plpgsql;

-- 5. TRIGGER: Keep quest coordinates auto-synced
CREATE OR REPLACE FUNCTION update_quest_coords()
RETURNS TRIGGER AS $$
BEGIN
  NEW.coords := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_quest_coords ON quests;
CREATE TRIGGER trg_update_quest_coords
BEFORE INSERT OR UPDATE ON quests
FOR EACH ROW EXECUTE FUNCTION update_quest_coords();