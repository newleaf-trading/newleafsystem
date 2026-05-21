/**
 * Design Tokens for NewLeaf System
 * Institutional-grade Portfolio Income OS
 */

export const tokens = {
  // Primary Colors
  colors: {
    primaryGreen: '#0B2D23',
    softGold: '#C9A96E',
    background: '#F7F8FA',
    text: '#111827',
    mutedText: 'rgba(17, 24, 39, 0.68)',
    mutedText2: 'rgba(17, 24, 39, 0.55)',
    border: 'rgba(17, 24, 39, 0.10)',
    cardBg: '#FFFFFF',

    // Semantic Colors
    success: '#0B7A52',
    successLight: 'rgba(11, 122, 82, 0.10)',
    successBorder: 'rgba(11, 122, 82, 0.20)',

    warn: '#B7791F',
    warnLight: 'rgba(183, 121, 31, 0.10)',
    warnBorder: 'rgba(183, 121, 31, 0.20)',

    danger: '#C94F4F',
    dangerLight: 'rgba(201, 79, 79, 0.10)',
    dangerBorder: 'rgba(201, 79, 79, 0.20)',

    info: '#2563EB',
    infoLight: 'rgba(37, 99, 235, 0.10)',
    infoBorder: 'rgba(37, 99, 235, 0.20)',

    // Component-specific
    segmentedInactiveBg: '#FFFFFF',
    segmentedActiveBg: 'rgba(11, 45, 35, 0.08)',
    segmentedActiveText: 'rgba(11, 45, 35, 0.95)',
    segmentedActiveBorder: 'rgba(11, 45, 35, 0.18)',
  },

  // Border Radii
  radii: {
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '22px',
    pill: '999px',
  },

  // Shadows
  shadows: {
    sm: '0 4px 12px rgba(17, 24, 39, 0.06)',
    md: '0 10px 24px rgba(17, 24, 39, 0.08)',
    lg: '0 18px 44px rgba(17, 24, 39, 0.10)',
    card: '0 10px 20px rgba(17, 24, 39, 0.06)',
  },

  // Typography
  typography: {
    pageH1: {
      fontSize: '28px',
      fontWeight: '900',
      letterSpacing: '-0.6px',
      lineHeight: '1.2',
    },
    sectionH2: {
      fontSize: '20px',
      fontWeight: '900',
      letterSpacing: '-0.2px',
      lineHeight: '1.3',
    },
    sectionH3: {
      fontSize: '18px',
      fontWeight: '900',
      letterSpacing: '-0.1px',
      lineHeight: '1.4',
    },
    metaLabel: {
      fontSize: '11px',
      fontWeight: '900',
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
    },
    body: {
      fontSize: '14px',
      fontWeight: '500',
      lineHeight: '1.6',
    },
    bodySmall: {
      fontSize: '12px',
      fontWeight: '500',
      lineHeight: '1.5',
    },
  },

  // Spacing
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
  },
};

// CSS Custom Properties Generator
export const generateCSSVariables = () => {
  return `
    :root {
      /* Colors */
      --nl-primary-green: ${tokens.colors.primaryGreen};
      --nl-soft-gold: ${tokens.colors.softGold};
      --nl-bg: ${tokens.colors.background};
      --nl-text: ${tokens.colors.text};
      --nl-muted-text: ${tokens.colors.mutedText};
      --nl-muted-text-2: ${tokens.colors.mutedText2};
      --nl-border: ${tokens.colors.border};
      --nl-card-bg: ${tokens.colors.cardBg};

      --nl-success: ${tokens.colors.success};
      --nl-success-light: ${tokens.colors.successLight};
      --nl-success-border: ${tokens.colors.successBorder};

      --nl-warn: ${tokens.colors.warn};
      --nl-warn-light: ${tokens.colors.warnLight};
      --nl-warn-border: ${tokens.colors.warnBorder};

      --nl-danger: ${tokens.colors.danger};
      --nl-danger-light: ${tokens.colors.dangerLight};
      --nl-danger-border: ${tokens.colors.dangerBorder};

      --nl-info: ${tokens.colors.info};
      --nl-info-light: ${tokens.colors.infoLight};
      --nl-info-border: ${tokens.colors.infoBorder};

      /* Shadows */
      --nl-shadow-sm: ${tokens.shadows.sm};
      --nl-shadow-md: ${tokens.shadows.md};
      --nl-shadow-lg: ${tokens.shadows.lg};
      --nl-shadow-card: ${tokens.shadows.card};

      /* Border Radii */
      --nl-radius-sm: ${tokens.radii.sm};
      --nl-radius-md: ${tokens.radii.md};
      --nl-radius-lg: ${tokens.radii.lg};
      --nl-radius-xl: ${tokens.radii.xl};
      --nl-radius-pill: ${tokens.radii.pill};
    }
  `;
};
