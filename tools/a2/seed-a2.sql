BEGIN;
SELECT pg_advisory_xact_lock(hashtext('life-lab-a2-seed'));

CREATE TEMP TABLE a2_config AS
SELECT :'reference_date'::date AS reference_date,
       (:'reference_date'::date::timestamp + time '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS reference_instant;

DO $$
BEGIN
 IF (SELECT count(*) FROM a2_snapshot_sources) <> 100
 OR (SELECT count(*) FROM a2_snapshot_sources WHERE role='CURRENT_LIBRARY') <> 80
 OR (SELECT count(*) FROM a2_snapshot_sources WHERE role='HISTORICAL') <> 20
 OR (SELECT count(*) FROM a2_note_fixtures) <> 240
 OR (SELECT count(*) FROM a2_note_fixtures WHERE timestamp_seconds IS NOT NULL) <> 120
 OR EXISTS (SELECT 1 FROM a2_note_fixtures WHERE timestamp_seconds IS DISTINCT FROM cue_start_seconds)
 OR EXISTS (SELECT 1 FROM a2_note_fixtures n JOIN a2_snapshot_sources s USING(fixture_key)
            WHERE n.youtube_video_id<>s.youtube_video_id OR n.timestamp_seconds<0
               OR n.timestamp_seconds>=s.a2_duration_seconds)
 OR (SELECT sum(valid_sessions+invalid_sessions) FROM a2_watch_distribution) <> 1000
 OR (SELECT count(*) FROM a2_tag_links) <> 200 THEN
   RAISE EXCEPTION 'A2 temporary artifact preflight failed';
 END IF;
END $$;

-- Delete only personal data owned by the locked A2 account.
DELETE FROM tasks WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM notes WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM categories
WHERE account_id IN (
  SELECT id
  FROM accounts
  WHERE lower(email) = 'scale@lifelab.local'
);
DELETE FROM library_images
WHERE account_id IN (
  SELECT id
  FROM accounts
  WHERE lower(email) = 'scale@lifelab.local'
);
DELETE FROM library_audio
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'scale@lifelab.local'
);
DELETE FROM tags WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM library_videos WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM accounts WHERE lower(email)='scale@lifelab.local';

-- Remove only unreferenced A2 deterministic external Image sources.
-- Keep a global source if another account or Note still references it.
DELETE FROM image_sources image
USING a2_image_fixtures fixture
WHERE image.external_url = fixture.external_url
  AND image.origin = 'EXTERNAL'
  AND NOT EXISTS (
    SELECT 1
    FROM library_images library
    WHERE library.image_source_id = image.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM notes note
    WHERE note.image_source_id = image.id
  );

-- Remove only unreferenced deterministic A2 external Audio sources.
-- Preserve a global source when another account or Note still references it.
DELETE FROM audio_sources audio
USING a2_audio_fixtures fixture
WHERE audio.external_url = fixture.external_url
  AND audio.origin = 'EXTERNAL'
  AND NOT EXISTS (
      SELECT 1
      FROM library_audio library
      WHERE library.audio_source_id = audio.id
  )
  AND NOT EXISTS (
      SELECT 1
      FROM notes note
      WHERE note.audio_source_id = audio.id
  );

-- Recreate only A2 source rows that are now globally unreferenced. Shared rows survive unchanged.
DELETE FROM youtube_videos y USING a2_snapshot_sources s
WHERE y.youtube_video_id=s.youtube_video_id
  AND NOT EXISTS (SELECT 1 FROM library_videos l WHERE l.youtube_source_id=y.id)
  AND NOT EXISTS (SELECT 1 FROM notes n WHERE n.youtube_source_id=y.id);

CREATE TEMP TABLE a2_preexisting_sources AS
SELECT y.* FROM youtube_videos y JOIN a2_snapshot_sources s USING(youtube_video_id);

INSERT INTO youtube_videos(youtube_video_id,source_url,title,channel_name,thumbnail_url,duration_seconds,
 published_at,availability_status,created_at,updated_at)
SELECT s.youtube_video_id,s.source_url,s.title,s.channel_name,s.thumbnail_url,s.duration_seconds,
 s.published_at,s.availability_status,
 GREATEST(s.published_at,c.reference_instant-interval '920 days'),
 GREATEST(s.published_at,c.reference_instant-interval '920 days')
FROM a2_snapshot_sources s CROSS JOIN a2_config c
ON CONFLICT(youtube_video_id) DO NOTHING;

DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM youtube_videos y JOIN a2_snapshot_sources s USING(youtube_video_id)
   WHERE y.availability_status<>'AVAILABLE'
      OR (s.shared_with_a1 AND abs(y.duration_seconds-s.a2_duration_seconds)>1)
      OR (NOT s.shared_with_a1 AND EXISTS(SELECT 1 FROM a2_preexisting_sources p WHERE p.id=y.id)
          AND (y.duration_seconds<>s.duration_seconds OR y.source_url<>s.source_url))
 ) THEN RAISE EXCEPTION 'Existing global YouTube source is incompatible with A2 snapshot'; END IF;
END $$;

INSERT INTO accounts(email,password_hash,display_name,created_at,updated_at)
SELECT 'scale@lifelab.local',:'password_hash','Long-term Learning',reference_instant-interval '900 days',reference_instant-interval '900 days'
FROM a2_config;

CREATE TEMP TABLE a2_source_timeline AS
SELECT s.fixture_key,s.role,s.library_order,y.id youtube_source_id,
 GREATEST(y.published_at+interval '1 day', c.reference_instant-interval '870 days'
   + (row_number() OVER(ORDER BY s.role,s.fixture_key))*interval '6 days') added_at
FROM a2_snapshot_sources s JOIN youtube_videos y USING(youtube_video_id) CROSS JOIN a2_config c;

CREATE TEMP TABLE a2_library_map(fixture_key text primary key,library_video_id bigint,youtube_source_id bigint,added_at timestamptz);
WITH inserted AS (
 INSERT INTO library_videos(account_id,youtube_source_id,custom_title,personal_description,added_at,updated_at)
 SELECT a.id,t.youtube_source_id,
   CASE WHEN s.role='CURRENT_LIBRARY' AND s.library_order%5=0 THEN 'Study focus: '||s.title ELSE NULL END,
   CASE WHEN s.role='CURRENT_LIBRARY' AND s.library_order%10 IN(1,2,3) THEN 'Revisit the key ideas and connect them to the current learning project.' ELSE NULL END,
   t.added_at,t.added_at+((coalesce(s.library_order,90)*7)%48)*interval '1 hour'
 FROM a2_source_timeline t JOIN a2_snapshot_sources s USING(fixture_key)
 CROSS JOIN accounts a WHERE lower(a.email)='scale@lifelab.local'
 RETURNING id,youtube_source_id,added_at)
INSERT INTO a2_library_map
SELECT s.fixture_key,i.id,i.youtube_source_id,i.added_at FROM inserted i
JOIN a2_source_timeline s USING(youtube_source_id);

-- ---------------------------------------------------------------------------
-- A2 V2 Image Sources + Library
-- ---------------------------------------------------------------------------

INSERT INTO image_sources (
  origin,
  external_url,
  storage_key,
  original_filename,
  media_type,
  size_bytes,
  created_at
)
SELECT
  'EXTERNAL',
  fixture.external_url,
  NULL,
  NULL,
  NULL,
  NULL,
  (
    :'reference_date'::date::timestamp
    + time '12:00'
  ) AT TIME ZONE 'Asia/Ho_Chi_Minh'
    - interval '55 days'
    + right(fixture.fixture_key, 3)::integer * interval '1 day'
FROM a2_image_fixtures fixture
WHERE NOT EXISTS (
  SELECT 1
  FROM image_sources existing
  WHERE existing.external_url = fixture.external_url
);

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM image_sources source
    JOIN a2_image_fixtures fixture
      ON fixture.external_url = source.external_url
  ) <> 20 THEN
    RAISE EXCEPTION
      'A2 Image source count mismatch: expected 20';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM image_sources source
    JOIN a2_image_fixtures fixture
      ON fixture.external_url = source.external_url
    WHERE source.origin <> 'EXTERNAL'
       OR source.external_url IS NULL
       OR btrim(source.external_url) = ''
       OR source.storage_key IS NOT NULL
       OR source.original_filename IS NOT NULL
       OR source.media_type IS NOT NULL
       OR source.size_bytes IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'A2 external Image source shape validation failed';
  END IF;
