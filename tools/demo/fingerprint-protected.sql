WITH protected AS (
    SELECT id, lower(email) AS owner FROM accounts
    WHERE lower(email) <> 'scale-demo@lifelab.local'
), rows AS (
    SELECT owner, 'account' AS kind, to_jsonb(account) AS payload
    FROM accounts account JOIN protected ON protected.id = account.id
    UNION ALL SELECT owner, 'video', to_jsonb(library)
    FROM library_videos library JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'image', to_jsonb(library)
    FROM library_images library JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'audio', to_jsonb(library)
    FROM library_audio library JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'category', to_jsonb(category)
    FROM categories category JOIN protected ON protected.id = category.account_id
    UNION ALL SELECT owner, 'tag', to_jsonb(tag)
    FROM tags tag JOIN protected ON protected.id = tag.account_id
    UNION ALL SELECT owner, 'note', to_jsonb(note)
    FROM notes note JOIN protected ON protected.id = note.account_id
    UNION ALL SELECT owner, 'task', to_jsonb(task)
    FROM tasks task JOIN protected ON protected.id = task.account_id
    UNION ALL SELECT owner, 'watch', to_jsonb(session)
    FROM watch_sessions session JOIN library_videos library ON library.id = session.library_video_id
    JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'video_tag', to_jsonb(link)
    FROM library_video_tags link JOIN library_videos library ON library.id = link.library_video_id
    JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'image_tag', to_jsonb(link)
    FROM library_image_tags link JOIN library_images library ON library.id = link.library_image_id
    JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'audio_tag', to_jsonb(link)
    FROM library_audio_tags link JOIN library_audio library ON library.id = link.library_audio_id
    JOIN protected ON protected.id = library.account_id
    UNION ALL SELECT owner, 'note_tag', to_jsonb(link)
    FROM note_tags link JOIN notes note ON note.id = link.note_id
    JOIN protected ON protected.id = note.account_id
    UNION ALL SELECT owner, 'task_tag', to_jsonb(link)
    FROM task_tags link JOIN tasks task ON task.id = link.task_id
    JOIN protected ON protected.id = task.account_id
), fingerprints AS (
    SELECT owner, md5(string_agg(kind || '|' || payload::text, E'\n'
                      ORDER BY kind, payload::text)) AS fingerprint
    FROM rows GROUP BY owner
), global_rows AS (
    SELECT 'youtube' AS kind, to_jsonb(source) AS payload FROM youtube_videos source
    UNION ALL SELECT 'image', to_jsonb(source) FROM image_sources source
    WHERE NOT EXISTS (SELECT 1 FROM demo_image_fixtures fixture WHERE fixture.url = source.external_url)
       OR EXISTS (SELECT 1 FROM library_images library JOIN protected owner
                  ON owner.id = library.account_id WHERE library.image_source_id = source.id)
       OR EXISTS (SELECT 1 FROM notes note JOIN protected owner
                  ON owner.id = note.account_id WHERE note.image_source_id = source.id)
    UNION ALL SELECT 'audio', to_jsonb(source) FROM audio_sources source
    WHERE NOT EXISTS (SELECT 1 FROM demo_audio_fixtures fixture WHERE fixture.url = source.external_url)
       OR EXISTS (SELECT 1 FROM library_audio library JOIN protected owner
                  ON owner.id = library.account_id WHERE library.audio_source_id = source.id)
       OR EXISTS (SELECT 1 FROM notes note JOIN protected owner
                  ON owner.id = note.account_id WHERE note.audio_source_id = source.id)
)
SELECT owner || '|' || coalesce(fingerprint, 'MISSING') AS protected_fingerprint
FROM (SELECT lower(email) AS owner FROM accounts
      WHERE lower(email) <> 'scale-demo@lifelab.local') names
LEFT JOIN fingerprints USING (owner)
UNION ALL
SELECT 'GLOBAL-PROTECTED|' || md5(coalesce(string_agg(kind || '|' || payload::text,
       E'\n' ORDER BY kind, payload::text), ''))
FROM global_rows
ORDER BY 1;
