const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data as any).message || (data as any).error || `Request failed: ${response.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function calculateNatalChart(
  userId: string,
  name: string,
  birthDate: string,
  birthTime: string | null,
  birthPlace: string
): Promise<any> {
  const url = `${API_BASE_URL}/api/astrology/natal-chart`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      name,
      birthDate,
      birthTime: birthTime || '12:00',
      birthPlace,
      language: 'ru',
      forceRecalculate: true,
    }),
  });
  return handleResponse(response);
}

export interface CardPayload {
  name?: string;
  birth_date?: string;
  birth_time?: string | null;
  birth_place?: string;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  data_json?: any;
  is_purchased_full?: boolean;
  is_purchased_pro?: boolean;
}

export async function getCards(userId: string): Promise<{ success: boolean; cards: any[] }> {
  const url = `${API_BASE_URL}/api/cards?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function getCardById(userId: string, cardId: number): Promise<{ success: boolean; card: any }> {
  const url = `${API_BASE_URL}/api/cards/${cardId}?userId=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  return handleResponse(response);
}

export async function createCard(userId: string, payload: CardPayload): Promise<{ success: boolean; card: any }> {
  const url = `${API_BASE_URL}/api/cards`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload }),
  });
  return handleResponse(response);
}

export async function updateCard(userId: string, cardId: number, payload: CardPayload): Promise<{ success: boolean; card: any }> {
  const url = `${API_BASE_URL}/api/cards/${cardId}`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload }),
  });
  return handleResponse(response);
}

export async function deleteCard(userId: string, cardId: number): Promise<{ success: boolean }> {
  const url = `${API_BASE_URL}/api/cards/${cardId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return handleResponse(response);
}