END
$$;

CREATE TEMP TABLE a2_image_map (
  fixture_key TEXT PRIMARY KEY,
  image_source_id BIGINT NOT NULL,
  library_image_id BIGINT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL
);

INSERT INTO library_images (
  account_id,
  image_source_id,
  title,
  added_at
)
SELECT
  account.id,
  source.id,
  fixture.title,
  (
    :'reference_date'::date::timestamp
    + time '12:00'
  ) AT TIME ZONE 'Asia/Ho_Chi_Minh'
    - interval '30 days'
    + right(fixture.fixture_key, 3)::integer * interval '1 day'
FROM a2_image_fixtures fixture
JOIN image_sources source
  ON source.external_url = fixture.external_url
CROSS JOIN accounts account
WHERE lower(account.email) = 'scale@lifelab.local'
ORDER BY fixture.fixture_key;

INSERT INTO a2_image_map (
  fixture_key,
  image_source_id,
  library_image_id,
  added_at
)
SELECT
  fixture.fixture_key,
  source.id,
  library.id,
  library.added_at
FROM a2_image_fixtures fixture
JOIN image_sources source
  ON source.external_url = fixture.external_url
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN library_images library
  ON library.account_id = account.id
 AND library.image_source_id = source.id
ORDER BY fixture.fixture_key;

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM a2_image_map
  ) <> 20 THEN
    RAISE EXCEPTION
      'A2 Image Library count mismatch: expected 20';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_map map
    JOIN a2_image_fixtures fixture
      ON fixture.fixture_key = map.fixture_key
    JOIN library_images library
      ON library.id = map.library_image_id
    WHERE library.title IS DISTINCT FROM fixture.title
       OR btrim(library.title) = ''
  ) THEN
    RAISE EXCEPTION
      'A2 Image Library title validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_map map
    JOIN image_sources source
      ON source.id = map.image_source_id
    WHERE source.origin <> 'EXTERNAL'
       OR source.external_url IS NULL
       OR btrim(source.external_url) = ''
       OR source.storage_key IS NOT NULL
       OR source.original_filename IS NOT NULL
       OR source.media_type IS NOT NULL
       OR source.size_bytes IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'A2 Image Library source-shape validation failed';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Audio Sources + Library
-- ---------------------------------------------------------------------------

INSERT INTO audio_sources (
    origin,
    external_url,
    storage_key,
    original_filename,
    media_type,
    size_bytes,
    created_at
)
SELECT
    'EXTERNAL',
    fixture.external_url,
    NULL,
    NULL,
    NULL,
    NULL,
    config.reference_instant
        - interval '60 days'
        + right(fixture.fixture_key, 3)::integer * interval '1 hour'
FROM a2_audio_fixtures fixture
CROSS JOIN a2_config config
WHERE NOT EXISTS (
    SELECT 1
    FROM audio_sources existing
    WHERE existing.external_url = fixture.external_url
);

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM audio_sources source
        JOIN a2_audio_fixtures fixture
          ON fixture.external_url = source.external_url
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 Audio source count mismatch: expected 8';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM audio_sources source
        JOIN a2_audio_fixtures fixture
          ON fixture.external_url = source.external_url
        WHERE source.origin <> 'EXTERNAL'
           OR source.external_url IS NULL
           OR btrim(source.external_url) = ''
           OR source.storage_key IS NOT NULL
           OR source.original_filename IS NOT NULL
           OR source.media_type IS NOT NULL
           OR source.size_bytes IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'A2 external Audio source shape validation failed';
    END IF;
END
$$;

CREATE TEMP TABLE a2_audio_map (
    fixture_key TEXT PRIMARY KEY,
    audio_source_id BIGINT NOT NULL,
    library_audio_id BIGINT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL
);

INSERT INTO library_audio (
    account_id,
    audio_source_id,
    title,
    added_at
)
SELECT
    account.id,
    source.id,
    fixture.title,
    config.reference_instant
        - interval '18 days'
        + right(fixture.fixture_key, 3)::integer * interval '1 day'
FROM a2_audio_fixtures fixture
JOIN audio_sources source
  ON source.external_url = fixture.external_url
CROSS JOIN accounts account
CROSS JOIN a2_config config
WHERE lower(account.email) = 'scale@lifelab.local'
ORDER BY fixture.fixture_key;

INSERT INTO a2_audio_map (
    fixture_key,
    audio_source_id,
    library_audio_id,
    added_at
)
SELECT
    fixture.fixture_key,
    source.id,
    library.id,
    library.added_at
FROM a2_audio_fixtures fixture
JOIN audio_sources source
  ON source.external_url = fixture.external_url
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN library_audio library
  ON library.account_id = account.id
 AND library.audio_source_id = source.id
ORDER BY fixture.fixture_key;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'scale@lifelab.local';

    IF (
        SELECT count(*)
        FROM a2_audio_map
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 Audio Library count mismatch: expected 8';
    END IF;

    IF (
        SELECT count(*)
        FROM library_audio
        WHERE account_id = account_id_value
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 account Audio Library count mismatch: expected 8';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a2_audio_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN library_audio library
          ON library.id = map.library_audio_id
        WHERE library.account_id <> account_id_value
           OR library.audio_source_id <> map.audio_source_id
           OR library.title IS DISTINCT FROM fixture.title
           OR btrim(library.title) = ''
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Library mapping validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a2_audio_map map
        JOIN audio_sources source
          ON source.id = map.audio_source_id
        WHERE source.origin <> 'EXTERNAL'
           OR source.external_url IS NULL
           OR btrim(source.external_url) = ''
           OR source.storage_key IS NOT NULL
           OR source.original_filename IS NOT NULL
           OR source.media_type IS NOT NULL
           OR source.size_bytes IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Library source-shape validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a2_audio_map map
        JOIN audio_sources source
          ON source.id = map.audio_source_id
        JOIN library_audio library
          ON library.id = map.library_audio_id
        WHERE source.created_at > library.added_at
    ) THEN
        RAISE EXCEPTION
            'A2 Audio source/library temporal ordering failed';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Image Notes
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a2_image_note_map (
  fixture_key TEXT PRIMARY KEY,
  note_id BIGINT NOT NULL,
  image_source_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

INSERT INTO notes (
  account_id,
  source_type,
  youtube_source_id,
  image_source_id,
  audio_source_id,
  content,
  timestamp_seconds,
  created_at,
  updated_at
)
SELECT
  account.id,
  'IMAGE',
  NULL,
  image_map.image_source_id,
  NULL,
  fixture.note_content,
  NULL,
  image_map.added_at
    + interval '1 day'
    + right(fixture.fixture_key, 3)::integer
      * interval '1 hour',
  image_map.added_at
    + interval '1 day'
    + right(fixture.fixture_key, 3)::integer
      * interval '1 hour'
FROM a2_image_fixtures fixture
JOIN a2_image_map image_map
  ON image_map.fixture_key = fixture.fixture_key
CROSS JOIN accounts account
WHERE lower(account.email) = 'scale@lifelab.local'
ORDER BY fixture.fixture_key;

INSERT INTO a2_image_note_map (
  fixture_key,
  note_id,
  image_source_id,
  created_at
)
SELECT
  fixture.fixture_key,
  note.id,
  image_map.image_source_id,
  note.created_at
FROM a2_image_fixtures fixture
JOIN a2_image_map image_map
  ON image_map.fixture_key = fixture.fixture_key
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN notes note
  ON note.account_id = account.id
 AND note.source_type = 'IMAGE'
 AND note.image_source_id = image_map.image_source_id
ORDER BY fixture.fixture_key;

DO $$
DECLARE
  account_id_value BIGINT;
BEGIN
  SELECT id
  INTO STRICT account_id_value
  FROM accounts
  WHERE lower(email) = 'scale@lifelab.local';

  IF (
    SELECT count(*)
    FROM a2_image_note_map
  ) <> 20 THEN
    RAISE EXCEPTION
      'A2 Image Note count mismatch: expected 20';
  END IF;

  IF (
    SELECT count(*)
    FROM notes
    WHERE account_id = account_id_value
      AND source_type = 'IMAGE'
  ) <> 20 THEN
    RAISE EXCEPTION
      'A2 account Image Note count mismatch: expected 20';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_note_map map
    JOIN notes note
      ON note.id = map.note_id
    WHERE note.account_id <> account_id_value
       OR note.source_type <> 'IMAGE'
       OR note.youtube_source_id IS NOT NULL
       OR note.image_source_id <> map.image_source_id
       OR note.audio_source_id IS NOT NULL
       OR note.timestamp_seconds IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'A2 Image Note provenance validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_note_map map
    JOIN a2_image_fixtures fixture
      ON fixture.fixture_key = map.fixture_key
    JOIN notes note
      ON note.id = map.note_id
    WHERE note.content IS DISTINCT FROM fixture.note_content
       OR btrim(note.content) = ''
  ) THEN
    RAISE EXCEPTION
      'A2 Image Note content validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_note_map map
    WHERE NOT EXISTS (
      SELECT 1
      FROM library_images library
      WHERE library.account_id = account_id_value
        AND library.image_source_id = map.image_source_id
    )
  ) THEN
    RAISE EXCEPTION
      'A2 Image Note Library provenance validation failed';
  END IF;

