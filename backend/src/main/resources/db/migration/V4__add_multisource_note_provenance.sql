ALTER TABLE notes
    ADD COLUMN source_type VARCHAR DEFAULT 'YOUTUBE';

UPDATE notes
SET source_type = 'YOUTUBE'
WHERE source_type IS NULL;

ALTER TABLE notes
    ALTER COLUMN source_type SET NOT NULL;

ALTER TABLE notes
    ALTER COLUMN youtube_source_id DROP NOT NULL;

ALTER TABLE notes
    ADD COLUMN image_source_id BIGINT;

ALTER TABLE notes
    ADD CONSTRAINT fk_notes_image_source
        FOREIGN KEY (image_source_id) REFERENCES image_sources (id) ON DELETE RESTRICT;

ALTER TABLE notes
    ADD COLUMN audio_source_id BIGINT;

ALTER TABLE notes
    ADD CONSTRAINT fk_notes_audio_source
        FOREIGN KEY (audio_source_id) REFERENCES audio_sources (id) ON DELETE RESTRICT;

ALTER TABLE notes
    ADD CONSTRAINT ck_notes_source_type
        CHECK (source_type IN ('YOUTUBE', 'IMAGE', 'AUDIO'));

ALTER TABLE notes
    ADD CONSTRAINT ck_notes_source_shape CHECK (
        (source_type = 'YOUTUBE'
            AND youtube_source_id IS NOT NULL
            AND image_source_id IS NULL
            AND audio_source_id IS NULL)
        OR
        (source_type = 'IMAGE'
            AND youtube_source_id IS NULL
            AND image_source_id IS NOT NULL
            AND audio_source_id IS NULL
            AND timestamp_seconds IS NULL)
        OR
        (source_type = 'AUDIO'
            AND youtube_source_id IS NULL
            AND image_source_id IS NULL
            AND audio_source_id IS NOT NULL)
    );

CREATE INDEX idx_notes_account_image_source
    ON notes (account_id, image_source_id, created_at DESC, id DESC)
    WHERE image_source_id IS NOT NULL;

CREATE INDEX idx_notes_account_audio_source
    ON notes (account_id, audio_source_id, timestamp_seconds, id)
    WHERE audio_source_id IS NOT NULL;
