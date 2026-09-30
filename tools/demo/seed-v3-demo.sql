BEGIN;

SELECT pg_advisory_xact_lock(hashtext('life-lab-scale-demo'));

CREATE TEMP TABLE demo_config ON COMMIT DROP AS
SELECT :'reference_date'::date AS reference_date,
       (:'reference_date'::date::timestamp + time '12:00')
           AT TIME ZONE 'Asia/Ho_Chi_Minh' AS reference_instant,
       :'note_count'::integer AS note_count,
       :'task_count'::integer AS task_count;

DO $$ BEGIN
    IF (SELECT note_count <> 1500 OR task_count <> 1500 FROM demo_config) THEN
        RAISE EXCEPTION 'V3 Demo requires exactly 1,500 Notes and 1,500 Tasks';
    END IF;
    IF EXISTS (
        SELECT 1 FROM accounts account WHERE lower(account.email) = 'scale-demo@lifelab.local'
        AND (EXISTS (SELECT 1 FROM notes WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM tasks WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM library_videos WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM library_images WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM library_audio WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM tags WHERE account_id = account.id)
          OR EXISTS (SELECT 1 FROM categories WHERE account_id = account.id))
    ) THEN RAISE EXCEPTION 'Demo account is not empty. Run Reset-Demo first.'; END IF;
    IF (SELECT count(*) FROM demo_image_fixtures) <> 16
       OR (SELECT count(*) FROM demo_audio_fixtures) <> 9
       OR (SELECT count(*) FROM demo_story_fixtures) <> 12 THEN
        RAISE EXCEPTION 'V3 Demo manifest composition is incomplete';
    END IF;
    IF (SELECT count(*) FROM library_images li JOIN accounts a ON a.id = li.account_id
        WHERE lower(a.email) = 'demo@lifelab.local') <> 14
       OR (SELECT count(*) FROM library_images li JOIN accounts a ON a.id = li.account_id
        WHERE lower(a.email) = 'scale@lifelab.local') <> 20
       OR (SELECT count(*) FROM library_audio la JOIN accounts a ON a.id = la.account_id
        WHERE lower(a.email) = 'demo@lifelab.local') <> 13
       OR (SELECT count(*) FROM library_audio la JOIN accounts a ON a.id = la.account_id
        WHERE lower(a.email) = 'scale@lifelab.local') <> 8 THEN
        RAISE EXCEPTION 'A1/A2 media baseline composition differs from the approved fixture';
    END IF;
END $$;

INSERT INTO accounts (email, password_hash, display_name, created_at, updated_at)
SELECT 'scale-demo@lifelab.local', :'password_hash', 'Life Lab Demo',
       reference_instant - interval '60 days', reference_instant - interval '60 days'
FROM demo_config
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

CREATE TEMP TABLE demo_account ON COMMIT DROP AS
SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local';

-- The only global rows this fixture may introduce are the listed external
-- media. Reusing an existing identical URL preserves its global identity.
INSERT INTO image_sources (origin, external_url, created_at)
SELECT 'EXTERNAL', fixture.url, config.reference_instant - interval '40 days'
FROM demo_image_fixtures fixture CROSS JOIN demo_config config
WHERE NOT EXISTS (SELECT 1 FROM image_sources source WHERE source.external_url = fixture.url);

INSERT INTO audio_sources (origin, external_url, created_at)
SELECT 'EXTERNAL', fixture.url, config.reference_instant - interval '40 days'
FROM demo_audio_fixtures fixture CROSS JOIN demo_config config
WHERE NOT EXISTS (SELECT 1 FROM audio_sources source WHERE source.external_url = fixture.url);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM demo_image_fixtures fixture JOIN image_sources source
               ON source.external_url = fixture.url WHERE source.origin <> 'EXTERNAL')
       OR EXISTS (SELECT 1 FROM demo_audio_fixtures fixture JOIN audio_sources source
               ON source.external_url = fixture.url WHERE source.origin <> 'EXTERNAL') THEN
        RAISE EXCEPTION 'Demo external URL conflicts with an existing Source identity';
    END IF;
END $$;

CREATE TEMP TABLE demo_video_pool ON COMMIT DROP AS
WITH candidates AS (
    SELECT DISTINCT source.id, source.youtube_video_id, source.title,
           source.duration_seconds,
           GREATEST(source.created_at, coalesce(source.published_at, source.created_at)) AS ready_at
    FROM youtube_videos source
    JOIN library_videos library ON library.youtube_source_id = source.id
    JOIN accounts owner ON owner.id = library.account_id
    CROSS JOIN demo_config config
    WHERE lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
      AND source.availability_status = 'AVAILABLE'
      AND source.duration_seconds > 0
      AND source.created_at <= config.reference_instant - interval '10 days'
), with_note AS (
    SELECT candidate.*, note.content AS base_note,
           note.timestamp_seconds AS base_timestamp
    FROM candidates candidate
    JOIN LATERAL (
        SELECT n.content, n.timestamp_seconds FROM notes n
        JOIN accounts owner ON owner.id = n.account_id
        WHERE n.youtube_source_id = candidate.id
          AND lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
          AND n.timestamp_seconds IS NOT NULL
          AND n.timestamp_seconds < candidate.duration_seconds
        ORDER BY lower(owner.email), n.created_at, n.content LIMIT 1
    ) note ON true
)
SELECT row_number() OVER (ORDER BY youtube_video_id)::integer AS ordinal,
       id AS source_id, youtube_video_id AS source_key, title, duration_seconds,
       ready_at, base_note, base_timestamp
FROM with_note;

-- A1 upload keys and A2 external URLs are selected from their actual owned
-- memberships, never reconstructed as new Source rows.
CREATE TEMP TABLE demo_existing_images ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY source.origin, coalesce(source.storage_key, source.external_url))::integer AS ordinal,
       source.id AS source_id, coalesce(source.storage_key, source.external_url) AS source_key,
       source.origin, coalesce(library.title, source.original_filename,
           regexp_replace(source.external_url, '^.*/', '')) AS title,
       coalesce(library.personal_description, note.content) AS description,
       source.created_at AS ready_at, note.content AS base_note