END
$$;

INSERT INTO tags(account_id,name,normalized_name,created_at,updated_at)
SELECT a.id,t.name,lower(regexp_replace(btrim(t.name),'\s+',' ','g')),c.reference_instant-interval '600 days'+t.ordinal*interval '1 day',
 c.reference_instant-interval '600 days'+t.ordinal*interval '1 day'
FROM a2_tags t CROSS JOIN accounts a CROSS JOIN a2_config c WHERE lower(a.email)='scale@lifelab.local';

INSERT INTO library_video_tags(library_video_id,tag_id)
SELECT l.library_video_id,t.id FROM a2_tag_links x JOIN a2_library_map l USING(fixture_key)
JOIN tags t ON lower(t.name)=lower(x.tag_name) JOIN accounts a ON a.id=t.account_id
WHERE lower(a.email)='scale@lifelab.local';

-- Closed sessions distributed over the latest 24 months, never before Library add time.
WITH expanded AS (
 SELECT d.fixture_key,'VALID'::text validity,g session_no FROM a2_watch_distribution d,
      LATERAL generate_series(1,d.valid_sessions) g
 UNION ALL
 SELECT d.fixture_key,'INVALID',g FROM a2_watch_distribution d,
      LATERAL generate_series(1,d.invalid_sessions) g),
 timed AS (
 SELECT e.*,l.library_video_id,s.library_order,y.duration_seconds,
  GREATEST(l.added_at+interval '1 day',c.reference_instant-
   ((1+(s.library_order*37+e.session_no*17+(CASE e.validity WHEN 'VALID' THEN 0 ELSE 11 END))%720)||' days')::interval
   -(((s.library_order+e.session_no*3)%20)||' hours')::interval) started_at,
  CASE e.validity WHEN 'VALID' THEN LEAST(y.duration_seconds,45+((s.library_order*19+e.session_no*23)%420))
                   ELSE 5+((s.library_order*7+e.session_no*11)%25) END watch_seconds
 FROM expanded e JOIN a2_library_map l USING(fixture_key) JOIN a2_snapshot_sources s USING(fixture_key)
 JOIN youtube_videos y ON y.id=l.youtube_source_id CROSS JOIN a2_config c)
INSERT INTO watch_sessions(library_video_id,started_at,ended_at,last_heartbeat_at,watch_time_seconds,validity_status)
SELECT library_video_id,started_at,started_at+(watch_seconds+15)*interval '1 second',
 started_at+(watch_seconds+5)*interval '1 second',watch_seconds,validity FROM timed;

CREATE TEMP TABLE a2_note_map(fixture_key text,note_no integer,note_id bigint,created_at timestamptz,primary key(fixture_key,note_no));
WITH prepared AS (
 SELECT f.*,t.youtube_source_id,t.added_at,
  GREATEST(t.added_at+interval '2 days',c.reference_instant-
   ((30+(dense_rank() OVER(ORDER BY f.fixture_key)*29+f.note_no*13)%650)||' days')::interval) created_at
 FROM a2_note_fixtures f JOIN a2_source_timeline t USING(fixture_key) CROSS JOIN a2_config c),
 inserted AS (
 INSERT INTO notes(account_id,youtube_source_id,content,timestamp_seconds,created_at,updated_at)
 SELECT a.id,p.youtube_source_id,p.content,p.timestamp_seconds,p.created_at,p.created_at+((p.note_no*5)%36)*interval '1 hour'
 FROM prepared p CROSS JOIN accounts a WHERE lower(a.email)='scale@lifelab.local'
 RETURNING id,youtube_source_id,content,created_at)
INSERT INTO a2_note_map
SELECT p.fixture_key,p.note_no,i.id,i.created_at
FROM inserted i JOIN prepared p
  ON p.youtube_source_id=i.youtube_source_id
 AND p.created_at=i.created_at
 AND p.content=i.content;

DO $$
DECLARE
  account_id_value BIGINT;
