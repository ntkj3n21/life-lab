BEGIN;

SELECT pg_advisory_xact_lock(hashtext('life-lab-a1-seed'));

CREATE TEMP TABLE a1_config AS
SELECT
    :'reference_date'::date AS reference_date,
    (:'reference_date'::date::timestamp + time '12:00')
        AT TIME ZONE 'Asia/Ho_Chi_Minh' AS reference_instant,
    :'deterministic_seed'::integer AS deterministic_seed;

DO $$
BEGIN
    IF (SELECT count(*) FROM a1_snapshot_sources) <> 37
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE role = 'CURRENT_LIBRARY') <> 36
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE role = 'HISTORICAL_H1') <> 1
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE youtube_video_id = '-XsRLyKV9_k') <> 1
       OR EXISTS (
            SELECT 1
            FROM a1_snapshot_sources
            GROUP BY youtube_video_id
            HAVING count(*) > 1)
       OR EXISTS (
            SELECT 1
            FROM a1_snapshot_sources
            WHERE availability_status <> 'AVAILABLE'
               OR duration_seconds <= 0) THEN
        RAISE EXCEPTION 'A1 snapshot preflight failed';
    END IF;
END
$$;

-- Reset only the account identified by the locked A1 email.
-- Shared/global source rows are retained unless a later fixture-specific cleanup
-- proves they are no longer referenced by any account or Note.
DELETE FROM tasks
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM notes
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM tags
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM categories
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM library_images
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM library_audio
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM library_videos
WHERE account_id IN (
    SELECT id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'
);

DELETE FROM accounts
WHERE lower(email) = 'demo@lifelab.local';

-- Remove only unreferenced deterministic A1 Image sources.
-- If another account or historical Note still references one of these sources,
-- keep it because image_sources are global/shared.
DELETE FROM image_sources image
USING a1_image_fixtures fixture
WHERE image.storage_key = fixture.storage_key
    AND image.origin = 'UPLOAD'
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

-- Remove only unreferenced deterministic A1 Audio sources.
-- Keep a global source if another account/library membership or Note still uses it.
DELETE FROM audio_sources audio
USING a1_audio_fixtures fixture
WHERE audio.storage_key = fixture.storage_key
    AND audio.origin = 'UPLOAD'
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

-- Remove only now-unreferenced A1 snapshot rows so snapshot metadata is restored exactly.
-- A source used by any unrelated account is global/shared and is never deleted here.
DELETE FROM youtube_videos youtube
USING a1_snapshot_sources source
WHERE youtube.youtube_video_id = source.youtube_video_id
  AND NOT EXISTS (
      SELECT 1 FROM library_videos library
      WHERE library.youtube_source_id = youtube.id)
  AND NOT EXISTS (
      SELECT 1 FROM notes note
      WHERE note.youtube_source_id = youtube.id);

-- Insert only missing global sources. Never overwrite metadata that may be shared by another account.
INSERT INTO youtube_videos (
    youtube_video_id,
    source_url,
    title,
    channel_name,
    thumbnail_url,
    duration_seconds,
    published_at,
    availability_status,
    created_at,
    updated_at)
SELECT
    source.youtube_video_id,
    source.source_url,
    source.title,
    source.channel_name,
    source.thumbnail_url,
    source.duration_seconds,
    source.published_at,
    source.availability_status,
    GREATEST(source.published_at, config.reference_instant - interval '250 days'),
    GREATEST(source.published_at, config.reference_instant - interval '250 days')
FROM a1_snapshot_sources source
CROSS JOIN a1_config config
ON CONFLICT (youtube_video_id) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM youtube_videos video
        JOIN a1_snapshot_sources source
          ON source.youtube_video_id = video.youtube_video_id
        WHERE video.duration_seconds = source.duration_seconds
          AND video.availability_status = 'AVAILABLE') <> 37 THEN
        RAISE EXCEPTION
            'An existing shared YouTube source conflicts with the validated A1 snapshot';
    END IF;
END
$$;

INSERT INTO accounts (
    email,
    password_hash,
    display_name,
    created_at,
    updated_at)
SELECT
    'demo@lifelab.local',
    :'password_hash',
    'Life Lab Demo',
    reference_instant - interval '240 days',
    reference_instant - interval '240 days'
FROM a1_config;

-- ---------------------------------------------------------------------------
-- A1 V2 Image fixtures
-- ---------------------------------------------------------------------------

-- image_sources are global/shared.
-- Insert only deterministic A1 upload sources that do not already exist.
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
    'UPLOAD',
    NULL,
    fixture.storage_key,
    fixture.file_name,
    fixture.media_type,
    fixture.size_bytes,
    config.reference_instant
        - interval '50 days'
        + fixture.image_no * interval '2 days'
FROM a1_image_fixtures fixture
CROSS JOIN a1_config config
WHERE NOT EXISTS (
    SELECT 1
    FROM image_sources existing
    WHERE existing.storage_key = fixture.storage_key
);

-- A deterministic storage key may survive reset only when some unrelated
-- account/Note still references that global source. In that case it must
-- still describe exactly the same fixture.
DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM image_sources source
        JOIN a1_image_fixtures fixture
          ON fixture.storage_key = source.storage_key
    ) <> 14 THEN
        RAISE EXCEPTION
            'A1 Image source count mismatch: expected 14 deterministic sources';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM image_sources source
        JOIN a1_image_fixtures fixture
          ON fixture.storage_key = source.storage_key
        WHERE source.origin <> 'UPLOAD'
           OR source.external_url IS NOT NULL
           OR source.original_filename <> fixture.file_name
           OR source.media_type <> fixture.media_type
           OR source.size_bytes <> fixture.size_bytes
    ) THEN
        RAISE EXCEPTION
            'An existing shared Image source conflicts with the A1 fixture';
    END IF;
END
$$;

CREATE TEMP TABLE a1_image_map (
    image_no INTEGER PRIMARY KEY,
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
    config.reference_instant
        - interval '42 days'
        + fixture.image_no * interval '2 days'
FROM a1_image_fixtures fixture
JOIN image_sources source
  ON source.storage_key = fixture.storage_key
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE lower(account.email) = 'demo@lifelab.local'
ORDER BY fixture.image_no;

INSERT INTO a1_image_map (
    image_no,
    image_source_id,
    library_image_id,
    added_at
)
SELECT
    fixture.image_no,
    source.id,
    library.id,
    library.added_at
FROM a1_image_fixtures fixture
JOIN image_sources source
  ON source.storage_key = fixture.storage_key
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN library_images library
  ON library.account_id = account.id
 AND library.image_source_id = source.id
ORDER BY fixture.image_no;

DO $$
BEGIN
    IF (SELECT count(*) FROM a1_image_map) <> 14 THEN
        RAISE EXCEPTION
            'A1 Image Library seed failed: expected 14 Library Images';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_image_map map
        JOIN a1_image_fixtures fixture
          ON fixture.image_no = map.image_no
        JOIN library_images library
          ON library.id = map.library_image_id
        WHERE library.title IS DISTINCT FROM fixture.title
           OR btrim(library.title) = ''
    ) THEN
        RAISE EXCEPTION
            'A1 Image Library title validation failed';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A1 V2 Audio fixtures
