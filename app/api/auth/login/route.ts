import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email 和密碼為必填' },
        { status: 400 }
      );
    }

    // 直接查詢 profiles 表（使用明文密碼比對，與 auth/page.tsx 相同）
    const { data: user, error: queryError } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        password,
        name,
        phone,
        role,
        status,
        line_user_id,
        line_display_name,
        line_avatar_url,
        line_status_message,
        tenant_id,
        unit_id,
        created_at
      `)
      .eq('email', email)
      .single();

    if (queryError || !user) {
      console.error('❌ 查詢失敗或用戶不存在:', queryError);
      return NextResponse.json(
        { success: false, message: 'Email 或密碼錯誤' },
        { status: 401 }
      );
    }

    // 檢查帳號狀態
    if (user.status !== 'active') {
      return NextResponse.json(
        { success: false, message: '帳號已被停用，請聯繫管理員' },
        { status: 403 }
      );
    }

    // 驗證密碼（明文比對）
    if (user.password !== password) {
      return NextResponse.json(
        { success: false, message: 'Email 或密碼錯誤' },
        { status: 401 }
      );
    }

    // 更新最後登入時間
    await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id);

    console.log('✅ 登入成功:', email);

    return NextResponse.json({
      success: true,
      message: '登入成功',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        tenant_id: user.tenant_id,
        unit_id: user.unit_id,
        line_user_id: user.line_user_id,
        line_display_name: user.line_display_name,
        line_avatar_url: user.line_avatar_url,
        line_status_message: user.line_status_message,
        line_bound: !!user.line_user_id,
        created_at: user.created_at
      },
    });
  } catch (error: any) {
    console.error('❌ 登入錯誤:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
