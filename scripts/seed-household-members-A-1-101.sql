-- 診斷：確認 packages 裡 unit_id 對應的住戶資料
-- member_count = 0 代表 household_members 無該 unit 資料 → 下拉選單會空
SELECT
  p.id           AS package_id,
  p.unit_id,
  u.unit_code,
  p.status,
  COUNT(hm.id)   AS member_count,
  STRING_AGG(
    hm.name || ' (' || COALESCE(hm.relationship, '?') || ')',
    ', '
    ORDER BY hm.created_at
  )              AS members
FROM packages p
LEFT JOIN units u ON u.id = p.unit_id
LEFT JOIN household_members hm ON hm.unit_id = p.unit_id
WHERE p.status = 'pending'
GROUP BY p.id, p.unit_id, u.unit_code, p.status
ORDER BY p.arrived_at DESC
LIMIT 30;


