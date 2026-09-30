BEGIN TRANSACTION READ ONLY;
WITH a1 AS (SELECT id FROM accounts WHERE lower(email)='demo@lifelab.local'), ids AS (SELECT unnest(string_to_array(:'snapshot_ids',',')) AS youtube_video_id), current_sources AS (SELECT y.youtube_video_id FROM library_videos l JOIN a1 ON a1.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id), current_task_distribution AS (SELECT c.youtube_video_id, count(DISTINCT t.id) AS task_count FROM current_sources c JOIN youtube_videos y ON y.youtube_video_id=c.youtube_video_id LEFT JOIN notes n ON n.youtube_source_id=y.id AND n.account_id=(SELECT id FROM a1) LEFT JOIN tasks t ON t.source_note_id=n.id AND t.source_status='HAS_SOURCE' AND t.account_id=(SELECT id FROM a1) GROUP BY c.youtube_video_id)
SELECT 'account_count','1',count(*)::text,count(*)=1,'A1 account' FROM a1
UNION ALL SELECT 'library_count','36',count(*)::text,count(*)=36,'current Library rows' FROM library_videos l JOIN a1 ON a1.id=l.account_id
UNION ALL SELECT 'global_source_count','37',count(*)::text,count(*)=37,'locked globals present' FROM youtube_videos y JOIN ids ON ids.youtube_video_id=y.youtube_video_id
UNION ALL SELECT 'h1_absent_library','0',count(*)::text,count(*)=0,'H1 historical' FROM current_sources WHERE youtube_video_id='-XsRLyKV9_k'
UNION ALL SELECT 'tag_count','43',count(*)::text,count(*)=43,'A1 tags' FROM tags t JOIN a1 ON a1.id=t.account_id
UNION ALL SELECT 'tag_link_count','100',count(*)::text,count(*)=100,'A1 tag links' FROM library_video_tags r JOIN library_videos l ON l.id=r.library_video_id JOIN a1 ON a1.id=l.account_id
UNION ALL SELECT 'video_custom_titles','10',count(*)::text,count(*)=10,
    'intentional personal Video titles; remaining cards use Source title fallback'
FROM library_videos library JOIN a1 ON a1.id=library.account_id WHERE library.custom_title IS NOT NULL
UNION ALL SELECT 'video_personal_descriptions','14',count(*)::text,count(*)=14,
    'student-specific Video descriptions'
FROM library_videos library JOIN a1 ON a1.id=library.account_id WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'untagged_video','1',count(*)::text,count(*)=1,
    'a current Video can remain untagged'
FROM library_videos library JOIN a1 ON a1.id=library.account_id
WHERE NOT EXISTS (SELECT 1 FROM library_video_tags link WHERE link.library_video_id=library.id)
UNION ALL SELECT 'video_personal_metadata_identity','1',count(*)::text,count(*)=1,
    'REST API study title and description belong to the A1 Library membership'
FROM library_videos library JOIN a1 ON a1.id=library.account_id
JOIN youtube_videos source ON source.id=library.youtube_source_id
WHERE source.youtube_video_id='L-ZrZwvNsuo'
  AND library.custom_title='REST API cho đồ án Life Lab'
  AND library.personal_description='Tham khảo cách tổ chức REST API và phân lớp backend rõ ràng.'
