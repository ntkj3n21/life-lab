BEGIN TRANSACTION READ ONLY;

WITH
a1 AS (
    SELECT id AS account_id
    FROM accounts
    WHERE lower(email) = 'demo@lifelab.local'),
snapshot_ids AS (
    SELECT ids.youtube_video_id, ids.library_order::integer AS library_order
    FROM unnest(string_to_array(:'snapshot_ids', ',')) WITH ORDINALITY
        AS ids(youtube_video_id, library_order)),
expected_matrix(youtube_video_id, valid_count, invalid_count, note_count) AS (
    VALUES
        ('7L0RLrfrBHE',12,1,9),('IedQ5sZoJGY',4,1,3),('UAYrGeLUeX4',4,1,3),
        ('xMp7wz1Rwm4',4,0,3),('wMkgr9hoL_8',0,2,0),('pV45eVVcuYc',9,1,7),
        ('L-ZrZwvNsuo',6,1,4),('38FxjicRCS8',3,0,3),('nm6qg6sinLU',0,2,0),
        ('BTNU1aPwxvg',8,1,5),('SIAGpAaLSaI',5,1,3),('_yfpSc6ubLE',0,2,0),
        ('30sMCciFIAM',4,0,3),('hjIxfXKmkjk',5,1,5),('unFHsn0qSMA',0,2,0),
        ('6TE1VEIWqLE',2,0,0),('nCVDg40aoeY',3,1,3),('0uAc1K2kfrA',0,2,0),
        ('-BtolPy15fg',4,1,2),('QoW2wR_P4WU',6,1,5),('OqdLrih2G9A',5,1,4),
        ('MICKb4Cko2Y',4,1,4),('yd17Or0C4vs',3,0,4),('6-uzl3hLfLM',4,1,4),
        ('lk4faynwZ5Q',2,1,4),('Uq3KjJA8BHQ',0,2,0),('2GbX7PB7KUQ',0,2,0),
        ('BMo3pDEq6Ac',0,2,0),('Lgy0tRU7Zcc',0,2,0),('lqWDu83zHDg',0,2,0),
        ('Cw0J6jYJtzw',7,1,6),('her_7pa0vrg',7,1,6),('Gjnup-PuquQ',3,1,0),
        ('kkeFE6iRfMM',0,2,0),('Geq60OVyBPg',3,1,2),('iYM2zFP3Zn0',0,2,0)),
actual_matrix AS (
    SELECT
        youtube.youtube_video_id,
        (SELECT count(*)::integer
         FROM watch_sessions session
         WHERE session.library_video_id = library.id
           AND session.validity_status = 'VALID') AS valid_count,
        (SELECT count(*)::integer
         FROM watch_sessions session
         WHERE session.library_video_id = library.id
           AND session.validity_status = 'INVALID') AS invalid_count,
        (SELECT count(*)::integer
         FROM notes note
         WHERE note.account_id = a1.account_id
           AND note.youtube_source_id = youtube.id) AS note_count
    FROM library_videos library
    JOIN a1 ON a1.account_id = library.account_id
    JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
),
matrix_differences AS (
    SELECT count(*) AS difference_count
    FROM expected_matrix expected
    FULL JOIN actual_matrix actual USING (youtube_video_id)
    WHERE expected.youtube_video_id IS NULL
       OR actual.youtube_video_id IS NULL
       OR expected.valid_count <> actual.valid_count
       OR expected.invalid_count <> actual.invalid_count
       OR expected.note_count <> actual.note_count),
expected_replacements(youtube_video_id, title, channel_name, duration_seconds) AS (
    VALUES
        ('L-ZrZwvNsuo',
         'Spring Boot #9: Tạo RESTful API trong Spring Boot như thế nào?',
         'TechMaster Vietnam', 294),
        ('6TE1VEIWqLE',
         'CHIA SẺ KỸ NĂNG MỀM CHO SINH VIÊN: Rèn luyện kỹ năng giao tiếp và thuyết trình tốt (BUỔI 2)',
         'Học trực tuyến e-Learning', 7431)),