FROM image_sources source
JOIN LATERAL (
    SELECT li.title, li.personal_description FROM library_images li
    JOIN accounts owner ON owner.id = li.account_id
    WHERE li.image_source_id = source.id
      AND lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
    ORDER BY lower(owner.email), li.id LIMIT 1
) library ON true
JOIN LATERAL (
    SELECT n.content FROM notes n JOIN accounts owner ON owner.id = n.account_id
    WHERE n.image_source_id = source.id
      AND lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
    ORDER BY lower(owner.email), n.created_at, n.content LIMIT 1
) note ON true;

CREATE TEMP TABLE demo_existing_audio ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY source.origin, coalesce(source.storage_key, source.external_url))::integer AS ordinal,
       source.id AS source_id, coalesce(source.storage_key, source.external_url) AS source_key,
       source.origin, coalesce(library.title, source.original_filename,
           regexp_replace(source.external_url, '^.*/', '')) AS title,
       coalesce(library.personal_description, note.content) AS description,
       source.created_at AS ready_at, note.content AS base_note,
       note.timestamp_seconds AS base_timestamp
FROM audio_sources source
JOIN LATERAL (
    SELECT la.title, la.personal_description FROM library_audio la
    JOIN accounts owner ON owner.id = la.account_id
    WHERE la.audio_source_id = source.id
      AND lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
    ORDER BY lower(owner.email), la.id LIMIT 1
) library ON true
JOIN LATERAL (
    SELECT n.content, n.timestamp_seconds FROM notes n
    JOIN accounts owner ON owner.id = n.account_id
    WHERE n.audio_source_id = source.id
      AND lower(owner.email) IN ('demo@lifelab.local', 'scale@lifelab.local')
    ORDER BY lower(owner.email), n.created_at, n.content LIMIT 1
) note ON true;

DO $$ BEGIN
    IF (SELECT count(*) FROM demo_video_pool) <> 100
       OR (SELECT count(*) FROM demo_existing_images) <> 34
       OR (SELECT count(*) FROM demo_existing_audio) <> 21 THEN
        RAISE EXCEPTION 'A1/A2 Source pool changed: expected 100 Video, 34 Image and 21 Audio Sources';
    END IF;
    IF EXISTS (SELECT 1 FROM demo_existing_images WHERE base_note IS NULL)
       OR EXISTS (SELECT 1 FROM demo_existing_audio WHERE base_note IS NULL) THEN
        RAISE EXCEPTION 'Existing media lacks source-backed Note evidence';
    END IF;
END $$;

CREATE TEMP TABLE demo_theme_rules (priority integer, pattern text, category_name text,
    tag_names text[]) ON COMMIT DROP;
INSERT INTO demo_theme_rules VALUES
 (1, 'english|tiếng anh|ielts|vocab|phát âm|pronunciation|ipa|grammar|tenses|writing', 'English', ARRAY['English Practice','Study']),
 (2, 'postgres|database|mysql|sql|erd|normaliz|sequelize|mongo|khóa chính|khóa ngoại', 'Data Systems', ARRAY['Database','Programming']),
 (3, 'research|regression|statistics|philosophy|heart|helicopter|dinh doc lap|scatter|bar chart', 'Research', ARRAY['Research','Study']),
 (4, 'architecture|mvc|testing|uml|client.server|gtk|cloud|docker|http.anfrage', 'Software Design', ARRAY['Architecture','Programming']),
 (5, 'algorithm|thuật toán|c\+\+|cấu trúc dữ liệu|ngăn xếp|hàng đợi|quicksort|sort|linked list|scheduling|topolog|network', 'Computer Science', ARRAY['Algorithms','Study']),
 (6, 'project|life lab|git|gantt|kanban|scrum|deploy|presentation', 'Projects', ARRAY['Project','Planning']),
 (7, 'communication|leadership|management|career|interview|cv|giao tiếp|thuyết trình', 'Communication', ARRAY['Communication','Learning']),
 (8, 'time|pomodoro|planning|eisenhower|productivity|procrastination|motivation', 'Productivity', ARRAY['Productivity','Planning']),
 (9, 'software|program|java|react|spring|javascript|typescript|http|api|frontend|backend', 'Programming', ARRAY['Programming','Technology']);

CREATE TEMP TABLE demo_media_pool (
    source_type text NOT NULL, source_key text NOT NULL, source_id bigint NOT NULL,
    ordinal integer NOT NULL, origin text NOT NULL, title text NOT NULL,
    description text, category_name text NOT NULL, tag_names text[] NOT NULL,
    base_note text NOT NULL, base_timestamp integer, ready_at timestamptz NOT NULL,
    PRIMARY KEY (source_type, source_key)
) ON COMMIT DROP;

INSERT INTO demo_media_pool
SELECT 'YOUTUBE', video.source_key, video.source_id, video.ordinal, 'YOUTUBE',
       video.title, video.base_note,
       coalesce(rule.category_name, 'Personal Development'),
       ARRAY(SELECT DISTINCT tag FROM unnest(
           coalesce(rule.tag_names, ARRAY['Learning','Study']) ||
           ARRAY_REMOVE(ARRAY[
             CASE WHEN video.title ~* 'spring' THEN 'Spring Boot' END,
             CASE WHEN video.title ~* 'react' THEN 'React' END,
             CASE WHEN video.title ~* 'java' THEN 'Java' END,
             CASE WHEN video.title ~* 'typescript' THEN 'TypeScript' END,
             CASE WHEN video.title ~* 'api|http' THEN 'API' END,
             CASE WHEN video.title ~* 'postgres' THEN 'PostgreSQL' END,
             CASE WHEN video.title ~* 'test' THEN 'Testing' END,
             CASE WHEN video.title ~* 'git' THEN 'Git' END,
             CASE WHEN video.title ~* 'docker' THEN 'Docker' END,
             CASE WHEN video.title ~* 'security' THEN 'Security' END
           ]::text[], NULL)) tag LIMIT 4),
       video.base_note, video.base_timestamp, video.ready_at
