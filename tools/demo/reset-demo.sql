BEGIN;

SELECT pg_advisory_xact_lock(hashtext('life-lab-scale-demo'));

-- The account remains reusable. Explicit link deletion makes the Demo-owned
-- reset surface visible even where the FK would cascade.
DELETE FROM task_tags
WHERE task_id IN (SELECT task.id FROM tasks task JOIN accounts account
    ON account.id = task.account_id WHERE lower(account.email) = 'scale-demo@lifelab.local');

DELETE FROM note_tags
WHERE note_id IN (SELECT note.id FROM notes note JOIN accounts account
    ON account.id = note.account_id WHERE lower(account.email) = 'scale-demo@lifelab.local');

DELETE FROM tasks
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM notes
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM watch_sessions
WHERE library_video_id IN (
    SELECT library.id FROM library_videos library
    JOIN accounts account ON account.id = library.account_id
    WHERE lower(account.email) = 'scale-demo@lifelab.local'
);

DELETE FROM library_video_tags
WHERE library_video_id IN (
    SELECT library.id FROM library_videos library
    JOIN accounts account ON account.id = library.account_id
    WHERE lower(account.email) = 'scale-demo@lifelab.local'
);

DELETE FROM library_image_tags
WHERE library_image_id IN (
    SELECT library.id FROM library_images library
    JOIN accounts account ON account.id = library.account_id
    WHERE lower(account.email) = 'scale-demo@lifelab.local'
);

DELETE FROM library_audio_tags
WHERE library_audio_id IN (
    SELECT library.id FROM library_audio library
    JOIN accounts account ON account.id = library.account_id
    WHERE lower(account.email) = 'scale-demo@lifelab.local'
);

DELETE FROM library_videos
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM library_images
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM library_audio
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM tags
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

DELETE FROM categories
WHERE account_id IN (SELECT id FROM accounts WHERE lower(email) = 'scale-demo@lifelab.local');

-- Only these deterministic fixture URLs may be removed. A Source referenced
-- by another account's membership or surviving Note remains untouched.
DELETE FROM image_sources source USING demo_image_fixtures fixture
WHERE source.external_url = fixture.url
  AND NOT EXISTS (SELECT 1 FROM library_images link WHERE link.image_source_id = source.id)
  AND NOT EXISTS (SELECT 1 FROM notes note WHERE note.image_source_id = source.id);

DELETE FROM audio_sources source USING demo_audio_fixtures fixture
WHERE source.external_url = fixture.url
  AND NOT EXISTS (SELECT 1 FROM library_audio link WHERE link.audio_source_id = source.id)
  AND NOT EXISTS (SELECT 1 FROM notes note WHERE note.audio_source_id = source.id);

COMMIT;
