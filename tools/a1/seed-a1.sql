BEGIN;

SELECT pg_advisory_xact_lock(hashtext('life-lab-a1-seed'));

CREATE TEMP TABLE a1_config AS
SELECT
    :'reference_date'::date AS reference_date,
    (:'reference_date'::date::timestamp + time '12:00')
        AT TIME ZONE 'Asia/Ho_Chi_Minh' AS reference_instant,
    :'deterministic_seed'::integer AS deterministic_seed;

DO $$
BEGIN
    IF (SELECT count(*) FROM a1_snapshot_sources) <> 37
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE role = 'CURRENT_LIBRARY') <> 36
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE role = 'HISTORICAL_H1') <> 1
       OR (SELECT count(*) FROM a1_snapshot_sources WHERE youtube_video_id = '-XsRLyKV9_k') <> 1
       OR EXISTS (
            SELECT 1
            FROM a1_snapshot_sources
            GROUP BY youtube_video_id
            HAVING count(*) > 1)
       OR EXISTS (
            SELECT 1
            FROM a1_snapshot_sources
            WHERE availability_status <> 'AVAILABLE'
               OR duration_seconds <= 0) THEN
        RAISE EXCEPTION 'A1 snapshot preflight failed';
    END IF;
END
$$;

-- Reset only the account identified by the locked A1 email. Shared source rows are retained.
DELETE FROM tasks
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM notes
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM tags
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM library_videos
WHERE account_id IN (
    SELECT id FROM accounts WHERE lower(email) = 'demo@lifelab.local');

DELETE FROM accounts
WHERE lower(email) = 'demo@lifelab.local';

-- Remove only now-unreferenced A1 snapshot rows so snapshot metadata is restored exactly.
-- A source used by any unrelated account is global/shared and is never deleted here.
DELETE FROM youtube_videos youtube
USING a1_snapshot_sources source
WHERE youtube.youtube_video_id = source.youtube_video_id
  AND NOT EXISTS (
      SELECT 1 FROM library_videos library
      WHERE library.youtube_source_id = youtube.id)
  AND NOT EXISTS (
      SELECT 1 FROM notes note
      WHERE note.youtube_source_id = youtube.id);

-- Insert only missing global sources. Never overwrite metadata that may be shared by another account.
INSERT INTO youtube_videos (
    youtube_video_id,
    source_url,
    title,
    channel_name,
    thumbnail_url,
    duration_seconds,
    published_at,
    availability_status,
    created_at,
    updated_at)
SELECT
    source.youtube_video_id,
    source.source_url,
    source.title,
    source.channel_name,
    source.thumbnail_url,
    source.duration_seconds,
    source.published_at,
    source.availability_status,
    config.reference_instant - interval '250 days',
    config.reference_instant - interval '250 days'
FROM a1_snapshot_sources source
CROSS JOIN a1_config config
ON CONFLICT (youtube_video_id) DO NOTHING;

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM youtube_videos video
        JOIN a1_snapshot_sources source
          ON source.youtube_video_id = video.youtube_video_id
        WHERE video.duration_seconds = source.duration_seconds
          AND video.availability_status = 'AVAILABLE') <> 37 THEN
        RAISE EXCEPTION
            'An existing shared YouTube source conflicts with the validated A1 snapshot';
    END IF;
END
$$;

INSERT INTO accounts (
    email,
    password_hash,
    display_name,
    created_at,
    updated_at)
SELECT
    'demo@lifelab.local',
    :'password_hash',
    'Life Lab Demo',
    reference_instant - interval '240 days',
    reference_instant - interval '240 days'
FROM a1_config;

CREATE TEMP TABLE a1_library_map (
    video_no INTEGER PRIMARY KEY,
    library_video_id BIGINT NOT NULL,
    youtube_source_id BIGINT NOT NULL,
    added_at TIMESTAMPTZ NOT NULL
);

WITH inserted AS (
    INSERT INTO library_videos (
        account_id,
        youtube_source_id,
        custom_title,
        personal_description,
        added_at,
        updated_at)
    SELECT
        account.id,
        youtube.id,
        CASE source.library_order
            WHEN 1 THEN 'Nền tảng Java cần nắm chắc'
            WHEN 6 THEN 'Lộ trình Spring Boot thực hành'
            WHEN 7 THEN 'REST API cho đồ án Life Lab'
            WHEN 10 THEN 'React và JavaScript nền tảng'
            WHEN 19 THEN 'Git căn bản để làm việc nhóm'
            WHEN 22 THEN 'Kế hoạch học tiếng Anh 30 ngày'
            WHEN 31 THEN 'Spring Boot full course'
            WHEN 32 THEN 'Spring Security chuyên sâu'
            WHEN 35 THEN 'Kiểm thử phần mềm thực chiến'
            WHEN 36 THEN 'HTTP từ nền tảng đến thực hành'
            ELSE NULL
        END,
        CASE WHEN source.library_order IN (1, 3, 6, 7, 8, 10, 19, 20, 22, 25, 31, 32, 35, 36)
            THEN CASE source.library_order
                WHEN 1 THEN 'Ôn lại cú pháp và tư duy hướng đối tượng trước khi đi sâu vào backend.'
                WHEN 3 THEN 'Dùng làm khung ôn tập cấu trúc dữ liệu và giải thuật cho phỏng vấn.'
                WHEN 6 THEN 'Theo dõi lộ trình Java Spring và đánh dấu phần cần áp dụng vào đồ án.'
                WHEN 7 THEN 'Tham khảo cách tổ chức REST API và phân lớp backend rõ ràng.'
                WHEN 8 THEN 'Ghi lại các thao tác SQL Server quan trọng để luyện lại bằng PostgreSQL.'
                WHEN 10 THEN 'Củng cố JavaScript hiện đại trước khi tối ưu giao diện React.'
                WHEN 19 THEN 'Chuẩn hóa quy trình Git cá nhân trước khi cộng tác theo nhóm.'
                WHEN 20 THEN 'Thử áp dụng phương pháp học chủ động vào lịch học hằng tuần.'
                WHEN 22 THEN 'Theo dõi tiến độ tiếng Anh bằng mục tiêu nhỏ, đều đặn mỗi ngày.'
                WHEN 25 THEN 'Điều chỉnh cách chia thời gian giữa học backend, tiếng Anh và đồ án.'
                WHEN 31 THEN 'Đối chiếu kiến trúc Spring Boot trong khóa học với backend Life Lab.'
                WHEN 32 THEN 'Tập trung vào xác thực, phân quyền và các lỗi cấu hình thường gặp.'
                WHEN 35 THEN 'Bổ sung chiến lược unit test và integration test cho các luồng chính.'
                WHEN 36 THEN 'Hệ thống hóa request, response, header và status code để debug API.'
            END
            ELSE NULL
        END,
        GREATEST(
            youtube.published_at + interval '1 day',
            config.reference_instant - interval '230 days'
                + source.library_order * interval '5 days'),
        GREATEST(
            youtube.published_at + interval '1 day',
            config.reference_instant - interval '230 days'
                + source.library_order * interval '5 days')
            + ((source.library_order * 17) % 72) * interval '1 hour'
    FROM a1_snapshot_sources source
    JOIN youtube_videos youtube
      ON youtube.youtube_video_id = source.youtube_video_id
    CROSS JOIN accounts account
    CROSS JOIN a1_config config
    WHERE source.role = 'CURRENT_LIBRARY'
      AND account.email = 'demo@lifelab.local'
    RETURNING id, youtube_source_id, added_at)
