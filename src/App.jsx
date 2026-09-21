import React, { useState, useEffect } from 'react';
import {
  Phone,
  MessageSquare,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Lock,
  Wrench,
  Truck,
  Sparkles,
  Award,
  Menu,
  X as CloseIcon,
  HelpCircle,
  Share2,
  BookmarkCheck,
  User,
  Building,
  Mail
} from 'lucide-react';

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
    closeAndRelax: "A small, hand-selected list of vetted providers recommended with genuine confidence.",
  },
  {
    feature: "Brand Prominence",
    portal: "Platform logo first; agent photo and brand obscured or buried in footers.",
    closeAndRelax: "Realtor-first experience; your portrait, direct line, brokerage, and voice lead the hub.",
  },
  {
    feature: "Client Access",
    portal: "Client logins, forgotten passwords, mandatory downloads, and sign-up friction.",
    closeAndRelax: "Open-and-use web experience; zero login, zero password, zero friction.",
  },
  {
    feature: "Vendor Placement",
    portal: "Vendors pay ad dollars, bidding fees, or referral percentages for lead-generation visibility.",
    closeAndRelax: "No vendors pay Close & Relax for recommendation placement. Strictly curated on trust.",
  },
  {
    feature: "Realtor Overhead",
    portal: "Another complicated CRM or software dashboard to configure and maintain.",
    closeAndRelax: "A thoughtful, completely done-for-you closing gift ready to gift in minutes.",
  },
  {
    feature: "Recommendation Depth",
    portal: "Generic crowd-sourced reviews and star ratings easily gamed online.",
    closeAndRelax: "Your authentic one-line Realtor recommendation under every vendor explaining why you trust them.",
  },
  {
    feature: "Longevity on Device",
    portal: "Browser bookmarks or emails lost within two weeks of unpacking boxes.",
    closeAndRelax: "One-tap 'Add to Phone' PWA; lives gracefully right on their home screen for years.",
  },
];

