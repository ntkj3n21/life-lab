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
DECLARE r RECORD; n BIGINT; created TIMESTAMPTZ; account_id_value BIGINT; temp_note BIGINT; source_id BIGINT;
BEGIN
 SELECT id INTO account_id_value FROM accounts WHERE email='demo@lifelab.local';
 FOR r IN SELECT * FROM a1_task_fixtures ORDER BY sequence_no LOOP
   IF r.source_status='HAS_SOURCE' THEN
     SELECT note_id,created_at INTO n,created FROM a1_note_map WHERE note_key=r.note_key;
   ELSIF r.source_status='SOURCE_MISSING' THEN
     SELECT youtube_source_id INTO source_id FROM a1_library_map WHERE video_no=6;
     SELECT reference_instant INTO created FROM a1_config;
     created := created - ((r.sequence_no % 140) + 30) * interval '1 day';
     INSERT INTO notes(account_id,youtube_source_id,content,timestamp_seconds,created_at,updated_at)
       VALUES(account_id_value,source_id,'Temporary source fixture for lifecycle validation',NULL,created,created) RETURNING id INTO temp_note;
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
      UPDATE tasks SET source_note_id=NULL, source_status='SOURCE_MISSING', updated_at=updated_at+interval '1 day' WHERE id=n;
      DELETE FROM notes WHERE id=temp_note;
   END IF;
 END LOOP;
END $$;

-- The SOURCE_MISSING rows above were created with no Note and therefore retain the
-- lifecycle result. Their task fixture records are deterministic and account-scoped.

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
