-- Curated, source-grounded Video examples layered over the durable VTT extract.
-- The original source IDs, cue starts and timestamps remain unchanged.
CREATE TEMP TABLE a2_curated_video_metadata (
    fixture_key TEXT PRIMARY KEY,
    custom_title TEXT NOT NULL,
    personal_description TEXT NOT NULL
);
INSERT INTO a2_curated_video_metadata VALUES
    ('A2_LIB_001','Java: biến và kiểu int','Ôn ví dụ khai báo biến trước buổi thực hành Java.'),
    ('A2_LIB_002','Đối chiếu kiểu dữ liệu Java','So sánh kiểu số nguyên và số thực qua ví dụ nhỏ.'),
    ('A2_LIB_003','Thử lại vòng lặp Java','Chạy lại ví dụ do-while và kiểm tra số lần thực thi.'),
    ('A2_LIB_006','Class và Object qua ví dụ sinh viên','Vẽ lại thuộc tính và hành vi trong ví dụ class Student.'),
    ('A2_LIB_031','Bellman-Ford: đỉnh và trọng số','Vẽ cạnh có đỉnh đầu, đỉnh cuối và trọng số trước khi ôn đường đi ngắn nhất.'),
    ('A2_LIB_048','useEffect: thử lại ví dụ lấy dữ liệu','Ghi lại thời điểm effect chạy trong một component nhỏ.');

CREATE TEMP TABLE a2_curated_video_note (
    fixture_key TEXT NOT NULL,
    note_no INTEGER NOT NULL,
    note_content TEXT NOT NULL,
    task_title TEXT NOT NULL,
    task_description TEXT NOT NULL,
    category_name TEXT,
    tag_names TEXT[] NOT NULL,
    PRIMARY KEY (fixture_key,note_no)
);
-- 001: local vi-orig VTT at 03:09 (int) and 06:09 (variable-name error).
-- 002: local vi-orig VTT at 04:23 (integer versus real-number types).
-- 003: local vi-orig VTT at 06:06 (body executes at least once).
-- 006: local vi-orig VTT at 02:01 (student class and behavior example).
-- 031: local vi-orig VTT at 13:47 (start vertex, end vertex, edge weight).
-- 048: source title and local VTT mention data fetching; use an untimestamped
--       study intention because the available cue is semantically unreliable.
INSERT INTO a2_curated_video_note VALUES
    ('A2_LIB_001',1,
     'Ví dụ biến int có kiểu dữ liệu, tên biến và giá trị khởi tạo; mình cần tự chạy lại khai báo này.',
     'Chạy lại ví dụ khai báo biến int',
     'Khai báo một biến int, gán giá trị ban đầu và in kết quả để kiểm tra.',
     'Software Engineering',ARRAY['Java']),
    ('A2_LIB_001',2,
     'Đặt tên biến không hợp lệ gây lỗi; cần ghi lại quy tắc đặt tên qua ví dụ trong bài.',
     'Kiểm tra hai cách đặt tên biến Java',
     'Thử một tên hợp lệ và một tên không hợp lệ, rồi ghi lại lỗi biên dịch.',
     NULL,ARRAY['Java']),
    ('A2_LIB_002',1,
     'Đối chiếu kiểu số nguyên và số thực trước khi chọn kiểu dữ liệu Java cho một biến.',
     'So sánh kiểu số nguyên và số thực',
     'Viết hai khai báo biến nhỏ và ghi lại khi nào cần phần thập phân.',
     'Software Engineering',ARRAY['Java']),
    ('A2_LIB_003',2,
     'Trong ví dụ do-while, phần thân chạy ít nhất một lần rồi mới xét điều kiện lặp.',
     'Thử do-while với điều kiện sai ban đầu',
     'Chạy ví dụ với điều kiện sai từ đầu và kiểm tra số lần phần thân thực thi.',
     'Software Engineering',ARRAY['Java']),
    ('A2_LIB_006',1,
     'Ví dụ class sinh viên tách tên lớp và các hành vi; cần phân biệt class với object cụ thể.',
     'Vẽ class Student và tạo một object',
     'Ghi thuộc tính, hành vi của class Student rồi khởi tạo một object để phân biệt hai khái niệm.',
     'Software Engineering',ARRAY['Java','OOP']),
    ('A2_LIB_031',2,
     'Cạnh trong ví dụ Bellman-Ford có đỉnh đầu, đỉnh cuối và trọng số; cần vẽ lại trước khi theo dõi cập nhật khoảng cách.',
     'Vẽ một cạnh có trọng số cho bài Bellman-Ford',
     'Đánh dấu đỉnh đầu, đỉnh cuối và trọng số trên một đồ thị nhỏ.',
     'Algorithms',ARRAY['DSA','Graph']),
    ('A2_LIB_048',2,
     'Cần chạy lại ví dụ useEffect lấy dữ liệu để quan sát thời điểm effect gọi API.',
     'Thử một effect gọi API trong component nhỏ',
     'Ghi lại số lần effect chạy khi component render lại.',
     'Software Engineering',ARRAY['React','React Hooks']);