UNION ALL SELECT 'watch_count','160',count(*)::text,count(*)=160,'watch sessions' FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id JOIN a1 ON a1.id=l.account_id
UNION ALL SELECT 'valid_watch_count','117',count(*)::text,count(*)=117,'VALID sessions' FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id JOIN a1 ON a1.id=l.account_id WHERE s.validity_status='VALID'
UNION ALL SELECT 'invalid_watch_count','43',count(*)::text,count(*)=43,'INVALID sessions' FROM watch_sessions s JOIN library_videos l ON l.id=s.library_video_id JOIN a1 ON a1.id=l.account_id WHERE s.validity_status='INVALID'
UNION ALL SELECT 'watched_videos','24',count(*)::text,count(*)=24,'watched' FROM (SELECT l.id FROM library_videos l JOIN a1 ON a1.id=l.account_id JOIN watch_sessions s ON s.library_video_id=l.id WHERE s.validity_status='VALID' GROUP BY l.id) x
UNION ALL SELECT 'unwatched_videos','12',count(*)::text,count(*)=12,'unwatched' FROM library_videos l JOIN a1 ON a1.id=l.account_id WHERE NOT EXISTS (SELECT 1 FROM watch_sessions s WHERE s.library_video_id=l.id AND s.validity_status='VALID')
UNION ALL SELECT 'note_count','123',count(*)::text,count(*)=123,'semantic Notes' FROM notes n JOIN a1 ON a1.id=n.account_id
UNION ALL SELECT 'current_note_count','94',count(*)::text,count(*)=94,'current Notes' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id JOIN current_sources c ON c.youtube_video_id=y.youtube_video_id
UNION ALL SELECT 'note_source_coverage','36',count(*)::text,count(*)=36,'all current sources have Notes' FROM (SELECT DISTINCT y.youtube_video_id FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id JOIN current_sources c ON c.youtube_video_id=y.youtube_video_id) x
UNION ALL SELECT 'metadata_note_count','5',count(*)::text,count(*)=5,'reviewed metadata fallback Notes' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE y.youtube_video_id IN ('L-ZrZwvNsuo','kkeFE6iRfMM','nm6qg6sinLU','SIAGpAaLSaI') AND n.timestamp_seconds IS NULL
UNION ALL SELECT 'metadata_note_source_coverage','4',count(DISTINCT y.youtube_video_id)::text,count(DISTINCT y.youtube_video_id)=4,'two NO_VTT sources plus semantic fallbacks LIBRARY_09 and LIBRARY_11' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE y.youtube_video_id IN ('L-ZrZwvNsuo','kkeFE6iRfMM','nm6qg6sinLU','SIAGpAaLSaI')
UNION ALL SELECT 'library_09_metadata_notes','2',count(*)::text,count(*)=2,'two semantic metadata fallback Notes' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE y.youtube_video_id='nm6qg6sinLU'
UNION ALL SELECT 'metadata_note_timestamps','0',count(*)::text,count(*)=0,'metadata fallback Notes remain untimestamped' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE y.youtube_video_id IN ('L-ZrZwvNsuo','kkeFE6iRfMM','nm6qg6sinLU') AND n.timestamp_seconds IS NOT NULL
UNION ALL SELECT 'timestamped_notes','91',count(*)::text,count(*)=91,'VTT-backed timestamps' FROM notes n JOIN a1 ON a1.id=n.account_id WHERE n.youtube_source_id IS NOT NULL AND n.timestamp_seconds IS NOT NULL
UNION ALL SELECT 'timestamp_bounds','0',count(*)::text,count(*)=0,'timestamp bounds' FROM notes n JOIN a1 ON a1.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE n.timestamp_seconds<0 OR n.timestamp_seconds>=y.duration_seconds
UNION ALL SELECT 'task_count','144',count(*)::text,count(*)=144,'semantic Tasks' FROM tasks t JOIN a1 ON a1.id=t.account_id
UNION ALL SELECT 'has_source_count','79',count(*)::text,count(*)=79,'HAS_SOURCE' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.source_status='HAS_SOURCE'
UNION ALL SELECT 'independent_count','50',count(*)::text,count(*)=50,'INDEPENDENT' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.source_status='INDEPENDENT'
UNION ALL SELECT 'source_missing_count','15',count(*)::text,count(*)=15,'SOURCE_MISSING' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.source_status='SOURCE_MISSING'
UNION ALL SELECT 'synthetic_task_copy','0',count(*)::text,count(*)=0,
    'independent and surviving missing-source Tasks read as standalone work'
FROM tasks t JOIN a1 ON a1.id=t.account_id
WHERE t.title ~ '\([0-9]+\)$'
   OR t.title LIKE 'Complete work after losing the source Note%'
   OR t.description LIKE 'Independent work in the personal study%'
   OR t.description LIKE 'The Task remains independently actionable%'
