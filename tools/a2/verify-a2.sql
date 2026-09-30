CREATE TEMP TABLE a2_checks(check_name text,expected text,actual text,passed boolean,details text);
CREATE TEMP TABLE a2_account AS SELECT id FROM accounts WHERE lower(email)='scale@lifelab.local';

-- The seven curated rows replace raw VTT snippets without changing Source or
-- timestamp. Use the effective fixture text when resolving stable Note keys.
UPDATE a2_expected_notes expected SET content=curated.note_content
FROM a2_curated_video_note curated
WHERE expected.fixture_key=curated.fixture_key AND expected.note_no=curated.note_no;

CREATE TEMP TABLE a2_representative_matches AS
WITH note_rank AS (
    SELECT fixture_key,note_no,
           dense_rank() OVER (ORDER BY fixture_key) AS source_rank
    FROM a2_expected_notes
)
SELECT fixture.fixture_key,fixture.note_no,fixture.category_name,fixture.tag_names,
       expected.content,expected.timestamp_seconds,source.youtube_video_id,
       note.id AS note_id,category.name AS actual_category,
       category.account_id AS category_account_id
FROM a2_video_organization fixture
JOIN a2_expected_notes expected USING(fixture_key,note_no)
JOIN note_rank rank USING(fixture_key,note_no)
JOIN a2_expected_sources source USING(fixture_key)
LEFT JOIN youtube_videos video ON video.youtube_video_id=source.youtube_video_id
LEFT JOIN library_videos library ON library.youtube_source_id=video.id
    AND library.account_id=(SELECT id FROM a2_account)
LEFT JOIN notes note ON note.account_id=(SELECT id FROM a2_account)
    AND note.youtube_source_id=video.id
    AND note.content=expected.content
    AND note.timestamp_seconds IS NOT DISTINCT FROM expected.timestamp_seconds
    AND note.created_at=GREATEST(
        library.added_at+interval '2 days',
        ((:'reference_date'::date::timestamp+time '12:00') AT TIME ZONE 'Asia/Ho_Chi_Minh')
        - (30+((rank.source_rank*29+fixture.note_no*13)%650))*interval '1 day')
LEFT JOIN categories category ON category.id=note.category_id;

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
INSERT INTO a2_checks SELECT 'independent_action_variety','38',count(DISTINCT title)::text,count(DISTINCT title)=38,
    'long-term independent study actions use the curated 38-topic cycle'
FROM tasks t JOIN a2_account a ON a.id=t.account_id WHERE t.source_status='INDEPENDENT';
INSERT INTO a2_checks SELECT 'missing_source_action_variety','20',count(DISTINCT title)::text,count(DISTINCT title)=20,
    'surviving missing-source Tasks retain 20 self-contained follow-ups'
FROM tasks t JOIN a2_account a ON a.id=t.account_id WHERE t.source_status='SOURCE_MISSING';
INSERT INTO a2_checks SELECT 'synthetic_task_copy','0',count(*)::text,count(*)=0,
    'no internal generator or lifecycle language in Task titles/descriptions'
FROM tasks t JOIN a2_account a ON a.id=t.account_id
WHERE t.title LIKE 'Apply note insight:%'
   OR t.title LIKE 'Independent learning action:%'
   OR t.title LIKE 'Rebuild context:%'
   OR t.description LIKE 'A standalone step in the long-term learning plan.%'
   OR t.description LIKE 'The original Note was later removed;%';
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
            CASE WHEN expected.fixture_key = 'A2-IMG-003' THEN NULL ELSE expected.title END
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
            CASE WHEN expected.fixture_key = 'A2-IMG-003' THEN NULL ELSE expected.title END
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
            CASE WHEN expected.fixture_key = 'A2-AUD-002' THEN NULL ELSE expected.title END
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
            CASE WHEN expected.fixture_key = 'A2-AUD-002' THEN NULL ELSE expected.title END
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

INSERT INTO a2_checks
SELECT 'image_media_tag_links','41',count(*)::text,count(*)=41,'Image media Tag assignments'
FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
JOIN a2_account account ON account.id=library.account_id;

INSERT INTO a2_checks
SELECT 'audio_media_tag_links','16',count(*)::text,count(*)=16,'Audio media Tag assignments'
FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
JOIN a2_account account ON account.id=library.account_id;