INSERT INTO a1_library_map (
    video_no,
    library_video_id,
    youtube_source_id,
    added_at)
SELECT
    source.library_order,
    inserted.id,
    inserted.youtube_source_id,
    inserted.added_at
FROM inserted
JOIN youtube_videos youtube
  ON youtube.id = inserted.youtube_source_id
JOIN a1_snapshot_sources source
  ON source.youtube_video_id = youtube.youtube_video_id;

CREATE TEMP TABLE a1_tag_names (
    ordinal INTEGER PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

INSERT INTO a1_tag_names (ordinal, name) VALUES
    (1, 'Java'),
    (2, 'OOP'),
    (3, 'DSA'),
    (4, 'Spring Boot'),
    (5, 'Backend'),
    (6, 'REST API'),
    (7, 'React'),
    (8, 'JavaScript'),
    (9, 'TypeScript'),
    (10, 'SQL'),
    (11, 'Database'),
    (12, 'Security'),
    (13, 'Docker'),
    (14, 'Git'),
    (15, 'Testing'),
    (16, 'Tiếng Anh'),
    (17, 'Từ vựng'),
    (18, 'Phát âm'),
    (19, 'IELTS'),
    (20, 'Kỹ năng học'),
    (21, 'Career'),
    (22, 'Đồ án'),
    (23, 'Quan trọng'),
    (24, 'Xem lại');

INSERT INTO tags (
    account_id,
    name,
    normalized_name,
    created_at,
    updated_at)
SELECT
    account.id,
    tag.name,
    lower(tag.name),
    config.reference_instant - interval '225 days' + tag.ordinal * interval '2 hours',
    config.reference_instant - interval '225 days' + tag.ordinal * interval '2 hours'
FROM a1_tag_names tag
CROSS JOIN accounts account
CROSS JOIN a1_config config
WHERE account.email = 'demo@lifelab.local';

CREATE TEMP TABLE a1_video_tag_seed (
    video_no INTEGER NOT NULL,
    tag_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (video_no, tag_name)
);

INSERT INTO a1_video_tag_seed (video_no, tag_name) VALUES
    (1,'Java'),(1,'OOP'),(1,'DSA'),(1,'Backend'),(1,'Quan trọng'),
    (2,'OOP'),(2,'DSA'),(2,'Quan trọng'),(2,'Xem lại'),
    (3,'DSA'),(3,'Kỹ năng học'),(3,'Quan trọng'),(3,'Xem lại'),
    (4,'DSA'),(4,'Đồ án'),(4,'Xem lại'),
    (6,'Java'),(6,'Spring Boot'),(6,'Backend'),(6,'REST API'),(6,'Đồ án'),
    (7,'Spring Boot'),(7,'REST API'),(7,'Backend'),(7,'React'),
    (8,'SQL'),(8,'Database'),(8,'Xem lại'),
    (9,'SQL'),(9,'Database'),(9,'Quan trọng'),
    (10,'React'),(10,'JavaScript'),(10,'TypeScript'),(10,'Quan trọng'),
    (11,'React'),(11,'JavaScript'),
    (12,'TypeScript'),(12,'JavaScript'),
    (13,'React'),(13,'JavaScript'),
    (14,'React'),(14,'JavaScript'),(14,'Xem lại'),
    (15,'React'),(15,'JavaScript'),
    (16,'Career'),(16,'Quan trọng'),
    (17,'Career'),(17,'Xem lại'),
    (18,'Kỹ năng học'),
    (19,'Git'),(19,'Quan trọng'),(19,'Xem lại'),
    (20,'Kỹ năng học'),(20,'Quan trọng'),(20,'Xem lại'),
    (21,'Tiếng Anh'),(21,'Từ vựng'),(21,'Xem lại'),
    (22,'Tiếng Anh'),(22,'Từ vựng'),(22,'Kỹ năng học'),(22,'Quan trọng'),
    (23,'Tiếng Anh'),(23,'Kỹ năng học'),(23,'Quan trọng'),
    (24,'Tiếng Anh'),(24,'Phát âm'),(24,'Từ vựng'),
    (25,'Kỹ năng học'),(25,'Career'),(25,'Quan trọng'),
    (26,'Tiếng Anh'),(26,'Từ vựng'),
    (27,'Tiếng Anh'),(27,'Phát âm'),
    (28,'Tiếng Anh'),(28,'IELTS'),(28,'Xem lại'),
    (29,'Tiếng Anh'),
    (30,'Tiếng Anh'),
    (31,'Spring Boot'),(31,'Backend'),(31,'REST API'),(31,'Đồ án'),
    (32,'Security'),(32,'Spring Boot'),(32,'Backend'),(32,'Quan trọng'),
    (33,'Docker'),(33,'Backend'),
    (34,'Database'),(34,'Backend'),(34,'Quan trọng'),
    (35,'Testing'),(35,'Backend'),(35,'Quan trọng'),(35,'Xem lại'),
    (36,'REST API');

INSERT INTO library_video_tags (library_video_id, tag_id)
SELECT library.library_video_id, tag.id
FROM a1_video_tag_seed seed
JOIN a1_library_map library ON library.video_no = seed.video_no
JOIN tags tag
  ON tag.name = seed.tag_name
JOIN accounts account ON account.id = tag.account_id
WHERE account.email = 'demo@lifelab.local';

CREATE TEMP TABLE a1_video_distribution (
    video_no INTEGER PRIMARY KEY,
    valid_count INTEGER NOT NULL,
    invalid_count INTEGER NOT NULL,
    note_count INTEGER NOT NULL
);

INSERT INTO a1_video_distribution VALUES
    (1,12,1,9),(2,4,1,3),(3,4,1,3),(4,4,0,3),(5,0,2,0),(6,9,1,7),
    (7,6,1,4),(8,3,0,3),(9,0,2,0),(10,8,1,5),(11,5,1,3),(12,0,2,0),
    (13,4,0,3),(14,5,1,5),(15,0,2,0),(16,2,0,0),(17,3,1,3),(18,0,2,0),
    (19,4,1,2),(20,6,1,5),(21,5,1,4),(22,4,1,4),(23,3,0,4),(24,4,1,4),
    (25,2,1,4),(26,0,2,0),(27,0,2,0),(28,0,2,0),(29,0,2,0),(30,0,2,0),
    (31,7,1,6),(32,7,1,6),(33,3,1,0),(34,0,2,0),(35,3,1,2),(36,0,2,0);

WITH session_seed AS (
    SELECT distribution.video_no, 'VALID'::varchar AS validity_status, series AS session_no
    FROM a1_video_distribution distribution
    CROSS JOIN LATERAL generate_series(1, distribution.valid_count) series
    UNION ALL
    SELECT distribution.video_no, 'INVALID'::varchar, series
    FROM a1_video_distribution distribution
    CROSS JOIN LATERAL generate_series(1, distribution.invalid_count) series),
calculated AS (
    SELECT
        seed.*,
        library.library_video_id,
        library.added_at,
        youtube.duration_seconds,
        LEAST(30, ((youtube.duration_seconds::bigint * 4 + 4) / 5)::integer) AS threshold,
        GREATEST(
            library.added_at + interval '1 day',
            config.reference_instant - interval '180 days'
                + ((seed.video_no * 5 + seed.session_no * 3) % 150) * interval '1 day')
            + ((seed.video_no * 13 + seed.session_no * 7) % 18) * interval '1 hour'
            AS started_at
    FROM session_seed seed
    JOIN a1_library_map library ON library.video_no = seed.video_no
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
    CROSS JOIN a1_config config),
trusted AS (
    SELECT
        calculated.*,
        CASE validity_status
            WHEN 'VALID' THEN threshold
                + ((video_no * 7 + session_no * 11)
                    % GREATEST(1, LEAST(91, duration_seconds - threshold + 1)))
            ELSE GREATEST(
                0,
                threshold - 1 - ((video_no * 3 + session_no * 5) % GREATEST(1, threshold)))
        END AS watch_seconds
    FROM calculated)
INSERT INTO watch_sessions (
    library_video_id,
    started_at,
    ended_at,
    last_heartbeat_at,
    watch_time_seconds,
    validity_status)
SELECT
    library_video_id,
    started_at,
    started_at + watch_seconds * interval '1 second'
        + (10 + ((video_no + session_no) % 50)) * interval '1 second',
    started_at + watch_seconds * interval '1 second',
    watch_seconds,
    validity_status
FROM trusted;

CREATE TEMP TABLE a1_vtt_note_seed (
    video_no INTEGER NOT NULL,
    note_no INTEGER NOT NULL,
    timestamp_seconds INTEGER NOT NULL CHECK (timestamp_seconds >= 0),
    content TEXT NOT NULL,
    PRIMARY KEY (video_no, note_no)
);

INSERT INTO a1_vtt_note_seed VALUES
    (3,1,56,'Trước khi học cấu trúc dữ liệu và giải thuật, cần chọn một ngôn ngữ lập trình và nắm chắc các phần nền tảng như biến, vòng lặp, hàm, mảng và chuỗi.'),
    (3,2,192,'Nên bắt đầu học cấu trúc dữ liệu và giải thuật sau khi kỹ năng code cơ bản đã tương đối ổn, thay vì học quá sớm khi nền tảng lập trình còn yếu.'),
    (3,3,285,'Lộ trình thuật toán không chỉ có sắp xếp và tìm kiếm; còn có các hướng như phương pháp sinh, chia để trị và quy hoạch động.'),
    (13,1,114,'Một dấu hiệu dễ nhận biết SPA là khi chuyển nội dung trong ứng dụng, trình duyệt không phải tải lại toàn bộ trang.'),
    (13,2,575,'SPA thường tải phần lớn tài nguyên từ lần đầu; khi điều hướng, trình duyệt có thể render giao diện ngay và chỉ gọi API để lấy thêm dữ liệu cần thiết.'),
    (13,3,1091,'Không có SPA hay MPA tối ưu cho mọi trường hợp; lựa chọn kiến trúc phải dựa vào yêu cầu, quy mô phát triển và trải nghiệm người dùng cần đạt.'),
    (14,1,249,'useEffect nhận một callback bắt buộc và một dependency array tùy chọn; callback là nơi thực hiện các side effect của component.'),
    (14,2,631,'Callback của useEffect được thực thi sau khi React xử lý render và cập nhật giao diện, không chạy trước quá trình render.'),
    (14,3,795,'Logic tạo side effect nên được đưa vào useEffect thay vì chạy trực tiếp trong quá trình render, đặc biệt khi logic đó có thể làm chậm hoặc cản trở việc tạo UI.'),
    (14,4,1025,'Trong môi trường development, React StrictMode có thể khiến effect được gọi hai lần để hỗ trợ phát hiện side effect không an toàn; hành vi kiểm tra này không phải luồng production bình thường.'),
    (14,5,1428,'useEffect với dependency array rỗng phù hợp cho logic chỉ cần chạy một lần sau khi component mount, ví dụ gọi API để lấy dữ liệu ban đầu.'),
    (20,1,116,'Nên xác định mục tiêu học tập trước mỗi kỳ hoặc năm học và đặt mục tiêu thực tế để tập trung vào sự tiến bộ của chính mình.'),
    (20,2,154,'Đọc trước tài liệu trước khi vào lớp giúp mình có sẵn ngữ cảnh và tiếp thu bài chủ động hơn thay vì bắt đầu hoàn toàn từ số 0.'),
    (20,3,171,'Với phương pháp Feynman, hãy tự giải thích một chủ đề; chỗ nào còn vướng thì quay lại tài liệu, bổ sung kiến thức rồi đơn giản hóa cách diễn đạt.'),
    (20,4,358,'Khi không biết diễn đạt một việc bằng tiếng Anh, có thể tra ngay cách nói rồi dùng nó trong tình huống thực tế để biến khoảng trống kiến thức thành từ hoặc cụm từ mới.'),
    (20,5,888,'Đặt sách ở nơi mình thường xuyên nhìn thấy có thể trở thành tín hiệu nhắc thói quen; khi có thời gian rảnh sẽ dễ bắt đầu đọc hơn.'),
    (21,1,50,'Trong ngày nên chủ động chú ý những đồ vật, hành động hoặc ý mình chưa biết diễn đạt bằng tiếng Anh thay vì chỉ học từ một danh sách có sẵn.'),
    (21,2,99,'Có thể thu thập khoảng 5–15 từ mình gặp nhưng chưa biết trong ngày, rồi cuối ngày tra và lưu lại để học.'),
    (21,3,183,'Từ vựng dễ nhớ hơn khi được gắn với hình ảnh và cảm xúc, thay vì chỉ ghi nhớ mặt chữ và một nghĩa tiếng Việt.'),
    (21,4,507,'Word of the Day giúp tiếp xúc đều với từ mới; phần audio và câu ví dụ giúp học thêm cách phát âm và cách dùng từ trong ngữ cảnh.'),
    (22,1,72,'Ngày đầu có thể học khoảng 10 từ mới và tự viết câu sử dụng chính những từ đó, thay vì chỉ học nghĩa riêng lẻ.'),
    (22,2,125,'Luyện speaking khoảng 5–30 phút với chủ đề quen thuộc như giới thiệu bản thân; nên thu âm lại để tự nghe và kiểm tra.'),
    (22,3,225,'Khi xem video giáo dục bằng tiếng Anh, nên ghi lại ý chính và chọn thêm một số cụm từ mới từ chính nội dung vừa nghe.'),
    (22,4,345,'Một buổi học tích hợp có thể gồm xem nội dung không dùng phụ đề tiếng Việt, viết lại điều mình rút ra rồi tự nói lại nội dung vừa xem.'),
    (23,1,30,'Người mới có thể dành 15 phút mỗi ngày theo hướng: xây nền ngữ pháp cơ bản, bổ sung vốn từ rồi luyện nghe và nói giao tiếp.'),
    (23,2,63,'Nếu đã có nền tảng, 15 phút học có thể chia thành khoảng 5 phút nghe, 5 phút nói và 5 phút ôn tập.'),
    (23,3,271,'Ngữ pháp chỉ thực sự dùng được khi có vốn từ; vì vậy người mới nên xây nền từ vựng cơ bản song song với việc học cấu trúc ngữ pháp.'),
    (23,4,380,'Khi đọc trên web, có thể tra nhanh từ chưa biết ngay tại chỗ rồi lưu từ đó vào danh sách để ôn sau, thay vì ngắt hoàn toàn mạch đọc.'),
    (24,1,90,'Nên bắt đầu luyện nói từ sớm thay vì chờ tới khi cảm thấy đã học đủ; ở giai đoạn đầu vẫn nên dành phần lớn thời gian cho input.'),
    (24,2,163,'Một cách sửa lỗi phát âm có hệ thống là học IPA để biết chính xác từng âm, thay vì chỉ bắt chước cách đọc theo trí nhớ.'),
    (24,3,391,'Không nên học các từ như những mục hoàn toàn tách rời; càng tạo được nhiều liên kết giữa các từ thì càng dễ nhớ và áp dụng khi nói.'),
    (24,4,506,'Chia từ vựng theo chủ đề thành những bài nhỏ, mỗi lần khoảng 10–12 từ, giúp khối lượng học nhẹ hơn và dễ duy trì.'),
    (25,1,75,'Block lịch theo tuần trên calendar giúp nhìn trước những việc cần làm và, khi làm việc nhóm, giúp mọi người biết kế hoạch chung.'),
    (25,2,89,'Viết to-do list từ tối hôm trước giúp sáng hôm sau bắt đầu chủ động hơn và không mất thời gian suy nghĩ xem nên làm gì trước.'),
    (25,3,129,'Khi đang trì hoãn vì không có hứng với một việc, có thể chuyển sang một đầu việc khác để vẫn giữ nhịp làm việc thay vì bỏ cả khoảng thời gian đó.'),
    (25,4,411,'Trong một to-do list dài, nên chọn một hoặc hai ''highlight of the day'' để ưu tiên hoàn thiện tốt nhất và giảm sự phân tán.'),
    (31,1,26,'Khóa học kết hợp Spring Boot API với PostgreSQL chạy qua Docker và JPA để xây một backend làm việc với database thật.'),
    (31,2,443,'spring-boot-starter-web cung cấp nền tảng để xây REST API bằng Spring MVC.'),
    (31,3,2762,'Một persistent entity cần có primary key; @Entity và @Id giúp ánh xạ class cùng khóa định danh sang cấu trúc dữ liệu trong database.'),
    (31,4,3010,'Repository interface có thể extends JpaRepository<Entity, IdType> để sử dụng sẵn các thao tác truy xuất dữ liệu như find và save.'),
    (31,5,3098,'Service là lớp xử lý business logic; @Service đăng ký class thành Spring bean và Repository có thể được truyền vào Service qua constructor.'),
    (31,6,3319,'Controller được nối với Service, còn Service làm việc với Repository; cách tổ chức này tách HTTP boundary khỏi business logic và persistence.'),
    (32,1,1726,'HTTP Basic yêu cầu gửi username và password cho mỗi request; cơ chế này đơn giản nhưng có nhiều giới hạn so với các phương thức xác thực khác.'),
    (32,2,3138,'Khóa học cấu hình BCryptPasswordEncoder làm implementation của PasswordEncoder để xử lý việc encode password.'),
    (32,3,3375,'Role biểu diễn mức quyền tổng quát, còn authority hoặc permission mô tả quyền chi tiết hơn; một role có thể chứa nhiều permission.'),
    (32,4,7173,'Với CSRF protection, server phát token cho client; frontend gửi token lại khi submit dữ liệu và server kiểm tra token trước khi chấp nhận request thay đổi trạng thái.'),
    (32,5,13054,'JWT không yêu cầu server lưu session của người dùng theo cách session-based authentication vì thông tin cần thiết được đóng trong token.'),
    (32,6,13079,'JWT phụ thuộc mạnh vào secret key; nếu secret key hoặc token bị đánh cắp thì rủi ro bảo mật tăng đáng kể.'),
    (35,1,299,'Nếu không có test, khi thêm một feature mới sẽ khó biết mình có vô tình làm hỏng hành vi cũ hay không; test tạo lớp bảo vệ chống regression.'),
    (35,2,1785,'Repository test trong khóa học không chạy trực tiếp trên PostgreSQL local mà dùng H2 in-memory để tránh ghi dữ liệu test vào database phát triển.');

CREATE TEMP TABLE a1_note_map (
    note_key TEXT PRIMARY KEY,
    note_id BIGINT NOT NULL,
    video_no INTEGER,
    note_no INTEGER,
    created_at TIMESTAMPTZ NOT NULL
);

DO $$
DECLARE
    seed_row RECORD;
    inserted_note_id BIGINT;
    note_created_at TIMESTAMPTZ;
    note_content TEXT;
    note_timestamp_seconds INTEGER;
BEGIN
    FOR seed_row IN
        SELECT
            distribution.video_no,
            series AS note_no,
            distribution.note_count,
            library.youtube_source_id,
            library.added_at,
            youtube.title,
            vtt.timestamp_seconds AS vtt_timestamp_seconds,
            vtt.content AS vtt_content
        FROM a1_video_distribution distribution
        JOIN a1_library_map library ON library.video_no = distribution.video_no
        JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
        CROSS JOIN LATERAL generate_series(1, distribution.note_count) series
        LEFT JOIN a1_vtt_note_seed vtt
          ON vtt.video_no = distribution.video_no
         AND vtt.note_no = series
        ORDER BY distribution.video_no, series
    LOOP
        SELECT GREATEST(
            seed_row.added_at + interval '2 days',
            config.reference_instant - interval '150 days'
                + ((seed_row.video_no * 4 + seed_row.note_no * 9) % 125) * interval '1 day')
            + ((seed_row.video_no + seed_row.note_no * 3) % 16) * interval '1 hour'
        INTO note_created_at
        FROM a1_config config;

        note_timestamp_seconds := COALESCE(
            seed_row.vtt_timestamp_seconds,
            CASE
                WHEN seed_row.video_no = 2 AND seed_row.note_no = 1 THEN 202
                WHEN seed_row.video_no = 2 AND seed_row.note_no = 2 THEN 300
                WHEN seed_row.video_no = 2 AND seed_row.note_no = 3 THEN 382
                WHEN seed_row.video_no = 17 AND seed_row.note_no = 1 THEN 135
                WHEN seed_row.video_no = 17 AND seed_row.note_no = 2 THEN 525
                WHEN seed_row.video_no = 19 AND seed_row.note_no = 1 THEN 349
                ELSE NULL
            END);

        note_content := CASE
            WHEN seed_row.vtt_content IS NOT NULL
                THEN seed_row.vtt_content
            WHEN seed_row.video_no = 2 AND seed_row.note_no = 1
                THEN 'Lớp là khuôn mẫu mô tả cấu trúc và hành vi; đối tượng là một thể hiện cụ thể được tạo từ lớp đó.'
            WHEN seed_row.video_no = 2 AND seed_row.note_no = 2
                THEN 'Thuộc tính biểu diễn dữ liệu hoặc trạng thái của đối tượng, còn phương thức biểu diễn hành vi mà đối tượng có thể thực hiện.'
            WHEN seed_row.video_no = 2 AND seed_row.note_no = 3
                THEN 'Khi thiết kế một lớp, cần xác định dữ liệu lớp sở hữu và các trách nhiệm hoặc hành vi mà lớp phải đảm nhận.'
            WHEN seed_row.video_no = 17 AND seed_row.note_no = 1
                THEN 'Phần tổng quan CV nên truyền đạt ngắn gọn định hướng và những điểm mạnh nổi bật nhất của ứng viên.'
            WHEN seed_row.video_no = 17 AND seed_row.note_no = 2
                THEN 'Phần dự án cần nêu rõ mình đã làm gì, công nghệ đã dùng và kết quả hoặc giá trị hữu ích tạo ra.'
            WHEN seed_row.video_no = 19 AND seed_row.note_no = 1
                THEN 'Cài đặt Git và kiểm tra cấu hình cơ bản trước khi bắt đầu làm việc với repository.'
            ELSE CASE seed_row.note_no % 7
                WHEN 0 THEN 'Mình cần tự giải thích lại chủ đề “' || seed_row.title || '” bằng ví dụ nhỏ thay vì chỉ xem thụ động.'
                WHEN 1 THEN 'Ý chính từ “' || seed_row.title || '” là chia kiến thức thành từng phần và kiểm tra lại bằng thực hành.'
                WHEN 2 THEN 'Sau khi xem “' || seed_row.title || '”, mình nên viết lại khái niệm theo cách hiểu của bản thân và ghi rõ phần còn vướng.'
                WHEN 3 THEN 'Nội dung “' || seed_row.title || '” gợi ý một quy trình học có mục tiêu, thử nghiệm và tự đánh giá kết quả.'
                WHEN 4 THEN 'Điểm cần áp dụng từ “' || seed_row.title || '” là ưu tiên nền tảng, sau đó mới tối ưu hoặc mở rộng.'
                WHEN 5 THEN 'Mình sẽ liên hệ kiến thức trong “' || seed_row.title || '” với đồ án Life Lab để tránh học rời rạc.'
                ELSE 'Phần đáng xem lại trong “' || seed_row.title || '” là cách biến lý thuyết thành các bước có thể kiểm chứng.'
            END
        END;

        INSERT INTO notes (
            account_id,
            youtube_source_id,
            content,
            timestamp_seconds,
            created_at,
            updated_at)
        SELECT
            account.id,
            seed_row.youtube_source_id,
            note_content,
            note_timestamp_seconds,
            note_created_at,
            note_created_at
        FROM accounts account
        WHERE account.email = 'demo@lifelab.local'
        RETURNING id INTO inserted_note_id;

        INSERT INTO a1_note_map VALUES (
            format('current-%s-%s', seed_row.video_no, seed_row.note_no),
            inserted_note_id,
            seed_row.video_no,
            seed_row.note_no,
            note_created_at);
    END LOOP;
END
$$;

DO $$
DECLARE
    h1_source_id BIGINT;
    account_id_value BIGINT;
    reference_instant_value TIMESTAMPTZ;
    first_note_id BIGINT;
    second_note_id BIGINT;
BEGIN
    SELECT youtube.id INTO h1_source_id
    FROM youtube_videos youtube
    WHERE youtube.youtube_video_id = '-XsRLyKV9_k';

    SELECT id INTO account_id_value
    FROM accounts WHERE email = 'demo@lifelab.local';

    SELECT reference_instant INTO reference_instant_value FROM a1_config;

    INSERT INTO notes VALUES (
        DEFAULT,
        account_id_value,
        h1_source_id,
        'Khi làm việc nhóm với Git, cần thống nhất nhánh làm việc, cập nhật thay đổi thường xuyên và xử lý xung đột có chủ đích.',
        NULL,
        reference_instant_value - interval '105 days',
        reference_instant_value - interval '103 days')
    RETURNING id INTO first_note_id;

    INSERT INTO a1_note_map VALUES (
        'historical-h1-linked', first_note_id, NULL, NULL,
        reference_instant_value - interval '105 days');

    INSERT INTO notes VALUES (
        DEFAULT,
        account_id_value,
        h1_source_id,
        'Trước khi tạo pull request, mình nên kiểm tra commit, đọc lại thay đổi và mô tả rõ mục tiêu để đồng đội dễ review.',
        NULL,
        reference_instant_value - interval '82 days',
        reference_instant_value - interval '80 days')
    RETURNING id INTO second_note_id;

    INSERT INTO a1_note_map VALUES (
        'historical-h1-unlinked', second_note_id, NULL, NULL,
        reference_instant_value - interval '82 days');
END
$$;

CREATE TEMP TABLE a1_single_notes AS
WITH ranked AS (
    SELECT
        note.*,
        row_number() OVER (
            ORDER BY
                CASE
                    WHEN video_no = 35 AND note_no IN (1, 2) THEN 0
                    WHEN video_no = 7 AND note_no = 1 THEN 1
                    ELSE 2
                END,
                video_no,
                note_no) AS selection_rank
    FROM a1_note_map note
    WHERE video_no IS NOT NULL)
SELECT * FROM ranked WHERE selection_rank <= 49;

CREATE TEMP TABLE a1_double_notes AS
WITH ranked AS (
    SELECT
        note.*,
        row_number() OVER (
            ORDER BY
                CASE WHEN video_no = 31 AND note_no = 1 THEN 0 ELSE 1 END,
                video_no,
                note_no) AS selection_rank
    FROM a1_note_map note
    WHERE video_no IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM a1_single_notes single_note
          WHERE single_note.note_id = note.note_id))