BEGIN
  SELECT id
  INTO STRICT account_id_value
  FROM accounts
  WHERE lower(email) = 'scale@lifelab.local';

  IF (
    SELECT count(*)
    FROM notes
    WHERE account_id = account_id_value
  ) <> 260 THEN
    RAISE EXCEPTION
      'A2 total Note count mismatch: expected 260';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Audio Notes
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a2_audio_note_map (
    fixture_key TEXT PRIMARY KEY,
    note_id BIGINT NOT NULL,
    audio_source_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

INSERT INTO notes (
    account_id,
    source_type,
    youtube_source_id,
    image_source_id,
    audio_source_id,
    content,
    timestamp_seconds,
    created_at,
    updated_at
)
SELECT
    account.id,
    'AUDIO',
    NULL,
    NULL,
    audio_map.audio_source_id,
    fixture.note_content,
    fixture.timestamp_seconds,
    audio_map.added_at + interval '2 hours',
    audio_map.added_at + interval '2 hours'
FROM a2_audio_fixtures fixture
JOIN a2_audio_map audio_map
  ON audio_map.fixture_key = fixture.fixture_key
CROSS JOIN accounts account
WHERE lower(account.email) = 'scale@lifelab.local'
ORDER BY fixture.fixture_key;

INSERT INTO a2_audio_note_map (
    fixture_key,
    note_id,
    audio_source_id,
    created_at
)
SELECT
    fixture.fixture_key,
    note.id,
    audio_map.audio_source_id,
    note.created_at
FROM a2_audio_fixtures fixture
JOIN a2_audio_map audio_map
  ON audio_map.fixture_key = fixture.fixture_key
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN notes note
  ON note.account_id = account.id
 AND note.source_type = 'AUDIO'
 AND note.audio_source_id = audio_map.audio_source_id
ORDER BY fixture.fixture_key;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'scale@lifelab.local';

    IF (
        SELECT count(*)
        FROM a2_audio_note_map
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 Audio Note count mismatch: expected 8';
    END IF;

    IF (
        SELECT count(*)
        FROM notes
        WHERE account_id = account_id_value
          AND source_type = 'AUDIO'
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 account Audio Note count mismatch: expected 8';
    END IF;

    -- AUDIO provenance:
    -- exactly audio_source_id populated.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.account_id <> account_id_value
           OR note.source_type <> 'AUDIO'
           OR note.youtube_source_id IS NOT NULL
           OR note.image_source_id IS NOT NULL
           OR note.audio_source_id <> map.audio_source_id
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note provenance validation failed';
    END IF;

    -- Content and timestamp must exactly match the manifest.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.content IS DISTINCT FROM fixture.note_content
           OR btrim(note.content) = ''
           OR note.timestamp_seconds
                IS DISTINCT FROM fixture.timestamp_seconds
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note fixture validation failed';
    END IF;

    -- Every Audio Note source must belong to the account's Audio Library.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        WHERE NOT EXISTS (
            SELECT 1
            FROM library_audio library
            WHERE library.account_id = account_id_value
              AND library.audio_source_id = map.audio_source_id
        )
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note Library provenance validation failed';
    END IF;

    -- Exactly three fixtures deliberately exercise timestamp zero.
    IF (
        SELECT count(*)
        FROM a2_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds = 0
    ) <> 3 THEN
        RAISE EXCEPTION
            'A2 Audio timestamp-zero count mismatch: expected 3';
    END IF;

    -- Five fixtures exercise positive Audio timestamps.
    IF (
        SELECT count(*)
        FROM a2_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds > 0
    ) <> 5 THEN
        RAISE EXCEPTION
            'A2 Audio positive timestamp count mismatch: expected 5';
    END IF;

    -- No negative Audio timestamps.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds < 0
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note contains negative timestamp';
    END IF;

    -- Source must be created before Library membership;
    -- Library membership must exist before the Note.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN audio_sources source
          ON source.id = map.audio_source_id
        JOIN library_audio library
          ON library.account_id = account_id_value
         AND library.audio_source_id = map.audio_source_id
        JOIN notes note
          ON note.id = map.note_id
        WHERE source.created_at > library.added_at
           OR library.added_at > note.created_at
           OR note.created_at > note.updated_at
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note temporal ordering validation failed';
    END IF;

    IF (
        SELECT count(*)
        FROM notes
        WHERE account_id = account_id_value
    ) <> 268 THEN
        RAISE EXCEPTION
            'A2 total Note count mismatch after Audio: expected 268';
    END IF;

    -- Audio Tasks are intentionally deferred to A2-V2-13.
    IF EXISTS (
        SELECT 1
        FROM tasks task
        JOIN notes note
          ON note.id = task.source_note_id
        WHERE task.account_id = account_id_value
          AND note.source_type = 'AUDIO'
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task unexpectedly exists before Audio Task phase';
    END IF;
END
$$;

-- HAS_SOURCE tasks retain exact Notes, including deterministic historical coverage.
CREATE TEMP TABLE a2_task_inserted(id bigint,source_status text,status text);
WITH desired AS (
 SELECT m.source_status,x.status,g task_no FROM a2_task_matrix m
 CROSS JOIN LATERAL (VALUES('COMPLETED',m.completed),('NOT_STARTED',m.not_started),('IN_PROGRESS',m.in_progress)) x(status,n)
 CROSS JOIN LATERAL generate_series(1,x.n) g WHERE m.source_status='HAS_SOURCE'),
 numbered AS (SELECT d.*,row_number() OVER(ORDER BY status,task_no) ordinal FROM desired d),
 note_order AS (SELECT n.*,row_number() OVER(ORDER BY s.role DESC,n.fixture_key,n.note_no) rn,count(*) OVER() total FROM a2_note_map n JOIN a2_snapshot_sources s USING(fixture_key)),
 inserted AS (
 INSERT INTO tasks(account_id,source_note_id,source_status,title,description,status,deadline,created_at,updated_at)
 SELECT a.id,n.note_id,'HAS_SOURCE','Apply note insight: '||left(f.content,150),
  'Turn the linked learning note into a concrete follow-up action.',d.status,NULL,
  n.created_at+interval '1 day'+(d.ordinal%18)*interval '1 hour',n.created_at+interval '1 day'+(d.ordinal%18)*interval '1 hour'
 FROM numbered d JOIN note_order n ON n.rn=((d.ordinal-1)%n.total)+1 JOIN a2_note_fixtures f USING(fixture_key,note_no)
 CROSS JOIN accounts a WHERE lower(a.email)='scale@lifelab.local' RETURNING id,source_status,status)
INSERT INTO a2_task_inserted SELECT * FROM inserted;

WITH desired AS (
 SELECT m.source_status,x.status,g task_no FROM a2_task_matrix m
 CROSS JOIN LATERAL (VALUES('COMPLETED',m.completed),('NOT_STARTED',m.not_started),('IN_PROGRESS',m.in_progress)) x(status,n)
 CROSS JOIN LATERAL generate_series(1,x.n) g WHERE m.source_status='INDEPENDENT'),
 numbered AS (SELECT d.*,row_number() OVER(ORDER BY status,task_no) ordinal FROM desired d),
 inserted AS (
 INSERT INTO tasks(account_id,source_note_id,source_status,title,description,status,deadline,created_at,updated_at)
 SELECT a.id,NULL,'INDEPENDENT','Independent learning action: '||
  (ARRAY['Review backend patterns','Practice data structures','Refine frontend interaction','Summarize database concepts','Plan the next study session'])[((d.ordinal-1)%5)+1],
  'A standalone step in the long-term learning plan.',d.status,NULL,
  c.reference_instant-((1+(d.ordinal*31)%700)||' days')::interval,c.reference_instant-((1+(d.ordinal*31)%700)||' days')::interval
 FROM numbered d CROSS JOIN accounts a CROSS JOIN a2_config c WHERE lower(a.email)='scale@lifelab.local' RETURNING id,source_status,status)
INSERT INTO a2_task_inserted SELECT * FROM inserted;

-- SOURCE_MISSING uses the real lifecycle: temporary Note -> linked Task -> detach -> delete Note.
CREATE TEMP TABLE a2_temp_notes AS
WITH inserted AS (
 INSERT INTO notes(account_id,youtube_source_id,content,timestamp_seconds,created_at,updated_at)
 SELECT a.id,t.youtube_source_id,'A2 temporary source lifecycle fixture '||g,NULL,c.reference_instant-interval '500 days'+g*interval '3 days',
 c.reference_instant-interval '500 days'+g*interval '3 days'
 FROM generate_series(1,40) g JOIN a2_source_timeline t ON t.fixture_key=(SELECT fixture_key FROM a2_snapshot_sources ORDER BY fixture_key OFFSET ((g-1)%100) LIMIT 1)
 CROSS JOIN accounts a CROSS JOIN a2_config c WHERE lower(a.email)='scale@lifelab.local' RETURNING id,created_at)
SELECT *,row_number() OVER(ORDER BY id) rn FROM inserted;

CREATE TEMP TABLE a2_missing_tasks AS
WITH desired AS (
 SELECT x.status,g task_no FROM a2_task_matrix m
 CROSS JOIN LATERAL (VALUES('COMPLETED',m.completed),('NOT_STARTED',m.not_started),('IN_PROGRESS',m.in_progress)) x(status,n)
 CROSS JOIN LATERAL generate_series(1,x.n) g WHERE m.source_status='SOURCE_MISSING'),
 numbered AS (SELECT d.*,row_number() OVER(ORDER BY status,task_no) ordinal FROM desired d),
 inserted AS (
 INSERT INTO tasks(account_id,source_note_id,source_status,title,description,status,deadline,created_at,updated_at)
 SELECT a.id,n.id,'HAS_SOURCE','Rebuild context: '||
 (ARRAY['review the core concept','retrace the implementation idea','recheck the worked example','summarize the learning outcome','connect the missing source to current work','practice the underlying technique','document the remaining question','validate the remembered approach'])[((d.ordinal-1)%8)+1],
 'The original Note was later removed; preserve the learning action and reconstruct only known context.',d.status,NULL,n.created_at+interval '1 day',n.created_at+interval '1 day'
 FROM numbered d JOIN a2_temp_notes n ON n.rn=d.ordinal CROSS JOIN accounts a WHERE lower(a.email)='scale@lifelab.local'
 RETURNING id,status)
SELECT * FROM inserted;
UPDATE tasks t SET source_note_id=NULL,source_status='SOURCE_MISSING',updated_at=t.updated_at+interval '1 day'
FROM a2_missing_tasks i WHERE t.id=i.id;
INSERT INTO a2_task_inserted SELECT t.id,t.source_status,t.status FROM tasks t CROSS JOIN accounts a
WHERE t.account_id=a.id AND lower(a.email)='scale@lifelab.local' AND t.source_status='SOURCE_MISSING';
DELETE FROM notes WHERE id IN(SELECT id FROM a2_temp_notes);

-- Assign the exact incomplete deadline matrix using production precedence.
WITH incomplete AS (
 SELECT t.id,row_number() OVER(ORDER BY t.source_status,t.id) rn FROM tasks t JOIN accounts a ON a.id=t.account_id
 WHERE lower(a.email)='scale@lifelab.local' AND t.status<>'COMPLETED')
UPDATE tasks t SET deadline=CASE
 WHEN i.rn<=25 THEN c.reference_date-(1+(i.rn%45))::integer
 WHEN i.rn<=33 THEN c.reference_date
 WHEN i.rn<=80 THEN c.reference_date+(1+(i.rn%60))::integer
 ELSE NULL END
FROM incomplete i CROSS JOIN a2_config c WHERE t.id=i.id;

-- ---------------------------------------------------------------------------
-- A2 V2 Image Tasks
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a2_image_task_map (
  fixture_key TEXT PRIMARY KEY,
  task_id BIGINT NOT NULL,
  note_id BIGINT NOT NULL
);

DO $$
DECLARE
  r RECORD;
  account_id_value BIGINT;
  note_id_value BIGINT;
  note_created_at TIMESTAMPTZ;
  task_id_value BIGINT;
  deadline_value DATE;
  reference_date_value DATE;
  fixture_no_value INTEGER;
BEGIN
  SELECT id
  INTO STRICT account_id_value
  FROM accounts
  WHERE lower(email) = 'scale@lifelab.local';

  SELECT reference_date
  INTO reference_date_value
  FROM a2_config;

  FOR r IN
    SELECT *
    FROM a2_image_fixtures
    WHERE task_title IS NOT NULL
      AND btrim(task_title) <> ''
    ORDER BY fixture_key
  LOOP
    SELECT
      note_id,
      created_at
    INTO STRICT
      note_id_value,
      note_created_at
    FROM a2_image_note_map
    WHERE fixture_key = r.fixture_key;

    fixture_no_value := right(r.fixture_key, 3)::integer;

    deadline_value :=
      CASE r.deadline_class
        WHEN 'OVERDUE' THEN
          reference_date_value - ((fixture_no_value % 5) + 1)
        WHEN 'TODAY' THEN
          reference_date_value
        WHEN 'UPCOMING' THEN
          reference_date_value + ((fixture_no_value % 7) + 1)
        WHEN 'NO_DEADLINE' THEN
          NULL
        ELSE
          NULL
      END;

    IF r.deadline_class IS NULL
       OR r.deadline_class NOT IN (
         'OVERDUE', 'TODAY', 'UPCOMING', 'NO_DEADLINE'
       ) THEN
      RAISE EXCEPTION
        'Unsupported A2 Image deadline class: %',
        r.deadline_class;
    END IF;

    IF r.task_status IS NULL
       OR r.task_status NOT IN (
         'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'
       ) THEN
      RAISE EXCEPTION
        'Unsupported A2 Image task status: %',
        r.task_status;
    END IF;

    INSERT INTO tasks (
      account_id,
      source_note_id,
      source_status,
      title,
      description,
      status,
      deadline,
      created_at,
      updated_at
    )
    VALUES (
      account_id_value,
      note_id_value,
      'HAS_SOURCE',
      r.task_title,
      NULL,
      r.task_status,
      deadline_value,
      note_created_at + interval '2 hours',
      note_created_at + interval '2 hours'
    )
    RETURNING id INTO task_id_value;

    INSERT INTO a2_image_task_map (
      fixture_key,
      task_id,
      note_id
    )
    VALUES (
      r.fixture_key,
      task_id_value,
      note_id_value
    );
  END LOOP;

  IF (SELECT count(*) FROM a2_image_task_map) <> 13 THEN
    RAISE EXCEPTION
      'A2 Image Task count mismatch: expected 13';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_task_map map
    JOIN tasks task ON task.id = map.task_id
    JOIN notes note ON note.id = map.note_id
    JOIN a2_image_note_map note_map
      ON note_map.fixture_key = map.fixture_key
    WHERE task.account_id <> account_id_value
       OR task.source_status <> 'HAS_SOURCE'
       OR task.source_note_id <> map.note_id
       OR note.account_id <> account_id_value
       OR note.source_type <> 'IMAGE'
       OR note.image_source_id <> note_map.image_source_id
       OR note.youtube_source_id IS NOT NULL
       OR note.audio_source_id IS NOT NULL
       OR note.timestamp_seconds IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'A2 Image Task provenance validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_task_map map
    JOIN a2_image_fixtures fixture
      ON fixture.fixture_key = map.fixture_key
    JOIN tasks task ON task.id = map.task_id
    WHERE task.title IS DISTINCT FROM fixture.task_title
       OR task.status IS DISTINCT FROM fixture.task_status
  ) THEN
    RAISE EXCEPTION
      'A2 Image Task fixture validation failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_fixtures fixture
    LEFT JOIN a2_image_task_map map
      ON map.fixture_key = fixture.fixture_key
    WHERE (fixture.task_title IS NULL OR btrim(fixture.task_title) = '')
      AND map.task_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'A2 Image note-only fixture unexpectedly created a Task';
  END IF;

  IF (SELECT count(*) FROM a2_image_task_map map JOIN tasks task ON task.id = map.task_id WHERE task.status = 'NOT_STARTED') <> 9 THEN
    RAISE EXCEPTION 'A2 Image NOT_STARTED Task count mismatch';
  END IF;

  IF (SELECT count(*) FROM a2_image_task_map map JOIN tasks task ON task.id = map.task_id WHERE task.status = 'IN_PROGRESS') <> 4 THEN
    RAISE EXCEPTION 'A2 Image IN_PROGRESS Task count mismatch';
  END IF;

  IF (SELECT count(*) FROM a2_image_task_map map JOIN tasks task ON task.id = map.task_id WHERE task.status = 'COMPLETED') <> 0 THEN
    RAISE EXCEPTION 'A2 Image COMPLETED Task count mismatch';
  END IF;

  IF (SELECT count(*)
    FROM a2_image_task_map map
    JOIN a2_image_fixtures fixture ON fixture.fixture_key = map.fixture_key
    JOIN tasks task ON task.id = map.task_id
    WHERE fixture.deadline_class = 'UPCOMING'
      AND task.deadline > reference_date_value) <> 9 THEN
    RAISE EXCEPTION 'A2 Image UPCOMING Task count mismatch';
  END IF;

  IF (SELECT count(*)
    FROM a2_image_task_map map
    JOIN a2_image_fixtures fixture ON fixture.fixture_key = map.fixture_key
    JOIN tasks task ON task.id = map.task_id
    WHERE fixture.deadline_class = 'TODAY'
      AND task.deadline = reference_date_value) <> 3 THEN
    RAISE EXCEPTION 'A2 Image TODAY Task count mismatch';
  END IF;

  IF (SELECT count(*)
    FROM a2_image_task_map map
    JOIN a2_image_fixtures fixture ON fixture.fixture_key = map.fixture_key
    JOIN tasks task ON task.id = map.task_id
    WHERE fixture.deadline_class = 'NO_DEADLINE'
      AND task.deadline IS NULL) <> 1 THEN
    RAISE EXCEPTION 'A2 Image NO_DEADLINE Task count mismatch';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM a2_image_task_map map
    JOIN a2_image_fixtures fixture ON fixture.fixture_key = map.fixture_key
    JOIN tasks task ON task.id = map.task_id
    WHERE (fixture.deadline_class = 'NO_DEADLINE' AND task.deadline IS NOT NULL)
       OR (fixture.deadline_class = 'TODAY' AND task.deadline IS DISTINCT FROM reference_date_value)
       OR (fixture.deadline_class = 'OVERDUE' AND (task.deadline IS NULL OR task.deadline >= reference_date_value))
       OR (fixture.deadline_class = 'UPCOMING' AND (task.deadline IS NULL OR task.deadline <= reference_date_value))
  ) THEN
    RAISE EXCEPTION 'A2 Image Task deadline validation failed';
  END IF;

  IF (SELECT count(*) FROM tasks WHERE account_id = account_id_value) <> 413 THEN
    RAISE EXCEPTION
      'A2 total Task count mismatch: expected 413';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Audio Tasks
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a2_audio_task_map (
    fixture_key TEXT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    note_id BIGINT NOT NULL
);

DO $$
DECLARE
    r RECORD;
    account_id_value BIGINT;
    note_id_value BIGINT;
    note_created_at TIMESTAMPTZ;
    task_id_value BIGINT;
    deadline_value DATE;
    reference_date_value DATE;
    fixture_no_value INTEGER;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'scale@lifelab.local';

    SELECT reference_date
    INTO STRICT reference_date_value
    FROM a2_config;

    FOR r IN
        SELECT *
        FROM a2_audio_fixtures
        WHERE task_title IS NOT NULL
          AND btrim(task_title) <> ''
        ORDER BY fixture_key
    LOOP
        SELECT
            note_id,
            created_at
        INTO STRICT
            note_id_value,
            note_created_at
        FROM a2_audio_note_map
        WHERE fixture_key = r.fixture_key;

        fixture_no_value :=
            right(r.fixture_key, 3)::integer;

        deadline_value :=
            CASE r.deadline_class
                WHEN 'OVERDUE' THEN
                    reference_date_value
                        - ((fixture_no_value % 5) + 1)

                WHEN 'TODAY' THEN
                    reference_date_value

                WHEN 'UPCOMING' THEN
                    reference_date_value
                        + ((fixture_no_value % 7) + 1)

                WHEN 'NO_DEADLINE' THEN
                    NULL

                ELSE
                    NULL
            END;

        IF r.task_status NOT IN (
            'NOT_STARTED',
            'IN_PROGRESS',
            'COMPLETED'
        ) THEN
            RAISE EXCEPTION
                'Invalid A2 Audio Task status for %: %',
                r.fixture_key,
                r.task_status;
        END IF;

        IF r.deadline_class NOT IN (
            'OVERDUE',
            'TODAY',
            'UPCOMING',
            'NO_DEADLINE'
        ) THEN
            RAISE EXCEPTION
                'Invalid A2 Audio deadline class for %: %',
                r.fixture_key,
                r.deadline_class;
        END IF;

        INSERT INTO tasks (
            account_id,
            source_note_id,
            source_status,
            title,
            description,
            status,
            deadline,
            created_at,
            updated_at
        )
        VALUES (
            account_id_value,
            note_id_value,
            'HAS_SOURCE',
            r.task_title,
            NULL,
            r.task_status,
            deadline_value,
            note_created_at + interval '2 hours',
            note_created_at + interval '2 hours'
        )
        RETURNING id
        INTO task_id_value;

        INSERT INTO a2_audio_task_map (
            fixture_key,
            task_id,
            note_id
        )
        VALUES (
            r.fixture_key,
            task_id_value,
            note_id_value
        );
    END LOOP;

    IF (
        SELECT count(*)
        FROM a2_audio_task_map
    ) <> 5 THEN
        RAISE EXCEPTION
            'A2 Audio Task count mismatch: expected 5';
    END IF;

    -- Every Audio Task must belong to A2, use HAS_SOURCE,
    -- and point to its exact Audio Note.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN tasks task
          ON task.id = map.task_id
        JOIN notes note
          ON note.id = map.note_id
        WHERE task.account_id <> account_id_value
           OR task.source_status <> 'HAS_SOURCE'
           OR task.source_note_id <> map.note_id
           OR note.account_id <> account_id_value
           OR note.source_type <> 'AUDIO'
           OR note.youtube_source_id IS NOT NULL
           OR note.image_source_id IS NOT NULL
           OR note.audio_source_id IS NULL
           OR note.timestamp_seconds
                IS DISTINCT FROM fixture.timestamp_seconds
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task provenance validation failed';
    END IF;

    -- Task title/status must exactly match the manifest.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.title IS DISTINCT FROM fixture.task_title
           OR task.status IS DISTINCT FROM fixture.task_status
           OR btrim(task.title) = ''
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task fixture validation failed';
    END IF;

    -- All note-only Audio fixtures must remain Task-free.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_fixtures fixture
        JOIN a2_audio_note_map note_map
          ON note_map.fixture_key = fixture.fixture_key
        JOIN tasks task
          ON task.account_id = account_id_value
         AND task.source_note_id = note_map.note_id
        WHERE fixture.task_title IS NULL
           OR btrim(fixture.task_title) = ''
    ) THEN
        RAISE EXCEPTION
            'A2 Audio note-only fixture unexpectedly has a Task';
    END IF;

    -- Exactly five Audio Notes have Tasks and three remain note-only.
    IF (
        SELECT count(*)
        FROM a2_audio_note_map note_map
        WHERE EXISTS (
            SELECT 1
            FROM tasks task
            WHERE task.account_id = account_id_value
              AND task.source_note_id = note_map.note_id
        )
    ) <> 5 THEN
        RAISE EXCEPTION
            'A2 Audio linked-Note count mismatch: expected 5';
    END IF;

    IF (
        SELECT count(*)
        FROM a2_audio_note_map note_map
        WHERE NOT EXISTS (
            SELECT 1
            FROM tasks task
            WHERE task.account_id = account_id_value
              AND task.source_note_id = note_map.note_id
        )
    ) <> 3 THEN
        RAISE EXCEPTION
            'A2 Audio note-only count mismatch: expected 3';
    END IF;

    -- Locked Audio Task status distribution.
    IF (
        SELECT count(*)
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'NOT_STARTED'
    ) <> 3 THEN
        RAISE EXCEPTION
            'A2 Audio NOT_STARTED count mismatch: expected 3';
    END IF;

    IF (
        SELECT count(*)
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'IN_PROGRESS'
    ) <> 2 THEN
        RAISE EXCEPTION
            'A2 Audio IN_PROGRESS count mismatch: expected 2';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'COMPLETED'
    ) THEN
        RAISE EXCEPTION
            'A2 Audio COMPLETED count mismatch: expected 0';
    END IF;

    -- Locked Audio deadline distribution:
    -- TODAY=2, UPCOMING=2, NO_DEADLINE=1, OVERDUE=0.
    IF (
        SELECT count(*)
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.deadline = reference_date_value
    ) <> 2 THEN
        RAISE EXCEPTION
            'A2 Audio TODAY deadline count mismatch: expected 2';
    END IF;

    IF (
        SELECT count(*)
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.deadline > reference_date_value
    ) <> 2 THEN
        RAISE EXCEPTION
            'A2 Audio UPCOMING deadline count mismatch: expected 2';
    END IF;

    IF (
        SELECT count(*)
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.deadline IS NULL
    ) <> 1 THEN
        RAISE EXCEPTION
            'A2 Audio NO_DEADLINE count mismatch: expected 1';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.deadline < reference_date_value
    ) THEN
        RAISE EXCEPTION
            'A2 Audio OVERDUE deadline count mismatch: expected 0';
    END IF;

    -- Manifest deadline class must match the generated deadline.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN tasks task
          ON task.id = map.task_id
        WHERE
            CASE
                WHEN task.deadline IS NULL
                    THEN 'NO_DEADLINE'
                WHEN task.deadline < reference_date_value
                    THEN 'OVERDUE'
                WHEN task.deadline = reference_date_value
                    THEN 'TODAY'
                ELSE 'UPCOMING'
            END
            IS DISTINCT FROM fixture.deadline_class
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task deadline-class validation failed';
    END IF;

    -- Task must be created after its source Note.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN notes note
          ON note.id = map.note_id
        JOIN tasks task
          ON task.id = map.task_id
        WHERE note.created_at > task.created_at
           OR task.created_at > task.updated_at
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task temporal ordering failed';
    END IF;

    IF (
        SELECT count(*)
        FROM tasks
        WHERE account_id = account_id_value
    ) <> 418 THEN
        RAISE EXCEPTION
            'A2 total Task count mismatch after Audio: expected 418';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Image Organization
