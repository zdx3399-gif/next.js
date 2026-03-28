-- Seed 100 rows for testing AI auto-fix suggestions on public.chat_events
-- Safe to rerun: only deletes rows whose source_pk starts with 'ai_fix_demo_'

begin;

delete from public.chat_events
where source_pk like 'ai_fix_demo_%';

with bad_rows as (
  select
    g as seq,
    floor((g - 1) / 12.0)::int + 1 as topic_id
  from generate_series(1, 60) as g
),
good_rows as (
  select
    g as seq,
    floor((g - 61) / 5.0)::int + 1 as topic_id
  from generate_series(61, 85) as g
),
log_rows as (
  select
    g as seq,
    floor((g - 86) / 3.0)::int + 1 as topic_id
  from generate_series(86, 100) as g
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
    format('ai_fix_demo_bad_%03s', b.seq) as source_pk,
    now() - make_interval(hours => (b.seq % 72), mins => (b.seq % 41)) as created_at,
    format('demo_user_bad_%02s', ((b.seq - 1) % 16) + 1) as user_id,
    null::text as event_id,
    case b.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as question,
    case b.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as raw_question,
    case b.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡'
      when 3 then '停車位費用怎麼算'
      when 4 then '社區可以養寵物嗎'
      else '房租多少'
    end as normalized_question,
    case b.topic_id
      when 1 then case b.seq % 6
        when 0 then '報修不用填資料。'
        when 1 then '直接聯絡管理員即可。'
        when 2 then '報修流程不需要照片。'
        when 3 then '系統目前沒有正式報修流程。'
        when 4 then '晚點再試就好，現在先不用提交。'
        else '報修完成後無法查詢進度。'
      end
      when 2 then case b.seq % 6
        when 0 then '查不到包裹資料。'
        when 1 then '系統沒有包裹資訊，請晚點再看。'
        when 2 then '包裹到貨時管理室會再通知。'
        when 3 then '目前無法確認包裹狀態。'
        when 4 then '包裹資訊不會顯示追蹤號碼。'
        else '只有管理員能查包裹。'
      end
      when 3 then case b.seq % 6
        when 0 then '停車位免費。'
        when 1 then '停車費就是管理費的一部分。'
        when 2 then '停車費固定每月 500 元。'
        when 3 then '所有車位計費方式都一樣。'
        when 4 then '訪客停車和住戶停車都不另外收費。'
        else '停車位採抽籤，所以沒有費用。'
      end
      when 4 then case b.seq % 6
        when 0 then '可以，完全沒有限制。'
        when 1 then '不可以，所有寵物都禁止。'
        when 2 then '只要不吵就不用登記。'
        when 3 then '社區沒有寵物管理規則。'
        when 4 then '寵物政策不需要看住戶規約。'
        else '養寵物不需要疫苗或牽繩規定。'
      end
      else case b.seq % 6
        when 0 then '房租固定每月 6000 元。'
        when 1 then '每一戶租金都一樣，不用另外計算。'
        when 2 then '房租只看管理費，不看坪數。'
        when 3 then '房租和車位費一定綁在一起。'
        when 4 then '房租沒有公告條款可查。'
        else '租金不用考慮坪數和附加項目。'
      end
    end as answer,
    case b.topic_id
      when 1 then '維修'
      when 2 then '包裹'
      when 3 then '停車'
      when 4 then '寵物'
      else '租金'
    end as intent,
    case when b.seq % 2 = 0 then 0.34 else 0.58 end::numeric as intent_confidence,
    true as answered,
    false as needs_clarification,
    null::text as clarification_parent_id,
    case when b.seq % 2 = 0 then 'fallback' else 'vector' end as search_method,
    case when b.seq % 2 = 0 then 0.21 else 0.47 end::double precision as similarity,
    case when b.seq % 3 = 0 then 1 else 2 end as match_count,
    480 + (b.seq % 850) as response_ms,
    case b.topic_id
      when 1 then jsonb_build_array(jsonb_build_object('id', 104, 'content', '報修流程', 'similarity', 0.62))
      when 2 then jsonb_build_array(jsonb_build_object('id', 103, 'content', '包裹領取流程', 'similarity', 0.61))
      when 3 then jsonb_build_array(jsonb_build_object('id', 106, 'content', '停車位計價規則', 'similarity', 0.59))
      when 4 then jsonb_build_array(jsonb_build_object('id', 105, 'content', '寵物管理規範', 'similarity', 0.63))
      else jsonb_build_array(jsonb_build_object('id', 101, 'content', '租金按坪數計算條款', 'similarity', 0.64))
    end as sources,
    '[]'::jsonb as images,
    '{"groq": true, "cohere": true}'::jsonb as api_used,
    true as needs_review,
    case b.seq % 3
      when 0 then 'low_rating'
      when 1 then 'fallback'
      else 'low_similarity'
    end as issue_type,
    case
      when b.seq % 5 in (0, 1) then 1
      when b.seq % 5 in (2, 3) then 2
      else 3
    end as priority,
    'pending'::text as review_status,
    null::text as admin_notes,
    case b.seq % 3
      when 0 then 1
      when 1 then 2
      else 3
    end as rating,
    false as is_helpful,
    case b.topic_id
      when 1 then case b.seq % 6
        when 0 then '建議說明報修需要哪些欄位。'
        when 1 then '報修回答不正確，缺少追蹤進度的說明。'
        when 2 then '這題應引導到報修頁，不是口頭處理。'
        when 3 then '報修流程回答錯了，應該要填單與上傳照片。'
        when 4 then '內容太簡略，沒有講到設備名稱和問題描述。'
        else '請補充送出後可以在哪裡查看處理狀態。'
      end
      when 2 then case b.seq % 6
        when 0 then '包裹資訊有流程可查，請修正回答。'
        when 1 then '這題應回覆包裹領取流程，不是直接說無資料。'
        when 2 then '建議提供包裹頁可看的欄位。'
        when 3 then '請加上快遞公司、追蹤號碼和領取時間。'
        when 4 then '內容太少，沒有講到去哪一頁查詢。'
        else '包裹查詢回答錯了，應提示到包裹頁看追蹤資訊。'
      end
      when 3 then case b.seq % 6
        when 0 then '停車費用回答錯誤，停車位不是免費。'
        when 1 then '不能把停車費和管理費混在一起，請修正。'
        when 2 then '請補充停車方案與計費差異。'
        when 3 then '停車費說明不完整，請加上類型條件。'
        when 4 then '建議說明停車位費用與管理費分開計算。'
        else '這題停車計價方式回答不正確。'
      end
      when 4 then case b.seq % 6
        when 0 then '不能直接說完全可以或完全不行，請改成依規約判斷。'
        when 1 then '請補充寵物登記與管理相關條件。'
        when 2 then '寵物政策有條件限制，請修正回答內容。'
        when 3 then '建議說明寵物是否需依住戶決議調整。'
        when 4 then '這題需提到牽繩、疫苗和清理排泄物要求。'
        else '缺少違規飼養後續處理方式。'
      end
      else case b.seq % 6
        when 0 then '租金資訊不正確，應該是依坪數計算，不是固定金額。'
        when 1 then '房租要看坪數與車位費，請更正。'
        when 2 then '請補充房租計算公式與影響條件。'
        when 3 then '社區房租不是每戶都一樣，請改成坪數計算規則。'
        when 4 then '房租計算方式說錯了，應該依公告條款處理。'
        else '內容過於模糊，沒有說明租金與附加項目的關係。'
      end
    end as feedback,
    0 as success_count,
    case when b.seq % 4 = 0 then 1 else 0 end as unclear_count,
    1 as fail_count,
    '[]'::jsonb as feedback_events
  from bad_rows b

  union all

  select
    'chat_history'::text as source,
    format('ai_fix_demo_good_%03s', g.seq) as source_pk,
    now() - interval '14 days' - make_interval(days => (g.seq % 6), mins => (g.seq % 37)) as created_at,
    format('demo_user_good_%02s', ((g.seq - 61) % 10) + 1) as user_id,
    null::text as event_id,
    case g.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as question,
    case g.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as raw_question,
    case g.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡'
      when 3 then '停車位費用怎麼算'
      when 4 then '社區可以養寵物嗎'
      else '房租多少'
    end as normalized_question,
    case g.topic_id
      when 1 then '請在報修頁填寫設備名稱、問題描述並上傳照片，送出後可在「我的維修申請」查看進度。'
      when 2 then '可到「訪客／包裹」頁查看快遞公司、追蹤號碼、領取時間與領取狀態。'
      when 3 then '停車位費用依車位類型與租用方案計算，與管理費分開收費，實際金額請以社區公告為準。'
      when 4 then '是否可養寵物需依社區規約與住戶決議，且須完成登記、施打疫苗、使用牽繩並清理排泄物。'
      else '房租不是固定金額，通常會依坪數、附加項目與車位費調整，請以租約或公告條款為準。'
    end as answer,
    case g.topic_id
      when 1 then '維修'
      when 2 then '包裹'
      when 3 then '停車'
      when 4 then '寵物'
      else '租金'
    end as intent,
    0.93::numeric as intent_confidence,
    true as answered,
    false as needs_clarification,
    null::text as clarification_parent_id,
    'vector'::text as search_method,
    0.88::double precision as similarity,
    8 as match_count,
    540 + (g.seq % 240) as response_ms,
    case g.topic_id
      when 1 then jsonb_build_array(jsonb_build_object('id', 104, 'content', '報修流程', 'similarity', 0.89))
      when 2 then jsonb_build_array(jsonb_build_object('id', 103, 'content', '包裹領取流程', 'similarity', 0.90))
      when 3 then jsonb_build_array(jsonb_build_object('id', 106, 'content', '停車位計價規則', 'similarity', 0.88))
      when 4 then jsonb_build_array(jsonb_build_object('id', 105, 'content', '寵物管理規範', 'similarity', 0.91))
      else jsonb_build_array(jsonb_build_object('id', 101, 'content', '租金按坪數計算條款', 'similarity', 0.89))
    end as sources,
    '[]'::jsonb as images,
    '{"groq": true, "cohere": true}'::jsonb as api_used,
    false as needs_review,
    null::text as issue_type,
    5 as priority,
    null::text as review_status,
    null::text as admin_notes,
    case when g.seq % 2 = 0 then 5 else 4 end as rating,
    true as is_helpful,
    case g.topic_id
      when 1 then '答案完整，報修欄位與進度都有說清楚。'
      when 2 then '有講到包裹頁、追蹤號碼和領取狀態，很清楚。'
      when 3 then '有把停車費與管理費分開說明，資訊正確。'
      when 4 then '有補充寵物規約與管理條件，回答完整。'
      else '租金不是固定金額這點有講清楚，符合預期。'
    end as feedback,
    1 as success_count,
    0 as unclear_count,
    0 as fail_count,
    '[]'::jsonb as feedback_events
  from good_rows g

  union all

  select
    'chat_log'::text as source,
    format('ai_fix_demo_log_%03s', l.seq) as source_pk,
    now() - make_interval(hours => (l.seq % 16), mins => (l.seq % 29)) as created_at,
    format('demo_line_user_%02s', ((l.seq - 86) % 8) + 1) as user_id,
    format('evt_ai_fix_%03s', l.seq) as event_id,
    case l.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as question,
    case l.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡？'
      when 3 then '停車位費用怎麼算？'
      when 4 then '社區可以養寵物嗎？'
      else '房租多少？'
    end as raw_question,
    case l.topic_id
      when 1 then '我要報修'
      when 2 then '我的包裹在哪裡'
      when 3 then '停車位費用怎麼算'
      when 4 then '社區可以養寵物嗎'
      else '房租多少'
    end as normalized_question,
    null::text as answer,
    case l.topic_id
      when 1 then '維修'
      when 2 then '包裹'
      when 3 then '停車'
      when 4 then '寵物'
      else '租金'
    end as intent,
    case
      when l.topic_id = 3 then 0.57::numeric
      when l.topic_id in (2, 5) then 0.26::numeric
      else 0.34::numeric
    end as intent_confidence,
    case when l.seq % 2 = 0 then true else false end as answered,
    case when l.seq % 4 = 0 then true else false end as needs_clarification,
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
  from log_rows l
) as payload;

commit;
