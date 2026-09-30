BEGIN;

CREATE TEMP TABLE demo_verify_config AS
SELECT :'reference_date'::date AS reference_date,
       :'note_count'::integer AS note_count,
       :'task_count'::integer AS task_count;

CREATE TEMP TABLE demo_metrics (metric text PRIMARY KEY, value bigint NOT NULL);

INSERT INTO demo_metrics
WITH account AS (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local'),
     note_links AS (
         SELECT note.id, count(link.tag_id) AS tag_count
         FROM notes note JOIN account ON account.id = note.account_id
         LEFT JOIN note_tags link ON link.note_id = note.id GROUP BY note.id
     ),
     task_links AS (
         SELECT task.id, count(link.tag_id) AS tag_count
         FROM tasks task JOIN account ON account.id = task.account_id
         LEFT JOIN task_tags link ON link.task_id = task.id GROUP BY task.id
     )
SELECT 'account_count', count(*) FROM account
UNION ALL SELECT 'notes', count(*) FROM notes note JOIN account ON account.id = note.account_id
UNION ALL SELECT 'tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id
UNION ALL SELECT 'categories', count(*) FROM categories category JOIN account ON account.id = category.account_id
UNION ALL SELECT 'tags', count(*) FROM tags tag JOIN account ON account.id = tag.account_id
UNION ALL SELECT 'video_notes', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'YOUTUBE'
UNION ALL SELECT 'distinct_note_content', count(DISTINCT note.content) FROM notes note JOIN account ON account.id = note.account_id
UNION ALL SELECT 'distinct_task_title', count(DISTINCT task.title) FROM tasks task JOIN account ON account.id = task.account_id
UNION ALL SELECT 'distinct_task_description', count(DISTINCT task.description) FROM tasks task JOIN account ON account.id = task.account_id
UNION ALL SELECT 'image_notes', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'IMAGE'
UNION ALL SELECT 'audio_notes', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'AUDIO'
UNION ALL SELECT 'video_timestamped', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'YOUTUBE' AND note.timestamp_seconds IS NOT NULL
UNION ALL SELECT 'video_without_timestamp', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'YOUTUBE' AND note.timestamp_seconds IS NULL
UNION ALL SELECT 'audio_timestamped', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'AUDIO' AND note.timestamp_seconds IS NOT NULL
UNION ALL SELECT 'audio_without_timestamp', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'AUDIO' AND note.timestamp_seconds IS NULL
UNION ALL SELECT 'image_timestamp_violations', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'IMAGE' AND note.timestamp_seconds IS NOT NULL
UNION ALL SELECT 'categorized_notes', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.category_id IS NOT NULL
UNION ALL SELECT 'uncategorized_notes', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.category_id IS NULL
UNION ALL SELECT 'untagged_notes', count(*) FROM note_links WHERE tag_count = 0
UNION ALL SELECT 'single_tag_notes', count(*) FROM note_links WHERE tag_count = 1
UNION ALL SELECT 'multi_tag_notes', count(*) FROM note_links WHERE tag_count > 1
UNION ALL SELECT 'independent_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.source_status = 'INDEPENDENT'
UNION ALL SELECT 'has_source_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.source_status = 'HAS_SOURCE'
UNION ALL SELECT 'source_missing_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.source_status = 'SOURCE_MISSING'
UNION ALL SELECT 'not_started_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.status = 'NOT_STARTED'
UNION ALL SELECT 'in_progress_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.status = 'IN_PROGRESS'
UNION ALL SELECT 'completed_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.status = 'COMPLETED'
UNION ALL SELECT 'categorized_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.category_id IS NOT NULL
UNION ALL SELECT 'uncategorized_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.category_id IS NULL
UNION ALL SELECT 'untagged_tasks', count(*) FROM task_links WHERE tag_count = 0
UNION ALL SELECT 'single_tag_tasks', count(*) FROM task_links WHERE tag_count = 1
UNION ALL SELECT 'multi_tag_tasks', count(*) FROM task_links WHERE tag_count > 1
UNION ALL SELECT 'overdue_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id CROSS JOIN demo_verify_config config WHERE task.status <> 'COMPLETED' AND task.deadline < config.reference_date
UNION ALL SELECT 'today_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id CROSS JOIN demo_verify_config config WHERE task.status <> 'COMPLETED' AND task.deadline = config.reference_date
UNION ALL SELECT 'upcoming_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id CROSS JOIN demo_verify_config config WHERE task.status <> 'COMPLETED' AND task.deadline > config.reference_date
UNION ALL SELECT 'no_deadline_tasks', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE task.status <> 'COMPLETED' AND task.deadline IS NULL
UNION ALL SELECT 'watch_sessions', count(*) FROM watch_sessions session JOIN library_videos library ON library.id = session.library_video_id JOIN account ON account.id = library.account_id
UNION ALL SELECT 'valid_watch_sessions', count(*) FROM watch_sessions session JOIN library_videos library ON library.id = session.library_video_id JOIN account ON account.id = library.account_id WHERE session.validity_status = 'VALID'
UNION ALL SELECT 'invalid_watch_sessions', count(*) FROM watch_sessions session JOIN library_videos library ON library.id = session.library_video_id JOIN account ON account.id = library.account_id WHERE session.validity_status = 'INVALID'
UNION ALL SELECT 'watch_invariant_violations', count(*) FROM watch_sessions session JOIN library_videos library ON library.id = session.library_video_id JOIN account ON account.id = library.account_id JOIN youtube_videos source ON source.id = library.youtube_source_id WHERE session.ended_at IS NULL OR session.started_at < library.added_at OR session.started_at > session.last_heartbeat_at OR session.last_heartbeat_at > session.ended_at OR session.watch_time_seconds > source.duration_seconds OR session.watch_time_seconds > extract(epoch FROM (session.ended_at - session.started_at)) OR (session.validity_status = 'VALID' AND session.watch_time_seconds < LEAST(30, ((source.duration_seconds::bigint * 4 + 4) / 5)::integer)) OR (session.validity_status = 'INVALID' AND session.watch_time_seconds >= LEAST(30, ((source.duration_seconds::bigint * 4 + 4) / 5)::integer)) OR session.validity_status NOT IN ('VALID', 'INVALID')
UNION ALL SELECT 'video_library', count(*) FROM library_videos library JOIN account ON account.id = library.account_id
UNION ALL SELECT 'image_library', count(*) FROM library_images library JOIN account ON account.id = library.account_id
UNION ALL SELECT 'audio_library', count(*) FROM library_audio library JOIN account ON account.id = library.account_id
UNION ALL SELECT 'a1_image_reuse', count(*) FROM library_images library JOIN account ON account.id = library.account_id JOIN image_sources source ON source.id = library.image_source_id JOIN library_images original ON original.image_source_id = source.id JOIN accounts owner ON owner.id = original.account_id WHERE lower(owner.email) = 'demo@lifelab.local'
UNION ALL SELECT 'a2_image_reuse', count(*) FROM library_images library JOIN account ON account.id = library.account_id JOIN image_sources source ON source.id = library.image_source_id JOIN library_images original ON original.image_source_id = source.id JOIN accounts owner ON owner.id = original.account_id WHERE lower(owner.email) = 'scale@lifelab.local'
UNION ALL SELECT 'new_image_sources', count(*) FROM library_images library JOIN account ON account.id = library.account_id JOIN image_sources source ON source.id = library.image_source_id JOIN demo_image_fixtures fixture ON fixture.url = source.external_url
UNION ALL SELECT 'a1_audio_reuse', count(*) FROM library_audio library JOIN account ON account.id = library.account_id JOIN audio_sources source ON source.id = library.audio_source_id JOIN library_audio original ON original.audio_source_id = source.id JOIN accounts owner ON owner.id = original.account_id WHERE lower(owner.email) = 'demo@lifelab.local'
UNION ALL SELECT 'a2_audio_reuse', count(*) FROM library_audio library JOIN account ON account.id = library.account_id JOIN audio_sources source ON source.id = library.audio_source_id JOIN library_audio original ON original.audio_source_id = source.id JOIN accounts owner ON owner.id = original.account_id WHERE lower(owner.email) = 'scale@lifelab.local'
UNION ALL SELECT 'new_audio_sources', count(*) FROM library_audio library JOIN account ON account.id = library.account_id JOIN audio_sources source ON source.id = library.audio_source_id JOIN demo_audio_fixtures fixture ON fixture.url = source.external_url
UNION ALL SELECT 'audio_timestamp_zero', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'AUDIO' AND note.timestamp_seconds = 0
UNION ALL SELECT 'audio_timestamp_positive', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE note.source_type = 'AUDIO' AND note.timestamp_seconds > 0
UNION ALL SELECT 'video_tag_links', count(*) FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id JOIN account ON account.id = library.account_id
UNION ALL SELECT 'image_tag_links', count(*) FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id JOIN account ON account.id = library.account_id
UNION ALL SELECT 'audio_tag_links', count(*) FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id JOIN account ON account.id = library.account_id
UNION ALL SELECT 'video_tagged', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE EXISTS (SELECT 1 FROM library_video_tags link WHERE link.library_video_id = library.id)
UNION ALL SELECT 'image_tagged', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE EXISTS (SELECT 1 FROM library_image_tags link WHERE link.library_image_id = library.id)
UNION ALL SELECT 'audio_tagged', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE EXISTS (SELECT 1 FROM library_audio_tags link WHERE link.library_audio_id = library.id)
UNION ALL SELECT 'video_untagged', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE NOT EXISTS (SELECT 1 FROM library_video_tags link WHERE link.library_video_id = library.id)
UNION ALL SELECT 'image_untagged', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE NOT EXISTS (SELECT 1 FROM library_image_tags link WHERE link.library_image_id = library.id)
UNION ALL SELECT 'audio_untagged', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE NOT EXISTS (SELECT 1 FROM library_audio_tags link WHERE link.library_audio_id = library.id)
UNION ALL SELECT 'video_multi_tag', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE (SELECT count(*) FROM library_video_tags link WHERE link.library_video_id = library.id) > 1
UNION ALL SELECT 'image_multi_tag', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE (SELECT count(*) FROM library_image_tags link WHERE link.library_image_id = library.id) > 1
UNION ALL SELECT 'audio_multi_tag', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE (SELECT count(*) FROM library_audio_tags link WHERE link.library_audio_id = library.id) > 1
UNION ALL SELECT 'video_custom_title', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE library.custom_title IS NOT NULL
UNION ALL SELECT 'image_custom_title', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE library.title IS NOT NULL
UNION ALL SELECT 'audio_custom_title', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE library.title IS NOT NULL
UNION ALL SELECT 'video_description', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'image_description', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'audio_description', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'video_fallback_title', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE library.custom_title IS NULL
UNION ALL SELECT 'image_fallback_title', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE library.title IS NULL
UNION ALL SELECT 'audio_fallback_title', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE library.title IS NULL
UNION ALL SELECT 'video_no_description', count(*) FROM library_videos library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NULL
UNION ALL SELECT 'image_no_description', count(*) FROM library_images library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NULL
UNION ALL SELECT 'audio_no_description', count(*) FROM library_audio library JOIN account ON account.id = library.account_id WHERE library.personal_description IS NULL
UNION ALL SELECT 'tag_normalized_duplicates', count(*) FROM (SELECT lower(normalized_name) FROM tags tag JOIN account ON account.id = tag.account_id GROUP BY lower(normalized_name) HAVING count(*) > 1) duplicates
UNION ALL SELECT 'tags_used', count(DISTINCT tag_id) FROM (
    SELECT link.tag_id FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id JOIN account ON account.id = library.account_id
    UNION ALL SELECT link.tag_id FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id JOIN account ON account.id = library.account_id
    UNION ALL SELECT link.tag_id FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id JOIN account ON account.id = library.account_id
    UNION ALL SELECT link.tag_id FROM note_tags link JOIN notes note ON note.id = link.note_id JOIN account ON account.id = note.account_id
    UNION ALL SELECT link.tag_id FROM task_tags link JOIN tasks task ON task.id = link.task_id JOIN account ON account.id = task.account_id
) used
UNION ALL SELECT 'cross_media_tags', count(*) FROM (
    SELECT tag_id FROM (
        SELECT DISTINCT link.tag_id, 'V' AS medium FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id JOIN account ON account.id = library.account_id
        UNION ALL SELECT DISTINCT link.tag_id, 'I' FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id JOIN account ON account.id = library.account_id
        UNION ALL SELECT DISTINCT link.tag_id, 'A' FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id JOIN account ON account.id = library.account_id
    ) usage GROUP BY tag_id HAVING count(DISTINCT medium) >= 2
) shared
UNION ALL SELECT 'all_media_tags', count(*) FROM (
    SELECT tag_id FROM (
        SELECT DISTINCT link.tag_id, 'V' AS medium FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id JOIN account ON account.id = library.account_id
        UNION ALL SELECT DISTINCT link.tag_id, 'I' FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id JOIN account ON account.id = library.account_id
        UNION ALL SELECT DISTINCT link.tag_id, 'A' FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id JOIN account ON account.id = library.account_id
    ) usage GROUP BY tag_id HAVING count(DISTINCT medium) = 3
) shared
UNION ALL SELECT 'note_common_search', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE lower(note.content) LIKE '%study log%'
UNION ALL SELECT 'note_medium_search', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE lower(note.content) LIKE '%research%'
UNION ALL SELECT 'note_rare_search', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE lower(note.content) LIKE '%postgresql internal architecture%'
UNION ALL SELECT 'note_no_match_search', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE lower(note.content) LIKE '%xyznomatch%'
UNION ALL SELECT 'task_common_search', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE lower(task.title || ' ' || coalesce(task.description, '')) LIKE '%review%'
UNION ALL SELECT 'task_medium_search', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE lower(task.title || ' ' || coalesce(task.description, '')) LIKE '%research%'
UNION ALL SELECT 'task_rare_search', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE lower(task.title || ' ' || coalesce(task.description, '')) LIKE '%postgresql internal architecture%'
UNION ALL SELECT 'task_no_match_search', count(*) FROM tasks task JOIN account ON account.id = task.account_id WHERE lower(task.title || ' ' || coalesce(task.description, '')) LIKE '%xyznomatch%'
UNION ALL SELECT 'source_shape_violations', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE NOT (
    (note.source_type = 'YOUTUBE' AND note.youtube_source_id IS NOT NULL AND note.image_source_id IS NULL AND note.audio_source_id IS NULL)
    OR (note.source_type = 'IMAGE' AND note.youtube_source_id IS NULL AND note.image_source_id IS NOT NULL AND note.audio_source_id IS NULL AND note.timestamp_seconds IS NULL)
    OR (note.source_type = 'AUDIO' AND note.youtube_source_id IS NULL AND note.image_source_id IS NULL AND note.audio_source_id IS NOT NULL))
UNION ALL SELECT 'source_membership_violations', count(*) FROM notes note JOIN account ON account.id = note.account_id WHERE NOT (
    (note.source_type = 'YOUTUBE' AND EXISTS (SELECT 1 FROM library_videos library WHERE library.account_id = account.id AND library.youtube_source_id = note.youtube_source_id))
    OR (note.source_type = 'IMAGE' AND EXISTS (SELECT 1 FROM library_images library WHERE library.account_id = account.id AND library.image_source_id = note.image_source_id))
    OR (note.source_type = 'AUDIO' AND EXISTS (SELECT 1 FROM library_audio library WHERE library.account_id = account.id AND library.audio_source_id = note.audio_source_id)))
UNION ALL SELECT 'task_source_violations', count(*) FROM tasks task JOIN account ON account.id = task.account_id LEFT JOIN notes note ON note.id = task.source_note_id WHERE NOT (
    (task.source_status = 'HAS_SOURCE' AND note.id IS NOT NULL AND note.account_id = account.id AND note.created_at <= task.created_at)
    OR (task.source_status IN ('INDEPENDENT', 'SOURCE_MISSING') AND task.source_note_id IS NULL))
UNION ALL SELECT 'organization_ownership_violations', count(*) FROM (
    SELECT 1 FROM notes note JOIN account ON account.id = note.account_id JOIN categories category ON category.id = note.category_id WHERE category.account_id <> account.id
    UNION ALL SELECT 1 FROM tasks task JOIN account ON account.id = task.account_id JOIN categories category ON category.id = task.category_id WHERE category.account_id <> account.id
    UNION ALL SELECT 1 FROM note_tags link JOIN notes note ON note.id = link.note_id JOIN account ON account.id = note.account_id JOIN tags tag ON tag.id = link.tag_id WHERE tag.account_id <> account.id
    UNION ALL SELECT 1 FROM task_tags link JOIN tasks task ON task.id = link.task_id JOIN account ON account.id = task.account_id JOIN tags tag ON tag.id = link.tag_id WHERE tag.account_id <> account.id
    UNION ALL SELECT 1 FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id JOIN account ON account.id = library.account_id JOIN tags tag ON tag.id = link.tag_id WHERE tag.account_id <> account.id
    UNION ALL SELECT 1 FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id JOIN account ON account.id = library.account_id JOIN tags tag ON tag.id = link.tag_id WHERE tag.account_id <> account.id
    UNION ALL SELECT 1 FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id JOIN account ON account.id = library.account_id JOIN tags tag ON tag.id = link.tag_id WHERE tag.account_id <> account.id
) violations;

INSERT INTO demo_metrics
WITH account AS (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local'),
visible_media AS (
    SELECT coalesce(library.custom_title, source.title) AS title,
           library.personal_description AS description
    FROM library_videos library JOIN account ON account.id = library.account_id
    JOIN youtube_videos source ON source.id = library.youtube_source_id
    UNION ALL
    SELECT coalesce(library.title, source.original_filename,
                    regexp_replace(source.external_url, '^.*/', '')),
           library.personal_description
    FROM library_images library JOIN account ON account.id = library.account_id
    JOIN image_sources source ON source.id = library.image_source_id
    UNION ALL
    SELECT coalesce(library.title, source.original_filename,
                    regexp_replace(source.external_url, '^.*/', '')),
           library.personal_description
    FROM library_audio library JOIN account ON account.id = library.account_id
    JOIN audio_sources source ON source.id = library.audio_source_id
), queries(term) AS (
    VALUES ('do an'), ('doi chieu'), ('spring'), ('database'),
           ('english'), ('listening'), ('architecture'), ('xyznomatch')
), results AS (
    SELECT term, count(*) AS value FROM queries CROSS JOIN visible_media
    WHERE lifelab_search_normalize(coalesce(title, '') || ' ' ||
                                   coalesce(description, '')) LIKE '%' || term || '%'
    GROUP BY term
)
SELECT 'search_' || replace(term, ' ', '_'), coalesce(value, 0)
FROM queries LEFT JOIN results USING (term);

INSERT INTO demo_metrics
WITH account AS (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local'),
story_result AS (
    SELECT story.story_key,
           EXISTS (
               SELECT 1 FROM notes note JOIN account ON account.id = note.account_id
               JOIN tasks task ON task.source_note_id = note.id AND task.account_id = account.id
               LEFT JOIN youtube_videos video ON video.id = note.youtube_source_id
               LEFT JOIN image_sources image ON image.id = note.image_source_id
               LEFT JOIN audio_sources audio ON audio.id = note.audio_source_id
               LEFT JOIN categories note_category ON note_category.id = note.category_id
               LEFT JOIN categories task_category ON task_category.id = task.category_id
               WHERE note.source_type = story.source_type
                 AND coalesce(video.youtube_video_id, image.storage_key, image.external_url,
                              audio.storage_key, audio.external_url) = story.source_identity
                 AND note.content = story.note
                 AND note.timestamp_seconds IS NOT DISTINCT FROM story.timestamp_seconds
                 AND note_category.name = story.category_name
                 AND task.title = story.task_title
                 AND task.status = story.task_status
                 AND task.source_status = 'HAS_SOURCE'
                 AND task_category.name = story.category_name
                 AND ARRAY(SELECT tag.name::text FROM note_tags link JOIN tags tag ON tag.id = link.tag_id
                           WHERE link.note_id = note.id ORDER BY tag.name)
                     = ARRAY(SELECT name FROM unnest(story.tag_names) AS label(name) ORDER BY name)
                 AND ARRAY(SELECT tag.name::text FROM task_tags link JOIN tags tag ON tag.id = link.tag_id
                           WHERE link.task_id = task.id ORDER BY tag.name)
                     = ARRAY(SELECT name FROM unnest(story.tag_names) AS label(name) ORDER BY name)
           ) AS valid
    FROM demo_story_fixtures story
), story_tasks AS (
    SELECT story.story_key, task.status, task.deadline,
           CASE WHEN task.status = 'COMPLETED' THEN 'COMPLETED'
                WHEN task.deadline < config.reference_date THEN 'OVERDUE'
                WHEN task.deadline = config.reference_date THEN 'TODAY'
                WHEN task.deadline > config.reference_date THEN 'UPCOMING'
                ELSE 'NO_DEADLINE' END AS plan_group
    FROM demo_story_fixtures story JOIN tasks task ON task.title = story.task_title
    JOIN account ON account.id = task.account_id CROSS JOIN demo_verify_config config
)
SELECT 'showcase_stories', count(*) FROM demo_story_fixtures
UNION ALL SELECT 'showcase_video', count(*) FROM demo_story_fixtures WHERE source_type = 'YOUTUBE'
UNION ALL SELECT 'showcase_image', count(*) FROM demo_story_fixtures WHERE source_type = 'IMAGE'
UNION ALL SELECT 'showcase_audio', count(*) FROM demo_story_fixtures WHERE source_type = 'AUDIO'
UNION ALL SELECT 'showcase_valid', count(*) FROM story_result WHERE valid
UNION ALL SELECT 'showcase_invalid', count(*) FROM story_result WHERE NOT valid
UNION ALL SELECT 'showcase_today', count(*) FROM story_tasks WHERE plan_group = 'TODAY'
UNION ALL SELECT 'showcase_overdue', count(*) FROM story_tasks WHERE plan_group = 'OVERDUE'
UNION ALL SELECT 'showcase_upcoming', count(*) FROM story_tasks WHERE plan_group = 'UPCOMING'
UNION ALL SELECT 'showcase_no_deadline', count(*) FROM story_tasks WHERE plan_group = 'NO_DEADLINE'
UNION ALL SELECT 'showcase_completed', count(*) FROM story_tasks WHERE plan_group = 'COMPLETED';

INSERT INTO demo_metrics
WITH account AS (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local')
SELECT 'orphan_media_tag_links', count(*) FROM (
    SELECT 1 FROM library_video_tags link
    LEFT JOIN library_videos library ON library.id = link.library_video_id
    LEFT JOIN tags tag ON tag.id = link.tag_id
    WHERE library.id IS NULL OR tag.id IS NULL OR
          (library.account_id IN (SELECT id FROM account) AND tag.account_id <> library.account_id)
    UNION ALL SELECT 1 FROM library_image_tags link
    LEFT JOIN library_images library ON library.id = link.library_image_id
    LEFT JOIN tags tag ON tag.id = link.tag_id
    WHERE library.id IS NULL OR tag.id IS NULL OR
          (library.account_id IN (SELECT id FROM account) AND tag.account_id <> library.account_id)
    UNION ALL SELECT 1 FROM library_audio_tags link
    LEFT JOIN library_audio library ON library.id = link.library_audio_id
    LEFT JOIN tags tag ON tag.id = link.tag_id
    WHERE library.id IS NULL OR tag.id IS NULL OR
          (library.account_id IN (SELECT id FROM account) AND tag.account_id <> library.account_id)
) violations;

DO $$
DECLARE
    config record;
    failures text;
BEGIN
    SELECT * INTO config FROM demo_verify_config;
    SELECT string_agg(metric || '=' || value, ', ' ORDER BY metric) INTO failures
    FROM demo_metrics
    WHERE (metric = 'account_count' AND value <> 1)
       OR (metric = 'notes' AND value <> config.note_count)
       OR (metric = 'tasks' AND value <> config.task_count)
       OR (metric = 'categories' AND value <> 10)
       OR (metric = 'tags' AND value <> 56)
       OR (metric = 'video_library' AND value <> 100)
       OR (metric = 'image_library' AND value <> 50)
       OR (metric = 'audio_library' AND value <> 30)
       OR (metric = 'a1_image_reuse' AND value <> 14)
       OR (metric = 'a2_image_reuse' AND value <> 20)
       OR (metric = 'new_image_sources' AND value <> 16)
       OR (metric = 'a1_audio_reuse' AND value <> 13)
       OR (metric = 'a2_audio_reuse' AND value <> 8)
       OR (metric = 'new_audio_sources' AND value <> 9)
       OR (metric = 'video_notes' AND value <> 900)
       OR (metric = 'image_notes' AND value <> 300)
       OR (metric = 'audio_notes' AND value <> 300)
       OR (metric = 'independent_tasks' AND value <> 300)
       OR (metric = 'has_source_tasks' AND value <> 900)
       OR (metric = 'source_missing_tasks' AND value <> 300)
       OR (metric = 'showcase_stories' AND value <> 12)
       OR (metric IN ('showcase_video', 'showcase_image', 'showcase_audio') AND value <> 4)
       OR (metric = 'showcase_valid' AND value <> 12)
       OR (metric = 'watch_sessions' AND value <> 1000)
       OR (metric = 'valid_watch_sessions' AND value <> 750)
       OR (metric = 'invalid_watch_sessions' AND value <> 250)
       OR (metric = 'distinct_note_content' AND value < config.note_count * 0.9)
       OR (metric = 'distinct_task_title' AND value < 1000)
       OR (metric = 'distinct_task_description' AND value < 900)
       OR (metric = 'tags_used' AND value <> 56)
       OR (metric = 'cross_media_tags' AND value < 8)
       OR (metric = 'all_media_tags' AND value < 3)
       OR (metric IN ('today_tasks', 'overdue_tasks', 'upcoming_tasks',
                     'no_deadline_tasks', 'completed_tasks',
                     'showcase_today', 'showcase_overdue', 'showcase_upcoming',
                     'showcase_no_deadline', 'showcase_completed') AND value < 2)
       OR (metric IN ('source_shape_violations', 'source_membership_violations',
                     'task_source_violations', 'organization_ownership_violations',
                     'image_timestamp_violations', 'note_no_match_search',
                     'task_no_match_search', 'watch_invariant_violations',
                     'tag_normalized_duplicates', 'orphan_media_tag_links',
                     'showcase_invalid', 'search_xyznomatch') AND value <> 0)
       OR (metric IN ('video_tag_links', 'image_tag_links', 'audio_tag_links',
                     'video_tagged', 'image_tagged', 'audio_tagged',
                     'video_untagged', 'image_untagged', 'audio_untagged',
                     'video_multi_tag', 'image_multi_tag', 'audio_multi_tag',
                     'video_custom_title', 'image_custom_title', 'audio_custom_title',
                     'video_description', 'image_description', 'audio_description',
                     'video_fallback_title', 'image_fallback_title', 'audio_fallback_title',
                     'video_no_description', 'image_no_description', 'audio_no_description',
                     'audio_timestamp_zero', 'audio_timestamp_positive',
                     'video_timestamped', 'video_without_timestamp',
                     'audio_timestamped', 'audio_without_timestamp',
                     'categorized_notes', 'uncategorized_notes', 'untagged_notes',
                     'single_tag_notes', 'multi_tag_notes', 'not_started_tasks',
                     'in_progress_tasks', 'completed_tasks', 'categorized_tasks',
                     'uncategorized_tasks', 'untagged_tasks', 'single_tag_tasks',
                     'multi_tag_tasks', 'note_rare_search', 'task_rare_search',
                     'search_do_an', 'search_doi_chieu', 'search_spring',
                     'search_database', 'search_english', 'search_listening',
                     'search_architecture') AND value = 0);

    IF failures IS NOT NULL THEN
        RAISE EXCEPTION 'Demo verification failed: %', failures;
    END IF;

    IF (SELECT value FROM demo_metrics WHERE metric = 'note_common_search') <=
       (SELECT value FROM demo_metrics WHERE metric = 'note_medium_search')
       OR (SELECT value FROM demo_metrics WHERE metric = 'note_medium_search') <=
          (SELECT value FROM demo_metrics WHERE metric = 'note_rare_search')
       OR (SELECT value FROM demo_metrics WHERE metric = 'task_common_search') <=
          (SELECT value FROM demo_metrics WHERE metric = 'task_medium_search')
       OR (SELECT value FROM demo_metrics WHERE metric = 'task_medium_search') <=
          (SELECT value FROM demo_metrics WHERE metric = 'task_rare_search') THEN
        RAISE EXCEPTION 'Demo search selectivity is not COMMON > MEDIUM > RARE > 0.';
    END IF;
END $$;

SELECT metric, value FROM demo_metrics ORDER BY metric;
ROLLBACK;
