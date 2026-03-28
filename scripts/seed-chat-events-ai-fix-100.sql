-- Seed 100 rows for AI auto-fix testing on public.chat_events.
-- Safe to rerun: it only deletes rows whose source_pk starts with 'ai_fix_demo_'.

begin;

delete from public.chat_events
where source_pk like 'ai_fix_demo_%';

with topic_templates as (
  select *
  from (
    values
      (
        1,
        '我要報修',
        '我要報修',
        '我要報修',
        '維修',
        '報修不用填資料。',
        '請在報修頁填寫設備名稱、問題描述並上傳照片，送出後可在「我的維修申請」追蹤進度。',
        104,
        '維修 / 客服流程',
        'fallback'
      ),
      (
        2,
        '我的包裹在哪裡？',
        '我的包裹在哪裡？',
        '我的包裹在哪裡',
        '包裹',
        '系統沒有包裹資訊，請晚點再看。',
        '請到「訪客 / 包裹」查看快遞公司、追蹤號碼、到件時間與領取狀態，依頁面資訊領取即可。',
        103,
        '包裹查詢與領取流程',
        'low_similarity'
      ),
      (
        3,
        '停車位費用怎麼算？',
        '停車位費用怎麼算？',
        '停車位費用怎麼算',
        '停車',
        '停車位免費。',
        '停車位費用需依車位類型與租用方案計算，並與管理費分開，不是免費也不是和管理費一起算。',
        109,
        '停車位收費說明',
        'low_rating'
      ),
      (
        4,
        '社區可以養寵物嗎？',
        '社區可以養寵物嗎？',
        '社區可以養寵物嗎',
        '寵物',
        '可以，完全沒有限制。',
        '是否可養寵物要依社區規約與住戶決議，通常需登記、定期施打疫苗，並遵守牽繩與清潔規範。',
        105,
        '寵物管理規範',
        'low_rating'
      ),
      (
        5,
        '房租多少？',
        '房租多少？',
        '房租多少',
        '房租',
        '房租固定每月 6000 元。',
        '房租需依坪數、樓層條件與車位費等附加項目計算，並依公告條款或租約內容為準，不是固定金額。',
        101,
        '租金與公告條款',
        'fallback'
      )
  ) as t(topic_id, question, raw_question, normalized_question, intent, bad_answer, good_answer, source_id, source_content, issue_type)
),
bad_variants as (
  select *
  from (
    values
      (1, '回答錯誤，這題不是這樣處理。'),
      (2, '缺少流程說明，沒有告訴住戶該怎麼操作。'),
      (3, '缺少必要欄位，沒有說要填哪些資訊。'),
      (4, '沒有說明要去哪個頁面或哪裡查看。'),
      (5, '缺少時間資訊，沒有提到何時可以處理或查看。'),
      (6, '沒有補充例外情況或特殊情境。'),
      (7, '內容太模糊，看不懂重點。'),
      (8, '把不同概念混在一起，請分開說明。'),
      (9, '缺少條件限制，應該依規約或公告判斷。'),
      (10, '沒有說明頁面欄位與追蹤方式。'),
      (11, '說明太少，請補上具體步驟與條件。'),
      (12, '這題需要更完整的修正答案與判斷依據。')
  ) as v(variant_no, generic_feedback)
),
good_rows as (
  select
    series_no,
    ((series_no - 61) / 5) + 1 as topic_id
  from generate_series(61, 85) as series_no
),
log_rows as (
  select
    series_no,
    ((series_no - 86) / 3) + 1 as topic_id
  from generate_series(86, 100) as series_no
)
insert into public.chat_events (
  source,
  source_pk,
  created_at,
  user_id,
  event_id,
  question,
  raw_question,
  normalized_question,
  answer,
  intent,
  intent_confidence,
  answered,
  needs_clarification,
  clarification_parent_id,
  search_method,
  similarity,
  match_count,
  response_ms,
  sources,
  images,
  api_used,
  needs_review,
  issue_type,
  priority,
  review_status,
  admin_notes,
  rating,
  is_helpful,
  feedback,
  success_count,
  unclear_count,
  fail_count,
  feedback_events
)
select
  payload.source,
  payload.source_pk,
  payload.created_at,
  payload.user_id,
  payload.event_id,
  payload.question,
  payload.raw_question,
  payload.normalized_question,
  payload.answer,
  payload.intent,
  payload.intent_confidence,
  payload.answered,
  payload.needs_clarification,
  payload.clarification_parent_id,
  payload.search_method,
  payload.similarity,
  payload.match_count,
  payload.response_ms,
  payload.sources,
  payload.images,
  payload.api_used,
  payload.needs_review,
  payload.issue_type,
  payload.priority,
  payload.review_status,
  payload.admin_notes,
  payload.rating,
  payload.is_helpful,
  payload.feedback,
  payload.success_count,
  payload.unclear_count,
  payload.fail_count,
  payload.feedback_events
