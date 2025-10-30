-- SQL script to create database schema for Tenant A (社區 A)
-- This script creates all necessary tables for the community management system

-- Updated profiles table to match exact schema with unit field
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('resident', 'committee', 'vendor')) DEFAULT 'resident',
  phone TEXT,
  room TEXT,
  unit TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated announcements table with all fields from schema
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  author TEXT NOT NULL,
  reads JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'published',
  created_by UUID REFERENCES profiles(id),
  image_url TEXT
);

-- Added emergencies table
CREATE TABLE IF NOT EXISTS emergencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  note TEXT DEFAULT '',
  by TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Added events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated fees table to match exact schema
CREATE TABLE IF NOT EXISTS fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due DATE NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMP WITH TIME ZONE,
  invoice TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Added knowledge table
CREATE TABLE IF NOT EXISTS knowledge (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL
);

-- Updated maintenance table with all fields
CREATE TABLE IF NOT EXISTS maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment TEXT NOT NULL,
  item TEXT NOT NULL,
  time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  handler TEXT DEFAULT '',
  cost NUMERIC DEFAULT 0,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'progress', 'closed')),
  assignee TEXT DEFAULT '',
  logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  description TEXT,
  image_url TEXT,
  created_by UUID,
  photo_url TEXT,
  reported_by TEXT
);

-- Updated meetings table with minutes_url
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  time TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT NOT NULL,
  notes TEXT DEFAULT '',
  minutes_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Added messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Updated packages table to match exact schema
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_name TEXT NOT NULL,
  recipient_room TEXT NOT NULL,
  courier TEXT NOT NULL,
  tracking_number TEXT,
  arrived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  picked_up_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated residents table to match exact schema
CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  role TEXT DEFAULT 'resident' CHECK (role IN ('resident', 'committee', 'vendor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated visitors table with correct column names
CREATE TABLE IF NOT EXISTS visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  "in" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "out" TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated vote_records table to match exact schema
CREATE TABLE IF NOT EXISTS vote_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id UUID NOT NULL REFERENCES votes(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  user_name TEXT NOT NULL,
  option_selected TEXT NOT NULL,
  voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated votes table with all fields
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  options JSONB NOT NULL DEFAULT '["同意", "反對", "棄權"]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  ends_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  author TEXT NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_votes_status ON votes(status);
CREATE INDEX IF NOT EXISTS idx_votes_created_by ON votes(created_by);
CREATE INDEX IF NOT EXISTS idx_vote_records_vote_id ON vote_records(vote_id);
CREATE INDEX IF NOT EXISTS idx_vote_records_user_id ON vote_records(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status);
CREATE INDEX IF NOT EXISTS idx_packages_room ON packages(recipient_room);
CREATE INDEX IF NOT EXISTS idx_visitors_room ON visitors(room);

-- Insert sample data for Tenant A
INSERT INTO profiles (email, password, name, phone, room, unit, role, status)
VALUES 
  ('admin@tenant-a.com', 'admin123', '王大明', '0912345678', 'A-101', '1F', 'committee', 'active'),
  ('resident1@tenant-a.com', 'password123', '李小華', '0923456789', 'A-102', '1F', 'resident', 'active'),
  ('resident2@tenant-a.com', 'password123', '張美玲', '0934567890', 'A-201', '2F', 'resident', 'active'),
  ('resident3@tenant-a.com', 'password123', '陳志明', '0945678901', 'A-202', '2F', 'resident', 'active'),
  ('vendor@tenant-a.com', 'vendor123', '林師傅', '0956789012', '', '', 'vendor', 'active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO announcements (title, content, author, status, created_by, image_url)
VALUES 
  ('歡迎來到社區 A', '這是社區 A 的管理系統，提供完整的社區管理功能，包括公告、投票、維修報修、包裹管理等。', '王大明', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), NULL),
  ('本月管理費繳納通知', '各位住戶您好，本月管理費已開始繳納，請於本月底前完成繳費。', '王大明', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), NULL),
  ('電梯保養通知', '本週六將進行電梯定期保養，預計上午 9:00-12:00，造成不便敬請見諒。', '王大明', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), NULL),
  ('社區活動預告', '下週日將舉辦社區烤肉活動，歡迎各位住戶踴躍參加！', '王大明', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), NULL);