INSERT INTO a2_checks
SELECT 'image_media_tag_distribution','0',count(*)::text,count(*)=0,'exact Image fixture media Tags'
FROM (
    (SELECT expected.external_url, lower(btrim(fixture_tag.name)) AS tag_name
     FROM a2_expected_images expected
     CROSS JOIN LATERAL jsonb_array_elements_text(expected.tags_json) fixture_tag(name)
     EXCEPT
     SELECT source.external_url, tag.normalized_name
     FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
     JOIN a2_account account ON account.id=library.account_id
     JOIN image_sources source ON source.id=library.image_source_id
     JOIN tags tag ON tag.id=link.tag_id AND tag.account_id=account.id)
    UNION ALL
    (SELECT source.external_url, tag.normalized_name
     FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id
     JOIN a2_account account ON account.id=library.account_id
     JOIN image_sources source ON source.id=library.image_source_id
     JOIN tags tag ON tag.id=link.tag_id
     EXCEPT
     SELECT expected.external_url, lower(btrim(fixture_tag.name))
     FROM a2_expected_images expected
     CROSS JOIN LATERAL jsonb_array_elements_text(expected.tags_json) fixture_tag(name))
) difference;

INSERT INTO a2_checks
SELECT 'audio_media_tag_distribution','0',count(*)::text,count(*)=0,'exact Audio fixture media Tags'
FROM (
    (SELECT expected.external_url, lower(btrim(fixture_tag.name)) AS tag_name
     FROM a2_expected_audio expected
     CROSS JOIN LATERAL jsonb_array_elements_text(expected.tags_json) fixture_tag(name)
     EXCEPT
     SELECT source.external_url, tag.normalized_name
     FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
     JOIN a2_account account ON account.id=library.account_id
     JOIN audio_sources source ON source.id=library.audio_source_id
     JOIN tags tag ON tag.id=link.tag_id AND tag.account_id=account.id)
    UNION ALL
    (SELECT source.external_url, tag.normalized_name
     FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id
     JOIN a2_account account ON account.id=library.account_id
     JOIN audio_sources source ON source.id=library.audio_source_id
     JOIN tags tag ON tag.id=link.tag_id
     EXCEPT
     SELECT expected.external_url, lower(btrim(fixture_tag.name))
     FROM a2_expected_audio expected
     CROSS JOIN LATERAL jsonb_array_elements_text(expected.tags_json) fixture_tag(name))
) difference;

INSERT INTO a2_checks
SELECT 'media_tag_ownership_violations','0',count(*)::text,count(*)=0,'media Tags must belong to Library owner'
FROM (
    SELECT library.account_id, tag.account_id AS tag_account_id
    FROM library_image_tags link JOIN library_images library ON library.id=link.library_image_id JOIN tags tag ON tag.id=link.tag_id
    UNION ALL
    SELECT library.account_id, tag.account_id
    FROM library_audio_tags link JOIN library_audio library ON library.id=link.library_audio_id JOIN tags tag ON tag.id=link.tag_id
    UNION ALL
    SELECT library.account_id, tag.account_id
    FROM library_video_tags link JOIN library_videos library ON library.id=link.library_video_id JOIN tags tag ON tag.id=link.tag_id
) owned JOIN a2_account account ON account.id=owned.account_id
WHERE owned.account_id<>owned.tag_account_id;

INSERT INTO a2_checks
SELECT 'multi_tag_images','>=1',count(*)::text,count(*)>=1,'positive multi-Tag Image filter data'
FROM (SELECT library.id FROM library_images library JOIN a2_account account ON account.id=library.account_id
      JOIN library_image_tags link ON link.library_image_id=library.id
      GROUP BY library.id HAVING count(*)>=2) tagged;

INSERT INTO a2_checks
SELECT 'multi_tag_audio','>=1',count(*)::text,count(*)>=1,'positive multi-Tag Audio filter data'
FROM (SELECT library.id FROM library_audio library JOIN a2_account account ON account.id=library.account_id
      JOIN library_audio_tags link ON link.library_audio_id=library.id
      GROUP BY library.id HAVING count(*)>=2) tagged;

INSERT INTO a2_checks
SELECT 'shared_media_tags','>=1',count(*)::text,count(*)>=1,'one account-owned Tag spans media types'
FROM tags tag JOIN a2_account account ON account.id=tag.account_id
WHERE EXISTS (SELECT 1 FROM library_image_tags link JOIN library_images library
              ON library.id=link.library_image_id WHERE link.tag_id=tag.id AND library.account_id=account.id)
  AND EXISTS (SELECT 1 FROM library_audio_tags link JOIN library_audio library
              ON library.id=link.library_audio_id WHERE link.tag_id=tag.id AND library.account_id=account.id);

