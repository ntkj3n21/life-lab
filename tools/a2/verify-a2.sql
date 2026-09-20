CREATE TEMP TABLE a2_checks(check_name text,expected text,actual text,passed boolean,details text);
CREATE TEMP TABLE a2_account AS SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local';

INSERT INTO a2_checks SELECT 'account_count','1',count(*)::text,count(*)=1,'locked A2 identity' FROM a2_account;
INSERT INTO a2_checks SELECT 'library_count','80',count(*)::text,count(*)=80,'final current Library rows' FROM library_videos l JOIN a2_account a ON a.id=l.account_id;
INSERT INTO a2_checks
SELECT 'current_source_set','80 exact',count(*) FILTER(WHERE present)::text||' present / '||count(*) FILTER(WHERE NOT present)||' missing',bool_and(present),'exact current membership'
FROM (SELECT e.fixture_key,EXISTS(SELECT 1 FROM library_videos l JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id WHERE y.youtube_video_id=e.youtube_video_id) present FROM a2_expected_sources e WHERE role='CURRENT_LIBRARY') x;
INSERT INTO a2_checks
SELECT 'historical_library_absent','0',count(*)::text,count(*)=0,'20 historical IDs must not have A2 Library rows'
FROM library_videos l JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id JOIN a2_expected_sources e USING(youtube_video_id) WHERE e.role='HISTORICAL';
INSERT INTO a2_checks SELECT 'global_sources','100',count(*)::text,count(*)=100,'all locked IDs exist globally' FROM youtube_videos y JOIN a2_expected_sources e USING(youtube_video_id);
INSERT INTO a2_checks SELECT 'library_duplicates','0',count(*)::text,count(*)=0,'unique account/source' FROM (SELECT youtube_source_id FROM library_videos l JOIN a2_account a ON a.id=l.account_id GROUP BY youtube_source_id HAVING count(*)>1)x;
INSERT INTO a2_checks SELECT 'source_compatibility','0',count(*)::text,count(*)=0,'AVAILABLE and <=1 second only for explicit shared sources' FROM youtube_videos y JOIN a2_expected_sources e USING(youtube_video_id) WHERE y.availability_status<>'AVAILABLE' OR (e.shared AND abs(y.duration_seconds-e.duration_seconds)>1) OR (NOT e.shared AND y.duration_seconds<>e.duration_seconds);
INSERT INTO a2_checks SELECT 'source_time_invariants','0',count(*)::text,count(*)=0,'non-shared source created/published/updated/reference ordering' FROM youtube_videos y JOIN a2_expected_sources e USING(youtube_video_id) WHERE NOT e.shared AND (y.created_at<y.published_at OR y.created_at>y.updated_at OR y.created_at>((:'reference_date'::date::timestamp+time '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh'));

INSERT INTO a2_checks
SELECT
    'tag_count',
    '55',
    count(*)::text,
    count(*) = 55,
    '25 baseline Video Tags + 22 Image-specific Tags + 8 Audio-specific Tags'
FROM tags t
JOIN a2_account a
  ON a.id = t.account_id;
INSERT INTO a2_checks SELECT 'tag_normalization','0',count(*)::text,count(*)=0,'normalized unique collapsed lowercase names' FROM tags t JOIN a2_account a ON a.id=t.account_id WHERE normalized_name<>lower(regexp_replace(btrim(name),'\s+',' ','g'));
INSERT INTO a2_checks SELECT 'tag_links','200',count(*)::text,count(*)=200,'exact final current links' FROM library_video_tags x JOIN library_videos l ON l.id=x.library_video_id JOIN a2_account a ON a.id=l.account_id;
INSERT INTO a2_checks SELECT 'all_tags_used','25',count(DISTINCT x.tag_id)::text,count(DISTINCT x.tag_id)=25,'all 25 baseline Video Tags used by Library Video links' FROM library_video_tags x JOIN tags t ON t.id=x.tag_id JOIN a2_account a ON a.id=t.account_id;
INSERT INTO a2_checks SELECT 'tag_link_distribution','0',count(*)::text,count(*)=0,'exact TSV relationships' FROM ((SELECT e.fixture_key,lower(e.tag_name) tag_name FROM a2_expected_links e EXCEPT SELECT s.fixture_key,lower(t.name) FROM library_video_tags x JOIN library_videos l ON l.id=x.library_video_id JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id JOIN a2_expected_sources s USING(youtube_video_id) JOIN tags t ON t.id=x.tag_id) UNION ALL (SELECT s.fixture_key,lower(t.name) FROM library_video_tags x JOIN library_videos l ON l.id=x.library_video_id JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id JOIN a2_expected_sources s USING(youtube_video_id) JOIN tags t ON t.id=x.tag_id EXCEPT SELECT e.fixture_key,lower(e.tag_name) FROM a2_expected_links e))d;

INSERT INTO a2_checks SELECT 'watch_total','1000',count(*)::text,count(*)=1000,'closed current sessions' FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN a2_account a ON a.id=l.account_id;
INSERT INTO a2_checks SELECT 'watch_valid','780',count(*)::text,count(*)=780,'VALID only' FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN a2_account a ON a.id=l.account_id WHERE validity_status='VALID';
INSERT INTO a2_checks SELECT 'watch_invalid','220',count(*)::text,count(*)=220,'INVALID only' FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN a2_account a ON a.id=l.account_id WHERE validity_status='INVALID';
INSERT INTO a2_checks SELECT 'watch_other_states','0',count(*)::text,count(*)=0,'no PENDING/UNDETERMINED' FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN a2_account a ON a.id=l.account_id WHERE validity_status NOT IN('VALID','INVALID');
INSERT INTO a2_checks SELECT 'watched_current','64/16',count(*) FILTER(WHERE valid_count>0)::text||'/'||count(*) FILTER(WHERE valid_count=0),count(*) FILTER(WHERE valid_count>0)=64 AND count(*) FILTER(WHERE valid_count=0)=16,'derived watched/unwatched' FROM (SELECT l.id,count(w.id) FILTER(WHERE w.validity_status='VALID') valid_count FROM library_videos l JOIN a2_account a ON a.id=l.account_id LEFT JOIN watch_sessions w ON w.library_video_id=l.id GROUP BY l.id)x;
INSERT INTO a2_checks SELECT 'watch_distribution','0',count(*)::text,count(*)=0,'per-source VALID/INVALID TSV' FROM (SELECT e.fixture_key,e.valid_count,e.invalid_count,count(w.id) FILTER(WHERE w.validity_status='VALID') av,count(w.id) FILTER(WHERE w.validity_status='INVALID') ai FROM a2_expected_watch e JOIN a2_expected_sources s USING(fixture_key) JOIN youtube_videos y USING(youtube_video_id) JOIN library_videos l ON l.youtube_source_id=y.id JOIN a2_account a ON a.id=l.account_id LEFT JOIN watch_sessions w ON w.library_video_id=l.id GROUP BY e.fixture_key,e.valid_count,e.invalid_count HAVING count(w.id) FILTER(WHERE w.validity_status='VALID')<>e.valid_count OR count(w.id) FILTER(WHERE w.validity_status='INVALID')<>e.invalid_count)x;
INSERT INTO a2_checks SELECT 'watch_invariants','0',count(*)::text,count(*)=0,'closed, ordered, threshold-valid and plausible' FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id WHERE w.ended_at IS NULL OR w.started_at>w.last_heartbeat_at OR w.last_heartbeat_at>w.ended_at OR w.started_at<l.added_at OR (w.validity_status='VALID' AND w.watch_time_seconds<30) OR (w.validity_status='INVALID' AND w.watch_time_seconds>=30) OR w.watch_time_seconds>y.duration_seconds OR w.watch_time_seconds>extract(epoch FROM(w.ended_at-w.started_at));

INSERT INTO a2_checks
SELECT
    'note_total',
    '268',
    count(*)::text,
    count(*) = 268,
    '240 YouTube Notes + 20 Image Notes + 8 Audio Notes'
FROM notes n
JOIN a2_account a
  ON a.id = n.account_id;
INSERT INTO a2_checks SELECT 'note_role_counts','200/40',count(*) FILTER(WHERE e.role='CURRENT_LIBRARY')::text||'/'||count(*) FILTER(WHERE e.role='HISTORICAL'),count(*) FILTER(WHERE e.role='CURRENT_LIBRARY')=200 AND count(*) FILTER(WHERE e.role='HISTORICAL')=40,'current/historical Notes' FROM notes n JOIN a2_account a ON a.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id JOIN a2_expected_sources e USING(youtube_video_id);
INSERT INTO a2_checks
SELECT
    'note_timestamp_counts',
    '120/120',
    count(*) FILTER (
        WHERE timestamp_seconds IS NOT NULL
    )::text
        || '/'
        || count(*) FILTER (
            WHERE timestamp_seconds IS NULL
        ),
    count(*) FILTER (
        WHERE timestamp_seconds IS NOT NULL
    ) = 120
    AND count(*) FILTER (
        WHERE timestamp_seconds IS NULL
    ) = 120,
    'YouTube Notes only: timestamped/NULL'
FROM notes n
JOIN a2_account a
  ON a.id = n.account_id
WHERE n.source_type = 'YOUTUBE';
INSERT INTO a2_checks SELECT 'note_fixture_distribution','0',count(*)::text,count(*)=0,'content-independent per-source/timestamp multiset' FROM ((SELECT e.youtube_video_id,e.timestamp_seconds,count(*) FROM a2_expected_notes e GROUP BY e.youtube_video_id,e.timestamp_seconds EXCEPT SELECT y.youtube_video_id,n.timestamp_seconds,count(*) FROM notes n JOIN a2_account a ON a.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id GROUP BY y.youtube_video_id,n.timestamp_seconds) UNION ALL (SELECT y.youtube_video_id,n.timestamp_seconds,count(*) FROM notes n JOIN a2_account a ON a.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id GROUP BY y.youtube_video_id,n.timestamp_seconds EXCEPT SELECT e.youtube_video_id,e.timestamp_seconds,count(*) FROM a2_expected_notes e GROUP BY e.youtube_video_id,e.timestamp_seconds))d;
INSERT INTO a2_checks SELECT 'note_vtt_evidence','0',count(*)::text,count(*)=0,'exact source cue evidence and effective DB duration bounds' FROM a2_expected_notes e JOIN a2_expected_sources s USING(fixture_key) JOIN youtube_videos y ON y.youtube_video_id=e.youtube_video_id WHERE e.timestamp_seconds IS NOT NULL AND (e.vtt_track IS NULL OR e.timestamp_seconds IS DISTINCT FROM e.cue_start_seconds OR e.timestamp_seconds<0 OR e.timestamp_seconds>=s.duration_seconds OR e.timestamp_seconds>=y.duration_seconds);
INSERT INTO a2_checks SELECT 'no_vtt_timestamp','0',count(*)::text,count(*)=0,'six no-VTT sources have no timestamped fixture' FROM a2_expected_notes n JOIN a2_expected_sources s USING(fixture_key) WHERE NOT s.has_vtt AND n.timestamp_seconds IS NOT NULL;

INSERT INTO a2_checks
SELECT
    'task_total',
    '418',
    count(*)::text,
    count(*) = 418,
    '400 baseline Tasks + 13 Image Tasks + 5 Audio Tasks'
FROM tasks t
JOIN a2_account a
  ON a.id = t.account_id;
INSERT INTO a2_checks
SELECT
    'task_source_matrix',
    '188/190/40',
    count(*) FILTER (
        WHERE source_status = 'HAS_SOURCE'
    )::text
        || '/'
        || count(*) FILTER (
            WHERE source_status = 'INDEPENDENT'
        )
        || '/'
        || count(*) FILTER (
            WHERE source_status = 'SOURCE_MISSING'
        ),
    count(*) FILTER (
        WHERE source_status = 'HAS_SOURCE'
    ) = 188
    AND count(*) FILTER (
        WHERE source_status = 'INDEPENDENT'
    ) = 190
    AND count(*) FILTER (
        WHERE source_status = 'SOURCE_MISSING'
    ) = 40,
    'HAS/INDEPENDENT/MISSING including Image and Audio Tasks'
FROM tasks t
JOIN a2_account a
  ON a.id = t.account_id;
INSERT INTO a2_checks
SELECT
    'task_status_matrix',
    '250/97/71',
    count(*) FILTER (
        WHERE status = 'COMPLETED'
    )::text
        || '/'
        || count(*) FILTER (
            WHERE status = 'NOT_STARTED'
        )
        || '/'
        || count(*) FILTER (
            WHERE status = 'IN_PROGRESS'
        ),
    count(*) FILTER (
        WHERE status = 'COMPLETED'
    ) = 250
    AND count(*) FILTER (
        WHERE status = 'NOT_STARTED'
    ) = 97
    AND count(*) FILTER (
        WHERE status = 'IN_PROGRESS'
    ) = 71,
    'COMPLETED/NOT_STARTED/IN_PROGRESS'
FROM tasks t
JOIN a2_account a
  ON a.id = t.account_id;
INSERT INTO a2_checks
SELECT
    'task_cross_matrix',
    '0',
    count(*)::text,
    count(*) = 0,
    'locked baseline 400-Task source/status cross matrix'
FROM (
    SELECT
        t.source_status,
        count(*) FILTER (
            WHERE t.status = 'COMPLETED'
        ) AS c,
        count(*) FILTER (
            WHERE t.status = 'NOT_STARTED'
        ) AS n,
        count(*) FILTER (
            WHERE t.status = 'IN_PROGRESS'
        ) AS p
    FROM tasks t
    JOIN a2_account a
      ON a.id = t.account_id
    LEFT JOIN notes source_note
      ON source_note.id = t.source_note_id
    WHERE NOT (
        t.source_status = 'HAS_SOURCE'
        AND source_note.source_type IN (
            'IMAGE',
            'AUDIO'
        )
    )
    GROUP BY t.source_status
) x
WHERE
    (
        source_status = 'HAS_SOURCE'
        AND (c,n,p) <> (95,40,35)
    )
    OR (
        source_status = 'INDEPENDENT'
        AND (c,n,p) <> (130,35,25)
    )
    OR (
        source_status = 'SOURCE_MISSING'
        AND (c,n,p) <> (25,10,5)
    );
INSERT INTO a2_checks SELECT 'task_source_integrity','0',count(*)::text,count(*)=0,'same-account links and NULL source rules' FROM tasks t JOIN a2_account a ON a.id=t.account_id LEFT JOIN notes n ON n.id=t.source_note_id WHERE (t.source_status='HAS_SOURCE' AND(n.id IS NULL OR n.account_id<>t.account_id)) OR(t.source_status IN('INDEPENDENT','SOURCE_MISSING') AND t.source_note_id IS NOT NULL) OR(n.id IS NOT NULL AND n.created_at>t.created_at);
INSERT INTO a2_checks SELECT 'temp_notes_absent','0',count(*)::text,count(*)=0,'SOURCE_MISSING lifecycle temp Notes removed' FROM notes n JOIN a2_account a ON a.id=n.account_id WHERE content LIKE 'A2 temporary source lifecycle fixture %';

WITH classified AS (
    SELECT
        CASE
            WHEN status = 'COMPLETED'
                THEN 'COMPLETED'
            WHEN deadline IS NULL
                THEN 'NO_DEADLINE'
            WHEN deadline < :'reference_date'::date
                THEN 'OVERDUE'
            WHEN deadline = :'reference_date'::date
                THEN 'TODAY'
            ELSE 'UPCOMING'
        END AS bucket
    FROM tasks t
    JOIN a2_account a
      ON a.id = t.account_id
)
INSERT INTO a2_checks
SELECT
    'daily_plan_matrix',
    '250/25/13/58/72',
    count(*) FILTER (
        WHERE bucket = 'COMPLETED'
    )::text
        || '/'
        || count(*) FILTER (
            WHERE bucket = 'OVERDUE'
        )
        || '/'
        || count(*) FILTER (
            WHERE bucket = 'TODAY'
        )
        || '/'
        || count(*) FILTER (
            WHERE bucket = 'UPCOMING'
        )
        || '/'
        || count(*) FILTER (
            WHERE bucket = 'NO_DEADLINE'
        ),
    count(*) FILTER (
        WHERE bucket = 'COMPLETED'
    ) = 250
    AND count(*) FILTER (
        WHERE bucket = 'OVERDUE'
    ) = 25
    AND count(*) FILTER (
        WHERE bucket = 'TODAY'
    ) = 13
    AND count(*) FILTER (
        WHERE bucket = 'UPCOMING'
    ) = 58
    AND count(*) FILTER (
        WHERE bucket = 'NO_DEADLINE'
    ) = 72,
    'production precedence at reference date'
FROM classified;

INSERT INTO a2_checks SELECT 'time_invariants','0',count(*)::text,count(*)=0,'publication/library/note/task created-updated ordering' FROM (SELECT 1 FROM library_videos l JOIN a2_account a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id WHERE y.published_at>l.added_at OR l.added_at>l.updated_at UNION ALL SELECT 1 FROM notes n JOIN a2_account a ON a.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id WHERE y.published_at>n.created_at OR n.created_at>n.updated_at UNION ALL SELECT 1 FROM tasks t JOIN a2_account a ON a.id=t.account_id WHERE t.created_at>t.updated_at)x;

INSERT INTO a2_checks
SELECT
    'image_library_count',
    '20',
    count(*)::text,
    count(*) = 20,
    'A2 Image Library rows'
FROM library_images library
JOIN a2_account account
  ON account.id = library.account_id;

INSERT INTO a2_checks
SELECT
    'image_library_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image external URL/title fixture set'
FROM (
    (
        SELECT
            expected.external_url,
            expected.title
        FROM a2_expected_images expected

        EXCEPT

        SELECT
            source.external_url,
            library.title
        FROM library_images library
        JOIN a2_account account
          ON account.id = library.account_id
        JOIN image_sources source
          ON source.id = library.image_source_id
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            library.title
        FROM library_images library
        JOIN a2_account account
          ON account.id = library.account_id
        JOIN image_sources source
          ON source.id = library.image_source_id

        EXCEPT

        SELECT
            expected.external_url,
            expected.title
        FROM a2_expected_images expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'image_source_shape',
    '0',
    count(*)::text,
    count(*) = 0,
    'all A2 Image fixtures are canonical EXTERNAL sources'
FROM library_images library
JOIN a2_account account
  ON account.id = library.account_id
JOIN image_sources source
  ON source.id = library.image_source_id
WHERE source.origin <> 'EXTERNAL'
   OR source.external_url IS NULL
   OR btrim(source.external_url) = ''
   OR source.external_url LIKE '%Special:Redirect%'
   OR source.storage_key IS NOT NULL
   OR source.original_filename IS NOT NULL
   OR source.media_type IS NOT NULL
   OR source.size_bytes IS NOT NULL;

INSERT INTO a2_checks
SELECT
    'image_note_count',
    '20',
    count(*)::text,
    count(*) = 20,
    'A2 Image Notes'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'IMAGE';

INSERT INTO a2_checks
SELECT
    'image_note_provenance',
    '0',
    count(*)::text,
    count(*) = 0,
    'IMAGE source exclusivity and NULL timestamp'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'IMAGE'
  AND (
      note.youtube_source_id IS NOT NULL
      OR note.image_source_id IS NULL
      OR note.audio_source_id IS NOT NULL
      OR note.timestamp_seconds IS NOT NULL
  );

INSERT INTO a2_checks
SELECT
    'image_note_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image source/content fixture set'
FROM (
    (
        SELECT
            expected.external_url,
            expected.note_content
        FROM a2_expected_images expected

        EXCEPT

        SELECT
            source.external_url,
            note.content
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        WHERE note.source_type = 'IMAGE'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            note.content
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        WHERE note.source_type = 'IMAGE'

        EXCEPT

        SELECT
            expected.external_url,
            expected.note_content
        FROM a2_expected_images expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'image_task_count',
    '13',
    count(*)::text,
    count(*) = 13,
    'Image-linked HAS_SOURCE Tasks'
FROM tasks task
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
WHERE task.source_status = 'HAS_SOURCE'
  AND note.source_type = 'IMAGE';

INSERT INTO a2_checks
SELECT
    'image_note_only_count',
    '7',
    count(*)::text,
    count(*) = 7,
    'Image Notes with no linked Task'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'IMAGE'
  AND NOT EXISTS (
      SELECT 1
      FROM tasks task
      WHERE task.account_id = account.id
        AND task.source_note_id = note.id
  );

INSERT INTO a2_checks
SELECT
    'image_task_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image task title/status/deadline class'
FROM (
    (
        SELECT
            expected.external_url,
            expected.task_title,
            expected.task_status,
            expected.deadline_class
        FROM a2_expected_images expected
        WHERE expected.task_title IS NOT NULL

        EXCEPT

        SELECT
            source.external_url,
            task.title,
            task.status,
            CASE
                WHEN task.deadline IS NULL
                    THEN 'NO_DEADLINE'
                WHEN task.deadline < :'reference_date'::date
                    THEN 'OVERDUE'
                WHEN task.deadline = :'reference_date'::date
                    THEN 'TODAY'
                ELSE 'UPCOMING'
            END
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        WHERE note.source_type = 'IMAGE'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            task.title,
            task.status,
            CASE
                WHEN task.deadline IS NULL
                    THEN 'NO_DEADLINE'
                WHEN task.deadline < :'reference_date'::date
                    THEN 'OVERDUE'
                WHEN task.deadline = :'reference_date'::date
                    THEN 'TODAY'
                ELSE 'UPCOMING'
            END
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        WHERE note.source_type = 'IMAGE'

        EXCEPT

        SELECT
            expected.external_url,
            expected.task_title,
            expected.task_status,
            expected.deadline_class
        FROM a2_expected_images expected
        WHERE expected.task_title IS NOT NULL
    )
) difference;

INSERT INTO a2_checks
SELECT
    'category_count',
    '10',
    count(*)::text,
    count(*) = 10,
    '6 Image Categories + 4 Audio Categories'
FROM categories category
JOIN a2_account account
  ON account.id = category.account_id;

INSERT INTO a2_checks
SELECT
    'image_note_category_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image Note Category mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected.category_name))
        FROM a2_expected_images expected

        EXCEPT

        SELECT
            source.external_url,
            category.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN categories category
          ON category.id = note.category_id
        WHERE note.source_type = 'IMAGE'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            category.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN categories category
          ON category.id = note.category_id
        WHERE note.source_type = 'IMAGE'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected.category_name))
        FROM a2_expected_images expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'image_task_category_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'Image Tasks inherit fixture Category'
FROM tasks task
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
JOIN image_sources source
  ON source.id = note.image_source_id
JOIN a2_expected_images expected
  ON expected.external_url = source.external_url
LEFT JOIN categories category
  ON category.id = task.category_id
WHERE note.source_type = 'IMAGE'
  AND (
      category.id IS NULL
      OR category.account_id <> account.id
      OR category.normalized_name <>
            lower(btrim(expected.category_name))
  );

INSERT INTO a2_checks
SELECT
    'image_note_tag_links',
    '41',
    count(*)::text,
    count(*) = 41,
    'Image Note-tag links'
FROM note_tags link
JOIN notes note
  ON note.id = link.note_id
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'IMAGE';

INSERT INTO a2_checks
SELECT
    'image_task_tag_links',
    '27',
    count(*)::text,
    count(*) = 27,
    'Image Task-tag links'
FROM task_tags link
JOIN tasks task
  ON task.id = link.task_id
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
WHERE note.source_type = 'IMAGE';

INSERT INTO a2_checks
SELECT
    'image_note_tag_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image Note Tag mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_images expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)

        EXCEPT

        SELECT
            source.external_url,
            tag.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN note_tags link
          ON link.note_id = note.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'IMAGE'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            tag.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN note_tags link
          ON link.note_id = note.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'IMAGE'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_images expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
    )
) difference;

INSERT INTO a2_checks
SELECT
    'image_task_tag_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Image Task Tag mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_images expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
        WHERE expected.task_title IS NOT NULL

        EXCEPT

        SELECT
            source.external_url,
            tag.normalized_name
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN task_tags link
          ON link.task_id = task.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'IMAGE'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            tag.normalized_name
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN image_sources source
          ON source.id = note.image_source_id
        JOIN task_tags link
          ON link.task_id = task.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'IMAGE'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_images expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
        WHERE expected.task_title IS NOT NULL
    )
) difference;

