begin;

comment on table public.chat_feedback is
'LEGACY TABLE: feedback 已逐步整併進 public.chat_events.feedback_events。保留此表僅供舊資料回查與遷移驗證，確認所有執行路徑已停止直接讀寫後再考慮 drop。';

comment on column public.chat_feedback.chat_log_id is
'LEGACY REFERENCE: 對應舊 chat_log 主鍵。新流程請改以 public.chat_events.id 與 feedback_events 追蹤。';

comment on column public.chat_feedback.feedback_type is
'LEGACY FIELD: 新流程改存於 public.chat_events.feedback 及 public.chat_events.feedback_events[].feedback_type。';

comment on column public.chat_feedback.clarification_choice is
'LEGACY FIELD: 新流程改存於 public.chat_events.feedback_events[].clarification_choice。';

comment on column public.chat_feedback.comment is
'LEGACY FIELD: 新流程改存於 public.chat_events.feedback_events[].comment。';

commit;
