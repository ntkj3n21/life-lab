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
DELETE FROM tags WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM library_videos WHERE account_id IN (SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local');
DELETE FROM accounts WHERE lower(email)='scale@lifelab.local';

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

-- Final lifecycle removes all historical Library rows; Notes and linked Tasks survive.
DELETE FROM library_videos l USING a2_library_map m,a2_snapshot_sources s
WHERE l.id=m.library_video_id AND m.fixture_key=s.fixture_key AND s.role='HISTORICAL';

COMMIT;
