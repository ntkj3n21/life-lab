-- Read-only correctness snapshot. This is never used for response-time samples.
WITH demo AS (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local'),
     a1 AS (SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local'),
     a2 AS (SELECT id FROM accounts WHERE lower(email) = 'scale@lifelab.local'),
     organization_pair AS (
       SELECT n.category_id, nt.tag_id, c.name AS category_name, tg.name AS tag_name
       FROM notes n
       JOIN note_tags nt ON nt.note_id = n.id
       JOIN categories c ON c.id = n.category_id
       JOIN tags tg ON tg.id = nt.tag_id
       WHERE n.account_id = (SELECT id FROM demo)
         AND lower(n.content) LIKE '%checkpoint%'
         AND EXISTS (
           SELECT 1 FROM tasks task
           WHERE task.account_id = (SELECT id FROM demo)
             AND task.category_id = n.category_id
             AND task.status = 'NOT_STARTED'
             AND lower(task.title || ' ' || coalesce(task.description,'')) LIKE '%checkpoint%'
         )
       ORDER BY c.name, tg.name LIMIT 1
     ),
     chosen AS (
       SELECT organization_pair.category_id, organization_pair.tag_id,
              organization_pair.category_name, organization_pair.tag_name,
              (SELECT title FROM youtube_videos WHERE id =
                 (SELECT youtube_source_id FROM library_videos WHERE account_id = (SELECT id FROM demo)
                  ORDER BY id LIMIT 1)) AS video_query,
              (SELECT external_url FROM image_sources WHERE id =
                 (SELECT image_source_id FROM library_images WHERE account_id = (SELECT id FROM demo)
                  ORDER BY id LIMIT 1)) AS image_query,
              (SELECT external_url FROM audio_sources WHERE id =
                 (SELECT audio_source_id FROM library_audio WHERE account_id = (SELECT id FROM demo)
                  ORDER BY id LIMIT 1)) AS audio_query
       FROM organization_pair
     ),
     expected AS (
       SELECT json_build_object(
         'accountIds', json_build_object('demo', (SELECT id FROM demo), 'a1', (SELECT id FROM a1), 'a2', (SELECT id FROM a2)),
         'categoryId', chosen.category_id, 'tagId', chosen.tag_id,
         'categoryName', chosen.category_name, 'tagName', chosen.tag_name,
         'videoQuery', chosen.video_query, 'imageQuery', chosen.image_query, 'audioQuery', chosen.audio_query,
         'referenceDate', '2026-09-28',
         'localDate', (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
         'noteIds', (SELECT json_agg(id) FROM notes WHERE account_id = (SELECT id FROM demo)),
         'taskIds', (SELECT json_agg(id) FROM tasks WHERE account_id = (SELECT id FROM demo)),
         'a1NoteIds', (SELECT json_agg(id) FROM notes WHERE account_id = (SELECT id FROM a1)),
         'a1TaskIds', (SELECT json_agg(id) FROM tasks WHERE account_id = (SELECT id FROM a1)),
         'a2NoteIds', (SELECT json_agg(id) FROM notes WHERE account_id = (SELECT id FROM a2)),
         'a2TaskIds', (SELECT json_agg(id) FROM tasks WHERE account_id = (SELECT id FROM a2)),
         'videoIds', (SELECT json_agg(id) FROM library_videos WHERE account_id = (SELECT id FROM demo)),
         'imageIds', (SELECT json_agg(id) FROM library_images WHERE account_id = (SELECT id FROM demo)),
         'audioIds', (SELECT json_agg(id) FROM library_audio WHERE account_id = (SELECT id FROM demo)),
         'videoSearchIds', (SELECT json_agg(v.id) FROM library_videos v JOIN youtube_videos y ON y.id = v.youtube_source_id WHERE v.account_id = (SELECT id FROM demo) AND (lower(coalesce(y.title,'')) LIKE '%' || lower(chosen.video_query) || '%' OR lower(coalesce(y.channel_name,'')) LIKE '%' || lower(chosen.video_query) || '%')),
         'imageSearchIds', (SELECT json_agg(i.id) FROM library_images i JOIN image_sources s ON s.id = i.image_source_id WHERE i.account_id = (SELECT id FROM demo) AND lower(coalesce(s.external_url,'')) LIKE '%' || lower(chosen.image_query) || '%'),
         'audioSearchIds', (SELECT json_agg(a.id) FROM library_audio a JOIN audio_sources s ON s.id = a.audio_source_id WHERE a.account_id = (SELECT id FROM demo) AND lower(coalesce(s.external_url,'')) LIKE '%' || lower(chosen.audio_query) || '%'),
         'counts', json_build_object(
           'notes_plain', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo)),
           'notes_common', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND lower(content) LIKE '%checkpoint%'),
           'notes_medium', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND lower(content) LIKE '%tradeoff%'),
           'notes_rare', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND lower(content) LIKE '%quorum%'),
           'notes_none', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND lower(content) LIKE '%xyznomatch%'),
           'notes_category', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND category_id = chosen.category_id),
           'notes_tag', (SELECT count(DISTINCT n.id) FROM notes n JOIN note_tags nt ON nt.note_id = n.id WHERE n.account_id = (SELECT id FROM demo) AND nt.tag_id = chosen.tag_id),
           'notes_timestamp', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM demo) AND timestamp_seconds IS NOT NULL),
           'notes_combined', (SELECT count(DISTINCT n.id) FROM notes n JOIN note_tags nt ON nt.note_id = n.id WHERE n.account_id = (SELECT id FROM demo) AND lower(n.content) LIKE '%checkpoint%' AND n.category_id = chosen.category_id AND nt.tag_id = chosen.tag_id),
           'tasks_plain', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo)),
           'tasks_common', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND lower(title || ' ' || coalesce(description,'')) LIKE '%checkpoint%'),
           'tasks_medium', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND lower(title || ' ' || coalesce(description,'')) LIKE '%tradeoff%'),
           'tasks_rare', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND lower(title || ' ' || coalesce(description,'')) LIKE '%quorum%'),
           'tasks_none', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND lower(title || ' ' || coalesce(description,'')) LIKE '%xyznomatch%'),
           'tasks_status', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status = 'IN_PROGRESS'),
           'tasks_deadline', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND deadline BETWEEN '2026-09-21' AND '2026-09-27'),
           'tasks_category', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND category_id = chosen.category_id),
           'tasks_tag', (SELECT count(DISTINCT t.id) FROM tasks t JOIN task_tags tt ON tt.task_id = t.id WHERE t.account_id = (SELECT id FROM demo) AND tt.tag_id = chosen.tag_id),
           'tasks_source', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND source_status = 'SOURCE_MISSING'),
           'tasks_combined', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND lower(title || ' ' || coalesce(description,'')) LIKE '%checkpoint%' AND status = 'NOT_STARTED' AND category_id = chosen.category_id),
           'video_plain', (SELECT count(*) FROM library_videos WHERE account_id = (SELECT id FROM demo)),
           'video_search', (SELECT count(*) FROM library_videos v JOIN youtube_videos y ON y.id = v.youtube_source_id WHERE v.account_id = (SELECT id FROM demo) AND (lower(coalesce(y.title,'')) LIKE '%' || lower(chosen.video_query) || '%' OR lower(coalesce(y.channel_name,'')) LIKE '%' || lower(chosen.video_query) || '%')),
           'video_watched', (SELECT count(*) FROM library_videos v WHERE v.account_id = (SELECT id FROM demo) AND EXISTS (SELECT 1 FROM watch_sessions w WHERE w.library_video_id = v.id AND w.validity_status = 'VALID')),
           'image_plain', (SELECT count(*) FROM library_images WHERE account_id = (SELECT id FROM demo)),
           'image_search', (SELECT count(*) FROM library_images i JOIN image_sources s ON s.id = i.image_source_id WHERE i.account_id = (SELECT id FROM demo) AND lower(coalesce(s.external_url,'')) LIKE '%' || lower(chosen.image_query) || '%'),
           'audio_plain', (SELECT count(*) FROM library_audio WHERE account_id = (SELECT id FROM demo)),
           'audio_search', (SELECT count(*) FROM library_audio a JOIN audio_sources s ON s.id = a.audio_source_id WHERE a.account_id = (SELECT id FROM demo) AND lower(coalesce(s.external_url,'')) LIKE '%' || lower(chosen.audio_query) || '%'),
           'a1_notes', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM a1)),
           'a1_tasks', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM a1)),
           'a2_notes', (SELECT count(*) FROM notes WHERE account_id = (SELECT id FROM a2)),
           'a2_tasks', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM a2)),
           'plan_overdue', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status <> 'COMPLETED' AND deadline < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
           'plan_today', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status <> 'COMPLETED' AND deadline = (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
           'plan_upcoming', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status <> 'COMPLETED' AND deadline > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
           'plan_no_deadline', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status <> 'COMPLETED' AND deadline IS NULL),
           'plan_completed', (SELECT count(*) FROM tasks WHERE account_id = (SELECT id FROM demo) AND status = 'COMPLETED')
         )
       ) AS value FROM chosen
     )
SELECT value FROM expected;