UNION ALL SELECT 'status_not_started','55',count(*)::text,count(*)=55,'status' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status='NOT_STARTED'
UNION ALL SELECT 'status_in_progress','43',count(*)::text,count(*)=43,'status' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status='IN_PROGRESS'
UNION ALL SELECT 'status_completed','46',count(*)::text,count(*)=46,'status' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status='COMPLETED'
UNION ALL SELECT 'has_source_live_notes','0',count(*)::text,count(*)=0,'HAS_SOURCE notes resolve' FROM tasks t JOIN a1 ON a1.id=t.account_id LEFT JOIN notes n ON n.id=t.source_note_id WHERE t.source_status='HAS_SOURCE' AND n.id IS NULL
UNION ALL SELECT 'has_source_account_mismatch','0',count(*)::text,count(*)=0,'HAS_SOURCE same-account Notes' FROM tasks t JOIN a1 ON a1.id=t.account_id JOIN notes n ON n.id=t.source_note_id WHERE t.source_status='HAS_SOURCE' AND n.account_id<>t.account_id
UNION ALL SELECT 'missing_has_no_note','0',count(*)::text,count(*)=0,'SOURCE_MISSING detached' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.source_status='SOURCE_MISSING' AND t.source_note_id IS NOT NULL
UNION ALL SELECT 'independent_has_no_note','0',count(*)::text,count(*)=0,'INDEPENDENT detached' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.source_status='INDEPENDENT' AND t.source_note_id IS NOT NULL
UNION ALL SELECT 'current_source_task_coverage','36',count(*)::text,count(*)=36,'every current source has HAS_SOURCE Task' FROM current_task_distribution WHERE task_count>=1
UNION ALL SELECT 'current_source_task_min','1',COALESCE(min(task_count),0)::text,COALESCE(min(task_count),0)>=1,'current linked-task minimum' FROM current_task_distribution
UNION ALL SELECT 'current_source_task_max_le_2','<=2',COALESCE(max(task_count),0)::text,COALESCE(max(task_count),0)<=2,'current linked-task maximum' FROM current_task_distribution
UNION ALL SELECT 'h1_task_coverage','1',CASE WHEN EXISTS (SELECT 1 FROM notes n JOIN youtube_videos y ON y.id=n.youtube_source_id JOIN tasks t ON t.source_note_id=n.id AND t.source_status='HAS_SOURCE' AND t.account_id=(SELECT id FROM a1) WHERE n.account_id=(SELECT id FROM a1) AND y.youtube_video_id='-XsRLyKV9_k') THEN '1' ELSE '0' END,EXISTS (SELECT 1 FROM notes n JOIN youtube_videos y ON y.id=n.youtube_source_id JOIN tasks t ON t.source_note_id=n.id AND t.source_status='HAS_SOURCE' AND t.account_id=(SELECT id FROM a1) WHERE n.account_id=(SELECT id FROM a1) AND y.youtube_video_id='-XsRLyKV9_k'),'H1 linked HAS_SOURCE Task'
UNION ALL SELECT 'deadline_overdue','9',count(*)::text,count(*)=9,'incomplete' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status<>'COMPLETED' AND t.deadline < :'reference_date'::date
UNION ALL SELECT 'deadline_today','21',count(*)::text,count(*)=21,'incomplete' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status<>'COMPLETED' AND t.deadline = :'reference_date'::date
UNION ALL SELECT 'deadline_upcoming','47',count(*)::text,count(*)=47,'incomplete' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status<>'COMPLETED' AND t.deadline > :'reference_date'::date
UNION ALL SELECT 'deadline_none','21',count(*)::text,count(*)=21,'incomplete' FROM tasks t JOIN a1 ON a1.id=t.account_id WHERE t.status<>'COMPLETED' AND t.deadline IS NULL
UNION ALL SELECT 'chronology_violations','0',count(*)::text,count(*)=0,'task/note ordering' FROM tasks t JOIN a1 ON a1.id=t.account_id LEFT JOIN notes n ON n.id=t.source_note_id WHERE t.created_at>t.updated_at OR (t.source_status='HAS_SOURCE' AND n.created_at>t.created_at)
UNION ALL SELECT 'shared_replacement_1','1',count(*)::text,count(*)=1,'replacement metadata' FROM youtube_videos WHERE youtube_video_id='L-ZrZwvNsuo' AND title='Spring Boot #9: Tạo RESTful API trong Spring Boot như thế nào?'
UNION ALL SELECT 'shared_replacement_2','1',count(*)::text,count(*)=1,'replacement metadata' FROM youtube_videos WHERE youtube_video_id='6TE1VEIWqLE' AND availability_status='AVAILABLE'
UNION ALL SELECT
	'library_image_count',
	'14',
	count(*)::text,
	count(*) = 14,
	'A1 Library Images'
FROM library_images li
JOIN a1 ON a1.id = li.account_id

UNION ALL SELECT
	'a1_image_source_count',
	'14',
	count(*)::text,
	count(*) = 14,
	'deterministic A1 Image sources'
FROM image_sources src
WHERE src.storage_key LIKE 'a1-image-%'

UNION ALL SELECT
	'image_note_count',
	'14',
	count(*)::text,
	count(*) = 14,
	'A1 IMAGE Notes'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'