-- ---------------------------------------------------------------------------

INSERT INTO categories (account_id, name, normalized_name, created_at, updated_at)
SELECT a.id, f.category_name, lower(btrim(f.category_name)),
     c.reference_instant - interval '20 days', c.reference_instant - interval '20 days'
FROM (SELECT DISTINCT category_name FROM a2_image_fixtures) f
CROSS JOIN accounts a CROSS JOIN a2_config c
WHERE lower(a.email) = 'scale@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

WITH image_tag_names AS (
  SELECT DISTINCT btrim(x.tag_name) AS tag_name
  FROM a2_image_fixtures f
  CROSS JOIN LATERAL jsonb_array_elements_text(f.tags_json::jsonb) x(tag_name)
)
INSERT INTO tags (account_id, name, normalized_name, created_at, updated_at)
SELECT a.id, x.tag_name, lower(x.tag_name),
     c.reference_instant - interval '20 days', c.reference_instant - interval '20 days'
FROM image_tag_names x CROSS JOIN accounts a CROSS JOIN a2_config c
WHERE lower(a.email) = 'scale@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

UPDATE notes n SET category_id = c.id,
  updated_at = GREATEST(n.updated_at, n.created_at + interval '1 hour')
FROM a2_image_note_map m JOIN a2_image_fixtures f ON f.fixture_key = m.fixture_key
JOIN accounts a ON lower(a.email) = 'scale@lifelab.local'
JOIN categories c ON c.account_id = a.id AND c.normalized_name = lower(btrim(f.category_name))
WHERE n.id = m.note_id AND n.account_id = a.id;