SELECT * FROM ranked WHERE selection_rank <= 5;

CREATE TEMP TABLE a1_task_map (
    task_key TEXT PRIMARY KEY,
    task_id BIGINT NOT NULL,
    source_group TEXT NOT NULL,
    sequence_no INTEGER NOT NULL
);

DO $$
DECLARE
    seed_row RECORD;
    inserted_task_id BIGINT;
    task_title TEXT;
BEGIN
    FOR seed_row IN
        SELECT single_note.*, row_number() OVER (ORDER BY selection_rank) AS task_sequence
        FROM a1_single_notes single_note
        ORDER BY selection_rank
    LOOP
        task_title := CASE
            WHEN seed_row.video_no = 7 AND seed_row.note_no = 1
                THEN 'Ôn lại Controller - Service - Repository'
            WHEN seed_row.video_no = 35 AND seed_row.note_no = 1
                THEN 'Bổ sung test cho luồng tạo dữ liệu chính'
            WHEN seed_row.video_no = 35 AND seed_row.note_no = 2
                THEN 'Rà soát integration test của backend'
            ELSE CASE seed_row.task_sequence % 5
                WHEN 0 THEN 'Viết ví dụ thực hành từ ghi chú đã lưu'
                WHEN 1 THEN 'Tóm tắt lại khái niệm bằng lời của mình'
                WHEN 2 THEN 'Áp dụng ghi chú vào một phần của đồ án'
                WHEN 3 THEN 'Kiểm tra lại phần kiến thức còn chưa chắc'
                ELSE 'Chuẩn bị câu hỏi để đào sâu nội dung đã học'
            END
        END;

        INSERT INTO tasks (
            account_id, source_note_id, source_status, title, description,
            status, deadline, created_at, updated_at)
        SELECT
            account.id,
            seed_row.note_id,
            'HAS_SOURCE',
            task_title,
            'Hoàn thành bằng một kết quả cụ thể và ghi lại điều học được sau khi thực hiện.',
            'NOT_STARTED',
            NULL,
            seed_row.created_at + (1 + seed_row.task_sequence % 4) * interval '1 day',
            seed_row.created_at + (1 + seed_row.task_sequence % 4) * interval '1 day'
        FROM accounts account
        WHERE account.email = 'demo@lifelab.local'
        RETURNING id INTO inserted_task_id;

        INSERT INTO a1_task_map VALUES (
            format('has-single-%s', seed_row.task_sequence),
            inserted_task_id,
            'HAS_SOURCE',
            seed_row.task_sequence);
    END LOOP;