replacement_differences AS (
    SELECT count(*) AS difference_count
    FROM expected_replacements expected
    FULL JOIN (
        SELECT youtube.youtube_video_id, youtube.title, youtube.channel_name,
               youtube.duration_seconds
        FROM library_videos library
        JOIN a1 ON a1.account_id = library.account_id
        JOIN youtube_videos youtube ON youtube.id = library.youtube_source_id
        WHERE youtube.youtube_video_id IN ('L-ZrZwvNsuo', '6TE1VEIWqLE')
    ) actual USING (youtube_video_id)
    WHERE expected.youtube_video_id IS NULL
       OR actual.youtube_video_id IS NULL
       OR expected.title <> actual.title
       OR expected.channel_name <> actual.channel_name
       OR expected.duration_seconds <> actual.duration_seconds),
ranked_current_notes AS (
    SELECT
        youtube.youtube_video_id,
        row_number() OVER (
            PARTITION BY note.youtube_source_id
            ORDER BY note.id)::integer AS note_no,
        note.timestamp_seconds,
        note.content
    FROM notes note
    JOIN a1 ON a1.account_id = note.account_id
    JOIN library_videos library
      ON library.account_id = a1.account_id
     AND library.youtube_source_id = note.youtube_source_id
    JOIN youtube_videos youtube ON youtube.id = note.youtube_source_id),
expected_legacy_timestamp_anchors(youtube_video_id, note_no, timestamp_seconds, content) AS (
    VALUES
        ('IedQ5sZoJGY', 1, 202, 'Lớp là khuôn mẫu mô tả cấu trúc và hành vi; đối tượng là một thể hiện cụ thể được tạo từ lớp đó.'),
        ('IedQ5sZoJGY', 2, 300, 'Thuộc tính biểu diễn dữ liệu hoặc trạng thái của đối tượng, còn phương thức biểu diễn hành vi mà đối tượng có thể thực hiện.'),
        ('IedQ5sZoJGY', 3, 382, 'Khi thiết kế một lớp, cần xác định dữ liệu lớp sở hữu và các trách nhiệm hoặc hành vi mà lớp phải đảm nhận.'),
        ('nCVDg40aoeY', 1, 135, 'Phần tổng quan CV nên truyền đạt ngắn gọn định hướng và những điểm mạnh nổi bật nhất của ứng viên.'),
        ('nCVDg40aoeY', 2, 525, 'Phần dự án cần nêu rõ mình đã làm gì, công nghệ đã dùng và kết quả hoặc giá trị hữu ích tạo ra.'),
        ('-BtolPy15fg', 1, 349, 'Cài đặt Git và kiểm tra cấu hình cơ bản trước khi bắt đầu làm việc với repository.')),
actual_legacy_timestamp_anchors AS (
    SELECT actual.*
    FROM ranked_current_notes actual
    JOIN expected_legacy_timestamp_anchors expected
      USING (youtube_video_id, note_no)),
legacy_timestamp_anchor_differences AS (
    SELECT count(*) AS difference_count
    FROM expected_legacy_timestamp_anchors expected
    FULL JOIN actual_legacy_timestamp_anchors actual
      USING (youtube_video_id, note_no, timestamp_seconds, content)
    WHERE expected.youtube_video_id IS NULL
       OR actual.youtube_video_id IS NULL),
expected_vtt_note_seed(video_no, note_no, timestamp_seconds, content) AS (
    VALUES
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
        (35,2,1785,'Repository test trong khóa học không chạy trực tiếp trên PostgreSQL local mà dùng H2 in-memory để tránh ghi dữ liệu test vào database phát triển.')),
expected_vtt_notes AS (
    SELECT snapshot.youtube_video_id, expected.note_no,
           expected.timestamp_seconds, expected.content
    FROM expected_vtt_note_seed expected
    JOIN snapshot_ids snapshot ON snapshot.library_order = expected.video_no),
