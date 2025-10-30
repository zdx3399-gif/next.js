-- SQL script to create database schema for Tenant B (社區 B)
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

-- Insert sample data for Tenant B
INSERT INTO profiles (email, password, name, phone, room, unit, role, status)
VALUES 
  ('admin@tenant-b.com', 'admin123', '劉主委', '0987654321', 'B-101', '1F', 'committee', 'active'),
  ('resident1@tenant-b.com', 'password123', '周小姐', '0976543210', 'B-102', '1F', 'resident', 'active'),
  ('resident2@tenant-b.com', 'password123', '吳先生', '0965432109', 'B-201', '2F', 'resident', 'active'),
  ('resident3@tenant-b.com', 'password123', '鄭太太', '0954321098', 'B-202', '2F', 'resident', 'active'),
  ('vendor@tenant-b.com', 'vendor123', '陳技師', '0943210987', '', '', 'vendor', 'active')
ON CONFLICT (email) DO NOTHING;

INSERT INTO announcements (title, content, author, status, created_by, image_url)
VALUES 
  ('歡迎來到社區 B', '這是社區 B 的管理系統，提供完整的社區管理功能，包括公告、投票、維修報修、包裹管理等。', '劉主委', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), NULL),
  ('年底大掃除通知', '各位住戶您好，本月底將進行社區大掃除，請配合清理門前走廊。', '劉主委', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), NULL),
  ('停水通知', '本週三上午 9:00-15:00 進行水塔清洗，期間暫停供水。', '劉主委', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), NULL),
  ('中秋節活動通知', '中秋節將舉辦賞月晚會，歡迎住戶參加！', '劉主委', 'published', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), NULL);

INSERT INTO emergencies (type, note, by)
VALUES 
  ('瓦斯外洩', 'B-202 瓦斯外洩，已關閉總開關並通知瓦斯公司', '劉主委'),
  ('電梯故障', '2號電梯故障，已通知維修廠商', '周小姐'),
  ('颱風警報', '颱風即將來襲，請住戶做好防颱準備', '劉主委');

INSERT INTO events (title, description, event_date, location, created_by)
VALUES 
  ('中秋賞月晚會', '提供月餅、柚子及飲料，歡迎住戶參加', '2025-09-15 19:00:00+08', '社區頂樓', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1)),
  ('年度住戶大會', '討論社區重大事項及選舉新任管委會', '2025-12-20 19:00:00+08', '社區會議室', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1)),
  ('親子運動會', '社區親子趣味競賽活動', '2025-11-25 09:00:00+08', '社區廣場', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1));

INSERT INTO fees (room, amount, due, paid, paid_at, invoice, note)
VALUES 
  ('B-101', 4000, '2025-11-30', true, '2025-11-03 09:15:00+08', 'INV-B-2025-11-001', '已繳納'),
  ('B-102', 4000, '2025-11-30', false, NULL, '', '未繳納'),
  ('B-201', 4000, '2025-11-30', true, '2025-11-10 16:45:00+08', 'INV-B-2025-11-002', '已繳納'),
  ('B-202', 4000, '2025-11-30', false, NULL, '', '未繳納'),
  ('B-101', 4000, '2025-10-31', true, '2025-10-12 10:00:00+08', 'INV-B-2025-10-001', '已繳納'),
  ('B-102', 4000, '2025-10-31', true, '2025-10-25 13:20:00+08', 'INV-B-2025-10-002', '已繳納');

INSERT INTO knowledge (content)
VALUES 
  ('社區 B 垃圾收集時間：每週二、四、六 晚上 7:30'),
  ('社區 B 管理費繳納方式：線上支付或臨櫃繳納至管理室'),
  ('社區 B 公共設施使用規則：請預約使用，並於使用後恢復原狀'),
  ('社區 B 停車管理：地下停車場採月租制，請勿佔用他人車位'),
  ('社區 B 寵物規範：禁止在公共區域餵食流浪動物'),
  ('社區 B 裝修規定：裝修時間為平日 8:00-18:00，假日禁止施工');

INSERT INTO maintenance (equipment, item, handler, cost, note, status, assignee, reported_by, description)
VALUES 
  ('空調系統', '中央空調保養', '陳技師', 8000, '已完成季度保養', 'closed', '陳技師', '劉主委', '空調系統運作正常，已更換濾網'),
  ('電梯', '2號電梯維修', '陳技師', 15000, '維修中', 'progress', '陳技師', '周小姐', '電梯門感應器故障，零件已訂購'),
  ('水電', 'B-102 水龍頭漏水', '', 800, '待處理', 'open', '', '周小姐', '廚房水龍頭持續滴水'),
  ('門禁', '地下室門禁卡機故障', '陳技師', 5000, '已修復', 'closed', '陳技師', '劉主委', '已更換讀卡機主機板'),
  ('公共設施', '游泳池過濾系統', '', 0, '待檢查', 'open', '', '劉主委', '游泳池水質混濁，需檢查過濾系統');