END
$$;

DO $$
DECLARE
    seed_row RECORD;
    copy_no INTEGER;
    inserted_task_id BIGINT;
    sequence_value INTEGER;
BEGIN
    FOR seed_row IN
        SELECT double_note.*, row_number() OVER (ORDER BY selection_rank) AS note_sequence
        FROM a1_double_notes double_note
        ORDER BY selection_rank
    LOOP
        FOR copy_no IN 1..2 LOOP
            sequence_value := 49 + (seed_row.note_sequence - 1) * 2 + copy_no;

            INSERT INTO tasks (
                account_id, source_note_id, source_status, title, description,
                status, deadline, created_at, updated_at)
            SELECT
                account.id,
                seed_row.note_id,
                'HAS_SOURCE',
                CASE copy_no
                    WHEN 1 THEN 'Thực hành lại nội dung quan trọng từ ghi chú'
                    ELSE 'Đối chiếu kết quả thực hành với ghi chú nguồn'
                END,
                CASE WHEN seed_row.video_no = 31 AND seed_row.note_no = 1
                    THEN 'Fixture xóa Note: hai công việc này phải được giữ lại và chuyển sang source missing.'
                    ELSE 'Hai bước liên quan cùng một ghi chú nhưng tạo ra hai kết quả học tập riêng.'
                END,
                'NOT_STARTED',
                NULL,
                seed_row.created_at + (2 + copy_no) * interval '1 day',
                seed_row.created_at + (2 + copy_no) * interval '1 day'
            FROM accounts account
            WHERE account.email = 'demo@lifelab.local'
            RETURNING id INTO inserted_task_id;

            INSERT INTO a1_task_map VALUES (
                format('has-double-%s-%s', seed_row.note_sequence, copy_no),
                inserted_task_id,
                'HAS_SOURCE',
                sequence_value);
        END LOOP;
    END LOOP;
