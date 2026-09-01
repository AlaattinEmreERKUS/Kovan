import type { Message } from "@shared/protocol";

const GRUP_ARALIK = 5 * 60_000;

export interface MessageGroupItem {
  authorId: string;
  startedAt: number;
  messages: Message[];
}

export function groupMessages(messages: Message[]): MessageGroupItem[] {
  const gruplar: MessageGroupItem[] = [];
  for (const m of messages) {
    const son = gruplar[gruplar.length - 1];
    const ayniGrup =
      son !== undefined &&
      son.authorId === m.authorId &&
      m.createdAt - son.messages[son.messages.length - 1].createdAt <= GRUP_ARALIK;

    if (ayniGrup) son.messages.push(m);
    else gruplar.push({ authorId: m.authorId, startedAt: m.createdAt, messages: [m] });
  }
  return gruplar;
}
