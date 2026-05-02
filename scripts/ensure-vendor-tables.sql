-- 确保 vendors 和 vendor_workers 表存在且结构完整
-- 执行此脚本以修复派工师傅电话自动带入问题

-- 1) 创建或确保 vendors 表存在
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  specialty text,
  phone text,
  email text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) 创建或确保 vendor_workers 表存在
CREATE TABLE IF NOT EXISTS public.vendor_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  specialty text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- 确保同一廠商下師傅名字唯一
  UNIQUE(vendor_id, name)
);

-- 3) 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_vendor_workers_vendor_id ON public.vendor_workers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_workers_name ON public.vendor_workers(name);

-- 4) 验证表是否已存在并有正确的列
DO $$ 
BEGIN
  -- 为 vendors 表添加缺失的列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.vendors ADD COLUMN email text;
  END IF;

  -- 为 vendor_workers 表添加缺失的列
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendor_workers' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.vendor_workers ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendor_workers' AND column_name = 'specialty'
  ) THEN
    ALTER TABLE public.vendor_workers ADD COLUMN specialty text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'vendor_workers' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.vendor_workers ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- 5) 启用行级安全（RLS）
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_workers ENABLE ROW LEVEL SECURITY;

-- 6) 创建 RLS 政策 - 允许认证用户读取
CREATE POLICY "Allow authenticated users to read vendors"
  ON public.vendors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to read vendor_workers"
  ON public.vendor_workers
  FOR SELECT
  TO authenticated
  USING (true);

-- 7) 允许管理员修改
CREATE POLICY "Allow admins to manage vendors"
  ON public.vendors
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "Allow admins to manage vendor_workers"
  ON public.vendor_workers
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- 示例数据（如果需要测试，可取消注释）
-- INSERT INTO public.vendors (name, specialty, phone) VALUES 
-- ('ABC 维修公司', '电梯维护', '0912345678')
-- ON CONFLICT (name) DO NOTHING;

-- INSERT INTO public.vendor_workers (vendor_id, name, phone, specialty) 
-- SELECT id, '张师傅', '0987654321', '电梯维护' FROM public.vendors WHERE name = 'ABC 维修公司'
-- ON CONFLICT (vendor_id, name) DO NOTHING;

-- 检查数据完整性
SELECT '=== Vendors Table ===' as info;
SELECT id, name, specialty, phone FROM public.vendors LIMIT 5;

SELECT '=== Vendor Workers Table ===' as info;
SELECT id, vendor_id, name, phone, specialty FROM public.vendor_workers LIMIT 5;

COMMIT;