actual_vtt_notes AS (
    SELECT actual.*
    FROM ranked_current_notes actual
    JOIN expected_vtt_notes expected USING (youtube_video_id, note_no)),
vtt_note_identity_differences AS (
    SELECT count(*) AS difference_count
    FROM expected_vtt_notes expected
    FULL JOIN actual_vtt_notes actual
      USING (youtube_video_id, note_no, timestamp_seconds, content)
    WHERE expected.youtube_video_id IS NULL
       OR actual.youtube_video_id IS NULL),
expected_zero_note_videos(video_no) AS (
    VALUES (5),(9),(12),(15),(16),(18),(26),(27),(28),(29),(30),(33),(34),(36)),
zero_note_video_differences AS (
    SELECT count(*) AS difference_count
    FROM expected_zero_note_videos expected
    JOIN snapshot_ids snapshot ON snapshot.library_order = expected.video_no
    LEFT JOIN youtube_videos youtube
      ON youtube.youtube_video_id = snapshot.youtube_video_id
    LEFT JOIN library_videos library
      ON library.account_id = (SELECT account_id FROM a1)
     AND library.youtube_source_id = youtube.id
    WHERE library.id IS NULL
       OR EXISTS (
           SELECT 1 FROM notes note
           WHERE note.account_id = (SELECT account_id FROM a1)
             AND note.youtube_source_id = youtube.id)),
library_tag_counts AS (
    SELECT library.id, count(relation.tag_id)::integer AS tag_count
    FROM library_videos library
    JOIN a1 ON a1.account_id = library.account_id
    LEFT JOIN library_video_tags relation ON relation.library_video_id = library.id
    GROUP BY library.id),
tag_distribution AS (
    SELECT tag_count, count(*)::integer AS video_count
    FROM library_tag_counts
    GROUP BY tag_count),
current_note_task_counts AS (
    SELECT note.id, count(task.id)::integer AS task_count
    FROM notes note
    JOIN a1 ON a1.account_id = note.account_id
    JOIN library_videos library
      ON library.account_id = a1.account_id
     AND library.youtube_source_id = note.youtube_source_id
    LEFT JOIN tasks task
      ON task.account_id = a1.account_id
     AND task.source_note_id = note.id
    GROUP BY note.id),
historical_note_task_counts AS (
    SELECT note.id, count(task.id)::integer AS task_count
    FROM notes note
    JOIN a1 ON a1.account_id = note.account_id
    LEFT JOIN library_videos library
      ON library.account_id = a1.account_id
     AND library.youtube_source_id = note.youtube_source_id
    LEFT JOIN tasks task
      ON task.account_id = a1.account_id
     AND task.source_note_id = note.id
    WHERE library.id IS NULL
    GROUP BY note.id),
daily_plan AS (
    SELECT
        count(*) FILTER (
            WHERE task.status <> 'COMPLETED'
              AND task.deadline < :'reference_date'::date) AS overdue,
        count(*) FILTER (
            WHERE task.status <> 'COMPLETED'
              AND task.deadline = :'reference_date'::date) AS today,
        count(*) FILTER (
            WHERE task.status <> 'COMPLETED'
              AND task.deadline > :'reference_date'::date) AS upcoming,
        count(*) FILTER (
            WHERE task.status <> 'COMPLETED'
              AND task.deadline IS NULL) AS no_deadline,
        count(*) FILTER (WHERE task.status = 'COMPLETED') AS completed
    FROM tasks task
    JOIN a1 ON a1.account_id = task.account_id),