FROM demo_video_pool video
LEFT JOIN LATERAL (SELECT category_name, tag_names FROM demo_theme_rules
                   WHERE video.title ~* pattern ORDER BY priority LIMIT 1) rule ON true;

INSERT INTO demo_media_pool
SELECT 'IMAGE', image.source_key, image.source_id, image.ordinal, image.origin,
       image.title, image.description,
       coalesce(rule.category_name, 'Personal Development'),
       ARRAY(SELECT DISTINCT tag FROM unnest(
           coalesce(rule.tag_names, ARRAY['Learning','Study']) ||
           ARRAY_REMOVE(ARRAY[
             CASE WHEN image.title ~* 'postgres' THEN 'PostgreSQL' END,
             CASE WHEN image.title ~* 'english|ielts' THEN 'English Practice' END,
             CASE WHEN image.title ~* 'life lab|project' THEN 'Project' END,
             CASE WHEN image.title ~* 'architecture|erd|model' THEN 'Architecture' END,
             CASE WHEN image.title ~* 'network' THEN 'Networking' END,
             CASE WHEN image.title ~* 'priority' THEN 'Planning' END
           ]::text[], NULL)) tag LIMIT 4),
       image.base_note, NULL, image.ready_at
FROM demo_existing_images image
LEFT JOIN LATERAL (SELECT category_name, tag_names FROM demo_theme_rules
                   WHERE image.title ~* pattern ORDER BY priority LIMIT 1) rule ON true;

INSERT INTO demo_media_pool
SELECT 'AUDIO', audio.source_key, audio.source_id, audio.ordinal, audio.origin,
       audio.title, audio.description,
       coalesce(rule.category_name, 'Personal Development'),
       ARRAY(SELECT DISTINCT tag FROM unnest(
           coalesce(rule.tag_names, ARRAY['Learning','Study']) ||
           ARRAY_REMOVE(ARRAY[
             'Listening',
             CASE WHEN audio.title ~* 'english|listening|speaking' THEN 'English Practice' END,
             CASE WHEN audio.title ~* 'technology|internet|software' THEN 'Technology' END,
             CASE WHEN audio.title ~* 'career' THEN 'Career' END,
             CASE WHEN audio.title ~* 'time' THEN 'Time Management' END,
             CASE WHEN audio.title ~* 'stress|motivation' THEN 'Reflection' END
           ]::text[], NULL)) tag LIMIT 4),
       audio.base_note, audio.base_timestamp, audio.ready_at
FROM demo_existing_audio audio
LEFT JOIN LATERAL (SELECT category_name, tag_names FROM demo_theme_rules
                   WHERE audio.title ~* pattern ORDER BY priority LIMIT 1) rule ON true;

INSERT INTO demo_media_pool
SELECT 'IMAGE', fixture.url, source.id, 34 + fixture.ordinal, 'EXTERNAL',
       fixture.title, fixture.description, fixture.category_name,
       fixture.tag_names, fixture.note, NULL, source.created_at
FROM demo_image_fixtures fixture JOIN image_sources source ON source.external_url = fixture.url;

INSERT INTO demo_media_pool
SELECT 'AUDIO', fixture.url, source.id, 21 + fixture.ordinal, 'EXTERNAL',
       fixture.title, fixture.description, fixture.category_name,
       fixture.tag_names, fixture.note, NULL, source.created_at
FROM demo_audio_fixtures fixture JOIN audio_sources source ON source.external_url = fixture.url;

DO $$ BEGIN
    IF (SELECT count(*) FROM demo_media_pool WHERE source_type = 'YOUTUBE') <> 100
       OR (SELECT count(*) FROM demo_media_pool WHERE source_type = 'IMAGE') <> 50
       OR (SELECT count(*) FROM demo_media_pool WHERE source_type = 'AUDIO') <> 30 THEN
        RAISE EXCEPTION 'Demo media pool composition failed';
    END IF;
END $$;

CREATE TEMP TABLE demo_category_names ON COMMIT DROP AS
SELECT name, ordinal::integer FROM unnest(ARRAY[
    'Computer Science', 'Programming', 'Research', 'English', 'Projects',
    'Personal Development', 'Data Systems', 'Software Design',
    'Communication', 'Productivity'
]) WITH ORDINALITY AS item(name, ordinal);

CREATE TEMP TABLE demo_tag_names ON COMMIT DROP AS
SELECT name, ordinal::integer FROM unnest(ARRAY[
    'Java', 'Spring Boot', 'React', 'TypeScript', 'Frontend', 'Backend', 'API',
    'Database', 'PostgreSQL', 'Algorithms', 'Testing', 'Architecture',
    'Security', 'Debugging', 'Study', 'Review', 'Important', 'Exam',
    'Assignment', 'Research', 'Project', 'Presentation', 'Documentation',
    'Listening', 'Vocabulary', 'Speaking', 'Grammar', 'Reading',
    'English Practice', 'Writing', 'Productivity', 'Time Management',
    'Planning', 'Career', 'Learning', 'Reflection', 'Git', 'HTTP',
    'Data Visualization', 'Statistics', 'Software Design', 'Networking',
    'Operating Systems', 'Docker', 'Cloud', 'Workflow', 'Leadership',
    'Privacy', 'Technology', 'Motivation', 'Communication', 'Habits',
    'UI', 'UX', 'SQL', 'Design', 'Programming', 'Practice', 'Deployment'
]) WITH ORDINALITY AS item(name, ordinal);

-- Retain 56 useful labels; avoid near-duplicates with Category and unused
-- broad labels while covering the actual curated assignments.
DELETE FROM demo_tag_names WHERE name IN ('Design', 'Software Design', 'SQL');

DO $$ BEGIN
    IF (SELECT count(*) FROM demo_tag_names) <> 56
       OR EXISTS (SELECT 1 FROM demo_tag_names GROUP BY lower(name) HAVING count(*) > 1)
       OR EXISTS (SELECT 1 FROM demo_media_pool media
                  CROSS JOIN LATERAL unnest(media.tag_names) AS label(name)
                  WHERE NOT EXISTS (SELECT 1 FROM demo_tag_names WHERE name = label.name))
       OR EXISTS (SELECT 1 FROM demo_story_fixtures story
                  CROSS JOIN LATERAL unnest(story.tag_names) AS label(name)
                  WHERE NOT EXISTS (SELECT 1 FROM demo_tag_names WHERE name = label.name)) THEN
        RAISE EXCEPTION 'Demo Tag catalog does not cover the curated media/stories';
    END IF;
