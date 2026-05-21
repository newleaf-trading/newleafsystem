import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSEO from '../../shared/components/PageSEO';

/* ─── colour tokens (match brand) ─── */
const C = {
  forest: '#0B2D23',
  gold:   '#C9A96E',
  cream:  '#F7F5F0',
  teal:   '#0d6e56',
  white:  '#fff',
  ink:    '#0B0F14',
  muted:  '#6b6b60',
  border: 'rgba(11,45,35,.10)',
  borderLight: 'rgba(11,45,35,.06)',
};

/* ─── font tokens ─── */
const F = {
  serif: "'Playfair Display', Georgia, serif",
  body:  "'Inter', 'DM Sans', sans-serif",
  mono:  "'Space Mono', monospace",
};

/* ─── tier data ─── */
const tiers = [
  {
    id: 'free',
    name: 'Explorer',
    price: { monthly: 0, annual: 0 },
    tagline: 'Get a feel for the system',
    cta: 'Get Started',
    ctaStyle: 'outline',
    accent: C.forest,
    features: [
      "Browse current week's picks (read-only)",
      '3 strategy tiles in Invest',
      'Static strategy pages (educational)',
      'Projection simulator',
      'All marketing & educational content',
    ],
  },
  {
    id: 'basic',
    name: 'Starter',
    price: { monthly: 29, annual: 290 },
    tagline: 'Unlock the full library',
    cta: 'Start Free Trial',
    ctaStyle: 'outline',
    accent: C.teal,
    features: [
      'Everything in Explorer',
      'Full picks history + weekly recap',
      '10 Invest tiles with payoff diagrams',
      'Workbench: Calendar, Projection',
      'Email: weekly picks summary',
    ],
  },
  {
    id: 'pro',
    name: 'Trader',
    price: { monthly: 69, annual: 690 },
    tagline: 'For active options traders',
    badge: 'MOST POPULAR',
    cta: 'Start Free Trial',
    ctaStyle: 'solid',
    accent: C.teal,
    highlight: true,
    features: [
      'Everything in Starter',
      'Unlimited Invest tiles with full Greeks',
      'Workbench: Scanner, Watchlist, Strategy Builder',
      'AI Discover: 5 verifications/day (NewLeaf-Plus)',
      'AI Strategy Tutor on skill pages',
      'AI Variant Ranking in Strategy Builder',
      'Weekly Picks AI Narrative',
      'Strike Comparison Cards',
      '3 PDF reports/week',
      'Real-time data',
    ],
  },
  {
    id: 'premium',
    name: 'Institutional',
    price: { monthly: 149, annual: 1490 },
    tagline: 'Maximum insight, zero limits',
    cta: 'Start Free Trial',
    ctaStyle: 'gold',
    accent: C.gold,
    features: [
      'Everything in Trader',
      'AI Discover: 25 verifications/day (NewLeaf-Max)',
      'AI Adjust: position risk management',
      'AI-powered live position verdicts',
      'Earnings & dividend risk alerts',
      'AI Chat assistant with portfolio awareness',
      'Unlimited PDF reports',
      'Priority email alerts with trade thesis',
      'API access (coming soon)',
    ],
  },
];

/* ─── FAQ data ─── */
const faqs = [
  {
    q: 'Is there a free trial for paid plans?',
    a: 'Yes. Every paid plan includes a 14-day free trial with full access. No credit card is required to start — just sign up and upgrade from your dashboard.',
  },
  {
    q: 'Can I switch plans or cancel anytime?',
    a: "Absolutely. You can upgrade, downgrade, or cancel at any time from your account settings. If you cancel a paid plan, you'll retain access until the end of your current billing period.",
  },
  {
    q: 'How does annual billing work?',
    a: "Annual billing is charged once per year at a 17% discount compared to monthly pricing. For example, the Pro plan is $69/mo monthly or $690/yr (equivalent to $57.50/mo). You can switch between monthly and annual billing at any time.",
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit and debit cards (Visa, Mastercard, Amex) through Stripe. All transactions are securely processed and PCI-compliant.',
  },
  {
    q: 'What happens when my trial ends?',
    a: "If you don't add a payment method, your account will revert to the free Explorer tier. You won't lose any saved data — you simply lose access to premium features until you subscribe.",
  },
  {
    q: 'Do you offer refunds?',
    a: "If you're not satisfied within the first 30 days of a paid subscription, contact us at support@newleafsystem.com and we'll issue a full refund — no questions asked.",
  },
];

