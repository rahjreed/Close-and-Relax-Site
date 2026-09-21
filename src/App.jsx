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

const PRICING_TIERS = [
  {
    id: "partner",
    name: "Partner",
    badge: "Entry Level",
    price: "Free",
    period: "/ forever",
    description: "A genuinely useful closing concierge. Includes your profile image, essential contact identity, and up to 3 of your own preferred vendors.",
    popular: false,
    ctaText: "Create Free Account",
    features: [
      "Instant self-service dashboard access",
      "Essential identity fields: profile image, name, brokerage, phone, email & location",
      "Direct Call & Text contact actions for buyers",
      "Standard Close & Relax verified resource network",
      "Add up to 3 of your own preferred vendors alongside standard network",
      "Dedicated shareable link & subdomain",
      "Fully responsive mobile & save-to-phone PWA experience",
      "Subtle Close & Relax branding mark",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most Popular",
    price: "$29",
    period: "/ month",
    description: "The ideal plan for active producers wanting richer self-service branding, personalized welcome messaging, and expanded vendor additions.",
    popular: true,
    ctaText: "Choose Pro",
    features: [
      "Everything in Free, plus broader dashboard customization:",
      "Add up to 5 of your own preferred vendors alongside standard network",
      "Full profile bio and personalized welcome message editing",
      "Social media and professional website profile links",
      "Personal one-line recommendation notes under each vendor",
      "Enhanced branded installable homeowner app experience",
      "Personalized 'Add-to-Phone' prompt for your buyers",
      "Edit and publish updates instantly anytime",
      "Standard email customer support",
    ],
  },
  {
    id: "premier",
    name: "Premier",
    badge: "Ultimate Control",
    price: "$79",
    period: "/ month",
    description: "Substantial control and a near-white-label experience for luxury specialists who demand bespoke curation and full vendor control.",
    popular: false,
    ctaText: "Choose Premier",
    features: [
      "Everything in Pro, plus advanced hub controls:",
      "Add up to 8 of your own preferred vendors",
      "Full vendor control: replace or remove standard default vendors",
      "Realtor-first near-white-label presentation",
      "Custom home-screen app icon using your 2 chosen initials",
      "Short personal video greeting welcome (up to ~30 seconds)",
      "Interactive homeowner checklist built directly into the hub",
      "Custom sections & tailored home service categories",
      "Expanded image and homeowner resource controls",
      "Stronger priority customer & technical support",
    ],
  },
];

const FAQ_ITEMS = [
  {
    question: "What profile information can I customize on the Free plan?",
    answer: "The Free Partner tier includes all your essential identity fields: your uploaded profile headshot, full name, brokerage or team affiliation, direct phone number, email address, and primary market location. Richer profile content—such as a personalized written welcome message, detailed bio narrative, professional website, and social media links—is unlocked on Pro and Premier.",
  },
  {
    question: "Can I add my own vendors on the Free plan?",
    answer: "Yes! The Free Partner tier is designed to be genuinely useful right out of the box. You can upload your profile photo, display your essential contact identity, and add up to 3 of your own preferred vendors in addition to the standard Close & Relax network.",
  },
  {
    question: "What is the difference in vendor control between Pro and Premier?",
    answer: "On Pro ($29/month), you can add up to 5 of your own preferred vendors alongside the standard Close & Relax network, complete with your personal recommendation notes. On Premier ($79/month), you can add up to 8 preferred vendors AND you gain full vendor control—meaning you can replace or remove standard default vendors where allowed for a tailored, near-white-label experience.",
  },
  {
    question: "How do I create and manage my hub?",
    answer: "You simply create an account on Close & Relax to access your personal Realtor dashboard. From there, fill in your profile details, upload your image, select or add your trusted vendors according to your plan, and click publish. Your hub is generated instantly and ready to share.",
  },
  {
    question: "Can I edit my hub after publishing?",
    answer: "Yes, at any time. Log in to your Close & Relax dashboard to update your phone number, revise a vendor's contact details, or add new recommendation notes. All changes publish immediately to your live homeowner hub without requiring your clients to update anything.",
  },
  {
    question: "I already have a real estate website. Why do I need this?",
    answer: "Your public website exists to attract and win prospective clients. Close & Relax serves them after the keys are handed over, providing a clean, distraction-free homeowner concierge saved right on their mobile phone for ongoing home ownership needs.",
  },
  {
    question: "I already have a vendor PDF list. How is this different?",
    answer: "PDFs get buried in email archives or left in moving boxes within days. Close & Relax transforms your static list into an interactive mobile experience that clients install to their home screen with one-tap dialing and your contact buttons always visible.",
  },
  {
    question: "Do my home buyers need to create an account or download an app?",
    answer: "Never. Homeowners do not create an account, enter a password, or download anything from the App Store or Google Play. The hub opens directly in their browser and can be saved to their home screen as a Progressive Web App (PWA) with a single tap.",
  },
  {
    question: "Do vendors pay Close & Relax to appear?",
    answer: "No. Close & Relax never charges vendors for recommendation placement, lead referrals, or sponsored ad slots. Recommendations are grounded strictly in authenticity, local reputation, and your personal guidance.",
  },
  {
    question: "What happens if I ever downgrade from Pro or Premier?",
    answer: "Your clients are never stranded or shown a broken link. If you change or cancel your paid plan, your hub gracefully transitions to the standard Close & Relax Partner experience, preserving their basic utility without interruption.",
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
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("partner");
  const [openFaqIndex, setOpenFaqIndex] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Authentication State
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  // View state: 'marketing' or 'dashboard'
  const [currentView, setCurrentView] = useState('marketing');

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
        setCurrentView('marketing');
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

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Realtor';
  const displayBrokerage = profile?.brokerage || user?.user_metadata?.brokerage || 'Independent Real Estate';
  const storedPlan = profile?.plan || user?.user_metadata?.plan || 'partner';
  const displayPlan = storedPlan === 'free' ? 'partner' : storedPlan;

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
                  onClick={() => setLiveDemoModalOpen(true)}
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
                  {displayPlan} Tier
                </p>
                <p className="text-xs text-charcoal-muted mt-0.5">
                  {displayPlan === 'premier' ? 'Up to 8 vendors + replace standard' : displayPlan === 'pro' ? 'Up to 5 vendors + personal notes' : 'Standard network + up to 3 vendors'}
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
              </div>

              <div className="bg-cream-warm p-5 rounded-2xl border border-cream-border">
                <span className="text-[10px] uppercase font-bold tracking-wider text-charcoal-muted">Shareable Link</span>
                <p className="font-editorial text-xl font-bold text-charcoal-deep mt-1 truncate">
                  closeandrelax.com/{profile?.id ? profile.id.slice(0, 8) : 'my-hub'}
                </p>
                <p className="text-xs text-charcoal-muted mt-0.5">Ready for your closing materials</p>
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

                  <div className="space-y-3 text-xs text-charcoal-muted mb-6">
                    <div className="flex justify-between py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Full Name</span>
                      <span>{displayName}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Account Email</span>
                      <span>{user.email}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Brokerage</span>
                      <span>{displayBrokerage}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-cream-border/60">
                      <span className="font-medium text-charcoal-deep">Market City</span>
                      <span>{profile?.city || user?.user_metadata?.market_city || 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => showToast('Profile editor opens in next release')}
                  className="w-full py-2.5 text-xs font-semibold rounded-xl bg-cream-card hover:bg-cream-subtle border border-cream-border text-charcoal-deep transition-colors"
                >
                  Edit Profile Information
                </button>
              </div>

              {/* My Vendors Placeholder Card */}
              <div className="bg-cream-warm p-6 rounded-2xl border border-cream-border flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-gold-accent" />
                      <h3 className="font-editorial text-xl font-bold text-charcoal-deep">My Preferred Vendors</h3>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 bg-cream-card rounded border border-cream-border text-charcoal-muted">
                      Vendor Curation
                    </span>
                  </div>

                  <p className="text-xs text-charcoal-muted leading-relaxed mb-4">
                    Your hub is currently linked to the standard Close &amp; Relax verified contractor network. Under your <span className="font-semibold text-charcoal-deep capitalize">{displayPlan}</span> plan, you can add up to {displayPlan === 'premier' ? '8' : displayPlan === 'pro' ? '5' : '3'} of your own preferred local specialists.
                  </p>

                  <div className="bg-cream-card p-3 rounded-xl border border-cream-border text-[11px] text-charcoal-muted space-y-1">
                    <p className="font-semibold text-charcoal-deep">Active Standards Included:</p>
                    <p>• Locksmith &amp; Security Services</p>
                    <p>• Emergency HVAC &amp; Climate Support</p>
                    <p>• White-Glove Movers &amp; Relocation</p>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => showToast('Vendor curation manager opens in next release')}
                    className="w-full py-2.5 text-xs font-semibold rounded-xl bg-cream-card hover:bg-cream-subtle border border-cream-border text-charcoal-deep transition-colors"
                  >
                    Manage Custom Vendors ({displayPlan === 'premier' ? '8' : displayPlan === 'pro' ? '5' : '3'} Max)
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
                        <span><strong>Personal guidance from you:</strong> your own handpicked vendors (3 on Free, 5 on Pro, up to 8 on Premier).</span>
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
                    Upload your professional headshot, brokerage details, direct line, and location to anchor the top of your concierge. Free plans include essential identity branding from day one.
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
                    Pre-populated with the verified Close &amp; Relax network, plus add your own preferred vendors: up to 3 on Free, up to 5 on Pro, or up to 8 with full vendor replacement on Premier.
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
                    Pro and Premier users can add a personal one-line endorsement or recommendation note beneath their preferred vendors (e.g., “Ask for Marco, used on 14+ client purchases”), reinforcing your trusted authority. Free users can add preferred vendors without custom recommendation notes.
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
                  Start completely free with your profile image and up to 3 preferred vendors, or unlock full self-service customization whenever you are ready.
                </p>
              </div>

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
                        onClick={() => {
                          if (user) {
                            showToast(`You are on the ${displayPlan.toUpperCase()} tier. Manage your hub in your dashboard.`);
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
                        Partner (Free)
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
                        Pro ($29/mo)
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
                        Premier ($79/mo)
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
