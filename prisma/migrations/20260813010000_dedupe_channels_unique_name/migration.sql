-- Fix pre-existing duplicate channels (created by a race condition in
-- ensureDefaultChannels: concurrent requests could each see "no default
-- channels yet" and each create the full set). Reassign any messages
-- posted in a duplicate channel to the earliest channel with that name,
-- then drop the duplicates, before adding the uniqueness guarantee that
-- prevents this from happening again.

-- Reassign messages from duplicate-named channels to the earliest one
WITH ranked AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Channel"
),
dupes AS (
  SELECT r.id AS dup_id, k.id AS keep_id
  FROM ranked r
  JOIN ranked k ON k.name = r.name AND k.rn = 1
  WHERE r.rn > 1
)
UPDATE "Message" m
SET "channelId" = d.keep_id
FROM dupes d
WHERE m."channelId" = d.dup_id;

-- Delete the duplicate channels (ChannelCategory rows cascade automatically)
WITH ranked AS (
  SELECT id, name, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt" ASC, id ASC) AS rn
  FROM "Channel"
)
DELETE FROM "Channel"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_name_key" ON "Channel"("name");
