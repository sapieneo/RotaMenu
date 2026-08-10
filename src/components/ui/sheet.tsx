'use client';

/**
 * Sheet — sürüklenebilir alt sayfa / ortalanmış diyalog.
 *
 * Uygulamadaki TÜM modal yüzeyleri (ürün detayı, kategori listesi, görsel
 * büyütme) bunu kullanır; böylece hepsi aynı fiziği paylaşır.
 *
 * APPLE PRENSİPLERİ VE BURADA NASIL KARŞILANDIĞI
 *
 * §2 Doğrudan manipülasyon — parmak 1:1 takip edilir. Motion'ın `drag="y"`
 *    özelliği zaten yakalama (pointer capture) yapar ve tutulan noktanın
 *    offset'ini korur; öğe merkeze zıplamaz.
 *
 * §3 Kesilebilirlik — EN ÖNEMLİ KURAL. Kapanmakta olan sheet yolun ortasında
 *    yakalanıp geri çekilebilir. Bu, CSS transition ile MÜMKÜN DEĞİL; yay
 *    her zaman anlık ekran değerinden devam ettiği için mümkün oluyor.
 *
 * §5 Hız devri — `dragMomentum` yerine bırakma hızını yaya `velocity` olarak
 *    veriyoruz; sürükleme ile animasyon arasında görünür bir dikiş kalmıyor.
 *
 * §6 Momentum projeksiyonu — kapatma kararı bırakma KONUMUNA değil, hızın
 *    öğeyi götüreceği YERE bakılarak veriliyor (bkz. lib/motion.ts).
 *
 * §7 Mekânsal tutarlılık — nereden geldiyse oraya gider. Alttan gelen alta,
 *    ortada beliren yerinde küçülerek kapanır.
 *
 * §9 Lastik bant — yukarı doğru (kapatma yönünün tersi) sürükleme artan
 *    dirençle karşılanır; sert duruş yerine "burada devamı yok" hissi.
 *
 * §14 Azaltılmış hareket — `prefers-reduced-motion` açıksa sürükleme kapanır
 *    ve giriş/çıkış kısa bir çapraz geçişe iner.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { CROSSFADE, SPRING, shouldDismiss } from '@/lib/motion';

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Erişilebilir ad — ekran okuyucu bunu duyurur. */
  label: string;
  /**
   * 'bottom' = mobilde alttan gelen çekmece (geniş ekranda ortalanır).
   * 'center' = her boyutta ortalanmış diyalog (ör. görsel büyütme).
   */
  placement?: 'bottom' | 'center';
  /** Panelin kendi sınıfları — yüzey rengi/köşe çağıran tarafta belirlenir. */
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  /** Üstteki tutamak çizgisi (alt çekmecelerde sürüklenebilirliği duyurur). */
  showHandle?: boolean;
};

export function Sheet({
  open,
  onClose,
  children,
  label,
  placement = 'bottom',
  panelClassName = '',
  panelStyle,
  showHandle = placement === 'bottom',
}: SheetProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Esc + odak tuzağı + odağı açan öğeye geri verme (§16 "asla hapsetme").
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const height = panelRef.current?.offsetHeight ?? 400;
    // Karar KONUMA değil, hızın işaretine + projeksiyona bakar (§6).
    if (shouldDismiss(info.offset.y, info.velocity.y, height)) onClose();
    // Kapanmıyorsa Motion zaten dragConstraints ile 0'a yaylanır —
    // ayrıca animate çağırmıyoruz ki hız sürekliliği bozulmasın.
  }

  const isBottom = placement === 'bottom';
  const draggable = isBottom && !reduceMotion;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 z-50 flex justify-center ${isBottom ? 'items-end sm:items-center' : 'items-center'} p-0 ${isBottom ? '' : 'p-4'}`}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onClick={onClose}
          // Perde: modal görev olduğu için karartma var (§12 "odaklamak için karart").
          initial={{ backgroundColor: 'rgba(0,0,0,0)' }}
          animate={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          exit={{ backgroundColor: 'rgba(0,0,0,0)' }}
          transition={CROSSFADE}
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <motion.div
            ref={panelRef}
            onClick={(e) => e.stopPropagation()}
            className={panelClassName}
            style={panelStyle}
            // §7: geldiği yoldan gider. Alttan gelen alta iner; ortadaki
            // yerinde ölçeklenir — çıkışta ters yol izlenmez.
            initial={
              reduceMotion
                ? { opacity: 0 }
                : isBottom
                ? { y: '100%', opacity: 1 }
                : { opacity: 0, scale: 0.96 }
            }
            animate={reduceMotion ? { opacity: 1 } : isBottom ? { y: 0 } : { opacity: 1, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : isBottom
                ? { y: '100%' }
                : { opacity: 0, scale: 0.96 }
            }
            transition={reduceMotion ? CROSSFADE : isBottom ? SPRING.sheet : SPRING.snappy}
            drag={draggable ? 'y' : false}
            // Yukarı sürüklemeye izin yok (üst sınır 0) ama sert durmasın diye
            // elastik direnç veriyoruz — §9 lastik bant.
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.9 }}
            // Motion'ın kendi atalet animasyonunu kapatıyoruz; kapatma/geri
            // dönme kararını biz veriyoruz (§6) ve yayı biz seçiyoruz (§4).
            dragMomentum={false}
            onDragEnd={handleDragEnd}
          >
            {showHandle && (
              <div className="flex justify-center pb-1 pt-2.5" aria-hidden>
                {/* Tutamak: bu yüzeyin sürüklenebilir olduğunu söyleyen tek işaret. */}
                <span className="h-1 w-9 rounded-full bg-current opacity-25" />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