/* ────────────────────────────────────────────
   Checkmark icon
   ──────────────────────────────────────────── */
function Check({ color = C.teal }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ────────────────────────────────────────────
   Billing toggle
   ──────────────────────────────────────────── */
function BillingToggle({ annual, onToggle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 48 }}>
      <span style={{
        fontFamily: F.body, fontSize: 14, fontWeight: annual ? 500 : 700,
        color: annual ? C.muted : C.ink, transition: 'all .2s',
      }}>
        Monthly
      </span>
      <button
        onClick={onToggle}
        aria-label="Toggle annual billing"
        style={{
          position: 'relative', width: 52, height: 28, borderRadius: 14,
          background: annual ? C.teal : 'rgba(11,45,35,.18)',
          border: 'none', cursor: 'pointer', transition: 'background .25s',
          padding: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: annual ? 27 : 3,
          width: 22, height: 22, borderRadius: 11, background: C.white,
          boxShadow: '0 1px 4px rgba(0,0,0,.18)',
          transition: 'left .25s cubic-bezier(.4,0,.2,1)',
        }} />
      </button>
      <span style={{
        fontFamily: F.body, fontSize: 14, fontWeight: annual ? 700 : 500,
        color: annual ? C.ink : C.muted, transition: 'all .2s',
      }}>
        Annual
      </span>
      <span style={{
        fontFamily: F.mono, fontSize: 11, fontWeight: 600,
        color: C.teal, background: 'rgba(13,110,86,.08)',
        padding: '3px 10px', borderRadius: 20,
      }}>
        Save 17%
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────
   Single pricing card
   ──────────────────────────────────────────── */
function TierCard({ tier, annual }) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();
  const price = annual ? tier.price.annual : tier.price.monthly;
  const isHighlight = tier.highlight;
  const isGold = tier.ctaStyle === 'gold';

  const cardBg = isHighlight ? C.forest : C.white;
  const textPrimary = isHighlight ? C.white : C.ink;
  const textSecondary = isHighlight ? 'rgba(255,255,255,.65)' : C.muted;
  const featureText = isHighlight ? 'rgba(255,255,255,.85)' : '#374151';
  const checkColor = isHighlight ? '#5eead4' : (isGold ? C.gold : C.teal);
  const borderColor = isHighlight
    ? 'rgba(201,169,110,.35)'
    : hovered ? 'rgba(11,45,35,.18)' : C.border;

  /* CTA button style */
  let btnBg, btnColor, btnBorder, btnHoverBg;
  if (tier.ctaStyle === 'solid') {
    btnBg = C.gold;
    btnColor = C.forest;
    btnBorder = C.gold;
    btnHoverBg = '#d4b87a';
  } else if (tier.ctaStyle === 'gold') {
    btnBg = 'transparent';
    btnColor = C.gold;
    btnBorder = C.gold;
    btnHoverBg = 'rgba(201,169,110,.1)';
  } else {
    btnBg = 'transparent';
    btnColor = isHighlight ? C.white : C.forest;
    btnBorder = isHighlight ? 'rgba(255,255,255,.35)' : C.forest;
    btnHoverBg = isHighlight ? 'rgba(255,255,255,.08)' : 'rgba(11,45,35,.04)';
  }

  const handleCta = () => {
    if (tier.id === 'free') {
      navigate('/#signup');
    } else {
      navigate('/#signup');
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: cardBg,
        borderRadius: 16,
        border: `1.5px solid ${borderColor}`,
        padding: '32px 28px 28px',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all .3s cubic-bezier(.4,0,.2,1)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        boxShadow: isHighlight
          ? (hovered
              ? '0 24px 48px rgba(11,45,35,.22), 0 0 0 1px rgba(201,169,110,.20)'
              : '0 16px 40px rgba(11,45,35,.18), 0 0 0 1px rgba(201,169,110,.12)')
          : (hovered
              ? '0 16px 40px rgba(11,45,35,.10)'
              : '0 4px 20px rgba(11,45,35,.05)'),
      }}
    >
      {/* Most Popular badge */}
      {tier.badge && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          fontFamily: F.mono, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
          color: C.forest, background: C.gold, padding: '5px 16px', borderRadius: 20,
          whiteSpace: 'nowrap',
        }}>
          {tier.badge}
        </div>
      )}

      {/* Tier name */}
      <div style={{
        fontFamily: F.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: isHighlight ? C.gold : tier.accent,
        marginBottom: 4,
      }}>
        {tier.name}
      </div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
        <span style={{
          fontFamily: F.serif, fontSize: 44, fontWeight: 700, color: textPrimary,
          lineHeight: 1.1,
        }}>
          {price === 0 ? '$0' : `$${price}`}
        </span>
        {price > 0 && (
          <span style={{
            fontFamily: F.body, fontSize: 14, color: textSecondary, fontWeight: 500,
          }}>
            /{annual ? 'yr' : 'mo'}
          </span>
        )}
      </div>

      {/* Annual equivalent */}
      {annual && tier.price.monthly > 0 && (
        <div style={{
          fontFamily: F.body, fontSize: 12, color: textSecondary, marginBottom: 4,
        }}>
          ${(tier.price.annual / 12).toFixed(2)}/mo equivalent
        </div>
      )}

      {/* Free label */}
      {price === 0 && (
        <div style={{ fontFamily: F.body, fontSize: 13, color: textSecondary, marginBottom: 4 }}>
          Free forever
        </div>
      )}

      {/* Tagline */}
      <div style={{
        fontFamily: F.body, fontSize: 14, color: textSecondary,
        lineHeight: 1.5, marginBottom: 24, minHeight: 21,
      }}>
        {tier.tagline}
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: isHighlight ? 'rgba(255,255,255,.12)' : C.borderLight,
        marginBottom: 24,
      }} />

      {/* Features */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1 }}>
        {tier.features.map((feat, i) => (
          <li key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            marginBottom: 14,
          }}>
            <Check color={checkColor} />
            <span style={{
              fontFamily: F.body, fontSize: 13, color: featureText,
              lineHeight: 1.5,
            }}>
              {feat}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={handleCta}
        style={{
          marginTop: 24, width: '100%', padding: '13px 20px',
          fontFamily: F.body, fontSize: 14, fontWeight: 600,
          color: btnColor, background: btnBg,
          border: `1.5px solid ${btnBorder}`,
          borderRadius: 10, cursor: 'pointer',
          transition: 'all .2s',
          ...(hovered ? { background: btnHoverBg } : {}),
        }}
      >
        {tier.cta}
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────
   FAQ accordion item
   ──────────────────────────────────────────── */
function FaqItem({ item, open, onToggle }) {
  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      padding: '20px 0',
    }}>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: 0, textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: F.body, fontSize: 15, fontWeight: 600, color: C.ink,
          lineHeight: 1.5, paddingRight: 16,
        }}>
          {item.q}
        </span>
        <span style={{
          fontFamily: F.body, fontSize: 20, color: C.muted,
          transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform .25s', flexShrink: 0,
          lineHeight: 1, width: 24, textAlign: 'center',
        }}>
          +
        </span>
      </button>
      <div style={{
        maxHeight: open ? 200 : 0, overflow: 'hidden',
        transition: 'max-height .3s ease',
      }}>
        <p style={{
          fontFamily: F.body, fontSize: 14, color: C.muted,
          lineHeight: 1.7, marginTop: 12, marginBottom: 0,
        }}>
          {item.a}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PRICING PAGE
   ════════════════════════════════════════════ */
