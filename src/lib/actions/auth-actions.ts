'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword, createToken } from '@/lib/auth';

export async function loginAction(prevState: { error: string } | null, formData: FormData) {
  const password = formData.get('password') as string;
  const hash = process.env.ADMIN_PASSWORD_HASH;

  if (!hash || !password) {
    return { error: 'Invalid credentials' };
  }

  if (!verifyPassword(password, hash)) {
    return { error: 'Invalid credentials' };
  }

  const token = await createToken();
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  redirect('/');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  redirect('/login');
}