INSERT INTO emergencies (type, note, by)
VALUES 
  ('停電', '3樓停電，已通知台電處理', '王大明'),
  ('漏水', 'A-201 浴室漏水，已派員處理', '李小華'),
  ('火警', '地下室煙霧警報器誤觸，已確認無火災', '王大明');

INSERT INTO events (title, description, event_date, location, created_by)
VALUES 
  ('社區烤肉活動', '歡迎各位住戶攜家帶眷參加，現場提供烤肉用具及食材。', '2025-11-15 17:00:00+08', '社區中庭', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1)),
  ('住戶大會', '討論社區年度預算及重要事項', '2025-12-01 19:00:00+08', '社區活動中心', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1)),
  ('消防演習', '全體住戶消防安全演練', '2025-11-20 14:00:00+08', '社區各樓層', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1));

INSERT INTO fees (room, amount, due, paid, paid_at, invoice, note)
VALUES 
  ('A-101', 3500, '2025-11-30', true, '2025-11-05 10:30:00+08', 'INV-2025-11-001', '已繳納'),
  ('A-102', 3500, '2025-11-30', false, NULL, '', '未繳納'),
  ('A-201', 3500, '2025-11-30', true, '2025-11-08 15:20:00+08', 'INV-2025-11-002', '已繳納'),
  ('A-202', 3500, '2025-11-30', false, NULL, '', '未繳納'),
  ('A-101', 3500, '2025-10-31', true, '2025-10-15 09:00:00+08', 'INV-2025-10-001', '已繳納'),
  ('A-102', 3500, '2025-10-31', true, '2025-10-20 14:30:00+08', 'INV-2025-10-002', '已繳納');

INSERT INTO knowledge (content)
VALUES 
  ('社區 A 垃圾收集時間：每週一、三、五 晚上 8:00'),
  ('社區 A 管理費繳納方式：銀行轉帳或現金繳納至管理室'),
  ('社區 A 公共設施使用規則：請愛護公共設施，使用後請清潔'),
  ('社區 A 停車位管理：每戶限停一輛車，訪客請停訪客車位'),
  ('社區 A 寵物管理：請使用牽繩，並清理寵物排泄物'),
  ('社區 A 噪音管制：晚上 10:00 後請降低音量，避免影響鄰居');

INSERT INTO maintenance (equipment, item, handler, cost, note, status, assignee, reported_by, description)
VALUES 
  ('電梯', '定期保養', '林師傅', 5000, '已完成年度保養', 'closed', '林師傅', '王大明', '電梯運作正常，已完成潤滑及檢查'),
  ('消防設備', '消防栓檢查', '林師傅', 2000, '檢查中', 'progress', '林師傅', '王大明', '進行消防栓水壓測試'),
  ('公共照明', '走廊燈泡更換', '', 500, '待處理', 'open', '', '李小華', '2樓走廊燈泡故障'),
  ('水電', 'A-201 漏水維修', '林師傅', 3000, '已修復', 'closed', '林師傅', '張美玲', '浴室水管老化，已更換'),
  ('門禁系統', '大門感應器故障', '', 0, '待報價', 'open', '', '王大明', '大門感應器無法讀取門禁卡');

INSERT INTO meetings (topic, time, location, notes, minutes_url)
VALUES 
  ('2025年度住戶大會', '2025-12-01 19:00:00+08', '社區活動中心', '討論年度預算、管理費調整、公共設施改善等議題', ''),
  ('管委會月會 - 10月', '2025-10-15 19:30:00+08', '管理室', '討論電梯保養、消防演習安排', 'https://example.com/minutes-2025-10.pdf'),
  ('管委會月會 - 11月', '2025-11-15 19:30:00+08', '管理室', '討論年底活動規劃、預算執行狀況', '');

INSERT INTO messages (user_id, text)
VALUES 
  ('admin@tenant-a.com', '各位住戶好，本週六將進行電梯保養，請多利用樓梯。'),
  ('resident1@tenant-a.com', '請問管理費可以延後繳納嗎？'),
  ('admin@tenant-a.com', '管理費請盡量準時繳納，如有困難請與管理室聯繫。'),
  ('resident2@tenant-a.com', '社區烤肉活動我要報名參加！'),
  ('admin@tenant-a.com', '好的，已登記您的報名，謝謝！');

