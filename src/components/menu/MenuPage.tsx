// SPDX-License-Identifier: Apache-2.0
import { useState } from 'react'
import { Gift, Instagram, Languages, MapPin, MessageCircle, Music2, ShieldCheck } from 'lucide-react'
import { SECTIONS, scrollToSection, type MenuItem } from '@/data/menu'
import type { Loyalty } from '@/components/loyalty/useLoyalty'
import { useI18n, whatsappLink, WHATSAPP_DISPLAY, type Lang } from '@/lib/i18n'

interface Props {
  session: Loyalty
  onOpenLoyalty: () => void
}

export default function MenuPage({ session, onOpenLoyalty }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const { pick, lang, toggle } = useI18n()
  const points = session.customer?.pointsBalance
  const waHref = whatsappLink(
    pick(
      'مرحباً! أرغب بالاستفسار عن قائمة إيتاليانو باري.',
      'Hello! I would like to ask about the Italiano Bari menu.',
    ),
  )

  return (
    <div className="ib-shell">
      <div className="ib-app">
        <header className="ib-topbar">
          <button
            className="ib-lang-toggle"
            onClick={toggle}
            type="button"
            aria-label={pick('Switch to English', 'التبديل إلى العربية')}
          >
            <Languages size={15} aria-hidden />
            {pick('English', 'العربية')}
          </button>
          <a
            className="ib-topbar-wa"
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle size={15} aria-hidden />
            WhatsApp
          </a>
        </header>

        <div className="ib-hero">
          <img className="ib-logo" src="/menu/logo.png" alt="Italiano Bari logo" />
          <div className="ib-eyebrow">
            {pick('Trattoria • مطعم إيطالي', 'Trattoria • Italian Kitchen')}
          </div>
          <h1>Italiano Bari</h1>
          <div className="ib-ar-sub">{pick('قائمة الطعام', 'Our Menu')}</div>

          <button className="ib-loyalty-cta" onClick={onOpenLoyalty} type="button">
            <Gift size={20} />
            {session.isSignedIn ? (
              <>
                <span>{pick('نقاطي', 'My Points')}</span>
                <span className="ib-cta-points">
                  {(points ?? 0).toLocaleString('en-US')}
                </span>
              </>
            ) : (
              <>
                <span>{pick('برنامج المكافآت', 'Loyalty Program')}</span>
                <span className="ib-cta-sub">
                  {pick('سجّل واجمع النقاط', 'Sign up & earn points')}
                </span>
              </>
            )}
          </button>
        </div>

        <nav className="ib-cat-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} type="button" onClick={() => scrollToSection(s.id)}>
              {lang === 'ar' ? s.chip : s.chipEn}
            </button>
          ))}
        </nav>

        {SECTIONS.map((s, i) => (
          <div key={s.id}>
            {i > 0 && <div className="ib-gingham" />}
            <section className="ib-sec" id={s.id}>
              <h2 className="ib-sec-head">
                <span className="ar">{lang === 'ar' ? s.ar : s.en}</span>
                <span className="en">{lang === 'ar' ? s.en : s.ar}</span>
              </h2>

              {s.drinks
                ? s.drinks.map((d) => (
                    <div className="ib-drink-line" key={d.ar}>
                      <span>{lang === 'ar' ? d.ar : d.en}</span>
                      <span className="price">SR {d.price}</span>
                    </div>
                  ))
                : s.items?.map((item) => (
                    <ItemCard
                      key={item.enName}
                      item={item}
                      lang={lang}
                      onZoom={() => setLightbox({ src: item.img, alt: item.enName })}
                    />
                  ))}
            </section>
          </div>
        ))}

        <footer className="ib-footer">
          <div className="sig">Italiano Bari</div>
          <div className="tag">Buon Appetito</div>
          <div className="ib-footer-links">
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> WhatsApp
            </a>
                        <a
              href="https://maps.app.goo.gl/bSbbJE3dEfjpRJBa9"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin /> {pick('الموقع', 'Location')}
            </a>
            <a
              href="https://www.instagram.com/italianobari.sa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Instagram /> Instagram
            </a>
            <a
              href="https://www.tiktok.com/@italianobari.sa"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Music2 /> TikTok
            </a>
          </div>
          <div className="ib-footer-wa-number" dir="ltr">
            {WHATSAPP_DISPLAY}
          </div>
          <div style={{ marginTop: 22 }}>
            <button onClick={onOpenLoyalty} type="button" className="ib-footer-links" style={{ margin: '0 auto' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'transparent',
                  color: 'var(--basil)',
                  border: '1.5px solid var(--basil)',
                  borderRadius: 999,
                  padding: '9px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <Gift size={15} /> {pick('بطاقة الولاء', 'Loyalty Card')}
              </span>
            </button>
            
          </div>
        </footer>

        <a
          className="ib-wa-float"
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={pick('تواصل معنا على واتساب', 'Chat with us on WhatsApp')}
        >
          <MessageCircle size={22} aria-hidden />
        </a>
      </div>

      {lightbox && (
        <div className="ib-lightbox" onClick={() => setLightbox(null)}>
          <button
            className="ib-lightbox-close"
            onClick={(e) => {
              e.stopPropagation()
              setLightbox(null)
            }}
            aria-label="Close"
          >
            ×
          </button>
          <img src={lightbox.src} alt={lightbox.alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, lang, onZoom }: { item: MenuItem; lang: Lang; onZoom: () => void }) {
  const [open, setOpen] = useState(false)
  const desc = lang === 'ar' ? item.descAr : item.descEn

  return (
    <div className="ib-item">
      {item.badge ? (
        <div className="ib-thumb">
          <img src={item.img} alt={item.enName} onClick={onZoom} loading="lazy" />
          <span className="ib-badge">{item.badge}</span>
        </div>
      ) : (
        <img src={item.img} alt={item.enName} onClick={onZoom} loading="lazy" />
      )}

      <div className="info">
        <div className="ar-name">{lang === 'ar' ? item.arName : item.enName}</div>
        <div className="en-name">{lang === 'ar' ? item.enName : item.arName}</div>
        {item.note && <div className="note">{lang === 'ar' ? item.note : (item.noteEn ?? item.note)}</div>}

        {desc && (
          <>
            <div
              className="ib-desc"
              onClick={() => setOpen((v) => !v)}
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--grey)',
                marginTop: 4,
                cursor: 'pointer',
                ...(open
                  ? {}
                  : {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical' as const,
                      overflow: 'hidden',
                    }),
              }}
            >
              {desc}
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                marginTop: 2,
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--basil)',
                cursor: 'pointer',
              }}
            >
              {open ? (lang === 'ar' ? 'أقل' : 'Less') : lang === 'ar' ? 'المزيد' : 'More'}
            </button>
          </>
        )}

        <div className="price-row">
          {item.prices.map((p, i) => (
            <div className="ib-price-box" key={`${p.label ?? 'single'}-${i}`}>
              {p.label && (
                <div className="size-lbl">{lang === 'ar' ? p.label : (p.labelEn ?? p.label)}</div>
              )}
              <div className={`ib-pill${p.single ? ' single' : ''}`}>
                {p.old !== undefined && <span className="ib-old">{p.old}</span>}
                {p.value}
                {p.suffix ? ` ${p.suffix}` : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
