export type NatalQuestionOpenRequest = {
  requestId: number;
  text?: string;
};

export function questionTextForOpenRequest(
  request: NatalQuestionOpenRequest | null | undefined,
): string {
  return (request?.text || '').slice(0, 300);
}