END $$;

INSERT INTO categories (account_id, name, normalized_name, created_at, updated_at)
SELECT account.id, names.name, lower(names.name),
       config.reference_instant - interval '35 days',
       config.reference_instant - interval '35 days'
FROM demo_category_names names CROSS JOIN demo_account account CROSS JOIN demo_config config;

INSERT INTO tags (account_id, name, normalized_name, created_at, updated_at)
SELECT account.id, names.name, lower(names.name),
       config.reference_instant - interval '35 days',
       config.reference_instant - interval '35 days'
FROM demo_tag_names names CROSS JOIN demo_account account CROSS JOIN demo_config config;

CREATE TEMP TABLE demo_category_map ON COMMIT DROP AS
SELECT category.name, category.id FROM categories category JOIN demo_account account
    ON account.id = category.account_id;
CREATE TEMP TABLE demo_tag_map ON COMMIT DROP AS
SELECT tag.name, tag.id FROM tags tag JOIN demo_account account
    ON account.id = tag.account_id;

INSERT INTO library_videos (account_id, youtube_source_id, custom_title,
                            personal_description, added_at, updated_at)
SELECT account.id, media.source_id,
       CASE WHEN mod(media.ordinal, 4) IN (0, 1) THEN left(split_part(media.title, '|', 1), 255) END,
       CASE WHEN mod(media.ordinal, 4) <> 1 THEN media.description END,
       GREATEST(config.reference_instant - interval '30 days', media.ready_at + interval '1 hour'),
       GREATEST(config.reference_instant - interval '30 days', media.ready_at + interval '1 hour')
FROM demo_media_pool media CROSS JOIN demo_account account CROSS JOIN demo_config config
WHERE media.source_type = 'YOUTUBE';

INSERT INTO library_images (account_id, image_source_id, title, personal_description, added_at)
SELECT account.id, media.source_id,
       CASE WHEN media.source_key = 'a1-image-05.png'
            THEN 'Đồ án Life Lab — Database ERD'
            WHEN mod(media.ordinal, 4) IN (0, 1) THEN left(media.title, 255) END,
       CASE WHEN media.source_key = 'a1-image-05.png'
            THEN 'Đối chiếu ERD này với schema hiện tại trước khi chuẩn bị báo cáo đồ án.'
            WHEN mod(media.ordinal, 4) <> 1 THEN media.description END,
       GREATEST(config.reference_instant - interval '30 days', media.ready_at + interval '1 hour')
FROM demo_media_pool media CROSS JOIN demo_account account CROSS JOIN demo_config config
WHERE media.source_type = 'IMAGE';

INSERT INTO library_audio (account_id, audio_source_id, title, personal_description, added_at)
SELECT account.id, media.source_id,
       CASE WHEN mod(media.ordinal, 4) IN (0, 1) THEN left(media.title, 255) END,
       CASE WHEN mod(media.ordinal, 4) <> 1 THEN media.description END,
       GREATEST(config.reference_instant - interval '30 days', media.ready_at + interval '1 hour')
FROM demo_media_pool media CROSS JOIN demo_account account CROSS JOIN demo_config config
WHERE media.source_type = 'AUDIO';

INSERT INTO library_video_tags (library_video_id, tag_id)
SELECT library.id, tag.id
FROM demo_media_pool media
JOIN library_videos library ON library.youtube_source_id = media.source_id
JOIN demo_account account ON account.id = library.account_id
CROSS JOIN LATERAL unnest(media.tag_names) AS label(name)
JOIN demo_tag_map tag ON tag.name = label.name
WHERE media.source_type = 'YOUTUBE' AND mod(media.ordinal, 9) <> 0;

INSERT INTO library_image_tags (library_image_id, tag_id)
SELECT library.id, tag.id
FROM demo_media_pool media
JOIN library_images library ON library.image_source_id = media.source_id
JOIN demo_account account ON account.id = library.account_id
CROSS JOIN LATERAL unnest(media.tag_names) AS label(name)
JOIN demo_tag_map tag ON tag.name = label.name
WHERE media.source_type = 'IMAGE' AND mod(media.ordinal, 9) <> 0;

INSERT INTO library_audio_tags (library_audio_id, tag_id)
SELECT library.id, tag.id
FROM demo_media_pool media
JOIN library_audio library ON library.audio_source_id = media.source_id
JOIN demo_account account ON account.id = library.account_id
CROSS JOIN LATERAL unnest(media.tag_names) AS label(name)
JOIN demo_tag_map tag ON tag.name = label.name
WHERE media.source_type = 'AUDIO' AND mod(media.ordinal, 9) <> 0;

-- Closed Video-only sessions retain the established playing-time threshold.
WITH session_plan AS (
    SELECT sequence_no, CASE WHEN mod(sequence_no, 4) = 0 THEN 'INVALID' ELSE 'VALID' END AS validity_status,
           1 + mod(sequence_no - 1, 100) AS media_ordinal
    FROM generate_series(1, 1000) AS sequence_no
), timed AS (
    SELECT plan.*, library.id AS library_video_id, video.duration_seconds,
           LEAST(30, ((video.duration_seconds::bigint * 4 + 4) / 5)::integer) AS threshold,
           GREATEST(library.added_at + interval '1 day',
                    config.reference_instant - interval '24 days')
                    + plan.sequence_no * interval '10 minutes' AS started_at
    FROM session_plan plan JOIN demo_video_pool video ON video.ordinal = plan.media_ordinal
    JOIN library_videos library ON library.youtube_source_id = video.source_id
    JOIN demo_account account ON account.id = library.account_id
    CROSS JOIN demo_config config
), trusted AS (
    SELECT timed.*,
           CASE WHEN validity_status = 'VALID'
                THEN threshold + mod(sequence_no * 11,
                     GREATEST(1, LEAST(91, duration_seconds - threshold + 1)))
                ELSE GREATEST(0, threshold - 1 - mod(sequence_no * 5,
                     GREATEST(1, threshold))) END AS watch_seconds
    FROM timed
)
INSERT INTO watch_sessions (library_video_id, started_at, ended_at,
                            last_heartbeat_at, watch_time_seconds, validity_status)
