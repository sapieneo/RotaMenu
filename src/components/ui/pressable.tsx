'use client';

/**
 * Pressable — basınca ANINDA tepki veren dokunma yüzeyi.
 *
 * NEDEN VAR (Apple §1 "Response"):
 * Geri bildirim `click`/parmak-kalkışında değil, parmak-BASIŞINDA gelmeli.
 * Kalkışı beklemek arayüzü ölü hissettirir; gecikme belirdiği an doğrudanlık
 * hissi "uçurumdan düşer". Uygulamada eskiden tek bir `:active` durumu bile
 * yoktu — her şey yalnızca `hover:` idi, yani dokunmatikte hiçbir basış
 * geri bildirimi yoktu.
 *
 * Ayrıca §10'daki jest ayrıntıları:
 *  - Parmağı öğeden dışarı kaydırınca basış İPTAL olur (pointercancel/leave).
 *  - Geri gelince tekrar basılı görünür.
 *  - `setPointerCapture` KULLANILMAZ: buton için parmağın dışarı kayması
 *    "vazgeçtim" demektir; yakalarsak iptal davranışını kaybederiz.
 *
 * Hareket azaltma (§14) otomatik: `prefers-reduced-motion` açıksa ölçek
 * animasyonu yerine yalnız opaklık değişir (globals.css'te yönetilir).
 */
import { forwardRef, useState, type ButtonHTMLAttributes } from 'react';

type PressableProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Basınca küçülme oranı. Büyük yüzeylerde daha az kullanılmalı. */
  scale?: number;
  /** Ölçek yerine yalnız hafif karartma — kart/satır gibi geniş yüzeyler için. */
  variant?: 'scale' | 'dim';
};

export const Pressable = forwardRef<HTMLButtonElement, PressableProps>(function Pressable(
  { scale = 0.97, variant = 'scale', className = '', style, children, disabled, ...rest },
  ref
) {
  const [pressed, setPressed] = useState(false);
  const active = pressed && !disabled;

  return (
    <button
      ref={ref}
      disabled={disabled}
      // Basış anında işaretle; kalkış, iptal ve dışarı kayma sıfırlar.
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      // Klavye kullanıcısı da aynı geri bildirimi görsün.
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setPressed(true);
        rest.onKeyDown?.(e);
      }}
      onKeyUp={(e) => {
        setPressed(false);
        rest.onKeyUp?.(e);
      }}
      onBlur={(e) => {
        setPressed(false);
        rest.onBlur?.(e);
      }}
      className={`ros-pressable ${className}`}
      style={{
        // Yalnız derleyici dostu özellikler (§11): transform + opacity.
        transform: active && variant === 'scale' ? `scale(${scale})` : undefined,
        opacity: active && variant === 'dim' ? 0.6 : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
});