UNION ALL SELECT
	'invalid_image_note_provenance',
	'0',
	count(*)::text,
	count(*) = 0,
	'IMAGE provenance shape'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'
  AND (
	  n.youtube_source_id IS NOT NULL
	  OR n.image_source_id IS NULL
	  OR n.audio_source_id IS NOT NULL
	  OR n.timestamp_seconds IS NOT NULL
  )

UNION ALL SELECT
	'image_note_missing_library',
	'0',
	count(*)::text,
	count(*) = 0,
	'IMAGE Notes resolve to same-account Library Image'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'
  AND NOT EXISTS (
	  SELECT 1
	  FROM library_images li
	  WHERE li.account_id = n.account_id
		AND li.image_source_id = n.image_source_id
  )

UNION ALL SELECT
	'image_linked_task_count',
	'10',
	count(*)::text,
	count(*) = 10,
	'Image-linked HAS_SOURCE Tasks'
FROM tasks t
JOIN a1 ON a1.id = t.account_id
JOIN notes n ON n.id = t.source_note_id
WHERE t.source_status = 'HAS_SOURCE'
  AND n.source_type = 'IMAGE'

UNION ALL SELECT
	'image_note_only_count',
	'4',
	count(*)::text,
	count(*) = 4,
	'Library Images with Note but no linked Task'
FROM library_images li
JOIN a1 ON a1.id = li.account_id
WHERE EXISTS (
	SELECT 1
	FROM notes n
	WHERE n.account_id = li.account_id
	  AND n.image_source_id = li.image_source_id
	  AND n.source_type = 'IMAGE'
)
AND NOT EXISTS (
	SELECT 1
	FROM notes n
	JOIN tasks t
	  ON t.source_note_id = n.id
	 AND t.source_status = 'HAS_SOURCE'
	WHERE n.account_id = li.account_id
	  AND n.image_source_id = li.image_source_id
	  AND n.source_type = 'IMAGE'
)

UNION ALL SELECT
	'category_count',
	'5',
	count(*)::text,
	count(*) = 5,
	'A1 Categories'
FROM categories c
JOIN a1 ON a1.id = c.account_id

UNION ALL SELECT
	'categorized_image_notes',
	'14',
	count(*)::text,
	count(*) = 14,
	'categorized IMAGE Notes'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'
  AND n.category_id IS NOT NULL

UNION ALL SELECT
	'categorized_image_tasks',
	'10',
	count(*)::text,
	count(*) = 10,
	'categorized Image-linked Tasks'
FROM tasks t
JOIN a1 ON a1.id = t.account_id
JOIN notes n ON n.id = t.source_note_id
WHERE n.source_type = 'IMAGE'
  AND t.category_id IS NOT NULL

UNION ALL SELECT
	'image_note_tag_links',
	'37',
	count(*)::text,
	count(*) = 37,
	'IMAGE Note-Tag links'
FROM note_tags nt
JOIN notes n ON n.id = nt.note_id
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'

UNION ALL SELECT
	'image_task_tag_links',
	'28',
	count(*)::text,
	count(*) = 28,
	'Image Task-Tag links'
FROM task_tags tt
JOIN tasks t ON t.id = tt.task_id
JOIN notes n ON n.id = t.source_note_id
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'IMAGE'
UNION ALL SELECT
		'library_audio_count',
		'13',
		count(*)::text,
		count(*) = 13,
		'A1 Library Audio'
FROM library_audio la
JOIN a1 ON a1.id = la.account_id
JOIN audio_sources src ON src.id = la.audio_source_id
WHERE src.storage_key LIKE 'a1-audio-%'

UNION ALL SELECT
		'a1_audio_source_count',
		'13',
		count(*)::text,
		count(*) = 13,
		'deterministic A1 Audio sources'
FROM audio_sources src
WHERE src.storage_key LIKE 'a1-audio-%'

UNION ALL SELECT
		'valid_a1_audio_upload_shape',
		'13',
		count(*)::text,
		count(*) = 13,
		'A1 Audio upload shape'
FROM audio_sources src
WHERE src.storage_key LIKE 'a1-audio-%'
	AND src.origin = 'UPLOAD'
	AND src.external_url IS NULL
	AND src.original_filename IS NOT NULL
	AND src.media_type = 'audio/mpeg'
	AND src.size_bytes >= 0

UNION ALL SELECT
		'audio_note_count',
		'13',
		count(*)::text,
		count(*) = 13,
		'A1 AUDIO Notes'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'