from (
  select
    'chat_history'::text as source,
    format('ai_fix_demo_bad_%03s', ((topic.topic_id - 1) * 12) + variant.variant_no) as source_pk,
    now() - make_interval(hours => ((topic.topic_id - 1) * 12) + variant.variant_no, mins => variant.variant_no * 3) as created_at,
    format('demo_user_bad_%02s', ((topic.topic_id - 1) * 4) + ((variant.variant_no - 1) % 4) + 1) as user_id,
    null::text as event_id,
    topic.question,
    topic.raw_question,
    topic.normalized_question,
    case topic.topic_id
      when 1 then case variant.variant_no
        when 1 then '報修不用填資料。'
        when 2 then '直接找管理員就好。'
        when 3 then '不用上傳照片。'
        when 4 then '我不知道去哪裡報修。'
        when 5 then '報修送出後不會顯示進度。'
        when 6 then '假日也一定會立即處理。'
        when 7 then '報修大概就是通知一下。'
        when 8 then '把客服與報修當成同一件事。'
        when 9 then '沒提到社區是否需要照規則申請。'
        when 10 then '沒有告訴住戶在哪裡查看報修單。'
        when 11 then '只說可以報修，但沒有步驟。'
        else '回答太簡單，沒有說明正式流程。'
      end
      when 2 then case variant.variant_no
        when 1 then '系統沒有包裹資訊，請晚點再看。'
        when 2 then '沒有說明包裹怎麼查。'
        when 3 then '沒提到會看到哪些欄位。'
        when 4 then '沒告訴住戶要去哪一頁。'
        when 5 then '沒有說包裹到件時間或領取時間。'
        when 6 then '沒提到若沒有追蹤號碼怎麼辦。'
        when 7 then '包裹說明很模糊。'
        when 8 then '把包裹查詢和訪客管理混在一起。'
        when 9 then '沒提到社區包裹流程限制。'
        when 10 then '沒有說明包裹頁能看哪些追蹤資訊。'
        when 11 then '缺少領取步驟。'
        else '這個答案沒有真正回答包裹在哪裡。'
      end
      when 3 then case variant.variant_no
        when 1 then '停車位免費。'
        when 2 then '沒有說費用怎麼算。'
        when 3 then '缺少車位類型與方案條件。'
        when 4 then '沒有說明要去哪裡查費用。'
        when 5 then '沒提到何時收費或重新抽籤時間。'
        when 6 then '沒有補充訪客或特殊車位的例外。'
        when 7 then '停車費說明太籠統。'
        when 8 then '把停車費和管理費混在一起。'
        when 9 then '沒說明依社區規則或抽籤制度。'
        when 10 then '沒有提供方案差異。'
        when 11 then '沒有說費用與管理費分開。'
        else '這題停車計價方式回答不正確。'
      end
      when 4 then case variant.variant_no
        when 1 then '可以，完全沒有限制。'
        when 2 then '沒有說明是否要依規約判斷。'
        when 3 then '缺少寵物登記與疫苗條件。'
        when 4 then '沒有說明要到哪裡辦理登記。'
        when 5 then '沒提到規定何時生效或何時調整。'
        when 6 then '沒有說如果是特殊寵物怎麼處理。'
        when 7 then '內容太模糊，只說可以或不行。'
        when 8 then '把大樓個案和社區通則混在一起。'
        when 9 then '缺少規約與住戶決議條件。'
        when 10 then '沒有說明違規會怎樣。'
        when 11 then '缺少遛狗與清潔規範。'
        else '這題要補充寵物管理條款。'
      end
      else case variant.variant_no
        when 1 then '房租固定每月 6000 元。'
        when 2 then '沒有說明房租如何計算。'
        when 3 then '缺少坪數與附加項目公式。'
        when 4 then '沒有說明要看公告或租約哪裡。'
        when 5 then '沒提到何時調整租金或計費時間。'
        when 6 then '沒有說明如果沒有車位時怎麼算。'
        when 7 then '房租說明太模糊。'
        when 8 then '把房租和管理費混在一起。'
        when 9 then '沒有說明需依公告條款處理。'
        when 10 then '缺少車位費是否另外計算。'
        when 11 then '沒有說明樓層或坪數差異。'
        else '這題租金資訊不正確，不是固定金額。'
      end
    end as answer,
    topic.intent,
    case when topic.topic_id in (2, 4) then 0.34 else 0.56 end::numeric as intent_confidence,
    true as answered,
    false as needs_clarification,
    null::text as clarification_parent_id,
    case when variant.variant_no % 2 = 0 then 'fallback' else 'vector' end as search_method,
    case when variant.variant_no % 2 = 0 then 0.24 else 0.46 end::double precision as similarity,
    case when variant.variant_no % 3 = 0 then 1 else 2 end as match_count,
    420 + (variant.variant_no * 35) + (topic.topic_id * 12) as response_ms,
    jsonb_build_array(jsonb_build_object('id', topic.source_id, 'content', topic.source_content, 'similarity', 0.66)) as sources,
    '[]'::jsonb as images,
    '{"groq": true, "cohere": true}'::jsonb as api_used,
    true as needs_review,
    topic.issue_type,
    case
      when variant.variant_no in (1, 2, 8) then 1
      when variant.variant_no in (3, 4, 9, 10) then 2
      else 3
    end as priority,
    'pending'::text as review_status,
    null::text as admin_notes,
    case
      when variant.variant_no in (1, 8, 12) then 1
      when variant.variant_no in (2, 3, 4, 5) then 2
      else 3
    end as rating,
    false as is_helpful,
    case topic.topic_id
      when 1 then case variant.variant_no
        when 1 then '回答錯誤，報修不是直接找管理員就好。'
        when 2 then '缺少流程說明，沒有交代住戶要到報修頁操作。'
        when 3 then '缺少必要欄位，應該說明設備名稱、問題描述與照片。'
        when 4 then '沒有說明住戶要去哪一頁送出報修。'
        when 5 then '缺少時間資訊，沒有提到可在我的維修申請追蹤進度。'
        when 6 then '沒有補充假日或特殊狀況可能依管理單位安排。'
        when 7 then '內容太模糊，看不懂到底要怎麼報修。'
        when 8 then '把客服聯絡和正式報修流程混在一起。'
        when 9 then '缺少條件限制，應該依社區維修規範與管委會流程。'
        when 10 then '沒有說明報修頁可以看哪些欄位與狀態。'
        when 11 then '說明太少，請補上送出後如何追蹤。'
        else '這題需要更完整的修正答案與判斷依據。'
      end
      when 2 then case variant.variant_no
        when 1 then '回答錯誤，不應直接說查不到包裹。'
        when 2 then '缺少流程說明，沒有引導到訪客 / 包裹頁。'
        when 3 then '缺少必要欄位，應補充快遞公司、追蹤號碼與領取狀態。'
        when 4 then '沒有說明住戶要去哪個頁面查看包裹。'
        when 5 then '缺少時間資訊，應補充到件與領取時間。'
        when 6 then '沒有補充若資料尚未同步時該怎麼辦。'
        when 7 then '內容太模糊，看不懂包裹到底在哪裡。'
        when 8 then '把包裹查詢和訪客紀錄混在一起。'
        when 9 then '缺少條件限制，應依社區包裹領取流程說明。'
        when 10 then '沒有說明包裹頁能看的追蹤資訊。'
        when 11 then '說明太少，請補上領取步驟。'
        else '這題需要更完整的修正答案與判斷依據。'
      end
      when 3 then case variant.variant_no
        when 1 then '回答錯誤，停車位不是免費。'
        when 2 then '缺少流程說明，沒有說明停車費用怎麼查。'
        when 3 then '缺少必要欄位，應補充車位類型與租用方案。'
        when 4 then '沒有說明住戶要去哪裡查看或申請車位。'
        when 5 then '缺少時間資訊，沒有提到抽籤或計費時點。'
        when 6 then '沒有補充訪客車位或特殊方案的例外。'
        when 7 then '內容太模糊，看不懂停車費怎麼算。'
        when 8 then '把停車費和管理費混在一起，請分開計算。'
        when 9 then '缺少條件限制，應說明依抽籤與社區規則安排。'
        when 10 then '沒有說明不同停車方案的計費差異。'
        when 11 then '說明太少，請補上費用與管理費分開。'
        else '這題需要更完整的修正答案與判斷依據。'
      end
      when 4 then case variant.variant_no
        when 1 then '回答錯誤，不能直接說完全可以。'
        when 2 then '缺少流程說明，沒有引導住戶依規約確認。'
        when 3 then '缺少必要欄位，應補充寵物登記與疫苗條件。'
        when 4 then '沒有說明登記或查詢要到哪裡辦理。'
        when 5 then '缺少時間資訊，沒有提到規範何時調整。'
        when 6 then '沒有補充特殊寵物或例外情況。'
        when 7 then '內容太模糊，只說可以或不行。'
        when 8 then '把個別大樓規定與本社區規約混在一起。'
        when 9 then '缺少條件限制，應說明依規約與住戶決議判斷。'
        when 10 then '沒有說明違規飼養的後續處理。'
        when 11 then '說明太少，請補上牽繩與清潔規範。'
        else '這題需要更完整的修正答案與判斷依據。'
      end
      else case variant.variant_no
        when 1 then '回答錯誤，房租不是固定金額。'
        when 2 then '缺少流程說明，沒有引導住戶查看公告或租約。'
        when 3 then '缺少必要欄位，應補充坪數、樓層與車位費。'
        when 4 then '沒有說明住戶要去哪裡看租金條款。'
        when 5 then '缺少時間資訊，沒有說明租金調整或計費時點。'
        when 6 then '沒有補充沒有車位時的例外計算方式。'
        when 7 then '內容太模糊，看不懂房租怎麼算。'
        when 8 then '把房租和管理費混在一起，請分開說明。'
        when 9 then '缺少條件限制，應說明依公告條款或租約計算。'
        when 10 then '沒有說明車位費是否另計。'
        when 11 then '說明太少，請補上坪數與樓層差異。'
        else '這題需要更完整的修正答案與判斷依據。'
      end
    end as feedback,
    0 as success_count,
    case when variant.variant_no in (5, 6, 7) then 1 else 0 end as unclear_count,
    1 as fail_count,
    '[]'::jsonb as feedback_events
  from topic_templates topic
  cross join bad_variants variant

  union all

  select
    'chat_history'::text as source,
    format('ai_fix_demo_good_%03s', good.series_no) as source_pk,
    now() - interval '14 days' - make_interval(days => (good.series_no % 5), mins => (good.series_no % 31)) as created_at,
    format('demo_user_good_%02s', ((good.series_no - 61) % 10) + 1) as user_id,
    null::text as event_id,
    topic.question,
    topic.raw_question,
    topic.normalized_question,
    topic.good_answer,
    topic.intent,
    0.93::numeric as intent_confidence,
    true as answered,
    false as needs_clarification,
    null::text as clarification_parent_id,
    'vector'::text as search_method,
    0.89::double precision as similarity,
    8 as match_count,
    520 + (good.series_no % 180) as response_ms,
    jsonb_build_array(jsonb_build_object('id', topic.source_id, 'content', topic.source_content, 'similarity', 0.89)) as sources,
    '[]'::jsonb as images,
    '{"groq": true, "cohere": true}'::jsonb as api_used,
    false as needs_review,
    null::text as issue_type,
    5 as priority,
    null::text as review_status,
    null::text as admin_notes,
    case when good.series_no % 2 = 0 then 5 else 4 end as rating,
    true as is_helpful,
    case topic.topic_id
      when 1 then '新版報修答案有交代欄位與追蹤方式，清楚很多。'
      when 2 then '新版包裹答案有說明頁面欄位與領取流程。'
      when 3 then '新版停車答案有把管理費與停車費分開說明。'
      when 4 then '新版寵物答案有提到規約、登記與管理條件。'
      else '新版房租答案有說明坪數、樓層與車位費差異。'
    end as feedback,
    1 as success_count,
    0 as unclear_count,
    0 as fail_count,
    '[]'::jsonb as feedback_events
  from good_rows good
  join topic_templates topic on topic.topic_id = good.topic_id

  union all

  select
    'chat_log'::text as source,
    format('ai_fix_demo_log_%03s', log_row.series_no) as source_pk,
    now() - make_interval(hours => (log_row.series_no % 16), mins => (log_row.series_no % 29)) as created_at,
    format('demo_line_user_%02s', ((log_row.series_no - 86) % 8) + 1) as user_id,
    format('evt_ai_fix_%03s', log_row.series_no) as event_id,
    topic.question,
    topic.raw_question,
    topic.normalized_question,
    null::text as answer,
    topic.intent,
    case when topic.topic_id in (2, 4) then 0.34 else 0.57 end::numeric as intent_confidence,
    case when log_row.series_no % 2 = 0 then true else false end as answered,
    case when log_row.series_no % 4 = 0 then true else false end as needs_clarification,
    null::text as clarification_parent_id,
    null::text as search_method,
    null::double precision as similarity,
    null::int as match_count,
    null::int as response_ms,
    null::jsonb as sources,
    null::jsonb as images,
    null::jsonb as api_used,
    false as needs_review,
    null::text as issue_type,
    null::int as priority,
    null::text as review_status,
    null::text as admin_notes,
    null::int as rating,
    null::boolean as is_helpful,
    null::text as feedback,
    0 as success_count,
    0 as unclear_count,
    0 as fail_count,
    '[]'::jsonb as feedback_events
  from log_rows log_row
  join topic_templates topic on topic.topic_id = log_row.topic_id
) as payload;

commit;
