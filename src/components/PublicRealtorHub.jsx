import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Wrench,
  Wind,
  Truck,
  Sparkles,
  Phone,
  Globe,
  Share2,
  Download,
  Check,
  Copy,
  Heart,
  Home,
  MessageSquare,
  ExternalLink,
  X,
  Smartphone,
  ChevronRight,
  Bookmark,
  Mail,
  MapPin,
  Video,
} from 'lucide-react';

const normalizeUrl = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const getFirstName = (name = '') => String(name || '').trim().split(/\s+/)[0] || 'Your Realtor';

const getInitials = (name = '') => {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'CR';
};

const phoneForHref = (value = '') => String(value || '').replace(/[^\d+]/g, '');

const normalizeInternalPlan = (value) => {
  const plan = String(value || 'partner').toLowerCase();
  if (plan === 'free' || plan === 'partner') return 'partner';
  if (plan === 'core' || plan === 'pro') return 'pro';
  if (plan === 'premier') return 'premier';
  return 'partner';
};

const getYouTubeVideoId = (value = '') => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') || '';
      } else if (['shorts', 'embed', 'live'].includes(parts[0])) {
        videoId = parts[1] || '';
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : '';
  } catch {
    return '';
  }
};


const normalizeRecurrenceMonths = (value) => {
  const months = Number.parseInt(value, 10);
  return Number.isFinite(months) && months > 0 ? months : null;
};

const getRecurrenceLabel = (months) => {
  if (!months) return '';
  if (months === 1) return 'Every month';
  if (months === 12) return 'Every year';
  return `Every ${months} months`;
};

const addMonthsClamped = (dateValue, months) => {
  const source = new Date(dateValue);
  if (!months || Number.isNaN(source.getTime())) return null;

  const result = new Date(source);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
};

