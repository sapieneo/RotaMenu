/**
 * RestaurantOS — Hareket temeli (Apple "Designing Fluid Interfaces" uyarlaması).
 *
 * TEK KAYNAK: yay değerleri burada tanımlanır, bileşenlerde elle sayı yazılmaz.
 *
 * NEDEN YAY, NEDEN CSS TRANSITION DEĞİL:
 * Sabit süreli bir CSS transition yolun ortasında yakalanamaz — kullanıcı
 * kapanmakta olan bir sheet'i tutup geri çekmek istediğinde animasyon önce
 * bitmek zorunda kalır, sonra ters yöne başlar. Bu "duvara çarpma" hissi verir.
 * Yaylar her zaman ANLIK ekran değerinden başlar ve hedefleri değişince
 * hızlarını koruyarak yeni hedefe döner. Jestle sürülen her şey yay olmalı.
 *
 * APPLE'IN İKİ PARAMETRESİ → MOTION KARŞILIĞI
 *   damping ratio  → `bounce`   (damping 1.0 = bounce 0 = hiç aşmaz)
 *   response (sn)  → `duration` (Motion'da "algılanan süre", sabit süre DEĞİL)
 *
 * KURAL: varsayılan her yer `bounce: 0` (kritik sönümlü). Sıçrama YALNIZ
 * jestin kendisi momentum taşıdıysa eklenir (fiske, sürükleyip bırakma).
 * Sadece belirip kaybolan bir menüde sıçrama yanlış hissettirir.
 */
import type { Transition } from 'motion/react';

/** Apple'ın yayınladığı somut değerler (bkz. WWDC 2018 tablosu). */
export const SPRING = {
  /** Varsayılan arayüz hareketi — konum değişimi, açılma/kapanma. */
  default: { type: 'spring', bounce: 0, duration: 0.4 },
  /** Daha kısa yol / küçük öğe — aynı his, biraz daha çevik. */
  snappy: { type: 'spring', bounce: 0, duration: 0.3 },
  /** Çekmece / sheet — Apple: damping 0.8, response 0.3. */
  sheet: { type: 'spring', bounce: 0.18, duration: 0.34 },
  /** Momentum sonrası (fiske ile fırlatılmış) — hafif aşma doğru hissettirir. */
  momentum: { type: 'spring', bounce: 0.22, duration: 0.4 },
} satisfies Record<string, Transition>;

/** Hareketin uygun olmadığı durumlarda kullanılacak çapraz geçiş. */
export const CROSSFADE: Transition = { duration: 0.2, ease: 'easeOut' };

/**
 * Apple'ın momentum projeksiyonu (Designing Fluid Interfaces örnek kodu).
 *
 * Fiske ile bırakılan bir öğeyi BIRAKILDIĞI yere en yakın noktaya değil,
 * hızın onu GÖTÜRECEĞİ yere en yakın noktaya oturtmak için. Kaydırma
 * yavaşlamasıyla aynı eğri.
 *
 * DİKKAT: ders kitabındaki v²/(2a) formülü DEĞİL — Apple üstel sönüm kullanır.
 *
 * @param velocity px/sn cinsinden bırakma hızı
 * @param decelerationRate 0.998 normal kaydırma hissi, 0.99 daha çevik
 * @returns mevcut konuma EKLENECEK mesafe (px)
 */
export function projectMomentum(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/**
 * Lastik bant direnci — sınırın ötesine sürüklendikçe öğe parmağı gitgide
 * daha az takip eder. Sert duruş "donmuş" okunur; artan direnç "tepki
 * veriyor ama burada devamı yok" okunur.
 *
 * @param overshoot sınırın ne kadar ötesine geçildi (px)
 * @param dimension referans boyut (genelde öğenin yüksekliği/genişliği)
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Jest bırakıldığında: kapatmalı mı, geri mi dönmeli?
 *
 * Apple'ın kuralı: kararı KONUMA değil HIZIN İŞARETİNE bak. Kullanıcı öğeyi
 * çok az sürüklemiş olsa bile hızlı bir fiske "kapat" demektir; tersine yavaşça
 * yarıdan fazla çekip durmuşsa hâlâ kararsızdır ve konum belirleyici olur.
 *
 * @param offset bırakma anındaki yer değiştirme (px, pozitif = kapanma yönü)
 * @param velocity bırakma hızı (px/sn, pozitif = kapanma yönü)
 * @param size öğenin kapanma eksenindeki boyutu
 */
export function shouldDismiss(offset: number, velocity: number, size: number): boolean {
  // Belirgin bir fiske tek başına yeter — konuma bakma.
  if (velocity > 500) return true;
  if (velocity < -500) return false;
  // Kararsız bırakma: projeksiyonla nereye gideceğine bak.
  return offset + projectMomentum(velocity) > size * 0.4;
}
