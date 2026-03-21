import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { createAuthClient } from '@/lib/supabase';
import { withLogger } from '@/lib/logger';

export const DELETE = withLogger(async (req, { params }) => {
  const auth = await authenticateRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const token = req.headers.get('Authorization')!.slice(7);
  const supabase = createAuthClient(token);

  const { error } = await supabase
    .from('chat_messages')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json(
      { success: false, data: null, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: null, error: null });
});