INSERT INTO packages (recipient_name, recipient_room, courier, tracking_number, arrived_at, picked_up_at, status, notes)
VALUES 
  ('李小華', 'A-102', '黑貓宅急便', 'TC123456789', '2025-11-10 14:30:00+08', '2025-11-10 18:00:00+08', 'picked_up', '已領取'),
  ('張美玲', 'A-201', '新竹貨運', 'HC987654321', '2025-11-11 10:00:00+08', NULL, 'pending', '待領取'),
  ('陳志明', 'A-202', '郵局', 'POST456789', '2025-11-11 15:20:00+08', NULL, 'pending', '待領取'),
  ('王大明', 'A-101', '順豐速運', 'SF789012345', '2025-11-09 09:00:00+08', '2025-11-09 19:30:00+08', 'picked_up', '已領取'),
  ('李小華', 'A-102', 'UPS', 'UPS123789', '2025-11-12 11:00:00+08', NULL, 'pending', '大型包裹');

INSERT INTO residents (name, room, phone, email, role)
VALUES 
  ('王大明', 'A-101', '0912345678', 'admin@tenant-a.com', 'committee'),
  ('李小華', 'A-102', '0923456789', 'resident1@tenant-a.com', 'resident'),
  ('張美玲', 'A-201', '0934567890', 'resident2@tenant-a.com', 'resident'),
  ('陳志明', 'A-202', '0945678901', 'resident3@tenant-a.com', 'resident'),
  ('林淑芬', 'A-301', '0956789012', 'resident4@tenant-a.com', 'resident'),
  ('黃建國', 'A-302', '0967890123', '', 'resident');

INSERT INTO visitors (name, room, "in", "out")
VALUES 
  ('訪客-張三', 'A-102', '2025-11-10 10:00:00+08', '2025-11-10 12:00:00+08'),
  ('訪客-李四', 'A-201', '2025-11-11 14:00:00+08', '2025-11-11 17:00:00+08'),
  ('訪客-王五', 'A-101', '2025-11-11 09:00:00+08', NULL),
  ('快遞員-小明', 'A-202', '2025-11-12 11:30:00+08', '2025-11-12 11:35:00+08'),
  ('維修師傅', 'A-201', '2025-11-09 13:00:00+08', '2025-11-09 15:30:00+08');

INSERT INTO votes (title, description, options, author, status, ends_at, created_by)
VALUES 
  ('是否同意調整管理費', '因應物價上漲及設備維護成本增加，提議將月管理費由 3500 元調整為 3800 元', '["同意", "反對", "棄權"]'::jsonb, '王大明', 'active', '2025-11-30 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1)),
  ('社區中庭改造方案', '提議將社區中庭改造為兒童遊樂區，預算約 50 萬元', '["同意", "反對", "棄權"]'::jsonb, '王大明', 'active', '2025-12-15 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1)),
  ('是否增設監視器', '提議在地下停車場增設 4 支監視器，預算約 8 萬元', '["同意", "反對", "棄權"]'::jsonb, '王大明', 'closed', '2025-10-31 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1));

INSERT INTO vote_records (vote_id, user_id, user_name, option_selected)
VALUES 
  ((SELECT id FROM votes WHERE title = '是否增設監視器' LIMIT 1), (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), '王大明', '同意'),
  ((SELECT id FROM votes WHERE title = '是否增設監視器' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident1@tenant-a.com' LIMIT 1), '李小華', '同意'),
  ((SELECT id FROM votes WHERE title = '是否增設監視器' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident2@tenant-a.com' LIMIT 1), '張美玲', '同意'),
  ((SELECT id FROM votes WHERE title = '是否增設監視器' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident3@tenant-a.com' LIMIT 1), '陳志明', '反對'),
  ((SELECT id FROM votes WHERE title = '是否同意調整管理費' LIMIT 1), (SELECT id FROM profiles WHERE email = 'admin@tenant-a.com' LIMIT 1), '王大明', '同意'),
  ((SELECT id FROM votes WHERE title = '是否同意調整管理費' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident1@tenant-a.com' LIMIT 1), '李小華', '棄權');
