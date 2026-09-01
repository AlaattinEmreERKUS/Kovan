import { SvelteMap, SvelteSet } from "svelte/reactivity";
import type { Message, ReactionState, User } from "@shared/protocol";

export type Durum = "baglaniyor" | "acik" | "kopuk";

/**
 * Plandan sapma: duz Set/Map, $state icinde derin tepkisel DEGILDIR.
 * add/delete/set cagrilari arayuzu yeniden cizdirmez; presence, reaksiyon ve
 * "yaziyor" gostergeleri sessizce olu kalir. svelte/reactivity karsiliklari
 * bu yuzden zorunlu.
 *
 * Reaksiyon anahtari: `${messageId}|${emoji}`
 */
export const store = $state({
  me: null as User | null,
  members: [] as User[],
  messages: [] as Message[],
  online: new SvelteSet<string>(),
  reactions: new SvelteMap<string, string[]>(),
  typingUserIds: new SvelteSet<string>(),
  durum: "baglaniyor" as Durum,
});

export function reactionKey(messageId: number, emoji: string): string {
  return `${messageId}|${emoji}`;
}

export function applyReactions(list: ReactionState[]): void {
  for (const r of list) store.reactions.set(reactionKey(r.messageId, r.emoji), r.userIds);
}

export function lastMessageId(): number {
  return store.messages.length === 0 ? 0 : store.messages[store.messages.length - 1].id;
}