SELECT library_video_id, started_at,
       started_at + (watch_seconds + 15) * interval '1 second',
       started_at + watch_seconds * interval '1 second',
       watch_seconds, validity_status FROM trusted;

CREATE TEMP TABLE demo_note_map (
    note_order integer PRIMARY KEY, note_id bigint NOT NULL UNIQUE,
    source_type text NOT NULL, source_key text NOT NULL,
    category_name text NOT NULL, tag_names text[] NOT NULL,
    curated boolean NOT NULL, story_key text UNIQUE
) ON COMMIT DROP;

DO $$
DECLARE
    config record;
    account_id bigint;
    media record;
    story record;
    media_type text;
    item_no integer;
    note_order integer := 0;
    note_id bigint;
    pool_count integer;
    remaining integer;
    created_time timestamptz;
    content_text text;
    prompts text[] := ARRAY[
        'write one concrete example before the next class.',
        'compare this point with the original source.',
        'explain the idea aloud without looking at the note.',
        'turn the observation into one practice question.',
        'record a counterexample or an important boundary.',
        'connect this point to the current project work.',
        'summarize the takeaway in a sentence of my own.',
        'check which detail still needs evidence.',
        'make a small diagram or spoken explanation.',
        'decide what to revisit in the next study session.'
    ];
BEGIN
    SELECT * INTO config FROM demo_config;
    SELECT id INTO account_id FROM demo_account;

    -- Twelve fully specified source-backed stories appear first and remain
    -- addressable by stable fixture keys, never database IDs.
    FOR story IN SELECT * FROM demo_story_fixtures ORDER BY ordinal LOOP
        SELECT * INTO STRICT media FROM demo_media_pool
        WHERE source_type = story.source_type AND source_key = story.source_identity;
        IF story.source_type = 'IMAGE' AND story.timestamp_seconds IS NOT NULL THEN
            RAISE EXCEPTION 'Image story cannot have a timestamp: %', story.story_key;
        END IF;
        note_order := note_order + 1;
        created_time := GREATEST(config.reference_instant - interval '20 days'
            + note_order * interval '3 minutes', media.ready_at + interval '2 hours');
        INSERT INTO notes (account_id, source_type, youtube_source_id,
                           image_source_id, audio_source_id, content,
                           timestamp_seconds, created_at, updated_at)
        VALUES (account_id, media.source_type,
                CASE WHEN media.source_type = 'YOUTUBE' THEN media.source_id END,
                CASE WHEN media.source_type = 'IMAGE' THEN media.source_id END,
                CASE WHEN media.source_type = 'AUDIO' THEN media.source_id END,
                story.note, story.timestamp_seconds, created_time, created_time)
        RETURNING id INTO note_id;
        INSERT INTO demo_note_map VALUES (note_order, note_id, media.source_type,
            media.source_key, story.category_name, story.tag_names, true, story.story_key);
    END LOOP;

    -- Twelve more source-specific, human-authored A1/A2/new Notes per medium
    -- bring the curated tier to 48 without inventing claims.
    FOREACH media_type IN ARRAY ARRAY['YOUTUBE','IMAGE','AUDIO'] LOOP
        FOR media IN SELECT * FROM demo_media_pool candidate
                     WHERE candidate.source_type = media_type
                       AND NOT EXISTS (SELECT 1 FROM demo_story_fixtures fixture
                                       WHERE fixture.source_type = candidate.source_type
                                         AND fixture.source_identity = candidate.source_key)
                     ORDER BY candidate.ordinal LIMIT 12 LOOP
            note_order := note_order + 1;
            created_time := GREATEST(config.reference_instant - interval '20 days'
                + note_order * interval '3 minutes', media.ready_at + interval '2 hours');
            INSERT INTO notes (account_id, source_type, youtube_source_id,
                               image_source_id, audio_source_id, content,
                               timestamp_seconds, created_at, updated_at)
            VALUES (account_id, media.source_type,
                    CASE WHEN media.source_type = 'YOUTUBE' THEN media.source_id END,
                    CASE WHEN media.source_type = 'IMAGE' THEN media.source_id END,
                    CASE WHEN media.source_type = 'AUDIO' THEN media.source_id END,
                    media.base_note, media.base_timestamp, created_time, created_time)
            RETURNING id INTO note_id;
            INSERT INTO demo_note_map VALUES (note_order, note_id, media.source_type,
                media.source_key, media.category_name, media.tag_names, true, NULL);
        END LOOP;
    END LOOP;

    -- Scale Notes retain each source's actual observation. The review prompt
    -- changes the learner's action, not the underlying media claim.
    FOREACH media_type IN ARRAY ARRAY['YOUTUBE','IMAGE','AUDIO'] LOOP
        remaining := CASE WHEN media_type = 'YOUTUBE' THEN 884 ELSE 284 END;
        SELECT count(*) INTO pool_count FROM demo_media_pool WHERE source_type = media_type;
        FOR item_no IN 1..remaining LOOP
            SELECT * INTO STRICT media FROM demo_media_pool
            WHERE source_type = media_type AND ordinal = 1 + mod(item_no - 1, pool_count);
            note_order := note_order + 1;
            content_text := format('Study log, week %s — %s. %s Next: %s',
                1 + (item_no - 1) / pool_count, media.title, media.base_note,
                prompts[1 + mod(item_no - 1, array_length(prompts, 1))]);
            created_time := GREATEST(config.reference_instant - interval '19 days'
                + note_order * interval '3 minutes', media.ready_at + interval '2 hours');
            INSERT INTO notes (account_id, source_type, youtube_source_id,
                               image_source_id, audio_source_id, content,
                               timestamp_seconds, created_at, updated_at)
            VALUES (account_id, media.source_type,
                    CASE WHEN media.source_type = 'YOUTUBE' THEN media.source_id END,
                    CASE WHEN media.source_type = 'IMAGE' THEN media.source_id END,
                    CASE WHEN media.source_type = 'AUDIO' THEN media.source_id END,
                    content_text,
                    CASE WHEN media.source_type = 'IMAGE' OR mod(item_no, 4) = 0
                         THEN NULL ELSE media.base_timestamp END,
                    created_time, created_time)
            RETURNING id INTO note_id;
            INSERT INTO demo_note_map VALUES (note_order, note_id, media.source_type,
                media.source_key, media.category_name, media.tag_names, false, NULL);
        END LOOP;
    END LOOP;
