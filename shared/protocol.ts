export interface User {
  id: string;
  username: string;
  displayName: string;
}

export interface Message {
  id: number;
  authorId: string;
  content: string;
  createdAt: number;
}

export interface ReactionState {
  messageId: number;
  emoji: string;
  userIds: string[];
}

export interface VoiceMember {
  userId: string;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  /** Ekran paylasiyor mu. */
  screen: boolean;
  /** Ekranla birlikte sistem sesi de gidiyor mu (spec 8.1). */
  screenAudio: boolean;
}

/**
 * Canli tutma. JSON DEGIL, duz metin: sunucuda `setWebSocketAutoResponse`
 * bu dizgiyi birebir eslestirip DO'yu uyandirmadan cevaplar. Seste socket
 * dakikalarca sessiz kalir; ara cihazlar sessiz baglantiyi 1006 ile kesiyordu
 * (2026-09-19 kopma kaydi).
 */
export const PING = "ping";
export const PONG = "pong";

export type ClientEvent =
  | { t: "msg.send"; content: string; localId: string }
  | { t: "reaction.toggle"; messageId: number; emoji: string }
  | { t: "typing" }
  | { t: "sync"; lastMessageId: number }
  | { t: "voice.join" }
  | { t: "voice.leave" }
  | { t: "voice.state"; muted: boolean; deafened: boolean; camera: boolean; screen: boolean; screenAudio: boolean }
  | { t: "signal"; target: string; data: unknown };

export type ServerEvent =
  | { t: "hello"; me: User; members: User[]; recentMessages: Message[]; reactions: ReactionState[]; online: string[]; voiceMembers: VoiceMember[] }
  | { t: "msg.new"; message: Message; localId?: string }
  | { t: "reaction.update"; messageId: number; emoji: string; userIds: string[] }
  | { t: "presence.update"; userId: string; online: boolean }
  /** Yeni bir uye tanindi. Baglantida DIGERLERINE yayilir; istemci upsert eder. */
  | { t: "member.new"; user: User }
  /** Yonetici bir veya daha fazla uyeyi sildi. */
  | { t: "member.gone"; userIds: string[] }
  | { t: "typing"; userId: string }
  | { t: "sync.result"; messages: Message[] }
  | { t: "voice.members"; members: VoiceMember[] }
  | { t: "signal"; from: string; data: unknown }
  | { t: "error"; code: string; message: string };