-- ---------------------------------------------------------------------------

-- audio_sources are global/shared.
-- source_url from a1_audio_fixtures is provenance metadata only.
-- These deterministic A1 sources are uploaded MP3s, therefore external_url
-- must stay NULL.
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
    'UPLOAD',
    NULL,
    fixture.storage_key,
    fixture.original_filename,
    fixture.media_type,
    fixture.size_bytes,
    config.reference_instant
        - interval '38 days'
        + fixture.audio_no * interval '1 day'
FROM a1_audio_fixtures fixture
CROSS JOIN a1_config config
WHERE NOT EXISTS (
    SELECT 1
    FROM audio_sources existing
    WHERE existing.storage_key = fixture.storage_key
);

-- A deterministic storage key may survive reset only when an unrelated
-- account/Note still references that global source. In that situation the
-- surviving source must still describe exactly the same fixture.
DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM audio_sources source
        JOIN a1_audio_fixtures fixture
          ON fixture.storage_key = source.storage_key
    ) <> 13 THEN
        RAISE EXCEPTION
            'A1 Audio source count mismatch: expected 13 deterministic sources';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM audio_sources source
        JOIN a1_audio_fixtures fixture
          ON fixture.storage_key = source.storage_key
        WHERE source.origin <> 'UPLOAD'
           OR source.external_url IS NOT NULL
           OR source.original_filename IS DISTINCT FROM fixture.original_filename
           OR source.media_type IS DISTINCT FROM fixture.media_type
           OR source.size_bytes IS DISTINCT FROM fixture.size_bytes
    ) THEN
        RAISE EXCEPTION
            'An existing shared Audio source conflicts with the A1 fixture';
    END IF;
END
$$;

CREATE TEMP TABLE a1_audio_map (
    audio_no INTEGER PRIMARY KEY,
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
        - interval '25 days'
        + fixture.audio_no * interval '1 day'
FROM a1_audio_fixtures fixture
JOIN audio_sources source
  ON source.storage_key = fixture.storage_key
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE lower(account.email) = 'demo@lifelab.local'
ORDER BY fixture.audio_no;

INSERT INTO a1_audio_map (
    audio_no,
    audio_source_id,
    library_audio_id,
    added_at
)
SELECT
    fixture.audio_no,
    source.id,
    library.id,
    library.added_at
FROM a1_audio_fixtures fixture
JOIN audio_sources source
  ON source.storage_key = fixture.storage_key
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN library_audio library
  ON library.account_id = account.id
 AND library.audio_source_id = source.id
ORDER BY fixture.audio_no;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM a1_audio_map
    ) <> 13 THEN
        RAISE EXCEPTION
            'A1 Audio Library count mismatch: expected 13';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_audio_map map
        JOIN a1_audio_fixtures fixture
          ON fixture.audio_no = map.audio_no
        JOIN library_audio library
          ON library.id = map.library_audio_id
        WHERE library.title IS DISTINCT FROM fixture.title
           OR btrim(library.title) = ''
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Library title validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_audio_map map
        JOIN audio_sources source
          ON source.id = map.audio_source_id
        WHERE source.origin <> 'UPLOAD'
           OR source.external_url IS NOT NULL
           OR source.storage_key IS NULL
           OR source.original_filename IS NULL
           OR source.media_type <> 'audio/mpeg'
           OR source.size_bytes IS NULL
           OR source.size_bytes < 0
    ) THEN
        RAISE EXCEPTION
            'A1 Audio upload source shape validation failed';
    END IF;
END
$$;

CREATE TEMP TABLE a1_library_map (
    video_no INTEGER PRIMARY KEY,
    library_video_id BIGINT NOT NULL,
    youtube_source_id BIGINT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL
);

WITH inserted AS (
    INSERT INTO library_videos (
        account_id,
        youtube_source_id,
        custom_title,
        personal_description,
        added_at,
        updated_at)
    SELECT
        account.id,
        youtube.id,
        CASE source.library_order
            WHEN 1 THEN 'Nền tảng Java cần nắm chắc'
            WHEN 6 THEN 'Lộ trình Spring Boot thực hành'
            WHEN 7 THEN 'REST API cho đồ án Life Lab'
            WHEN 10 THEN 'React và JavaScript nền tảng'
            WHEN 19 THEN 'Git căn bản để làm việc nhóm'
            WHEN 22 THEN 'Kế hoạch học tiếng Anh 30 ngày'
            WHEN 31 THEN 'Spring Boot full course'
            WHEN 32 THEN 'Spring Security chuyên sâu'
            WHEN 35 THEN 'Kiểm thử phần mềm thực chiến'
            WHEN 36 THEN 'HTTP từ nền tảng đến thực hành'
            ELSE NULL
        END,
        CASE WHEN source.library_order IN (1, 3, 6, 7, 8, 10, 19, 20, 22, 25, 31, 32, 35, 36)
            THEN CASE source.library_order
                WHEN 1 THEN 'Ôn lại cú pháp và tư duy hướng đối tượng trước khi đi sâu vào backend.'
                WHEN 3 THEN 'Dùng làm khung ôn tập cấu trúc dữ liệu và giải thuật cho phỏng vấn.'
                WHEN 6 THEN 'Theo dõi lộ trình Java Spring và đánh dấu phần cần áp dụng vào đồ án.'
                WHEN 7 THEN 'Tham khảo cách tổ chức REST API và phân lớp backend rõ ràng.'
                WHEN 8 THEN 'Ghi lại các thao tác SQL Server quan trọng để luyện lại bằng PostgreSQL.'
                WHEN 10 THEN 'Củng cố JavaScript hiện đại trước khi tối ưu giao diện React.'
                WHEN 19 THEN 'Chuẩn hóa quy trình Git cá nhân trước khi cộng tác theo nhóm.'
                WHEN 20 THEN 'Thử áp dụng phương pháp học chủ động vào lịch học hằng tuần.'
                WHEN 22 THEN 'Theo dõi tiến độ tiếng Anh bằng mục tiêu nhỏ, đều đặn mỗi ngày.'
                WHEN 25 THEN 'Điều chỉnh cách chia thời gian giữa học backend, tiếng Anh và đồ án.'
                WHEN 31 THEN 'Đối chiếu kiến trúc Spring Boot trong khóa học với backend Life Lab.'
                WHEN 32 THEN 'Tập trung vào xác thực, phân quyền và các lỗi cấu hình thường gặp.'
                WHEN 35 THEN 'Bổ sung chiến lược unit test và integration test cho các luồng chính.'
                WHEN 36 THEN 'Hệ thống hóa request, response, header và status code để debug API.'
            END
            ELSE NULL
        END,
        GREATEST(
            youtube.published_at + interval '1 day',
            config.reference_instant - interval '230 days'
                + source.library_order * interval '5 days'),
        GREATEST(
            youtube.published_at + interval '1 day',
            config.reference_instant - interval '230 days'
                + source.library_order * interval '5 days')
            + ((source.library_order * 17) % 72) * interval '1 hour'
    FROM a1_snapshot_sources source
    JOIN youtube_videos youtube
      ON youtube.youtube_video_id = source.youtube_video_id
    CROSS JOIN accounts account
    CROSS JOIN a1_config config
    WHERE source.role = 'CURRENT_LIBRARY'
      AND account.email = 'demo@lifelab.local'
    RETURNING id, youtube_source_id, added_at)