END
$$;

WITH historical AS (
    SELECT * FROM a1_note_map WHERE note_key = 'historical-h1-linked'),
inserted AS (
    INSERT INTO tasks (
        account_id, source_note_id, source_status, title, description,
        status, deadline, created_at, updated_at)
    SELECT
        account.id,
        historical.note_id,
        'HAS_SOURCE',
        'Xem lại cách làm việc nhóm với Git',
        'Mở lại đúng nguồn Git lịch sử và hệ thống hóa quy trình branch, commit và pull request.',
        'NOT_STARTED',
        NULL,
        historical.created_at + interval '3 days',
        historical.created_at + interval '3 days'
    FROM historical
    CROSS JOIN accounts account
    WHERE account.email = 'demo@lifelab.local'
    RETURNING id)
INSERT INTO a1_task_map
SELECT 'has-historical-h1', id, 'HAS_SOURCE', 60 FROM inserted;

DO $$
DECLARE
    sequence_value INTEGER;
    inserted_task_id BIGINT;
    reference_instant_value TIMESTAMPTZ;
    title_value TEXT;
BEGIN
    SELECT reference_instant INTO reference_instant_value FROM a1_config;

    FOR sequence_value IN 1..50 LOOP
        title_value := CASE sequence_value
            WHEN 1 THEN 'Chuẩn bị trình bày thi công Life Lab'
            WHEN 2 THEN 'Lập kế hoạch học backend cho tuần tới'
            WHEN 3 THEN 'Dọn lại danh sách mục tiêu tiếng Anh'
            WHEN 4 THEN 'Chuẩn bị nội dung cập nhật portfolio'
            WHEN 5 THEN 'Tổng kết tiến độ đồ án trong tuần'
            ELSE CASE sequence_value % 8
                WHEN 0 THEN 'Rà soát mục tiêu học tập và điều chỉnh ưu tiên'
                WHEN 1 THEN 'Luyện viết phần mô tả kỹ thuật ngắn gọn'
                WHEN 2 THEN 'Chuẩn bị câu hỏi cho buổi học tiếp theo'
                WHEN 3 THEN 'Sắp xếp thời gian thực hành dự án cá nhân'
                WHEN 4 THEN 'Ôn lại từ vựng chuyên ngành đã lưu'
                WHEN 5 THEN 'Kiểm tra tiến độ các mục tiêu trong tháng'
                WHEN 6 THEN 'Viết nhật ký ngắn về điều đã học được'
                ELSE 'Chuẩn bị ví dụ để luyện giải thích khái niệm'
            END
        END;

        INSERT INTO tasks (
            account_id, source_note_id, source_status, title, description,
            status, deadline, created_at, updated_at)
        SELECT
            account.id,
            NULL,
            'INDEPENDENT',
            title_value,
            CASE WHEN sequence_value % 3 = 0
                THEN NULL
                ELSE 'Công việc độc lập được lập từ kế hoạch cá nhân, không gắn với một Note nguồn.'
            END,
            'NOT_STARTED',
            NULL,
            reference_instant_value - (120 - sequence_value * 2) * interval '1 day',
            reference_instant_value - (120 - sequence_value * 2) * interval '1 day'
        FROM accounts account
        WHERE account.email = 'demo@lifelab.local'
        RETURNING id INTO inserted_task_id;

        INSERT INTO a1_task_map VALUES (
            format('independent-%s', sequence_value),
            inserted_task_id,
            'INDEPENDENT',
            sequence_value);
    END LOOP;
