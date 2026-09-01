import { describe, it, expect } from "vitest";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { store, reactionKey, applyReactions, lastMessageId } from "./store.svelte";

describe("store tepkiselligi", () => {
  // NOT: $effect node/SSR ortaminda kosmuyor, bu yuzden "arayuz yeniden
  // ciziliyor mu" burada olculemiyor. Olculebilen sey tur secimi: duz Set/Map
  // $state icinde derin tepkisel degil, bu yuzden svelte/reactivity
  // karsiliklari zorunlu. Gercek cizim davranisi T14'te tarayicida olculecek.
  it("koleksiyonlar duz Set/Map degil tepkisel turdedir", () => {
    expect(store.online).toBeInstanceOf(SvelteSet);
    expect(store.typingUserIds).toBeInstanceOf(SvelteSet);
    expect(store.reactions).toBeInstanceOf(SvelteMap);
  });
});

describe("store yardimcilari", () => {
  it("reaksiyon anahtari mesaj ve emojiden olusur", () => {
    expect(reactionKey(3, "🔥")).toBe("3|🔥");
  });

  it("applyReactions listeyi haritaya yazar", () => {
    applyReactions([{ messageId: 1, emoji: "👍", userIds: ["u1", "u2"] }]);
    expect(store.reactions.get("1|👍")).toEqual(["u1", "u2"]);
    store.reactions.clear();
  });

  it("lastMessageId bos gecmiste 0 doner", () => {
    store.messages = [];
    expect(lastMessageId()).toBe(0);
    store.messages = [{ id: 9, authorId: "u", content: "x", createdAt: 1 }];
    expect(lastMessageId()).toBe(9);
    store.messages = [];
  });
});
