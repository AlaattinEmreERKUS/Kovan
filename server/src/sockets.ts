import type { ServerEvent } from "@shared/protocol";

export interface SocketState {
  userId: string;
  username: string;
  displayName: string;
  /**
   * Socket'in acilis zamani. Ayni kullanicinin iki kaydi oldugunda (olu
   * baglanti henuz tespit edilmemisken kisi geri baglandi) hangisinin
   * guncel oldugunu AYIRT EDEN tek bilgi budur; getWebSockets() sirasi
   * hibernation sonrasi korunmaz.
   */
  joinedAt: number;
  inVoice: boolean;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screen: boolean;
  /** Ekranla birlikte sistem sesi de gidiyor mu (spec 8.1). */
  screenAudio: boolean;
}

export function readState(ws: WebSocket): SocketState {
  return ws.deserializeAttachment() as SocketState;
}

export function writeState(ws: WebSocket, patch: Partial<SocketState>): SocketState {
  const next = { ...readState(ws), ...patch };
  ws.serializeAttachment(next);
  return next;
}

/**
 * Online kullanıcılar DAİMA açık socket'lerden türetilir.
 * Instance alanında cache tutmak hibernation sonrası state kaybına yol açar.
 */
export function onlineUserIds(ctx: DurableObjectState): string[] {
  return [...new Set(ctx.getWebSockets().map((ws) => readState(ws).userId))];
}

export function socketsOf(ctx: DurableObjectState, userId: string): WebSocket[] {
  return ctx.getWebSockets().filter((ws) => readState(ws).userId === userId);
}

export function broadcast(ctx: DurableObjectState, event: ServerEvent, exclude?: WebSocket): void {
  const payload = JSON.stringify(event);
  for (const ws of ctx.getWebSockets()) {
    if (ws === exclude) continue;
    try {
      ws.send(payload);
    } catch {
      // Kapanmış socket. getWebSockets() bir sonraki turda temizler.
    }
  }
}

export function sendTo(ctx: DurableObjectState, userId: string, event: ServerEvent): void {
  const payload = JSON.stringify(event);
  for (const ws of socketsOf(ctx, userId)) {
    try {
      ws.send(payload);
    } catch { /* yukarıdaki gerekçe */ }
  }
}

/**
 * Sinyali hedefin YALNIZCA ses kanalindaki socket'lerine gonderir. Ayni
 * kullanicinin sesten bagimsiz ikinci sekmesine offer gitmemeli: o sekmede
 * mesh yok, cevap donmez ve gonderen tarafta yarim baglanti asili kalir.
 */
export function sendToVoice(ctx: DurableObjectState, userId: string, event: ServerEvent): void {
  const payload = JSON.stringify(event);
  for (const ws of ctx.getWebSockets()) {
    const s = readState(ws);
    if (s.userId !== userId || !s.inVoice) continue;
    try {
      ws.send(payload);
    } catch {
      // Kapanmis socket. getWebSockets() bir sonraki turda temizler.
    }
  }
}
