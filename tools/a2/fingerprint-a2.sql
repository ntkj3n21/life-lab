WITH account_scope AS (
    SELECT
        a.*,
        CASE lower(a.email)
            WHEN 'scale@lifelab.local' THEN 'A2'
            WHEN 'demo@lifelab.local' THEN 'A1'
            ELSE 'UNRELATED'
        END AS scope
    FROM accounts a
),
note_base AS (
    SELECT
        a.scope,
        lower(a.email) AS email,
        n.id AS note_id,
        n.source_type,
        CASE n.source_type
            WHEN 'YOUTUBE' THEN
                'YOUTUBE:' || coalesce(y.youtube_video_id, '<NULL>')
            WHEN 'IMAGE' THEN
                'IMAGE:' || coalesce(
                    image.external_url,
                    'UPLOAD:' || image.storage_key,
                    '<NULL>'
                )
            WHEN 'AUDIO' THEN
                'AUDIO:' || coalesce(
                    audio.external_url,
                    'UPLOAD:' || audio.storage_key,
                    '<NULL>'
                )
            ELSE '<UNKNOWN>'
        END AS source_key,
        replace(
            replace(n.content, E'\n', ' '),
            E'\r',
            ' '
        ) AS content,
        coalesce(
            n.timestamp_seconds::text,
            '<NULL>'
        ) AS timestamp_value,
        coalesce(
            category.normalized_name,
            '<NULL>'
        ) AS category_name,
        n.created_at,
        n.updated_at
    FROM notes n
    JOIN account_scope a
      ON a.id = n.account_id
    LEFT JOIN youtube_videos y
      ON y.id = n.youtube_source_id
    LEFT JOIN image_sources image
      ON image.id = n.image_source_id
    LEFT JOIN audio_sources audio
      ON audio.id = n.audio_source_id
    LEFT JOIN categories category
      ON category.id = n.category_id
),
task_base AS (
    SELECT
        a.scope,
        lower(a.email) AS email,
        t.id AS task_id,
        t.source_status,
        coalesce(note.source_type, '<NULL>') AS source_type,
        coalesce(note.source_key, '<NULL>') AS source_key,
        coalesce(note.content, '<NULL>') AS source_content,
        replace(
            replace(t.title, E'\n', ' '),
            E'\r',
            ' '
        ) AS title,
        coalesce(
            replace(
                replace(t.description, E'\n', ' '),
                E'\r',
                ' '
            ),
            '<NULL>'
        ) AS description,
        t.status,
        coalesce(t.deadline::text, '<NULL>') AS deadline,
        coalesce(
            category.normalized_name,
            '<NULL>'
        ) AS category_name,
        t.created_at,
        t.updated_at
    FROM tasks t
    JOIN account_scope a
      ON a.id = t.account_id
    LEFT JOIN note_base note
      ON note.note_id = t.source_note_id
    LEFT JOIN categories category
      ON category.id = t.category_id
),
personal_rows AS (
    SELECT
        a.scope,
        concat_ws(
            '|',
            'ACCOUNT',
            lower(a.email),
            a.password_hash,
            a.display_name,
            a.created_at,
            a.updated_at
        ) AS value
    FROM account_scope a

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'LIB_VIDEO',
            lower(a.email),
            y.youtube_video_id,
            coalesce(l.custom_title, '<NULL>'),
            coalesce(l.personal_description, '<NULL>'),
            l.added_at,
            l.updated_at
        )
    FROM library_videos l
    JOIN account_scope a
      ON a.id = l.account_id
    JOIN youtube_videos y
      ON y.id = l.youtube_source_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'LIB_IMAGE',
            lower(a.email),
            image.origin,
            coalesce(image.external_url, '<NULL>'),
            coalesce(image.storage_key, '<NULL>'),
            coalesce(image.original_filename, '<NULL>'),
            coalesce(image.media_type, '<NULL>'),
            coalesce(image.size_bytes::text, '<NULL>'),
            l.title,
            l.added_at
        )
    FROM library_images l
    JOIN account_scope a
      ON a.id = l.account_id
    JOIN image_sources image
      ON image.id = l.image_source_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'LIB_AUDIO',
            lower(a.email),
            audio.origin,
            coalesce(audio.external_url, '<NULL>'),
            coalesce(audio.storage_key, '<NULL>'),
            coalesce(audio.original_filename, '<NULL>'),
            coalesce(audio.media_type, '<NULL>'),
            coalesce(audio.size_bytes::text, '<NULL>'),
            l.title,
            l.added_at
        )
    FROM library_audio l
    JOIN account_scope a
      ON a.id = l.account_id
    JOIN audio_sources audio
      ON audio.id = l.audio_source_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'CATEGORY',
            lower(a.email),
            category.name,
            category.normalized_name,
            category.created_at,
            category.updated_at
        )
    FROM categories category
    JOIN account_scope a
      ON a.id = category.account_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'TAG',
            lower(a.email),
            tag.name,
            tag.normalized_name,
            tag.created_at,
            tag.updated_at
        )
    FROM tags tag
    JOIN account_scope a
      ON a.id = tag.account_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'LIB_VIDEO_TAG',
            lower(a.email),
            y.youtube_video_id,
            tag.normalized_name
        )
    FROM library_video_tags link
    JOIN library_videos l
      ON l.id = link.library_video_id
    JOIN account_scope a
      ON a.id = l.account_id
    JOIN youtube_videos y
      ON y.id = l.youtube_source_id
    JOIN tags tag
      ON tag.id = link.tag_id

    UNION ALL

    SELECT
        a.scope,
        concat_ws(
            '|',
            'WATCH',
            lower(a.email),
            y.youtube_video_id,
            w.started_at,
            coalesce(w.ended_at::text, '<NULL>'),
            w.last_heartbeat_at,
            w.watch_time_seconds,
            w.validity_status
        )
    FROM watch_sessions w
    JOIN library_videos l
      ON l.id = w.library_video_id
    JOIN account_scope a
      ON a.id = l.account_id
    JOIN youtube_videos y
      ON y.id = l.youtube_source_id

    UNION ALL

    SELECT
        note.scope,
        concat_ws(
            '|',
            'NOTE',
            note.email,
            note.source_type,
            note.source_key,
            note.content,
            note.timestamp_value,
            note.category_name,
            note.created_at,
            note.updated_at
        )
    FROM note_base note

    UNION ALL

    SELECT
        note.scope,
        concat_ws(
            '|',
            'NOTE_TAG',
            note.email,
            note.source_type,
            note.source_key,
            note.content,
            note.timestamp_value,
            note.created_at,
            tag.normalized_name
        )
    FROM note_tags link
    JOIN note_base note
      ON note.note_id = link.note_id
    JOIN tags tag
      ON tag.id = link.tag_id

    UNION ALL

    SELECT
        task.scope,
        concat_ws(
            '|',
            'TASK',
            task.email,
            task.source_status,
            task.source_type,
            task.source_key,
            task.source_content,
            task.title,
            task.description,
            task.status,
            task.deadline,
            task.category_name,
            task.created_at,
            task.updated_at
        )
    FROM task_base task

    UNION ALL

    SELECT
        task.scope,
        concat_ws(
            '|',
            'TASK_TAG',
            task.email,
            task.source_status,
            task.source_type,
            task.source_key,
            task.source_content,
            task.title,
            task.status,
            task.deadline,
            task.created_at,
            tag.normalized_name
        )
    FROM task_tags link
    JOIN task_base task
      ON task.task_id = link.task_id
    JOIN tags tag
      ON tag.id = link.tag_id
),
global_rows AS (
    SELECT
        'GLOBAL' AS scope,
        concat_ws(
            '|',
            'SOURCE_VIDEO',
            y.youtube_video_id,
            y.source_url,
            coalesce(y.title, '<NULL>'),
            coalesce(y.channel_name, '<NULL>'),
            coalesce(y.thumbnail_url, '<NULL>'),
            coalesce(y.duration_seconds::text, '<NULL>'),
            coalesce(y.published_at::text, '<NULL>'),
            y.availability_status
        ) AS value
    FROM youtube_videos y
    WHERE EXISTS (
        SELECT 1
        FROM library_videos l
        JOIN accounts a
          ON a.id = l.account_id
        WHERE l.youtube_source_id = y.id
          AND lower(a.email) <> 'scale@lifelab.local'

        UNION ALL

        SELECT 1
        FROM notes n
        JOIN accounts a
          ON a.id = n.account_id
        WHERE n.youtube_source_id = y.id
          AND lower(a.email) <> 'scale@lifelab.local'
    )

    UNION ALL

    SELECT
        'GLOBAL',
        concat_ws(
            '|',
            'SOURCE_IMAGE',
            image.origin,
            coalesce(image.external_url, '<NULL>'),
            coalesce(image.storage_key, '<NULL>'),
            coalesce(image.original_filename, '<NULL>'),
            coalesce(image.media_type, '<NULL>'),
            coalesce(image.size_bytes::text, '<NULL>'),
            image.created_at
        )
    FROM image_sources image
    WHERE EXISTS (
        SELECT 1
        FROM library_images l
        JOIN accounts a
          ON a.id = l.account_id
        WHERE l.image_source_id = image.id
          AND lower(a.email) <> 'scale@lifelab.local'

        UNION ALL

        SELECT 1
        FROM notes n
        JOIN accounts a
          ON a.id = n.account_id
        WHERE n.image_source_id = image.id
          AND lower(a.email) <> 'scale@lifelab.local'
    )

    UNION ALL

    SELECT
        'GLOBAL',
        concat_ws(
            '|',
            'SOURCE_AUDIO',
            audio.origin,
            coalesce(audio.external_url, '<NULL>'),
            coalesce(audio.storage_key, '<NULL>'),
            coalesce(audio.original_filename, '<NULL>'),
            coalesce(audio.media_type, '<NULL>'),
            coalesce(audio.size_bytes::text, '<NULL>'),
            audio.created_at
        )
    FROM audio_sources audio
    WHERE EXISTS (
        SELECT 1
        FROM library_audio l
        JOIN accounts a
          ON a.id = l.account_id
        WHERE l.audio_source_id = audio.id
          AND lower(a.email) <> 'scale@lifelab.local'

        UNION ALL

        SELECT 1
        FROM notes n
        JOIN accounts a
          ON a.id = n.account_id
        WHERE n.audio_source_id = audio.id
          AND lower(a.email) <> 'scale@lifelab.local'
    )
)
SELECT
    scope,
    value
FROM (
    SELECT *
    FROM personal_rows

    UNION ALL

    SELECT *
    FROM global_rows
) all_rows
ORDER BY
    scope,
    value;