END $$;

UPDATE notes note SET category_id = category.id
FROM demo_note_map map JOIN demo_category_map category ON category.name = map.category_name
WHERE note.id = map.note_id AND (map.curated OR mod(map.note_order, 7) <> 0);

INSERT INTO note_tags (note_id, tag_id)
SELECT map.note_id, tag.id
FROM demo_note_map map
CROSS JOIN LATERAL unnest(map.tag_names) WITH ORDINALITY AS label(name, ordinal)
JOIN demo_tag_map tag ON tag.name = label.name
WHERE (map.curated OR mod(map.note_order, 6) <> 0)
  AND (map.curated OR label.ordinal <= CASE WHEN mod(map.note_order, 5) = 0 THEN 1 ELSE 2 END);

DO $$ BEGIN
    IF (SELECT count(*) FROM demo_note_map) <> 1500
       OR (SELECT count(*) FROM demo_note_map WHERE source_type = 'YOUTUBE') <> 900
       OR (SELECT count(*) FROM demo_note_map WHERE source_type = 'IMAGE') <> 300
       OR (SELECT count(*) FROM demo_note_map WHERE source_type = 'AUDIO') <> 300
       OR (SELECT count(*) FROM demo_note_map WHERE curated) <> 48 THEN
        RAISE EXCEPTION 'V3 Note composition failed';
    END IF;
END $$;

-- Story Tasks retain the exact Note link and readable date/status intent.
DO $$
DECLARE
    config record;
    account_id bigint;
    story record;
    map record;
    note_row record;
    category_id bigint;
    task_id bigint;
    deadline_date date;
BEGIN
    SELECT * INTO config FROM demo_config;
    SELECT id INTO account_id FROM demo_account;
    FOR story IN SELECT * FROM demo_story_fixtures ORDER BY ordinal LOOP
        SELECT * INTO STRICT map FROM demo_note_map WHERE story_key = story.story_key;
        SELECT * INTO STRICT note_row FROM notes WHERE id = map.note_id;
        SELECT id INTO STRICT category_id FROM demo_category_map WHERE name = story.category_name;
        deadline_date := CASE story.deadline_class
            WHEN 'TODAY' THEN config.reference_date
            WHEN 'OVERDUE' THEN config.reference_date - 2
            WHEN 'UPCOMING' THEN config.reference_date + 7
            ELSE NULL END;
        INSERT INTO tasks (account_id, source_note_id, source_status, title,
                           description, status, deadline, category_id, created_at, updated_at)
        VALUES (account_id, map.note_id, 'HAS_SOURCE', story.task_title,
                format('Follow up the exact source Note: %s', story.note),
                story.task_status, deadline_date, category_id,
                note_row.created_at + interval '1 hour',
                note_row.created_at + interval '1 hour')
        RETURNING id INTO task_id;
        INSERT INTO task_tags (task_id, tag_id)
        SELECT task_id, tag.id FROM unnest(story.tag_names) AS label(name)
        JOIN demo_tag_map tag ON tag.name = label.name;
    END LOOP;
END $$;

-- Remaining HAS_SOURCE Tasks are chosen from actual owned Notes, with a
-- balanced Video/Image/Audio mix. Every description retains the source Note's
-- specific point; no unrelated topic list is joined by ordinal.
CREATE TEMP TABLE demo_linked_tasks ON COMMIT DROP AS
WITH candidates AS (
    SELECT map.*, row_number() OVER (PARTITION BY map.source_type ORDER BY map.note_order) AS media_rank
    FROM demo_note_map map WHERE map.story_key IS NULL
), selected AS (
    SELECT candidate.*, row_number() OVER (ORDER BY candidate.note_order)::integer AS task_order
    FROM candidates candidate
    WHERE media_rank <= CASE WHEN source_type = 'YOUTUBE' THEN 536 ELSE 176 END
), plan AS (
    SELECT selected.*, note.content, note.category_id, note.created_at AS note_created_at,
           media.title AS media_title,
           CASE mod(task_order, 8)
               WHEN 0 THEN 'Practice an example from'
               WHEN 1 THEN 'Explain the main idea in'
               WHEN 2 THEN 'Compare the evidence in'
               WHEN 3 THEN 'Make a review question for'
               WHEN 4 THEN 'Check the source detail in'
               WHEN 5 THEN 'Summarize one takeaway from'
               WHEN 6 THEN 'Apply a lesson from'
               ELSE 'Record the next step for' END AS action_title,
           CASE WHEN mod(task_order, 11) = 0 THEN 'COMPLETED'
                WHEN mod(task_order, 3) = 0 THEN 'IN_PROGRESS'
                ELSE 'NOT_STARTED' END AS task_status,
           CASE mod(task_order, 5)
               WHEN 0 THEN config.reference_date - 3
               WHEN 1 THEN config.reference_date
               WHEN 2 THEN config.reference_date + 5
               WHEN 3 THEN NULL
               ELSE config.reference_date + 14 END AS task_deadline,
           config.reference_instant
    FROM selected JOIN notes note ON note.id = selected.note_id
    JOIN demo_media_pool media ON media.source_type = selected.source_type
                              AND media.source_key = selected.source_key
    CROSS JOIN demo_config config
), inserted AS (
    INSERT INTO tasks (account_id, source_note_id, source_status, title,
                       description, status, deadline, category_id, created_at, updated_at)
    SELECT account.id, plan.note_id, 'HAS_SOURCE',
           left(format('%s %s — session %s', plan.action_title,
                left(plan.media_title, 80), 1 + mod(plan.note_order, 10)), 255),
           format('Start with this Note: %s Record one result or question.', plan.content),
           plan.task_status, plan.task_deadline, plan.category_id,
           GREATEST(plan.note_created_at + interval '1 hour',
                    plan.reference_instant - interval '5 days'
                        + plan.task_order * interval '1 minute'),
           GREATEST(plan.note_created_at + interval '1 hour',
                    plan.reference_instant - interval '5 days'
                        + plan.task_order * interval '1 minute')
    FROM plan CROSS JOIN demo_account account
    ORDER BY plan.task_order
    RETURNING id, source_note_id
)
SELECT * FROM inserted;