-- ---------------------------------------------------------------------------
-- A2 V2 Audio verification
-- ---------------------------------------------------------------------------

INSERT INTO a2_checks
SELECT
    'audio_library_count',
    '8',
    count(*)::text,
    count(*) = 8,
    'A2 Audio Library rows'
FROM library_audio library
JOIN a2_account account
  ON account.id = library.account_id;

INSERT INTO a2_checks
SELECT
    'audio_library_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio external URL/title fixture set'
FROM (
    (
        SELECT
            expected.external_url,
            expected.title
        FROM a2_expected_audio expected

        EXCEPT

        SELECT
            source.external_url,
            library.title
        FROM library_audio library
        JOIN a2_account account
          ON account.id = library.account_id
        JOIN audio_sources source
          ON source.id = library.audio_source_id
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            library.title
        FROM library_audio library
        JOIN a2_account account
          ON account.id = library.account_id
        JOIN audio_sources source
          ON source.id = library.audio_source_id

        EXCEPT

        SELECT
            expected.external_url,
            expected.title
        FROM a2_expected_audio expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'audio_source_shape',
    '0',
    count(*)::text,
    count(*) = 0,
    'all A2 Audio fixtures are canonical EXTERNAL sources'
FROM library_audio library
JOIN a2_account account
  ON account.id = library.account_id
JOIN audio_sources source
  ON source.id = library.audio_source_id
WHERE source.origin <> 'EXTERNAL'
   OR source.external_url IS NULL
   OR btrim(source.external_url) = ''
   OR source.storage_key IS NOT NULL
   OR source.original_filename IS NOT NULL
   OR source.media_type IS NOT NULL
   OR source.size_bytes IS NOT NULL;

INSERT INTO a2_checks
SELECT
    'audio_note_count',
    '8',
    count(*)::text,
    count(*) = 8,
    'A2 Audio Notes'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'AUDIO';

INSERT INTO a2_checks
SELECT
    'audio_note_provenance',
    '0',
    count(*)::text,
    count(*) = 0,
    'AUDIO source exclusivity and nonnegative timestamp'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'AUDIO'
  AND (
      note.youtube_source_id IS NOT NULL
      OR note.image_source_id IS NOT NULL
      OR note.audio_source_id IS NULL
      OR note.timestamp_seconds IS NULL
      OR note.timestamp_seconds < 0
  );

INSERT INTO a2_checks
SELECT
    'audio_timestamp_distribution',
    '3/5',
    count(*) FILTER (
        WHERE note.timestamp_seconds = 0
    )::text
        || '/'
        || count(*) FILTER (
            WHERE note.timestamp_seconds > 0
        ),
    count(*) FILTER (
        WHERE note.timestamp_seconds = 0
    ) = 3
    AND count(*) FILTER (
        WHERE note.timestamp_seconds > 0
    ) = 5,
    'timestamp zero/positive'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'AUDIO';

INSERT INTO a2_checks
SELECT
    'audio_note_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio source/content/timestamp fixture set'
FROM (
    (
        SELECT
            expected.external_url,
            expected.note_content,
            expected.timestamp_seconds
        FROM a2_expected_audio expected

        EXCEPT

        SELECT
            source.external_url,
            note.content,
            note.timestamp_seconds
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        WHERE note.source_type = 'AUDIO'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            note.content,
            note.timestamp_seconds
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        WHERE note.source_type = 'AUDIO'

        EXCEPT

        SELECT
            expected.external_url,
            expected.note_content,
            expected.timestamp_seconds
        FROM a2_expected_audio expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'audio_task_count',
    '5',
    count(*)::text,
    count(*) = 5,
    'Audio-linked HAS_SOURCE Tasks'
FROM tasks task
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
WHERE task.source_status = 'HAS_SOURCE'
  AND note.source_type = 'AUDIO';

INSERT INTO a2_checks
SELECT
    'audio_note_only_count',
    '3',
    count(*)::text,
    count(*) = 3,
    'Audio Notes without a linked Task'
FROM notes note
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'AUDIO'
  AND NOT EXISTS (
      SELECT 1
      FROM tasks task
      WHERE task.account_id = account.id
        AND task.source_note_id = note.id
  );

INSERT INTO a2_checks
SELECT
    'audio_task_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio task title/status/deadline class'
FROM (
    (
        SELECT
            expected.external_url,
            expected.task_title,
            expected.task_status,
            expected.deadline_class
        FROM a2_expected_audio expected
        WHERE expected.task_title IS NOT NULL

        EXCEPT

        SELECT
            source.external_url,
            task.title,
            task.status,
            CASE
                WHEN task.deadline IS NULL
                    THEN 'NO_DEADLINE'
                WHEN task.deadline < :'reference_date'::date
                    THEN 'OVERDUE'
                WHEN task.deadline = :'reference_date'::date
                    THEN 'TODAY'
                ELSE 'UPCOMING'
            END
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        WHERE note.source_type = 'AUDIO'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            task.title,
            task.status,
            CASE
                WHEN task.deadline IS NULL
                    THEN 'NO_DEADLINE'
                WHEN task.deadline < :'reference_date'::date
                    THEN 'OVERDUE'
                WHEN task.deadline = :'reference_date'::date
                    THEN 'TODAY'
                ELSE 'UPCOMING'
            END
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        WHERE note.source_type = 'AUDIO'

        EXCEPT

        SELECT
            expected.external_url,
            expected.task_title,
            expected.task_status,
            expected.deadline_class
        FROM a2_expected_audio expected
        WHERE expected.task_title IS NOT NULL
    )
) difference;

INSERT INTO a2_checks
SELECT
    'audio_note_category_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio Note Category mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected.category_name))
        FROM a2_expected_audio expected

        EXCEPT

        SELECT
            source.external_url,
            category.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN categories category
          ON category.id = note.category_id
        WHERE note.source_type = 'AUDIO'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            category.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN categories category
          ON category.id = note.category_id
        WHERE note.source_type = 'AUDIO'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected.category_name))
        FROM a2_expected_audio expected
    )
) difference;

