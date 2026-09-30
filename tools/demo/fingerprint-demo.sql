WITH demo AS (
    SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local'
), logical_rows AS (
    SELECT 'video' AS kind, jsonb_build_object(
        'source', source.youtube_video_id,
        'customTitle', library.custom_title,
        'description', library.personal_description,
        'addedAt', library.added_at,
        'tags', (SELECT coalesce(jsonb_agg(tag.name ORDER BY tag.name), '[]'::jsonb)
                 FROM library_video_tags link JOIN tags tag ON tag.id = link.tag_id
                 WHERE link.library_video_id = library.id)) AS payload
    FROM library_videos library JOIN demo ON demo.id = library.account_id
    JOIN youtube_videos source ON source.id = library.youtube_source_id
    UNION ALL
    SELECT 'image', jsonb_build_object(
        'origin', source.origin,
        'source', coalesce(source.storage_key, source.external_url),
        'title', library.title,
        'description', library.personal_description,
        'addedAt', library.added_at,
        'tags', (SELECT coalesce(jsonb_agg(tag.name ORDER BY tag.name), '[]'::jsonb)
                 FROM library_image_tags link JOIN tags tag ON tag.id = link.tag_id
                 WHERE link.library_image_id = library.id))
    FROM library_images library JOIN demo ON demo.id = library.account_id
    JOIN image_sources source ON source.id = library.image_source_id
    UNION ALL
    SELECT 'audio', jsonb_build_object(
        'origin', source.origin,
        'source', coalesce(source.storage_key, source.external_url),
        'title', library.title,
        'description', library.personal_description,
        'addedAt', library.added_at,
        'tags', (SELECT coalesce(jsonb_agg(tag.name ORDER BY tag.name), '[]'::jsonb)
                 FROM library_audio_tags link JOIN tags tag ON tag.id = link.tag_id
                 WHERE link.library_audio_id = library.id))
    FROM library_audio library JOIN demo ON demo.id = library.account_id
    JOIN audio_sources source ON source.id = library.audio_source_id
    UNION ALL
    SELECT 'category', jsonb_build_object('name', category.name)
    FROM categories category JOIN demo ON demo.id = category.account_id
    UNION ALL
    SELECT 'tag', jsonb_build_object('name', tag.name)
    FROM tags tag JOIN demo ON demo.id = tag.account_id
    UNION ALL
    SELECT 'watch', jsonb_build_object(
        'source', source.youtube_video_id,
        'startedAt', session.started_at,
        'endedAt', session.ended_at,
        'lastHeartbeatAt', session.last_heartbeat_at,
        'watchTimeSeconds', session.watch_time_seconds,
        'validityStatus', session.validity_status)
    FROM watch_sessions session
    JOIN library_videos library ON library.id = session.library_video_id
    JOIN demo ON demo.id = library.account_id
    JOIN youtube_videos source ON source.id = library.youtube_source_id
    UNION ALL
    SELECT 'note', jsonb_build_object(
        'sourceType', note.source_type,
        'source', COALESCE(video.youtube_video_id, image.storage_key, image.external_url,
                           audio.storage_key, audio.external_url),
        'content', note.content,
        'timestamp', note.timestamp_seconds,
        'category', category.name,
        'tags', (SELECT coalesce(jsonb_agg(tag.name ORDER BY tag.name), '[]'::jsonb)
                 FROM note_tags link JOIN tags tag ON tag.id = link.tag_id
                 WHERE link.note_id = note.id),
        'createdAt', note.created_at,
        'updatedAt', note.updated_at)
    FROM notes note JOIN demo ON demo.id = note.account_id
    LEFT JOIN youtube_videos video ON video.id = note.youtube_source_id
    LEFT JOIN image_sources image ON image.id = note.image_source_id
    LEFT JOIN audio_sources audio ON audio.id = note.audio_source_id
    LEFT JOIN categories category ON category.id = note.category_id
    UNION ALL
    SELECT 'task', jsonb_build_object(
        'title', task.title,
        'description', task.description,
        'status', task.status,
        'sourceStatus', task.source_status,
        'sourceNote', note.content,
        'sourceType', note.source_type,
        'source', coalesce(video.youtube_video_id, image.storage_key, image.external_url,
                           audio.storage_key, audio.external_url),
        'deadline', task.deadline,
        'category', category.name,
        'tags', (SELECT coalesce(jsonb_agg(tag.name ORDER BY tag.name), '[]'::jsonb)
                 FROM task_tags link JOIN tags tag ON tag.id = link.tag_id
                 WHERE link.task_id = task.id),
        'createdAt', task.created_at,
        'updatedAt', task.updated_at)
    FROM tasks task JOIN demo ON demo.id = task.account_id
    LEFT JOIN notes note ON note.id = task.source_note_id
    LEFT JOIN youtube_videos video ON video.id = note.youtube_source_id
    LEFT JOIN image_sources image ON image.id = note.image_source_id
    LEFT JOIN audio_sources audio ON audio.id = note.audio_source_id
    LEFT JOIN categories category ON category.id = task.category_id
)
SELECT md5(coalesce(string_agg(kind || '|' || payload::text, E'\n'
            ORDER BY kind, payload::text), '')) AS fingerprint
FROM logical_rows;