INSERT INTO task_tags (task_id, tag_id)
SELECT task.id, link.tag_id
FROM demo_linked_tasks task JOIN note_tags link ON link.note_id = task.source_note_id;

CREATE TEMP TABLE demo_independent_templates (
    ordinal integer PRIMARY KEY, title text, description text,
    category_name text, tag_names text[]
) ON COMMIT DROP;
INSERT INTO demo_independent_templates VALUES
 (1,'Prepare the Life Lab presentation outline','Choose the three clearest source-to-action stories.','Projects',ARRAY['Project','Presentation']),
 (2,'Review the database migration notes','Check the schema changes against the current ERD.','Data Systems',ARRAY['Database','Documentation']),
 (3,'Rehearse the English demo narration','Speak the opening and source-return explanation aloud.','English',ARRAY['English Practice','Speaking']),
 (4,'Plan the next study block','Set one achievable goal and a stopping point.','Productivity',ARRAY['Planning','Time Management']),
 (5,'Revise the algorithm exercise set','Work one graph and one sorting example by hand.','Computer Science',ARRAY['Algorithms','Exam']),
 (6,'Check the React workspace flow','Walk through the note and task interactions.','Programming',ARRAY['React','Frontend']),
 (7,'Review the Spring Boot API checklist','Confirm request, response and error examples.','Programming',ARRAY['Spring Boot','API']),
 (8,'Prepare the project testing summary','List unit, integration and end-to-end evidence.','Software Design',ARRAY['Testing','Project']),
 (9,'Draft the research-method section','Separate the question, evidence and limitations.','Research',ARRAY['Research','Writing']),
 (10,'Practice interview answers','Use one concrete engineering example.','Personal Development',ARRAY['Career','Speaking']),
 (11,'Review PostgreSQL indexing examples','Explain which query each index is intended to support.','Data Systems',ARRAY['PostgreSQL','Database']),
 (12,'Polish the source-context slide','Show the exact return path without inferring a replacement.','Projects',ARRAY['Presentation','Architecture']),
 (13,'Study HTTP request boundaries','Identify the method, headers and response status.','Programming',ARRAY['HTTP','Backend']),
 (14,'Write a TypeScript practice exercise','Model a simple state transition with explicit types.','Programming',ARRAY['TypeScript','Practice']),
 (15,'Audit account-isolation examples','Check that personal Tags and metadata stay private.','Software Design',ARRAY['Security','Privacy']),
 (16,'Review the weekly learning log','Choose which topic still needs evidence.','Personal Development',ARRAY['Learning','Reflection']),
 (17,'Sketch the deployment workflow','Mark build, container and release steps.','Projects',ARRAY['Docker','Workflow']),
 (18,'Create a data-visualization caption','Name the axes and avoid overstating the result.','Research',ARRAY['Data Visualization','Statistics']),
 (19,'Prepare the team communication note','Clarify owners and next decisions.','Communication',ARRAY['Communication','Leadership']),
 (20,'Review English vocabulary cards','Use the new words in original sentences.','English',ARRAY['Vocabulary','Review']),
 (21,'Practice English listening twice','Record details missed on the first pass.','English',ARRAY['Listening','English Practice']),
 (22,'Review network topology tradeoffs','Compare a star and mesh configuration.','Computer Science',ARRAY['Networking','Architecture']),
 (23,'Check the operating-systems notes','Explain processes, threads and scheduling in one example.','Computer Science',ARRAY['Operating Systems','Study']),
 (24,'Update the project documentation index','Link the architecture and test evidence.','Projects',ARRAY['Documentation','Project']),
 (25,'Review the assignment rubric','Mark each requirement against current evidence.','Computer Science',ARRAY['Assignment','Important']),
 (26,'Debug the smallest failing case','Write a reproducible input before changing code.','Programming',ARRAY['Debugging','Testing']),
 (27,'Check cloud deployment assumptions','Separate application configuration from hosting concerns.','Software Design',ARRAY['Cloud','Deployment']),
 (28,'Review the UI explanation','Use a screenshot to explain one interaction clearly.','Communication',ARRAY['UI','UX']),
 (29,'Plan a sustainable work rhythm','Protect breaks during the next intense study week.','Productivity',ARRAY['Habits','Motivation']),
 (30,'Read the project design feedback','Identify one change worth testing rather than adding everything.','Software Design',ARRAY['UX','Reading']);

-- These few catalog labels support the independent weekly work as well.
-- The catalog has exactly 56 names; optional labels below must be present.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM demo_independent_templates template
               CROSS JOIN LATERAL unnest(template.tag_names) AS label(name)
               WHERE NOT EXISTS (SELECT 1 FROM demo_tag_map tag WHERE tag.name = label.name)) THEN
        RAISE EXCEPTION 'Independent Task template refers to an unknown Tag';
    END IF;
END $$;

INSERT INTO tasks (account_id, source_note_id, source_status, title,
                   description, status, deadline, category_id, created_at, updated_at)
