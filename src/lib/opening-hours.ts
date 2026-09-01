import { z } from 'zod';

/**
 * Yapısal çalışma saatleri.
 *
 * NEDEN: `venues.opening_hours` serbest metindi ("Her gün 12:00–24:00").
 * Misafir menüsünde "bugün 09:00–23:00 açık" yazabilmek için gün gün veri
 * gerekiyor (müşteri talebi A3). Eski serbest metin kolonu duruyor; yapısal
 * alan boşsa ona düşülüyor, yani mevcut mekanlar bozulmuyor.
 *
 * Gün numaraları ISO-8601: 1 = Pazartesi … 7 = Pazar.
 */

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const dayHoursSchema = z.object({
  day: z.number().int().min(1).max(7),
  closed: z.boolean().default(false),
  open: z.string().regex(TIME, 'SS:DD biçiminde olmalı').nullish(),
  close: z.string().regex(TIME, 'SS:DD biçiminde olmalı').nullish(),
});

export const weeklyHoursSchema = z.array(dayHoursSchema).max(7);

export type DayHours = z.infer<typeof dayHoursSchema>;
export type WeeklyHours = DayHours[];

export const DAY_NAMES_TR = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
export const DAY_NAMES_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Boş bir hafta — ayarlar formunun başlangıç değeri. */
export function emptyWeek(): WeeklyHours {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, closed: false, open: null, close: null }));
}

/** DB'den gelen jsonb'yi güvenle çözer. Geçersizse null. */
export function parseWeeklyHours(value: unknown): WeeklyHours | null {
  if (!value) return null;
  const parsed = weeklyHoursSchema.safeParse(value);
  if (!parsed.success || parsed.data.length === 0) return null;
  // En az bir günde gerçek bilgi yoksa "tanımlı değil" say.
  const meaningful = parsed.data.some((d) => d.closed || (d.open && d.close));
  return meaningful ? parsed.data : null;
}

/**
 * Mekanın yerel saatine göre ISO gün numarası (1–7).
 *
 * NEDEN mekanın saati: misafir yurt dışından bakıyor olabilir; "bugün" mekanın
 * takvimine göre olmalı. Sunucu tarafında render edildiğimiz için sunucunun
 * saat dilimine de güvenemeyiz — bu yüzden Intl ile açıkça hesaplıyoruz.
 */
export function isoDayInZone(now: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(now);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[short] ?? 1;
}

/** Mekanın yerel saatine göre "dakika cinsinden gün içi an" (0–1439). */
export function minutesOfDayInZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hh * 60 + mm;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export type TodayStatus = {
  /** "09:00 – 23:00" ya da null (kapalı / tanımsız) */
  range: string | null;
  closed: boolean;
  /** Şu an açık mı? Saat bilgisi yoksa null. */
  openNow: boolean | null;
  dayIndex: number;
};

/**
 * Bugünün durumunu hesaplar.
 *
 * Gece yarısını aşan saatler (ör. 18:00 – 02:00) destekleniyor: kapanış açılıştan
 * küçükse aralık ertesi güne taşar. Bar/meyhanede bu kural.
 */
export function todayStatus(
  hours: WeeklyHours | null,
  now: Date,
  timeZone = 'Europe/Istanbul'
): TodayStatus | null {
  if (!hours) return null;
  const dayIndex = isoDayInZone(now, timeZone);
  const today = hours.find((d) => d.day === dayIndex);
  if (!today) return null;

  if (today.closed || !today.open || !today.close) {
    return { range: null, closed: true, openNow: false, dayIndex };
  }

  const nowMin = minutesOfDayInZone(now, timeZone);
  const openMin = toMinutes(today.open);
  const closeMin = toMinutes(today.close);
  const overnight = closeMin <= openMin;
  const openNow = overnight
    ? nowMin >= openMin || nowMin < closeMin
    : nowMin >= openMin && nowMin < closeMin;

  return {
    range: `${today.open} – ${today.close}`,
    closed: false,
    openNow,
    dayIndex,
  };
}

/** Tüm hafta listesi — misafir menüsündeki "tüm hafta" panelinde gösterilir. */
export function weekRows(
  hours: WeeklyHours | null,
  locale: 'tr' | 'en' = 'tr'
): { day: number; name: string; text: string; closed: boolean }[] {
  if (!hours) return [];
  const names = locale === 'tr' ? DAY_NAMES_TR : DAY_NAMES_EN;
  const closedLabel = locale === 'tr' ? 'Kapalı' : 'Closed';
  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const d = hours.find((x) => x.day === day);
    const closed = !d || d.closed || !d.open || !d.close;
    return {
      day,
      name: names[day],
      text: closed ? closedLabel : `${d!.open} – ${d!.close}`,
      closed,
    };
  });
}