UNION ALL SELECT
		'invalid_audio_note_provenance',
		'0',
		count(*)::text,
		count(*) = 0,
		'AUDIO provenance shape'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND (
			n.youtube_source_id IS NOT NULL
			OR n.image_source_id IS NOT NULL
			OR n.audio_source_id IS NULL
	)

UNION ALL SELECT
		'audio_note_missing_library',
		'0',
		count(*)::text,
		count(*) = 0,
		'AUDIO Notes resolve to same-account Library Audio'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND NOT EXISTS (
			SELECT 1
			FROM library_audio la
			WHERE la.account_id = n.account_id
				AND la.audio_source_id = n.audio_source_id
	)

UNION ALL SELECT
		'audio_timestamp_zero_count',
		'3',
		count(*)::text,
		count(*) = 3,
		'AUDIO timestamp zero'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND n.timestamp_seconds = 0

UNION ALL SELECT
		'audio_timestamp_positive_count',
		'9',
		count(*)::text,
		count(*) = 9,
		'AUDIO positive timestamps'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND n.timestamp_seconds > 0

UNION ALL SELECT
		'audio_timestamp_null_count',
		'1',
		count(*)::text,
		count(*) = 1,
		'AUDIO null timestamps'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND n.timestamp_seconds IS NULL

UNION ALL SELECT
		'audio_linked_task_count',
		'9',
		count(*)::text,
		count(*) = 9,
		'Audio-linked HAS_SOURCE Tasks'
FROM tasks t
JOIN a1 ON a1.id = t.account_id
JOIN notes n ON n.id = t.source_note_id
WHERE t.source_status = 'HAS_SOURCE'
	AND n.source_type = 'AUDIO'

UNION ALL SELECT
		'audio_note_only_count',
		'4',
		count(*)::text,
		count(*) = 4,
		'Audio Notes with no linked Task'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND NOT EXISTS (
			SELECT 1
			FROM tasks t
			WHERE t.account_id = n.account_id
				AND t.source_note_id = n.id
	)

UNION ALL SELECT
		'categorized_audio_notes',
		'13',
		count(*)::text,
		count(*) = 13,
		'categorized AUDIO Notes'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND n.category_id IS NOT NULL

UNION ALL SELECT
		'categorized_audio_tasks',
		'9',
		count(*)::text,
		count(*) = 9,
		'categorized Audio-linked Tasks'
FROM tasks t
JOIN a1 ON a1.id = t.account_id
JOIN notes n ON n.id = t.source_note_id
WHERE n.source_type = 'AUDIO'
	AND t.category_id IS NOT NULL

UNION ALL SELECT
		'audio_note_tag_links',
		'26',
		count(*)::text,
		count(*) = 26,
		'AUDIO Note-Tag links'
FROM note_tags nt
JOIN notes n ON n.id = nt.note_id
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'

UNION ALL SELECT
		'audio_task_tag_links',
		'22',
		count(*)::text,
		count(*) = 22,
		'Audio Task-Tag links'
FROM task_tags tt
JOIN tasks t ON t.id = tt.task_id
JOIN notes n ON n.id = t.source_note_id
JOIN a1 ON a1.id = t.account_id
WHERE n.source_type = 'AUDIO'

UNION ALL SELECT 'image_media_tag_links','35',count(*)::text,count(*)=35,
    'Image Library uses personal Tags'
FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
JOIN a1 ON a1.id=library.account_id
UNION ALL SELECT 'audio_media_tag_links','25',count(*)::text,count(*)=25,
    'Audio Library uses personal Tags'
FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
JOIN a1 ON a1.id=library.account_id
UNION ALL SELECT 'untagged_image','1',count(*)::text,count(*)=1,
    'origami reference is intentionally untagged at Library level'
FROM library_images library JOIN image_sources source ON source.id=library.image_source_id
JOIN a1 ON a1.id=library.account_id
WHERE source.storage_key='a1-image-01.jpg'
  AND NOT EXISTS (SELECT 1 FROM library_image_tags link WHERE link.library_image_id=library.id)
UNION ALL SELECT 'untagged_audio','1',count(*)::text,count(*)=1,
    'Learning audio is intentionally untagged at Library level'
FROM library_audio library JOIN audio_sources source ON source.id=library.audio_source_id
JOIN a1 ON a1.id=library.account_id
WHERE source.storage_key='a1-audio-05.mp3'
  AND NOT EXISTS (SELECT 1 FROM library_audio_tags link WHERE link.library_audio_id=library.id)
