import type { User } from "@shared/protocol";

export interface YoneticiKullanici extends User {
  createdAt: number;
  mesajSayisi: number;
}

/** Yonetici listesi: kimin ne kadar iz biraktigini silmeden once gormek icin. */
export function kullaniciListesi(sql: SqlStorage): YoneticiKullanici[] {
  return sql
    .exec<{ id: string; username: string; display_name: string; created_at: number; n: number }>(`
      SELECT u.id, u.username, u.display_name, u.created_at,
             (SELECT COUNT(*) FROM messages m WHERE m.author_id = u.id) AS n
      FROM users u ORDER BY u.created_at`)
    .toArray()
    .map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      createdAt: r.created_at,
      mesajSayisi: r.n,
    }));
}

/**
 * Verilen kullanici adlarini ve BIRAKTIKLARI HER IZI siler: mesajlari, o
 * mesajlara baskalarinin verdigi tepkiler, kendi verdigi tepkiler, oturum
 * kayitlari ve kullandigi davet.
 *
 * Silme ADLA istenir ama kimlikle yurur; bilinmeyen ad sessizce atlanir
 * (yanlis yazilmis tek bir ad butun islemi durdurmasin diye).
 *
 * Oturumlarin silinmesi sart: token'i elinde kalan biri, kullanicisi
 * silinmisken bile bagli kalmaya devam ederdi.
 */
export function kullanicilariSil(sql: SqlStorage, usernames: string[]): { ids: string[] } {
  const ids: string[] = [];
  for (const username of usernames) {
    const satir = sql
      .exec<{ id: string }>("SELECT id FROM users WHERE username = ?", username)
      .toArray()[0];
    if (!satir) continue;
    const id = satir.id;

    sql.exec("DELETE FROM reactions WHERE user_id = ?", id);
    sql.exec(
      "DELETE FROM reactions WHERE message_id IN (SELECT id FROM messages WHERE author_id = ?)",
      id);
    sql.exec("DELETE FROM messages WHERE author_id = ?", id);
    sql.exec("DELETE FROM sessions WHERE user_id = ?", id);
    sql.exec("DELETE FROM invites WHERE used_by = ?", id);
    sql.exec("DELETE FROM users WHERE id = ?", id);
    ids.push(id);
  }
  return { ids };
}