INSERT INTO a2_checks
SELECT 'normalized_media_description_marker','2',count(*)::text,count(*)=2,
    'accent-insensitive/d-stroke partial search data'
FROM (
    SELECT library.personal_description AS description FROM library_images library JOIN a2_account account ON account.id=library.account_id
    UNION ALL
    SELECT library.personal_description FROM library_audio library JOIN a2_account account ON account.id=library.account_id
) descriptions
WHERE lifelab_search_normalize(descriptions.description) LIKE '%doi%';

INSERT INTO a2_checks
SELECT 'image_personal_metadata','0',count(*)::text,count(*)=0,'curated Image title/description and fallback'
FROM library_images library JOIN a2_account account ON account.id=library.account_id
JOIN image_sources source ON source.id=library.image_source_id
JOIN a2_expected_images fixture ON fixture.external_url=source.external_url
WHERE library.title IS DISTINCT FROM (CASE WHEN fixture.fixture_key='A2-IMG-003' THEN NULL ELSE fixture.title END)
   OR library.personal_description IS DISTINCT FROM (CASE fixture.fixture_key
       WHEN 'A2-IMG-001' THEN 'Sơ đồ chuẩn hóa cơ sở dữ liệu để đối chiếu các dạng chuẩn.'
       WHEN 'A2-IMG-002' THEN 'Review the seven OSI layers before network exercises.'
       ELSE NULL END);

INSERT INTO a2_checks
SELECT 'audio_personal_metadata','0',count(*)::text,count(*)=0,'curated Audio title/description and fallback'
FROM library_audio library JOIN a2_account account ON account.id=library.account_id
JOIN audio_sources source ON source.id=library.audio_source_id
JOIN a2_expected_audio fixture ON fixture.external_url=source.external_url
WHERE library.title IS DISTINCT FROM (CASE WHEN fixture.fixture_key='A2-AUD-002' THEN NULL ELSE fixture.title END)
   OR library.personal_description IS DISTINCT FROM (CASE fixture.fixture_key
       WHEN 'A2-AUD-001' THEN 'Đối chiếu định hướng nghề nghiệp và thói quen học suốt đời.'
       WHEN 'A2-AUD-003' THEN 'Plan study time using three priority blocks.'
       ELSE NULL END);

INSERT INTO a2_checks
SELECT 'video_personal_metadata','0',count(*)::text,count(*)=0,
    'six intentional personal Video titles/descriptions; all others use Source fallback'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id
JOIN youtube_videos source ON source.id=library.youtube_source_id
JOIN a2_expected_sources expected ON expected.youtube_video_id=source.youtube_video_id
LEFT JOIN a2_curated_video_metadata curated USING(fixture_key)
WHERE library.custom_title IS DISTINCT FROM curated.custom_title
   OR library.personal_description IS DISTINCT FROM curated.personal_description;

INSERT INTO a2_checks
SELECT 'curated_video_chains','0',count(*)::text,count(*)=0,
    'seven source-grounded Video Note/Task chains, with exact timestamp or NULL'
FROM a2_curated_video_note curated
JOIN a2_expected_notes expected USING(fixture_key,note_no)
JOIN a2_expected_sources fixture_source USING(fixture_key)
LEFT JOIN youtube_videos source ON source.youtube_video_id=fixture_source.youtube_video_id
LEFT JOIN notes note ON note.account_id=(SELECT id FROM a2_account)
    AND note.youtube_source_id=source.id
    AND ((expected.timestamp_seconds IS NOT NULL
          AND note.timestamp_seconds=expected.timestamp_seconds)
      OR (expected.timestamp_seconds IS NULL AND note.timestamp_seconds IS NULL
          AND note.content=curated.note_content))
LEFT JOIN tasks task ON task.account_id=(SELECT id FROM a2_account)
    AND task.source_note_id=note.id
LEFT JOIN categories note_category ON note_category.id=note.category_id
LEFT JOIN categories task_category ON task_category.id=task.category_id
WHERE note.id IS NULL OR task.id IS NULL
   OR note.content IS DISTINCT FROM curated.note_content
   OR task.title IS DISTINCT FROM curated.task_title
   OR task.description IS DISTINCT FROM curated.task_description
   OR task.source_status IS DISTINCT FROM 'HAS_SOURCE'
   OR note_category.name IS DISTINCT FROM curated.category_name
   OR task_category.name IS DISTINCT FROM curated.category_name
   OR COALESCE((SELECT array_agg(tag.name::text ORDER BY tag.name) FROM note_tags link
                JOIN tags tag ON tag.id=link.tag_id WHERE link.note_id=note.id),ARRAY[]::text[])
      IS DISTINCT FROM curated.tag_names
   OR COALESCE((SELECT array_agg(tag.name::text ORDER BY tag.name) FROM task_tags link
                JOIN tags tag ON tag.id=link.tag_id WHERE link.task_id=task.id),ARRAY[]::text[])
      IS DISTINCT FROM curated.tag_names;