UPDATE tasks t SET category_id = c.id,
  updated_at = GREATEST(t.updated_at, t.created_at + interval '1 hour')
FROM a2_image_task_map m JOIN a2_image_fixtures f ON f.fixture_key = m.fixture_key
JOIN accounts a ON lower(a.email) = 'scale@lifelab.local'
JOIN categories c ON c.account_id = a.id AND c.normalized_name = lower(btrim(f.category_name))
WHERE t.id = m.task_id AND t.account_id = a.id;

INSERT INTO note_tags (note_id, tag_id)
SELECT m.note_id, tag.id
FROM a2_image_note_map m JOIN a2_image_fixtures f ON f.fixture_key = m.fixture_key
CROSS JOIN LATERAL jsonb_array_elements_text(f.tags_json::jsonb) x(tag_name)
JOIN accounts a ON lower(a.email) = 'scale@lifelab.local'
JOIN tags tag ON tag.account_id = a.id AND tag.normalized_name = lower(btrim(x.tag_name))
ON CONFLICT (note_id, tag_id) DO NOTHING;

INSERT INTO task_tags (task_id, tag_id)
SELECT m.task_id, tag.id
FROM a2_image_task_map m JOIN a2_image_fixtures f ON f.fixture_key = m.fixture_key
CROSS JOIN LATERAL jsonb_array_elements_text(f.tags_json::jsonb) x(tag_name)
JOIN accounts a ON lower(a.email) = 'scale@lifelab.local'
JOIN tags tag ON tag.account_id = a.id AND tag.normalized_name = lower(btrim(x.tag_name))
ON CONFLICT (task_id, tag_id) DO NOTHING;

