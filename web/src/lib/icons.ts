/**
 * Dolu (filled) stil inline SVG seti. 24x24 grid, renk currentColor.
 * Govdeler dolu, yalniz yaylar konturlu. Dis bagimlilik ya da ikon
 * dosyasi yok.
 */
export const IKONLAR = {
  "mik":
    '<rect x="8.6" y="2.8" width="6.8" height="11.6" rx="3.4" fill="currentColor"/>' +
    '<path d="M5.5 11v.5a6.5 6.5 0 0 0 13 0V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M12 18.2v2.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M8.8 21h6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  "mik-kapali":
    '<rect x="8.6" y="2.8" width="6.8" height="11.6" rx="3.4" fill="currentColor"/>' +
    '<path d="M5.5 11v.5a6.5 6.5 0 0 0 13 0V11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M12 18.2v2.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M8.8 21h6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M4.2 3.6 20 19.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  "kulaklik":
    '<path d="M4 15v-3a8 8 0 0 1 16 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<rect x="2.6" y="13.6" width="4.8" height="6.8" rx="2" fill="currentColor"/>' +
    '<rect x="16.6" y="13.6" width="4.8" height="6.8" rx="2" fill="currentColor"/>',
  "kulaklik-kapali":
    '<path d="M4 15v-3a8 8 0 0 1 16 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<rect x="2.6" y="13.6" width="4.8" height="6.8" rx="2" fill="currentColor"/>' +
    '<rect x="16.6" y="13.6" width="4.8" height="6.8" rx="2" fill="currentColor"/>' +
    '<path d="M3.4 3.4 20.6 20.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  "kamera":
    '<rect x="2.4" y="6.2" width="12.8" height="11.6" rx="2.8" fill="currentColor"/>' +
    '<path d="M15.6 11.1l5-3a.9.9 0 0 1 1.4.8v6.2a.9.9 0 0 1-1.4.8l-5-3z" fill="currentColor"/>',
  "kamera-kapali":
    '<rect x="2.4" y="6.2" width="12.8" height="11.6" rx="2.8" fill="currentColor"/>' +
    '<path d="M15.6 11.1l5-3a.9.9 0 0 1 1.4.8v6.2a.9.9 0 0 1-1.4.8l-5-3z" fill="currentColor"/>' +
    '<path d="M3.4 3.4 20.6 20.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  "ekran":
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M4 3.5h16A2.5 2.5 0 0 1 22.5 6v9a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 15V6A2.5 2.5 0 0 1 4 3.5Zm0 2a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h16a.5.5 0 0 0 .5-.5V6a.5.5 0 0 0-.5-.5H4Z" fill="currentColor"/>' +
    '<path d="M12 6.6l3.4 3.7h-2.3v3.2h-2.2v-3.2H8.6z" fill="currentColor"/>' +
    '<rect x="7.6" y="19.4" width="8.8" height="2.1" rx="1.05" fill="currentColor"/>',
  "gorunum":
    '<rect x="3" y="3" width="8" height="8" rx="1.8" fill="currentColor"/>' +
    '<rect x="13" y="3" width="8" height="8" rx="1.8" fill="currentColor"/>' +
    '<rect x="3" y="13" width="8" height="8" rx="1.8" fill="currentColor"/>' +
    '<rect x="13" y="13" width="8" height="8" rx="1.8" fill="currentColor"/>',
  "ayril":
    '<path d="M11 3.5H6A2.5 2.5 0 0 0 3.5 6v12A2.5 2.5 0 0 0 6 20.5h5a1 1 0 0 0 0-2H6a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5h5a1 1 0 0 0 0-2Z" fill="currentColor"/>' +
    '<path d="M15.9 7.3a1 1 0 0 0-1.4 1.4L16.8 11H9.6a1 1 0 1 0 0 2h7.2l-2.3 2.3a1 1 0 0 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4Z" fill="currentColor"/>',
  "uyari":
    '<path d="M10.9 3.6 1.7 19a1.3 1.3 0 0 0 1.1 2h18.4a1.3 1.3 0 0 0 1.1-2L13.1 3.6a1.3 1.3 0 0 0-2.2 0Z" fill="currentColor"/>' +
    '<rect x="11" y="8.6" width="2" height="5.6" rx="1" fill="var(--zemin-0)"/>' +
    '<rect x="11" y="16" width="2" height="2" rx="1" fill="var(--zemin-0)"/>',
  "hoparlor":
    '<path d="M11.2 4.4 6.6 8.2H3.4a1 1 0 0 0-1 1v5.6a1 1 0 0 0 1 1h3.2l4.6 3.8a1 1 0 0 0 1.6-.8V5.2a1 1 0 0 0-1.6-.8Z" fill="currentColor"/>' +
    '<path d="M16.4 8.6a4.6 4.6 0 0 1 0 6.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M19.4 5.8a8.6 8.6 0 0 1 0 12.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  "buyut":
    '<path d="M4 3.5h5.4a1 1 0 1 1 0 2H6.9l3.8 3.8a1 1 0 0 1-1.4 1.4L5.5 6.9v2.5a1 1 0 0 1-2 0V4a.5.5 0 0 1 .5-.5Z" fill="currentColor"/>' +
    '<path d="M20 20.5h-5.4a1 1 0 1 1 0-2h2.5l-3.8-3.8a1 1 0 0 1 1.4-1.4l3.8 3.8v-2.5a1 1 0 1 1 2 0V20a.5.5 0 0 1-.5.5Z" fill="currentColor"/>',
  "kucult":
    '<path d="M9.4 4a1 1 0 0 1 2 0v5.4a.5.5 0 0 1-.5.5H5.5a1 1 0 1 1 0-2H8L4.2 4.1a1 1 0 0 1 1.4-1.4l3.8 3.8V4Z" fill="currentColor"/>' +
    '<path d="M14.6 20a1 1 0 0 1-2 0v-5.4a.5.5 0 0 1 .5-.5h5.4a1 1 0 1 1 0 2H16l3.8 3.8a1 1 0 0 1-1.4 1.4l-3.8-3.8V20Z" fill="currentColor"/>',
  "ayar":
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M10.6 2.2h2.8a1 1 0 0 1 .98.8l.32 1.6a7.6 7.6 0 0 1 1.6.93l1.54-.52a1 1 0 0 1 1.19.46l1.4 2.42a1 1 0 0 1-.2 1.25l-1.22 1.07a7.7 7.7 0 0 1 0 1.86l1.22 1.07a1 1 0 0 1 .2 1.25l-1.4 2.42a1 1 0 0 1-1.19.46l-1.54-.52a7.6 7.6 0 0 1-1.6.93l-.32 1.6a1 1 0 0 1-.98.8h-2.8a1 1 0 0 1-.98-.8l-.32-1.6a7.6 7.6 0 0 1-1.6-.93l-1.54.52a1 1 0 0 1-1.19-.46l-1.4-2.42a1 1 0 0 1 .2-1.25l1.22-1.07a7.7 7.7 0 0 1 0-1.86L3.97 9.14a1 1 0 0 1-.2-1.25l1.4-2.42a1 1 0 0 1 1.19-.46l1.54.52a7.6 7.6 0 0 1 1.6-.93l.32-1.6ZM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z" fill="currentColor"/>',
  "kanal-metin":
    '<path d="M9.6 3.4a1 1 0 0 1 .8 1.16L9.9 8h4l.6-3.44a1 1 0 1 1 1.97.35L15.93 8H19a1 1 0 1 1 0 2h-3.42l-.7 4H18a1 1 0 1 1 0 2h-3.47l-.6 3.44a1 1 0 1 1-1.97-.35L12.5 16h-4l-.6 3.44a1 1 0 1 1-1.97-.35L6.47 16H3.4a1 1 0 1 1 0-2h3.42l.7-4H5a1 1 0 1 1 0-2h3.47l.6-3.44a1 1 0 0 1 1.16-.81Zm-.75 6.6-.7 4h4l.7-4h-4Z" fill="currentColor"/>',
  "kanal-ses":
    '<path d="M12.2 4.2 7.6 8H4.4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3.2l4.6 3.8a1 1 0 0 0 1.6-.8V5a1 1 0 0 0-1.6-.8Z" fill="currentColor"/>' +
    '<path d="M17.4 9a4.2 4.2 0 0 1 0 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  // Bolunmus dugmenin menu oku. Menu cubugun USTUNDE acildigi icin yukari bakar.
  "ok-yukari":
    '<path d="M11.2 8.4a1 1 0 0 1 1.6 0l4.6 6a1 1 0 0 1-.8 1.6H7.4a1 1 0 0 1-.8-1.6l4.6-6Z" fill="currentColor"/>',
} as const;

export type IkonAdi = keyof typeof IKONLAR;

export const IKON_ADLARI = Object.keys(IKONLAR) as IkonAdi[];