INSERT INTO a2_checks
SELECT
    'audio_task_category_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'Audio Tasks inherit fixture Category'
FROM tasks task
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
JOIN audio_sources source
  ON source.id = note.audio_source_id
JOIN a2_expected_audio expected
  ON expected.external_url = source.external_url
LEFT JOIN categories category
  ON category.id = task.category_id
WHERE note.source_type = 'AUDIO'
  AND (
      category.id IS NULL
      OR category.account_id <> account.id
      OR category.normalized_name <>
            lower(btrim(expected.category_name))
  );

INSERT INTO a2_checks
SELECT
    'audio_note_tag_links',
    '16',
    count(*)::text,
    count(*) = 16,
    'Audio Note-tag links'
FROM note_tags link
JOIN notes note
  ON note.id = link.note_id
JOIN a2_account account
  ON account.id = note.account_id
WHERE note.source_type = 'AUDIO';

INSERT INTO a2_checks
SELECT
    'audio_task_tag_links',
    '10',
    count(*)::text,
    count(*) = 10,
    'Audio Task-tag links'
FROM task_tags link
JOIN tasks task
  ON task.id = link.task_id
JOIN a2_account account
  ON account.id = task.account_id
JOIN notes note
  ON note.id = task.source_note_id
WHERE note.source_type = 'AUDIO';

