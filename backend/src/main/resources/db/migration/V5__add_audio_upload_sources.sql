ALTER TABLE audio_sources
    RENAME COLUMN source_url TO external_url;

ALTER TABLE audio_sources
    ADD COLUMN origin VARCHAR,
    ADD COLUMN storage_key VARCHAR(255),
    ADD COLUMN original_filename VARCHAR(255),
    ADD COLUMN media_type VARCHAR(100),
    ADD COLUMN size_bytes BIGINT;

UPDATE audio_sources
SET origin = 'EXTERNAL';

ALTER TABLE audio_sources
    ALTER COLUMN origin SET NOT NULL,
    ALTER COLUMN external_url DROP NOT NULL,
    DROP CONSTRAINT ck_audio_sources_url_not_blank;

DROP INDEX uk_audio_sources_source_url;

CREATE UNIQUE INDEX uk_audio_sources_external_url
    ON audio_sources (external_url)
    WHERE external_url IS NOT NULL;

CREATE UNIQUE INDEX uk_audio_sources_storage_key
    ON audio_sources (storage_key)
    WHERE storage_key IS NOT NULL;

ALTER TABLE audio_sources
    ADD CONSTRAINT ck_audio_sources_origin
        CHECK (origin IN ('EXTERNAL', 'UPLOAD')),
    ADD CONSTRAINT ck_audio_sources_shape CHECK (
        (origin = 'EXTERNAL'
            AND external_url IS NOT NULL
            AND btrim(external_url) <> ''
            AND storage_key IS NULL
            AND original_filename IS NULL
            AND media_type IS NULL
            AND size_bytes IS NULL)
        OR
        (origin = 'UPLOAD'
            AND external_url IS NULL
            AND storage_key IS NOT NULL
            AND original_filename IS NOT NULL
            AND media_type IS NOT NULL
            AND size_bytes IS NOT NULL
            AND size_bytes >= 0)
    );
