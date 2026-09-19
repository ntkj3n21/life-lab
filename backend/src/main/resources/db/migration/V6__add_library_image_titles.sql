ALTER TABLE library_images
    ADD COLUMN title VARCHAR(255);

UPDATE library_images li
SET title = NULLIF(
    regexp_replace(src.original_filename, '\.[^.]+$', ''),
    ''
)
FROM image_sources src
WHERE li.image_source_id = src.id
  AND src.origin = 'UPLOAD'
  AND src.original_filename IS NOT NULL;

UPDATE library_audio la
SET title = NULLIF(
    regexp_replace(src.original_filename, '\.[^.]+$', ''),
    ''
)
FROM audio_sources src
WHERE la.audio_source_id = src.id
  AND la.title IS NULL
  AND src.origin = 'UPLOAD'
  AND src.original_filename IS NOT NULL;

UPDATE library_audio
SET title = NULL
WHERE title IS NOT NULL
  AND btrim(title) = '';

ALTER TABLE library_images
    ADD CONSTRAINT ck_library_images_title_not_blank
        CHECK (title IS NULL OR btrim(title) <> '');

ALTER TABLE library_audio
    ADD CONSTRAINT ck_library_audio_title_not_blank
        CHECK (title IS NULL OR btrim(title) <> '');
