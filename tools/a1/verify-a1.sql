BEGIN TRANSACTION READ ONLY;
WITH a1 AS (SELECT id FROM accounts WHERE lower(email)='demo@lifelab.local'), ids AS (SELECT unnest(string_to_array(:'snapshot_ids',',')) AS youtube_video_id), current_sources AS (SELECT y.youtube_video_id FROM library_videos l JOIN a1 ON a1.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id), current_task_distribution AS (SELECT c.youtube_video_id, count(DISTINCT t.id) AS task_count FROM current_sources c JOIN youtube_videos y ON y.youtube_video_id=c.youtube_video_id LEFT JOIN notes n ON n.youtube_source_id=y.id AND n.account_id=(SELECT id FROM a1) LEFT JOIN tasks t ON t.source_note_id=n.id AND t.source_status='HAS_SOURCE' AND t.account_id=(SELECT id FROM a1) GROUP BY c.youtube_video_id)
SELECT 'account_count','1',count(*)::text,count(*)=1,'A1 account' FROM a1
UNION ALL SELECT 'library_count','36',count(*)::text,count(*)=36,'current Library rows' FROM library_videos l JOIN a1 ON a1.id=l.account_id
UNION ALL SELECT 'global_source_count','37',count(*)::text,count(*)=37,'locked globals present' FROM youtube_videos y JOIN ids ON ids.youtube_video_id=y.youtube_video_id
UNION ALL SELECT 'h1_absent_library','0',count(*)::text,count(*)=0,'H1 historical' FROM current_sources WHERE youtube_video_id='-XsRLyKV9_k'
UNION ALL SELECT 'tag_count','38',count(*)::text,count(*)=38,'A1 tags' FROM tags t JOIN a1 ON a1.id=t.account_id
UNION ALL SELECT 'tag_link_count','100',count(*)::text,count(*)=100,'A1 tag links' FROM library_video_tags r JOIN library_videos l ON l.id=r.library_video_id JOIN a1 ON a1.id=l.account_id
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
		'10',
		count(*)::text,
		count(*) = 10,
		'AUDIO positive timestamps'
FROM notes n
JOIN a1 ON a1.id = n.account_id
WHERE n.source_type = 'AUDIO'
	AND n.timestamp_seconds > 0

UNION ALL SELECT
		'audio_timestamp_null_count',
		'0',
		count(*)::text,
		count(*) = 0,
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
WHERE n.source_type = 'AUDIO';
ROLLBACK;