UNION ALL SELECT 'v3_image_review_chains','3',count(*)::text,count(*)=3,
    'earlier design screenshots lead to current-V3 comparison work'
FROM (VALUES
    ('a1-image-05.png','Compare the saved ERD with the current V3 schema'),
    ('a1-image-11.png','Compare the saved workspace screenshot with the current V3 capture flow'),
    ('a1-image-13.png','Update the workflow diagram for the current V3 media flow')
) expected(storage_key,task_title)
JOIN image_sources source ON source.storage_key=expected.storage_key
JOIN notes note ON note.image_source_id=source.id AND note.account_id=(SELECT id FROM a1)
JOIN tasks task ON task.source_note_id=note.id AND task.account_id=(SELECT id FROM a1)
    AND task.title=expected.task_title AND task.source_status='HAS_SOURCE'
UNION ALL SELECT 'media_tag_ownership_violations','0',count(*)::text,count(*)=0,
    'every media Tag belongs to its Library owner'
FROM (
    SELECT library.account_id, tag.account_id AS tag_account_id
    FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
    JOIN tags tag ON tag.id=link.tag_id
    UNION ALL
    SELECT library.account_id, tag.account_id
    FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
    JOIN tags tag ON tag.id=link.tag_id
    UNION ALL
    SELECT library.account_id, tag.account_id
    FROM library_video_tags link JOIN library_videos library ON library.id=link.library_video_id
    JOIN tags tag ON tag.id=link.tag_id
) owned JOIN a1 ON a1.id=owned.account_id
WHERE owned.account_id<>owned.tag_account_id
UNION ALL SELECT 'multi_tag_images','>=1',count(*)::text,count(*)>=1,
    'at least one Image has multiple Tags'
FROM (SELECT library.id FROM library_images library JOIN a1 ON a1.id=library.account_id
      JOIN library_image_tags link ON link.library_image_id=library.id
      GROUP BY library.id HAVING count(*)>=2) tagged
UNION ALL SELECT 'multi_tag_audio','>=1',count(*)::text,count(*)>=1,
    'at least one Audio item has multiple Tags'
FROM (SELECT library.id FROM library_audio library JOIN a1 ON a1.id=library.account_id
      JOIN library_audio_tags link ON link.library_audio_id=library.id
      GROUP BY library.id HAVING count(*)>=2) tagged
UNION ALL SELECT 'shared_media_tags','>=1',count(*)::text,count(*)>=1,
    'one personal Tag spans media types'
FROM tags tag JOIN a1 ON a1.id=tag.account_id
WHERE EXISTS (SELECT 1 FROM library_video_tags link JOIN library_videos library
              ON library.id=link.library_video_id WHERE link.tag_id=tag.id AND library.account_id=a1.id)
  AND EXISTS (SELECT 1 FROM library_image_tags link JOIN library_images library
              ON library.id=link.library_image_id WHERE link.tag_id=tag.id AND library.account_id=a1.id)
UNION ALL SELECT 'image_personal_descriptions','2',count(*)::text,count(*)=2,
    'curated Image descriptions'
FROM library_images library JOIN a1 ON a1.id=library.account_id
WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'audio_personal_descriptions','2',count(*)::text,count(*)=2,
    'curated Audio descriptions'
FROM library_audio library JOIN a1 ON a1.id=library.account_id
WHERE library.personal_description IS NOT NULL
UNION ALL SELECT 'image_fallback_title','1',count(*)::text,count(*)=1,
    'one Image uses the source filename fallback'
FROM library_images library JOIN a1 ON a1.id=library.account_id WHERE library.title IS NULL
UNION ALL SELECT 'audio_fallback_title','1',count(*)::text,count(*)=1,
    'one Audio item uses the source filename fallback'
FROM library_audio library JOIN a1 ON a1.id=library.account_id WHERE library.title IS NULL
UNION ALL SELECT 'image_personal_metadata_identity','0',count(*)::text,count(*)=0,
    'exact Image title and description fixture intent'
FROM library_images library JOIN a1 ON a1.id=library.account_id
JOIN image_sources source ON source.id=library.image_source_id
WHERE (source.storage_key='a1-image-01.jpg' AND
       (library.title IS NOT NULL OR library.personal_description IS NOT NULL))
   OR (source.storage_key='a1-image-02.jpg' AND
       (library.title IS DISTINCT FROM 'Philosophy Study Mind Map' OR
        library.personal_description IS DISTINCT FROM
        'Sơ đồ Triết học: đối chiếu các chủ đề trước buổi ôn tập.'))