const formatChecklistDate = (dateValue) => {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const getVendorIcon = (category = '') => {
  const normalized = String(category || '').toLowerCase();
  if (normalized.includes('security') || normalized.includes('smart')) return ShieldCheck;
  if (normalized.includes('lock') || normalized.includes('rekey')) return KeyRound;
  if (normalized.includes('plumb') || normalized.includes('water')) return Wrench;
  if (normalized.includes('hvac') || normalized.includes('heat') || normalized.includes('air')) return Wind;
  if (normalized.includes('mov') || normalized.includes('relocat')) return Truck;
  if (normalized.includes('clean')) return Sparkles;
  return Home;
};

export default function PublicRealtorHub({ profile, fallbackResources = [] }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [checklistCompletionDates, setChecklistCompletionDates] = useState({});

  const realtorName = profile?.full_name || 'Your Realtor';
  const firstName = getFirstName(realtorName);
  const brokerage = profile?.brokerage || 'Independent Real Estate';
  const city = profile?.city || profile?.market_city || '';
  const email = profile?.email || '';
  const phone = profile?.phone || profile?.phone_number || profile?.mobile || '';
  const rawPhone = phoneForHref(phone);
  const headshotUrl =
    profile?.headshot_url ||
    profile?.profile_image_url ||
    profile?.photo_url ||
    profile?.image_url ||
    '';
  const welcomeMessage =
    profile?.welcome_message ||
    profile?.welcome ||
    'Congratulations on your new home! To make settling in simple and stress-free, I created this guide with resources I want you to have long after closing day.';
  const bio = profile?.bio || '';
  const websiteUrl = normalizeUrl(profile?.website_url || profile?.website || '');
  const internalPlan = normalizeInternalPlan(profile?.plan);
  const welcomeVideoId = internalPlan === 'premier'
    ? getYouTubeVideoId(profile?.welcome_video_url || '')
    : '';
  const welcomeVideoEmbedUrl = welcomeVideoId
    ? `https://www.youtube-nocookie.com/embed/${welcomeVideoId}?rel=0`
    : '';

  const socialLinks = [
    { label: 'Instagram', url: normalizeUrl(profile?.instagram_url || '') },
    { label: 'Facebook', url: normalizeUrl(profile?.facebook_url || '') },
    { label: 'LinkedIn', url: normalizeUrl(profile?.linkedin_url || '') },
  ].filter((item) => item.url);

  const storedVendors = Array.isArray(profile?.vendors)
    ? profile.vendors
    : Array.isArray(profile?.preferred_vendors)
      ? profile.preferred_vendors
      : [];

  const resources = useMemo(() => {
    if (storedVendors.length > 0) {
      return storedVendors.map((vendor, index) => ({
        id: vendor?.id || `${vendor?.name || 'vendor'}-${index}`,
        category: vendor?.category || 'Trusted Professional',
        name: vendor?.name || 'Preferred Professional',
        quote: vendor?.recommendation || vendor?.note || vendor?.quote || vendor?.description || '',
        phone: vendor?.phone || '',
        website: normalizeUrl(vendor?.website || vendor?.website_url || ''),
      }));
    }

    return (fallbackResources || []).map((resource, index) => ({
      id: resource?.id || `standard-${index}`,
      category: resource?.category || 'Homeowner Resource',
      name: resource?.name || 'Helpful Home Resource',
      quote: resource?.description || resource?.note || '',
      phone: resource?.phone || '',
      website: normalizeUrl(resource?.website || resource?.website_url || ''),
    }));
  }, [storedVendors, fallbackResources]);

  const checklistItems = useMemo(() => {
    if (internalPlan !== 'premier' || !Array.isArray(profile?.checklist_items)) return [];

    return profile.checklist_items
      .filter((item) => item && item.is_active !== false)
      .map((item, index) => ({
        id: item.id || `checklist-${index}`,
        title: item.title || 'Homeowner task',
        details: item.details || '',
        timeframe: item.timeframe || '',
        recurrenceMonths: normalizeRecurrenceMonths(item.recurrence_months),
      }));
  }, [internalPlan, profile?.checklist_items]);

  const customHubSections = useMemo(() => {
    if (internalPlan !== 'premier' || !Array.isArray(profile?.custom_hub_sections)) return [];

    return profile.custom_hub_sections
      .filter((section) => section && section.is_active !== false)
      .map((section, index) => ({
        id: section.id || `custom-section-${index}`,
        title: section.title || 'Helpful Resource',
        body: section.body || '',
        buttonLabel: section.button_label || '',
        buttonUrl: normalizeUrl(section.button_url || ''),
      }));
  }, [internalPlan, profile?.custom_hub_sections]);

  const checklistStorageKey = `closeandrelax-checklist-${profile?.id || profile?.slug || 'homeowner'}`;
  const completedChecklistCount = checklistItems.filter(
    (item) => Boolean(checklistCompletionDates[String(item.id)])
  ).length;
  const checklistProgress = checklistItems.length > 0
    ? Math.round((completedChecklistCount / checklistItems.length) * 100)
    : 0;

  const normalizeStoredChecklistProgress = (savedValue) => {
    const validItemsById = new Map(
      checklistItems.map((item) => [String(item.id), item])
    );
    const now = new Date();
    const normalized = {};

    // Step 52C stored only an array of checked IDs. Preserve those checkmarks
    // during the upgrade and start their recurrence clock at migration time.
    if (Array.isArray(savedValue)) {
      savedValue.map(String).forEach((itemId) => {
        if (validItemsById.has(itemId)) {
          normalized[itemId] = now.toISOString();
        }
      });
      return normalized;
    }

    if (!savedValue || typeof savedValue !== 'object') return normalized;

    Object.entries(savedValue).forEach(([itemId, completedAt]) => {
      const item = validItemsById.get(String(itemId));
      if (!item || typeof completedAt !== 'string') return;

      const completedDate = new Date(completedAt);
      if (Number.isNaN(completedDate.getTime())) return;

      if (item.recurrenceMonths) {
        const dueAgainAt = addMonthsClamped(completedDate, item.recurrenceMonths);
        if (dueAgainAt && dueAgainAt <= now) return;
      }

      normalized[String(itemId)] = completedDate.toISOString();
    });

    return normalized;
  };

  const refreshChecklistProgress = () => {
    if (checklistItems.length === 0) {
      setChecklistCompletionDates({});
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(checklistStorageKey);
      const saved = rawValue ? JSON.parse(rawValue) : {};
      const normalized = normalizeStoredChecklistProgress(saved);
      setChecklistCompletionDates(normalized);

      // Also writes migrations and automatically removes recurring items
      // that have reached their next due date.
      window.localStorage.setItem(checklistStorageKey, JSON.stringify(normalized));
    } catch {
      setChecklistCompletionDates({});
    }
  };

  useEffect(() => {
    refreshChecklistProgress();

    // If the hub is left open for a long time, recurring tasks still become due
    // without requiring the homeowner to manually clear anything.
    const intervalId = window.setInterval(refreshChecklistProgress, 60 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshChecklistProgress();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checklistStorageKey, checklistItems]);

  const toggleChecklistItem = (itemId) => {
    const normalizedId = String(itemId);

    setChecklistCompletionDates((current) => {
      const next = { ...current };

      if (next[normalizedId]) {
        delete next[normalizedId];
      } else {
        next[normalizedId] = new Date().toISOString();
      }

      try {
        window.localStorage.setItem(checklistStorageKey, JSON.stringify(next));
      } catch {
        // The checklist still works for this visit if local storage is unavailable.
      }

      return next;
    });
  };

  useEffect(() => {
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setIsInstalled(Boolean(isStandalone));

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const manifestJson = {
      name: `${realtorName}'s Homeowner Resource Hub`,
      short_name: `${firstName}'s Home Hub`,
      start_url: window.location.href,
      display: 'standalone',
      background_color: '#faf8f5',
      theme_color: '#faf8f5',
      description: `Post-closing homeowner resources curated by ${realtorName}.`,
      ...(headshotUrl
        ? {
            icons: [
              { src: headshotUrl, sizes: '192x192', type: 'image/jpeg', purpose: 'any maskable' },
              { src: headshotUrl, sizes: '512x512', type: 'image/jpeg', purpose: 'any maskable' },
            ],
          }
        : {}),
    };

    const stringManifest = JSON.stringify(manifestJson);
    const blob = new Blob([stringManifest], { type: 'application/json' });
    const manifestURL = URL.createObjectURL(blob);
    let manifestLink = document.querySelector('link[rel="manifest"]');

    if (!manifestLink) {
      manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      document.head.appendChild(manifestLink);
    }

    manifestLink.href = manifestURL;

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      URL.revokeObjectURL(manifestURL);
    };
  }, [realtorName, firstName, headshotUrl]);

  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll('.hub-reveal'));

    if (!('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('hub-revealed'));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hub-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -35px 0px' }
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [resources.length, bio, headshotUrl, welcomeVideoEmbedUrl, checklistItems.length, customHubSections.length]);

  const triggerToast = (text) => {
    setToastMessage(text);
    window.setTimeout(() => setToastMessage(''), 3200);
  };

  const fallbackCopy = (text, id) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      setCopiedId(id);
      triggerToast('Copied to clipboard!');
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch {
      triggerToast(text);
    }

    document.body.removeChild(textArea);
  };

  const copyText = (text, id) => {
    if (!text) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedId(id);
          triggerToast('Copied to clipboard!');
          window.setTimeout(() => setCopiedId(null), 2500);
        })
        .catch(() => fallbackCopy(text, id));
    } else {
      fallbackCopy(text, id);
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        setIsInstalled(true);
        triggerToast('Added to Home Screen!');
      }
      setDeferredPrompt(null);
      return;
    }

    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    triggerToast("Open your browser menu and choose 'Add to Home screen'");
  };

  const downloadVCard = () => {
    const vCardData = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${realtorName}`,
      `ORG:${brokerage}`,
      'TITLE:Realtor & Post-Closing Concierge',
      phone ? `TEL;TYPE=CELL:${phone}` : '',
      email ? `EMAIL:${email}` : '',
      websiteUrl ? `URL:${websiteUrl}` : '',
      'NOTE:Trusted Realtor & Post-Closing Concierge',
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\n');

    const blob = new Blob([vCardData], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${realtorName.replace(/\s+/g, '_')}_Realtor.vcf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast(`${firstName}'s contact card downloaded!`);
  };

  const handleShareLink = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `${realtorName}'s Homeowner Resource Hub`,
          text: `Post-closing resources from ${realtorName}.`,
          url: window.location.href,
        })
        .catch(() => {});
      return;
    }

    copyText(window.location.href, 'hub-share');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1c1917] font-sans antialiased selection:bg-[#ecdcc5] selection:text-[#1c1917] pb-16">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');

        .hub-font-serif { font-family: 'Playfair Display', Georgia, serif; }
        .hub-font-sans { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
        .hub-editorial-shadow { box-shadow: 0 10px 30px -10px rgba(78, 62, 45, 0.08), 0 2px 8px -2px rgba(78, 62, 45, 0.04); }
        .hub-editorial-shadow-lg { box-shadow: 0 20px 40px -15px rgba(60, 48, 35, 0.12); }

        .hub-reveal {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 650ms cubic-bezier(.22,.61,.36,1), transform 650ms cubic-bezier(.22,.61,.36,1);
        }
        .hub-reveal.hub-revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .hub-card-lift {
          transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
        }
        @media (hover: hover) and (pointer: fine) {
          .hub-card-lift:hover {
            transform: translateY(-4px);
            box-shadow: 0 18px 38px -18px rgba(60, 48, 35, 0.22), 0 8px 16px -12px rgba(60, 48, 35, 0.12);
          }
          .hub-icon-nudge:hover svg {
            transform: translateX(2px);
          }
        }
        .hub-icon-nudge svg {
          transition: transform 180ms ease;
        }
        .hub-install-attention {
          position: relative;
          overflow: hidden;
          animation: hubSoftPulse 900ms ease 900ms 1 both;
        }
        .hub-install-attention::after {
          content: '';
          position: absolute;
          inset: -60% -35%;
          background: linear-gradient(110deg, transparent 38%, rgba(255,255,255,.22) 49%, rgba(255,255,255,.38) 52%, transparent 63%);
          transform: translateX(-70%) rotate(2deg);
          animation: hubChampagneShimmer 1100ms ease 1350ms 1 both;
          pointer-events: none;
        }
        @keyframes hubSoftPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
          45% { transform: scale(1.018); box-shadow: 0 10px 24px -12px rgba(156,120,68,.55); }
        }
        @keyframes hubChampagneShimmer {
          from { transform: translateX(-70%) rotate(2deg); opacity: 0; }
          20% { opacity: 1; }
          to { transform: translateX(70%) rotate(2deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hub-reveal,
          .hub-card-lift,
          .hub-icon-nudge svg,
          .hub-install-attention {
            transition: none !important;
            animation: none !important;
          }
          .hub-reveal {
            opacity: 1 !important;
            transform: none !important;
          }
          .hub-install-attention::after {
            display: none !important;
          }
        }
      `}</style>

      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#1c1917] text-[#f7f3ec] px-4 py-2.5 rounded-full text-xs font-medium tracking-wide shadow-xl flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-[#d4af37]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="border-b border-[#ebdcc7]/60 bg-[#faf8f5]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-[10px] tracking-[0.25em] font-semibold text-[#8c6b38] uppercase">
            Close &amp; Relax Concierge
          </span>
          <button
            onClick={handleShareLink}
            className="text-[#78716c] hover:text-[#1c1917] p-1.5 rounded-full hover:bg-[#ede5d8] transition-colors"
            title="Share Guide"
            aria-label="Share Guide"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-6 lg:px-8 pt-8 lg:pt-12 pb-12 hub-font-sans">
        <div className="lg:grid lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-10 xl:gap-14 lg:items-start">
          <aside className="lg:sticky lg:top-24 lg:self-start">
        <section className="hub-reveal text-center mb-10 lg:bg-white lg:rounded-3xl lg:border lg:border-[#ede4d6] lg:p-8 lg:hub-editorial-shadow">
          <div className="relative inline-block mb-5">
            <div className="w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36 rounded-full p-1 bg-gradient-to-tr from-[#d4af37] via-[#e8d8be] to-[#b38e56] shadow-md mx-auto">
              {headshotUrl ? (
                <img
                  src={headshotUrl}
                  alt={realtorName}
                  className="w-full h-full object-cover rounded-full border-2 border-[#faf8f5]"
                />
              ) : (
                <div className="w-full h-full rounded-full border-2 border-[#faf8f5] bg-[#f5ede2] flex items-center justify-center hub-font-serif text-3xl text-[#8c6b38]">
                  {getInitials(realtorName)}
                </div>
              )}
            </div>
            <div className="absolute bottom-1 right-1 bg-[#1c1917] text-[#e8d8be] p-1.5 rounded-full border-2 border-[#faf8f5] shadow-sm">
              <Home className="w-3.5 h-3.5" />
            </div>
          </div>

          <span className="text-[11px] uppercase tracking-[0.22em] font-semibold text-[#9c7844] block mb-2">
            Welcome Home
          </span>
          <h1 className="hub-font-serif text-3xl sm:text-4xl text-[#1c1917] font-normal tracking-tight mb-2">
            {realtorName}
          </h1>
          <p className="text-xs font-medium text-[#78716c] uppercase tracking-wider mb-1">
            Realtor® &amp; Post-Closing Concierge
          </p>
          <p className="text-[11px] text-[#8c837d] mb-4">
            {brokerage}{city ? ` • ${city}` : ''}
          </p>

          <p className="hub-font-serif italic text-lg sm:text-xl text-[#292524] max-w-sm mx-auto leading-snug mb-3">
            “Your trusted resources for life after closing.”
          </p>

          <p className="text-xs text-[#57534e] max-w-xs mx-auto leading-relaxed mb-6 font-normal">
            {welcomeMessage}
          </p>

          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {phone && (
              <>
                <a
                  href={`tel:${rawPhone}`}
                  className="bg-[#292524] hover:bg-[#1c1917] text-[#faf8f5] text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-sm"
                >
                  <Phone className="w-3.5 h-3.5 text-[#e5d3b6]" />
                  <span>Call {firstName}</span>
                </a>
                <a
                  href={`sms:${rawPhone}`}
                  className="bg-white hover:bg-[#f5ede2] text-[#292524] border border-[#dfd2be] text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-transform active:scale-95 shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#9c7844]" />
                  <span>Text {firstName}</span>
                </a>
              </>
            )}
            <button
              onClick={downloadVCard}
              className="bg-white hover:bg-[#f5ede2] text-[#292524] border border-[#dfd2be] text-xs font-semibold p-2.5 rounded-xl flex items-center justify-center transition-transform active:scale-95 shadow-sm"
              title="Save Contact to Phone"
              aria-label="Save Contact to Phone"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#9c7844]" />
            </button>
          </div>

          {(email || websiteUrl || socialLinks.length > 0) && (
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-[11px] font-medium text-[#8a6b3d]">
              {email && (
                <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-[#674f2b]">
                  <Mail className="w-3 h-3" /> Email
                </a>
              )}
              {websiteUrl && (
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-[#674f2b]">
                  <Globe className="w-3 h-3" /> Website
                </a>
              )}
              {socialLinks.map((item) => (
                <a key={item.label} href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#674f2b]">
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="hub-reveal mb-10">
          <div className="bg-gradient-to-r from-[#f5ede2] via-[#faf4ea] to-[#f5ede2] border border-[#ebdcc7] rounded-2xl p-4 sm:p-5 hub-editorial-shadow flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 text-center sm:text-left lg:text-center xl:text-left">
              <div className="w-10 h-10 rounded-xl bg-white border border-[#e2d3be] flex items-center justify-center text-[#9c7844] shrink-0 shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-semibold text-[#1c1917] uppercase tracking-wide">Keep this guide handy</h2>
                <p className="text-[11px] text-[#78716c] leading-tight">
                  Add {firstName}’s homeowner guide to your phone for 1-tap access.
                </p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              className="hub-install-attention w-full sm:w-auto lg:w-full xl:w-auto bg-[#1c1917] hover:bg-black text-[#faf8f5] text-xs font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shrink-0 transition-transform active:scale-95 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{isInstalled ? 'Added to Phone' : 'Add to Phone'}</span>
            </button>
          </div>
        </section>

        {bio && (
          <section className="hub-reveal bg-white rounded-2xl p-5 border border-[#ebdcc7] hub-editorial-shadow mb-10">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f7f2ea] flex items-center justify-center border border-[#ebdcc7] shrink-0">
                <MapPin className="w-4 h-4 text-[#9c7844]" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#9c7844]">A note from {firstName}</span>
                <p className="text-xs text-[#57534e] leading-relaxed mt-2">{bio}</p>
              </div>
            </div>
          </section>
        )}

          </aside>

          <div className="min-w-0">

        {welcomeVideoEmbedUrl && (
          <section className="hub-reveal bg-white rounded-2xl p-5 sm:p-6 border border-[#ebdcc7] hub-editorial-shadow mb-10">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#f7f2ea] flex items-center justify-center border border-[#ebdcc7] shrink-0">
                <Video className="w-4 h-4 text-[#9c7844]" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#9c7844]">
                  A quick hello from {firstName}
                </span>
                <h2 className="hub-font-serif text-xl sm:text-2xl text-[#1c1917] font-medium tracking-tight mt-1">
                  Your Welcome Home Message
                </h2>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e7dccb] bg-[#1c1917] shadow-sm">
              <div className="relative w-full aspect-video">
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={welcomeVideoEmbedUrl}
                  title={`${realtorName} welcome video`}
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          </section>
        )}

        {checklistItems.length > 0 && (
          <section className="hub-reveal bg-white rounded-2xl p-5 sm:p-6 border border-[#ebdcc7] hub-editorial-shadow mb-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
              <div>
                <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#9c7844]">
                  Homeowner Checklist
                </span>
                <h2 className="hub-font-serif text-xl sm:text-2xl text-[#1c1917] font-medium tracking-tight mt-1">
                  A Few Things to Keep on Your Radar
                </h2>
                <p className="text-xs text-[#78716c] leading-relaxed mt-1.5 max-w-xl">
                  Check items off as you handle them. Your progress stays saved on this device, and recurring tasks automatically become due again when their reset period arrives.
                </p>
              </div>

              <div className="sm:text-right shrink-0">
                <p className="text-[11px] font-semibold text-[#57534e]">
                  {completedChecklistCount} of {checklistItems.length} complete
                </p>
                <p className="text-[10px] text-[#9c7844] mt-0.5">{checklistProgress}%</p>
              </div>
            </div>

            <div className="h-1.5 bg-[#f0e9df] rounded-full overflow-hidden mb-5" aria-hidden="true">
              <div
                className="h-full bg-[#b99460] rounded-full transition-all duration-300"
                style={{ width: `${checklistProgress}%` }}
              />
            </div>

            <div className="space-y-3">
              {checklistItems.map((item) => {
                const itemId = String(item.id);
                const completedAt = checklistCompletionDates[itemId] || '';
                const isComplete = Boolean(completedAt);
                const dueAgainAt =
                  isComplete && item.recurrenceMonths
                    ? addMonthsClamped(completedAt, item.recurrenceMonths)
                    : null;
                const recurrenceLabel = getRecurrenceLabel(item.recurrenceMonths);

                return (
                  <button
                    key={itemId}
                    type="button"
                    onClick={() => toggleChecklistItem(itemId)}
                    aria-pressed={isComplete}
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      isComplete
                        ? 'bg-[#f7f3ec] border-[#d8c6aa]'
                        : 'bg-[#fffdfa] border-[#ede4d6] hover:border-[#dbcbb4] hover:bg-[#fdfaf6]'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          isComplete
                            ? 'bg-[#9c7844] border-[#9c7844] text-white'
                            : 'bg-white border-[#cfc3b1] text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className={`hub-font-serif text-base sm:text-lg font-semibold leading-tight ${isComplete ? 'text-[#78716c] line-through' : 'text-[#1c1917]'}`}>
                            {item.title}
                          </span>
                          {item.timeframe && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#f7f2ea] border border-[#e7dccb] text-[#8a6b3d]">
                              {item.timeframe}
                            </span>
                          )}
                          {recurrenceLabel && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#eef4ec] border border-[#d8e4d4] text-[#55704f]">
                              Auto-reset: {recurrenceLabel}
                            </span>
                          )}
                        </span>
                        {item.details && (
                          <span className={`block text-[11px] leading-relaxed mt-1.5 ${isComplete ? 'text-[#a8a29e]' : 'text-[#57534e]'}`}>
                            {item.details}
                          </span>
                        )}
                        {isComplete && dueAgainAt && (
                          <span className="block text-[10px] font-semibold text-[#7a8f70] mt-2">
                            Completed • due again {formatChecklistDate(dueAgainAt)}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {customHubSections.length > 0 && (
          <section className="mb-10">
            <div className="hub-reveal text-center lg:text-left mb-5">
              <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9c7844] block mb-1">
                More From {firstName}
              </span>
              <h2 className="hub-font-serif text-2xl sm:text-3xl text-[#1c1917] font-medium tracking-tight">
                Helpful Things to Keep Handy
              </h2>
              <div className="w-10 h-[1.5px] bg-[#d9cdba] mx-auto lg:mx-0 mt-2.5"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {customHubSections.map((section) => (
                <article
                  key={section.id}
                  className="hub-reveal hub-card-lift bg-white rounded-2xl p-5 sm:p-6 border border-[#ede4d6] hub-editorial-shadow hover:border-[#dbcbb4] flex flex-col h-full"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#f7f2ea] flex items-center justify-center border border-[#ebdcc7] shrink-0">
                      <Bookmark className="w-4 h-4 text-[#9c7844]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[#9c7844]">
                        Homeowner Resource
                      </span>
                      <h3 className="hub-font-serif text-xl text-[#1c1917] font-semibold leading-tight mt-1">
                        {section.title}
                      </h3>
                    </div>
                  </div>

                  {section.body && (
                    <p className="text-xs text-[#57534e] leading-relaxed whitespace-pre-line mt-4">
                      {section.body}
                    </p>
                  )}

                  {section.buttonLabel && section.buttonUrl && (
                    <div className="mt-auto pt-5">
                      <a
                        href={section.buttonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hub-icon-nudge inline-flex items-center justify-center gap-2 bg-[#292524] hover:bg-[#1c1917] text-[#faf8f5] py-2.5 px-4 rounded-xl text-xs font-semibold transition-transform active:scale-95 shadow-sm"
                      >
                        <span>{section.buttonLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-[#e5d3b6]" />
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mb-12">
          <div className="hub-reveal text-center lg:text-left mb-6">
            <span className="text-[10px] uppercase tracking-[0.25em] font-semibold text-[#9c7844] block mb-1">
              Curated Recommendations
            </span>
            <h2 className="hub-font-serif text-2xl sm:text-3xl text-[#1c1917] font-medium tracking-tight">
              {firstName}’s Trusted Home Pros
            </h2>
            <div className="w-10 h-[1.5px] bg-[#d9cdba] mx-auto lg:mx-0 mt-2.5"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {resources.length > 0 ? (
              resources.map((pro) => {
                const IconComponent = getVendorIcon(pro.category);
                const vendorPhoneHref = phoneForHref(pro.phone);

                return (
                  <article
                    key={pro.id}
                    className="hub-reveal hub-card-lift bg-white rounded-2xl p-5 border border-[#ede4d6] hub-editorial-shadow hover:border-[#dbcbb4] relative overflow-hidden flex flex-col h-full"
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[#f7f2ea] flex items-center justify-center border border-[#ebdcc7] shrink-0">
                          <IconComponent className="w-3.5 h-3.5 text-[#9c7844]" />
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9c7844] truncate">
                          {pro.category}
                        </span>
                      </div>

                      {pro.phone && (
                        <button
                          onClick={() => copyText(pro.phone, pro.id)}
                          className="text-[11px] text-[#a8a29e] hover:text-[#78716c] flex items-center gap-1 transition-colors shrink-0"
                          title="Copy phone number"
                        >
                          {copiedId === pro.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span className="text-[10px]">{pro.phone}</span>
                        </button>
                      )}
                    </div>

                    <h3 className="hub-font-serif text-lg font-semibold text-[#1c1917] mb-2 leading-tight">{pro.name}</h3>

                    {pro.quote && (
                      <p className="text-xs text-[#57534e] italic leading-relaxed mb-4 pl-3 border-l-2 border-[#d9ccb6]">
                        “{pro.quote}”
                      </p>
                    )}

                    {(pro.phone || pro.website) && (
                      <div className={`grid ${pro.phone && pro.website ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 pt-1 mt-auto`}>
                        {pro.phone && (
                          <a
                            href={`tel:${vendorPhoneHref}`}
                            className="bg-[#292524] hover:bg-[#1c1917] text-[#faf8f5] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#e5d3b6]" />
                            <span className="truncate">Call {pro.name.split(' ')[0]}</span>
                          </a>
                        )}

                        {pro.website && (
                          <a
                            href={pro.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white hover:bg-[#f7f3ec] text-[#292524] border border-[#dcd1be] py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-transform active:scale-95"
                          >
                            <Globe className="w-3.5 h-3.5 text-[#9c7844]" />
                            <span>Website</span>
                            <ExternalLink className="w-3 h-3 text-[#a89985] ml-0.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="bg-white rounded-2xl p-6 border border-[#ede4d6] hub-editorial-shadow text-center">
                <Home className="w-5 h-5 text-[#9c7844] mx-auto mb-2" />
                <p className="text-xs text-[#57534e]">Trusted homeowner resources are being added here.</p>
              </div>
            )}
          </div>
        </section>

        <section className="hub-reveal bg-white rounded-2xl p-6 border border-[#ebdcc7] text-center hub-editorial-shadow mb-10">
          <Heart className="w-5 h-5 text-[#9c7844] mx-auto mb-2.5" />
          <h3 className="hub-font-serif text-xl text-[#1c1917] font-normal mb-1.5">Always in Your Corner</h3>
          <p className="text-xs text-[#57534e] leading-relaxed max-w-xs mx-auto mb-4">
            Need a contractor recommendation that isn’t listed here, or have a question about your new neighborhood? I’m always just a call or text away.
          </p>
          {phone ? (
            <a href={`sms:${rawPhone}`} className="hub-icon-nudge inline-flex items-center gap-2 text-xs font-semibold text-[#8a6b3d] hover:text-[#674f2b] transition-colors">
              <span>Message {firstName} Anytime</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          ) : email ? (
            <a href={`mailto:${email}`} className="hub-icon-nudge inline-flex items-center gap-2 text-xs font-semibold text-[#8a6b3d] hover:text-[#674f2b] transition-colors">
              <span>Email {firstName} Anytime</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </a>
          ) : null}
        </section>

        <footer className="hub-reveal text-center lg:text-left pt-2 pb-6">
          <p className="text-[11px] hub-font-serif text-[#78716c] mb-1">{realtorName} • Realtor®</p>
          <p className="text-[10px] tracking-wider uppercase text-[#a8a29e]">Powered by Close &amp; Relax</p>
        </footer>
          </div>
        </div>
      </main>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#faf8f5] border border-[#ebdcc7] rounded-3xl p-6 max-w-sm w-full hub-editorial-shadow-lg text-center relative">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-4 right-4 text-[#78716c] hover:text-[#1c1917] p-1 rounded-full hover:bg-[#eee6d8]"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-white border border-[#e2d3be] flex items-center justify-center mx-auto mb-3 text-[#9c7844] shadow-sm">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="hub-font-serif text-lg font-semibold text-[#1c1917] mb-1">Add to iPhone Home Screen</h3>
            <p className="text-xs text-[#78716c] mb-5">Keep {firstName}’s trusted home pros alongside your favorite daily apps:</p>

            <div className="space-y-3 text-left mb-6">
              {[
                <>Tap the <span className="font-semibold text-[#1c1917]">Share</span> icon at the bottom of Safari.</>,
                <>Scroll down and tap <span className="font-semibold text-[#1c1917]">Add to Home Screen</span>.</>,
                <>Tap <span className="font-semibold text-[#1c1917]">Add</span> in the top right corner.</>,
              ].map((instruction, index) => (
                <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#ede4d6]">
                  <div className="w-6 h-6 rounded-full bg-[#f5ede2] text-[#9c7844] flex items-center justify-center font-bold text-xs shrink-0">
                    {index + 1}
                  </div>
                  <div className="text-xs text-[#292524]">{instruction}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-[#1c1917] hover:bg-black text-[#faf8f5] py-3 rounded-xl text-xs font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
