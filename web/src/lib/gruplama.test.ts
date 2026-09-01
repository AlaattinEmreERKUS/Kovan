import { describe, it, expect } from "vitest";
import { groupMessages } from "./gruplama";

const m = (id: number, authorId: string, dk: number) => ({
  id, authorId, content: `m${id}`, createdAt: dk * 60_000,
});

describe("groupMessages", () => {
  it("ayni yazarin 5 dakika icindeki mesajlarini birlestirir", () => {
    const gruplar = groupMessages([m(1, "a", 0), m(2, "a", 3), m(3, "a", 4)]);
    expect(gruplar).toHaveLength(1);
    expect(gruplar[0].messages).toHaveLength(3);
  });

  it("5 dakikayi asinca yeni grup acar", () => {
    const gruplar = groupMessages([m(1, "a", 0), m(2, "a", 6)]);
    expect(gruplar).toHaveLength(2);
  });

  it("yazar degisince yeni grup acar", () => {
    const gruplar = groupMessages([m(1, "a", 0), m(2, "b", 1)]);
    expect(gruplar).toHaveLength(2);
  });

  it("bos girdi bos cikti verir", () => {
    expect(groupMessages([])).toEqual([]);
  });

  it("aralik SON mesajdan olculur, grup basindan degil", () => {
    // 0, 4, 8, 12: her adim 5dk'nin altinda, hepsi tek grup olmali.
    const gruplar = groupMessages([m(1, "a", 0), m(2, "a", 4), m(3, "a", 8), m(4, "a", 12)]);
    expect(gruplar).toHaveLength(1);
  });
});