checks(check_name, expected, actual, passed, details) AS (
    SELECT 'account_count','1',count(*)::text,count(*)=1,'locked A1 email appears exactly once'
    FROM accounts WHERE lower(email)='demo@lifelab.local'
    UNION ALL SELECT 'account_identity','Life Lab Demo + BCrypt',
        coalesce(max(display_name),'missing') || ' + ' ||
            CASE WHEN max(password_hash) ~ '^\$2[aby]\$[0-9]{2}\$.{53}$' THEN 'BCrypt' ELSE 'invalid hash' END,
        count(*)=1 AND max(display_name)='Life Lab Demo'
            AND max(password_hash) ~ '^\$2[aby]\$[0-9]{2}\$.{53}$'
            AND max(password_hash)<>'LifeLab@2026',
        'password must be BCrypt and never plaintext'
    FROM accounts WHERE lower(email)='demo@lifelab.local'
    UNION ALL SELECT 'snapshot_sources','37',count(*)::text,count(*)=37,
        'all snapshot IDs exist with known duration and AVAILABLE state'
    FROM youtube_videos youtube
    JOIN snapshot_ids snapshot USING (youtube_video_id)
    WHERE youtube.duration_seconds IS NOT NULL
      AND youtube.duration_seconds > 0
      AND youtube.availability_status='AVAILABLE'
    UNION ALL SELECT 'replacement_sources','2 exact replacements',
        (2-difference_count)::text || ' exact replacements',difference_count=0,
        'LIBRARY_07 and LIBRARY_16 IDs, metadata, channels, and durations are locked'
    FROM replacement_differences
    UNION ALL SELECT 'removed_current_sources','0',count(*)::text,count(*)=0,
        'replaced inaccessible source IDs must be absent from the current A1 Library'
    FROM library_videos library
    JOIN a1 ON a1.account_id=library.account_id
    JOIN youtube_videos youtube ON youtube.id=library.youtube_source_id
    WHERE youtube.youtube_video_id IN ('VzHjQ4QyILI','a-hFh-Wc0JI')
    UNION ALL SELECT 'library_videos','36',count(*)::text,count(*)=36,'A1-owned Library rows'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    UNION ALL SELECT 'unique_library_sources','36',count(DISTINCT library.youtube_source_id)::text,
        count(*)=36 AND count(DISTINCT library.youtube_source_id)=36,'no duplicate A1 Library source'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    UNION ALL SELECT 'tags','24',count(*)::text,count(*)=24,'A1-owned Tags'
    FROM tags tag JOIN a1 ON a1.account_id=tag.account_id
    UNION ALL SELECT 'normalized_tag_uniqueness','24',count(DISTINCT normalized_name)::text,
        count(*)=24 AND count(DISTINCT normalized_name)=24,'normalized names are unique'
    FROM tags tag JOIN a1 ON a1.account_id=tag.account_id
    UNION ALL SELECT 'tag_links','100',count(*)::text,count(*)=100,'A1 LibraryVideoTag links'
    FROM library_video_tags relation
    JOIN library_videos library ON library.id=relation.library_video_id
    JOIN a1 ON a1.account_id=library.account_id
    UNION ALL SELECT 'tag_count_distribution','0:1,1:4,2:9,3:12,4:8,5:2',
        coalesce(string_agg(tag_count || ':' || video_count,',' ORDER BY tag_count),'empty'),
        coalesce(string_agg(tag_count || ':' || video_count,',' ORDER BY tag_count),'empty')
            = '0:1,1:4,2:9,3:12,4:8,5:2','exact per-video tag-count distribution'
    FROM tag_distribution
    UNION ALL SELECT 'watch_sessions','160',count(*)::text,count(*)=160,'closed A1 WatchSessions'
    FROM watch_sessions session
    JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id
    UNION ALL SELECT 'watch_valid','117',count(*)::text,count(*)=117,'VALID WatchSessions'
    FROM watch_sessions session JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id WHERE session.validity_status='VALID'
    UNION ALL SELECT 'watch_invalid','43',count(*)::text,count(*)=43,'INVALID WatchSessions'
    FROM watch_sessions session JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id WHERE session.validity_status='INVALID'
    UNION ALL SELECT 'watch_pending','0',count(*)::text,count(*)=0,'no PENDING historical session'
    FROM watch_sessions session JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id WHERE session.validity_status='PENDING'
    UNION ALL SELECT 'watch_undetermined','0',count(*)::text,count(*)=0,'no UNDETERMINED session'
    FROM watch_sessions session JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id WHERE session.validity_status='UNDETERMINED'
    UNION ALL SELECT 'watch_threshold_policy','0 violations',count(*)::text,count(*)=0,
        'VALID reaches min(30,ceil(80%)); INVALID remains below it'
    FROM watch_sessions session
    JOIN library_videos library ON library.id=session.library_video_id
    JOIN youtube_videos youtube ON youtube.id=library.youtube_source_id
    JOIN a1 ON a1.account_id=library.account_id
    WHERE (session.validity_status='VALID' AND session.watch_time_seconds <
            LEAST(30, ((youtube.duration_seconds::bigint*4+4)/5)::integer))
       OR (session.validity_status='INVALID' AND session.watch_time_seconds >=
            LEAST(30, ((youtube.duration_seconds::bigint*4+4)/5)::integer))
    UNION ALL SELECT 'watch_time_order','0 violations',count(*)::text,count(*)=0,
        'startedAt <= lastHeartbeatAt <= endedAt and every session is closed'
    FROM watch_sessions session
    JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id
    WHERE session.ended_at IS NULL
       OR session.started_at > session.last_heartbeat_at
       OR session.last_heartbeat_at > session.ended_at
    UNION ALL SELECT 'watch_note_matrix','0 differences',difference_count::text,
        difference_count=0,'locked 36-video VALID/INVALID/Note matrix'
    FROM matrix_differences
    UNION ALL SELECT 'watched_videos','24',count(*)::text,count(*)=24,'derived from at least one VALID session'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE EXISTS (SELECT 1 FROM watch_sessions session
        WHERE session.library_video_id=library.id AND session.validity_status='VALID')
    UNION ALL SELECT 'unwatched_videos','12',count(*)::text,count(*)=12,'no VALID session'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE NOT EXISTS (SELECT 1 FROM watch_sessions session
        WHERE session.library_video_id=library.id AND session.validity_status='VALID')
    UNION ALL SELECT 'notes','94',count(*)::text,count(*)=94,'final A1 Notes'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    UNION ALL SELECT 'current_notes','92',count(*)::text,count(*)=92,'Notes whose source remains in A1 Library'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    WHERE EXISTS (SELECT 1 FROM library_videos library
        WHERE library.account_id=a1.account_id AND library.youtube_source_id=note.youtube_source_id)
    UNION ALL SELECT 'historical_h1_notes','2',count(*)::text,count(*)=2,
        'both historical Notes reference H1 and no A1 LibraryVideo exists for H1'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    JOIN youtube_videos youtube ON youtube.id=note.youtube_source_id
    WHERE youtube.youtube_video_id='-XsRLyKV9_k'
      AND NOT EXISTS (SELECT 1 FROM library_videos library
          WHERE library.account_id=a1.account_id AND library.youtube_source_id=youtube.id)
    UNION ALL SELECT 'videos_with_notes','22',count(*)::text,count(*)=22,'current sources with at least one Note'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE EXISTS (SELECT 1 FROM notes note
        WHERE note.account_id=a1.account_id AND note.youtube_source_id=library.youtube_source_id)
    UNION ALL SELECT 'videos_without_notes','14',count(*)::text,count(*)=14,'current sources without Notes'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE NOT EXISTS (SELECT 1 FROM notes note
        WHERE note.account_id=a1.account_id AND note.youtube_source_id=library.youtube_source_id)
    UNION ALL SELECT 'zero_note_video_identity','0 differences',difference_count::text,
        difference_count=0,'videos 5,9,12,15,16,18,26,27,28,29,30,33,34,36 remain the exact zero-Note set'
    FROM zero_note_video_differences
    UNION ALL SELECT 'custom_titles','10',count(*)::text,count(*)=10,'meaningful personal titles'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE library.custom_title IS NOT NULL
    UNION ALL SELECT 'personal_descriptions','14',count(*)::text,count(*)=14,'meaningful personal descriptions'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    WHERE library.personal_description IS NOT NULL
    UNION ALL SELECT 'timestamp_bounds_violations','0',count(*)::text,count(*)=0,
        'every VTT-backed and legacy timestamp fits the known source duration'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    JOIN youtube_videos youtube ON youtube.id=note.youtube_source_id
    WHERE note.timestamp_seconds IS NOT NULL
      AND (youtube.duration_seconds IS NULL OR note.timestamp_seconds > youtube.duration_seconds)
    UNION ALL SELECT 'verified_note_timestamps','56',count(*)::text,count(*)=56,
        '50 transcript-backed Notes plus six legacy verified timestamp anchors'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    WHERE note.timestamp_seconds IS NOT NULL
    UNION ALL SELECT 'untimestamped_notes_total','38',count(*)::text,count(*)=38,
        '36 other current Notes plus two historical H1 Notes remain untimestamped'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    WHERE note.timestamp_seconds IS NULL
    UNION ALL SELECT 'vtt_backed_notes','50',count(*)::text,count(*)=50,
        'all 50 existing logical Note identities selected for transcript-backed content exist'
    FROM actual_vtt_notes
    UNION ALL SELECT 'vtt_backed_notes_with_timestamp','50',count(*)::text,count(*)=50,
        'every transcript-backed Note has its locked non-null timestamp'
    FROM actual_vtt_notes WHERE timestamp_seconds IS NOT NULL
    UNION ALL SELECT 'vtt_note_identity_differences','0',difference_count::text,
        difference_count=0,'youtubeVideoId, logical note_no, timestamp, and exact content all match'
    FROM vtt_note_identity_differences
    UNION ALL SELECT 'legacy_verified_timestamp_anchors','6',count(*)::text,count(*)=6,
        'the original OOP, CV, and Git anchors retain exact identity, content, and timestamp'
    FROM actual_legacy_timestamp_anchors actual
    JOIN expected_legacy_timestamp_anchors expected
      USING (youtube_video_id, note_no, timestamp_seconds, content)
    UNION ALL SELECT 'legacy_timestamp_anchor_differences','0',difference_count::text,
        difference_count=0,'all six legacy verified anchors remain unchanged'
    FROM legacy_timestamp_anchor_differences
    UNION ALL SELECT 'tasks','125',count(*)::text,count(*)=125,'final A1 Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    UNION ALL SELECT 'tasks_has_source','60',count(*)::text,count(*)=60,'linked Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.source_status='HAS_SOURCE'
    UNION ALL SELECT 'tasks_independent','50',count(*)::text,count(*)=50,'independent Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.source_status='INDEPENDENT'
    UNION ALL SELECT 'tasks_source_missing','15',count(*)::text,count(*)=15,'preserved Tasks with deleted Notes'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.source_status='SOURCE_MISSING'
    UNION ALL SELECT 'tasks_not_started','45',count(*)::text,count(*)=45,'NOT_STARTED Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.status='NOT_STARTED'
    UNION ALL SELECT 'tasks_in_progress','35',count(*)::text,count(*)=35,'IN_PROGRESS Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.status='IN_PROGRESS'
    UNION ALL SELECT 'tasks_completed','45',count(*)::text,count(*)=45,'COMPLETED Tasks'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id WHERE task.status='COMPLETED'
    UNION ALL SELECT 'current_notes_one_task','49',count(*)::text,count(*)=49,
        'approved current-source Note single-link distribution'
    FROM current_note_task_counts WHERE task_count=1
    UNION ALL SELECT 'current_notes_two_tasks','5',count(*)::text,count(*)=5,
        'approved current-source Note double-link distribution'
    FROM current_note_task_counts WHERE task_count=2
    UNION ALL SELECT 'historical_note_task_distribution','0:1,1:1',
        coalesce(string_agg(task_count || ':' || note_count,',' ORDER BY task_count),'empty'),
        coalesce(string_agg(task_count || ':' || note_count,',' ORDER BY task_count),'empty')='0:1,1:1',
        'one H1 Note linked once; the second H1 Note unlinked'
    FROM (SELECT task_count,count(*) AS note_count FROM historical_note_task_counts GROUP BY task_count) distribution
    UNION ALL SELECT 'task_source_consistency','0 violations',count(*)::text,count(*)=0,
        'HAS_SOURCE owns its Note; INDEPENDENT and SOURCE_MISSING have no Note'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    LEFT JOIN notes note ON note.id=task.source_note_id
    WHERE (task.source_status='HAS_SOURCE' AND
            (task.source_note_id IS NULL OR note.id IS NULL OR note.account_id<>task.account_id))
       OR (task.source_status IN ('INDEPENDENT','SOURCE_MISSING') AND task.source_note_id IS NOT NULL)
    UNION ALL SELECT 'daily_plan','20/18/22/20/45',
        overdue || '/' || today || '/' || upcoming || '/' || no_deadline || '/' || completed,
        overdue=20 AND today=18 AND upcoming=22 AND no_deadline=20 AND completed=45,
        'production precedence: Completed, then deadline relative to REFERENCE_DATE'
    FROM daily_plan
    UNION ALL SELECT 'publication_add_order','0 violations',count(*)::text,count(*)=0,
        'publishedAt <= LibraryVideo.addedAt'
    FROM library_videos library JOIN a1 ON a1.account_id=library.account_id
    JOIN youtube_videos youtube ON youtube.id=library.youtube_source_id
    WHERE youtube.published_at > library.added_at
    UNION ALL SELECT 'library_watch_order','0 violations',count(*)::text,count(*)=0,
        'LibraryVideo.addedAt <= WatchSession.startedAt'
    FROM watch_sessions session JOIN library_videos library ON library.id=session.library_video_id
    JOIN a1 ON a1.account_id=library.account_id WHERE library.added_at>session.started_at
    UNION ALL SELECT 'library_note_order','0 violations',count(*)::text,count(*)=0,
        'current LibraryVideo.addedAt <= Note.createdAt'
    FROM notes note JOIN a1 ON a1.account_id=note.account_id
    JOIN library_videos library ON library.account_id=a1.account_id
        AND library.youtube_source_id=note.youtube_source_id
    WHERE library.added_at>note.created_at
    UNION ALL SELECT 'note_task_order','0 violations',count(*)::text,count(*)=0,
        'linked Note.createdAt <= Task.createdAt'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    JOIN notes note ON note.id=task.source_note_id WHERE note.created_at>task.created_at
    UNION ALL SELECT 'created_updated_order','0 violations',
        (SELECT count(*) FROM (
            SELECT created_at,updated_at FROM accounts WHERE id=(SELECT account_id FROM a1)
            UNION ALL SELECT added_at,updated_at FROM library_videos WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM tags WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM notes WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM tasks WHERE account_id=(SELECT account_id FROM a1)
        ) records WHERE created_at>updated_at)::text,
        (SELECT count(*) FROM (
            SELECT created_at,updated_at FROM accounts WHERE id=(SELECT account_id FROM a1)
            UNION ALL SELECT added_at,updated_at FROM library_videos WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM tags WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM notes WHERE account_id=(SELECT account_id FROM a1)
            UNION ALL SELECT created_at,updated_at FROM tasks WHERE account_id=(SELECT account_id FROM a1)
        ) records WHERE created_at>updated_at)=0,
        'created/added timestamps never exceed updatedAt'
    UNION ALL SELECT 'reverse_workspace','WORKSPACE',
        CASE WHEN task.source_status='HAS_SOURCE' AND library.id IS NOT NULL
            AND youtube.availability_status='AVAILABLE' THEN 'WORKSPACE' ELSE 'invalid' END,
        task.source_status='HAS_SOURCE' AND library.id IS NOT NULL
            AND youtube.availability_status='AVAILABLE','RC-1 exact title and active Library source'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    JOIN notes note ON note.id=task.source_note_id
    JOIN youtube_videos youtube ON youtube.id=note.youtube_source_id
    LEFT JOIN library_videos library ON library.account_id=a1.account_id
        AND library.youtube_source_id=youtube.id
    WHERE task.title='Ôn lại Controller - Service - Repository'
    UNION ALL SELECT 'reverse_source_preview','SOURCE_PREVIEW',
        CASE WHEN task.source_status='HAS_SOURCE' AND library.id IS NULL
            AND youtube.youtube_video_id='-XsRLyKV9_k'
            AND youtube.availability_status='AVAILABLE' THEN 'SOURCE_PREVIEW' ELSE 'invalid' END,
        task.source_status='HAS_SOURCE' AND library.id IS NULL
            AND youtube.youtube_video_id='-XsRLyKV9_k'
            AND youtube.availability_status='AVAILABLE','RC-2 historical H1 source'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    JOIN notes note ON note.id=task.source_note_id
    JOIN youtube_videos youtube ON youtube.id=note.youtube_source_id
    LEFT JOIN library_videos library ON library.account_id=a1.account_id
        AND library.youtube_source_id=youtube.id
    WHERE task.title='Xem lại cách làm việc nhóm với Git'
    UNION ALL SELECT 'reverse_source_missing','SOURCE_MISSING',source_status,
        source_status='SOURCE_MISSING' AND source_note_id IS NULL,
        'RC-3 preserved Task after source Note lifecycle deletion'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    WHERE task.title='Làm lại ví dụ Dependency Injection'
    UNION ALL SELECT 'reverse_no_source','NO_SOURCE',
        CASE WHEN source_status='INDEPENDENT' AND source_note_id IS NULL THEN 'NO_SOURCE' ELSE 'invalid' END,
        source_status='INDEPENDENT' AND source_note_id IS NULL,
        'RC-4 independent Task'
    FROM tasks task JOIN a1 ON a1.account_id=task.account_id
    WHERE task.title='Chuẩn bị trình bày thi công Life Lab'
    UNION ALL SELECT 'library_removal_fixture','>=2 tags/3 sessions/2 notes/2 tasks',
        tag_count || ' tags/' || session_count || ' sessions/' || note_count || ' notes/' || task_count || ' tasks',
        tag_count>=2 AND session_count>=3 AND note_count>=2 AND task_count>=2,
        'source Geq60OVyBPg is isolated from mandatory Reverse Context fixtures'
    FROM (
        SELECT
            count(DISTINCT relation.tag_id) AS tag_count,
            count(DISTINCT session.id) AS session_count,
            count(DISTINCT note.id) AS note_count,
            count(DISTINCT task.id) AS task_count
        FROM a1
        JOIN library_videos library ON library.account_id=a1.account_id
        JOIN youtube_videos youtube ON youtube.id=library.youtube_source_id
        LEFT JOIN library_video_tags relation ON relation.library_video_id=library.id
        LEFT JOIN watch_sessions session ON session.library_video_id=library.id
        LEFT JOIN notes note ON note.account_id=a1.account_id AND note.youtube_source_id=youtube.id
        LEFT JOIN tasks task ON task.account_id=a1.account_id AND task.source_note_id=note.id
        WHERE youtube.youtube_video_id='Geq60OVyBPg') fixture
    UNION ALL SELECT 'note_deletion_fixture','1 note + 2 linked tasks',
        note_count || ' note/' || task_count || ' tasks',note_count=1 AND task_count=2,
        'one active current Note has two HAS_SOURCE Tasks for normal delete lifecycle testing'
    FROM (
        SELECT count(DISTINCT note.id) AS note_count,count(task.id) AS task_count
        FROM tasks task JOIN a1 ON a1.account_id=task.account_id
        JOIN notes note ON note.id=task.source_note_id
        WHERE task.description LIKE 'Fixture xóa Note:%') fixture)
SELECT check_name,expected,actual,passed,details
FROM checks
ORDER BY check_name;

ROLLBACK;
