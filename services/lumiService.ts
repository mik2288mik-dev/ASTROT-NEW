const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data as any).message || (data as any).error || `Request failed: ${response.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function getBalance(userId: string): Promise<{ balance: number; is_premium: boolean; premium_expires_at: string | null }> {
  const url = `${API_BASE_URL}/api/user/balance?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function purchaseLumi(userId: string, pack: string): Promise<{ success: boolean; balance: number; amount: number }> {
  const url = `${API_BASE_URL}/api/purchase/lumi`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, package: pack }),
  });
  return handleResponse(response);
}

export async function purchasePremium(userId: string, plan: string): Promise<{ success: boolean; premium_expires_at: string }> {
  const url = `${API_BASE_URL}/api/purchase/premium`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, plan }),
  });
  return handleResponse(response);
}

export async function spendLumi(userId: string, card_id: number, item: string, cost: number): Promise<{ success: boolean; balance: number }> {
  const url = `${API_BASE_URL}/api/spend/lumi`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, card_id, item, cost }),
  });
  return handleResponse(response);
}

export async function purchaseSlot(userId: string, slots: number): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/api/purchase/slot`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, slots }),
  });
  return handleResponse(response);
}