INSERT INTO a2_checks
SELECT 'curated_video_source_identity','0',count(*)::text,count(*)=0,
    'personal curation does not rewrite the six global Video Source identities'
FROM a2_curated_video_metadata curated
JOIN a2_expected_sources expected USING(fixture_key)
LEFT JOIN youtube_videos source ON source.youtube_video_id=expected.youtube_video_id
WHERE source.id IS NULL OR source.title IS DISTINCT FROM expected.title
   OR source.source_url IS DISTINCT FROM expected.source_url;

INSERT INTO a2_checks
SELECT 'current_video_sources','80',count(*)::text,count(*)=80,
    'current Video Library Source count'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id;

INSERT INTO a2_checks
SELECT 'current_video_sources_with_notes','70',count(*)::text,count(*)=70,
    'current Sources with an existing A2 Video Note'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id
WHERE EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id);

INSERT INTO a2_checks
SELECT 'current_video_sources_without_notes','10',count(*)::text,count(*)=10,
    'intentional saved-without-capture Sources'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id
WHERE NOT EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id);

INSERT INTO a2_checks
SELECT 'exact_no_note_sources','0',count(*)::text,count(*)=0,
    'exact ten stable fixture keys have no A2 Note'
FROM (
    (SELECT fixture_key FROM a2_no_note_sources
     EXCEPT
     SELECT source.fixture_key FROM library_videos library
     JOIN a2_account account ON account.id=library.account_id
     JOIN youtube_videos video ON video.id=library.youtube_source_id
     JOIN a2_expected_sources source ON source.youtube_video_id=video.youtube_video_id
     WHERE NOT EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
         AND note.youtube_source_id=library.youtube_source_id))
    UNION ALL
    (SELECT source.fixture_key FROM library_videos library
     JOIN a2_account account ON account.id=library.account_id
     JOIN youtube_videos video ON video.id=library.youtube_source_id
     JOIN a2_expected_sources source ON source.youtube_video_id=video.youtube_video_id
     WHERE NOT EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
         AND note.youtube_source_id=library.youtube_source_id)
     EXCEPT SELECT fixture_key FROM a2_no_note_sources)
) mismatch;

INSERT INTO a2_checks
SELECT 'representative_manifest_rows','70',count(*)::text,count(*)=70,
    'one explicit selected Note per note-bearing current Source'
FROM a2_video_organization;

INSERT INTO a2_checks
SELECT 'representative_exact_matches','70',count(*)::text,count(*)=70,
    'exact fixture key, Note number, Source, text, timestamp, Category and Tag set'
FROM a2_representative_matches match
WHERE match.note_id IS NOT NULL
  AND match.actual_category=match.category_name
  AND match.category_account_id=(SELECT id FROM a2_account)
  AND coalesce((SELECT jsonb_agg(tag.name ORDER BY tag.name)
                FROM note_tags link JOIN tags tag ON tag.id=link.tag_id
                WHERE link.note_id=match.note_id),'[]'::jsonb)
      = (SELECT jsonb_agg(name ORDER BY name)
         FROM jsonb_array_elements_text(match.tag_names) names(name));

INSERT INTO a2_checks
SELECT 'representative_distinct_notes','70',count(DISTINCT note_id)::text,
    count(DISTINCT note_id)=70,'stable fixture rows resolve to different Notes'
FROM a2_representative_matches;

INSERT INTO a2_checks
SELECT 'representative_unmatched_keys','none',
    coalesce(string_agg(fixture_key||'/'||note_no,',' ORDER BY fixture_key),'none'),
    count(*)=0,'diagnostic stable keys for unresolved representative Notes'
FROM a2_representative_matches WHERE note_id IS NULL;

INSERT INTO a2_checks
SELECT 'note_bearing_current_sources_with_organized_note','70',count(*)::text,
    count(*)=70,'all 70 Sources with Notes have an organized Note'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id
WHERE EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id)
  AND EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id
    AND note.category_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id));

INSERT INTO a2_checks
SELECT 'note_bearing_current_sources_without_organized_note','0',count(*)::text,
    count(*)=0,'no note-bearing current Source lacks organization'