DO $$
DECLARE aid BIGINT;
BEGIN
  SELECT id INTO STRICT aid FROM accounts WHERE lower(email) = 'scale@lifelab.local';
  IF (SELECT count(*) FROM categories WHERE account_id = aid) <> 6 THEN RAISE EXCEPTION 'A2 Category count mismatch: expected 6'; END IF;
  IF (SELECT count(*) FROM tags WHERE account_id = aid) <> 47 THEN RAISE EXCEPTION 'A2 Tag count mismatch: expected 47'; END IF;
  IF EXISTS (
    SELECT 1 FROM a2_image_note_map m JOIN a2_image_fixtures f ON f.fixture_key=m.fixture_key
    JOIN notes n ON n.id=m.note_id LEFT JOIN categories c ON c.id=n.category_id AND c.account_id=aid
    WHERE c.id IS NULL OR c.normalized_name <> lower(btrim(f.category_name))
  ) THEN RAISE EXCEPTION 'A2 Image Note Category validation failed'; END IF;
  IF EXISTS (
    SELECT 1 FROM a2_image_task_map m JOIN a2_image_fixtures f ON f.fixture_key=m.fixture_key
    JOIN tasks t ON t.id=m.task_id LEFT JOIN categories c ON c.id=t.category_id AND c.account_id=aid
    WHERE c.id IS NULL OR c.normalized_name <> lower(btrim(f.category_name))
  ) THEN RAISE EXCEPTION 'A2 Image Task Category validation failed'; END IF;
  IF (SELECT count(*) FROM note_tags x JOIN a2_image_note_map m ON m.note_id=x.note_id) <> 41 THEN RAISE EXCEPTION 'A2 Image Note Tag-link count mismatch: expected 41'; END IF;
  IF (SELECT count(*) FROM task_tags x JOIN a2_image_task_map m ON m.task_id=x.task_id) <> 27 THEN RAISE EXCEPTION 'A2 Image Task Tag-link count mismatch: expected 27'; END IF;
  IF EXISTS (
    SELECT 1 FROM a2_image_note_map m JOIN a2_image_fixtures f ON f.fixture_key=m.fixture_key
    JOIN note_tags nt ON nt.note_id=m.note_id JOIN tags tag ON tag.id=nt.tag_id
    WHERE tag.account_id <> aid OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(f.tags_json::jsonb) x(tag_name)
      WHERE tag.normalized_name=lower(btrim(x.tag_name))
    )
  ) THEN RAISE EXCEPTION 'A2 Image Note has a non-fixture Tag'; END IF;
  IF EXISTS (
    SELECT 1 FROM a2_image_task_map m JOIN a2_image_fixtures f ON f.fixture_key=m.fixture_key
    JOIN task_tags tt ON tt.task_id=m.task_id JOIN tags tag ON tag.id=tt.tag_id
    WHERE tag.account_id <> aid OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(f.tags_json::jsonb) x(tag_name)
      WHERE tag.normalized_name=lower(btrim(x.tag_name))
    )
  ) THEN RAISE EXCEPTION 'A2 Image Task has a non-fixture Tag'; END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A2 V2 Audio Organization
-- ---------------------------------------------------------------------------

-- Audio fixtures introduce four additional account-scoped Categories.
INSERT INTO categories (
    account_id,
    name,
    normalized_name,
    created_at,
    updated_at
)
SELECT
    account.id,
    fixture.category_name,
    lower(btrim(fixture.category_name)),
    config.reference_instant - interval '18 days',
    config.reference_instant - interval '18 days'
FROM (
    SELECT DISTINCT category_name
    FROM a2_audio_fixtures
) fixture
CROSS JOIN accounts account
CROSS JOIN a2_config config
WHERE lower(account.email) = 'scale@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

-- Audio fixture Tags are all new relative to the existing A2 taxonomy,
-- but still use normalized-name conflict handling for idempotence.
WITH audio_tag_names AS (
    SELECT DISTINCT
        btrim(fixture_tag.tag_name) AS tag_name
    FROM a2_audio_fixtures fixture
    CROSS JOIN LATERAL
        jsonb_array_elements_text(
            fixture.tags_json::jsonb
        ) fixture_tag(tag_name)
)
INSERT INTO tags (
    account_id,
    name,
    normalized_name,
    created_at,
    updated_at
)
SELECT
    account.id,
    audio_tag.tag_name,
    lower(audio_tag.tag_name),
    config.reference_instant - interval '18 days',
    config.reference_instant - interval '18 days'
