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

-- Reset only the account identified by the locked A1 email. Shared source rows are retained.
DELETE FROM tasks
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM notes
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM tags
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM library_videos
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM accounts
WHERE lower(email) = 'demo@lifelab.local';

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

DO $$
DECLARE account_id_value BIGINT; ref TIMESTAMPTZ;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 SELECT reference_instant INTO ref FROM a1_config;
 UPDATE tasks t SET updated_at=GREATEST(t.updated_at,t.created_at+interval '2 days') FROM a1_task_map m WHERE m.task_id=t.id AND t.status='COMPLETED';
 IF (SELECT count(*) FROM notes WHERE account_id=account_id_value)<>96 OR (SELECT count(*) FROM tasks WHERE account_id=account_id_value)<>125 THEN RAISE EXCEPTION 'A1 semantic fixture counts failed'; END IF;
END $$;

DO $$
DECLARE account_id_value BIGINT;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 IF (SELECT count(*) FROM library_videos WHERE account_id=account_id_value)<>36 OR (SELECT count(*) FROM tags WHERE account_id=account_id_value)<>24 OR (SELECT count(*) FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id WHERE l.account_id=account_id_value)<>160 THEN RAISE EXCEPTION 'A1 preserved fixture counts failed'; END IF;
END $$;

COMMIT;

SELECT 'account' AS metric,count(*)::bigint AS value FROM accounts WHERE email='demo@lifelab.local'
UNION ALL SELECT 'library_videos',count(*) FROM library_videos l JOIN accounts a ON a.id=l.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'watch_sessions',count(*) FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id JOIN accounts a ON a.id=l.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'notes',count(*) FROM notes n JOIN accounts a ON a.id=n.account_id WHERE a.email='demo@lifelab.local'
UNION ALL SELECT 'tasks',count(*) FROM tasks t JOIN accounts a ON a.id=t.account_id WHERE a.email='demo@lifelab.local';