INSERT INTO a2_checks
SELECT
    'audio_note_tag_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio Note Tag mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_audio expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)

        EXCEPT

        SELECT
            source.external_url,
            tag.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN note_tags link
          ON link.note_id = note.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'AUDIO'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            tag.normalized_name
        FROM notes note
        JOIN a2_account account
          ON account.id = note.account_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN note_tags link
          ON link.note_id = note.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'AUDIO'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_audio expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
    )
) difference;

INSERT INTO a2_checks
SELECT
    'audio_task_tag_distribution',
    '0',
    count(*)::text,
    count(*) = 0,
    'exact Audio Task Tag mapping'
FROM (
    (
        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_audio expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
        WHERE expected.task_title IS NOT NULL

        EXCEPT

        SELECT
            source.external_url,
            tag.normalized_name
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN task_tags link
          ON link.task_id = task.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'AUDIO'
    )

    UNION ALL

    (
        SELECT
            source.external_url,
            tag.normalized_name
        FROM tasks task
        JOIN a2_account account
          ON account.id = task.account_id
        JOIN notes note
          ON note.id = task.source_note_id
        JOIN audio_sources source
          ON source.id = note.audio_source_id
        JOIN task_tags link
          ON link.task_id = task.id
        JOIN tags tag
          ON tag.id = link.tag_id
        WHERE note.source_type = 'AUDIO'

        EXCEPT

        SELECT
            expected.external_url,
            lower(btrim(expected_tag.tag_name))
        FROM a2_expected_audio expected
        CROSS JOIN LATERAL
            jsonb_array_elements_text(
                expected.tags_json
            ) expected_tag(tag_name)
        WHERE expected.task_title IS NOT NULL
    )
) difference;

SELECT check_name,expected,actual,passed,details FROM a2_checks ORDER BY check_name;