UNION ALL SELECT 'audio_personal_metadata_identity','0',count(*)::text,count(*)=0,
    'exact Audio title and description fixture intent'
FROM library_audio library JOIN a1 ON a1.id=library.account_id
JOIN audio_sources source ON source.id=library.audio_source_id
WHERE (source.storage_key='a1-audio-01.mp3' AND (library.title IS NOT NULL OR library.personal_description IS NOT NULL))
   OR (source.storage_key='a1-audio-02.mp3' AND
       (library.title IS DISTINCT FROM 'Education' OR library.personal_description IS DISTINCT FROM
        'Đối chiếu cơ hội giáo dục và thói quen học suốt đời.'))
UNION ALL SELECT 'normalized_description_marker','2',count(*)::text,count(*)=2,
    'Vietnamese accent and d-stroke search markers'
FROM (
    SELECT library.personal_description AS description FROM library_images library JOIN a1 ON a1.id=library.account_id
    UNION ALL
    SELECT library.personal_description FROM library_audio library JOIN a1 ON a1.id=library.account_id
) descriptions
WHERE lifelab_search_normalize(descriptions.description) LIKE '%doi chieu%'
UNION ALL SELECT 'image_media_tag_identity','1',count(*)::text,count(*)=1,
    'Philosophy study image keeps its review Tag'
FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
JOIN image_sources source ON source.id=library.image_source_id
JOIN tags tag ON tag.id=link.tag_id JOIN a1 ON a1.id=library.account_id
WHERE source.storage_key='a1-image-02.jpg' AND tag.normalized_name=lower('Ôn tập')
UNION ALL SELECT 'audio_media_tag_identity','1',count(*)::text,count(*)=1,
    'Education audio keeps its important Tag'
FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
JOIN audio_sources source ON source.id=library.audio_source_id
JOIN tags tag ON tag.id=link.tag_id JOIN a1 ON a1.id=library.account_id
WHERE source.storage_key='a1-audio-02.mp3' AND tag.normalized_name=lower('Quan trọng')
UNION ALL SELECT 'media_zero_result_marker','0',count(*)::text,count(*)=0,
    'known zero-result Library query'
FROM (
    SELECT coalesce(library.title,source.original_filename) AS title, library.personal_description AS description
    FROM library_images library JOIN image_sources source ON source.id=library.image_source_id JOIN a1 ON a1.id=library.account_id
    UNION ALL
    SELECT coalesce(library.title,source.original_filename),library.personal_description
    FROM library_audio library JOIN audio_sources source ON source.id=library.audio_source_id JOIN a1 ON a1.id=library.account_id
) media
WHERE lifelab_search_normalize(media.title || ' ' || coalesce(media.description,'')) LIKE '%no matching media 2026%';

WITH a1 AS (SELECT id FROM accounts WHERE lower(email)='demo@lifelab.local'),
matched AS (
    SELECT fixture.*, note.id AS note_id, note.account_id AS note_account_id,
           category.name AS actual_category, category.account_id AS category_account_id
    FROM a1_expected_organization fixture
    LEFT JOIN youtube_videos video ON fixture.source_kind='VIDEO'
        AND video.youtube_video_id=fixture.source_identity
    LEFT JOIN image_sources image ON fixture.source_kind='IMAGE'
        AND image.storage_key=fixture.source_identity
    LEFT JOIN audio_sources audio ON fixture.source_kind='AUDIO'
        AND audio.storage_key=fixture.source_identity
    LEFT JOIN notes note ON note.account_id=(SELECT id FROM a1)
        AND note.content=fixture.content
        AND note.timestamp_seconds IS NOT DISTINCT FROM fixture.timestamp_seconds
        AND ((fixture.source_kind='VIDEO' AND note.youtube_source_id=video.id)
          OR (fixture.source_kind='IMAGE' AND note.image_source_id=image.id)
          OR (fixture.source_kind='AUDIO' AND note.audio_source_id=audio.id))
    LEFT JOIN categories category ON category.id=note.category_id
)
SELECT 'manifest_rows','123',count(*)::text,count(*)=123,'explicit stable-key Note organization'
FROM a1_expected_organization
UNION ALL SELECT 'manifest_exact_matches','123',count(*)::text,count(*)=123,
    'exact Source, Note content, timestamp, Category and complete Tag set'
