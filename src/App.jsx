import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  Check,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Lock,
  Wrench,
  Truck,
  Sparkles,
  Menu,
  X as CloseIcon,
  User,
  Sliders,
  CheckSquare,
  Video,
  Layers,
  LogIn,
  LogOut,
  Mail,
  Building,
  Key,
  LayoutDashboard,
  Eye,
  AlertCircle,
  Loader2,
  MapPin,
  Clock
} from 'lucide-react';

import { supabase } from './lib/supabase';
import PublicRealtorHubDesign from './components/PublicRealtorHub';

const LIZ_VENDORS = [
  {
    category: "Locksmith & Security",
    name: "Apex Key & Secure Solutions",
    note: "Liz's Note: Re-keyed over 14 client properties for my buyers. Ask for Marco for priority next-day service.",
    phone: "(480) 555-0192",
    tag: "Priority Service",
    icon: Lock,
  },
  {
    category: "HVAC & Climate Systems",
    name: "Highland Air & Heating",
    note: "Liz's Note: Honest diagnostics, 24/7 winter emergency response, and punctual seasonal tune-ups.",
    phone: "(480) 555-0144",
    tag: "Available 24/7",
    icon: Wrench,
  },
  {
    category: "White-Glove Moving",
    name: "Vanguard Relocations",
    note: "Liz's Note: Experienced with fragile art, piano moves, and historic millwork. Respectful and meticulous crew.",
    phone: "(480) 555-0188",
    tag: "Trusted Crew",
    icon: Truck,
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Directory Scope",
    portal: "Huge, overwhelming searchable directories with hundreds of unfamiliar contractors.",
    closeAndRelax: "A small, curated list of trusted local providers recommended with genuine confidence.",
  },
  {
    feature: "Brand Prominence",
    portal: "Platform logo first; agent photo and brand obscured or buried in footers.",
    closeAndRelax: "Realtor-first experience; your photo, contact info, brokerage, and voice lead the hub.",
  },
  {
    feature: "Client Access",
    portal: "Client logins, forgotten passwords, mandatory downloads, and sign-up friction.",
    closeAndRelax: "Open-and-use web experience; zero client login, zero password, zero friction.",
  },
  {
    feature: "Vendor Placement",
    portal: "Vendors pay ad dollars, bidding fees, or referral percentages for lead-generation visibility.",
    closeAndRelax: "No vendors pay Close & Relax for recommendation placement. Strictly curated on trust.",
  },
  {
    feature: "Realtor Overhead",
    portal: "Another bloated CRM or complex software suite requiring weeks of setup and maintenance.",
    closeAndRelax: "An intuitive self-service dashboard. Personalize and publish your hub in under five minutes.",
  },
  {
    feature: "Recommendation Context",
    portal: "Generic crowd-sourced reviews and star ratings easily gamed online.",
    closeAndRelax: "Your authentic one-line Realtor recommendation under every vendor explaining why you trust them.",
  },
  {
    feature: "Longevity on Device",
    portal: "Browser bookmarks or emails lost within two weeks of unpacking boxes.",
    closeAndRelax: "One-tap 'Add to Phone' PWA; lives gracefully right on their home screen for years.",
  },
];

const FOUNDING_PRICING_END = new Date('2027-01-18T23:59:59-05:00');
const FOUNDING_PRICING_END_LABEL = 'January 18, 2027';

// Keep the existing database values for compatibility:
// partner/free -> customer-facing Free
// pro          -> customer-facing Core
// premier      -> customer-facing Pro
const normalizeInternalPlan = (value) => {
  const plan = String(value || 'partner').toLowerCase();
  if (plan === 'free' || plan === 'partner') return 'partner';
  if (plan === 'core' || plan === 'pro') return 'pro';
  if (plan === 'premier') return 'premier';
  return 'partner';
};

const getPlanConfig = (value) => {
  const internalPlan = normalizeInternalPlan(value);

  if (internalPlan === 'premier') {
    return {
      internalPlan,
      name: 'Pro',
      vendorLimit: 15,
      allowsPremiumProfile: true,
      allowsVendorRecommendations: true,
      allowsDefaultVendorControl: true,
      regularPrice: 59,
      foundingPrice: 29,
    };
  }

  if (internalPlan === 'pro') {
    return {
      internalPlan,
      name: 'Core',
      vendorLimit: 8,
      allowsPremiumProfile: true,
      allowsVendorRecommendations: true,
      allowsDefaultVendorControl: false,
      regularPrice: 39,
      foundingPrice: 19,
    };
  }

  return {
    internalPlan: 'partner',
    name: 'Free',
    vendorLimit: 3,
    allowsPremiumProfile: false,
    allowsVendorRecommendations: false,
    allowsDefaultVendorControl: false,
    regularPrice: 0,
    foundingPrice: 0,
  };
};

const isFoundingPricingActive = () => Date.now() <= FOUNDING_PRICING_END.getTime();