END
$$;

-- Create SOURCE_MISSING through the real lifecycle shape: Note -> HAS_SOURCE Task -> unlink -> delete Note.
DO $$
DECLARE
    sequence_value INTEGER;
    temporary_note_id BIGINT;
    inserted_task_id BIGINT;
    account_id_value BIGINT;
    source_id_value BIGINT;
    reference_instant_value TIMESTAMPTZ;
BEGIN
    SELECT id INTO account_id_value FROM accounts WHERE email = 'demo@lifelab.local';
    SELECT youtube_source_id INTO source_id_value FROM a1_library_map WHERE video_no = 6;
    SELECT reference_instant INTO reference_instant_value FROM a1_config;

    FOR sequence_value IN 1..15 LOOP
        INSERT INTO notes (
            account_id, youtube_source_id, content, timestamp_seconds, created_at, updated_at)
        VALUES (
            account_id_value,
            source_id_value,
            'Ghi chú tạm dùng để mô phỏng vòng đời nguồn Task bị xóa theo đúng nghiệp vụ.',
            NULL,
            reference_instant_value - (75 - sequence_value) * interval '1 day',
            reference_instant_value - (75 - sequence_value) * interval '1 day')
        RETURNING id INTO temporary_note_id;

        INSERT INTO tasks (
            account_id, source_note_id, source_status, title, description,
            status, deadline, created_at, updated_at)
        VALUES (
            account_id_value,
            temporary_note_id,
            'HAS_SOURCE',
            CASE sequence_value
                WHEN 1 THEN 'Làm lại ví dụ Dependency Injection'
                ELSE CASE sequence_value % 4
                    WHEN 0 THEN 'Khôi phục phần thực hành từ ghi chú cũ'
                    WHEN 1 THEN 'Tự dựng lại ví dụ đã mất nguồn ghi chú'
                    WHEN 2 THEN 'Kiểm tra kiến thức còn nhớ sau khi mất nguồn'
                    ELSE 'Hoàn thiện công việc dù ghi chú gốc không còn'
                END
            END,
            'Task được giữ lại sau khi Note nguồn bị xóa; không tự ý gắn sang nguồn khác.',
            'NOT_STARTED',
            NULL,
            reference_instant_value - (73 - sequence_value) * interval '1 day',
            reference_instant_value - (73 - sequence_value) * interval '1 day')
        RETURNING id INTO inserted_task_id;

        UPDATE tasks
        SET source_note_id = NULL,
            source_status = 'SOURCE_MISSING',
            updated_at = updated_at + interval '1 day'
        WHERE id = inserted_task_id;

        DELETE FROM notes WHERE id = temporary_note_id;

        INSERT INTO a1_task_map VALUES (
            format('source-missing-%s', sequence_value),
            inserted_task_id,
            'SOURCE_MISSING',
            sequence_value);
    END LOOP;
