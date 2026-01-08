import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    const { email, password, name, phone } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email 和密碼為必填' },
        { status: 400 }
      );
    }

    // 使用 Supabase Auth 註冊
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      console.error('❌ 註冊失敗:', error);
      return NextResponse.json(
        { success: false, message: error?.message || '註冊失敗' },
        { status: 400 }
      );
    }

    // 將用戶資訊寫入 profiles 表
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: data.user.id,
          email,
          name: name || null,
          phone: phone || null,
          role: 'user',
          status: 'active',
        },
      ])
      .select('*')
      .single();

    if (profileError || !profile) {
      console.error('❌ 建立 profile 失敗:', profileError);
      // 刪除已建立的 auth 用戶
      await supabase.auth.admin.deleteUser(data.user.id);
      return NextResponse.json(
        { success: false, message: '建立用戶資訊失敗' },
        { status: 400 }
      );
    }

    console.log('✅ 註冊成功:', email);

    return NextResponse.json({
      success: true,
      message: '註冊成功',
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
    console.error('❌ 註冊錯誤:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
