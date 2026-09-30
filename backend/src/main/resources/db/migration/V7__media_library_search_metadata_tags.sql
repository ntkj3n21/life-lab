CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE FUNCTION lifelab_search_normalize(value TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
PARALLEL SAFE
AS $$
    SELECT replace(lower(unaccent(coalesce(value, ''))), 'đ', 'd')
$$;

ALTER TABLE library_images
    ADD COLUMN personal_description TEXT;

ALTER TABLE library_audio
    ADD COLUMN personal_description TEXT;

CREATE TABLE library_image_tags (
    library_image_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    CONSTRAINT pk_library_image_tags PRIMARY KEY (library_image_id, tag_id),
    CONSTRAINT fk_library_image_tags_image
        FOREIGN KEY (library_image_id) REFERENCES library_images (id) ON DELETE CASCADE,
    CONSTRAINT fk_library_image_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE INDEX idx_library_image_tags_tag
    ON library_image_tags (tag_id, library_image_id);

CREATE TABLE library_audio_tags (
    library_audio_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    CONSTRAINT pk_library_audio_tags PRIMARY KEY (library_audio_id, tag_id),
    CONSTRAINT fk_library_audio_tags_audio
        FOREIGN KEY (library_audio_id) REFERENCES library_audio (id) ON DELETE CASCADE,
    CONSTRAINT fk_library_audio_tags_tag
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

CREATE INDEX idx_library_audio_tags_tag
    ON library_audio_tags (tag_id, library_audio_id);