INSERT INTO a1_library_map (
    video_no,
    library_video_id,
    youtube_source_id,
    added_at)
SELECT
    source.library_order,
    inserted.id,
    inserted.youtube_source_id,
    inserted.added_at
FROM inserted
JOIN youtube_videos youtube
  ON youtube.id = inserted.youtube_source_id
JOIN a1_snapshot_sources source
  ON source.youtube_video_id = youtube.youtube_video_id;

CREATE TEMP TABLE a1_tag_names (
    ordinal INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO a1_tag_names (ordinal, name) VALUES
    (1, 'Java'),
    (2, 'OOP'),
    (3, 'DSA'),
    (4, 'Spring Boot'),
    (5, 'Backend'),
    (6, 'REST API'),
    (7, 'React'),
    (8, 'JavaScript'),
    (9, 'TypeScript'),
    (10, 'SQL'),
    (11, 'Database'),
    (12, 'Security'),
    (13, 'Docker'),
    (14, 'Git'),
    (15, 'Testing'),
    (16, 'Tiếng Anh'),
    (17, 'Từ vựng'),
    (18, 'Phát âm'),
    (19, 'IELTS'),
    (20, 'Kỹ năng học'),
    (21, 'Career'),
    (22, 'Đồ án'),
    (23, 'Quan trọng'),
    (24, 'Xem lại');

INSERT INTO tags (
    account_id,
    name,
    normalized_name,
    created_at,
    updated_at)
SELECT
    account.id,
    tag.name,
    lower(tag.name),
    config.reference_instant - interval '225 days' + tag.ordinal * interval '2 hours',
    config.reference_instant - interval '225 days' + tag.ordinal * interval '2 hours'
FROM a1_tag_names tag
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE account.email = 'demo@lifelab.local';

CREATE TEMP TABLE a1_video_tag_seed (
    video_no INTEGER NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (video_no, tag_name)
);

INSERT INTO a1_video_tag_seed (video_no, tag_name) VALUES
    (1,'Java'),(1,'OOP'),(1,'DSA'),(1,'Backend'),(1,'Quan trọng'),
    (2,'OOP'),(2,'DSA'),(2,'Quan trọng'),(2,'Xem lại'),
    (3,'DSA'),(3,'Kỹ năng học'),(3,'Quan trọng'),(3,'Xem lại'),
    (4,'DSA'),(4,'Đồ án'),(4,'Xem lại'),
    (6,'Java'),(6,'Spring Boot'),(6,'Backend'),(6,'REST API'),(6,'Đồ án'),
    (7,'Spring Boot'),(7,'REST API'),(7,'Backend'),(7,'React'),
    (8,'SQL'),(8,'Database'),(8,'Xem lại'),
    (9,'SQL'),(9,'Database'),(9,'Quan trọng'),
    (10,'React'),(10,'JavaScript'),(10,'TypeScript'),(10,'Quan trọng'),
    (11,'React'),(11,'JavaScript'),
    (12,'TypeScript'),(12,'JavaScript'),
    (13,'React'),(13,'JavaScript'),
    (14,'React'),(14,'JavaScript'),(14,'Xem lại'),
    (15,'React'),(15,'JavaScript'),
    (16,'Career'),(16,'Quan trọng'),
    (17,'Career'),(17,'Xem lại'),
    (18,'Kỹ năng học'),
    (19,'Git'),(19,'Quan trọng'),(19,'Xem lại'),
    (20,'Kỹ năng học'),(20,'Quan trọng'),(20,'Xem lại'),
    (21,'Tiếng Anh'),(21,'Từ vựng'),(21,'Xem lại'),
    (22,'Tiếng Anh'),(22,'Từ vựng'),(22,'Kỹ năng học'),(22,'Quan trọng'),
    (23,'Tiếng Anh'),(23,'Kỹ năng học'),(23,'Quan trọng'),
    (24,'Tiếng Anh'),(24,'Phát âm'),(24,'Từ vựng'),
    (25,'Kỹ năng học'),(25,'Career'),(25,'Quan trọng'),
    (26,'Tiếng Anh'),(26,'Từ vựng'),
    (27,'Tiếng Anh'),(27,'Phát âm'),
    (28,'Tiếng Anh'),(28,'IELTS'),(28,'Xem lại'),
    (29,'Tiếng Anh'),
    (30,'Tiếng Anh'),
    (31,'Spring Boot'),(31,'Backend'),(31,'REST API'),(31,'Đồ án'),
    (32,'Security'),(32,'Spring Boot'),(32,'Backend'),(32,'Quan trọng'),
    (33,'Docker'),(33,'Backend'),
    (34,'Database'),(34,'Backend'),(34,'Quan trọng'),
    (35,'Testing'),(35,'Backend'),(35,'Quan trọng'),(35,'Xem lại'),
    (36,'REST API');

INSERT INTO library_video_tags (library_video_id, tag_id)
SELECT library.library_video_id, tag.id
FROM a1_video_tag_seed seed
JOIN a1_library_map library ON library.video_no = seed.video_no
JOIN tags tag
  ON tag.name = seed.tag_name
JOIN accounts account ON account.id = tag.account_id
WHERE account.email = 'demo@lifelab.local';

CREATE TEMP TABLE a1_video_distribution (
    video_no INTEGER PRIMARY KEY,
    valid_count INTEGER NOT NULL,
    invalid_count INTEGER NOT NULL,
    note_count INTEGER NOT NULL
);

INSERT INTO a1_video_distribution VALUES
    (1,12,1,9),(2,4,1,3),(3,4,1,3),(4,4,0,3),(5,0,2,0),(6,9,1,7),
    (7,6,1,4),(8,3,0,3),(9,0,2,0),(10,8,1,5),(11,5,1,3),(12,0,2,0),
    (13,4,0,3),(14,5,1,5),(15,0,2,0),(16,2,0,0),(17,3,1,3),(18,0,2,0),
    (19,4,1,2),(20,6,1,5),(21,5,1,4),(22,4,1,4),(23,3,0,4),(24,4,1,4),
    (25,2,1,4),(26,0,2,0),(27,0,2,0),(28,0,2,0),(29,0,2,0),(30,0,2,0),
    (31,7,1,6),(32,7,1,6),(33,3,1,0),(34,0,2,0),(35,3,1,2),(36,0,2,0);

WITH session_seed AS (
    SELECT distribution.video_no, 'VALID'::varchar AS validity_status, series AS session_no
    FROM a1_video_distribution distribution
    CROSS JOIN LATERAL generate_series(1, distribution.valid_count) series
    UNION ALL
    SELECT distribution.video_no, 'INVALID'::varchar, series
    FROM a1_video_distribution distribution
    CROSS JOIN LATERAL generate_series(1, distribution.invalid_count) series),
calculated AS (
    SELECT
        seed.*,
        library.library_video_id,
        library.added_at,
        youtube.duration_seconds,
        LEAST(30, ((youtube.duration_seconds::bigint * 4 + 4) / 5)::integer) AS threshold,
        GREATEST(
            library.added_at + interval '1 day',
            config.reference_instant - interval '180 days'
                + ((seed.video_no * 5 + seed.session_no * 3) % 150) * interval '1 day')
            + ((seed.video_no * 13 + seed.session_no * 7) % 18) * interval '1 hour'
            AS started_at
    FROM session_seed seed
    JOIN a1_library_map library ON library.video_no = seed.video_no
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
    CROSS JOIN a1_config config),
trusted AS (
    SELECT
        calculated.*,
        CASE validity_status
            WHEN 'VALID' THEN threshold
                + ((video_no * 7 + session_no * 11)
                    % GREATEST(1, LEAST(91, duration_seconds - threshold + 1)))
            ELSE GREATEST(
                0,
                threshold - 1 - ((video_no * 3 + session_no * 5) % GREATEST(1, threshold)))
        END AS watch_seconds
    FROM calculated)
INSERT INTO watch_sessions (
    library_video_id,
    started_at,
    ended_at,
    last_heartbeat_at,
    watch_time_seconds,
    validity_status)
SELECT
    library_video_id,
    started_at,
    started_at + watch_seconds * interval '1 second'
        + (10 + ((video_no + session_no) % 50)) * interval '1 second',
    started_at + watch_seconds * interval '1 second',
    watch_seconds,
    validity_status
FROM trusted;

-- Semantic Notes and Tasks consume durable JSON fixtures prepared offline.
CREATE TEMP TABLE a1_note_map (
    note_key TEXT PRIMARY KEY,
    note_id BIGINT NOT NULL,
    source_fixture_key TEXT NOT NULL,
    note_no INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

DO $$
DECLARE r RECORD; n BIGINT; created TIMESTAMPTZ; source_id BIGINT; account_id_value BIGINT;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 FOR r IN SELECT * FROM a1_note_fixtures ORDER BY source_fixture_key, note_no LOOP
   SELECT youtube.id INTO source_id FROM youtube_videos youtube JOIN a1_snapshot_sources s ON s.youtube_video_id=youtube.youtube_video_id WHERE s.fixture_key=r.source_fixture_key;
   SELECT GREATEST(
       COALESCE((SELECT library.added_at FROM a1_library_map library JOIN a1_snapshot_sources s ON s.library_order=library.video_no WHERE s.fixture_key=r.source_fixture_key), c.reference_instant - interval '400 days') + interval '2 days',
       c.reference_instant - ((r.note_sequence % 180) + 20) * interval '1 day') + (r.note_sequence % 12) * interval '1 hour'
     INTO created FROM a1_config c;
   INSERT INTO notes(account_id,youtube_source_id,content,timestamp_seconds,created_at,updated_at)
     VALUES(account_id_value,source_id,r.content,r.timestamp_seconds,created,created) RETURNING id INTO n;
   INSERT INTO a1_note_map VALUES(r.note_key,n,r.source_fixture_key,r.note_no,created);
 END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- A1 V2 Image Notes
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a1_image_note_map (
    image_no INTEGER PRIMARY KEY,
    note_id BIGINT NOT NULL,
    image_source_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

DO $$
DECLARE
    r RECORD;
    note_id_value BIGINT;
    account_id_value BIGINT;
    image_source_id_value BIGINT;
    note_created_at TIMESTAMPTZ;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    FOR r IN
        SELECT *
        FROM a1_image_fixtures
        ORDER BY image_no
    LOOP
        SELECT
            map.image_source_id,
            map.added_at
                + interval '1 day'
                + r.image_no * interval '1 hour'
        INTO STRICT
            image_source_id_value,
            note_created_at
        FROM a1_image_map map
        WHERE map.image_no = r.image_no;

        INSERT INTO notes (
            account_id,
            source_type,
            youtube_source_id,
            image_source_id,
            audio_source_id,
            content,
            timestamp_seconds,
            category_id,
            created_at,
            updated_at
        )
        VALUES (
            account_id_value,
            'IMAGE',
            NULL,
            image_source_id_value,
            NULL,
            r.note_content,
            NULL,
            NULL,
            note_created_at,
            note_created_at
        )
        RETURNING id INTO note_id_value;

        INSERT INTO a1_image_note_map (
            image_no,
            note_id,
            image_source_id,
            created_at
        )
        VALUES (
            r.image_no,
            note_id_value,
            image_source_id_value,
            note_created_at
        );
    END LOOP;
END
$$;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    IF (SELECT count(*) FROM a1_image_note_map) <> 14 THEN
        RAISE EXCEPTION
            'A1 Image Note seed failed: expected 14 Image Notes';
    END IF;

    IF (
        SELECT count(*)
        FROM notes
        WHERE account_id = account_id_value
          AND source_type = 'IMAGE'
    ) <> 14 THEN
        RAISE EXCEPTION
            'A1 Image Note count mismatch';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM notes
        WHERE account_id = account_id_value
          AND source_type = 'IMAGE'
          AND (
              youtube_source_id IS NOT NULL
              OR image_source_id IS NULL
              OR audio_source_id IS NOT NULL
              OR timestamp_seconds IS NOT NULL
          )
    ) THEN
        RAISE EXCEPTION
            'A1 Image Note provenance validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_image_note_map map
        JOIN notes note
          ON note.id = map.note_id
        JOIN a1_image_fixtures fixture
          ON fixture.image_no = map.image_no
        WHERE note.content IS DISTINCT FROM fixture.note_content
    ) THEN
        RAISE EXCEPTION
            'A1 Image Note content validation failed';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A1 V2 Audio Notes
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a1_audio_note_map (
    audio_no INTEGER PRIMARY KEY,
    note_id BIGINT NOT NULL,
    audio_source_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

WITH inserted_audio_notes AS (
    INSERT INTO notes (
        account_id,
        source_type,
        youtube_source_id,
        image_source_id,
        audio_source_id,
        content,
        timestamp_seconds,
        category_id,
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
        NULL,
        audio_map.added_at
            + interval '1 day'
            + fixture.audio_no * interval '1 hour',
        audio_map.added_at
            + interval '1 day'
            + fixture.audio_no * interval '1 hour'
    FROM a1_audio_fixtures fixture
    JOIN a1_audio_map audio_map
      ON audio_map.audio_no = fixture.audio_no
    CROSS JOIN accounts account
    WHERE lower(account.email) = 'demo@lifelab.local'
    ORDER BY fixture.audio_no
    RETURNING
        id,
        audio_source_id,
        created_at
)
INSERT INTO a1_audio_note_map (
    audio_no,
    note_id,
    audio_source_id,
    created_at
)
SELECT
    fixture.audio_no,
    inserted.id,
    inserted.audio_source_id,
    inserted.created_at
FROM inserted_audio_notes inserted
JOIN a1_audio_map audio_map
  ON audio_map.audio_source_id = inserted.audio_source_id
JOIN a1_audio_fixtures fixture
  ON fixture.audio_no = audio_map.audio_no
ORDER BY fixture.audio_no;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    IF (
        SELECT count(*)
        FROM a1_audio_note_map
    ) <> 13 THEN
        RAISE EXCEPTION
            'A1 Audio Note count mismatch: expected 13';
    END IF;

    -- Exact AUDIO provenance:
    -- only audio_source_id may be populated.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.account_id <> account_id_value
           OR note.source_type <> 'AUDIO'
           OR note.youtube_source_id IS NOT NULL
           OR note.image_source_id IS NOT NULL
           OR note.audio_source_id IS NULL
           OR note.audio_source_id <> map.audio_source_id
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Note provenance validation failed';
    END IF;

    -- Every fixture creates exactly one mapped Note with exact content
    -- and exact timestamp.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_fixtures fixture
        LEFT JOIN a1_audio_note_map map
          ON map.audio_no = fixture.audio_no
        LEFT JOIN notes note
          ON note.id = map.note_id
        WHERE map.note_id IS NULL
           OR note.content IS DISTINCT FROM fixture.note_content
           OR note.timestamp_seconds
                IS DISTINCT FROM fixture.timestamp_seconds
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Note fixture validation failed';
    END IF;

    -- All Audio Notes must still point to Audio sources present
    -- in this account's Audio Library.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_note_map map
        LEFT JOIN library_audio library
          ON library.audio_source_id = map.audio_source_id
         AND library.account_id = account_id_value
        WHERE library.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Note Library provenance validation failed';
    END IF;

    IF (
        SELECT count(*)
        FROM a1_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds = 0
    ) <> 3 THEN
        RAISE EXCEPTION
            'A1 Audio timestamp=0 count mismatch: expected 3';
    END IF;

    IF (
        SELECT count(*)
        FROM a1_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds > 0
    ) <> 10 THEN
        RAISE EXCEPTION
            'A1 Audio positive timestamp count mismatch: expected 10';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_audio_note_map map
        JOIN notes note
          ON note.id = map.note_id
        WHERE note.timestamp_seconds IS NULL
           OR note.timestamp_seconds < 0
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Note timestamp validation failed';
    END IF;
END
$$;

CREATE TEMP TABLE a1_task_map(task_key TEXT PRIMARY KEY, task_id BIGINT NOT NULL, source_group TEXT NOT NULL, sequence_no INTEGER NOT NULL);

DO $$
DECLARE r RECORD; n BIGINT; created TIMESTAMPTZ; account_id_value BIGINT; temp_note BIGINT; source_id BIGINT; missing_lifecycles INTEGER := 0;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 FOR r IN SELECT * FROM a1_task_fixtures ORDER BY task_key LOOP
   IF r.source_status='HAS_SOURCE' THEN
     SELECT note_id,created_at INTO n,created FROM a1_note_map WHERE note_key=r.note_key;
   ELSIF r.source_status='SOURCE_MISSING' THEN
     SELECT youtube_source_id INTO STRICT source_id FROM a1_library_map WHERE video_no=6;
     SELECT reference_instant - ((r.sequence_no % 140) + 30) * interval '1 day'
       INTO created FROM a1_config;
     INSERT INTO notes(account_id,youtube_source_id,content,timestamp_seconds,created_at,updated_at)
       VALUES(account_id_value,source_id,'Temporary source fixture for lifecycle validation',NULL,created,created)
       RETURNING id INTO temp_note;
     n := temp_note;
   ELSE
     SELECT reference_instant INTO created FROM a1_config;
     created := created - ((r.sequence_no % 140) + 30) * interval '1 day';
   END IF;
   INSERT INTO tasks(account_id,source_note_id,source_status,title,description,status,deadline,created_at,updated_at)
   VALUES(account_id_value,CASE WHEN r.source_status IN ('HAS_SOURCE','SOURCE_MISSING') THEN n ELSE NULL END,CASE WHEN r.source_status='SOURCE_MISSING' THEN 'HAS_SOURCE' ELSE r.source_status END,r.title,r.description,r.status,
      CASE r.deadline_class WHEN 'OVERDUE' THEN (SELECT reference_date-((r.sequence_no % 9)+1)::integer FROM a1_config) WHEN 'TODAY' THEN (SELECT reference_date FROM a1_config) WHEN 'UPCOMING' THEN (SELECT reference_date+((r.sequence_no % 21)+1)::integer FROM a1_config) ELSE NULL END,
      created + interval '1 day',created + interval '1 day') RETURNING id INTO n;
   INSERT INTO a1_task_map VALUES(r.task_key,n,r.source_status,r.sequence_no);
   IF r.source_status='SOURCE_MISSING' THEN
     UPDATE tasks SET source_note_id=NULL, source_status='SOURCE_MISSING', updated_at=updated_at+interval '1 day'
       WHERE id=n AND account_id=account_id_value AND source_note_id=temp_note AND source_status='HAS_SOURCE';
     IF NOT FOUND THEN RAISE EXCEPTION 'A1 SOURCE_MISSING transition failed'; END IF;
     DELETE FROM notes WHERE id=temp_note AND account_id=account_id_value;
     IF NOT FOUND THEN RAISE EXCEPTION 'A1 temporary source Note deletion failed'; END IF;
     missing_lifecycles := missing_lifecycles + 1;
   END IF;
 END LOOP;
 IF missing_lifecycles<>15 THEN RAISE EXCEPTION 'Expected 15 A1 SOURCE_MISSING lifecycles, got %', missing_lifecycles; END IF;
END $$;

-- Each SOURCE_MISSING Task survives deletion of its temporary, same-account Note.

-- ---------------------------------------------------------------------------
-- A1 V2 Image Tasks
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a1_image_task_map (
    image_no INTEGER PRIMARY KEY,
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
    task_deadline DATE;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    FOR r IN
        SELECT *
        FROM a1_image_fixtures
        WHERE task_title IS NOT NULL
          AND btrim(task_title) <> ''
        ORDER BY image_no
    LOOP
        SELECT
            note_id,
            created_at
        INTO STRICT
            note_id_value,
            note_created_at
        FROM a1_image_note_map
        WHERE image_no = r.image_no;

        task_deadline :=
            CASE r.deadline_class
                WHEN 'OVERDUE' THEN
                    (SELECT reference_date - ((r.image_no % 5) + 1)
                     FROM a1_config)
                WHEN 'TODAY' THEN
                    (SELECT reference_date FROM a1_config)
                WHEN 'UPCOMING' THEN
                    (SELECT reference_date + ((r.image_no % 10) + 1)
                     FROM a1_config)
                WHEN 'NO_DEADLINE' THEN
                    NULL
                ELSE
                    NULL
            END;

        INSERT INTO tasks (
            account_id,
            source_note_id,
            source_status,
            title,
            description,
            status,
            deadline,
            category_id,
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
            task_deadline,
            NULL,
            note_created_at + interval '1 day',
            note_created_at + interval '1 day'
        )
        RETURNING id INTO task_id_value;

        INSERT INTO a1_image_task_map (
            image_no,
            task_id,
            note_id
        )
        VALUES (
            r.image_no,
            task_id_value,
            note_id_value
        );
    END LOOP;
END
$$;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    IF (SELECT count(*) FROM a1_image_task_map) <> 10 THEN
        RAISE EXCEPTION
            'A1 Image Task seed failed: expected 10 linked Tasks';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_image_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        JOIN notes note
          ON note.id = map.note_id
        WHERE task.account_id <> account_id_value
           OR task.source_status <> 'HAS_SOURCE'
           OR task.source_note_id <> note.id
           OR note.account_id <> account_id_value
           OR note.source_type <> 'IMAGE'
           OR note.image_source_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Image Task provenance validation failed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM a1_image_fixtures fixture
        LEFT JOIN a1_image_task_map map
          ON map.image_no = fixture.image_no
        WHERE
            (
                fixture.task_title IS NULL
                OR btrim(fixture.task_title) = ''
            )
            AND map.task_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Note-only Image unexpectedly received a Task';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A1 V2 Audio Tasks
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE a1_audio_task_map (
    audio_no INTEGER PRIMARY KEY,
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
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    SELECT reference_date
    INTO STRICT reference_date_value
    FROM a1_config;

    FOR r IN
        SELECT *
        FROM a1_audio_fixtures
        WHERE task_title IS NOT NULL
          AND btrim(task_title) <> ''
        ORDER BY audio_no
    LOOP
        SELECT
            note_id,
            created_at
        INTO STRICT
            note_id_value,
            note_created_at
        FROM a1_audio_note_map
        WHERE audio_no = r.audio_no;

        deadline_value :=
            CASE r.deadline_class
                WHEN 'OVERDUE' THEN
                    reference_date_value - 2
                WHEN 'TODAY' THEN
                    reference_date_value
                WHEN 'UPCOMING' THEN
                    reference_date_value
                        + ((r.audio_no % 5) + 1)
                WHEN 'NO_DEADLINE' THEN
                    NULL
                ELSE
                    NULL
            END;

        IF r.deadline_class NOT IN (
            'OVERDUE',
            'TODAY',
            'UPCOMING',
            'NO_DEADLINE'
        ) THEN
            RAISE EXCEPTION
                'Unsupported A1 Audio deadline class: %',
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

        INSERT INTO a1_audio_task_map (
            audio_no,
            task_id,
            note_id
        )
        VALUES (
            r.audio_no,
            task_id_value,
            note_id_value
        );
    END LOOP;

    IF (
        SELECT count(*)
        FROM a1_audio_task_map
    ) <> 9 THEN
        RAISE EXCEPTION
            'A1 Audio Task count mismatch: expected 9';
    END IF;

    -- Every mapped Task must be HAS_SOURCE and point to the
    -- corresponding AUDIO Note.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        JOIN notes note
          ON note.id = map.note_id
        JOIN a1_audio_note_map note_map
          ON note_map.audio_no = map.audio_no
        WHERE task.account_id <> account_id_value
           OR task.source_status <> 'HAS_SOURCE'
           OR task.source_note_id <> map.note_id
           OR note.source_type <> 'AUDIO'
           OR note.audio_source_id <> note_map.audio_source_id
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Task provenance validation failed';
    END IF;

    -- Fixture title/status must be preserved exactly.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_task_map map
        JOIN a1_audio_fixtures fixture
          ON fixture.audio_no = map.audio_no
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.title IS DISTINCT FROM fixture.task_title
           OR task.status IS DISTINCT FROM fixture.task_status
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Task fixture validation failed';
    END IF;

    -- 4 designated Audio fixtures must remain Note-only.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_fixtures fixture
        LEFT JOIN a1_audio_task_map map
          ON map.audio_no = fixture.audio_no
        WHERE (
            fixture.task_title IS NULL
            OR btrim(fixture.task_title) = ''
        )
        AND map.task_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Note-only fixture unexpectedly created a Task';
    END IF;

    IF (
        SELECT count(*)
        FROM a1_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'NOT_STARTED'
    ) <> 5 THEN
        RAISE EXCEPTION
            'A1 Audio NOT_STARTED Task count mismatch';
    END IF;

    IF (
        SELECT count(*)
        FROM a1_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'IN_PROGRESS'
    ) <> 3 THEN
        RAISE EXCEPTION
            'A1 Audio IN_PROGRESS Task count mismatch';
    END IF;

    IF (
        SELECT count(*)
        FROM a1_audio_task_map map
        JOIN tasks task
          ON task.id = map.task_id
        WHERE task.status = 'COMPLETED'
    ) <> 1 THEN
        RAISE EXCEPTION
            'A1 Audio COMPLETED Task count mismatch';
    END IF;

    -- Validate deadline semantics against REFERENCE_DATE.
    IF EXISTS (
        SELECT 1
        FROM a1_audio_task_map map
        JOIN a1_audio_fixtures fixture
          ON fixture.audio_no = map.audio_no
        JOIN tasks task
          ON task.id = map.task_id
        WHERE
            (
                fixture.deadline_class = 'NO_DEADLINE'
                AND task.deadline IS NOT NULL
            )
            OR (
                fixture.deadline_class = 'TODAY'
                AND task.deadline IS DISTINCT FROM reference_date_value
            )
            OR (
                fixture.deadline_class = 'OVERDUE'
                AND (
                    task.deadline IS NULL
                    OR task.deadline >= reference_date_value
                )
            )
            OR (
                fixture.deadline_class = 'UPCOMING'
                AND (
                    task.deadline IS NULL
                    OR task.deadline <= reference_date_value
                )
            )
    ) THEN
        RAISE EXCEPTION
            'A1 Audio Task deadline validation failed';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A1 V2 Image Organization
-- ---------------------------------------------------------------------------

-- Categories do not exist yet for A1. Create exactly the categories used by
-- the deterministic Image fixtures.
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
    lower(fixture.category_name),
    config.reference_instant - interval '30 days',
    config.reference_instant - interval '30 days'
FROM (
    SELECT DISTINCT category_name
    FROM a1_image_fixtures
) fixture
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE lower(account.email) = 'demo@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

-- Reuse existing A1 Tags by normalized name. Only add Image-specific Tags
-- that do not already exist.
WITH image_tag_names AS (
    SELECT DISTINCT
        jsonb_array_elements_text(
            fixture.tags_json::jsonb
        ) AS tag_name
    FROM a1_image_fixtures fixture
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
    image_tag.tag_name,
    lower(image_tag.tag_name),
    config.reference_instant - interval '29 days',
    config.reference_instant - interval '29 days'
FROM image_tag_names image_tag
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE lower(account.email) = 'demo@lifelab.local'
ON CONFLICT (account_id, normalized_name) DO NOTHING;

-- Apply fixture Category to every Image Note.
UPDATE notes note
SET
    category_id = category.id,
    updated_at = GREATEST(
        note.updated_at,
        note.created_at + interval '1 hour'
    )
FROM a1_image_note_map note_map
JOIN a1_image_fixtures fixture
  ON fixture.image_no = note_map.image_no
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN categories category
  ON category.account_id = account.id
 AND category.normalized_name = lower(fixture.category_name)
WHERE note.id = note_map.note_id
  AND note.account_id = account.id;

-- Image Task inherits the Category of its source Image fixture.
UPDATE tasks task
SET
    category_id = category.id,
    updated_at = GREATEST(
        task.updated_at,
        task.created_at + interval '1 hour'
    )
FROM a1_image_task_map task_map
JOIN a1_image_fixtures fixture
  ON fixture.image_no = task_map.image_no
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN categories category
  ON category.account_id = account.id
 AND category.normalized_name = lower(fixture.category_name)
WHERE task.id = task_map.task_id
  AND task.account_id = account.id;

-- Attach every fixture Tag to its Image Note.
INSERT INTO note_tags (
    note_id,
    tag_id
)
SELECT
    note_map.note_id,
    tag.id
FROM a1_image_fixtures fixture
JOIN a1_image_note_map note_map
  ON note_map.image_no = fixture.image_no
CROSS JOIN LATERAL
    jsonb_array_elements_text(
        fixture.tags_json::jsonb
    ) fixture_tag(tag_name)
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN tags tag
  ON tag.account_id = account.id
 AND tag.normalized_name = lower(fixture_tag.tag_name)
ON CONFLICT DO NOTHING;

-- A linked Image Task receives the same Tags as its source Image Note.
INSERT INTO task_tags (
    task_id,
    tag_id
)
SELECT
    task_map.task_id,
    tag.id
FROM a1_image_fixtures fixture
JOIN a1_image_task_map task_map
  ON task_map.image_no = fixture.image_no
CROSS JOIN LATERAL
    jsonb_array_elements_text(
        fixture.tags_json::jsonb
    ) fixture_tag(tag_name)
JOIN accounts account
  ON lower(account.email) = 'demo@lifelab.local'
JOIN tags tag
  ON tag.account_id = account.id
 AND tag.normalized_name = lower(fixture_tag.tag_name)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id
    INTO STRICT account_id_value
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local';

    -- All five fixture Categories must resolve for this account.
    IF (
        SELECT count(*)
        FROM categories
        WHERE account_id = account_id_value
          AND normalized_name IN (
              SELECT DISTINCT lower(category_name)
              FROM a1_image_fixtures
          )
    ) <> (
        SELECT count(DISTINCT lower(category_name))
        FROM a1_image_fixtures
    ) THEN
        RAISE EXCEPTION
            'A1 Image Category resolution failed';
    END IF;

    -- Every Image Note must now have a Category.
    IF EXISTS (
        SELECT 1
        FROM a1_image_note_map map
        JOIN notes note ON note.id = map.note_id
        WHERE note.category_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Image Note Category assignment failed';
    END IF;

    -- Every linked Image Task must now have a Category.
    IF EXISTS (
        SELECT 1
        FROM a1_image_task_map map
        JOIN tasks task ON task.id = map.task_id
        WHERE task.category_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'A1 Image Task Category assignment failed';
    END IF;

    -- Each Image Note must have exactly the number of Tags declared by its
    -- fixture.
    IF EXISTS (
        SELECT 1
        FROM a1_image_fixtures fixture
        JOIN a1_image_note_map map
          ON map.image_no = fixture.image_no
        LEFT JOIN note_tags note_tag
          ON note_tag.note_id = map.note_id
        GROUP BY
            fixture.image_no,
            fixture.tags_json
        HAVING count(note_tag.tag_id) <>
            jsonb_array_length(fixture.tags_json::jsonb)
    ) THEN
        RAISE EXCEPTION
            'A1 Image Note Tag assignment failed';
    END IF;

    -- Each linked Image Task must inherit exactly its fixture Tags.
    IF EXISTS (
        SELECT 1
        FROM a1_image_fixtures fixture
        JOIN a1_image_task_map map
          ON map.image_no = fixture.image_no
        LEFT JOIN task_tags task_tag
          ON task_tag.task_id = map.task_id
        GROUP BY
            fixture.image_no,
            fixture.tags_json
        HAVING count(task_tag.tag_id) <>
            jsonb_array_length(fixture.tags_json::jsonb)
    ) THEN
        RAISE EXCEPTION
            'A1 Image Task Tag assignment failed';
    END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- A1 V2 Audio Organization
-- ---------------------------------------------------------------------------

-- Audio fixtures intentionally reuse the taxonomy already established for A1.
-- Do not create new Categories or Tags here.

DO $$
DECLARE
        account_id_value BIGINT;
BEGIN
        SELECT id
        INTO STRICT account_id_value
        FROM accounts
        WHERE lower(email) = 'demo@lifelab.local';

        -- Every requested Audio Category must already exist.
        IF EXISTS (
                SELECT 1
                FROM (
                        SELECT DISTINCT category_name
                        FROM a1_audio_fixtures
                ) fixture
                LEFT JOIN categories category
                    ON category.account_id = account_id_value
                 AND category.normalized_name = lower(fixture.category_name)
                WHERE category.id IS NULL
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio fixture requires a Category that does not already exist';
        END IF;

        -- Every requested Audio Tag must already exist.
        IF EXISTS (
                SELECT 1
                FROM a1_audio_fixtures fixture
                CROSS JOIN LATERAL
                        jsonb_array_elements_text(
                                fixture.tags_json::jsonb
                        ) fixture_tag(tag_name)
                LEFT JOIN tags tag
                    ON tag.account_id = account_id_value
                 AND tag.normalized_name = lower(fixture_tag.tag_name)
                WHERE tag.id IS NULL
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio fixture requires a Tag that does not already exist';
        END IF;

        -- Audio must not expand the locked A1 taxonomy.
        IF (
                SELECT count(*)
                FROM categories
                WHERE account_id = account_id_value
        ) <> 5 THEN
                RAISE EXCEPTION
                        'A1 Category count changed unexpectedly: expected 5';
        END IF;

        IF (
                SELECT count(*)
                FROM tags
                WHERE account_id = account_id_value
        ) <> 38 THEN
                RAISE EXCEPTION
                        'A1 Tag count changed unexpectedly: expected 38';
        END IF;
END
$$;

-- Each Audio Note inherits the Category declared by its fixture.
UPDATE notes note
SET
        category_id = category.id,
        updated_at = GREATEST(
                note.updated_at,
                note.created_at + interval '1 hour'
        )
FROM a1_audio_note_map note_map
JOIN a1_audio_fixtures fixture
    ON fixture.audio_no = note_map.audio_no
JOIN accounts account
    ON lower(account.email) = 'demo@lifelab.local'
JOIN categories category
    ON category.account_id = account.id
 AND category.normalized_name = lower(fixture.category_name)
WHERE note.id = note_map.note_id
    AND note.account_id = account.id;

-- Each Audio-linked Task inherits the Category of its source Audio fixture.
UPDATE tasks task
SET
        category_id = category.id,
        updated_at = GREATEST(
                task.updated_at,
                task.created_at + interval '1 hour'
        )
FROM a1_audio_task_map task_map
JOIN a1_audio_fixtures fixture
    ON fixture.audio_no = task_map.audio_no
JOIN accounts account
    ON lower(account.email) = 'demo@lifelab.local'
JOIN categories category
    ON category.account_id = account.id
 AND category.normalized_name = lower(fixture.category_name)
WHERE task.id = task_map.task_id
    AND task.account_id = account.id;

-- Attach every fixture Tag to its Audio Note.
INSERT INTO note_tags (
        note_id,
        tag_id
)
SELECT
        note_map.note_id,
        tag.id
FROM a1_audio_fixtures fixture
JOIN a1_audio_note_map note_map
    ON note_map.audio_no = fixture.audio_no
CROSS JOIN LATERAL
        jsonb_array_elements_text(
                fixture.tags_json::jsonb
        ) fixture_tag(tag_name)
JOIN accounts account
    ON lower(account.email) = 'demo@lifelab.local'
JOIN tags tag
    ON tag.account_id = account.id
 AND tag.normalized_name = lower(fixture_tag.tag_name)
ON CONFLICT DO NOTHING;

-- Audio-linked Tasks receive the same fixture Tags as their source Notes.
INSERT INTO task_tags (
        task_id,
        tag_id
)
SELECT
        task_map.task_id,
        tag.id
FROM a1_audio_fixtures fixture
JOIN a1_audio_task_map task_map
    ON task_map.audio_no = fixture.audio_no
CROSS JOIN LATERAL
        jsonb_array_elements_text(
                fixture.tags_json::jsonb
        ) fixture_tag(tag_name)
JOIN accounts account
    ON lower(account.email) = 'demo@lifelab.local'
JOIN tags tag
    ON tag.account_id = account.id
 AND tag.normalized_name = lower(fixture_tag.tag_name)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
        account_id_value BIGINT;
BEGIN
        SELECT id
        INTO STRICT account_id_value
        FROM accounts
        WHERE lower(email) = 'demo@lifelab.local';

        -- All 13 Audio Notes must have their fixture Category.
        IF EXISTS (
                SELECT 1
                FROM a1_audio_fixtures fixture
                JOIN a1_audio_note_map note_map
                    ON note_map.audio_no = fixture.audio_no
                JOIN notes note
                    ON note.id = note_map.note_id
                LEFT JOIN categories category
                    ON category.id = note.category_id
                WHERE note.category_id IS NULL
                     OR category.account_id <> account_id_value
                     OR category.normalized_name
                                IS DISTINCT FROM lower(fixture.category_name)
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio Note Category validation failed';
        END IF;

        -- All 9 Audio Tasks must have their fixture Category.
        IF EXISTS (
                SELECT 1
                FROM a1_audio_fixtures fixture
                JOIN a1_audio_task_map task_map
                    ON task_map.audio_no = fixture.audio_no
                JOIN tasks task
                    ON task.id = task_map.task_id
                LEFT JOIN categories category
                    ON category.id = task.category_id
                WHERE task.category_id IS NULL
                     OR category.account_id <> account_id_value
                     OR category.normalized_name
                                IS DISTINCT FROM lower(fixture.category_name)
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio Task Category validation failed';
        END IF;

        IF (
                SELECT count(*)
                FROM a1_audio_note_map map
                JOIN notes note
                    ON note.id = map.note_id
                WHERE note.category_id IS NOT NULL
        ) <> 13 THEN
                RAISE EXCEPTION
                        'A1 categorized Audio Note count mismatch: expected 13';
        END IF;

        IF (
                SELECT count(*)
                FROM a1_audio_task_map map
                JOIN tasks task
                    ON task.id = map.task_id
                WHERE task.category_id IS NOT NULL
        ) <> 9 THEN
                RAISE EXCEPTION
                        'A1 categorized Audio Task count mismatch: expected 9';
        END IF;

        IF (
                SELECT count(*)
                FROM a1_audio_note_map map
                JOIN note_tags note_tag
                    ON note_tag.note_id = map.note_id
        ) <> 26 THEN
                RAISE EXCEPTION
                        'A1 Audio Note-tag link count mismatch: expected 26';
        END IF;

        IF (
                SELECT count(*)
                FROM a1_audio_task_map map
                JOIN task_tags task_tag
                    ON task_tag.task_id = map.task_id
        ) <> 22 THEN
                RAISE EXCEPTION
                        'A1 Audio Task-tag link count mismatch: expected 22';
        END IF;

        -- Each Audio Note must receive exactly the Tags declared by that fixture.
        IF EXISTS (
                SELECT
                        fixture.audio_no
                FROM a1_audio_fixtures fixture
                JOIN a1_audio_note_map note_map
                    ON note_map.audio_no = fixture.audio_no
                LEFT JOIN note_tags note_tag
                    ON note_tag.note_id = note_map.note_id
                GROUP BY
                        fixture.audio_no,
                        fixture.tags_json
                HAVING count(note_tag.tag_id)
                        <> jsonb_array_length(
                                fixture.tags_json::jsonb
                        )
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio Note fixture Tag count validation failed';
        END IF;

        -- Every Task fixture must receive exactly its declared Tags.
        IF EXISTS (
                SELECT
                        fixture.audio_no
                FROM a1_audio_fixtures fixture
                JOIN a1_audio_task_map task_map
                    ON task_map.audio_no = fixture.audio_no
                LEFT JOIN task_tags task_tag
                    ON task_tag.task_id = task_map.task_id
                GROUP BY
                        fixture.audio_no,
                        fixture.tags_json
                HAVING count(task_tag.tag_id)
                        <> jsonb_array_length(
                                fixture.tags_json::jsonb
                        )
        ) THEN
                RAISE EXCEPTION
                        'A1 Audio Task fixture Tag count validation failed';
        END IF;
END
$$;

DO $$
DECLARE account_id_value BIGINT; ref TIMESTAMPTZ;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 SELECT reference_instant INTO ref FROM a1_config;
 UPDATE tasks t SET updated_at=GREATEST(t.updated_at,t.created_at+interval '2 days') FROM a1_task_map m WHERE m.task_id=t.id AND t.status='COMPLETED';
 IF (SELECT count(*) FROM notes WHERE account_id=account_id_value)<>123 OR (SELECT count(*) FROM tasks WHERE account_id=account_id_value)<>144 THEN RAISE EXCEPTION 'A1 semantic fixture counts failed'; END IF;
END $$;

DO $$
DECLARE account_id_value BIGINT;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 IF (SELECT count(*) FROM library_videos WHERE account_id=account_id_value)<>36 OR (SELECT count(*) FROM tags WHERE account_id=account_id_value)<>38 OR (SELECT count(*) FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id WHERE l.account_id=account_id_value)<>160 THEN RAISE EXCEPTION 'A1 preserved fixture counts failed'; END IF;
END $$;

COMMIT;

SELECT 'account' AS metric,count(*)::bigint AS value FROM accounts WHERE email='demo@lifelab.local'
UNION ALL SELECT 'library_videos',count(*) FROM library_videos l JOIN accounts a ON a.id=l.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'watch_sessions',count(*) FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id JOIN accounts a ON a.id=l.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'notes',count(*) FROM notes n JOIN accounts a ON a.id=n.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'tasks',count(*) FROM tasks t JOIN accounts a ON a.id=t.account_id WHERE a.email='demo@lifelab.local';
