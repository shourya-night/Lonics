import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  Zap,
  Database,
  GitFork,
} from 'lucide-react';

interface AgentDetail {
  id: string;
  name: string;
  role: string;
  whatItDoes: string;
  signalsUsed: string[];
  decisionMade: string;
  operationalImpact: string;
}

interface AgentLayer {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  agents: AgentDetail[];
}

const AGENT_LAYERS: AgentLayer[] = [
  {
    id: 'booking',
    title: 'LAYER 1: BOOKING & ECONOMIC VIABILITY',
    subtitle: 'Demand aggregation, physical validation, and arbitrage modeling',
    summary: 'Ingests fragmented SME cargo, validates physical packaging compatibility, computes true dimensional density, and prices multimodal door-to-door transit.',
    agents: [
      {
        id: 'consolidation',
        name: 'CONSOLIDATION AGENT',
        role: 'Dynamic LCL Capacity Aggregator',
        whatItDoes: 'Finds compatible SME shipments that can share container capacity based on origin clusters, destination corridors, departure windows, and dimensional constraints.',
        signalsUsed: ['Origin/destination coordinates', 'Departure time windows', 'CBM volumetric density', 'Pallet/box geometry', 'Delivery deadlines'],
        decisionMade: 'Determines the optimal co-loading container window and assigns load layouts across multiple SME shippers.',
        operationalImpact: 'Turns fragmented sub-3t SME demand into economically viable shared full-container loads (FCL), unlocking wholesale rail pricing.',
      },
      {
        id: 'compatibility',
        name: 'COMPATIBILITY GUARD',
        role: 'Physical & Regulatory Hazard Firewall',
        whatItDoes: 'Prevents incompatible cargo from being co-loaded in the same container by enforcing strict chemical, odor, temperature, and physical constraint matrices.',
        signalsUsed: ['Cargo classification codes', 'Material Safety Data Sheets (MSDS)', 'Temperature tolerance thresholds', 'Odor permeability classes', 'Packaging integrity standards'],
        decisionMade: 'Approves or blocks co-loading combinations before any booking is committed.',
        operationalImpact: 'Guarantees zero contamination and eliminates cargo rejection risks at inland container depots.',
      },
      {
        id: 'dim_weight',
        name: 'DIM-WEIGHT PRICING AGENT',
        role: 'Volumetric & Density Engine',
        whatItDoes: 'Calculates commercially relevant shipment weight and physical utilization using actual weight, dimensions, and container geometry.',
        signalsUsed: ['Package L×W×H dimensions', 'Dead weight scale telemetry', 'MobileNet vision bounding estimates', 'Container stackability rules'],
        decisionMade: 'Computes billable chargeable weight and true space consumption in the shared unit.',
        operationalImpact: 'Prevents volumetric undercharging and gives SMEs fair, transparent pricing based on actual space utilized.',
      },
      {
        id: 'dual_brain',
        name: 'DUAL-BRAIN PRICING AGENT',
        role: 'Multimodal Arbitrage Optimizer',
        whatItDoes: 'Calculates a commercially viable door-to-door price by comparing first-mile trucking, rail/CTO wholesale rates, terminal handling, last-mile delivery, and risk buffers against spot road rates.',
        signalsUsed: ['Wholesale CTO container tariffs', 'Diesel fuel price indices', 'Spot road freight rates', 'ICD terminal handling tariffs', 'First/last mile truck rates'],
        decisionMade: 'Selects whether a multimodal route or pure road route offers superior cost/ETA economics for the customer.',
        operationalImpact: 'Passes wholesale rail economics directly to SME shippers while maintaining healthy operating margins.',
      },
    ],
  },
  {
    id: 'movement',
    title: 'LAYER 2: MOVEMENT & SYNCHRONIZED TRANSIT',
    subtitle: 'Physical orchestration across multi-party carrier handoffs',
    summary: 'Coordinates first-mile dispatch, train rake scheduling, real-time hybrid tracking across public/private feeds, and municipal urban restrictions.',
    agents: [
      {
        id: 'conductor',
        name: 'MULTIMODAL CONDUCTOR AGENT',
        role: 'End-to-End Operational Coordinator',
        whatItDoes: 'Coordinates the entire physical shipment lifecycle across first-mile pickup truck, consolidation hub, shared container stuffing, rail transit, destination terminal, and last-mile delivery.',
        signalsUsed: ['Transporter assignment events', 'Hub cross-dock receipts', 'Railway Receipt (RR) numbers', 'Container seal numbers', 'Terminal gate-in/gate-out timestamps'],
        decisionMade: 'Triggers handoff sequences between independent transport operators and monitors critical operational windows.',
        operationalImpact: 'Eliminates coordination overhead for SMEs: one booking orchestrates up to 5 independent physical operators.',
      },
      {
        id: 'tracking',
        name: 'HYBRID TRACKING ENGINE',
        role: 'Multi-Signal Location Fuser',
        whatItDoes: 'Combines disparate tracking signals including CRIS/FOIS railway feeds, NTES public railway status, Container Train Operator (CTO) partner telemetry, FASTag toll records, and Railway Receipt OCR scans.',
        signalsUsed: ['FOIS rake location feeds', 'NTES junction passing times', 'FASTag toll plaza pings', 'CTO GPS feeds', 'Ground Ops OCR scans'],
        decisionMade: 'Fuses imperfect, delayed data streams into a single verified ground-truth tracking position.',
        operationalImpact: 'Provides unbroken visibility even when individual government or transporter APIs experience downtime.',
      },
      {
        id: 'trajectory',
        name: 'TRAJECTORY PREDICTOR AGENT',
        role: 'Dynamic ETA Forecaster',
        whatItDoes: 'Predicts operational arrival time using current position, historical transit velocity, route congestion, train priorities, terminal congestion, and handoff timing.',
        signalsUsed: ['Historical corridor transit speeds', 'Indian Railways sectional congestion', 'ICD yard turnaround times', 'Border checkpost queue lengths'],
        decisionMade: 'Computes high-confidence dynamic ETA windows and flags delay probabilities before they impact delivery.',
        operationalImpact: 'Gives destination receivers precise 2-hour arrival windows, enabling planned warehouse dock staffing.',
      },
      {
        id: 'urban_routing',
        name: 'URBAN ROUTING AGENT',
        role: 'City Entry & Last-Mile Split Engine',
        whatItDoes: 'Navigates city-specific municipal entry restrictions such as no-entry hours, fuel type bans (BS-IV/BS-VI), GRAP anti-pollution regulations, and delivery deadlines.',
        signalsUsed: ['Municipal traffic police notifications', 'GRAP air quality stages', 'Vehicle fuel/emission certificates', 'Consignee receiving dock hours'],
        decisionMade: 'Decides whether line-haul trucks can enter directly or if cargo must be cross-docked into electric mini-trucks (e-LCVs).',
        operationalImpact: 'Prevents municipal impoundment, fines, and delayed morning deliveries in major metros like Delhi-NCR and Mumbai.',
      },
    ],
  },
  {
    id: 'resilience',
    title: 'LAYER 3: RESILIENCE, RISK & REGULATORY COMPLIANCE',
    subtitle: 'Exception isolation, regulatory pre-queues, and backhaul optimization',
    summary: 'Monitors transporter operational risk, pre-queues compliance actions 120 minutes in advance, handles rejected cargo, and manages capacity compensation.',
    agents: [
      {
        id: 'compliance',
        name: 'COMPLIANCE NODE',
        role: 'Automated Regulatory Pre-Queue',
        whatItDoes: 'Handles GST e-Way Bill Part A/Part B updates, transit validity extensions, and ULIP logistics integrations via automated queues.',
        signalsUsed: ['NIC e-Way Bill portal status', 'Transporter GSTIN records', 'Vehicle registration change events', 'ULIP gateway tokens', 'FASTag toll passage timestamps'],
        decisionMade: 'Executes automated e-Way Bill Part B vehicle updates 120 minutes before line-haul handoffs to prevent expired validity.',
        operationalImpact: 'Eliminates roadside commercial tax penalties and detention delays at state borders.',
      },
      {
        id: 'risk_gate',
        name: 'RISK-GATE AGENT',
        role: 'Transporter Reliability Scorecard',
        whatItDoes: 'Assesses transporter reliability and operational risk using real-world signals including FASTag route adherence history and on-time performance scores.',
        signalsUsed: ['Transporter historical TRS scores', 'FASTag route deviation frequency', 'Vehicle age & fitness records (Vahan)', 'Historical driver delay trends'],
        decisionMade: 'Dispatches secondary backup capacity automatically if a transporter displays abnormal delay probability.',
        operationalImpact: 'Guarantees shipment reliability even in an unorganized Indian trucking market.',
      },
      {
        id: 'return_exchange',
        name: 'RETURN EXCHANGE AGENT',
        role: 'Capacity & Backhaul Balancer',
        whatItDoes: 'Handles rejected deliveries, transit cancellations, and container positioning optimization by dynamically discounting backhaul capacity.',
        signalsUsed: ['Delivery confirmation OTP status', 'Consignee rejection reason codes', 'Container positioning score (CPS)', 'Return corridor demand queues'],
        decisionMade: 'Isolates rejected goods without delaying other co-loaded SME freight and routes return inventory to nearest regional hub.',
        operationalImpact: 'Reduces return logistics losses and improves container asset turnaround velocity.',
      },
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [selectedLayerIndex, setSelectedLayerIndex] = useState(0);
  const [selectedAgentId, setSelectedAgentId] = useState(AGENT_LAYERS[0].agents[0].id);
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeLayer = AGENT_LAYERS[selectedLayerIndex];
  const activeAgent = activeLayer.agents.find((a) => a.id === selectedAgentId) || activeLayer.agents[0];

  const handleSelectLayer = (index: number) => {
    setSelectedLayerIndex(index);
    setSelectedAgentId(AGENT_LAYERS[index].agents[0].id);
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0A192F] font-sans selection:bg-[#E0F2FE] selection:text-[#0369A1]">
      
      {/* 1. TOP MINIMAL NAVIGATION */}
      <header className="sticky top-0 z-50 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#E2E8F0] transition-all">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-2xl tracking-tighter text-[#0A192F]">
              LONICS
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#F0F7FF] text-[#0284C7] border border-[#BAE6FD]">
              OPERATING SYSTEM
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#475569]">
            <a href="#problem" className="hover:text-[#0A192F] transition">How It Works</a>
            <a href="#consolidation" className="hover:text-[#0A192F] transition">Consolidation</a>
            <a href="#agents" className="hover:text-[#0A192F] transition">11 Agents</a>
            <a href="#failure-handling" className="hover:text-[#0A192F] transition">Resilience</a>
            <a href="#infrastructure" className="hover:text-[#0A192F] transition">Infrastructure</a>
            <a href="#ground-ops" className="hover:text-[#0A192F] transition">Ground Ops</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-semibold text-[#FFFFFF] bg-[#0284C7] hover:bg-[#0369A1] transition shadow-sm hover:shadow active:scale-[0.98] cursor-pointer"
            >
              Get Started
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 bg-gradient-to-b from-[#FFFFFF] via-[#F8FAFC] to-[#F0F7FF]/40 border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            
            {/* Left Column: Hero Headline & Narrative */}
            <div className="lg:col-span-6 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E0F2FE]/60 border border-[#BAE6FD] text-[#0369A1] text-xs font-mono font-medium">
                <Zap className="h-3.5 w-3.5" />
                <span>AGENTIC MULTIMODAL FREIGHT OS</span>
              </div>

              <div className="space-y-4">
                <div className="text-sm font-mono uppercase tracking-widest text-[#0284C7] font-bold">
                  LONICS
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0A192F] tracking-tight leading-[1.1]">
                  Move freight. <br className="hidden sm:inline" />
                  Without managing freight.
                </h1>
              </div>

              <p className="text-lg md:text-xl text-[#475569] leading-relaxed max-w-xl">
                One booking for multimodal transport. Lonics coordinates consolidation, rail, road, compliance, tracking, and last-mile delivery through a network of specialized agents.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl text-base font-semibold text-white bg-[#0284C7] hover:bg-[#0369A1] shadow-md hover:shadow-lg transition active:scale-[0.99] cursor-pointer"
                >
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>

                <a
                  href="#problem"
                  className="inline-flex items-center justify-center px-6 py-4 rounded-xl text-base font-semibold text-[#0A192F] bg-[#FFFFFF] hover:bg-[#F8FAFC] border border-[#CBD5E1] transition shadow-sm cursor-pointer"
                >
                  See how it works
                </a>
              </div>

              <div className="pt-4 border-t border-[#E2E8F0]/80 flex items-center gap-6 text-xs text-[#64748B] font-mono">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0284C7]" />
                  <span>ONE BOOKING</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0284C7]" />
                  <span>ONE PRICE</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-[#0284C7]" />
                  <span>DOOR TO DOOR</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Video */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl overflow-hidden border border-[#CBD5E1] bg-[#FFFFFF] shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                <video
                  ref={videoRef}
                  src="/videos/lonics-hero.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full aspect-video object-cover block"
                />
              </div>
              <p className="text-center text-xs font-mono text-[#64748B] mt-3">
                Live Orchestration: First-Mile Pickup → Consolidation → DFC Rail → Delhi Last-Mile
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 3. PROBLEM SECTION */}
      <section id="problem" className="py-24 md:py-32 bg-[#FFFFFF] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              THE STRUCTURAL CHALLENGE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              India already has the infrastructure. <br />
              SMEs just can't use it efficiently.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Rail and multimodal freight can be economically attractive at scale, but smaller shippers often lack the volume and coordination required to access it efficiently.
            </p>
          </div>

          {/* Canonical Example Flow */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 md:p-10 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[#E2E8F0]">
              <div>
                <span className="text-xs font-mono font-bold text-[#0284C7] uppercase">CANONICAL SCENARIO</span>
                <h3 className="text-xl font-bold text-[#0A192F] mt-0.5">2 Tonnes of Textiles: Surat → Delhi</h3>
              </div>
              <div className="text-xs font-mono bg-[#FFFFFF] border border-[#CBD5E1] px-3.5 py-1.5 rounded-lg text-[#475569]">
                Shared DFC Capacity vs Road Spot
              </div>
            </div>

            {/* 7-Step Horizontal Visual Journey */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
              {[
                { step: '01', title: 'SME Shipment', desc: '2.0t Textiles boxed' },
                { step: '02', title: 'First-Mile Pickup', desc: 'Local Surat dispatch' },
                { step: '03', title: 'Consolidation', desc: 'LCL co-load layout' },
                { step: '04', title: 'Shared Container', desc: 'Stuffing & seal lock' },
                { step: '05', title: 'Rail / DFC', desc: 'High-speed transit' },
                { step: '06', title: 'Delhi Terminal', desc: 'ICD Tughlakabad destuff' },
                { step: '07', title: 'Last-Mile Delivery', desc: 'Consignee receiving' },
              ].map((item, idx) => (
                <div key={idx} className="bg-[#FFFFFF] border border-[#E2E8F0] p-4 rounded-xl flex flex-col justify-between text-left space-y-2">
                  <span className="text-[10px] font-mono font-bold text-[#0284C7]">{item.step}</span>
                  <div>
                    <h4 className="text-xs font-bold text-[#0A192F] leading-snug">{item.title}</h4>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-normal">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#BAE6FD] flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-[#0284C7]"></span>
                <span className="font-medium text-[#0A192F]">
                  The customer sees one shipment. Lonics coordinates the network.
                </span>
              </div>
              <span className="hidden sm:inline font-mono text-xs text-[#0284C7] font-semibold">
                ZERO COORDINATION OVERHEAD
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* 4. CONSOLIDATION SECTION */}
      <section id="consolidation" className="py-24 md:py-32 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              THE CORE PRODUCT WEDGE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              Small shipments become meaningful freight.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Lonics finds compatible shipments sharing origin regions, destination regions, departure windows, cargo constraints, and delivery requirements.
            </p>
          </div>

          {/* Visual Transformation Matrix */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-8 md:p-12 shadow-sm space-y-10">
            
            {/* Step Pipeline Badges */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              {[
                { title: 'FRAGMENTED DEMAND', desc: 'Independent SME loads' },
                { title: 'INTELLIGENT CONSOLIDATION', desc: 'Safety & density checks' },
                { title: 'SHARED CAPACITY', desc: 'Fully utilized 40ft container' },
                { title: 'MULTIMODAL MOVEMENT', desc: 'DFC Rail schedule sync' },
              ].map((p, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] text-left">
                  <span className="text-[10px] font-mono text-[#0284C7] font-bold">PHASE 0{idx + 1}</span>
                  <h4 className="text-xs font-bold text-[#0A192F] mt-1">{p.title}</h4>
                  <p className="text-[11px] text-[#64748B] mt-0.5">{p.desc}</p>
                </div>
              ))}
            </div>

            {/* Individual Loads Aggregation Visualization */}
            <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
              <div className="flex justify-between items-center text-xs font-mono text-[#64748B]">
                <span>INPUT: 7 INCOMING SME SHIPMENT LOADS</span>
                <span>DESTINATION CORRIDOR: SURAT → DELHI-NCR</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { weight: '2.0t', type: 'Textiles', origin: 'Surat' },
                  { weight: '1.5t', type: 'Garments', origin: 'Surat' },
                  { weight: '3.0t', type: 'Yarn Cones', origin: 'Navsari' },
                  { weight: '2.2t', type: 'Apparel', origin: 'Surat' },
                  { weight: '1.8t', type: 'Packaging', origin: 'Vapi' },
                  { weight: '2.5t', type: 'Fabrics', origin: 'Surat' },
                  { weight: '2.0t', type: 'Hardware', origin: 'Ahmedabad' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] text-left">
                    <div className="text-base font-bold font-mono text-[#0A192F]">{item.weight}</div>
                    <div className="text-xs font-semibold text-[#0284C7] mt-0.5">{item.type}</div>
                    <div className="text-[10px] text-[#64748B]">{item.origin}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-5 rounded-xl bg-[#F0F7FF] border border-[#BAE6FD] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono font-bold text-[#0284C7] uppercase">TOTAL CONSOLIDATED CAPACITY</div>
                  <div className="text-lg font-bold text-[#0A192F]">
                    15.0 Tonnes • 24.6 CBM • 92% Shared Container Space Utilization
                  </div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-[#FFFFFF] border border-[#CBD5E1] font-mono text-xs text-[#0A192F] font-bold">
                  Status: LOCKED FOR DFC DEPARTURE
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 5. THE 11 AGENTS SECTION (3 CONCEPTUAL LAYERS) */}
      <section id="agents" className="py-24 md:py-32 bg-[#FFFFFF] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              SYSTEM ARCHITECTURE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              11 specialized operational agents. <br />
              One coordinated system.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Lonics coordinates physical freight through three distinct operational layers. The user interacts with one single window while specialized agents manage coordination.
            </p>
          </div>

          {/* Three Conceptual Layers Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {AGENT_LAYERS.map((layer, idx) => {
              const isSelected = selectedLayerIndex === idx;
              return (
                <button
                  key={layer.id}
                  onClick={() => handleSelectLayer(idx)}
                  className={`p-6 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#F0F7FF] border-[#0284C7] shadow-sm'
                      : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#CBD5E1]'
                  }`}
                >
                  <span className="text-[11px] font-mono font-bold text-[#0284C7] block">
                    {layer.title.split(':')[0]}
                  </span>
                  <h3 className="text-base font-bold text-[#0A192F] mt-1">
                    {layer.title.split(':')[1]}
                  </h3>
                  <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                    {layer.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Active Layer Detail Interactive View */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 md:p-10 space-y-8">
            <div className="border-b border-[#E2E8F0] pb-6">
              <span className="text-xs font-mono text-[#0284C7] font-bold uppercase">{activeLayer.title}</span>
              <p className="text-sm text-[#475569] mt-1 leading-relaxed">{activeLayer.summary}</p>
            </div>

            {/* Sub-Agent Selector Pills */}
            <div className="flex flex-wrap gap-2">
              {activeLayer.agents.map((agent) => {
                const isActive = agent.id === activeAgent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition cursor-pointer border ${
                      isActive
                        ? 'bg-[#0284C7] text-[#FFFFFF] border-[#0284C7]'
                        : 'bg-[#FFFFFF] text-[#475569] border-[#CBD5E1] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {agent.name}
                  </button>
                );
              })}
            </div>

            {/* Granular Agent Detail Panel */}
            <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E2E8F0] pb-4">
                <div>
                  <h4 className="text-xl font-bold text-[#0A192F]">{activeAgent.name}</h4>
                  <span className="text-xs font-mono text-[#0284C7]">{activeAgent.role}</span>
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-mono bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]">
                  ACTIVE OPERATIONAL AGENT
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-2">
                  <h5 className="text-xs font-mono font-bold text-[#64748B] uppercase">WHAT IT DOES</h5>
                  <p className="text-[#334155] leading-relaxed">{activeAgent.whatItDoes}</p>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-mono font-bold text-[#64748B] uppercase">SIGNALS & DATA FEEDS USED</h5>
                  <ul className="space-y-1 text-[#334155]">
                    {activeAgent.signalsUsed.map((sig, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0284C7]"></span>
                        <span>{sig}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-mono font-bold text-[#64748B] uppercase">DECISION IT MAKES</h5>
                  <p className="text-[#334155] leading-relaxed">{activeAgent.decisionMade}</p>
                </div>

                <div className="space-y-2">
                  <h5 className="text-xs font-mono font-bold text-[#64748B] uppercase">WHY IT MATTERS OPERATIONALLY</h5>
                  <p className="text-[#0369A1] font-medium leading-relaxed">{activeAgent.operationalImpact}</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 6. END-TO-END SHIPMENT SECTION */}
      <section className="py-24 md:py-32 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              UNBROKEN PHYSICAL TRANSIT
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              One shipment view over many independent operators.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              From factory floor to consignee warehouse, Lonics coordinates handoffs across line-haul rail, road loops, ICD terminals, and urban EV fleets.
            </p>
          </div>

          {/* Horizontal Journey Pipeline */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-8 md:p-12 shadow-sm space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2 text-center text-xs">
              {[
                { node: 'FACTORY', role: 'Cargo Origin' },
                { node: 'FIRST MILE', role: 'Pickup Loop' },
                { node: 'CONSOLIDATION', role: 'Hub Stuffing' },
                { node: 'CONTAINER', role: 'Shared Seal' },
                { node: 'RAIL / DFC', role: 'High Speed' },
                { node: 'TERMINAL', role: 'ICD Destuff' },
                { node: 'URBAN ROUTE', role: 'City Bans' },
                { node: 'LAST MILE', role: 'e-LCV Loop' },
                { node: 'CUSTOMER', role: 'Delivery OTP' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] flex flex-col justify-between space-y-1">
                  <span className="text-[10px] font-mono text-[#0284C7] font-bold">0{idx + 1}</span>
                  <div className="font-bold text-[#0A192F]">{item.node}</div>
                  <div className="text-[10px] text-[#64748B]">{item.role}</div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#F0F7FF] border border-[#BAE6FD] text-center text-xs font-mono text-[#0369A1]">
              AUTOMATED WORKFLOW ORCHESTRATION VIA TEMPORAL SAGAS & REDIS CACHING
            </div>
          </div>

        </div>
      </section>

      {/* 7. FAILURE HANDLING SECTION */}
      <section id="failure-handling" className="py-24 md:py-32 bg-[#FFFFFF] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              EXECUTION SYSTEM RESILIENCE
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              Freight doesn't follow the plan. <br />
              Lonics does.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Real logistics systems face road delays, server downtime, and cancellations. Lonics is built as an execution engine with deterministic compensation mechanisms.
            </p>
          </div>

          {/* 4 Failure Scenarios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Scenario 1 */}
            <div className="p-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#0284C7]">SCENARIO 01</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                  TRANSPORTER DELAY
                </span>
              </div>
              <h3 className="text-base font-bold text-[#0A192F]">First-Mile Transporter Delayed in Transit</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Risk-Gate identifies delay risk from FASTag standstill signals → queries standby regional capacity → reassigns replacement transporter to protect the consolidation rail cut-off window.
              </p>
            </div>

            {/* Scenario 2 */}
            <div className="p-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#0284C7]">SCENARIO 02</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                  API OUTAGE
                </span>
              </div>
              <h3 className="text-base font-bold text-[#0A192F]">Government ULIP / e-Way Bill Gateway Unavailable</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Compliance pre-queue maintains pending updates in Redis state → Temporal workflow automatically executes idempotent exponential retries until gateway restores, preventing vehicle detention.
              </p>
            </div>

            {/* Scenario 3 */}
            <div className="p-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#0284C7]">SCENARIO 03</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                  CONSIGNMENT REJECTION
                </span>
              </div>
              <h3 className="text-base font-bold text-[#0A192F]">One Consolidated SME Consignment Rejected</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Return Exchange Agent isolates only the affected shipment → manages return transit and compliance documentation → remaining co-loaded SME freight continues unbroken to final destination.
              </p>
            </div>

            {/* Scenario 4 */}
            <div className="p-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#0284C7]">SCENARIO 04</span>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                  CANCELLATION SAGA
                </span>
              </div>
              <h3 className="text-base font-bold text-[#0A192F]">Customer Cancels Booking Before Departure</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Temporal Saga orchestrates atomic rollback: releases first-mile truck booking, returns rail capacity slot, updates container volume budget, and notifies consolidation queue.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 8. INFRASTRUCTURE ARCHITECTURE SECTION */}
      <section id="infrastructure" className="py-24 md:py-32 bg-[#F8FAFC] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              UNIFIED INTEGRATION LAYER
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              One operational layer across a fragmented freight network.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Lonics connects transport infrastructure, government systems, tracking sources, and ground operations into one coordinated workflow.
            </p>
          </div>

          {/* Architecture Visualization Box */}
          <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl p-8 md:p-12 shadow-sm space-y-8">
            
            <div className="text-center space-y-2">
              <div className="inline-block px-4 py-1.5 rounded-full bg-[#0A192F] text-[#FFFFFF] font-mono font-extrabold text-sm tracking-wider">
                LONICS MULTIMODAL OPERATING SYSTEM
              </div>
              <p className="text-xs text-[#64748B] font-mono">Central Agentic Coordination Engine</p>
            </div>

            {/* Surrounding Integrations Grid with Accurate Statuses */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[
                { name: 'ULIP', full: 'Unified Logistics Interface Platform', status: 'SANDBOX-TESTED' },
                { name: 'FOIS', full: 'Freight Operations Information System', status: 'SIMULATED' },
                { name: 'NTES', full: 'National Train Enquiry System', status: 'BUILT' },
                { name: 'CTO FEEDS', full: 'Container Train Operator Telemetry', status: 'IN DISCUSSION' },
                { name: 'FASTAG', full: 'National Electronic Toll Collection', status: 'TESTED' },
                { name: 'VAHAN', full: 'National Vehicle Registry', status: 'BUILT' },
                { name: 'OCR ENGINE', full: 'Railway Receipt Scanner', status: 'BUILT' },
                { name: 'GROUND OPS', full: 'Physical Yard Coordination Network', status: 'PLANNED' },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-xs text-[#0A192F]">{item.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#FFFFFF] border border-[#CBD5E1] text-[#0284C7]">
                      {item.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-tight">{item.full}</p>
                </div>
              ))}
            </div>

            {/* Core Workflow Foundation Badges */}
            <div className="pt-6 border-t border-[#E2E8F0] flex flex-wrap justify-around gap-4 text-xs font-mono text-[#475569]">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#0284C7]" />
                <span>APACHE KAFKA: Asynchronous Event Bus</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#0284C7]" />
                <span>REDIS: Fast In-Memory State & Caches</span>
              </div>
              <div className="flex items-center gap-2">
                <GitFork className="h-4 w-4 text-[#0284C7]" />
                <span>TEMPORAL: Durable Workflow & Saga Schedulers</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 9. GROUND OPERATIONS SECTION */}
      <section id="ground-ops" className="py-24 md:py-32 bg-[#FFFFFF] border-b border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-6 md:px-12 text-left space-y-16">
          
          <div className="max-w-3xl space-y-5">
            <span className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
              PHYSICAL GROUND INTEGRATION
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0A192F] tracking-tight leading-tight">
              Software coordinates the network. <br />
              People handle the physical world.
            </h2>
            <p className="text-lg text-[#475569] leading-relaxed">
              Lonics couples autonomous agent coordination with a target network of ground operators at key railway terminals and container depots.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Target 5 Hubs */}
            <div className="lg:col-span-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-6 md:p-8 space-y-4">
              <span className="text-xs font-mono font-bold text-[#0284C7] uppercase">
                TARGET GROUND OPS HUBS (PHASED EXPANSION)
              </span>

              <div className="space-y-3">
                {[
                  { city: 'Surat / Ahmedabad', state: 'Gujarat Corridor', role: 'Textile & Chemical Consolidation Hubs' },
                  { city: 'Ludhiana', state: 'Punjab Cluster', role: 'Hosiery & Machine Tools Inland Terminal' },
                  { city: 'Delhi-NCR / Tughlakabad ICD', state: 'Northern Gateway', role: 'Major Destination Terminal & Urban Handoff' },
                  { city: 'Itarsi Junction', state: 'Central Transit', role: 'North-South Rail Corridor Staging Point' },
                  { city: 'Mumbai / JNPT', state: 'Western Gateway', role: 'Port & Line-Haul Intermodal Staging' },
                ].map((hub, i) => (
                  <div key={i} className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] flex justify-between items-center">
                    <div>
                      <div className="font-bold text-xs text-[#0A192F]">{hub.city}</div>
                      <div className="text-[11px] text-[#64748B]">{hub.role}</div>
                    </div>
                    <span className="text-[10px] font-mono text-[#0284C7]">{hub.state}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Ground Ops Duties */}
            <div className="lg:col-span-6 space-y-4">
              <span className="text-xs font-mono font-bold text-[#0284C7] uppercase">
                GROUND OPERATIONS CAPABILITIES
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: 'Physical Exception Handling', desc: 'On-site resolution of physical packaging issues' },
                  { title: 'Railway Receipt OCR', desc: 'Instant digitization of physical stamped receipts' },
                  { title: 'Terminal Coordination', desc: 'Direct liaising with yard operators and crane teams' },
                  { title: 'Cargo Verification', desc: 'Pre-stuffing physical inspection of pallet constraints' },
                  { title: 'Documentation Support', desc: 'State tax checkpost physical transit assistance' },
                  { title: 'Ground-Truth Tracking', desc: 'Physical confirmation of container loading & seals' },
                ].map((cap, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] space-y-1">
                    <h4 className="text-xs font-bold text-[#0A192F]">{cap.title}</h4>
                    <p className="text-[11px] text-[#64748B] leading-relaxed">{cap.desc}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 10. FINAL CTA */}
      <section className="py-24 md:py-32 bg-[#0A192F] text-[#FFFFFF]">
        <div className="max-w-4xl mx-auto px-6 md:px-12 text-center space-y-8">
          <span className="text-xs font-mono uppercase tracking-widest text-[#38BDF8] font-bold">
            READY TO SHIP
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
            Tell Lonics what needs to move.
          </h2>
          <p className="text-lg md:text-xl text-[#94A3B8] leading-relaxed max-w-2xl mx-auto">
            Where it needs to go. When it needs to arrive. Lonics handles the coordination.
          </p>

          <div className="pt-4">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center justify-center px-10 py-4 rounded-xl text-base font-semibold text-[#0A192F] bg-[#38BDF8] hover:bg-[#7DD3FC] transition shadow-lg active:scale-[0.99] cursor-pointer"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="py-12 bg-[#FFFFFF] border-t border-[#E2E8F0] text-xs text-[#64748B]">
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg tracking-tight text-[#0A192F]">LONICS</span>
            <span>•</span>
            <span>Multimodal Freight Operating System for Indian SMEs</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[11px] font-mono">
            <span>STATUS: MISSION CONTROL READY</span>
            <span>FAR AWAY 2026</span>
            <button
              onClick={() => navigate('/app')}
              className="text-[#0284C7] hover:underline cursor-pointer"
            >
              Direct Deck Access →
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
}
