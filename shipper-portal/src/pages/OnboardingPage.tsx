import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  supabase,
  fetchCurrentProfile,
  persistProfile,
} from '../lib/supabase';
import type { UserProfile } from '../lib/supabase';
import { filterSMECategories } from '../data/smeCategories';
import { INDIAN_STATES, filterLocations } from '../data/indianLocations';
import type { IndianLocation } from '../data/indianLocations';
import {
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Search,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authenticated user basic details
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Multi-step state: 1 to 4
  const [step, setStep] = useState<number>(1);

  // Form Fields
  const [businessName, setBusinessName] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('Manufacturer');
  
  // Location
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('Gujarat');
  const [country, setCountry] = useState<string>('India');
  const [locationSearch, setLocationSearch] = useState<string>('');
  const [showLocationDropdown, setShowLocationDropdown] = useState<boolean>(false);

  // 200+ Categories
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Fetch session on load
  useEffect(() => {
    async function loadUser() {
      try {
        let { user, profile } = await fetchCurrentProfile();
        if (!user) {
          try {
            const { data: anonData } = await supabase.auth.signInAnonymously();
            if (anonData?.user) {
              user = anonData.user;
            }
          } catch (anonErr) {
            console.warn('[Onboarding Anonymous Session Notice]', anonErr);
          }
        }

        if (user) {
          setCurrentUser(user);
        }

        if (profile) {
          if (profile.business_name) setBusinessName(profile.business_name);
          if (profile.city) setCity(profile.city);
          if (profile.state) setState(profile.state);
          if (profile.country) setCountry(profile.country);
          if (Array.isArray(profile.business_categories) && profile.business_categories.length > 0) {
            setSelectedCategories(profile.business_categories);
          }
        }
      } catch (err: any) {
        console.warn('[Onboarding Load User]', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [navigate]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return filterSMECategories(categorySearch);
  }, [categorySearch]);

  // Filtered locations
  const filteredLocs = useMemo(() => {
    return filterLocations(locationSearch);
  }, [locationSearch]);

  const handleSelectLocation = (loc: IndianLocation) => {
    setCity(loc.city);
    setState(loc.state);
    setLocationSearch(`${loc.city}, ${loc.state}`);
    setShowLocationDropdown(false);
  };

  const handleToggleCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
      setCategorySearch('');
    }
  };

  const handleRemoveCategory = (catName: string) => {
    setSelectedCategories(selectedCategories.filter((c) => c !== catName));
  };

  const handleCompleteOnboarding = async () => {
    try {
      setSaving(true);
      setError(null);

      const profilePayload: Partial<UserProfile> = {
        business_name: businessName.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim() || 'India',
        business_categories: selectedCategories,
        onboarding_completed: true,
      };

      await persistProfile(profilePayload);
      navigate('/app', { replace: true });
    } catch (err: any) {
      console.error('Failed to complete onboarding:', err);
      setError(err?.message || 'Failed to save profile. Please check connection and retry.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 text-[#0284C7] animate-spin mb-4" />
        <p className="text-xs font-mono text-[#64748B]">Loading your freight profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0A192F] font-sans flex flex-col justify-between p-6 md:p-12 selection:bg-[#E0F2FE]">
      
      {/* Top Header & Progress Bar */}
      <div className="max-w-2xl w-full mx-auto space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-[#E2E8F0]">
          <div>
            <span className="font-extrabold text-xl tracking-tight text-[#0A192F]">LONICS</span>
            <span className="text-xs font-mono text-[#64748B] ml-2">SME ONBOARDING</span>
          </div>
          <div className="text-xs font-mono text-[#0284C7] font-semibold">
            STEP 0{step} OF 04
          </div>
        </div>

        {/* 4-Step Progress Bar Indicator */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-[#0284C7]' : 'bg-[#E2E8F0]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Multi-Step Container */}
      <div className="max-w-2xl w-full mx-auto my-8 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
        
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* STEP 1: BUSINESS PROFILE */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#0284C7] font-bold uppercase">01 • COMPANY IDENTITY</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
                Tell us about your business.
              </h2>
              <p className="text-sm text-[#475569]">
                Enter the trading or registered entity name that will appear on consignment notes and Railway Receipts.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-mono font-bold text-[#475569] uppercase mb-2">
                  Business / Company Name *
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Apex Textiles Pvt Ltd"
                  className="w-full h-12 px-4 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#0284C7] transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-[#475569] uppercase mb-2">
                  Primary Shipper Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {['Manufacturer', 'Trader / Wholesaler', 'Exporter', 'E-commerce Brand'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setEntityType(role)}
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition cursor-pointer ${
                        entityType === role
                          ? 'bg-[#0284C7] text-[#FFFFFF] border-[#0284C7]'
                          : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E2E8F0] flex justify-end">
              <button
                type="button"
                disabled={!businessName.trim()}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#FFFFFF] bg-[#0284C7] hover:bg-[#0369A1] transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: LOCATION */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#0284C7] font-bold uppercase">02 • PRIMARY FREIGHT ORIGIN</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
                Where is your primary dispatch facility?
              </h2>
              <p className="text-sm text-[#475569]">
                Select your primary manufacturing cluster or warehouse origin for first-mile pickup.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {/* Searchable Location Input */}
              <div className="relative">
                <label className="block text-xs font-mono font-bold text-[#475569] uppercase mb-2">
                  Search City or Industrial Cluster *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={city ? `${city}, ${state}` : locationSearch}
                    onChange={(e) => {
                      setCity('');
                      setLocationSearch(e.target.value);
                      setShowLocationDropdown(true);
                    }}
                    onFocus={() => setShowLocationDropdown(true)}
                    placeholder="Type city (e.g. Surat, Ludhiana, Morbi, Ahmedabad)..."
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#0284C7] transition"
                  />
                  <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-[#94A3B8]" />
                </div>

                {/* Location Suggestions Dropdown */}
                {showLocationDropdown && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-[#FFFFFF] border border-[#CBD5E1] rounded-xl shadow-lg max-h-56 overflow-y-auto p-1.5 space-y-1">
                    {filteredLocs.map((loc, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectLocation(loc)}
                        className="px-3.5 py-2.5 rounded-lg hover:bg-[#F0F7FF] hover:text-[#0284C7] text-xs font-medium cursor-pointer flex justify-between items-center transition"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-[#64748B]" />
                          <span className="font-bold text-[#0A192F]">{loc.city}</span>
                          <span className="text-[#64748B]">({loc.state})</span>
                        </div>
                        {loc.corridor && (
                          <span className="text-[10px] text-[#94A3B8] font-mono">{loc.corridor}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* State & Country confirmation */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-bold text-[#475569] uppercase mb-1">
                    State
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-xs text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#0284C7]"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-[#475569] uppercase mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={country}
                    readOnly
                    className="w-full h-11 px-3 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] text-xs text-[#64748B]"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E2E8F0] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#64748B] hover:text-[#0A192F] transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={!city.trim()}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#FFFFFF] bg-[#0284C7] hover:bg-[#0369A1] transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: WHAT YOU SHIP (200+ SEARCHABLE CATEGORIES) */}
        {step === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-2">
              <span className="text-xs font-mono text-[#0284C7] font-bold uppercase">03 • CARGO CLASSIFICATION</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
                What does your business ship?
              </h2>
              <p className="text-sm text-[#475569]">
                Search across 200+ product categories. Select all categories your business regularly transports.
              </p>
            </div>

            {/* Selected Category Tags Display */}
            {selectedCategories.length > 0 && (
              <div className="p-3.5 rounded-xl bg-[#FFFFFF] border border-[#BAE6FD] space-y-2">
                <div className="text-[11px] font-mono text-[#0284C7] font-bold uppercase flex justify-between">
                  <span>Selected Categories ({selectedCategories.length})</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="text-[#DC2626] hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCategories.map((cat) => (
                    <span
                      key={cat}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-[#F0F7FF] text-[#0284C7] border border-[#BAE6FD]"
                    >
                      <span>{cat}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className="hover:text-[#DC2626] transition cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Command-Style Category Search Input */}
            <div className="space-y-3 pt-1">
              <div className="relative">
                <input
                  ref={categoryInputRef}
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search your business type (e.g. Textiles, Furniture, Spices, Bearings, Plastics)..."
                  className="w-full h-12 pl-10 pr-4 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-sm text-[#0A192F] focus:outline-none focus:ring-2 focus:ring-[#0284C7] transition"
                  autoFocus
                />
                <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-[#94A3B8]" />
              </div>

              {/* Filtered Category Grid / Results */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono text-[#64748B] flex justify-between px-1">
                  <span>{categorySearch ? `MATCHING CATEGORIES (${filteredCategories.length})` : 'POPULAR SME CATEGORIES'}</span>
                  <span>CLICK TO TOGGLE</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                  {filteredCategories.slice(0, 18).map((cat) => {
                    const isSelected = selectedCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleToggleCategory(cat.name)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-medium transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-[#0284C7] text-[#FFFFFF] border-[#0284C7] shadow-sm'
                            : 'bg-[#FFFFFF] text-[#334155] border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <span className="truncate mr-1">{cat.name}</span>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#FFFFFF]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E2E8F0] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#64748B] hover:text-[#0A192F] transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                disabled={selectedCategories.length === 0}
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#FFFFFF] bg-[#0284C7] hover:bg-[#0369A1] transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: WORKSPACE READY */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn text-left">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-xs font-mono font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                <span>CONFIGURATION VERIFIED</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
                Your Lonics workspace is ready.
              </h2>
              <p className="text-sm text-[#475569]">
                Review your profile summary below. Clicking continue commits your SME profile to the Lonics Operating System.
              </p>
            </div>

            {/* Profile Review Summary Box */}
            <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E2E8F0] space-y-4 text-xs font-mono">
              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                <span className="text-[#64748B]">BUSINESS ENTITY</span>
                <span className="font-bold text-sm text-[#0A192F]">{businessName} ({entityType})</span>
              </div>

              <div className="flex justify-between items-center border-b border-[#E2E8F0] pb-3">
                <span className="text-[#64748B]">PRIMARY ORIGIN HUB</span>
                <span className="font-bold text-[#0A192F]">{city}, {state}, {country}</span>
              </div>

              <div className="flex justify-between items-start border-b border-[#E2E8F0] pb-3">
                <span className="text-[#64748B]">CARGO CATEGORIES</span>
                <span className="font-bold text-[#0284C7] text-right max-w-xs">
                  {selectedCategories.join(', ')}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">AUTHENTICATED ACCOUNT</span>
                <span className="text-[#0A192F] font-bold truncate max-w-xs">
                  {currentUser?.email || 'Authenticated User'}
                </span>
              </div>
            </div>

            <div className="pt-6 border-t border-[#E2E8F0] flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#64748B] hover:text-[#0A192F] transition cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleCompleteOnboarding}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-semibold text-[#FFFFFF] bg-[#0284C7] hover:bg-[#0369A1] transition shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#FFFFFF]" />
                    <span>Committing to Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Lonics</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Subtle Footer */}
      <div className="max-w-2xl w-full mx-auto text-center text-xs text-[#94A3B8] font-mono">
        LONICS FREIGHT OS • DATA PERSISTED ON SUPABASE
      </div>

    </div>
  );
}
