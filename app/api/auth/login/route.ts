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

    // 使用 Supabase Auth 登入
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.error('❌ 登入失敗:', error);
      return NextResponse.json(
        { success: false, message: '登入失敗，帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // 從 profiles 表查詢用戶資訊
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('❌ 查詢 profile 失敗:', profileError);
      return NextResponse.json(
        { success: false, message: '查詢用戶資訊失敗' },
        { status: 404 }
      );
    }

    console.log('✅ 登入成功:', email);

    return NextResponse.json({
      success: true,
      message: '登入成功',
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        line_user_id: profile.line_user_id,
        line_display_name: profile.line_display_name,
        line_avatar_url: profile.line_avatar_url,
        line_status_message: profile.line_status_message,
        line_bound: !!profile.line_user_id,
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