export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ background: C.cream, minHeight: '100vh' }}>
      <PageSEO
        title="Pricing — NewLeaf System"
        description="Transparent pricing for NewLeaf System. Free explorer tier, plus Starter, Trader, and Institutional plans for serious options traders. 14-day free trial on all paid plans."
        path="/pricing"
      />

      {/* ─── Hero ─── */}
      <section style={{
        textAlign: 'center', paddingTop: 72, paddingBottom: 16,
        maxWidth: 680, margin: '0 auto',
        paddingLeft: 24, paddingRight: 24,
      }}>
        <div style={{
          fontFamily: F.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.teal, marginBottom: 16,
        }}>
          Pricing
        </div>
        <h1 style={{
          fontFamily: F.serif, fontSize: 40, fontWeight: 700,
          color: C.forest, lineHeight: 1.2, marginBottom: 16, margin: '0 auto 16px',
        }}>
          One system, four tiers.{' '}
          <em style={{ fontStyle: 'italic', color: C.teal }}>Pick yours.</em>
        </h1>
        <p style={{
          fontFamily: F.body, fontSize: 16, color: C.muted,
          lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px',
        }}>
          Start free and upgrade when you need more. Every paid plan includes a
          14-day free trial — no credit card required.
        </p>

        <BillingToggle annual={annual} onToggle={() => setAnnual(!annual)} />
      </section>

      {/* ─── Cards grid ─── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 24px 80px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
          alignItems: 'start',
        }}>
          {tiers.map(t => (
            <TierCard key={t.id} tier={t} annual={annual} />
          ))}
        </div>

        {/* ─── Responsive override via inline <style> ─── */}
        <style>{`
          @media (max-width: 1080px) {
            section > div[style*="grid-template-columns: repeat(4"] {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 640px) {
            section > div[style*="grid-template-columns: repeat(4"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>

      {/* ─── Trust strip ─── */}
      <section style={{
        background: C.white, borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`, padding: '36px 24px',
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'flex', justifyContent: 'center', gap: 48, flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          {[
            { icon: '🔒', label: 'Secure payments via Stripe' },
            { icon: '🚫', label: 'No credit card for trial' },
            { icon: '↩️', label: '30-day money-back guarantee' },
            { icon: '⚡', label: 'Cancel anytime, instantly' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{
                fontFamily: F.body, fontSize: 13, fontWeight: 600,
                color: C.muted,
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Plan comparison hint ─── */}
      <section style={{
        maxWidth: 720, margin: '0 auto', padding: '72px 24px 0',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: F.mono, fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
          textTransform: 'uppercase', color: C.teal, marginBottom: 16,
        }}>
          Not sure which plan?
        </div>
        <h2 style={{
          fontFamily: F.serif, fontSize: 28, fontWeight: 700,
          color: C.forest, lineHeight: 1.3, marginBottom: 16,
        }}>
          Start with Explorer, upgrade anytime.
        </h2>
        <p style={{
          fontFamily: F.body, fontSize: 15, color: C.muted,
          lineHeight: 1.7, maxWidth: 540, margin: '0 auto 0',
        }}>
          Most traders start free, explore the picks and strategy pages, then upgrade to
          Starter or Trader when they want full workbench access and real-time data.
        </p>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{
        maxWidth: 680, margin: '0 auto', padding: '56px 24px 96px',
      }}>
        <h2 style={{
          fontFamily: F.serif, fontSize: 26, fontWeight: 700,
          color: C.forest, textAlign: 'center', marginBottom: 36,
        }}>
          Frequently asked questions
        </h2>
        {faqs.map((item, i) => (
          <FaqItem
            key={i}
            item={item}
            open={openFaq === i}
            onToggle={() => setOpenFaq(openFaq === i ? null : i)}
          />
        ))}
      </section>
    </div>
  );
}
