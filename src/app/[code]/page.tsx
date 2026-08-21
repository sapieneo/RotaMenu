/**
 * Yeni kısa QR adresi: /{code}
 *
 * Asıl çözümleme, analitik ve bilgilendirme davranışı /q/{code} ile aynıdır.
 * Statik üst seviye rotalar (admin, studyo, giris vb.) Next.js tarafından bu
 * dinamik rotadan önce eşleştirilir. Eski /q/{code} adresi de korunur.
 */
export { default, dynamic, metadata } from '../q/[code]/page';