END
$$;

UPDATE tasks task
SET status = CASE map.source_group
        WHEN 'HAS_SOURCE' THEN CASE
            WHEN map.sequence_no <= 20 THEN 'NOT_STARTED'
            WHEN map.sequence_no <= 40 THEN 'IN_PROGRESS'
            ELSE 'COMPLETED'
        END
        WHEN 'INDEPENDENT' THEN CASE
            WHEN map.sequence_no <= 20 THEN 'NOT_STARTED'
            WHEN map.sequence_no <= 30 THEN 'IN_PROGRESS'
            ELSE 'COMPLETED'
        END
        ELSE CASE
            WHEN map.sequence_no <= 5 THEN 'NOT_STARTED'
            WHEN map.sequence_no <= 10 THEN 'IN_PROGRESS'
            ELSE 'COMPLETED'
        END
    END,
    updated_at = GREATEST(
        task.updated_at,
        task.created_at + CASE
            WHEN map.sequence_no % 3 = 0 THEN interval '4 days'
            WHEN map.sequence_no % 3 = 1 THEN interval '2 days'
            ELSE interval '1 day'
        END)
FROM a1_task_map map
WHERE task.id = map.task_id;

WITH incomplete AS (
    SELECT
        task.id,
        row_number() OVER (
            ORDER BY
                CASE map.source_group
                    WHEN 'HAS_SOURCE' THEN 1
                    WHEN 'INDEPENDENT' THEN 2
                    ELSE 3
                END,
                map.sequence_no) AS deadline_rank
    FROM tasks task
    JOIN a1_task_map map ON map.task_id = task.id
    WHERE task.status <> 'COMPLETED')