const PRICING_TIERS = [
  {
    id: "partner",
    name: "Free",
    badge: "Always Free",
    regularPrice: 0,
    foundingPrice: 0,
    period: "/ forever",
    description: "A genuinely useful homeowner concierge that keeps you visible after closing without turning the hub into a sales page.",
    popular: false,
    ctaText: "Create Free Account",
    features: [
      "Instant self-service dashboard access",
      "Essential identity: name, brokerage, phone, email & market",
      "Direct Call & Text contact actions for buyers",
      "Standard Close & Relax resource content",
      "Add up to 3 of your own preferred vendors",
      "Dedicated shareable subdomain",
      "Responsive mobile hub & save-to-phone PWA experience",
      "Close & Relax branding remains visible",
    ],
  },
  {
    id: "pro",
    name: "Core",
    badge: "Most Popular",
    regularPrice: 39,
    foundingPrice: 19,
    period: "/ month",
    description: "For active Realtors who want their hub to feel unmistakably personal, polished, and useful long after closing day.",
    popular: true,
    ctaText: "Choose Core",
    features: [
      "Everything in Free, plus stronger personalization",
      "Professional Realtor headshot",
      "Add up to 8 preferred vendors",
      "Personal one-line recommendation notes under vendors",
      "Personalized welcome message & short bio",
      "Professional website and social profile links",
      "More editable homeowner resources and page content",
      "More images/media and self-service editing",
      "Close & Relax branding remains visible",
    ],
  },
  {
    id: "premier",
    name: "Pro",
    badge: "Maximum Control",
    regularPrice: 59,
    foundingPrice: 29,
    period: "/ month",
    description: "For Realtors who want the most control, richer media, deeper homeowner resources, and a near-white-label experience.",
    popular: false,
    ctaText: "Choose Pro",
    features: [
      "Everything in Core, plus advanced hub controls",
      "Add up to 15 preferred vendors",
      "Greater vendor control, including default resource replacement/removal",
      "Premium branding control",
      "Custom home-screen app icon",
      "Personal video greeting up to ~30 seconds",
      "Advanced homeowner checklists",
      "Custom sections & tailored service categories",
      "Expanded image/media and homeowner resource controls",
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: "What can I customize on the Free plan?",
    answer: "Free is designed to be genuinely useful: your name, brokerage, direct phone, public email, market, dedicated subdomain, standard Close & Relax homeowner resources, and up to 3 preferred vendors. Core adds your professional headshot and richer personalization such as custom welcome content, bio, social links, vendor recommendation notes, and additional editing controls.",
  },
  {
    question: "Can I add my own vendors on Free?",
    answer: "Yes. Free includes up to 3 of your own preferred vendors in addition to the standard Close & Relax resource. Core expands that to 8, and Pro expands it to 15.",
  },
  {
    question: "What is the difference between Core and Pro?",
    answer: "Core is $39/month and supports up to 8 preferred vendors, a Realtor headshot, personal recommendation notes, richer profile branding, and more self-service editing. Pro is $59/month and supports up to 15 preferred vendors plus greater vendor control, premium branding, video, a custom app icon, advanced checklists, and custom sections.",
  },
  {
    question: "How does Founding Member pricing work?",
    answer: "Realtors who start a paid plan by January 18, 2027 can lock in Founding Core at $19/month or Founding Pro at $29/month. The founding rate stays in place while that subscription remains continuously active. If it is canceled and restarted later, the current standard price applies.",
  },
  {
    question: "How do I create and manage my hub?",
    answer: "Create an account to access your Realtor dashboard, fill in the profile fields available on your plan, add your trusted vendors, and publish. Changes to supported fields appear on your live homeowner hub without your clients needing a new link.",
  },
  {
    question: "I already have a real estate website. Why do I need this?",
    answer: "Your public website is built to attract prospects. Close & Relax is built to keep you useful after closing—giving past clients a homeowner resource they can keep on their phone, which helps you remain memorable when they need an agent again or have someone to refer.",
  },
  {
    question: "I already have a vendor PDF list. How is this different?",
    answer: "PDFs get buried. Close & Relax turns your recommendations into an interactive mobile homeowner hub with one-tap calling, live vendor updates, your contact information, and a save-to-phone experience that keeps the resource—and your name—easy to find.",
  },
  {
    question: "Do my home buyers need to create an account or download an app?",
    answer: "No. Homeowners do not create an account or enter a password. The hub opens directly in the browser and can be saved to the phone home screen as a Progressive Web App.",
  },
  {
    question: "Do vendors pay Close & Relax to appear?",
    answer: "No. Close & Relax does not charge vendors for recommendation placement or sponsored visibility. The point is to preserve the Realtor's trusted recommendations rather than turn the hub into an ad directory.",
  },
  {
    question: "What happens if I downgrade or cancel a paid plan?",
    answer: "The homeowner link does not disappear. Paid-only customization is hidden and the hub gracefully falls back to the Free experience so clients still retain a useful resource.",
  },
];

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
  
  .font-editorial {
    font-family: 'Cormorant Garamond', Georgia, serif;
    letter-spacing: -0.015em;
  }
  .font-body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .bg-cream-warm {
    background-color: #FAF7F2;
  }
  .bg-cream-card {
    background-color: #FDFBF7;
  }
  .bg-cream-subtle {
    background-color: #F3EEE7;
  }
  .text-charcoal-deep {
    color: #191816;
  }
  .text-charcoal-body {
    color: #262421;
  }
  .text-charcoal-muted {
    color: #58524B;
  }
  .border-cream-border {
    border-color: #E8E2D8;
  }
  .text-gold-accent {
    color: #B5966B;
  }
  .bg-gold-accent {
    background-color: #B5966B;
  }
  .shadow-luxury {
    box-shadow: 0 20px 40px -15px rgba(25, 24, 22, 0.07);
  }
  .shadow-phone {
    box-shadow: 0 30px 60px -12px rgba(25, 24, 22, 0.18), 0 0 0 1px rgba(25, 24, 22, 0.08);
  }
`;

const STANDARD_HOME_RESOURCES = [
  {
    category: 'Home Security & Smart Home',
    name: 'Security & Smart-Home Support',
    description: 'Professional security, smart-home setup, and post-closing support.',
    icon: ShieldCheck,
  },
  {
    category: 'HVAC & Climate',
    name: 'Heating & Cooling Support',
    description: 'A quick starting point for heating, cooling, seasonal maintenance, and comfort needs.',
    icon: Wrench,
  },
  {
    category: 'Moving & Home Setup',
    name: 'Move-In & Home Services',
    description: 'Helpful resources for moving, settling in, and taking care of the home after closing.',
    icon: Truck,
  },
];

const getInitials = (name = '') => {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return initials || 'CR';
};

const getFirstName = (name = '') => name.trim().split(/\s+/)[0] || 'your realtor';

const normalizeWebsiteUrl = (value = '') => {
  if (!value) return '';
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

const normalizeRealtorSlug = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);

const isValidRealtorSlug = (value = '') =>
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) &&
  value !== 'www';

const isValidOptionalUrl = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed) return true;

  try {
    const parsed = new URL(normalizeWebsiteUrl(trimmed));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const getProfileImageStoragePath = (url = '') => {
  const marker = '/storage/v1/object/public/profile-images/';
  const markerIndex = url.indexOf(marker);

  if (markerIndex === -1) return '';

  const path = url.slice(markerIndex + marker.length).split('?')[0];

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

function PublicRealtorHub({ profile }) {
  const [showSaveTip, setShowSaveTip] = useState(false);

  const realtorName = profile?.full_name || 'Your Realtor';
  const firstName = getFirstName(realtorName);
  const brokerage = profile?.brokerage || 'Independent Real Estate';
  const city = profile?.city || profile?.market_city || '';
  const email = profile?.email || '';
  const phone = profile?.phone || profile?.phone_number || profile?.mobile || '';
  const headshotUrl =
    profile?.headshot_url ||
    profile?.profile_image_url ||
    profile?.photo_url ||
    profile?.image_url ||
    '';
  const welcomeMessage =
    profile?.welcome_message ||
    profile?.welcome ||
    `Welcome home! I created this concierge to give you a simple place to find helpful home resources and stay connected with me whenever you need anything.`;
  const bio = profile?.bio || '';
  const websiteUrl = normalizeWebsiteUrl(profile?.website_url || profile?.website || '');
  const socialLinks = [
    { label: 'Instagram', url: normalizeWebsiteUrl(profile?.instagram_url || '') },
    { label: 'Facebook', url: normalizeWebsiteUrl(profile?.facebook_url || '') },
    { label: 'LinkedIn', url: normalizeWebsiteUrl(profile?.linkedin_url || '') },
  ].filter((item) => item.url);

  const storedVendors = Array.isArray(profile?.vendors)
    ? profile.vendors
    : Array.isArray(profile?.preferred_vendors)
      ? profile.preferred_vendors
      : [];

  const hasStoredVendors = storedVendors.length > 0;

  return (
    <div className="min-h-screen bg-cream-warm text-charcoal-body font-body antialiased selection:bg-[#E4D5BE] selection:text-[#191816]">
      <style>{customStyles}</style>

      <header className="bg-cream-card/95 backdrop-blur border-b border-cream-border">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full border border-[#B5966B]/70 flex items-center justify-center bg-cream-warm text-charcoal-deep font-editorial font-semibold text-lg shrink-0">
              C
            </div>
            <div className="min-w-0">
              <p className="font-editorial text-xl font-semibold text-charcoal-deep leading-none">Close &amp; Relax</p>
              <p className="text-[9px] uppercase tracking-[0.18em] text-charcoal-muted mt-0.5">Homeowner Concierge</p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.16em] text-gold-accent font-semibold border border-[#E4D5BE] bg-[#FAF6EF] px-3 py-1.5 rounded-full">
            Presented by {firstName}
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <section className="bg-cream-card border border-cream-border rounded-3xl shadow-luxury overflow-hidden">
          <div className="p-6 sm:p-9 border-b border-cream-border">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="w-24 h-24 rounded-full border-2 border-gold-accent bg-cream-subtle overflow-hidden shrink-0 flex items-center justify-center shadow-sm">
                {headshotUrl ? (
                  <img src={headshotUrl} alt={realtorName} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-editorial text-3xl font-semibold text-charcoal-deep">{getInitials(realtorName)}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gold-accent">Your Real Estate Resource</span>
                <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-charcoal-deep mt-1 leading-tight">
                  {realtorName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-charcoal-muted mt-1.5">
                  <span>{brokerage}</span>
                  {city && (
                    <>
                      <span className="text-[#B5966B]">•</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{city}</span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 mt-5">
                  {phone && (
                    <>
                      <a href={`tel:${phone}`} className="inline-flex items-center gap-2 bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                        <Phone className="w-3.5 h-3.5 text-[#B5966B]" /> Call {firstName}
                      </a>
                      <a href={`sms:${phone}`} className="inline-flex items-center gap-2 bg-cream-subtle hover:bg-cream-border border border-cream-border text-charcoal-deep text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                        <MessageSquare className="w-3.5 h-3.5 text-gold-accent" /> Text {firstName}
                      </a>
                    </>
                  )}
                  {email && (
                    <a href={`mailto:${email}`} className="inline-flex items-center gap-2 bg-cream-subtle hover:bg-cream-border border border-cream-border text-charcoal-deep text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                      <Mail className="w-3.5 h-3.5 text-gold-accent" /> Email
                    </a>
                  )}
                  {websiteUrl && (
                    <a href={websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-cream-subtle hover:bg-cream-border border border-cream-border text-charcoal-deep text-xs font-semibold px-4 py-2.5 rounded-full transition-colors">
                      <ExternalLink className="w-3.5 h-3.5 text-gold-accent" /> Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-9 space-y-7">
            <section className="bg-cream-warm border border-cream-border rounded-2xl p-5 sm:p-6">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gold-accent">Welcome Home</span>
              <p className="font-editorial text-xl sm:text-2xl font-semibold text-charcoal-deep mt-1">A resource built to stay useful after closing day.</p>
              <p className="text-sm text-charcoal-muted leading-relaxed mt-3">{welcomeMessage}</p>
            </section>

            {(bio || socialLinks.length > 0) && (
              <section className="bg-cream-card border border-cream-border rounded-2xl p-5 sm:p-6">
                <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gold-accent">Your Realtor</span>
                <h2 className="font-editorial text-xl sm:text-2xl font-semibold text-charcoal-deep mt-1">Stay connected with {firstName}.</h2>
                {bio && <p className="text-sm text-charcoal-muted leading-relaxed mt-3">{bio}</p>}
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2.5 mt-4">
                    {socialLinks.map((item) => (
                      <a
                        key={item.label}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 bg-cream-subtle hover:bg-cream-border border border-cream-border text-charcoal-deep text-xs font-semibold px-3.5 py-2 rounded-full transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-gold-accent" />
                        {item.label}
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="bg-[#FAF6EF] border border-[#E4D5BE] rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#191816] text-[#FAF7F2] flex items-center justify-center font-editorial text-sm font-bold shrink-0">
                    {getInitials(realtorName)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-charcoal-deep">Keep {firstName}'s concierge on your phone</p>
                    <p className="text-xs text-charcoal-muted mt-0.5">Save this page to your home screen for quick access later.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaveTip((current) => !current)}
                  className="text-xs font-semibold bg-gold-accent hover:bg-[#9B7E54] text-[#FAF7F2] px-4 py-2.5 rounded-xl whitespace-nowrap transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5 inline mr-1.5" /> Save to Phone
                </button>
              </div>
              {showSaveTip && (
                <div className="mt-4 pt-4 border-t border-[#E4D5BE] text-xs text-charcoal-muted leading-relaxed">
                  On iPhone, use Safari's Share button and choose <strong className="text-charcoal-deep">Add to Home Screen</strong>. On Android, open your browser menu and choose <strong className="text-charcoal-deep">Add to Home screen</strong> or <strong className="text-charcoal-deep">Install app</strong> when available.
                </div>
              )}
            </section>

            <section>
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gold-accent">Homeowner Resources</span>
                  <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-charcoal-deep mt-1">Trusted help when you need it.</h2>
                </div>
              </div>

              {hasStoredVendors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {storedVendors.map((vendor, index) => (
                    <div key={vendor?.id || `${vendor?.name || 'vendor'}-${index}`} className="bg-cream-warm border border-cream-border rounded-2xl p-5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-gold-accent">{vendor?.category || 'Trusted Professional'}</span>
                      <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mt-1">{vendor?.name || 'Preferred Professional'}</h3>
                      {vendor?.note && <p className="text-xs text-charcoal-muted italic leading-relaxed mt-2">{vendor.note}</p>}
                      <div className="flex flex-wrap gap-2 mt-4">
                        {vendor?.phone && (
                          <a href={`tel:${vendor.phone}`} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#191816] text-[#FAF7F2]">Call</a>
                        )}
                        {vendor?.website && (
                          <a href={normalizeWebsiteUrl(vendor.website)} target="_blank" rel="noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-cream-card border border-cream-border text-charcoal-deep">Website</a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {STANDARD_HOME_RESOURCES.map((resource) => {
                    const ResourceIcon = resource.icon;
                    return (
                      <div key={resource.category} className="bg-cream-warm border border-cream-border rounded-2xl p-5">
                        <div className="w-10 h-10 rounded-xl bg-cream-card border border-cream-border flex items-center justify-center text-gold-accent mb-4">
                          <ResourceIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-gold-accent">{resource.category}</span>
                        <h3 className="font-editorial text-lg font-semibold text-charcoal-deep mt-1">{resource.name}</h3>
                        <p className="text-xs text-charcoal-muted leading-relaxed mt-2">{resource.description}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>

        <footer className="py-7 text-center text-[10px] uppercase tracking-[0.16em] text-charcoal-muted">
          Powered by <span className="font-semibold text-gold-accent">Close &amp; Relax</span>
        </footer>
      </main>
    </div>
  );
}

function PublicHubStatusPage({ loading = false }) {
  return (
    <div className="min-h-screen bg-cream-warm text-charcoal-body font-body antialiased flex items-center justify-center px-6">
      <style>{customStyles}</style>
      <div className="max-w-md w-full bg-cream-card border border-cream-border rounded-3xl shadow-luxury p-8 sm:p-10 text-center">
        <div className="w-12 h-12 rounded-full border border-[#B5966B]/70 flex items-center justify-center mx-auto mb-5 bg-cream-warm font-editorial text-2xl font-semibold text-charcoal-deep">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-gold-accent" /> : 'C'}
        </div>
        {loading ? (
          <>
            <h1 className="font-editorial text-2xl font-semibold text-charcoal-deep">Opening your homeowner concierge…</h1>
            <p className="text-sm text-charcoal-muted mt-2">Just a moment while we load this Close &amp; Relax hub.</p>
          </>
        ) : (
          <>
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-gold-accent">Close &amp; Relax</span>
            <h1 className="font-editorial text-3xl font-semibold text-charcoal-deep mt-2">This page is not available.</h1>
            <p className="text-sm text-charcoal-muted leading-relaxed mt-3">The realtor hub may be unpublished, the link may be incorrect, or the page may no longer be active.</p>
            <a href="https://closeandrelax.com" className="inline-flex items-center justify-center mt-6 bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-xs font-semibold px-5 py-2.5 rounded-full transition-colors">
              Visit Close &amp; Relax
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const rootDomainSuffix = '.closeandrelax.com';
  const subdomainCandidate = hostname.endsWith(rootDomainSuffix)
    ? hostname.slice(0, -rootDomainSuffix.length)
    : '';
  const isRealtorSubdomain = Boolean(
    subdomainCandidate &&
    subdomainCandidate !== 'www' &&
    !subdomainCandidate.includes('.')
  );
  const subdomainSlug = isRealtorSubdomain ? subdomainCandidate : null;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveDemoModalOpen, setLiveDemoModalOpen] = useState(false);
  const [signupModalOpen, _setSignupModalOpen] = useState(false);
  const [loginModalOpen, _setLoginModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("partner");
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Dashboard profile editor + publishing state
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEditorError, setProfileEditorError] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    brokerage: '',
    city: '',
    email: '',
    phone: '',
    slug: '',
    welcome_message: '',
    bio: '',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    linkedin_url: '',
  });
  const [headshotFile, setHeadshotFile] = useState(null);
  const [headshotPreview, setHeadshotPreview] = useState('');
  const [removeHeadshot, setRemoveHeadshot] = useState(false);

  // Vendor management state
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [vendorManagerOpen, setVendorManagerOpen] = useState(false);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorError, setVendorError] = useState(null);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    category: '',
    phone: '',
    website: '',
    recommendation: '',
  });

  // Public wildcard subdomain state
  const [publicProfile, setPublicProfile] = useState(null);
  const [publicProfileLoading, setPublicProfileLoading] = useState(isRealtorSubdomain);
  const [publicProfileError, setPublicProfileError] = useState(null);

  // Authentication State
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  // Route-aware view state. The app still uses the existing marketing/dashboard UI,
  // but the browser URL is now the source of truth for refreshable routes.
  const getCurrentAppPath = () => {
    if (typeof window === 'undefined') return '/';
    const rawPath = window.location.pathname || '/';
    if (rawPath === '/') return '/';
    return rawPath.replace(/\/+$/, '') || '/';
  };

  const [currentView, _setCurrentView] = useState(() =>
    getCurrentAppPath() === '/dashboard' ? 'dashboard' : 'marketing'
  );

  const updateBrowserPath = (path, { replace = false } = {}) => {
    if (typeof window === 'undefined' || isRealtorSubdomain) return;
    const currentPath = getCurrentAppPath();
    if (currentPath === path) return;

    if (replace) {
      window.history.replaceState({}, '', path);
    } else {
      window.history.pushState({}, '', path);
    }
  };

  // Keep the existing setCurrentView calls throughout the app, but make them
  // update the URL too so /dashboard survives a refresh.
  const setCurrentView = (view, options = {}) => {
    _setCurrentView(view);
    updateBrowserPath(view === 'dashboard' ? '/dashboard' : '/', options);
  };

  // Route-aware modal setters let all existing Log In / Sign Up buttons keep
  // working while giving those screens real URLs.
  const setLoginModalOpen = (open, options = {}) => {
    _setLoginModalOpen(open);
    if (open) {
      _setSignupModalOpen(false);
      _setCurrentView('marketing');
      updateBrowserPath('/login', options);
    } else if (getCurrentAppPath() === '/login') {
      updateBrowserPath('/', options);
    }
  };

  const setSignupModalOpen = (open, options = {}) => {
    _setSignupModalOpen(open);
    if (open) {
      _setLoginModalOpen(false);
      _setCurrentView('marketing');
      updateBrowserPath('/signup', options);
    } else if (getCurrentAppPath() === '/signup') {
      updateBrowserPath('/', options);
    }
  };

  useEffect(() => {
    if (isRealtorSubdomain) return undefined;

    const applyRouteFromBrowser = () => {
      const path = getCurrentAppPath();

      if (path === '/dashboard') {
        _setCurrentView('dashboard');
        _setLoginModalOpen(false);
        _setSignupModalOpen(false);
        return;
      }

      if (path === '/login') {
        _setCurrentView('marketing');
        _setSignupModalOpen(false);
        _setLoginModalOpen(true);
        return;
      }

      if (path === '/signup') {
        _setCurrentView('marketing');
        _setLoginModalOpen(false);
        _setSignupModalOpen(true);
        return;
      }

      _setCurrentView('marketing');
      _setLoginModalOpen(false);
      _setSignupModalOpen(false);
    };

    applyRouteFromBrowser();
    window.addEventListener('popstate', applyRouteFromBrowser);
    return () => window.removeEventListener('popstate', applyRouteFromBrowser);
  }, [isRealtorSubdomain]);

  // Form states
  const [signupData, setSignupData] = useState({
    name: "",
    brokerage: "",
    marketCity: "",
    email: "",
    password: "",
  });

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactData, setContactData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const fetchOrCreateProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return null;
    }

    try {
      // Query profile strictly by authenticated Supabase UUID (id = user.id)
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error querying profile:', fetchError);
        setAuthError(fetchError.message);
        setProfile(null);
        return null;
      }

      if (existingProfile) {
        setProfile(existingProfile);
        return existingProfile;
      }

      // Profile row does not exist yet: insert using user metadata
      const meta = authUser.user_metadata || {};
      const newProfile = {
        id: authUser.id,
        full_name: meta.full_name || '',
        email: authUser.email || '',
        brokerage: meta.brokerage || '',
        city: meta.market_city || '',
        plan: meta.plan || 'partner',
        is_published: false,
      };

      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting initial profile into database:', insertError);
        setAuthError(insertError.message || 'Unable to create user profile row.');
        setProfile(null);
        return null;
      }

      setProfile(insertedProfile || newProfile);
      return insertedProfile || newProfile;
    } catch (err) {
      console.error('Unexpected profile handling error:', err);
      setAuthError(err.message || 'Failed to sync user profile.');
      setProfile(null);
      return null;
    }
  };

  const fetchUserVendors = async (profileId = user?.id) => {
    if (!profileId) {
      setVendors([]);
      return [];
    }

    setVendorsLoading(true);
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('profile_id', profileId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading vendors:', error);
        setVendorError(error.message || 'Unable to load your vendors.');
        return [];
      }

      const rows = data || [];
      setVendors(rows);
      return rows;
    } catch (err) {
      console.error('Unexpected vendor loading error:', err);
      setVendorError(err.message || 'Unable to load your vendors.');
      return [];
    } finally {
      setVendorsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error retrieving initial Supabase session:', error);
        }

        if (isMounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setAuthLoading(false);
        }
      } catch (err) {
        console.error('Unexpected error loading initial session:', err);
        if (isMounted) setAuthLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      const currentUser = newSession?.user ?? null;

      setSession(newSession);
      setUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        _setCurrentView('marketing');
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    fetchOrCreateProfile(user);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !profile?.id) {
      setVendors([]);
      return;
    }

    fetchUserVendors(profile.id);
  }, [user?.id, profile?.id]);


  // Protect /dashboard and keep logged-in users out of the auth screens.
  // Wait until Supabase finishes restoring the session so a refresh does not
  // accidentally kick an authenticated realtor back to the marketing page.
  useEffect(() => {
    if (isRealtorSubdomain || authLoading) return;

    const path = getCurrentAppPath();

    if (path === '/dashboard' && !user) {
      _setCurrentView('marketing');
      _setSignupModalOpen(false);
      _setLoginModalOpen(true);
      updateBrowserPath('/login', { replace: true });
      return;
    }

    if ((path === '/login' || path === '/signup') && user) {
      _setLoginModalOpen(false);
      _setSignupModalOpen(false);
      _setCurrentView('dashboard');
      updateBrowserPath('/dashboard', { replace: true });
    }
  }, [authLoading, user?.id, isRealtorSubdomain]);

  useEffect(() => {
    let isMounted = true;

    if (!isRealtorSubdomain || !subdomainSlug) {
      setPublicProfile(null);
      setPublicProfileLoading(false);
      setPublicProfileError(null);
      return () => {
        isMounted = false;
      };
    }

    const loadPublicProfile = async () => {
      setPublicProfileLoading(true);
      setPublicProfileError(null);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('slug', subdomainSlug)
          .eq('is_published', true)
          .maybeSingle();

        if (!isMounted) return;

        if (error) {
          console.error('Error loading public realtor profile:', error);
          setPublicProfile(null);
          setPublicProfileError(error.message || 'Unable to load this realtor hub.');
        } else if (!data) {
          setPublicProfile(null);
        } else {
          const { data: publicVendors, error: vendorLoadError } = await supabase
            .from('vendors')
            .select('*')
            .eq('profile_id', data.id)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true });

          if (!isMounted) return;

          if (vendorLoadError) {
            console.error('Error loading public vendors:', vendorLoadError);
            setPublicProfileError(vendorLoadError.message || 'Unable to load this realtor hub.');
            setPublicProfile(null);
          } else {
            const publicPlan = getPlanConfig(data.plan);
            const visibleVendors = (publicVendors || []).map((vendor) => ({
              ...vendor,
              recommendation: publicPlan.allowsVendorRecommendations ? vendor.recommendation : null,
            }));
            const publicData = publicPlan.allowsPremiumProfile
              ? data
              : {
                  ...data,
                  headshot_url: '',
                  welcome_message: '',
                  bio: '',
                  website_url: '',
                  instagram_url: '',
                  facebook_url: '',
                  linkedin_url: '',
                };
            setPublicProfile({ ...publicData, vendors: visibleVendors });
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Unexpected public profile error:', err);
        setPublicProfile(null);
        setPublicProfileError(err.message || 'Unable to load this realtor hub.');
      } finally {
        if (isMounted) setPublicProfileLoading(false);
      }
    };

    loadPublicProfile();

    return () => {
      isMounted = false;
    };
  }, [isRealtorSubdomain, subdomainSlug]);

  useEffect(() => {
    return () => {
      if (headshotPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(headshotPreview);
      }
    };
  }, [headshotPreview]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleOpenSignup = (planId = "partner") => {
    setSelectedPlan(planId);
    setAuthError(null);
    setEmailConfirmationRequired(false);
    setLoginModalOpen(false);
    setSignupModalOpen(true);
  };

  const handleOpenLogin = () => {
    setAuthError(null);
    setSignupModalOpen(false);
    setLoginModalOpen(true);
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setAuthError(null);
    setEmailConfirmationRequired(false);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email.trim(),
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.name.trim(),
            brokerage: signupData.brokerage.trim(),
            market_city: signupData.marketCity.trim(),
            plan: selectedPlan,
          },
        },
      });

      if (error) {
        setAuthError(error.message || 'Unable to create account. Please check your credentials.');
        setActionLoading(false);
        return;
      }

      // Check if email confirmation is required before an active session is generated
      if (data?.user && !data?.session) {
        setEmailConfirmationRequired(true);
        setActionLoading(false);
        return;
      }

      if (data?.session && data?.user) {
        setSignupModalOpen(false);
        setCurrentView('dashboard');
        showToast(`Welcome, ${signupData.name || 'Realtor'}! Your hub is ready to customize.`);
      }
    } catch (err) {
      setAuthError(err.message || 'An unexpected error occurred during signup.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email.trim(),
        password: loginData.password,
      });

      if (error) {
        setAuthError(error.message || 'Invalid email or password.');
        setActionLoading(false);
        return;
      }

      if (data?.user) {
        setLoginModalOpen(false);
        setCurrentView('dashboard');
        showToast('Welcome back to your dashboard.');
      }
    } catch (err) {
      setAuthError(err.message || 'An error occurred during log in.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setCurrentView('marketing');
      showToast('You have been logged out.');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    setContactSubmitted(true);
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const handleOpenProfileEditor = () => {
    setProfileEditorError(null);
    setProfileForm({
      full_name: profile?.full_name || user?.user_metadata?.full_name || '',
      brokerage: profile?.brokerage || user?.user_metadata?.brokerage || '',
      city: profile?.city || user?.user_metadata?.market_city || '',
      email: profile?.email || user?.email || '',
      phone: profile?.phone || '',
      slug: profile?.slug || '',
      welcome_message: profile?.welcome_message || '',
      bio: profile?.bio || '',
      website_url: profile?.website_url || '',
      instagram_url: profile?.instagram_url || '',
      facebook_url: profile?.facebook_url || '',
      linkedin_url: profile?.linkedin_url || '',
    });
    setHeadshotFile(null);
    setHeadshotPreview(profile?.headshot_url || '');
    setRemoveHeadshot(false);
    setProfileEditorOpen(true);
  };

  const handleHeadshotFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setProfileEditorError('Please choose a JPG, PNG, or WebP headshot.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileEditorError('Your headshot must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setProfileEditorError(null);
    setHeadshotFile(file);
    setRemoveHeadshot(false);
    setHeadshotPreview(URL.createObjectURL(file));
  };

  const uploadHeadshot = async (file) => {
    if (!user?.id || !file) return '';

    const extensionFromName = file.name.split('.').pop()?.toLowerCase();
    const extension = ['jpg', 'jpeg', 'png', 'webp'].includes(extensionFromName)
      ? extensionFromName
      : file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const objectPath = `${user.id}/headshot-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('profile-images')
      .getPublicUrl(objectPath);

    if (!data?.publicUrl) {
      throw new Error('The headshot uploaded, but its public URL could not be created.');
    }

    return data.publicUrl;
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      setProfileEditorError('Your account session is not available. Please log in again.');
      return;
    }

    const fullName = profileForm.full_name.trim();
    const brokerage = profileForm.brokerage.trim();
    const city = profileForm.city.trim();
    const email = profileForm.email.trim();
    const phone = profileForm.phone.trim();
    const slug = normalizeRealtorSlug(profileForm.slug);
    const welcomeMessage = profileForm.welcome_message.trim();
    const bio = profileForm.bio.trim();
    const websiteUrl = profileForm.website_url.trim();
    const instagramUrl = profileForm.instagram_url.trim();
    const facebookUrl = profileForm.facebook_url.trim();
    const linkedinUrl = profileForm.linkedin_url.trim();

    if (!fullName) {
      setProfileEditorError('Please enter your full name.');
      return;
    }

    if (!slug || !isValidRealtorSlug(slug)) {
      setProfileEditorError('Choose a valid subdomain using letters, numbers, and hyphens only. “www” cannot be used.');
      return;
    }

    const urlsToValidate = [
      ['website', websiteUrl],
      ['Instagram', instagramUrl],
      ['Facebook', facebookUrl],
      ['LinkedIn', linkedinUrl],
    ];

    const invalidUrl = urlsToValidate.find(([, value]) => !isValidOptionalUrl(value));
    if (invalidUrl) {
      setProfileEditorError(`Please enter a valid ${invalidUrl[0]} URL or leave that field blank.`);
      return;
    }

    setProfileSaving(true);
    setProfileEditorError(null);

    const currentPlanConfig = getPlanConfig(profile?.plan);
    const allowsPremiumProfileSave = currentPlanConfig.allowsPremiumProfile;
    const previousHeadshotUrl = profile?.headshot_url || '';
    let nextHeadshotUrl = allowsPremiumProfileSave ? (removeHeadshot ? '' : previousHeadshotUrl) : previousHeadshotUrl;
    let uploadedHeadshotUrl = '';

    try {
      if (headshotFile && allowsPremiumProfileSave) {
        uploadedHeadshotUrl = await uploadHeadshot(headshotFile);
        nextHeadshotUrl = uploadedHeadshotUrl;
      }

      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          brokerage,
          city,
          email,
          phone,
          slug,
          headshot_url: nextHeadshotUrl,
          welcome_message: allowsPremiumProfileSave ? welcomeMessage : (profile?.welcome_message || ''),
          bio: allowsPremiumProfileSave ? bio : (profile?.bio || ''),
          website_url: allowsPremiumProfileSave ? (websiteUrl ? normalizeWebsiteUrl(websiteUrl) : '') : (profile?.website_url || ''),
          instagram_url: allowsPremiumProfileSave ? (instagramUrl ? normalizeWebsiteUrl(instagramUrl) : '') : (profile?.instagram_url || ''),
          facebook_url: allowsPremiumProfileSave ? (facebookUrl ? normalizeWebsiteUrl(facebookUrl) : '') : (profile?.facebook_url || ''),
          linkedin_url: allowsPremiumProfileSave ? (linkedinUrl ? normalizeWebsiteUrl(linkedinUrl) : '') : (profile?.linkedin_url || ''),
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        if (uploadedHeadshotUrl) {
          const uploadedPath = getProfileImageStoragePath(uploadedHeadshotUrl);
          if (uploadedPath) {
            await supabase.storage.from('profile-images').remove([uploadedPath]);
          }
        }

        if (error.code === '23505') {
          setProfileEditorError('That realtor subdomain is already in use. Please choose another one.');
        } else {
          setProfileEditorError(error.message || 'Unable to save your profile changes.');
        }
        return;
      }

      if (previousHeadshotUrl && previousHeadshotUrl !== nextHeadshotUrl) {
        const oldPath = getProfileImageStoragePath(previousHeadshotUrl);
        if (oldPath) {
          const { error: removeError } = await supabase.storage.from('profile-images').remove([oldPath]);
          if (removeError) {
            console.warn('Old profile image could not be removed:', removeError);
          }
        }
      }

      setProfile(updatedProfile);
      setProfileForm({
        full_name: updatedProfile?.full_name || '',
        brokerage: updatedProfile?.brokerage || '',
        city: updatedProfile?.city || '',
        email: updatedProfile?.email || '',
        phone: updatedProfile?.phone || '',
        slug: updatedProfile?.slug || '',
        welcome_message: updatedProfile?.welcome_message || '',
        bio: updatedProfile?.bio || '',
        website_url: updatedProfile?.website_url || '',
        instagram_url: updatedProfile?.instagram_url || '',
        facebook_url: updatedProfile?.facebook_url || '',
        linkedin_url: updatedProfile?.linkedin_url || '',
      });
      setHeadshotFile(null);
      setHeadshotPreview(updatedProfile?.headshot_url || '');
      setRemoveHeadshot(false);
      setProfileEditorOpen(false);
      showToast('Profile saved. Your public hub has been updated.');
    } catch (err) {
      console.error('Unexpected profile update error:', err);

      if (uploadedHeadshotUrl) {
        const uploadedPath = getProfileImageStoragePath(uploadedHeadshotUrl);
        if (uploadedPath) {
          await supabase.storage.from('profile-images').remove([uploadedPath]);
        }
      }

      setProfileEditorError(err.message || 'Unable to save your profile changes.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!user?.id || !profile) {
      showToast('Your profile is still loading. Please try again in a moment.');
      return;
    }

    if (!profile.is_published) {
      const currentSlug = normalizeRealtorSlug(profile.slug || '');

      if (!profile.full_name || !currentSlug || !isValidRealtorSlug(currentSlug)) {
        showToast('Finish your profile and choose a valid subdomain before publishing.');
        handleOpenProfileEditor();
        return;
      }
    }

    const nextPublishedState = !profile.is_published;
    setPublishLoading(true);

    try {
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update({ is_published: nextPublishedState })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating hub publication status:', error);
        showToast(error.message || 'Unable to update your hub status.');
        return;
      }

      setProfile(updatedProfile);
      showToast(
        nextPublishedState
          ? 'Your homeowner hub is now published.'
          : 'Your homeowner hub is now unpublished.'
      );
    } catch (err) {
      console.error('Unexpected publish status error:', err);
      showToast(err.message || 'Unable to update your hub status.');
    } finally {
      setPublishLoading(false);
    }
  };

  const resetVendorForm = () => {
    setEditingVendorId(null);
    setVendorForm({ name: '', category: '', phone: '', website: '', recommendation: '' });
    setVendorError(null);
  };

  const handleOpenVendorManager = async () => {
    resetVendorForm();
    setVendorManagerOpen(true);
    if (profile?.id) await fetchUserVendors(profile.id);
  };

  const handleEditVendor = (vendor) => {
    setEditingVendorId(vendor.id);
    setVendorForm({
      name: vendor.name || '',
      category: vendor.category || '',
      phone: vendor.phone || '',
      website: vendor.website || '',
      recommendation: vendor.recommendation || '',
    });
    setVendorError(null);
  };

  const handleSaveVendor = async (event) => {
    event.preventDefault();
    if (!user?.id || !profile?.id) return;

    const name = vendorForm.name.trim();
    const category = vendorForm.category.trim();
    const phone = vendorForm.phone.trim();
    const website = vendorForm.website.trim();
    const recommendation = vendorForm.recommendation.trim();

    if (!name || !category) {
      setVendorError('Vendor name and category are required.');
      return;
    }

    if (!phone && !website) {
      setVendorError('Add at least a phone number or website for this vendor.');
      return;
    }

    if (website && !isValidOptionalUrl(website)) {
      setVendorError('Please enter a valid vendor website URL.');
      return;
    }

    const planConfig = getPlanConfig(profile?.plan);
    const normalizedPlan = planConfig.internalPlan;
    const vendorLimit = planConfig.vendorLimit;
    const allowsRecommendation = planConfig.allowsVendorRecommendations;
    const allowsDefaultControl = planConfig.allowsDefaultVendorControl;
    const existingVendor = editingVendorId ? vendors.find((vendor) => vendor.id === editingVendorId) : null;
    const customVendorCount = vendors.filter((vendor) => !vendor.is_default).length;

    if (!editingVendorId && customVendorCount >= vendorLimit) {
      setVendorError(`Your ${planConfig.name} plan allows up to ${vendorLimit} custom vendors.`);
      return;
    }

    if (existingVendor?.is_default && !allowsDefaultControl) {
      setVendorError('The standard Close & Relax vendor can only be edited on the Pro plan.');
      return;
    }

    setVendorSaving(true);
    setVendorError(null);

    try {
      const payload = {
        name,
        category,
        phone: phone || null,
        website: website ? normalizeWebsiteUrl(website) : null,
        recommendation: allowsRecommendation ? (recommendation || null) : null,
      };

      let result;
      if (editingVendorId) {
        result = await supabase
          .from('vendors')
          .update(payload)
          .eq('id', editingVendorId)
          .eq('profile_id', user.id)
          .select('*')
          .single();
      } else {
        const maxSort = vendors.reduce((max, vendor) => Math.max(max, Number(vendor.sort_order) || 0), 0);
        result = await supabase
          .from('vendors')
          .insert([{
            ...payload,
            profile_id: user.id,
            sort_order: maxSort + 1,
            is_active: true,
            is_default: false,
          }])
          .select('*')
          .single();
      }

      if (result.error) {
        console.error('Vendor save error:', result.error);
        setVendorError(result.error.message || 'Unable to save this vendor.');
        return;
      }

      await fetchUserVendors(profile.id);
      resetVendorForm();
      showToast(editingVendorId ? 'Vendor updated on your hub.' : 'Vendor added to your hub.');
    } catch (err) {
      console.error('Unexpected vendor save error:', err);
      setVendorError(err.message || 'Unable to save this vendor.');
    } finally {
      setVendorSaving(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    if (!user?.id || !profile?.id || !vendor?.id) return;

    const planConfig = getPlanConfig(profile?.plan);
    if (vendor.is_default && !planConfig.allowsDefaultVendorControl) {
      setVendorError('The standard Close & Relax vendor can only be removed on the Pro plan.');
      return;
    }

    const confirmed = window.confirm(`Remove ${vendor.name} from your homeowner hub?`);
    if (!confirmed) return;

    setVendorSaving(true);
    setVendorError(null);
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendor.id)
        .eq('profile_id', user.id);

      if (error) {
        console.error('Vendor delete error:', error);
        setVendorError(error.message || 'Unable to remove this vendor.');
        return;
      }

      await fetchUserVendors(profile.id);
      if (editingVendorId === vendor.id) resetVendorForm();
      showToast('Vendor removed from your hub.');
    } catch (err) {
      console.error('Unexpected vendor delete error:', err);
      setVendorError(err.message || 'Unable to remove this vendor.');
    } finally {
      setVendorSaving(false);
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Realtor';
  const displayBrokerage = profile?.brokerage || user?.user_metadata?.brokerage || 'Independent Real Estate';
  const storedPlan = profile?.plan || user?.user_metadata?.plan || 'partner';
  const planConfig = getPlanConfig(storedPlan);
  const displayPlan = planConfig.internalPlan;
  const publicPlanName = planConfig.name;
  const vendorLimit = planConfig.vendorLimit;
  const allowsPremiumProfile = planConfig.allowsPremiumProfile;
  const allowsVendorRecommendations = planConfig.allowsVendorRecommendations;
  const allowsDefaultVendorControl = planConfig.allowsDefaultVendorControl;
  const foundingPricingActive = isFoundingPricingActive();
  const customVendors = vendors.filter((vendor) => !vendor.is_default);
  const standardVendors = vendors.filter((vendor) => vendor.is_default);
  const publicHubUrl = profile?.slug ? `https://${profile.slug}.closeandrelax.com` : null;

  const handlePreviewMyHub = () => {
    if (!profile?.slug) {
      showToast('Your realtor subdomain has not been assigned yet.');
      return;
    }

    if (!profile?.is_published) {
      showToast('Publish your hub before opening the live public link.');
      return;
    }

    window.open(publicHubUrl, '_blank', 'noopener,noreferrer');
  };

  if (isRealtorSubdomain) {
    if (publicProfileLoading) {
      return <PublicHubStatusPage loading />;
    }

    if (publicProfileError || !publicProfile) {
      return <PublicHubStatusPage />;
    }

    return <PublicRealtorHubDesign profile={publicProfile} fallbackResources={STANDARD_HOME_RESOURCES} />;
  }

  return (
    <div className="min-h-screen bg-cream-warm text-charcoal-body font-body antialiased selection:bg-[#E4D5BE] selection:text-[#191816]">
      <style>{customStyles}</style>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#191816] text-[#FAF7F2] px-5 py-3 rounded-2xl shadow-luxury text-xs font-medium border border-neutral-700 flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-[#B5966B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Navigation Header */}
      <header className="sticky top-0 z-40 bg-cream-warm/90 backdrop-blur-md border-b border-cream-border transition-all">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
          <button
            onClick={() => setCurrentView('marketing')}
            className="flex items-center gap-3 group text-left"
          >
            <div className="w-9 h-9 rounded-full border border-[#B5966B]/70 flex items-center justify-center bg-cream-card text-charcoal-deep font-editorial font-semibold text-xl group-hover:border-[#9B7E54] transition-colors">
              C
            </div>
            <div className="flex flex-col">
              <span className="font-editorial text-2xl font-semibold tracking-tight text-charcoal-deep leading-none">
                Close &amp; Relax
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-charcoal-muted font-medium mt-0.5">
                Homeowner Concierge
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-charcoal-muted">
            {currentView === 'dashboard' ? (
              <button
                onClick={() => setCurrentView('marketing')}
                className="text-gold-accent hover:text-charcoal-deep font-medium transition-colors flex items-center gap-1.5"
              >
                <span>← Back to Website</span>
              </button>
            ) : (
              <>
                <a href="#how-it-works" className="hover:text-charcoal-deep transition-colors">How It Works</a>
                <a href="#features" className="hover:text-charcoal-deep transition-colors">Features</a>
                <a href="#comparison" className="hover:text-charcoal-deep transition-colors">Comparison</a>
                <a href="#philosophy" className="hover:text-charcoal-deep transition-colors">Philosophy</a>
                <a href="#pricing" className="hover:text-charcoal-deep transition-colors">Pricing</a>
                <a href="#faq" className="hover:text-charcoal-deep transition-colors">FAQ</a>
              </>
            )}
          </nav>

          {/* Header Action Items */}
          <div className="hidden sm:flex items-center gap-3.5">
            <button
              onClick={() => setLiveDemoModalOpen(true)}
              className="text-sm font-medium text-charcoal-muted hover:text-charcoal-deep px-2.5 py-2 transition-colors flex items-center gap-1.5"
            >
              <span>Live Example</span>
              <ExternalLink className="w-3.5 h-3.5 text-gold-accent" />
            </button>

            {user ? (
              <>
                {currentView !== 'dashboard' ? (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="text-sm font-medium text-charcoal-body hover:text-charcoal-deep px-3 py-2 transition-colors flex items-center gap-1.5 bg-cream-card border border-cream-border rounded-full"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-gold-accent" />
                    <span>My Hub</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentView('marketing')}
                    className="text-sm font-medium text-charcoal-muted hover:text-charcoal-deep px-3 py-2 transition-colors"
                  >
                    View Website
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-cream-subtle hover:bg-cream-border text-charcoal-deep text-sm font-medium px-4 py-2 rounded-full border border-cream-border transition-all flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-charcoal-muted" />
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleOpenLogin}
                  className="text-sm font-medium text-charcoal-body hover:text-charcoal-deep px-3 py-2 transition-colors flex items-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-charcoal-muted" />
                  <span>Log In</span>
                </button>
                <button
                  onClick={() => handleOpenSignup("partner")}
                  className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-medium px-5 py-2.5 rounded-full border border-[#191816] shadow-sm hover:shadow transition-all"
                >
                  Start Free
                </button>
              </>
            )}
          </div>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation"
            className="md:hidden p-2 rounded-lg text-charcoal-body hover:bg-cream-subtle transition-colors"
          >
            {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream-card border-b border-cream-border px-6 py-6 transition-all space-y-3">
            {currentView === 'dashboard' ? (
              <button
                onClick={() => {
                  setCurrentView('marketing');
                  setMobileMenuOpen(false);
                }}
                className="block py-2 text-base font-medium text-gold-accent"
              >
                ← Back to Marketing Website
              </button>
            ) : (
              <>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
                >
                  How It Works
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
                >
                  FAQ
                </a>
              </>
            )}

            <div className="pt-4 border-t border-cream-border flex flex-col gap-2.5">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLiveDemoModalOpen(true);
                }}
                className="w-full py-2.5 text-sm font-medium text-charcoal-deep border border-cream-border rounded-full text-center"
              >
                See Live Example
              </button>

              {user ? (
                <>
                  <button
                    onClick={() => {
                      setCurrentView('dashboard');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 text-sm font-medium text-[#FAF7F2] bg-[#191816] rounded-full text-center flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-gold-accent" />
                    <span>Open Dashboard</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full py-2.5 text-sm font-medium text-charcoal-deep border border-cream-border rounded-full text-center"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenLogin();
                    }}
                    className="w-full py-2.5 text-sm font-medium text-charcoal-deep border border-cream-border rounded-full text-center flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4 text-charcoal-muted" />
                    <span>Realtor Log In</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenSignup("partner");
                    }}
                    className="w-full py-2.5 text-sm font-medium text-[#FAF7F2] bg-[#191816] rounded-full text-center"
                  >
                    Create Free Account
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {}
      {currentView === 'dashboard' && user ? (
        <main className="max-w-6xl mx-auto px-6 sm:px-8 py-12 md:py-16">
          <div className="bg-cream-card rounded-3xl p-8 sm:p-12 border border-cream-border shadow-luxury mb-8">
            
            {/* Header / Welcome Row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-cream-border">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream-subtle border border-cream-border text-xs font-medium text-charcoal-muted mb-3">
                  <span className="w-2 h-2 rounded-full bg-gold-accent"></span>
                  <span>Realtor Dashboard</span>
                </div>
                <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-charcoal-deep">
                  Welcome, {displayName}
                </h1>
                <p className="text-sm text-charcoal-muted mt-1">
                  {displayBrokerage} {profile?.city ? `• ${profile.city}` : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handlePreviewMyHub}
                  className="px-5 py-2.5 text-xs font-semibold rounded-full bg-cream-subtle hover:bg-cream-border text-charcoal-deep border border-cream-border flex items-center gap-2 transition-all"
                >
                  <Eye className="w-3.5 h-3.5 text-gold-accent" />
                  <span>Preview My Hub</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-5 py-2.5 text-xs font-semibold rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] flex items-center gap-2 transition-all"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#B5966B]" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            {/* Hub Status Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 py-8 border-b border-cream-border">
              <div className="bg-cream-warm p-5 rounded-2xl border border-cream-border">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal-muted">Active Plan</span>
                <p className="font-editorial text-2xl font-bold text-charcoal-deep mt-1 capitalize">
                  {publicPlanName} Tier
                </p>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {displayPlan === 'premier' ? 'Up to 15 vendors + greater resource control' : displayPlan === 'pro' ? 'Up to 8 vendors + personal recommendations' : 'Standard resources + up to 3 vendors'}
                </p>
              </div>

              <div className="bg-cream-warm p-5 rounded-2xl border border-cream-border">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal-muted">Hub Status</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2.5 h-2.5 rounded-full ${profile?.is_published ? 'bg-emerald-600' : 'bg-amber-600'}`}></span>
                  <p className="font-editorial text-2xl font-bold text-charcoal-deep">
                    {profile?.is_published ? 'Published' : 'Draft / Ready'}
                  </p>
                </div>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {profile?.is_published ? 'Your concierge is live and accessible' : 'Configure fields and publish your hub'}
                </p>
                <button
                  type="button"
                  onClick={handleTogglePublish}
                  disabled={publishLoading || !profile}
                  className={`mt-4 w-full py-2 text-[11px] font-semibold rounded-xl border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                    profile?.is_published
                      ? 'bg-cream-card hover:bg-cream-subtle border-cream-border text-charcoal-deep'
                      : 'bg-[#191816] hover:bg-[#262421] border-[#191816] text-[#FAF7F2]'
                  }`}
                >
                  {publishLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{profile?.is_published ? 'Unpublish Hub' : 'Publish My Hub'}</span>
                </button>
              </div>

              <div className="bg-cream-warm p-5 rounded-2xl border border-cream-border">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal-muted">Shareable Link</span>
                {publicHubUrl ? (
                  <a
                    href={profile?.is_published ? publicHubUrl : undefined}
                    target={profile?.is_published ? '_blank' : undefined}
                    rel={profile?.is_published ? 'noreferrer' : undefined}
                    className={`font-editorial text-lg sm:text-xl font-bold mt-1 truncate block ${profile?.is_published ? 'text-charcoal-deep hover:text-gold-accent' : 'text-charcoal-muted cursor-default'}`}
                  >
                    {profile.slug}.closeandrelax.com
                  </a>
                ) : (
                  <p className="font-editorial text-lg sm:text-xl font-bold text-charcoal-muted mt-1 truncate">Subdomain pending setup</p>
                )}
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {profile?.is_published ? 'Live and ready to share with clients' : 'Your link becomes public when the hub is published'}
                </p>
              </div>
            </div>

            {/* Dashboard Workspace Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
              
              {/* My Profile Card */}
              <div className="bg-cream-warm p-6 rounded-2xl border border-cream-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5 text-gold-accent" />
                      <h3 className="font-editorial text-xl font-bold text-charcoal-deep">My Profile &amp; Identity</h3>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-cream-card rounded border border-cream-border text-charcoal-muted">
                      Profile Config
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mb-5 bg-cream-card border border-cream-border rounded-2xl p-4">
                    <div className="w-16 h-16 rounded-full border border-[#B5966B]/70 bg-cream-subtle overflow-hidden shrink-0 flex items-center justify-center">
                      {allowsPremiumProfile && profile?.headshot_url ? (
                        <img src={profile.headshot_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-editorial text-xl font-semibold text-charcoal-deep">{getInitials(displayName)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-editorial text-lg font-semibold text-charcoal-deep truncate">{displayName}</p>
                      <p className="text-[11px] text-charcoal-muted truncate">{profile?.phone || 'Add a public phone number'}</p>
                      <p className="text-[10px] text-gold-accent mt-1">{allowsPremiumProfile ? (profile?.welcome_message ? 'Custom welcome message active' : 'Using standard welcome message') : 'Core unlocks headshot & custom profile content'}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-charcoal-muted mb-6">
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Full Name</span>
                      <span className="text-right">{displayName}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Brokerage</span>
                      <span className="text-right">{displayBrokerage}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Market City</span>
                      <span className="text-right">{profile?.city || user?.user_metadata?.market_city || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Public Email</span>
                      <span className="text-right truncate">{profile?.email || user.email}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Public Phone</span>
                      <span className="text-right truncate">{profile?.phone || 'Not added'}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Website</span>
                      <span className="text-right truncate max-w-[55%]">{allowsPremiumProfile ? (profile?.website_url || 'Not added') : 'Core feature'}</span>
                    </div>
                    <div className="flex justify-between gap-4 py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Realtor Subdomain</span>
                      <span className="text-right truncate">{profile?.slug ? `${profile.slug}.closeandrelax.com` : 'Not assigned'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleOpenProfileEditor}
                  className="w-full py-2.5 text-xs font-semibold rounded-xl bg-cream-card hover:bg-cream-subtle border border-cream-border text-charcoal-deep transition-colors"
                >
                  Edit Profile Information
                </button>
              </div>

              {/* My Vendors Card */}
              <div className="bg-cream-warm p-6 rounded-2xl border border-cream-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-gold-accent" />
                      <h3 className="font-editorial text-xl font-bold text-charcoal-deep">My Preferred Vendors</h3>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-cream-card rounded border border-cream-border text-charcoal-muted">
                      {customVendors.length}/{vendorLimit} Custom
                    </span>
                  </div>

                  <p className="text-xs text-charcoal-muted leading-relaxed mb-4">
                    Your hub includes the standard Close &amp; Relax smart-home resource, and your <span className="font-semibold text-charcoal-deep">{publicPlanName}</span> plan lets you add up to {vendorLimit} of your own trusted local professionals.
                  </p>

                  <div className="bg-cream-card p-3 rounded-xl border border-cream-border text-[11px] text-charcoal-muted space-y-2">
                    <p className="font-semibold text-charcoal-deep">Current vendor setup</p>
                    <p>• {standardVendors.length || 1} standard Close &amp; Relax resource</p>
                    <p>• {customVendors.length} of {vendorLimit} custom vendor slots used</p>
                    <p>• Recommendation notes: {allowsVendorRecommendations ? 'Enabled' : 'Available on Core & Pro'}</p>
                    {allowsDefaultVendorControl && <p>• Standard resource replacement/removal: Enabled</p>}
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleOpenVendorManager}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl bg-cream-card hover:bg-cream-subtle border border-cream-border text-charcoal-deep transition-colors"
                  >
                    Manage Vendors
                  </button>
                </div>
              </div>

            </div>

            {/* Quick Return Bar */}
            <div className="mt-8 pt-6 border-t border-cream-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-charcoal-muted">
              <span>Looking to review marketing details or plan features?</span>
              <button
                onClick={() => setCurrentView('marketing')}
                className="font-medium text-gold-accent hover:text-charcoal-deep underline"
              >
                Return to Marketing Homepage
              </button>
            </div>

          </div>
        </main>
      ) : (
        <>
          {}
          <section className="pt-14 pb-20 md:pt-24 md:pb-32 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Left Hero Column */}
              <div className="lg:col-span-7 flex flex-col items-start text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cream-subtle border border-cream-border text-xs font-medium text-charcoal-muted mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-accent"></span>
                  <span>A Personally Branded Post-Closing Gift for Realtors</span>
                </div>

                <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl text-charcoal-deep font-semibold leading-[1.14] mb-6">
                  The Closing Gift They’ll <span className="italic font-normal text-gold-accent">Actually Keep.</span>
                </h1>

                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed max-w-2xl mb-8 font-normal">
                  Give every buyer a personally branded homeowner concierge with your trusted professionals, your contact information, and one-tap access from their phone.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto mb-8">
                  {user ? (
                    <button
                      onClick={() => setCurrentView('dashboard')}
                      className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all text-center flex items-center justify-center gap-2"
                    >
                      <LayoutDashboard className="w-4 h-4 text-gold-accent" />
                      <span>Open My Dashboard</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenSignup("partner")}
                      className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all text-center"
                    >
                      Start Free
                    </button>
                  )}
                  <button
                    onClick={() => setLiveDemoModalOpen(true)}
                    className="bg-cream-card hover:bg-cream-subtle text-charcoal-body border border-cream-border text-base font-medium px-7 py-3.5 rounded-full transition-all text-center flex items-center justify-center gap-2"
                  >
                    <span>See a Live Example</span>
                    <ArrowRight className="w-4 h-4 text-gold-accent" />
                  </button>
                </div>

                {/* Reassurance Line */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-charcoal-muted font-medium pt-3 border-t border-cream-border w-full">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-gold-accent" />
                    No client login
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-gold-accent" />
                    No App Store download
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-gold-accent" />
                    No vendor fees
                  </span>
                </div>
              </div>

              {/* Right Hero Column - Interactive Phone Simulator */}
              <div className="lg:col-span-5 flex justify-center relative">
                <div className="absolute -inset-6 bg-[#E4D5BE]/35 rounded-full blur-3xl pointer-events-none"></div>

                {/* Phone Device Frame */}
                <div className="relative w-full max-w-[340px] bg-[#191816] rounded-[44px] p-3 shadow-phone border border-neutral-700">
                  
                  {/* Speaker / Notch */}
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-[#191816] rounded-full z-30 flex items-center justify-center">
                    <div className="w-10 h-1 bg-neutral-700 rounded-full"></div>
                    <div className="w-2.5 h-2.5 bg-neutral-800 rounded-full ml-2"></div>
                  </div>

                  {/* Inner Screen */}
                  <div className="w-full bg-[#FAF7F2] rounded-[36px] overflow-hidden border border-cream-border relative text-charcoal-body flex flex-col pt-7 pb-5 px-3.5 min-h-[570px]">
                    
                    {/* Hub Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-cream-border mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-gold-accent/80 bg-cream-subtle shrink-0">
                          <img
                            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=80"
                            alt="Liz Marks-Strauss"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h4 className="text-xs font-editorial font-bold text-charcoal-deep leading-tight">Liz Marks-Strauss</h4>
                          <p className="text-[10px] text-charcoal-muted">Associate Broker • Sotheby's</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => showToast("Simulating call to Liz...")}
                          className="text-[10px] bg-[#191816] text-[#FAF7F2] px-2.5 py-1 rounded-full font-medium"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => showToast("Simulating text to Liz...")}
                          className="text-[10px] bg-cream-card border border-cream-border text-charcoal-deep px-2.5 py-1 rounded-full font-medium"
                        >
                          Text
                        </button>
                      </div>
                    </div>

                    {/* Welcome Card */}
                    <div className="bg-cream-card rounded-xl p-3 border border-cream-border mb-3 text-left">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-gold-accent block">Homeowner Concierge</span>
                      <p className="font-editorial text-sm font-semibold text-charcoal-deep mt-0.5">Welcome home, Sarah &amp; David.</p>
                      <p className="text-[10px] text-charcoal-muted mt-0.5 leading-snug">My personal roster of trusted home specialists you can rely on anytime.</p>
                    </div>

                    {/* Add to Home Screen Banner inside Mockup */}
                    <div className="bg-[#FAF6EF] border border-[#E4D5BE] rounded-lg p-2.5 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-[#191816] text-[#FAF7F2] flex items-center justify-center text-[9px] font-bold font-editorial">
                          LMS
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-charcoal-deep leading-tight">Save to Home Screen</p>
                          <p className="text-[9px] text-charcoal-muted">One tap to access Liz anytime</p>
                        </div>
                      </div>
                      <button
                        onClick={() => showToast("Simulating 1-tap PWA install")}
                        className="text-[9px] bg-[#191816] text-[#FAF7F2] px-2 py-0.5 rounded font-medium"
                      >
                        Save
                      </button>
                    </div>

                    {/* Mini Cards Container */}
                    <div className="space-y-2 flex-1 text-left">
                      {LIZ_VENDORS.slice(0, 2).map((vendor, idx) => (
                        <div key={idx} className="bg-cream-card rounded-xl p-2.5 border border-cream-border">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <span className="text-[9px] font-semibold text-gold-accent uppercase tracking-wider">{vendor.category}</span>
                              <h5 className="text-[11px] font-semibold text-charcoal-deep">{vendor.name}</h5>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => showToast(`Calling ${vendor.name}`)}
                                className="text-[9px] text-charcoal-deep bg-cream-subtle px-2 py-0.5 rounded font-medium"
                              >
                                Call
                              </button>
                            </div>
                          </div>
                          <p className="text-[9px] text-charcoal-muted italic bg-cream-subtle/70 p-1.5 rounded border border-cream-border/60">
                            {vendor.note}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Phone Mockup Footer */}
                    <div className="pt-2 text-center border-t border-cream-border mt-2">
                      <span className="text-[8px] tracking-wider text-charcoal-muted uppercase">Powered by Close &amp; Relax</span>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          </section>

          {}
          <section className="py-20 md:py-28 bg-cream-card border-y border-cream-border">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="max-w-3xl mx-auto text-center mb-16">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                  The Post-Closing Dilemma
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                  Closing Day Shouldn’t Be the End of the Relationship.
                </h2>
                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed">
                  Buyers walk away from the closing table thrilled, but their real homeowner journey has just begun. They immediately need locksmiths, security setup, plumbers, HVAC checkups, movers, cleaners, and painters. Yet your recommendations usually get buried in fragmented text message threads, scattered emails, or a lost paper PDF.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto items-stretch">
                
                {/* Without Close & Relax */}
                <div className="bg-cream-warm rounded-3xl p-8 sm:p-10 border border-cream-border flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-cream-border">
                      <span className="text-xs uppercase tracking-wider font-bold text-charcoal-muted">The Status Quo</span>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-neutral-200 text-charcoal-body rounded-full">
                        Without Close &amp; Relax
                      </span>
                    </div>
                    
                    <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-4">
                      Scattered, Forgotten &amp; Frustrating
                    </h3>

                    <ul className="space-y-4 text-sm text-charcoal-muted">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-cream-subtle text-charcoal-body flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                        <span>Recommendations buried across SMS chains and old email threads.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-cream-subtle text-charcoal-body flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                        <span>Paper vendor handouts and PDF attachments lost in moving boxes or downloads folders.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-cream-subtle text-charcoal-body flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                        <span>Clients forced to rely on desperate Google and Yelp searches for unvetted strangers.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-cream-subtle text-charcoal-body flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✕</span>
                        <span>Your contact information slips away into the contact graveyard within months.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8 pt-6 border-t border-cream-border text-xs text-charcoal-muted italic">
                    Result: Forgotten relationships, lost referrals, and unsupported homeowners.
                  </div>
                </div>

                {/* With Close & Relax */}
                <div className="bg-cream-card rounded-3xl p-8 sm:p-10 border border-[#B5966B]/60 shadow-luxury flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-36 h-36 bg-[#E4D5BE]/40 rounded-full blur-2xl pointer-events-none"></div>

                  <div>
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E8E2D8]">
                      <span className="text-xs uppercase tracking-wider font-bold text-gold-accent">The Elevated Standard</span>
                      <span className="text-xs font-semibold px-2.5 py-1 bg-[#FAF6EF] text-gold-accent border border-[#E4D5BE] rounded-full">
                        With Close &amp; Relax
                      </span>
                    </div>

                    <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-4">
                      One Elegant Hub Saved on Their Phone
                    </h3>

                    <ul className="space-y-4 text-sm text-charcoal-body">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                        <span><strong>One branded digital home concierge:</strong> your profile photo, essential contact info, and preferred specialists.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                        <span><strong>Saved directly to their home screen</strong> as a fast web app with zero App Store friction.</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                        <span><strong>Personal guidance from you:</strong> your own handpicked vendors (3 on Free, 8 on Core, up to 15 on Pro).</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                        <span><strong>You remain their lifelong real estate advisor:</strong> one-tap Call and Text buttons permanently in their pocket.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-8 pt-6 border-t border-[#E8E2D8] text-xs font-medium text-gold-accent">
                    Result: A thoughtful closing gift that delivers everyday peace of mind for years.
                  </div>
                </div>

              </div>

            </div>
          </section>

          {}
          <section id="features" className="py-20 md:py-28 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                Designed Exclusively for Agents
              </span>
              <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                Your Homeowner Concierge. Branded Around You.
              </h2>
              <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed">
                Everything your client needs to settle into their home with total peace of mind, managed directly from your simple Realtor dashboard.
              </p>
            </div>

            {/* 6 Key Benefits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* Benefit 1 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    Realtor Profile Image &amp; Identity
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Your essential identity starts on Free. Core and Pro unlock your professional headshot and richer personalization so the hub feels unmistakably yours.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Always keeps you top-of-mind
                </div>
              </div>

              {/* Benefit 2 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    Curated Trusted Professionals
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Built around trusted homeowner resources, plus your own preferred vendors: up to 3 on Free, 8 on Core, or 15 on Pro with greater vendor/resource control.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Vetted quality standards
                </div>
              </div>

              {/* Benefit 3 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    Personal Realtor Recommendations
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Core and Pro users can add a personal one-line endorsement beneath each preferred vendor (for example, “Ask for Marco—he has taken great care of my clients”), reinforcing your trusted authority. Free users can still add preferred vendors without custom recommendation notes.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Authentic word-of-mouth trust
                </div>
              </div>

              {/* Benefit 4 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <Phone className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    One-Tap Call &amp; Website Actions
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Zero friction for the homeowner. One tap dials the dispatcher directly or launches the provider's private scheduling page directly in their browser.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Effortless homeowner utility
                </div>
              </div>

              {/* Benefit 5 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    Save-to-Phone PWA Experience
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Homeowners can tap "Add to Phone" to install your hub right to their iPhone or Android home screen without ever visiting the App Store or remembering passwords.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Zero login or download barrier
                </div>
              </div>

              {/* Benefit 6 */}
              <div className="bg-cream-card rounded-2xl p-8 border border-cream-border hover:border-gold-accent/60 transition-all shadow-luxury flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cream-subtle border border-cream-border flex items-center justify-center text-gold-accent mb-6">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-editorial text-xl font-semibold text-charcoal-deep mb-3">
                    Direct Realtor Call/Text Access
                  </h3>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    Your personal Call and Text buttons remain comfortably accessible throughout their experience. When life changes or future moves arrive, you are their first call.
                  </p>
                </div>
                <div className="mt-6 pt-4 border-t border-cream-border text-xs text-charcoal-muted">
                  Protects repeat transactions &amp; referrals
                </div>
              </div>

            </div>
          </section>

          {}
          <section id="comparison" className="py-20 md:py-28 bg-cream-card border-t border-cream-border">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="max-w-3xl mx-auto text-center mb-12">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                  Honest &amp; Curated
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                  Not Another Vendor Directory.
                </h2>
                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed mb-6">
                  We built Close &amp; Relax to protect your relationship with your clients—not to monetize ad clicks or sell buyer leads to competing service providers.
                </p>

                {/* Prominently Featured Trust Statement */}
                <div className="inline-block bg-cream-warm border border-gold-accent/70 rounded-2xl px-6 py-4 shadow-sm">
                  <p className="font-editorial text-lg sm:text-xl font-semibold text-charcoal-deep italic">
                    “Recommendations should be based on trust—not who paid to appear there.”
                  </p>
                </div>
              </div>

              {/* Comparison Table */}
              <div className="max-w-4xl mx-auto mt-12 overflow-x-auto rounded-2xl border border-cream-border bg-cream-warm">
                <table className="w-full text-left border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b border-cream-border bg-cream-subtle/80">
                      <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-charcoal-muted w-1/3">
                        Feature &amp; Philosophy
                      </th>
                      <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-charcoal-muted w-1/3">
                        Typical Platforms &amp; Portals
                      </th>
                      <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-gold-accent w-1/3 bg-[#FAF6EF] border-l border-[#E4D5BE]">
                        Close &amp; Relax
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-border text-sm">
                    {COMPARISON_ROWS.map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-4 px-6 font-medium text-charcoal-deep align-top">
                          {row.feature}
                        </td>
                        <td className="py-4 px-6 text-charcoal-muted align-top">
                          {row.portal}
                        </td>
                        <td className="py-4 px-6 font-medium text-charcoal-deep bg-[#FAF6EF]/50 border-l border-[#E4D5BE] align-top">
                          {row.closeAndRelax}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </section>

          {}
          <section id="philosophy" className="py-20 md:py-28 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="max-w-4xl mx-auto bg-cream-card rounded-3xl p-8 sm:p-14 border border-cream-border shadow-luxury relative">
              
              <div className="text-center mb-10">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                  Our Core Promise
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-4">
                  Built to Be Kept.
                </h2>
                <p className="font-editorial text-xl sm:text-2xl text-gold-accent italic">
                  “Your closing gift shouldn’t expire.”
                </p>
              </div>

              <div className="space-y-6 text-charcoal-muted text-base leading-relaxed font-normal">
                <p>
                  Too many real estate tools operate like trap doors: you gift a client access to a portal, but the moment you adjust your marketing budget or change software providers, your client receives an error page or a broken link.
                </p>
                <p>
                  At <strong>Close &amp; Relax</strong>, we believe a closing gift given to a homeowner belongs to that homeowner. They never pay a fee, they never need an account, and they should never lose access to their basic resource hub.
                </p>
                
                <div className="bg-cream-warm rounded-2xl p-6 border border-cream-border text-charcoal-deep mt-4">
                  <h4 className="font-editorial font-semibold text-lg text-charcoal-deep mb-2">
                    The Non-Expiring Assurance
                  </h4>
                  <p className="text-sm text-charcoal-muted leading-relaxed">
                    If an agent ever steps down from Core or Pro, clients are not stranded. Paid-only personalization is hidden and the hub gracefully returns to the Free experience, preserving the same homeowner link and essential utility.
                  </p>
                </div>
              </div>

            </div>
          </section>

          {}
          <section id="how-it-works" className="py-20 md:py-28 bg-cream-card border-y border-cream-border">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                  Simple &amp; Dignified
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                  How It Works
                </h2>
                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed">
                  No complicated onboarding sprints or frustrating technical barriers. Set up your bespoke concierge hub from your dashboard in minutes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 max-w-5xl mx-auto">
                
                {/* Step 1 */}
                <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
                  <div>
                    <div className="font-editorial text-4xl font-light text-gold-accent mb-4">01</div>
                    <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                      Create Your Account
                    </h3>
                    <p className="text-sm text-charcoal-muted leading-relaxed">
                      Sign up in seconds to access your personal Realtor dashboard. Choose your preferred plan to begin building your custom hub immediately.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                    Instant self-service setup
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
                  <div>
                    <div className="font-editorial text-4xl font-light text-gold-accent mb-4">02</div>
                    <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                      Personalize Your Hub
                    </h3>
                    <p className="text-sm text-charcoal-muted leading-relaxed">
                      Enter your contact details, upload your profile photo, add personal recommendation notes, and curate your trusted local professionals according to your plan.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                    Intuitive field editing
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
                  <div>
                    <div className="font-editorial text-4xl font-light text-gold-accent mb-4">03</div>
                    <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                      Publish &amp; Share
                    </h3>
                    <p className="text-sm text-charcoal-muted leading-relaxed">
                      Publish your hub instantly. Send the dedicated link via text or email, and guide your home buyers to save it directly to their phone home screen.
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                    A closing gift they'll keep
                  </div>
                </div>

              </div>

            </div>
          </section>

          {}
          <section className="py-20 md:py-32 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Visual Side: Large Phone Demonstration */}
              <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
                <div className="relative w-full max-w-[360px]">
                  
                  {/* Home Screen App Icon Floating Badge */}
                  <div className="absolute -top-6 -left-6 z-20 bg-cream-card p-4 rounded-2xl border border-cream-border shadow-luxury flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#191816] text-[#FAF7F2] flex items-center justify-center font-editorial text-xl font-bold shadow">
                      C&amp;R
                    </div>
                    <div>
                      <p className="text-xs font-bold text-charcoal-deep">Liz Marks-Strauss</p>
                      <p className="text-[10px] text-charcoal-muted">Home Concierge App</p>
                      <span className="inline-block mt-0.5 text-[9px] bg-[#FAF6EF] text-gold-accent border border-[#E4D5BE] px-1.5 py-0.5 rounded font-medium">
                        On Home Screen
                      </span>
                    </div>
                  </div>

                  {/* Phone Device */}
                  <div className="bg-[#191816] rounded-[44px] p-3 shadow-phone border border-neutral-700">
                    <div className="bg-cream-warm rounded-[36px] overflow-hidden border border-cream-border p-5 text-center flex flex-col justify-between min-h-[480px]">
                      
                      {/* Top Screen */}
                      <div className="pt-3 pb-2">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gold-accent mx-auto mb-3 shadow-sm">
                          <img
                            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=80"
                            alt="Realtor Avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <h4 className="font-editorial text-xl font-bold text-charcoal-deep">Liz Marks-Strauss</h4>
                        <p className="text-xs text-charcoal-muted font-medium">Your Trusted Advisor</p>
                        <div className="mt-3 flex justify-center gap-2">
                          <button
                            onClick={() => showToast("Calling Liz Marks-Strauss...")}
                            className="text-xs bg-[#191816] text-[#FAF7F2] px-4 py-1.5 rounded-full font-medium"
                          >
                            Call Liz
                          </button>
                          <button
                            onClick={() => showToast("Messaging Liz Marks-Strauss...")}
                            className="text-xs bg-cream-card border border-cream-border text-charcoal-deep px-4 py-1.5 rounded-full font-medium"
                          >
                            Text Liz
                          </button>
                        </div>
                      </div>

                      {/* Simulated PWA Box */}
                      <div className="bg-cream-card border border-[#B5966B]/60 rounded-2xl p-4 text-left shadow-sm my-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Smartphone className="w-4 h-4 text-gold-accent" />
                          <span className="text-xs font-bold text-charcoal-deep">Add to Home Screen</span>
                        </div>
                        <p className="text-xs text-charcoal-muted leading-snug">
                          Keep Liz’s concierge on your phone just like a native app. No App Store account or updates needed.
                        </p>
                        <button
                          onClick={() => showToast("Added to Home Screen")}
                          className="mt-3 w-full py-2 bg-[#191816] text-[#FAF7F2] text-xs font-semibold rounded-lg text-center block"
                        >
                          Install to Phone (1 Tap)
                        </button>
                      </div>

                      {/* Vendor preview */}
                      <div className="bg-cream-card rounded-xl p-3 border border-cream-border text-left">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-semibold text-gold-accent uppercase">Emergency Plumber</span>
                          <span className="text-[9px] bg-cream-subtle px-2 py-0.5 rounded text-charcoal-deep">24/7 Response</span>
                        </div>
                        <p className="text-xs font-bold text-charcoal-deep mt-1">Highland Climate &amp; Drain</p>
                      </div>

                    </div>
                  </div>

                </div>
              </div>

              {/* Right Text Copy */}
              <div className="lg:col-span-6 flex flex-col items-start text-left order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cream-subtle border border-cream-border text-xs font-medium text-charcoal-muted mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-accent"></span>
                  <span>Zero-Friction Technology</span>
                </div>

                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                  Their Homeowner Guide. <span className="italic text-gold-accent">One Tap Away.</span>
                </h2>

                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed mb-6 font-normal">
                  There is no App Store or Google Play download required. Clients simply open your bespoke link in Safari or Chrome and choose <span className="font-semibold text-charcoal-deep">“Add to Phone”</span>.
                </p>

                <p className="text-base text-charcoal-muted leading-relaxed mb-8">
                  It creates an app-like PWA icon on their mobile home screen with your branding. Every time they unlock their device, your care and thoughtfulness are on display.
                </p>

                {/* Prominently Featured Longevity Quote */}
                <div className="border-l-2 border-gold-accent pl-4 py-1 mb-8">
                  <p className="font-editorial text-xl font-semibold text-charcoal-deep italic leading-snug">
                    “When they need a plumber six months from now, your name is still there.”
                  </p>
                </div>

                {user ? (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md transition-all flex items-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-gold-accent" />
                    <span>Go to My Dashboard</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenSignup("partner")}
                    className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md transition-all"
                  >
                    Build My Hub
                  </button>
                )}
              </div>

            </div>
          </section>

          {}
          <section id="pricing" className="py-20 md:py-28 bg-cream-card border-t border-cream-border">
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
              
              <div className="text-center max-w-3xl mx-auto mb-16">
                <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                  Transparent Membership
                </span>
                <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                  Invest in Relationships, Not Ad Clicks.
                </h2>
                <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed">
                  Start free with your essential contact identity and up to 3 preferred vendors, then unlock your headshot, richer personalization, and more vendor capacity when you are ready.
                </p>
              </div>

              {foundingPricingActive && (
                <div className="max-w-3xl mx-auto -mt-8 mb-10 bg-[#F4EBDD] border border-[#E4D5BE] rounded-2xl px-5 py-4 text-center">
                  <p className="text-sm font-semibold text-charcoal-deep">Founding Member pricing is open through {FOUNDING_PRICING_END_LABEL}.</p>
                  <p className="text-xs text-charcoal-muted mt-1">Lock in Core at $19/month or Pro at $29/month while your subscription stays continuously active. Cancel and return later, and current pricing applies.</p>
                </div>
              )}

              {/* Pricing Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
                {PRICING_TIERS.map((tier) => (
                  <div
                    key={tier.id}
                    className={`rounded-3xl p-8 flex flex-col justify-between transition-all relative ${
                      tier.popular
                        ? 'bg-cream-warm border-2 border-gold-accent shadow-luxury'
                        : 'bg-cream-warm/70 border border-cream-border hover:border-cream-border/80'
                    }`}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gold-accent text-[#FAF7F2] text-xs font-semibold px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        Most Popular
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                          {tier.name}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-1 bg-cream-subtle text-charcoal-deep rounded-full">
                          {tier.badge}
                        </span>
                      </div>

                      <div className="mb-6">
                        {tier.id === 'partner' ? (
                          <>
                            <span className="font-editorial text-4xl font-bold text-charcoal-deep">Free</span>
                            <span className="text-sm text-charcoal-muted font-medium ml-1">{tier.period}</span>
                          </>
                        ) : foundingPricingActive ? (
                          <>
                            <div className="flex items-end gap-2 flex-wrap">
                              <span className="font-editorial text-4xl font-bold text-charcoal-deep">${tier.foundingPrice}</span>
                              <span className="text-sm text-charcoal-muted font-medium mb-1">/ month</span>
                              <span className="text-sm text-charcoal-muted line-through mb-1">${tier.regularPrice}</span>
                            </div>
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-gold-accent mt-1">Founding rate • through {FOUNDING_PRICING_END_LABEL}</p>
                          </>
                        ) : (
                          <>
                            <span className="font-editorial text-4xl font-bold text-charcoal-deep">${tier.regularPrice}</span>
                            <span className="text-sm text-charcoal-muted font-medium ml-1">/ month</span>
                          </>
                        )}
                      </div>

                      <p className="text-sm text-charcoal-muted mb-6 pb-6 border-b border-cream-border leading-relaxed">
                        {tier.description}
                      </p>

                      <ul className="space-y-3.5 text-sm text-charcoal-body mb-8">
                        {tier.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2.5">
                            <Check className="w-4 h-4 text-gold-accent shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <button
                        onClick={() => {
                          if (user) {
                            showToast(`You are on the ${publicPlanName} tier. Manage your hub in your dashboard.`);
                            setCurrentView('dashboard');
                          } else {
                            handleOpenSignup(tier.id);
                          }
                        }}
                        className={`w-full py-3.5 px-6 rounded-full text-sm font-semibold transition-all text-center ${
                          tier.popular
                            ? 'bg-gold-accent hover:bg-[#9B7E54] text-[#FAF7F2] shadow-sm'
                            : 'bg-[#191816] hover:bg-[#262421] text-[#FAF7F2]'
                        }`}
                      >
                        {user ? 'Select In Dashboard' : tier.ctaText}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Self-Service Empowering Note */}
              <div className="mt-12 text-center max-w-2xl mx-auto bg-cream-subtle/60 rounded-2xl p-5 border border-cream-border">
                <p className="text-xs text-charcoal-muted leading-relaxed">
                  <strong className="text-charcoal-deep">Instant Self-Service:</strong> All plans include immediate dashboard access upon sign up. Upgrade, downgrade, or update your concierge fields at any time with instant live publishing.
                </p>
              </div>

            </div>
          </section>

          {}
          <section id="faq" className="py-20 md:py-28 max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
            <div className="text-center mb-16">
              <span className="text-xs uppercase tracking-[0.2em] font-semibold text-gold-accent block mb-3">
                Clear &amp; Direct
              </span>
              <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                Frequently Asked Questions
              </h2>
              <p className="text-base text-charcoal-muted">
                Everything you need to know about setting up and gifting Close &amp; Relax.
              </p>
            </div>

            <div className="space-y-4">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="bg-cream-card rounded-2xl border border-cream-border overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggleFaq(idx)}
                      className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-editorial text-lg sm:text-xl font-semibold text-charcoal-deep hover:text-gold-accent transition-colors"
                    >
                      <span>{item.question}</span>
                      <span className="text-gold-accent transition-transform duration-300 font-sans font-normal text-xl">
                        {isOpen ? '–' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 text-sm sm:text-base text-charcoal-muted leading-relaxed">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {}
          <section className="py-20 md:py-28 bg-cream-card border-t border-cream-border">
            <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center">
              
              <div className="w-14 h-14 rounded-full border border-gold-accent/80 flex items-center justify-center bg-cream-warm text-gold-accent font-editorial font-bold text-2xl mx-auto mb-6">
                C
              </div>

              <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-semibold text-charcoal-deep leading-tight mb-6">
                You Worked Hard to Earn Their Trust.<br className="hidden sm:inline" /> Don’t Let Closing Day Be Where the Relationship Ends.
              </h2>

              <p className="text-base sm:text-lg text-charcoal-muted leading-relaxed max-w-2xl mx-auto mb-10 font-normal">
                Give every homeowner something useful they can keep. Set up your personalized concierge in just minutes.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {user ? (
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="w-full sm:w-auto bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-4 rounded-full shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4 text-gold-accent" />
                    <span>Go to My Dashboard</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenSignup("partner")}
                    className="w-full sm:w-auto bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-4 rounded-full shadow-md transition-all"
                  >
                    Get Your Free Close &amp; Relax Hub
                  </button>
                )}
                <button
                  onClick={() => setLiveDemoModalOpen(true)}
                  className="w-full sm:w-auto bg-cream-warm hover:bg-cream-subtle text-charcoal-deep border border-cream-border text-base font-medium px-8 py-4 rounded-full transition-all"
                >
                  See a Live Example
                </button>
              </div>

              <p className="text-xs text-charcoal-muted mt-6">
                Zero client login • No App Store download • Free forever option
              </p>

            </div>
          </section>

          {}
          <footer className="bg-cream-warm border-t border-cream-border py-12 px-6 sm:px-8 lg:px-12 text-sm text-charcoal-muted">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
              
              <div className="flex items-center gap-3">
                <span className="font-editorial text-xl font-semibold text-charcoal-deep">Close &amp; Relax</span>
                <span className="text-charcoal-muted">•</span>
                <span className="text-xs text-charcoal-muted">The closing gift they’ll actually keep</span>
              </div>

              <div className="flex items-center gap-6 text-xs text-charcoal-muted">
                <a href="#how-it-works" className="hover:text-charcoal-deep transition-colors">How It Works</a>
                <a href="#features" className="hover:text-charcoal-deep transition-colors">Features</a>
                <a href="#pricing" className="hover:text-charcoal-deep transition-colors">Pricing</a>
                <a href="#faq" className="hover:text-charcoal-deep transition-colors">FAQ</a>
                {user ? (
                  <button onClick={() => setCurrentView('dashboard')} className="hover:text-charcoal-deep transition-colors font-medium text-gold-accent">
                    My Dashboard
                  </button>
                ) : (
                  <button onClick={handleOpenLogin} className="hover:text-charcoal-deep transition-colors">
                    Realtor Log In
                  </button>
                )}
                <button onClick={() => setContactModalOpen(true)} className="hover:text-charcoal-deep transition-colors">
                  Contact Support
                </button>
              </div>

              <div className="text-xs text-charcoal-muted flex items-center gap-2">
                <span>&copy; {new Date().getFullYear()} Close &amp; Relax.</span>
                <span>•</span>
                <span className="text-gold-accent font-editorial italic">Powered by Close &amp; Relax</span>
              </div>

            </div>
          </footer>
        </>
      )}

      {}
      {liveDemoModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-2xl w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">Live Interactive Sample</span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">Liz Marks-Strauss Homeowner Hub</h3>
              </div>
              <button
                onClick={() => setLiveDemoModalOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 max-h-[75vh] overflow-y-auto space-y-6">
              
              {/* Realtor Banner */}
              <div className="bg-cream-card p-5 rounded-2xl border border-cream-border flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gold-accent shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=240&q=80"
                    alt="Liz Marks-Strauss"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-editorial text-2xl font-bold text-charcoal-deep">Liz Marks-Strauss</h4>
                      <p className="text-xs text-charcoal-muted font-medium">Licensed Associate Broker • Sotheby's</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => showToast("Calling Liz Marks-Strauss...")}
                        className="text-xs bg-[#191816] text-[#FAF7F2] px-3.5 py-1.5 rounded-full font-medium shadow-sm"
                      >
                        Call Liz
                      </button>
                      <button
                        onClick={() => showToast("Messaging Liz Marks-Strauss...")}
                        className="text-xs bg-cream-subtle text-charcoal-deep border border-cream-border px-3.5 py-1.5 rounded-full font-medium"
                      >
                        Text Liz
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-charcoal-muted mt-3 italic bg-cream-warm p-2.5 rounded-lg border border-cream-border">
                    “Welcome to the neighborhood! Whenever you need anything taken care of for your home, tap into these trusted partners I personally recommend.”
                  </p>
                </div>
              </div>

              {/* PWA Save to Phone Simulation Banner */}
              <div className="bg-[#FAF6EF] border border-[#E4D5BE] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#191816] text-[#FAF7F2] flex items-center justify-center font-editorial font-bold text-sm">
                    LMS
                  </div>
                  <div>
                    <p className="text-xs font-bold text-charcoal-deep">Add to Phone Home Screen</p>
                    <p className="text-[11px] text-charcoal-muted">Access this concierge instantly without visiting the App Store.</p>
                  </div>
                </div>
                <button
                  onClick={() => showToast("Demonstrating 1-tap mobile installation")}
                  className="text-xs font-semibold bg-gold-accent hover:bg-[#9B7E54] text-[#FAF7F2] px-4 py-2 rounded-lg whitespace-nowrap shadow-sm transition-colors"
                >
                  Add to Phone
                </button>
              </div>

              {/* Curated Vendor List */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
                  Curated Local Partners (Live Sample)
                </h5>

                {LIZ_VENDORS.map((vendor, idx) => (
                  <div key={idx} className="bg-cream-card p-4 rounded-xl border border-cream-border shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-semibold text-gold-accent uppercase">{vendor.category}</span>
                        <h6 className="text-sm font-bold text-charcoal-deep">{vendor.name}</h6>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => showToast(`Calling ${vendor.name}...`)}
                          className="text-xs px-3 py-1 bg-cream-subtle rounded font-medium text-charcoal-deep hover:bg-cream-border"
                        >
                          Call
                        </button>
                        <button
                          onClick={() => showToast(`Visiting ${vendor.name} website...`)}
                          className="text-xs px-3 py-1 bg-cream-subtle rounded font-medium text-charcoal-deep hover:bg-cream-border"
                        >
                          Website
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-charcoal-muted bg-cream-warm p-2.5 rounded border border-cream-border italic">
                      {vendor.note}
                    </p>
                  </div>
                ))}

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-cream-subtle/80 border-t border-cream-border flex items-center justify-between text-xs text-charcoal-muted">
              <span>Powered by Close &amp; Relax</span>
              {user ? (
                <button
                  onClick={() => {
                    setLiveDemoModalOpen(false);
                    setCurrentView('dashboard');
                  }}
                  className="bg-[#191816] text-[#FAF7F2] px-4 py-2 rounded-full font-medium hover:bg-[#262421]"
                >
                  Return to Dashboard
                </button>
              ) : (
                <button
                  onClick={() => {
                    setLiveDemoModalOpen(false);
                    handleOpenSignup("partner");
                  }}
                  className="bg-[#191816] text-[#FAF7F2] px-4 py-2 rounded-full font-medium hover:bg-[#262421]"
                >
                  Create Your Own Hub
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {}
      {signupModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-lg w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                  Self-Service Onboarding
                </span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">
                  Create Your Realtor Account
                </h3>
              </div>
              <button
                onClick={() => setSignupModalOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {emailConfirmationRequired ? (
                /* Email Confirmation Screen */
                <div className="text-center py-6">
                  <div className="w-14 h-14 rounded-full bg-gold-accent/15 text-gold-accent border border-gold-accent/40 flex items-center justify-center mx-auto mb-4 font-editorial text-2xl">
                    <Mail className="w-7 h-7" />
                  </div>
                  <h4 className="font-editorial text-2xl font-bold text-charcoal-deep mb-2">
                    Check Your Email
                  </h4>
                  <p className="text-sm text-charcoal-muted leading-relaxed max-w-sm mx-auto mb-6">
                    We sent a secure confirmation link to <strong className="text-charcoal-deep">{signupData.email}</strong>. Please click the link to activate your Realtor account and open your dashboard.
                  </p>
                  <button
                    onClick={() => {
                      setSignupModalOpen(false);
                      handleOpenLogin();
                    }}
                    className="px-6 py-2.5 rounded-full bg-[#191816] text-[#FAF7F2] text-xs font-medium hover:bg-[#262421]"
                  >
                    Proceed to Log In
                  </button>
                </div>
              ) : (
                <>
                  {/* Plan Selector Tab inside Signup Modal */}
                  <div className="mb-6">
                    <label className="block text-xs font-semibold text-charcoal-deep mb-2">
                      Selected Plan Tier
                    </label>
                    <div className="grid grid-cols-3 gap-2 bg-cream-card p-1 rounded-xl border border-cream-border">
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("partner")}
                        className={`py-2 px-2 text-xs rounded-lg font-medium transition-all ${
                          selectedPlan === "partner"
                            ? "bg-[#191816] text-[#FAF7F2] shadow-sm"
                            : "text-charcoal-muted hover:text-charcoal-deep"
                        }`}
                      >
                        Free
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("pro")}
                        className={`py-2 px-2 text-xs rounded-lg font-medium transition-all ${
                          selectedPlan === "pro"
                            ? "bg-[#191816] text-[#FAF7F2] shadow-sm"
                            : "text-charcoal-muted hover:text-charcoal-deep"
                        }`}
                      >
                        Core ({foundingPricingActive ? '$19 founding' : '$39/mo'})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPlan("premier")}
                        className={`py-2 px-2 text-xs rounded-lg font-medium transition-all ${
                          selectedPlan === "premier"
                            ? "bg-[#191816] text-[#FAF7F2] shadow-sm"
                            : "text-charcoal-muted hover:text-charcoal-deep"
                        }`}
                      >
                        Pro ({foundingPricingActive ? '$29 founding' : '$59/mo'})
                      </button>
                    </div>
                  </div>

                  {/* Graceful Error Display */}
                  {authError && (
                    <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSignupSubmit} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="realtorName">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="realtorName"
                        required
                        value={signupData.name}
                        onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                        placeholder="e.g. Liz Marks-Strauss"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="brokerage">
                          Brokerage / Firm *
                        </label>
                        <input
                          type="text"
                          id="brokerage"
                          required
                          value={signupData.brokerage}
                          onChange={(e) => setSignupData({ ...signupData, brokerage: e.target.value })}
                          placeholder="e.g. Sotheby's, Compass"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="marketCity">
                          Primary Market / City *
                        </label>
                        <input
                          type="text"
                          id="marketCity"
                          required
                          value={signupData.marketCity}
                          onChange={(e) => setSignupData({ ...signupData, marketCity: e.target.value })}
                          placeholder="e.g. Scottsdale, AZ"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="signupEmail">
                        Work Email Address *
                      </label>
                      <input
                        type="email"
                        id="signupEmail"
                        required
                        value={signupData.email}
                        onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                        placeholder="liz@luxuryhomes.com"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="signupPassword">
                        Create Password *
                      </label>
                      <input
                        type="password"
                        id="signupPassword"
                        required
                        minLength={6}
                        value={signupData.password}
                        onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                        placeholder="Minimum 6 characters"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-3.5 px-6 rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {actionLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-gold-accent" />
                            <span>Creating Account...</span>
                          </>
                        ) : (
                          <span>Create Account &amp; Open Dashboard</span>
                        )}
                      </button>
                    </div>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={handleOpenLogin}
                        className="text-xs text-charcoal-muted hover:text-charcoal-deep"
                      >
                        Already have an account? <span className="underline font-semibold">Log in</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {}
      {profileEditorOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-2xl w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">

            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                  Realtor Profile
                </span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">
                  Edit Hub Information
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!profileSaving) {
                    setProfileEditorOpen(false);
                    setProfileEditorError(null);
                  }
                }}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
                aria-label="Close profile editor"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {profileEditorError && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{profileEditorError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-6 text-left">
                <section>
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-gold-accent">Photo &amp; Identity</span>
                    <p className="text-[11px] text-charcoal-muted mt-1">These details anchor the top of your homeowner hub.</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-5 bg-cream-card border border-cream-border rounded-2xl p-4 mb-4">
                    <div className="w-24 h-24 rounded-full border-2 border-gold-accent bg-cream-subtle overflow-hidden shrink-0 flex items-center justify-center">
                      {allowsPremiumProfile && headshotPreview ? (
                        <img src={headshotPreview} alt="Headshot preview" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-editorial text-2xl font-semibold text-charcoal-deep">{getInitials(profileForm.full_name || displayName)}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileHeadshot">
                        Realtor Headshot
                      </label>
                      <input
                        type="file"
                        id="profileHeadshot"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleHeadshotFileChange}
                        disabled={!allowsPremiumProfile}
                        className="block w-full text-xs text-charcoal-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cream-subtle file:text-charcoal-deep hover:file:bg-cream-border disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <p className="text-[10px] text-charcoal-muted mt-2">{allowsPremiumProfile ? 'JPG, PNG, or WebP. Maximum 5 MB.' : 'Realtor headshots unlock on Core and Pro.'}</p>
                      {allowsPremiumProfile && (headshotPreview || profile?.headshot_url) && (
                        <button
                          type="button"
                          onClick={() => {
                            setHeadshotFile(null);
                            setHeadshotPreview('');
                            setRemoveHeadshot(true);
                          }}
                          className="mt-2 text-[10px] font-semibold text-charcoal-muted hover:text-charcoal-deep underline"
                        >
                          Remove headshot
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileFullName">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="profileFullName"
                      required
                      value={profileForm.full_name}
                      onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                      placeholder="Your full name"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileBrokerage">
                        Brokerage / Firm
                      </label>
                      <input
                        type="text"
                        id="profileBrokerage"
                        value={profileForm.brokerage}
                        onChange={(e) => setProfileForm({ ...profileForm, brokerage: e.target.value })}
                        placeholder="e.g. Talk to Tucker"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileCity">
                        Primary Market / City
                      </label>
                      <input
                        type="text"
                        id="profileCity"
                        value={profileForm.city}
                        onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                        placeholder="e.g. Indianapolis, IN"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>
                  </div>
                </section>

                <section className="pt-5 border-t border-cream-border">
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-gold-accent">Public Contact</span>
                    <p className="text-[11px] text-charcoal-muted mt-1">These become the homeowner's one-tap ways to reach you.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileEmail">
                        Public Contact Email
                      </label>
                      <input
                        type="email"
                        id="profileEmail"
                        value={profileForm.email}
                        onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                        placeholder="you@brokerage.com"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profilePhone">
                        Public Phone Number
                      </label>
                      <input
                        type="tel"
                        id="profilePhone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="(317) 555-0123"
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-charcoal-muted mt-2">
                    Your public email can differ from your login email. Your login remains {user?.email || 'unchanged'}.
                  </p>
                </section>

                <section className="pt-5 border-t border-cream-border">
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-gold-accent">Homeowner Message</span>
                    <p className="text-[11px] text-charcoal-muted mt-1">{allowsPremiumProfile ? 'Add your own voice to the hub instead of relying only on the standard copy.' : 'Custom welcome content and bio unlock on Core and Pro.'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileWelcomeMessage">
                      Welcome Message
                    </label>
                    <textarea
                      id="profileWelcomeMessage"
                      disabled={!allowsPremiumProfile}
                      rows={4}
                      maxLength={500}
                      value={profileForm.welcome_message}
                      onChange={(e) => setProfileForm({ ...profileForm, welcome_message: e.target.value })}
                      placeholder="Welcome home! I created this hub so you always have a quick place to find trusted home resources..."
                      className="w-full text-sm px-4 py-3 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[10px] text-charcoal-muted mt-1 text-right">{profileForm.welcome_message.length}/500</p>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileBio">
                      Short Bio
                    </label>
                    <textarea
                      id="profileBio"
                      disabled={!allowsPremiumProfile}
                      rows={3}
                      maxLength={400}
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder="A short introduction about you, your market, and how you help clients."
                      className="w-full text-sm px-4 py-3 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-[10px] text-charcoal-muted mt-1 text-right">{profileForm.bio.length}/400</p>
                  </div>
                </section>

                <section className="pt-5 border-t border-cream-border">
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-gold-accent">Website &amp; Social</span>
                    <p className="text-[11px] text-charcoal-muted mt-1">{allowsPremiumProfile ? 'Leave any field blank that you do not want shown publicly.' : 'Website and social profile links unlock on Core and Pro.'}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileWebsite">
                      Professional Website
                    </label>
                    <input
                      type="text"
                      id="profileWebsite"
                      disabled={!allowsPremiumProfile}
                      value={profileForm.website_url}
                      onChange={(e) => setProfileForm({ ...profileForm, website_url: e.target.value })}
                      placeholder="yourwebsite.com"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileInstagram">Instagram</label>
                      <input
                        type="text"
                        id="profileInstagram"
                      disabled={!allowsPremiumProfile}
                        value={profileForm.instagram_url}
                        onChange={(e) => setProfileForm({ ...profileForm, instagram_url: e.target.value })}
                        placeholder="instagram.com/you"
                        className="w-full text-sm px-3 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileFacebook">Facebook</label>
                      <input
                        type="text"
                        id="profileFacebook"
                      disabled={!allowsPremiumProfile}
                        value={profileForm.facebook_url}
                        onChange={(e) => setProfileForm({ ...profileForm, facebook_url: e.target.value })}
                        placeholder="facebook.com/you"
                        className="w-full text-sm px-3 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileLinkedIn">LinkedIn</label>
                      <input
                        type="text"
                        id="profileLinkedIn"
                      disabled={!allowsPremiumProfile}
                        value={profileForm.linkedin_url}
                        onChange={(e) => setProfileForm({ ...profileForm, linkedin_url: e.target.value })}
                        placeholder="linkedin.com/in/you"
                        className="w-full text-sm px-3 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </section>

                <section className="pt-5 border-t border-cream-border">
                  <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="profileSlug">
                    Realtor Subdomain *
                  </label>
                  <div className="flex items-center rounded-xl bg-cream-card border border-cream-border focus-within:border-gold-accent overflow-hidden">
                    <input
                      type="text"
                      id="profileSlug"
                      required
                      value={profileForm.slug}
                      onChange={(e) => setProfileForm({ ...profileForm, slug: normalizeRealtorSlug(e.target.value) })}
                      placeholder="yourname"
                      className="min-w-0 flex-1 text-sm px-4 py-2.5 bg-transparent focus:outline-none text-charcoal-deep"
                    />
                    <span className="text-[11px] text-charcoal-muted pr-4 whitespace-nowrap">.closeandrelax.com</span>
                  </div>
                  <p className="text-[10px] text-charcoal-muted mt-1.5">
                    Letters, numbers, and hyphens only. If your hub is already published, changing this moves the live hub to the new address.
                  </p>

                  <div className="bg-cream-card border border-cream-border rounded-xl p-3 mt-3">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-charcoal-muted">Public Hub Preview</span>
                    <p className="text-xs font-medium text-charcoal-deep mt-1 break-all">
                      https://{profileForm.slug || 'yourname'}.closeandrelax.com
                    </p>
                  </div>
                </section>

                <div className="pt-3 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end border-t border-cream-border">
                  <button
                    type="button"
                    disabled={profileSaving}
                    onClick={() => {
                      setProfileEditorOpen(false);
                      setProfileEditorError(null);
                    }}
                    className="px-5 py-2.5 rounded-full bg-cream-card hover:bg-cream-subtle border border-cream-border text-charcoal-deep text-xs font-semibold transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-6 py-2.5 rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {profileSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-gold-accent" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Profile Changes</span>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {}
      {vendorManagerOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-4xl w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">Trusted Professionals</span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">Manage Your Vendors</h3>
                <p className="text-[11px] text-charcoal-muted mt-1">{customVendors.length} of {vendorLimit} custom vendor slots used.</p>
              </div>
              <button
                type="button"
                onClick={() => { if (!vendorSaving) { setVendorManagerOpen(false); resetVendorForm(); } }}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
                aria-label="Close vendor manager"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-editorial text-xl font-bold text-charcoal-deep">Your Live Vendor List</h4>
                    <p className="text-[11px] text-charcoal-muted mt-1">Changes publish to your hub immediately.</p>
                  </div>
                  {vendorsLoading && <Loader2 className="w-4 h-4 animate-spin text-gold-accent" />}
                </div>

                <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                  {vendors.length === 0 && !vendorsLoading ? (
                    <div className="bg-cream-card border border-cream-border rounded-2xl p-5 text-xs text-charcoal-muted">No vendors are configured yet.</div>
                  ) : vendors.map((vendor) => (
                    <div key={vendor.id} className="bg-cream-card border border-cream-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-wider font-semibold text-gold-accent">{vendor.category}</span>
                            {vendor.is_default && (
                              <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[#F4EBDD] border border-[#E4D5BE] text-[#8C6B38]">Standard</span>
                            )}
                          </div>
                          <h5 className="font-editorial text-lg font-semibold text-charcoal-deep">{vendor.name}</h5>
                          {vendor.recommendation && <p className="text-[11px] italic text-charcoal-muted leading-relaxed mt-2">“{vendor.recommendation}”</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-charcoal-muted">
                            {vendor.phone && <span>{vendor.phone}</span>}
                            {vendor.website && <span className="truncate max-w-[220px]">{vendor.website}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t border-cream-border">
                        <button
                          type="button"
                          disabled={vendor.is_default && !allowsDefaultVendorControl}
                          onClick={() => handleEditVendor(vendor)}
                          className="px-3 py-1.5 rounded-lg border border-cream-border bg-cream-warm text-[10px] font-semibold text-charcoal-deep hover:bg-cream-subtle disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={vendor.is_default && !allowsDefaultVendorControl}
                          onClick={() => handleDeleteVendor(vendor)}
                          className="px-3 py-1.5 rounded-lg border border-cream-border bg-cream-warm text-[10px] font-semibold text-charcoal-muted hover:text-charcoal-deep disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="lg:border-l lg:border-cream-border lg:pl-8">
                <div className="mb-4">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-gold-accent">{editingVendorId ? 'Edit Vendor' : 'Add Vendor'}</span>
                  <h4 className="font-editorial text-xl font-bold text-charcoal-deep mt-1">{editingVendorId ? 'Update this recommendation' : 'Add a trusted professional'}</h4>
                </div>

                {vendorError && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{vendorError}</span>
                  </div>
                )}

                {!editingVendorId && customVendors.length >= vendorLimit ? (
                  <div className="bg-cream-card border border-cream-border rounded-2xl p-5">
                    <p className="text-sm font-semibold text-charcoal-deep">You’ve filled all {vendorLimit} custom vendor slots.</p>
                    <p className="text-xs text-charcoal-muted leading-relaxed mt-2">Edit or remove an existing custom vendor to add another one.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveVendor} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="vendorName">Vendor / Company Name *</label>
                      <input id="vendorName" required value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="e.g. Smith Plumbing" className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="vendorCategory">Category *</label>
                      <input id="vendorCategory" required value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} placeholder="e.g. Plumbing & Water Care" className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="vendorPhone">Phone</label>
                        <input id="vendorPhone" type="tel" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} placeholder="(317) 555-0123" className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="vendorWebsite">Website</label>
                        <input id="vendorWebsite" value={vendorForm.website} onChange={(e) => setVendorForm({ ...vendorForm, website: e.target.value })} placeholder="vendorwebsite.com" className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="vendorRecommendation">Why I Recommend Them</label>
                      <textarea
                        id="vendorRecommendation"
                        rows={3}
                        maxLength={220}
                        disabled={!allowsVendorRecommendations}
                        value={vendorForm.recommendation}
                        onChange={(e) => setVendorForm({ ...vendorForm, recommendation: e.target.value })}
                        placeholder={allowsVendorRecommendations ? 'A quick personal sentence explaining why you trust this vendor.' : 'Recommendation notes unlock on Core and Pro.'}
                        className="w-full text-sm px-4 py-3 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-between mt-1 text-[10px] text-charcoal-muted">
                        <span>{allowsVendorRecommendations ? 'This appears beneath the vendor on your public hub.' : 'Upgrade to Core or Pro to add personal recommendation notes.'}</span>
                        {allowsVendorRecommendations && <span>{vendorForm.recommendation.length}/220</span>}
                      </div>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                      {editingVendorId && (
                        <button type="button" disabled={vendorSaving} onClick={resetVendorForm} className="flex-1 py-2.5 rounded-xl bg-cream-card hover:bg-cream-subtle border border-cream-border text-xs font-semibold text-charcoal-deep disabled:opacity-60">Cancel Edit</button>
                      )}
                      <button type="submit" disabled={vendorSaving} className="flex-1 py-2.5 rounded-xl bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                        {vendorSaving ? <><Loader2 className="w-4 h-4 animate-spin text-gold-accent" /><span>Saving...</span></> : <span>{editingVendorId ? 'Save Vendor Changes' : 'Add Vendor'}</span>}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {}
      {loginModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-md w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                  Realtor Portal
                </span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">
                  Log In to Your Dashboard
                </h3>
              </div>
              <button
                onClick={() => setLoginModalOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {/* Graceful Error Display */}
              {authError && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="loginEmail">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="loginEmail"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="you@brokerage.com"
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-charcoal-deep" htmlFor="loginPassword">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => showToast("Password reset feature will be emailed to your address.")}
                      className="text-[11px] text-charcoal-muted hover:text-charcoal-deep"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    type="password"
                    id="loginPassword"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-3 px-6 rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {actionLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-gold-accent" />
                        <span>Logging In...</span>
                      </>
                    ) : (
                      <span>Log In to Dashboard</span>
                    )}
                  </button>
                </div>

                <div className="text-center pt-3 border-t border-cream-border">
                  <p className="text-xs text-charcoal-muted">
                    New to Close &amp; Relax?{' '}
                    <button
                      type="button"
                      onClick={() => handleOpenSignup("partner")}
                      className="font-semibold text-charcoal-deep underline hover:text-gold-accent"
                    >
                      Create your free hub
                    </button>
                  </p>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

      {}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-md w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                  Assistance
                </span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">
                  Contact Support
                </h3>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {!contactSubmitted ? (
                <form onSubmit={handleContactSubmit} className="space-y-4 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="contactName">
                      Name
                    </label>
                    <input
                      type="text"
                      id="contactName"
                      required
                      value={contactData.name}
                      onChange={(e) => setContactData({ ...contactData, name: e.target.value })}
                      placeholder="Your full name"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="contactEmail">
                      Email
                    </label>
                    <input
                      type="email"
                      id="contactEmail"
                      required
                      value={contactData.email}
                      onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                      placeholder="your@email.com"
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="contactMessage">
                      How can we assist?
                    </label>
                    <textarea
                      id="contactMessage"
                      required
                      rows={3}
                      value={contactData.message}
                      onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                      placeholder="Ask a question about setup, plans, or features..."
                      className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full py-3 px-6 rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-semibold transition-all shadow-md"
                    >
                      Send Message
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-[#FAF6EF] text-gold-accent border border-[#E4D5BE] flex items-center justify-center mx-auto mb-4 font-editorial text-2xl font-bold">
                    ✓
                  </div>
                  <h4 className="font-editorial text-2xl font-bold text-charcoal-deep mb-2">
                    Message Received
                  </h4>
                  <p className="text-sm text-charcoal-muted leading-relaxed max-w-sm mx-auto mb-6">
                    Thank you for reaching out. Our support desk will respond to your inquiry via email shortly.
                  </p>
                  <button
                    onClick={() => {
                      setContactModalOpen(false);
                      setContactSubmitted(false);
                    }}
                    className="px-6 py-2.5 rounded-full bg-[#191816] text-[#FAF7F2] text-xs font-medium hover:bg-[#262421]"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
