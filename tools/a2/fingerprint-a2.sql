WITH personal_rows AS (
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END scope,
  concat_ws('|','ACCOUNT',lower(a.email),a.password_hash,a.display_name,a.created_at,a.updated_at) value
 FROM accounts a
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','LIB',lower(a.email),y.youtube_video_id,coalesce(l.custom_title,'<NULL>'),coalesce(l.personal_description,'<NULL>'),l.added_at,l.updated_at)
 FROM library_videos l JOIN accounts a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','TAG',lower(a.email),t.name,t.normalized_name,t.created_at,t.updated_at)
 FROM tags t JOIN accounts a ON a.id=t.account_id
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','TAGLINK',lower(a.email),y.youtube_video_id,t.normalized_name)
 FROM library_video_tags x JOIN library_videos l ON l.id=x.library_video_id JOIN accounts a ON a.id=l.account_id
 JOIN youtube_videos y ON y.id=l.youtube_source_id JOIN tags t ON t.id=x.tag_id
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','WATCH',lower(a.email),y.youtube_video_id,w.started_at,coalesce(w.ended_at::text,'<NULL>'),w.last_heartbeat_at,w.watch_time_seconds,w.validity_status)
 FROM watch_sessions w JOIN library_videos l ON l.id=w.library_video_id JOIN accounts a ON a.id=l.account_id JOIN youtube_videos y ON y.id=l.youtube_source_id
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','NOTE',lower(a.email),y.youtube_video_id,replace(replace(n.content,E'\n',' '),E'\r',' '),coalesce(n.timestamp_seconds::text,'<NULL>'),n.created_at,n.updated_at)
 FROM notes n JOIN accounts a ON a.id=n.account_id JOIN youtube_videos y ON y.id=n.youtube_source_id
 UNION ALL
 SELECT CASE lower(a.email) WHEN 'scale@lifelab.local' THEN 'A2' WHEN 'demo@lifelab.local' THEN 'A1' ELSE 'UNRELATED' END,
  concat_ws('|','TASK',lower(a.email),t.source_status,coalesce(sy.youtube_video_id,'<NULL>'),
   coalesce(replace(replace(sn.content,E'\n',' '),E'\r',' '),'<NULL>'),replace(replace(t.title,E'\n',' '),E'\r',' '),
   coalesce(replace(replace(t.description,E'\n',' '),E'\r',' '),'<NULL>'),t.status,coalesce(t.deadline::text,'<NULL>'),t.created_at,t.updated_at)
 FROM tasks t JOIN accounts a ON a.id=t.account_id LEFT JOIN notes sn ON sn.id=t.source_note_id LEFT JOIN youtube_videos sy ON sy.id=sn.youtube_source_id
), global_rows AS (
 SELECT 'GLOBAL' scope,concat_ws('|','SOURCE',y.youtube_video_id,y.source_url,coalesce(y.title,'<NULL>'),coalesce(y.channel_name,'<NULL>'),
  coalesce(y.thumbnail_url,'<NULL>'),coalesce(y.duration_seconds::text,'<NULL>'),coalesce(y.published_at::text,'<NULL>'),y.availability_status) value
 FROM youtube_videos y WHERE EXISTS(
  SELECT 1 FROM library_videos l JOIN accounts a ON a.id=l.account_id WHERE l.youtube_source_id=y.id AND lower(a.email)<>'scale@lifelab.local'
  UNION ALL
  SELECT 1 FROM notes n JOIN accounts a ON a.id=n.account_id WHERE n.youtube_source_id=y.id AND lower(a.email)<>'scale@lifelab.local')
)
SELECT scope,value FROM (SELECT * FROM personal_rows UNION ALL SELECT * FROM global_rows)x ORDER BY scope,value;
