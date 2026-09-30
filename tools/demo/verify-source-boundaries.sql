BEGIN;

CREATE TEMP TABLE demo_phase ON COMMIT DROP AS SELECT :'phase'::text AS value;

CREATE TEMP TABLE demo_source_boundary ON COMMIT DROP AS
WITH fixture AS (
    SELECT 'IMAGE' AS source_type, url FROM demo_image_fixtures
    UNION ALL SELECT 'AUDIO', url FROM demo_audio_fixtures
), state AS (
    SELECT fixture.source_type, fixture.url,
           coalesce(image.id, audio.id) AS source_id,
           coalesce(image.origin, audio.origin) AS origin,
           CASE WHEN fixture.source_type = 'IMAGE' THEN
               (SELECT count(*) FROM library_images library
                WHERE library.image_source_id = image.id
                  AND library.account_id IN (SELECT id FROM accounts
                      WHERE lower(email) = 'scale-demo@lifelab.local'))
           ELSE (SELECT count(*) FROM library_audio library
                 WHERE library.audio_source_id = audio.id
                   AND library.account_id IN (SELECT id FROM accounts
                       WHERE lower(email) = 'scale-demo@lifelab.local')) END AS demo_memberships,
           CASE WHEN fixture.source_type = 'IMAGE' THEN
               (SELECT count(*) FROM library_images library
                WHERE library.image_source_id = image.id)
               + (SELECT count(*) FROM notes note WHERE note.image_source_id = image.id)
           ELSE (SELECT count(*) FROM library_audio library
                 WHERE library.audio_source_id = audio.id)
               + (SELECT count(*) FROM notes note WHERE note.audio_source_id = audio.id)
           END AS all_references
    FROM fixture
    LEFT JOIN image_sources image ON fixture.source_type = 'IMAGE'
                                 AND image.external_url = fixture.url
    LEFT JOIN audio_sources audio ON fixture.source_type = 'AUDIO'
                                 AND audio.external_url = fixture.url
)
SELECT * FROM state;

DO $$ BEGIN
    IF (SELECT value FROM demo_phase) = 'reset' THEN
        IF EXISTS (SELECT 1 FROM demo_source_boundary
                   WHERE demo_memberships <> 0 OR
                         (source_id IS NOT NULL AND all_references = 0)) THEN
            RAISE EXCEPTION 'Reset left Demo membership or unreferenced deterministic Demo-only Source';
        END IF;
    ELSIF (SELECT value FROM demo_phase) = 'seed' THEN
        IF (SELECT count(*) FROM demo_source_boundary
            WHERE source_type = 'IMAGE' AND source_id IS NOT NULL
              AND origin = 'EXTERNAL' AND demo_memberships = 1) <> 16
           OR (SELECT count(*) FROM demo_source_boundary
               WHERE source_type = 'AUDIO' AND source_id IS NOT NULL
                 AND origin = 'EXTERNAL' AND demo_memberships = 1) <> 9 THEN
            RAISE EXCEPTION 'Seed did not recreate all 25 deterministic Demo-only Sources and memberships';
        END IF;
    ELSE RAISE EXCEPTION 'Unknown Demo source-boundary phase'; END IF;
END $$;

SELECT :'phase' AS phase, source_type,
       count(*) FILTER (WHERE source_id IS NOT NULL) AS existing_sources,
       count(*) FILTER (WHERE demo_memberships = 1) AS demo_memberships
FROM demo_source_boundary GROUP BY source_type ORDER BY source_type;

ROLLBACK;