FROM matched
WHERE note_id IS NOT NULL AND actual_category=category_name
  AND category_account_id=(SELECT id FROM a1)
  AND coalesce((SELECT jsonb_agg(tag.name ORDER BY tag.name)
                FROM note_tags link JOIN tags tag ON tag.id=link.tag_id
                WHERE link.note_id=matched.note_id),'[]'::jsonb)
      = (SELECT jsonb_agg(name ORDER BY name)
         FROM jsonb_array_elements_text(matched.tag_names) names(name))
UNION ALL SELECT 'manifest_distinct_notes','123',count(DISTINCT note_id)::text,
    count(DISTINCT note_id)=123,'no manifest key aliases another Note'
FROM matched
UNION ALL SELECT 'video_note_count','96',count(*)::text,count(*)=96,
    'current and historical Video Notes'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL
UNION ALL SELECT 'note_tag_links','225',count(*)::text,count(*)=225,
    'exact A1 Video, Image and Audio Note-Tag links'
FROM note_tags link JOIN notes note ON note.id=link.note_id
JOIN a1 ON a1.id=note.account_id
UNION ALL SELECT 'categorized_notes','123',count(*)::text,count(*)=123,
    'all A1 Notes have Category'
FROM notes note JOIN a1 ON a1.id=note.account_id WHERE note.category_id IS NOT NULL
UNION ALL SELECT 'notes_without_category','0',count(*)::text,count(*)=0,
    'no A1 Note lacks Category'
FROM notes note JOIN a1 ON a1.id=note.account_id WHERE note.category_id IS NULL
UNION ALL SELECT 'tagged_notes','123',count(*)::text,count(*)=123,
    'all A1 Notes have at least one Tag'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id)
UNION ALL SELECT 'notes_without_tags','0',count(*)::text,count(*)=0,
    'no A1 Note lacks Tags'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE NOT EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id)
UNION ALL SELECT 'categorized_video_notes','96',count(*)::text,count(*)=96,
    'all Video Notes have Category'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL AND note.category_id IS NOT NULL
UNION ALL SELECT 'tagged_video_notes','96',count(*)::text,count(*)=96,
    'all Video Notes have Tag'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id)
UNION ALL SELECT 'categorized_image_notes','14',count(*)::text,count(*)=14,
    'all Image Notes have Category'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.image_source_id IS NOT NULL AND note.category_id IS NOT NULL
UNION ALL SELECT 'tagged_image_notes','14',count(*)::text,count(*)=14,
    'all Image Notes have Tag'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.image_source_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id)
UNION ALL SELECT 'categorized_audio_notes','13',count(*)::text,count(*)=13,
    'all Audio Notes have Category'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.audio_source_id IS NOT NULL AND note.category_id IS NOT NULL
UNION ALL SELECT 'tagged_audio_notes','13',count(*)::text,count(*)=13,
    'all Audio Notes have Tag'
FROM notes note JOIN a1 ON a1.id=note.account_id
WHERE note.audio_source_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id)
UNION ALL SELECT 'note_category_ownership','0',count(*)::text,count(*)=0,
    'every Note Category belongs to A1'
FROM notes note JOIN a1 ON a1.id=note.account_id
JOIN categories category ON category.id=note.category_id
WHERE category.account_id<>note.account_id
UNION ALL SELECT 'note_tag_ownership','0',count(*)::text,count(*)=0,
    'every Note Tag belongs to A1'
FROM notes note JOIN a1 ON a1.id=note.account_id
JOIN note_tags link ON link.note_id=note.id JOIN tags tag ON tag.id=link.tag_id
WHERE tag.account_id<>note.account_id
UNION ALL SELECT 'duplicate_note_tag_links','0',count(*)::text,count(*)=0,
    'no duplicate Note/Tag pair'
FROM (SELECT link.note_id,link.tag_id FROM note_tags link
      JOIN notes note ON note.id=link.note_id JOIN a1 ON a1.id=note.account_id
      GROUP BY link.note_id,link.tag_id HAVING count(*)>1) duplicates
UNION ALL SELECT 'organized_has_source_tasks','79',count(*)::text,count(*)=79,
    'all exact-source Tasks have coherent organization'
FROM tasks task JOIN a1 ON a1.id=task.account_id
JOIN notes note ON note.id=task.source_note_id
WHERE task.source_status='HAS_SOURCE' AND task.category_id=note.category_id
  AND task.category_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM task_tags link WHERE link.task_id=task.id);
ROLLBACK;
