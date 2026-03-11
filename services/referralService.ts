const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data as any).message || (data as any).error || `Request failed: ${response.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function getReferralLink(userId: string): Promise<{ ref_code: string; link: string }> {
  const url = `${API_BASE_URL}/api/referral/link?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function registerReferral(userId: string, ref_code: string): Promise<{ success: boolean; created: boolean }> {
  const url = `${API_BASE_URL}/api/referral/register`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ref_code }),
  });
  return handleResponse(response);
}