INSERT INTO meetings (topic, time, location, notes, minutes_url)
VALUES 
  ('2025年度住戶大會', '2025-12-20 19:00:00+08', '社區會議室', '討論年度預算、選舉新任管委會、公共設施改善', ''),
  ('管委會月會 - 10月', '2025-10-20 20:00:00+08', '管理室', '討論中秋活動檢討、年底活動規劃', 'https://example.com/minutes-b-2025-10.pdf'),
  ('管委會月會 - 11月', '2025-11-20 20:00:00+08', '管理室', '討論預算執行、設備維護狀況', '');

INSERT INTO messages (user_id, text)
VALUES 
  ('admin@tenant-b.com', '各位住戶好，本週三將進行水塔清洗，請提前儲水。'),
  ('resident1@tenant-b.com', '請問中秋晚會需要報名嗎？'),
  ('admin@tenant-b.com', '不需要報名，歡迎直接參加！'),
  ('resident2@tenant-b.com', '地下室門禁卡無法使用，請協助處理。'),
  ('admin@tenant-b.com', '已通知技師前往檢修，造成不便敬請見諒。');

INSERT INTO packages (recipient_name, recipient_room, courier, tracking_number, arrived_at, picked_up_at, status, notes)
VALUES 
  ('周小姐', 'B-102', '宅配通', 'HD123456789', '2025-11-10 13:00:00+08', '2025-11-10 19:00:00+08', 'picked_up', '已領取'),
  ('吳先生', 'B-201', '大榮貨運', 'KT987654321', '2025-11-11 11:30:00+08', NULL, 'pending', '待領取'),
  ('鄭太太', 'B-202', '中華郵政', 'POST789456', '2025-11-11 16:00:00+08', NULL, 'pending', '掛號信件'),
  ('劉主委', 'B-101', 'DHL', 'DHL456123789', '2025-11-09 10:00:00+08', '2025-11-09 20:00:00+08', 'picked_up', '已領取'),
  ('周小姐', 'B-102', '嘉里大榮', 'KY789456123', '2025-11-12 14:00:00+08', NULL, 'pending', '冷藏包裹');

INSERT INTO residents (name, room, phone, email, role)
VALUES 
  ('劉主委', 'B-101', '0987654321', 'admin@tenant-b.com', 'committee'),
  ('周小姐', 'B-102', '0976543210', 'resident1@tenant-b.com', 'resident'),
  ('吳先生', 'B-201', '0965432109', 'resident2@tenant-b.com', 'resident'),
  ('鄭太太', 'B-202', '0954321098', 'resident3@tenant-b.com', 'resident'),
  ('黃醫師', 'B-301', '0943210987', 'resident4@tenant-b.com', 'resident'),
  ('謝教授', 'B-302', '0932109876', '', 'resident');

INSERT INTO visitors (name, room, "in", "out")
VALUES 
  ('訪客-陳先生', 'B-102', '2025-11-10 15:00:00+08', '2025-11-10 18:00:00+08'),
  ('訪客-林小姐', 'B-201', '2025-11-11 10:00:00+08', '2025-11-11 14:00:00+08'),
  ('訪客-王先生', 'B-101', '2025-11-11 16:00:00+08', NULL),
  ('快遞員-阿明', 'B-202', '2025-11-12 13:30:00+08', '2025-11-12 13:35:00+08'),
  ('水電師傅', 'B-102', '2025-10-09 14:00:00+08', '2025-10-09 16:00:00+08');

INSERT INTO votes (title, description, options, author, status, ends_at, created_by)
VALUES 
  ('是否同意增設電動車充電樞', '提議在地下停車場增設 6 個電動車充電樞，預算約 30 萬元', '["同意", "反對", "棄權"]'::jsonb, '劉主委', 'active', '2025-11-30 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1)),
  ('游泳池開放時間調整', '提議將游泳池開放時間延長至晚上 10:00', '["同意", "反對", "棄權"]'::jsonb, '劉主委', 'active', '2025-12-10 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1)),
  ('是否更換社區大門', '提議更換社區大門為自動門，預算約 25 萬元', '["同意", "反對", "棄權"]'::jsonb, '劉主委', 'closed', '2025-10-31 23:59:59+08', (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1));

INSERT INTO vote_records (vote_id, user_id, user_name, option_selected)
VALUES 
  ((SELECT id FROM votes WHERE title = '是否更換社區大門' LIMIT 1), (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), '劉主委', '同意'),
  ((SELECT id FROM votes WHERE title = '是否更換社區大門' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident1@tenant-b.com' LIMIT 1), '周小姐', '同意'),
  ((SELECT id FROM votes WHERE title = '是否更換社區大門' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident2@tenant-b.com' LIMIT 1), '吳先生', '反對'),
  ((SELECT id FROM votes WHERE title = '是否更換社區大門' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident3@tenant-b.com' LIMIT 1), '鄭太太', '同意'),
  ((SELECT id FROM votes WHERE title = '是否同意增設電動車充電樞' LIMIT 1), (SELECT id FROM profiles WHERE email = 'admin@tenant-b.com' LIMIT 1), '劉主委', '同意'),
  ((SELECT id FROM votes WHERE title = '是否同意增設電動車充電樞' LIMIT 1), (SELECT id FROM profiles WHERE email = 'resident1@tenant-b.com' LIMIT 1), '周小姐', '同意');