SELECT account.id, NULL, 'INDEPENDENT',
       format('%s — week %s', template.title, 1 + (series.item_no - 1) / 30),
       template.description,
       CASE WHEN mod(series.item_no, 9) = 0 THEN 'COMPLETED'
            WHEN mod(series.item_no, 3) = 0 THEN 'IN_PROGRESS'
            ELSE 'NOT_STARTED' END,
       CASE mod(series.item_no, 5)
           WHEN 0 THEN config.reference_date - 2
           WHEN 1 THEN config.reference_date
           WHEN 2 THEN config.reference_date + 7
           WHEN 3 THEN NULL ELSE config.reference_date + 14 END,
       category.id,
       config.reference_instant - interval '4 days'
           + series.item_no * interval '1 minute',
       config.reference_instant - interval '4 days'
           + series.item_no * interval '1 minute'
FROM generate_series(1, 300) AS series(item_no)
JOIN demo_independent_templates template ON template.ordinal = 1 + mod(series.item_no - 1, 30)
JOIN demo_category_map category ON category.name = template.category_name
CROSS JOIN demo_account account CROSS JOIN demo_config config;

INSERT INTO task_tags (task_id, tag_id)
SELECT task.id, tag.id
FROM tasks task JOIN demo_account account ON account.id = task.account_id
JOIN demo_independent_templates template
  ON task.title LIKE template.title || ' — week %'
CROSS JOIN LATERAL unnest(template.tag_names) AS label(name)
JOIN demo_tag_map tag ON tag.name = label.name
WHERE task.source_status = 'INDEPENDENT';

-- SOURCE_MISSING is created by the same Note-deletion state transition shape:
-- a Task starts from an exact Note, is detached, and the Note is removed.
DO $$
DECLARE
    config record;
    account_id bigint;
    media record;
    media_type text;
    item_no integer;
    source_no integer;
    pool_count integer;
    note_id bigint;
    task_id bigint;
    category_id bigint;
    created_time timestamptz;
    deadline_date date;
    task_status text;
BEGIN
    SELECT * INTO config FROM demo_config;
    SELECT id INTO account_id FROM demo_account;
    FOR item_no IN 1..300 LOOP
        media_type := CASE mod(item_no - 1, 3)
            WHEN 0 THEN 'YOUTUBE' WHEN 1 THEN 'IMAGE' ELSE 'AUDIO' END;
        SELECT count(*) INTO pool_count FROM demo_media_pool WHERE source_type = media_type;
        source_no := 1 + mod((item_no - 1) / 3, pool_count);
        SELECT * INTO STRICT media FROM demo_media_pool
        WHERE source_type = media_type AND ordinal = source_no;
        SELECT id INTO STRICT category_id FROM demo_category_map WHERE name = media.category_name;
        created_time := GREATEST(config.reference_instant - interval '3 days'
            + item_no * interval '2 minutes', media.ready_at + interval '3 hours');
        INSERT INTO notes (account_id, source_type, youtube_source_id,
                           image_source_id, audio_source_id, content,
                           timestamp_seconds, created_at, updated_at)
        VALUES (account_id, media.source_type,
                CASE WHEN media.source_type = 'YOUTUBE' THEN media.source_id END,
                CASE WHEN media.source_type = 'IMAGE' THEN media.source_id END,
                CASE WHEN media.source_type = 'AUDIO' THEN media.source_id END,
                media.base_note, media.base_timestamp, created_time, created_time)
        RETURNING id INTO note_id;
        deadline_date := CASE mod(item_no, 5)
            WHEN 0 THEN config.reference_date - 2
            WHEN 1 THEN config.reference_date
            WHEN 2 THEN config.reference_date + 7
            WHEN 3 THEN NULL ELSE config.reference_date + 14 END;
        task_status := CASE WHEN mod(item_no, 11) = 0 THEN 'COMPLETED'
            WHEN mod(item_no, 3) = 0 THEN 'IN_PROGRESS' ELSE 'NOT_STARTED' END;
        INSERT INTO tasks (account_id, source_note_id, source_status, title,
                           description, status, deadline, category_id, created_at, updated_at)
        VALUES (account_id, note_id, 'HAS_SOURCE',
                left(format('Rebuild the study outline for %s — session %s',
                    media.title, 1 + (item_no - 1) / 90), 255),
                'The original Note was removed. Write a fresh outline from the material you still have; do not assume the old source context can be recovered.',
                task_status, deadline_date, category_id,
                created_time + interval '1 hour', created_time + interval '1 hour')
        RETURNING id INTO task_id;
        INSERT INTO task_tags (task_id, tag_id)
        SELECT task_id, tag.id FROM unnest(media.tag_names[1:2]) AS label(name)
        JOIN demo_tag_map tag ON tag.name = label.name;
        UPDATE tasks SET source_note_id = NULL, source_status = 'SOURCE_MISSING',
                         updated_at = created_time + interval '2 hours'
        WHERE id = task_id;
        DELETE FROM notes WHERE id = note_id;
    END LOOP;
END $$;

DO $$ BEGIN
    IF (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id) <> 1500
       OR (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id
           WHERE task.source_status = 'INDEPENDENT') <> 300
       OR (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id
           WHERE task.source_status = 'HAS_SOURCE') <> 900
       OR (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id
           WHERE task.source_status = 'SOURCE_MISSING') <> 300 THEN
        RAISE EXCEPTION 'V3 Task composition failed: total %, independent %, linked %, missing %',
            (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id),
            (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id WHERE task.source_status = 'INDEPENDENT'),
            (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id WHERE task.source_status = 'HAS_SOURCE'),
            (SELECT count(*) FROM tasks task JOIN demo_account account ON account.id = task.account_id WHERE task.source_status = 'SOURCE_MISSING');
    END IF;
END $$;

SELECT 'demo_video' AS metric, count(*) AS value FROM library_videos library
JOIN demo_account account ON account.id = library.account_id
UNION ALL SELECT 'demo_image', count(*) FROM library_images library
JOIN demo_account account ON account.id = library.account_id
UNION ALL SELECT 'demo_audio', count(*) FROM library_audio library
JOIN demo_account account ON account.id = library.account_id
UNION ALL SELECT 'demo_notes', count(*) FROM notes note
JOIN demo_account account ON account.id = note.account_id
UNION ALL SELECT 'demo_tasks', count(*) FROM tasks task
JOIN demo_account account ON account.id = task.account_id;

COMMIT;