FROM audio_tag_names audio_tag
CROSS JOIN accounts account
CROSS JOIN a2_config config
WHERE lower(account.email) = 'scale@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

-- Every Audio Note inherits the Category from its fixture.
UPDATE notes note
SET
    category_id = category.id,
    updated_at = GREATEST(
        note.updated_at,
        note.created_at + interval '1 hour'
    )
FROM a2_audio_note_map note_map
JOIN a2_audio_fixtures fixture
  ON fixture.fixture_key = note_map.fixture_key
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN categories category
  ON category.account_id = account.id
 AND category.normalized_name =
        lower(btrim(fixture.category_name))
WHERE note.id = note_map.note_id
  AND note.account_id = account.id;

-- Every linked Audio Task inherits the same fixture Category.
UPDATE tasks task
SET
    category_id = category.id,
    updated_at = GREATEST(
        task.updated_at,
        task.created_at + interval '1 hour'
    )
FROM a2_audio_task_map task_map
JOIN a2_audio_fixtures fixture
  ON fixture.fixture_key = task_map.fixture_key
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN categories category
  ON category.account_id = account.id
 AND category.normalized_name =
        lower(btrim(fixture.category_name))
WHERE task.id = task_map.task_id
  AND task.account_id = account.id;

-- Attach fixture Tags to all Audio Notes.
INSERT INTO note_tags (
    note_id,
    tag_id
)
SELECT
    note_map.note_id,
    tag.id
FROM a2_audio_note_map note_map
JOIN a2_audio_fixtures fixture
  ON fixture.fixture_key = note_map.fixture_key
CROSS JOIN LATERAL
    jsonb_array_elements_text(
        fixture.tags_json::jsonb
    ) fixture_tag(tag_name)
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN tags tag
  ON tag.account_id = account.id
 AND tag.normalized_name =
        lower(btrim(fixture_tag.tag_name))
ON CONFLICT (note_id, tag_id) DO NOTHING;

-- Linked Audio Tasks inherit the same fixture Tags.
INSERT INTO task_tags (
    task_id,
    tag_id
)
SELECT
    task_map.task_id,
    tag.id
FROM a2_audio_task_map task_map
JOIN a2_audio_fixtures fixture
  ON fixture.fixture_key = task_map.fixture_key
CROSS JOIN LATERAL
    jsonb_array_elements_text(
        fixture.tags_json::jsonb
    ) fixture_tag(tag_name)
JOIN accounts account
  ON lower(account.email) = 'scale@lifelab.local'
JOIN tags tag
  ON tag.account_id = account.id
 AND tag.normalized_name =
        lower(btrim(fixture_tag.tag_name))
ON CONFLICT (task_id, tag_id) DO NOTHING;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'scale@lifelab.local';

    -- 6 Image Categories + 4 Audio Categories.
    IF (
        SELECT count(*)
        FROM categories
        WHERE account_id = account_id_value
    ) <> 10 THEN
        RAISE EXCEPTION
            'A2 Category count mismatch after Audio: expected 10';
    END IF;

    -- 47 Tags after Image organization + 8 Audio Tags.
    IF (
        SELECT count(*)
        FROM tags
        WHERE account_id = account_id_value
    ) <> 55 THEN
        RAISE EXCEPTION
            'A2 Tag count mismatch after Audio: expected 55';
    END IF;

    -- All four Audio Category names must resolve exactly once.
    IF (
        SELECT count(*)
        FROM categories
        WHERE account_id = account_id_value
          AND normalized_name IN (
              SELECT DISTINCT lower(btrim(category_name))
              FROM a2_audio_fixtures
          )
    ) <> 4 THEN
        RAISE EXCEPTION
            'A2 Audio Category resolution failed';
    END IF;

    -- All eight Audio Tag names must resolve exactly once.
    IF (
        SELECT count(*)
        FROM tags
        WHERE account_id = account_id_value
          AND normalized_name IN (
              SELECT DISTINCT
                  lower(btrim(fixture_tag.tag_name))
              FROM a2_audio_fixtures fixture
              CROSS JOIN LATERAL
                  jsonb_array_elements_text(
                      fixture.tags_json::jsonb
                  ) fixture_tag(tag_name)
          )
    ) <> 8 THEN
        RAISE EXCEPTION
            'A2 Audio Tag resolution failed';
    END IF;

    -- Every Audio Note must have exactly its fixture Category.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN notes note
          ON note.id = map.note_id
        LEFT JOIN categories category
          ON category.id = note.category_id
         AND category.account_id = account_id_value
        WHERE category.id IS NULL
           OR category.normalized_name
                <> lower(btrim(fixture.category_name))
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note Category validation failed';
    END IF;

    -- Every linked Audio Task must have exactly its fixture Category.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN tasks task
          ON task.id = map.task_id
        LEFT JOIN categories category
          ON category.id = task.category_id
         AND category.account_id = account_id_value
        WHERE category.id IS NULL
           OR category.normalized_name
                <> lower(btrim(fixture.category_name))
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task Category validation failed';
    END IF;

    IF (
        SELECT count(*)
        FROM note_tags note_tag
        JOIN a2_audio_note_map map
          ON map.note_id = note_tag.note_id
    ) <> 16 THEN
        RAISE EXCEPTION
            'A2 Audio Note Tag-link count mismatch: expected 16';
    END IF;

    IF (
        SELECT count(*)
        FROM task_tags task_tag
        JOIN a2_audio_task_map map
          ON map.task_id = task_tag.task_id
    ) <> 10 THEN
        RAISE EXCEPTION
            'A2 Audio Task Tag-link count mismatch: expected 10';
    END IF;

    -- Each Audio Note must contain every fixture Tag.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                fixture.tags_json::jsonb
            ) fixture_tag(tag_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM note_tags note_tag
            JOIN tags tag
              ON tag.id = note_tag.tag_id
            WHERE note_tag.note_id = map.note_id
              AND tag.account_id = account_id_value
              AND tag.normalized_name =
                    lower(btrim(fixture_tag.tag_name))
        )
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note is missing a fixture Tag';
    END IF;

    -- Audio Notes may not receive Tags outside their fixture.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_note_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN note_tags note_tag
          ON note_tag.note_id = map.note_id
        JOIN tags tag
          ON tag.id = note_tag.tag_id
        WHERE tag.account_id <> account_id_value
           OR NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(
                    fixture.tags_json::jsonb
                ) fixture_tag(tag_name)
                WHERE lower(btrim(fixture_tag.tag_name))
                    = tag.normalized_name
           )
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Note has a non-fixture Tag';
    END IF;

    -- Each linked Audio Task must contain every fixture Tag.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                fixture.tags_json::jsonb
            ) fixture_tag(tag_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM task_tags task_tag
            JOIN tags tag
              ON tag.id = task_tag.tag_id
            WHERE task_tag.task_id = map.task_id
              AND tag.account_id = account_id_value
              AND tag.normalized_name =
                    lower(btrim(fixture_tag.tag_name))
        )
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task is missing a fixture Tag';
    END IF;

    -- Audio Tasks may not receive Tags outside their fixture.
    IF EXISTS (
        SELECT 1
        FROM a2_audio_task_map map
        JOIN a2_audio_fixtures fixture
          ON fixture.fixture_key = map.fixture_key
        JOIN task_tags task_tag
          ON task_tag.task_id = map.task_id
        JOIN tags tag
          ON tag.id = task_tag.tag_id
        WHERE tag.account_id <> account_id_value
           OR NOT EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(
                    fixture.tags_json::jsonb
                ) fixture_tag(tag_name)
                WHERE lower(btrim(fixture_tag.tag_name))
                    = tag.normalized_name
           )
    ) THEN
        RAISE EXCEPTION
            'A2 Audio Task has a non-fixture Tag';
    END IF;
END
$$;

-- Final lifecycle removes all historical Library rows; Notes and linked Tasks survive.
DELETE FROM library_videos l USING a2_library_map m,a2_snapshot_sources s
WHERE l.id=m.library_video_id AND m.fixture_key=s.fixture_key AND s.role='HISTORICAL';

COMMIT;
