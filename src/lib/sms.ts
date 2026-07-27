/**
 * RestaurantOS — SMS doğrulama sağlayıcı yapılandırma kontrolü.
 *
 * Faz C: telefon doğrulaması gerçek bir SMS OTP sağlayıcısına (Netgsm,
 * İleti Merkezi, Twilio vb.) henüz BAĞLANMADI. O ana kadar hesap sayfasında
 * bir "geliştirme bypass" düğmesi telefonu kod göndermeden doğrulanmış
 * işaretler (bkz. /api/account/dev-verify-phone).
 *
 * Gerçek sağlayıcı eklenince: burada ilgili env değişkenini (ör.
 * SMS_PROVIDER_API_KEY) kontrol et. O andan itibaren bypass rotası otomatik
 * 403 döner ve UI'daki bypass düğmesi kendiliğinden kaybolur — kod
 * değişikliği gerekmez. Gerçek OTP gönderme/doğrulama akışını da o zaman
 * buraya (ve yeni bir /api/account/verify-phone rotasına) ekle.
 */
export function isPhoneVerificationConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER_API_KEY);
}