UPDATE tasks task
SET deadline = CASE
        WHEN incomplete.deadline_rank <= 20
            THEN config.reference_date - (1 + incomplete.deadline_rank % 18)::integer
        WHEN incomplete.deadline_rank <= 38
            THEN config.reference_date
        WHEN incomplete.deadline_rank <= 60
            THEN config.reference_date + (1 + incomplete.deadline_rank % 35)::integer
        ELSE NULL
    END
FROM incomplete
CROSS JOIN a1_config config
WHERE task.id = incomplete.id;

UPDATE tasks task
SET deadline = CASE
        WHEN map.sequence_no % 4 = 0 THEN NULL
        WHEN map.sequence_no % 4 = 1 THEN config.reference_date - (map.sequence_no % 60)
        ELSE config.reference_date + (map.sequence_no % 45)
    END
FROM a1_task_map map
CROSS JOIN a1_config config
WHERE task.id = map.task_id
  AND task.status = 'COMPLETED';

DO $$
DECLARE
    account_id_value BIGINT;
BEGIN
    SELECT id INTO account_id_value FROM accounts WHERE email = 'demo@lifelab.local';

    IF (SELECT count(*) FROM library_videos WHERE account_id = account_id_value) <> 36
       OR (SELECT count(*) FROM tags WHERE account_id = account_id_value) <> 24
       OR (SELECT count(*) FROM library_video_tags relation
           JOIN library_videos library ON library.id = relation.library_video_id
           WHERE library.account_id = account_id_value) <> 100
       OR (SELECT count(*) FROM watch_sessions session
           JOIN library_videos library ON library.id = session.library_video_id
           WHERE library.account_id = account_id_value) <> 160
       OR (SELECT count(*) FROM notes WHERE account_id = account_id_value) <> 94
       OR (SELECT count(*) FROM tasks WHERE account_id = account_id_value) <> 125 THEN
        RAISE EXCEPTION 'A1 seed postcondition count failed';
    END IF;
END
$$;

COMMIT;

SELECT 'account' AS metric, count(*)::bigint AS value
FROM accounts WHERE email = 'demo@lifelab.local'
UNION ALL
SELECT 'library_videos', count(*)
FROM library_videos library
JOIN accounts account ON account.id = library.account_id
WHERE account.email = 'demo@lifelab.local'
UNION ALL
SELECT 'watch_sessions', count(*)
FROM watch_sessions session
JOIN library_videos library ON library.id = session.library_video_id
JOIN accounts account ON account.id = library.account_id
WHERE account.email = 'demo@lifelab.local'
UNION ALL
SELECT 'notes', count(*) FROM notes note
JOIN accounts account ON account.id = note.account_id
WHERE account.email = 'demo@lifelab.local'
UNION ALL
SELECT 'tasks', count(*) FROM tasks task
JOIN accounts account ON account.id = task.account_id
WHERE account.email = 'demo@lifelab.local';