const PRICING_TIERS = [
  {
    name: "Partner",
    badge: "Standard",
    price: "Free",
    period: "/ forever",
    description: "Ideal for individual agents wanting an elegant, dependable closing concierge ready to share today.",
    popular: false,
    ctaText: "Get My Free Hub",
    features: [
      "Personalized Realtor hub & headshot",
      "Realtor contact & direct Call/Text links",
      "Standard Close & Relax resource network",
      "Dedicated shareable subdomain",
      "Print-ready QR code for closing folders",
      "Fully responsive mobile web experience",
      "Subtle Close & Relax branding mark",
    ],
  },
  {
    name: "Pro",
    badge: "Bespoke",
    price: "$29",
    period: "/ month",
    description: "For top producers who have preferred local contractors and want a customized home-screen experience.",
    popular: true,
    ctaText: "Talk About Pro",
    features: [
      "Everything in Free, plus:",
      "Branded installable PWA / homeowner app",
      "Personalized 'Add-to-Phone' experience",
      "Custom domain connection support",
      "Enhanced Realtor personal branding",
      "Add your own Realtor-selected vendors (including competing providers alongside defaults)",
      "Limited managed changes & priority support",
    ],
  },
  {
    name: "Premier",
    badge: "White-Glove",
    price: "$79",
    period: "/ month",
    description: "Full control for luxury teams and premier solo agents demanding near-white-label exclusivity.",
    popular: false,
    ctaText: "Talk About Premier",
    features: [
      "Full vendor control: replace or remove default Close & Relax partners",
      "Realtor-first near-white-label branding",
      "Dedicated custom domain connection",
      "Expanded bespoke design & theme curation",
      "Custom curated sections & client categories",
      "Additional managed changes & direct concierge support",
      "Enhanced private hub engagement analytics",
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: "I already have a website.",
    answer: "Close & Relax does not replace your marketing website. Your website helps prospective buyers and sellers discover and hire you; Close & Relax serves them after the transaction closes by providing an intimate, focused post-closing concierge saved directly on their phone.",
  },
  {
    question: "I already have a vendor list.",
    answer: "Close & Relax turns your static PDF or text list into an interactive, mobile-accessible resource clients can actually keep, install, and refer to whenever an emergency or home upgrade occurs.",
  },
  {
    question: "Do my clients download an app?",
    answer: "No. There is no App Store or Google Play download. The hub works immediately in any mobile browser and can optionally be saved to their home screen with a single tap as an app-like Progressive Web App (PWA).",
  },
  {
    question: "Do vendors pay to appear?",
    answer: "No. Close & Relax does not charge vendors for recommendation placement. Recommendations are grounded strictly in trust, quality, and your authentic guidance.",
  },
  {
    question: "Do I have to run email campaigns?",
    answer: "No. This is not another CRM or marketing automation system that burdens you with newsletters. It is simply a thoughtful, functional closing gift that lives quietly on your client's phone until they need help.",
  },
  {
    question: "What happens if I stop paying for Pro?",
    answer: "Your client never encounters an error screen or paywall. If you ever downgrade, your hub smoothly returns to the standard Close & Relax verified network experience rather than disappearing or leaving your buyers stranded.",
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

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveDemoModalOpen, setLiveDemoModalOpen] = useState(false);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [selectedPlanIntent, setSelectedPlanIntent] = useState("Partner (Free Hub)");
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    brokerage: "",
    marketCity: "",
    email: "",
    phone: "",
    notes: ""
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  const handleOpenLeadModal = (intent = "Partner (Free Hub)") => {
    setSelectedPlanIntent(intent);
    setLeadSubmitted(false);
    setLeadModalOpen(true);
  };

  const handleLeadSubmit = (e) => {
    e.preventDefault();
    setLeadSubmitted(true);
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-cream-warm text-charcoal-body font-body antialiased selection:bg-[#E4D5BE] selection:text-[#191816]">
      <style>{customStyles}</style>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#191816] text-[#FAF7F2] px-5 py-3 rounded-2xl shadow-luxury text-xs font-medium border border-neutral-700 animate-fade-in flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#B5966B]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header / Navigation */}
      <header className="sticky top-0 z-40 bg-cream-warm/90 backdrop-blur-md border-b border-cream-border transition-all">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
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
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-charcoal-muted">
            <a href="#how-it-works" className="hover:text-charcoal-deep transition-colors">How It Works</a>
            <a href="#features" className="hover:text-charcoal-deep transition-colors">Features</a>
            <a href="#comparison" className="hover:text-charcoal-deep transition-colors">Comparison</a>
            <a href="#philosophy" className="hover:text-charcoal-deep transition-colors">Philosophy</a>
            <a href="#pricing" className="hover:text-charcoal-deep transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-charcoal-deep transition-colors">FAQ</a>
          </nav>

          {/* Actions */}
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={() => setLiveDemoModalOpen(true)}
              className="text-sm font-medium text-charcoal-muted hover:text-charcoal-deep px-3 py-2 transition-colors flex items-center gap-1.5"
            >
              <span>Live Example</span>
              <ExternalLink className="w-3.5 h-3.5 text-gold-accent" />
            </button>
            <button
              onClick={() => handleOpenLeadModal("Header CTA")}
              className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-medium px-5 py-2.5 rounded-full border border-[#191816] shadow-sm hover:shadow transition-all"
            >
              Get My Free Hub
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Menu"
            className="md:hidden p-2 rounded-lg text-charcoal-body hover:bg-cream-subtle transition-colors"
          >
            {mobileMenuOpen ? <CloseIcon className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream-card border-b border-cream-border px-6 py-6 transition-all space-y-3">
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
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
            >
              Comparison
            </a>
            <a
              href="#philosophy"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-charcoal-deep hover:text-gold-accent"
            >
              Philosophy
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
            <div className="pt-4 border-t border-cream-border flex flex-col gap-3">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLiveDemoModalOpen(true);
                }}
                className="w-full py-3 text-sm font-medium text-charcoal-deep border border-cream-border rounded-full text-center"
              >
                See Live Example
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenLeadModal("Mobile Menu");
                }}
                className="w-full py-3 text-sm font-medium text-[#FAF7F2] bg-[#191816] rounded-full text-center"
              >
                Get My Free Hub
              </button>
            </div>
          </div>
        )}
      </header>

      {}
      <section className="pt-14 pb-20 md:pt-24 md:pb-32 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Hero Copy */}
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
              <button
                onClick={() => handleOpenLeadModal("Hero Primary CTA")}
                className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md hover:shadow-lg transition-all text-center"
              >
                Get My Free Hub
              </button>
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

          {/* Right Phone Mockup - Liz Marks-Strauss Showcase */}
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
                  <p className="text-[10px] text-charcoal-muted mt-0.5 leading-snug">My private book of vetted home specialists you can rely on anytime.</p>
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
              Buyers walk away from the closing table thrilled, but their real homeowner journey has just begun. They immediately need locksmiths, security setup, emergency plumbers, HVAC checkups, movers, cleaners, and painters. Yet your recommendations usually get buried in fragmented text message threads, scattered emails, or a lost paper PDF.
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
                    <span><strong>One branded digital home concierge:</strong> all your trusted specialists right at hand.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                    <span><strong>Saved directly to their home screen</strong> as a fast web app with zero App Store friction.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#191816] text-[#FAF7F2] flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">✓</span>
                    <span><strong>Personal guidance from you:</strong> notes detailing why you trust each pro and who to ask for.</span>
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
            Everything your client needs to settle into their home with total peace of mind, delivered with the understated elegance of a luxury residential service.
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
                Realtor Photo &amp; Contact Branding
              </h3>
              <p className="text-sm text-charcoal-muted leading-relaxed">
                Your portrait, brokerage name, phone number, and personalized greeting anchor the top of the hub. It looks, acts, and feels like your personal client concierge.
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
                Pre-populated with the verified Close &amp; Relax network of local home specialists—locksmiths, security, emergency plumbers, HVAC, and movers—or customized with your own roster.
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
                Every vendor card features your personal one-line endorsement (e.g., “Ask for Marco, used on 14+ client purchases”), cementing your authority as their trusted local expert.
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
                Zero friction for the homeowner. One tap dials the emergency dispatcher directly or launches the provider's private scheduling page directly in their browser.
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
                If an agent ever decides to step down from a paid Pro or Premier customization plan, their clients do not get locked out. The hub seamlessly downgrades to the standard Close &amp; Relax verified network experience—preserving your client’s access to vital home services without interruption.
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
              No complex dashboards or onboarding sprints. We prepare your bespoke concierge hub so you can focus on closing deals and serving your clients.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 max-w-5xl mx-auto">
            
            {/* Step 1 */}
            <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
              <div>
                <div className="font-editorial text-4xl font-light text-gold-accent mb-4">01</div>
                <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                  We Create Your Hub
                </h3>
                <p className="text-sm text-charcoal-muted leading-relaxed">
                  We apply your headshot, contact phone number, brokerage branding, and personalized welcome greeting so the concierge is instantly recognizable to your clients.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                Takes less than 5 minutes to request
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
              <div>
                <div className="font-editorial text-4xl font-light text-gold-accent mb-4">02</div>
                <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                  Choose Your Trusted Pros
                </h3>
                <p className="text-sm text-charcoal-muted leading-relaxed">
                  Begin immediately with the verified standard Close &amp; Relax network of home professionals, or customize your preferred vendors depending on your plan tier.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                Vetted quality standards
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-cream-warm rounded-2xl p-8 border border-cream-border flex flex-col justify-between">
              <div>
                <div className="font-editorial text-4xl font-light text-gold-accent mb-4">03</div>
                <h3 className="font-editorial text-2xl font-semibold text-charcoal-deep mb-3">
                  Give It to Every Buyer
                </h3>
                <p className="text-sm text-charcoal-muted leading-relaxed">
                  Send the private link via text or congratulatory email, slip a custom luxury QR card into their key box, and help them save it directly to their phone.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-cream-border text-xs font-medium text-charcoal-muted">
                A memorable closing gift
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

            <button
              onClick={() => handleOpenLeadModal("Save To Phone Section")}
              className="bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-3.5 rounded-full shadow-md transition-all"
            >
              Create Your Realtor Hub
            </button>
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
              Start completely free with our verified resource network, or elevate to bespoke branding and custom vendor curation.
            </p>
          </div>

          {/* Pricing Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {PRICING_TIERS.map((tier, idx) => (
              <div
                key={idx}
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
                    <span className="font-editorial text-4xl font-bold text-charcoal-deep">
                      {tier.price}
                    </span>
                    <span className="text-sm text-charcoal-muted font-medium ml-1">
                      {tier.period}
                    </span>
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
                    onClick={() => handleOpenLeadModal(`${tier.name} Plan`)}
                    className={`w-full py-3.5 px-6 rounded-full text-sm font-semibold transition-all text-center ${
                      tier.popular
                        ? 'bg-gold-accent hover:bg-[#9B7E54] text-[#FAF7F2] shadow-sm'
                        : 'bg-[#191816] hover:bg-[#262421] text-[#FAF7F2]'
                    }`}
                  >
                    {tier.ctaText}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Consultation Note */}
          <div className="mt-12 text-center max-w-2xl mx-auto bg-cream-subtle/60 rounded-2xl p-5 border border-cream-border">
            <p className="text-xs text-charcoal-muted leading-relaxed">
              <strong className="text-charcoal-deep">Why a conversation first?</strong> Pro and Premier plans are activated after a short consultation because your custom branding and vendor customization are currently handled manually by our team to ensure white-glove luxury quality.
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
            Everything you need to know about gifting Close &amp; Relax to your clients.
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
                  <div className="px-6 pb-6 text-sm sm:text-base text-charcoal-muted leading-relaxed animate-fade-in">
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
            <button
              onClick={() => handleOpenLeadModal("Final CTA")}
              className="w-full sm:w-auto bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-base font-medium px-8 py-4 rounded-full shadow-md transition-all"
            >
              Get Your Free Close &amp; Relax Hub
            </button>
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
            <button onClick={() => handleOpenLeadModal("Footer Inquire")} className="hover:text-charcoal-deep transition-colors">
              Contact
            </button>
          </div>

          <div className="text-xs text-charcoal-muted flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} Close &amp; Relax.</span>
            <span>•</span>
            <span className="text-gold-accent font-editorial italic">Powered by Close &amp; Relax</span>
          </div>

        </div>
      </footer>

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
              <button
                onClick={() => {
                  setLiveDemoModalOpen(false);
                  handleOpenLeadModal("From Live Demo Modal");
                }}
                className="bg-[#191816] text-[#FAF7F2] px-4 py-2 rounded-full font-medium hover:bg-[#262421]"
              >
                Get Your Own Hub
              </button>
            </div>

          </div>
        </div>
      )}

      {}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#191816]/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-cream-warm rounded-3xl max-w-lg w-full border border-cream-border shadow-2xl overflow-hidden relative my-auto animate-fade-in">
            
            <div className="p-6 border-b border-cream-border flex items-center justify-between bg-cream-card">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-gold-accent font-semibold">
                  {selectedPlanIntent}
                </span>
                <h3 className="font-editorial text-2xl font-bold text-charcoal-deep">
                  Request Your Realtor Hub
                </h3>
              </div>
              <button
                onClick={() => setLeadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-cream-subtle text-charcoal-deep hover:bg-cream-border flex items-center justify-center transition-colors"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 sm:p-8">
              {!leadSubmitted ? (
                <>
                  <p className="text-xs text-charcoal-muted mb-6">
                    Tell us where to send your personalized hub preview link. No credit card required.
                  </p>

                  <form onSubmit={handleLeadSubmit} className="space-y-4 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="realtorName">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="realtorName"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                          value={formData.brokerage}
                          onChange={(e) => setFormData({ ...formData, brokerage: e.target.value })}
                          placeholder="e.g. Sotheby's, Compass"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="marketCity">
                          Primary City / Market *
                        </label>
                        <input
                          type="text"
                          id="marketCity"
                          required
                          value={formData.marketCity}
                          onChange={(e) => setFormData({ ...formData, marketCity: e.target.value })}
                          placeholder="e.g. Scottsdale, AZ"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="email">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          id="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="liz@luxuryhomes.com"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="phone">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="(555) 234-5678"
                          className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-charcoal-deep mb-1" htmlFor="notes">
                        Notes or Questions (Optional)
                      </label>
                      <textarea
                        id="notes"
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Let us know if you already have a preferred vendor list..."
                        className="w-full text-sm px-4 py-2.5 rounded-xl bg-cream-card border border-cream-border focus:outline-none focus:border-gold-accent text-charcoal-deep"
                      ></textarea>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        className="w-full py-3.5 px-6 rounded-full bg-[#191816] hover:bg-[#262421] text-[#FAF7F2] text-sm font-semibold transition-all shadow-md"
                      >
                        Create My Hub Preview
                      </button>
                    </div>

                    <p className="text-[11px] text-center text-charcoal-muted">
                      We respect your privacy. No spam. You will receive an email preview within 24 hours.
                    </p>
                  </form>
                </>
              ) : (
                /* Success State */
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-[#FAF6EF] text-gold-accent border border-[#E4D5BE] flex items-center justify-center mx-auto mb-4 font-editorial text-2xl font-bold">
                    ✓
                  </div>
                  <h4 className="font-editorial text-2xl font-bold text-charcoal-deep mb-2">
                    Thank You, {formData.name || "Agent"}!
                  </h4>
                  <p className="text-sm text-charcoal-muted leading-relaxed max-w-sm mx-auto mb-6">
                    We’ve received your details. Our concierge design team will prepare your preview hub and send your personalized link shortly.
                  </p>
                  <button
                    onClick={() => setLeadModalOpen(false)}
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
