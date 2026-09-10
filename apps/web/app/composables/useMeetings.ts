/** Встреча — форма ответа API `GET /meetings`. */
export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** Тело запроса `POST /meetings`. */
export interface CreateMeetingPayload {
  title: string;
  date: string;
  participants: string[];
}

/** CRUD встреч текущего пользователя через авторизованный клиент API. */
export function useMeetings() {
  const api = useApi();

  /** Все встречи владельца, API отдаёт их отсортированными по `createdAt` убыв. */
  const list = () => api<Meeting[]>('/meetings');

  const create = (payload: CreateMeetingPayload) =>
    api<Meeting>('/meetings', { method: 'POST', body: payload });

  return { list, create };
}
