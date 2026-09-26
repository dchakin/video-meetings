/**
 * Приводит email к канонической форме (trim + lowercase) перед сравнением,
 * хранением или поиском — иначе `Bob@x.com` и `bob@x.com` считаются разными
 * адресами, что путает права доступа (сверка участников встречи по email).
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