FROM library_videos library JOIN a2_account account ON account.id=library.account_id
WHERE EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id)
  AND NOT EXISTS (SELECT 1 FROM notes note WHERE note.account_id=account.id
    AND note.youtube_source_id=library.youtube_source_id
    AND note.category_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id));

INSERT INTO a2_checks
SELECT 'video_notes_total','240',count(*)::text,count(*)=240,
    'current and historical Video Notes unchanged'
FROM notes note JOIN a2_account account ON account.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL;

INSERT INTO a2_checks
SELECT 'organized_video_notes','>=70',count(*)::text,count(*)>=70,
    'representative organization without a complete-history rewrite'
FROM notes note JOIN a2_account account ON account.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL AND note.category_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id);

INSERT INTO a2_checks
SELECT 'unorganized_video_notes','>0',count(*)::text,count(*)>0,
    'long-history Video Notes without Category or Tags remain'
FROM notes note JOIN a2_account account ON account.id=note.account_id
WHERE note.youtube_source_id IS NOT NULL AND note.category_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id);

INSERT INTO a2_checks
SELECT 'representative_linked_task_organization','0',count(*)::text,count(*)=0,
    'existing linked Tasks share coherent Category and complete Tag set'
FROM a2_representative_matches match
JOIN tasks task ON task.source_note_id=match.note_id
    AND task.account_id=(SELECT id FROM a2_account)
    AND task.source_status='HAS_SOURCE'
LEFT JOIN categories category ON category.id=task.category_id
WHERE category.name IS DISTINCT FROM match.category_name
   OR coalesce((SELECT jsonb_agg(tag.name ORDER BY tag.name)
                FROM task_tags link JOIN tags tag ON tag.id=link.tag_id
                WHERE link.task_id=task.id),'[]'::jsonb)
      IS DISTINCT FROM (SELECT jsonb_agg(name ORDER BY name)
                        FROM jsonb_array_elements_text(match.tag_names) names(name));

INSERT INTO a2_checks
SELECT 'representative_linked_tasks','46',count(*)::text,count(*)=46,
    'existing HAS_SOURCE Tasks attached to the selected Video Notes'
FROM a2_representative_matches match
JOIN tasks task ON task.source_note_id=match.note_id
    AND task.account_id=(SELECT id FROM a2_account)
    AND task.source_status='HAS_SOURCE';

INSERT INTO a2_checks
SELECT 'all_note_tag_links','184',count(*)::text,count(*)=184,
    'Video, Image and Audio Note-Tag links after representative curation'
FROM note_tags link JOIN notes note ON note.id=link.note_id
JOIN a2_account account ON account.id=note.account_id;

INSERT INTO a2_checks
SELECT 'organization_ownership_violations','0',count(*)::text,count(*)=0,
    'all A2 Note/Task Categories and Tags belong to A2'
FROM (
    SELECT note.account_id owner_id,category.account_id relation_owner_id
    FROM notes note JOIN a2_account account ON account.id=note.account_id
    JOIN categories category ON category.id=note.category_id
    UNION ALL
    SELECT note.account_id,tag.account_id
    FROM notes note JOIN a2_account account ON account.id=note.account_id
    JOIN note_tags link ON link.note_id=note.id JOIN tags tag ON tag.id=link.tag_id
    UNION ALL
    SELECT task.account_id,category.account_id
    FROM tasks task JOIN a2_account account ON account.id=task.account_id
    JOIN categories category ON category.id=task.category_id
    UNION ALL
    SELECT task.account_id,tag.account_id
    FROM tasks task JOIN a2_account account ON account.id=task.account_id
    JOIN task_tags link ON link.task_id=task.id JOIN tags tag ON tag.id=link.tag_id
) relations WHERE owner_id<>relation_owner_id;

INSERT INTO a2_checks
SELECT 'image_notes_without_category_or_tags','0',count(*)::text,count(*)=0,
    'all 20 Image Notes retain organization'
FROM notes note JOIN a2_account account ON account.id=note.account_id
WHERE note.image_source_id IS NOT NULL AND
    (note.category_id IS NULL OR NOT EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id));

INSERT INTO a2_checks
SELECT 'audio_notes_without_category_or_tags','0',count(*)::text,count(*)=0,
    'all 8 Audio Notes retain organization'
FROM notes note JOIN a2_account account ON account.id=note.account_id
WHERE note.audio_source_id IS NOT NULL AND
    (note.category_id IS NULL OR NOT EXISTS (SELECT 1 FROM note_tags link WHERE link.note_id=note.id));

SELECT check_name,expected,actual,passed,details FROM a2_checks ORDER BY check_name;
