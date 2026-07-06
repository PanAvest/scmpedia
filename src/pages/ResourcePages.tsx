import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  Boxes,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  Globe2,
  GraduationCap,
  Headphones,
  Lightbulb,
  Mail,
  MapPin,
  MessageSquare,
  Newspaper,
  PackageCheck,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { Entry } from '../types'
import { termToSlug } from '../utils'

export type ResourcePageKind =
  | 'resources'
  | 'categories'
  | 'ai-features'
  | 'release-notes'
  | 'blog'
  | 'guides'
  | 'glossary'
  | 'help'
  | 'careers'
  | 'contact'

type DataStatus = 'loading' | 'ready' | 'error' | 'empty'

export interface ResourcePageProps {
  kind: ResourcePageKind
  entries?: Entry[]
  dataStatus?: DataStatus
}

type PageMeta = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  primary: { label: string; to: string }
  secondary?: { label: string; to: string }
}

const PAGE_META: Record<ResourcePageKind, PageMeta> = {
  resources: {
    eyebrow: 'Resource center',
    title: 'Learn supply chain concepts with confidence',
    description: 'Explore practical guides, curated terminology, product updates, and learning tools built for students and working professionals.',
    icon: BookOpen,
    primary: { label: 'Browse guides', to: '/guides' },
    secondary: { label: 'Open glossary', to: '/glossary' },
  },
  categories: {
    eyebrow: 'Dictionary categories',
    title: 'Explore the supply chain by discipline',
    description: 'Move from broad functions to the exact terms, methods, and decisions used across procurement, logistics, planning, operations, and risk.',
    icon: Boxes,
    primary: { label: 'Open dictionary', to: '/dictionary' },
    secondary: { label: 'View guides', to: '/guides' },
  },
  'ai-features': {
    eyebrow: 'AI features',
    title: 'Turn definitions into practical understanding',
    description: 'SCMpedia combines curated terminology with AI-assisted explanations, examples, voice tools, and contextual learning support.',
    icon: BrainCircuit,
    primary: { label: 'Try a search', to: '/' },
    secondary: { label: 'Compare plans', to: '/pricing' },
  },
  'release-notes': {
    eyebrow: 'Product updates',
    title: 'What is new in SCMpedia',
    description: 'A clear record of meaningful improvements to the dictionary, subscriptions, student experience, administration, and accessibility.',
    icon: CalendarDays,
    primary: { label: 'Open SCMpedia', to: '/' },
    secondary: { label: 'Get help', to: '/help' },
  },
  blog: {
    eyebrow: 'SCMpedia blog',
    title: 'Ideas for better supply chain decisions',
    description: 'Short, practical articles connecting terminology to planning, procurement, logistics, resilience, and professional development.',
    icon: Newspaper,
    primary: { label: 'Browse articles', to: '#articles' },
    secondary: { label: 'Explore guides', to: '/guides' },
  },
  guides: {
    eyebrow: 'Practical guides',
    title: 'Apply supply chain knowledge step by step',
    description: 'Use focused playbooks to structure everyday work, prepare for assessments, and connect SCMpedia terms to operational decisions.',
    icon: ClipboardCheck,
    primary: { label: 'Start a guide', to: '#guides' },
    secondary: { label: 'Browse glossary', to: '/glossary' },
  },
  glossary: {
    eyebrow: 'Supply chain glossary',
    title: 'Find the language behind the work',
    description: 'Search an alphabetical view of SCMpedia terms, then open any concept for its full definition and learning tools.',
    icon: BookOpen,
    primary: { label: 'Open dictionary mode', to: '/dictionary' },
    secondary: { label: 'Browse categories', to: '/categories' },
  },
  help: {
    eyebrow: 'Help center',
    title: 'Get answers and keep moving',
    description: 'Find help with accounts, subscriptions, student details, dictionary features, AI tools, and common troubleshooting steps.',
    icon: CircleHelp,
    primary: { label: 'Search help', to: '#help-topics' },
    secondary: { label: 'Contact support', to: '/contact' },
  },
  careers: {
    eyebrow: 'Careers',
    title: 'Help make supply chain knowledge accessible',
    description: 'SCMpedia brings together education, technology, content, and operations to build a practical global learning product.',
    icon: BriefcaseBusiness,
    primary: { label: 'Join the talent network', to: 'mailto:hello@scmpedia.com?subject=SCMpedia%20talent%20network' },
    secondary: { label: 'Learn about us', to: '/about' },
  },
  contact: {
    eyebrow: 'Contact SCMpedia',
    title: 'Talk to the right team',
    description: 'Contact us about product support, student accounts, institutional access, partnerships, content, or enterprise requirements.',
    icon: MessageSquare,
    primary: { label: 'Email support', to: 'mailto:hello@scmpedia.com' },
    secondary: { label: 'Visit help center', to: '/help' },
  },
}

const RESOURCE_LINKS: Array<{
  kind: ResourcePageKind
  label: string
  to: string
  description: string
  icon: LucideIcon
}> = [
  { kind: 'resources', label: 'Resource center', to: '/resources', description: 'Start with the full learning library.', icon: BookOpen },
  { kind: 'categories', label: 'Categories', to: '/categories', description: 'Browse terminology by supply chain function.', icon: Boxes },
  { kind: 'guides', label: 'Guides', to: '/guides', description: 'Follow practical, step-by-step playbooks.', icon: ClipboardCheck },
  { kind: 'glossary', label: 'Glossary', to: '/glossary', description: 'Scan and search supply chain terms.', icon: FileText },
  { kind: 'blog', label: 'Blog', to: '/blog', description: 'Read concise professional insights.', icon: Newspaper },
  { kind: 'ai-features', label: 'AI features', to: '/ai-features', description: 'See how AI supports deeper learning.', icon: BrainCircuit },
  { kind: 'release-notes', label: 'Release notes', to: '/release-notes', description: 'Review recent product improvements.', icon: CalendarDays },
  { kind: 'help', label: 'Help center', to: '/help', description: 'Find answers and troubleshooting steps.', icon: CircleHelp },
  { kind: 'careers', label: 'Careers', to: '/careers', description: 'Learn how to work with SCMpedia.', icon: BriefcaseBusiness },
  { kind: 'contact', label: 'Contact', to: '/contact', description: 'Reach support, partnerships, or sales.', icon: MessageSquare },
]

const CATEGORIES: Array<{
  title: string
  description: string
  topics: string[]
  icon: LucideIcon
}> = [
  { title: 'Procurement & Sourcing', description: 'Supplier selection, negotiation, contracting, category management, and responsible purchasing.', topics: ['Strategic sourcing', 'RFQ', 'Total cost of ownership'], icon: ClipboardCheck },
  { title: 'Logistics & Transportation', description: 'The movement, routing, documentation, and delivery of goods across transport networks.', topics: ['Freight', 'Last mile', 'Incoterms'], icon: Truck },
  { title: 'Inventory Management', description: 'Policies and controls that balance product availability, cash, storage, and uncertainty.', topics: ['Safety stock', 'Reorder point', 'ABC analysis'], icon: Warehouse },
  { title: 'Planning & Forecasting', description: 'Demand, supply, capacity, and scenario planning for better coordinated decisions.', topics: ['S&OP', 'Forecast accuracy', 'Demand sensing'], icon: Lightbulb },
  { title: 'Operations & Manufacturing', description: 'Process design, production flow, quality, maintenance, and continuous improvement.', topics: ['Lean', 'OEE', 'Bottleneck'], icon: Wrench },
  { title: 'Warehousing & Fulfilment', description: 'Receiving, storage, picking, packing, dispatch, and distribution-center performance.', topics: ['Cross-docking', 'Slotting', 'Order cycle'], icon: PackageCheck },
  { title: 'Supply Chain Risk', description: 'Identify, assess, monitor, and respond to operational, supplier, geopolitical, and climate risk.', topics: ['Resilience', 'Business continuity', 'Dual sourcing'], icon: ShieldCheck },
  { title: 'Digital Supply Chains', description: 'Data, automation, analytics, platforms, and connected technologies across supply networks.', topics: ['Digital twin', 'Control tower', 'IoT'], icon: BrainCircuit },
  { title: 'Sustainability & ESG', description: 'Environmental, social, ethical, and governance practices across the value chain.', topics: ['Scope 3', 'Circular economy', 'Traceability'], icon: Globe2 },
  { title: 'Strategy & Performance', description: 'Network design, metrics, governance, cost-to-serve, and alignment with business goals.', topics: ['SCOR', 'Perfect order', 'Network optimization'], icon: Building2 },
]

const AI_FEATURES: Array<{ title: string; description: string; icon: LucideIcon; availability: string }> = [
  { title: 'Context-aware explanations', description: 'Turn a dictionary definition into a practical explanation grounded in supply chain work.', icon: BrainCircuit, availability: 'AI-assisted' },
  { title: 'Real-world examples', description: 'Connect a concept to procurement, logistics, inventory, operations, or industry scenarios.', icon: Lightbulb, availability: 'Learning tool' },
  { title: 'Related concepts', description: 'Move from one term to adjacent ideas so you can understand systems, not isolated definitions.', icon: Boxes, availability: 'Study flow' },
  { title: 'Voice reading', description: 'Listen to definitions and explanations while reviewing material or working hands-free.', icon: Headphones, availability: 'Voice feature' },
  { title: 'Contextual visuals', description: 'Use relevant imagery to make equipment, processes, and operational contexts easier to recognize.', icon: PackageCheck, availability: 'Visual learning' },
  { title: 'Saved learning history', description: 'Return to favorites and recent searches to continue a structured learning session.', icon: BookOpen, availability: 'Account feature' },
]

const RELEASES = [
  {
    date: 'July 2026',
    version: 'Student accounts',
    title: 'Student verification and account controls',
    summary: 'Student plan checkout now captures institution, index number, and programme before payment.',
    items: [
      'Country-first university picker with searchable institutions and custom-school capture.',
      'Student details shown in the account dashboard and settings.',
      'Dashboard editing for university, index number, and programme/course.',
      'Admin view for completed student records and custom university suggestions.',
    ],
  },
  {
    date: 'June 2026',
    version: 'Plans & administration',
    title: 'Editable pricing and stronger administration',
    summary: 'Plan management and admin account controls were expanded without changing the customer checkout flow.',
    items: [
      'Admin-managed monthly and annual plan pricing.',
      'Role-aware admin accounts and password management.',
      'Server-side validation for plan identity, price, and active subscription status.',
      'Improved Paystack loading, verification, and failure messages.',
    ],
  },
  {
    date: 'May 2026',
    version: 'Learning experience',
    title: 'Dictionary, voice, and AI experience refresh',
    summary: 'Core search and learning surfaces were tightened for faster navigation and clearer feedback.',
    items: [
      'Responsive dictionary and page-flip reading modes.',
      'AI explanation loading states and contextual examples.',
      'Favorites, recent history, voice search, and text-to-speech improvements.',
      'Dark mode and mobile layout refinements across core pages.',
    ],
  },
]

const BLOG_POSTS = [
  {
    category: 'Planning',
    title: 'Why forecast accuracy is not the same as forecast usefulness',
    summary: 'A statistically accurate forecast can still arrive too late, hide bias, or fail to support the decision a team must make.',
    readTime: '5 min read',
    points: ['Measure bias alongside aggregate error.', 'Evaluate forecasts at the level where decisions are made.', 'Connect each forecast review to an inventory, capacity, or service action.'],
  },
  {
    category: 'Procurement',
    title: 'Total cost of ownership beyond the purchase price',
    summary: 'Price is visible, but logistics, quality, downtime, payment terms, risk, and end-of-life costs often determine the better supplier.',
    readTime: '6 min read',
    points: ['Define cost categories before comparing bids.', 'Use comparable time horizons and assumptions.', 'Record non-price risk separately instead of hiding it in a single score.'],
  },
  {
    category: 'Inventory',
    title: 'Safety stock is a response to uncertainty, not poor planning',
    summary: 'Safety stock protects service when demand or replenishment varies, but it should be calculated and reviewed rather than treated as permanent excess.',
    readTime: '4 min read',
    points: ['Separate demand variability from lead-time variability.', 'Set service targets by item importance.', 'Recalculate after supplier, demand, or network changes.'],
  },
  {
    category: 'Risk',
    title: 'A practical first step toward supply chain resilience',
    summary: 'Resilience starts with knowing which products, suppliers, routes, and facilities would stop the business if they failed.',
    readTime: '7 min read',
    points: ['Map critical dependencies before designing mitigation.', 'Assign owners and response triggers.', 'Test alternatives before disruption occurs.'],
  },
  {
    category: 'Logistics',
    title: 'What last-mile performance should really measure',
    summary: 'Fast delivery matters, but reliability, first-attempt success, visibility, damage, and cost per stop give a more complete operational picture.',
    readTime: '5 min read',
    points: ['Measure the promise made to the customer.', 'Segment by route, service level, and delivery type.', 'Use exception reasons to drive improvement.'],
  },
  {
    category: 'Leadership',
    title: 'How to use supply chain terminology in executive decisions',
    summary: 'Shared definitions reduce avoidable debate and make trade-offs between cost, cash, service, resilience, and sustainability easier to govern.',
    readTime: '6 min read',
    points: ['Define metrics before reviewing performance.', 'Translate technical terms into decision consequences.', 'Document assumptions when teams use the same word differently.'],
  },
]

const GUIDES = [
  {
    level: 'Starter',
    title: 'Build a supplier evaluation scorecard',
    outcome: 'Create a repeatable comparison of supplier capability, risk, service, quality, and commercial fit.',
    steps: ['Define the decision and minimum qualification rules.', 'Choose weighted criteria with measurable evidence.', 'Score suppliers with cross-functional reviewers.', 'Run sensitivity checks before making the award.', 'Record the decision and future review date.'],
  },
  {
    level: 'Starter',
    title: 'Set an inventory reorder point',
    outcome: 'Create a practical replenishment trigger using expected demand, lead time, and protection against variability.',
    steps: ['Confirm the item, unit of measure, and replenishment source.', 'Estimate demand during replenishment lead time.', 'Choose a service target and safety-stock method.', 'Calculate and test the reorder point against history.', 'Monitor stockouts, excess, and parameter drift.'],
  },
  {
    level: 'Intermediate',
    title: 'Run a monthly S&OP review',
    outcome: 'Align demand, supply, inventory, financial expectations, and executive decisions around one plan.',
    steps: ['Refresh data and assumptions.', 'Review demand changes and forecast risk.', 'Test supply, capacity, and inventory constraints.', 'Prepare scenarios with financial impact.', 'Record executive decisions, owners, and dates.'],
  },
  {
    level: 'Intermediate',
    title: 'Map a supply chain disruption',
    outcome: 'Assess exposure and coordinate response when a supplier, route, system, or facility is disrupted.',
    steps: ['Define the event and affected scope.', 'Identify products, customers, inventory, and dependencies.', 'Estimate time-to-impact and time-to-recover.', 'Compare mitigation options and trade-offs.', 'Set triggers, communications, and review cadence.'],
  },
  {
    level: 'Professional',
    title: 'Prepare a logistics cost-to-serve analysis',
    outcome: 'Understand how customers, channels, products, and service choices consume logistics resources.',
    steps: ['Set the analysis boundary and period.', 'Collect transport, handling, storage, and service costs.', 'Choose defensible activity drivers.', 'Allocate costs and validate outliers.', 'Use the result to redesign service, pricing, or process.'],
  },
  {
    level: 'Student',
    title: 'Study a supply chain concept effectively',
    outcome: 'Move from memorizing a definition to explaining, applying, and comparing a concept.',
    steps: ['Read the concise definition.', 'Rewrite it in your own words.', 'Connect it to a real organization or process.', 'Compare it with one related and one opposing concept.', 'Test yourself with a decision-based example.'],
  },
]

const FALLBACK_GLOSSARY: Entry[] = [
  { term: 'ABC Analysis', definition: 'An inventory classification method that groups items by relative importance, commonly using value or usage.' },
  { term: 'Bullwhip Effect', definition: 'The amplification of demand variability as information and orders move upstream through a supply chain.' },
  { term: 'Cross-Docking', definition: 'Moving inbound goods directly to outbound staging with little or no storage in between.' },
  { term: 'Demand Forecasting', definition: 'Estimating future customer demand using historical data, market information, and judgment.' },
  { term: 'Economic Order Quantity', definition: 'A model for balancing ordering and holding costs to determine an order quantity.' },
  { term: 'Fill Rate', definition: 'The proportion of customer demand fulfilled immediately from available inventory.' },
  { term: 'Incoterms', definition: 'Standard trade terms that clarify delivery responsibilities, costs, and risks between seller and buyer.' },
  { term: 'Just in Time', definition: 'An operating approach that aims to receive or produce only what is needed, when it is needed.' },
  { term: 'Lead Time', definition: 'The elapsed time between initiating a process or order and its completion or receipt.' },
  { term: 'Order Cycle Time', definition: 'The total elapsed time from customer order placement to delivery.' },
  { term: 'Perfect Order', definition: 'An order delivered complete, on time, damage-free, and with correct documentation.' },
  { term: 'Reorder Point', definition: 'The inventory position that triggers a replenishment order.' },
  { term: 'Safety Stock', definition: 'Additional inventory held to protect service against demand or supply uncertainty.' },
  { term: 'S&OP', definition: 'A cross-functional process that aligns demand, supply, inventory, and financial plans.' },
  { term: 'Total Cost of Ownership', definition: 'The complete cost of acquiring, using, supporting, and disposing of a product or service.' },
]

const HELP_TOPICS = [
  { title: 'Accounts & sign-in', description: 'Google sign-in, email/password access, password resets, and account details.', icon: Users },
  { title: 'Student accounts', description: 'University selection, index numbers, programme updates, and Student plan eligibility.', icon: GraduationCap },
  { title: 'Plans & payments', description: 'Monthly and annual plans, Paystack checkout, payment verification, and access status.', icon: PackageCheck },
  { title: 'Dictionary & search', description: 'Term search, dictionary mode, suggestions, categories, and saved favorites.', icon: Search },
  { title: 'AI & voice tools', description: 'AI explanations, examples, contextual images, voice search, and text-to-speech.', icon: Sparkles },
  { title: 'Privacy & support', description: 'Data controls, account concerns, security, and contacting the support team.', icon: ShieldCheck },
]

const FAQS = [
  { q: 'How do I change my university or programme?', a: 'Open Dashboard, find Account Summary, and select Edit student details. Choose your country and university again, then update your index number or programme/course and save.' },
  { q: 'Why is the Student plan asking for school details?', a: 'SCMpedia collects university and index-number details before Student plan checkout to support eligibility checks and account administration.' },
  { q: 'What happens after a successful Paystack payment?', a: 'SCMpedia verifies the payment reference on the server, updates your subscription, and refreshes your account access. Keep the browser open until verification completes.' },
  { q: 'Can I use SCMpedia without an account?', a: 'Core browsing is available with free limits. An account is required for subscriptions and account-based features such as saved student details.' },
  { q: 'Why did an AI explanation take longer than expected?', a: 'AI and image requests depend on external services. SCMpedia shows loading and error states so you can retry without losing the term you were viewing.' },
  { q: 'How do I reset my password?', a: 'Open Sign In, select Forgot password, enter your email, and follow the secure reset link sent to your inbox.' },
  { q: 'Where can I manage voice settings?', a: 'Open Settings to choose the available voice provider and voice, test playback, and control automatic reading preferences.' },
  { q: 'How do I report an incorrect definition?', a: 'Use the Contact page and include the term, the issue you noticed, and a reliable source or explanation. The content team will review it.' },
]

function SmartLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return to.startsWith('mailto:') || to.startsWith('#') ? (
    <a href={to} className={className}>{children}</a>
  ) : (
    <Link to={to} className={className}>{children}</Link>
  )
}

function PageHero({ kind }: { kind: ResourcePageKind }) {
  const meta = PAGE_META[kind]
  const Icon = meta.icon
  return (
    <section className="resource-hero">
      <img src="/logo2.png" alt="" aria-hidden className="resource-hero-mark" />
      <div className="container resource-hero-inner">
        <div className="resource-eyebrow"><Icon size={15} />{meta.eyebrow}</div>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
        <div className="resource-actions">
          <SmartLink to={meta.primary.to} className="btn btn-primary">{meta.primary.label}<ArrowRight size={15} /></SmartLink>
          {meta.secondary && <SmartLink to={meta.secondary.to} className="btn btn-outline">{meta.secondary.label}</SmartLink>}
        </div>
      </div>
    </section>
  )
}

function ResourceNav({ active }: { active: ResourcePageKind }) {
  return (
    <nav className="resource-nav" aria-label="Resource pages">
      <div className="container resource-nav-inner">
        {RESOURCE_LINKS.map((item) => (
          <Link key={item.kind} to={item.to} className={active === item.kind ? 'active' : ''}>{item.label}</Link>
        ))}
      </div>
    </nav>
  )
}

function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="resource-section-heading">
      {eyebrow && <div className="resource-kicker">{eyebrow}</div>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}

function ResourceHub() {
  const goals = [
    { title: 'Learn a term', text: 'Start with the glossary, open a definition, then review related concepts.', to: '/glossary', icon: Search },
    { title: 'Solve a work problem', text: 'Use a practical guide to structure the decision, data, and next actions.', to: '/guides', icon: ClipboardCheck },
    { title: 'Build broader knowledge', text: 'Explore categories and articles to connect individual terms into a system.', to: '/categories', icon: BrainCircuit },
  ]
  return (
    <>
      <section className="resource-section">
        <div className="container">
          <SectionHeading eyebrow="Explore" title="Everything in the resource center" description="Choose the format that matches the question you are trying to answer." />
          <div className="resource-card-grid">
            {RESOURCE_LINKS.filter((item) => item.kind !== 'resources').map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.kind} to={item.to} className="resource-card resource-link-card">
                  <div className="resource-icon"><Icon size={21} /></div>
                  <h3>{item.label}</h3>
                  <p>{item.description}</p>
                  <span>Open page <ChevronRight size={14} /></span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
      <section className="resource-section resource-muted-band">
        <div className="container">
          <SectionHeading eyebrow="Start with a goal" title="Three useful learning paths" />
          <div className="resource-three-grid">
            {goals.map(({ title, text, to, icon: Icon }) => (
              <Link key={title} to={to} className="resource-goal">
                <Icon size={22} />
                <div><h3>{title}</h3><p>{text}</p></div>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function CategoriesPage() {
  const [query, setQuery] = useState('')
  const filtered = CATEGORIES.filter((category) => {
    const haystack = [category.title, category.description, ...category.topics].join(' ').toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })
  return (
    <section className="resource-section">
      <div className="container">
        <div className="resource-heading-row">
          <SectionHeading eyebrow="Browse functions" title="Supply chain categories" description="Search by discipline, topic, or the kind of decision you are working on." />
          <label className="resource-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories..." /></label>
        </div>
        <div className="resource-card-grid">
          {filtered.map(({ title, description, topics, icon: Icon }) => (
            <article key={title} className="resource-card">
              <div className="resource-icon"><Icon size={21} /></div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="resource-tags">{topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
              <Link to="/dictionary" className="resource-text-link">Browse dictionary <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
        {!filtered.length && <EmptyState title="No category matches that search" text="Try a broader function such as logistics, risk, inventory, or planning." />}
      </div>
    </section>
  )
}

function AIFeaturesPage() {
  const steps = [
    { n: '01', title: 'Find the term', text: 'Search the curated dictionary or open a term from Dictionary Mode.' },
    { n: '02', title: 'Add context', text: 'Use the explanation, examples, related concepts, visuals, and voice tools.' },
    { n: '03', title: 'Apply and verify', text: 'Connect the concept to the decision at hand and verify high-impact conclusions.' },
  ]
  return (
    <>
      <section className="resource-section">
        <div className="container">
          <SectionHeading eyebrow="Capabilities" title="AI that supports the dictionary" description="The curated term remains the starting point. AI features help you explore context, examples, and related ideas." />
          <div className="resource-card-grid">
            {AI_FEATURES.map(({ title, description, icon: Icon, availability }) => (
              <article key={title} className="resource-card">
                <div className="resource-icon"><Icon size={21} /></div>
                <div className="resource-small-label">{availability}</div>
                <h3>{title}</h3><p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="resource-section resource-muted-band">
        <div className="container resource-split">
          <div>
            <SectionHeading eyebrow="Workflow" title="A responsible learning loop" description="Use AI to deepen understanding while keeping the source definition and professional judgment visible." />
            <div className="resource-steps">{steps.map((step) => <div key={step.n}><span>{step.n}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></div>)}</div>
          </div>
          <aside className="resource-callout">
            <ShieldCheck size={26} />
            <h3>Use judgment for critical decisions</h3>
            <p>AI output is educational support. Confirm legal, financial, safety, policy, and high-impact operational decisions with qualified people and primary sources.</p>
            <Link to="/terms" className="resource-text-link">Read terms of service <ArrowRight size={14} /></Link>
          </aside>
        </div>
      </section>
    </>
  )
}

function ReleaseNotesPage() {
  return (
    <section className="resource-section">
      <div className="container resource-narrow">
        <SectionHeading eyebrow="Changelog" title="Recent releases" description="Updates are grouped by the customer or operational outcome they improve." />
        <div className="release-list">
          {RELEASES.map((release) => (
            <article key={release.date} className="release-item">
              <div className="release-date"><CalendarDays size={16} />{release.date}</div>
              <div className="resource-card release-content">
                <div className="resource-small-label">{release.version}</div>
                <h2>{release.title}</h2>
                <p>{release.summary}</p>
                <ul>{release.items.map((item) => <li key={item}><CheckCircle2 size={16} />{item}</li>)}</ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function BlogPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const categories = ['All', ...Array.from(new Set(BLOG_POSTS.map((post) => post.category)))]
  const filtered = BLOG_POSTS.filter((post) => {
    const matchesCategory = category === 'All' || post.category === category
    const matchesQuery = [post.title, post.summary, ...post.points].join(' ').toLowerCase().includes(query.trim().toLowerCase())
    return matchesCategory && matchesQuery
  })
  return (
    <section id="articles" className="resource-section">
      <div className="container">
        <div className="resource-heading-row">
          <SectionHeading eyebrow="Articles" title="Practical supply chain reading" description="Filter by topic or search for the operational question you are exploring." />
          <label className="resource-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles..." /></label>
        </div>
        <div className="resource-filter-row">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
        <div className="resource-two-grid">
          {filtered.map((post) => (
            <article key={post.title} className="resource-card blog-card">
              <div className="blog-meta"><span>{post.category}</span><small><Clock3 size={13} />{post.readTime}</small></div>
              <h2>{post.title}</h2><p>{post.summary}</p>
              <details><summary>Read key points <ChevronRight size={15} /></summary><ul>{post.points.map((point) => <li key={point}>{point}</li>)}</ul></details>
            </article>
          ))}
        </div>
        {!filtered.length && <EmptyState title="No articles match" text="Clear the filter or try a broader search term." />}
      </div>
    </section>
  )
}

function GuidesPage() {
  const [level, setLevel] = useState('All')
  const levels = ['All', ...Array.from(new Set(GUIDES.map((guide) => guide.level)))]
  const filtered = GUIDES.filter((guide) => level === 'All' || guide.level === level)
  return (
    <section id="guides" className="resource-section">
      <div className="container">
        <SectionHeading eyebrow="Playbooks" title="Choose a guide and work through the steps" description="Each guide begins with a concrete outcome and a short sequence you can adapt to your context." />
        <div className="resource-filter-row">{levels.map((item) => <button key={item} className={level === item ? 'active' : ''} onClick={() => setLevel(item)}>{item}</button>)}</div>
        <div className="resource-two-grid">
          {filtered.map((guide) => (
            <article key={guide.title} className="resource-card guide-card">
              <div className="resource-small-label">{guide.level}</div>
              <h2>{guide.title}</h2><p>{guide.outcome}</p>
              <details><summary>Open guide <ChevronRight size={15} /></summary><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></details>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function LoadingGrid() {
  return <div className="resource-card-grid" aria-label="Loading dictionary terms" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <div className="resource-card" key={index}><div className="skeleton" style={{ width: 42, height: 42, marginBottom: 16 }} /><div className="skeleton" style={{ width: '46%', height: 17, marginBottom: 12 }} /><div className="skeleton" style={{ width: '100%', height: 12, marginBottom: 7 }} /><div className="skeleton" style={{ width: '78%', height: 12 }} /></div>)}</div>
}

function GlossaryPage({ entries, status }: { entries: Entry[]; status: DataStatus }) {
  const [query, setQuery] = useState('')
  const [letter, setLetter] = useState('All')
  const source = entries.length ? entries : FALLBACK_GLOSSARY
  const letters = useMemo(
    () => ['All', ...Array.from(new Set(source.map((entry) => entry.term[0]?.toUpperCase()).filter((value): value is string => Boolean(value)))).sort()],
    [source],
  )
  const filtered = useMemo(() => source.filter((entry) => {
    const matchesLetter = letter === 'All' || entry.term.toUpperCase().startsWith(letter)
    const matchesQuery = `${entry.term} ${entry.definition}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesLetter && matchesQuery
  }).sort((a, b) => a.term.localeCompare(b.term)).slice(0, 72), [letter, query, source])

  return (
    <section className="resource-section">
      <div className="container">
        <div className="resource-heading-row">
          <SectionHeading eyebrow="A-Z terms" title="Search the glossary" description={entries.length ? `${entries.length.toLocaleString()} terms are available in this dictionary session.` : 'A starter glossary is shown while the full dictionary is unavailable.'} />
          <label className="resource-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search term or definition..." /></label>
        </div>
        {status === 'loading' && !entries.length ? <LoadingGrid /> : (
          <>
            <div className="glossary-letters" aria-label="Filter glossary by letter">{letters.map((item) => <button key={item} className={letter === item ? 'active' : ''} onClick={() => setLetter(item)}>{item}</button>)}</div>
            {(status === 'error' || status === 'empty') && !entries.length && <div className="resource-notice">The full dictionary could not be loaded. Showing the starter glossary instead.</div>}
            <div className="glossary-grid">
              {filtered.map((entry) => (
                <Link key={entry.id || entry.term} to={`/term/${termToSlug(entry.term)}`} className="glossary-item">
                  <div><strong>{entry.term}</strong><p>{entry.definition}</p></div><ChevronRight size={16} />
                </Link>
              ))}
            </div>
            {!filtered.length && <EmptyState title="No glossary terms match" text="Try another spelling, remove the letter filter, or search a broader concept." />}
          </>
        )}
      </div>
    </section>
  )
}

function HelpPage() {
  const [query, setQuery] = useState('')
  const filtered = FAQS.filter((faq) => `${faq.q} ${faq.a}`.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <>
      <section id="help-topics" className="resource-section">
        <div className="container">
          <div className="resource-heading-row">
            <SectionHeading eyebrow="Support topics" title="What do you need help with?" />
            <label className="resource-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help..." /></label>
          </div>
          <div className="resource-three-grid">{HELP_TOPICS.map(({ title, description, icon: Icon }) => <article key={title} className="resource-card compact"><div className="resource-icon"><Icon size={20} /></div><h3>{title}</h3><p>{description}</p></article>)}</div>
        </div>
      </section>
      <section className="resource-section resource-muted-band">
        <div className="container resource-narrow">
          <SectionHeading eyebrow="Common questions" title="Frequently asked questions" />
          <div className="faq-list">{filtered.map((faq) => <details key={faq.q}><summary>{faq.q}<ChevronRight size={17} /></summary><p>{faq.a}</p></details>)}</div>
          {!filtered.length && <EmptyState title="No help answer matches" text="Try a different search or contact support for a specific account issue." />}
        </div>
      </section>
    </>
  )
}

function CareersPage() {
  const teams = [
    { title: 'Content & research', text: 'Curate terminology, examples, guides, and professional learning material.', icon: BookOpen },
    { title: 'Product & engineering', text: 'Build reliable search, AI, voice, account, payment, and administration experiences.', icon: Wrench },
    { title: 'Partnerships & growth', text: 'Work with universities, professional bodies, institutions, and industry partners.', icon: Globe2 },
  ]
  return (
    <>
      <section className="resource-section">
        <div className="container">
          <SectionHeading eyebrow="How we work" title="Small teams, practical outcomes" description="We value clarity, useful expertise, responsible technology, and respect for the people doing supply chain work." />
          <div className="resource-three-grid">{teams.map(({ title, text, icon: Icon }) => <article key={title} className="resource-card"><div className="resource-icon"><Icon size={21} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>
      <section className="resource-section resource-muted-band">
        <div className="container resource-narrow">
          <div className="resource-empty-role">
            <BriefcaseBusiness size={30} />
            <div><div className="resource-small-label">Open roles</div><h2>No published openings right now</h2><p>Send a concise introduction, your area of expertise, and a link to relevant work. We will keep strong profiles in mind as the team grows.</p></div>
            <a href="mailto:hello@scmpedia.com?subject=SCMpedia%20talent%20network" className="btn btn-primary">Join talent network <ArrowRight size={15} /></a>
          </div>
        </div>
      </section>
    </>
  )
}

function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [topic, setTopic] = useState('Product support')
  const [message, setMessage] = useState('')
  const [prepared, setPrepared] = useState(false)

  const prepareEmail = (event: React.FormEvent) => {
    event.preventDefault()
    const subject = encodeURIComponent(`[${topic}] Message from ${name}`)
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`)
    setPrepared(true)
    window.location.href = `mailto:hello@scmpedia.com?subject=${subject}&body=${body}`
  }

  const contactOptions = [
    { title: 'Product support', text: 'Account, dictionary, AI, voice, or technical questions.', icon: Headphones },
    { title: 'Universities & institutions', text: 'Student access, teaching use, and institutional discussions.', icon: GraduationCap },
    { title: 'Partnerships & enterprise', text: 'Professional bodies, teams, content, and enterprise requirements.', icon: Building2 },
  ]
  return (
    <section className="resource-section">
      <div className="container">
        <div className="resource-three-grid contact-options">{contactOptions.map(({ title, text, icon: Icon }) => <article key={title} className="resource-card compact"><div className="resource-icon"><Icon size={20} /></div><h3>{title}</h3><p>{text}</p></article>)}</div>
        <div className="contact-layout">
          <form className="resource-card contact-form" onSubmit={prepareEmail}>
            <div className="resource-small-label">Send a message</div>
            <h2>Prepare an email to SCMpedia</h2>
            <div className="contact-two"><label><span>Name</span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label><label><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label></div>
            <label><span>Topic</span><select value={topic} onChange={(event) => setTopic(event.target.value)}><option>Product support</option><option>Student account</option><option>Institutional access</option><option>Partnership</option><option>Enterprise</option><option>Content correction</option></select></label>
            <label><span>Message</span><textarea required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what you need help with..." rows={6} /></label>
            {prepared && <div className="resource-notice success">Your email app should open with the message prepared.</div>}
            <button className="btn btn-primary" type="submit"><Send size={15} />Prepare email</button>
          </form>
          <aside className="contact-aside">
            <div><Mail size={20} /><span><strong>Email</strong><a href="mailto:hello@scmpedia.com">hello@scmpedia.com</a></span></div>
            <div><Clock3 size={20} /><span><strong>Response</strong><p>Support messages are reviewed during normal business operations.</p></span></div>
            <div><MapPin size={20} /><span><strong>What to include</strong><p>Share the account email, relevant term or page, and a clear description. Never send card details or passwords.</p></span></div>
          </aside>
        </div>
      </div>
    </section>
  )
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="resource-empty"><Search size={25} /><h3>{title}</h3><p>{text}</p></div>
}

function BottomCTA({ kind }: { kind: ResourcePageKind }) {
  if (kind === 'contact' || kind === 'careers') return null
  return (
    <section className="resource-bottom-cta">
      <div className="container resource-bottom-cta-inner">
        <div><div className="resource-kicker">Continue learning</div><h2>Look up the next concept in SCMpedia</h2><p>Move from the resource library into the searchable dictionary and AI-assisted learning tools.</p></div>
        <Link to="/" className="btn btn-primary">Search the dictionary <ArrowRight size={15} /></Link>
      </div>
    </section>
  )
}

export const ResourcePage: React.FC<ResourcePageProps> = ({ kind, entries = [], dataStatus = 'ready' }) => {
  return (
    <div className="resource-page">
      <PageHero kind={kind} />
      <ResourceNav active={kind} />
      {kind === 'resources' && <ResourceHub />}
      {kind === 'categories' && <CategoriesPage />}
      {kind === 'ai-features' && <AIFeaturesPage />}
      {kind === 'release-notes' && <ReleaseNotesPage />}
      {kind === 'blog' && <BlogPage />}
      {kind === 'guides' && <GuidesPage />}
      {kind === 'glossary' && <GlossaryPage entries={entries} status={dataStatus} />}
      {kind === 'help' && <HelpPage />}
      {kind === 'careers' && <CareersPage />}
      {kind === 'contact' && <ContactPage />}
      <BottomCTA kind={kind} />
      <style>{`
        .resource-page { min-height: 100vh; background: var(--bg); color: var(--text-main); }
        .resource-hero { position: relative; overflow: hidden; padding: 54px 24px 48px; background: var(--home-hero-bg); border-bottom: 1px solid var(--border); }
        .resource-hero-inner { position: relative; z-index: 1; }
        .resource-hero-mark { position: absolute; right: 7%; top: 20px; width: 160px; opacity: 0.08; transform: rotate(-28deg); pointer-events: none; }
        .resource-eyebrow, .resource-kicker { display: inline-flex; align-items: center; gap: 7px; color: var(--primary); font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
        .resource-hero h1 { max-width: 760px; margin: 14px 0 14px; font-size: 42px; line-height: 1.08; font-weight: 900; letter-spacing: 0; }
        .resource-hero p { max-width: 740px; color: var(--text-sub); font-size: 16px; line-height: 1.7; }
        .resource-actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 24px; }
        .resource-nav { position: sticky; top: 72px; z-index: 40; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(12px); }
        .resource-nav-inner { display: flex; gap: 4px; overflow-x: auto; padding-top: 10px; padding-bottom: 10px; scrollbar-width: none; }
        .resource-nav-inner::-webkit-scrollbar { display: none; }
        .resource-nav a { flex: 0 0 auto; padding: 8px 11px; border-radius: 8px; color: var(--text-sub); font-size: 12px; font-weight: 700; }
        .resource-nav a:hover, .resource-nav a.active { color: var(--primary); background: var(--primary-bg); }
        .resource-section { padding: 54px 24px; scroll-margin-top: 130px; }
        .resource-muted-band { background: var(--surface); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .resource-section-heading { max-width: 720px; margin-bottom: 26px; }
        .resource-section-heading h2, .resource-bottom-cta h2 { margin: 7px 0 8px; font-size: 28px; font-weight: 900; letter-spacing: 0; }
        .resource-section-heading p, .resource-bottom-cta p { color: var(--text-sub); font-size: 14px; line-height: 1.7; }
        .resource-heading-row { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 26px; }
        .resource-heading-row .resource-section-heading { margin-bottom: 0; }
        .resource-search { width: min(360px, 100%); min-height: 44px; display: flex; align-items: center; gap: 9px; padding: 0 13px; border: 1px solid var(--border); border-radius: 9px; background: var(--card-bg); color: var(--text-sub); }
        .resource-search:focus-within { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
        .resource-search input { width: 100%; min-width: 0; border: none; outline: none; background: transparent; color: var(--text-main); font: inherit; font-size: 14px; }
        .resource-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .resource-two-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .resource-three-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .resource-card { min-width: 0; padding: 22px; border: 1px solid var(--border); border-radius: 12px; background: var(--card-bg); box-shadow: var(--shadow-sm); animation: content-rise 480ms cubic-bezier(0.22,1,0.36,1) both; }
        .resource-card:nth-child(2), .resource-goal:nth-child(2) { animation-delay: 45ms; }
        .resource-card:nth-child(3), .resource-goal:nth-child(3) { animation-delay: 90ms; }
        .resource-card.compact { padding: 19px; }
        .resource-card h3 { margin: 0 0 8px; font-size: 17px; font-weight: 850; letter-spacing: 0; }
        .resource-card h2 { margin: 7px 0 9px; font-size: 21px; font-weight: 900; letter-spacing: 0; }
        .resource-card p { color: var(--text-sub); font-size: 13px; line-height: 1.65; }
        .resource-icon { width: 42px; height: 42px; display: grid; place-items: center; margin-bottom: 15px; border-radius: 10px; color: var(--primary); background: var(--primary-bg); }
        .resource-small-label { color: var(--primary); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0; }
        .resource-tags { display: flex; gap: 6px; flex-wrap: wrap; margin: 16px 0 12px; }
        .resource-tags span { padding: 4px 8px; border-radius: 999px; background: var(--surface); color: var(--text-sub); font-size: 11px; font-weight: 700; }
        .resource-text-link, .resource-link-card > span { display: inline-flex; align-items: center; gap: 5px; margin-top: 14px; color: var(--primary); font-size: 13px; font-weight: 800; }
        .resource-link-card { display: block; }
        .resource-link-card:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--primary) 35%, var(--border)); box-shadow: var(--shadow-md); }
        .resource-goal { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; padding: 20px; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg); animation: content-rise 480ms ease both; }
        .resource-goal > svg:first-child { color: var(--primary); }
        .resource-goal h3 { margin-bottom: 4px; font-size: 16px; }
        .resource-goal p { color: var(--text-sub); font-size: 12px; line-height: 1.5; }
        .resource-goal:hover { border-color: var(--primary); transform: translateY(-2px); }
        .resource-filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin: -4px 0 22px; }
        .resource-filter-row button, .glossary-letters button { border: 1px solid var(--border); border-radius: 999px; background: var(--card-bg); color: var(--text-sub); padding: 7px 12px; font-size: 12px; font-weight: 750; }
        .resource-filter-row button.active, .glossary-letters button.active { background: var(--primary); border-color: var(--primary); color: #fff; }
        .resource-split { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.75fr); gap: 28px; align-items: start; }
        .resource-steps { display: grid; gap: 12px; }
        .resource-steps > div { display: grid; grid-template-columns: 42px 1fr; gap: 13px; align-items: start; }
        .resource-steps > div > span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: var(--primary-bg); color: var(--primary); font-size: 12px; font-weight: 900; }
        .resource-steps h3 { margin-bottom: 3px; font-size: 15px; }
        .resource-steps p { color: var(--text-sub); font-size: 13px; }
        .resource-callout { padding: 24px; border: 1px solid color-mix(in srgb, var(--success-green) 30%, var(--border)); border-radius: 12px; background: var(--card-bg); }
        .resource-callout > svg { color: var(--success-green); margin-bottom: 12px; }
        .resource-callout h3 { margin-bottom: 8px; font-size: 18px; }
        .resource-callout p { color: var(--text-sub); font-size: 13px; line-height: 1.7; }
        .resource-narrow { max-width: 940px; }
        .release-list { display: grid; gap: 24px; }
        .release-item { display: grid; grid-template-columns: 130px 1fr; gap: 20px; align-items: start; }
        .release-date { display: inline-flex; align-items: center; gap: 7px; padding-top: 20px; color: var(--primary); font-size: 12px; font-weight: 850; }
        .release-content ul { display: grid; gap: 9px; margin: 18px 0 0; padding: 0; list-style: none; }
        .release-content li { display: flex; gap: 9px; align-items: flex-start; color: var(--text-sub); font-size: 13px; }
        .release-content li svg { flex: 0 0 auto; margin-top: 2px; color: var(--success-green); }
        .blog-meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .blog-meta > span { color: var(--primary); font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .blog-meta small { display: inline-flex; align-items: center; gap: 5px; color: var(--text-sub); }
        .blog-card details, .guide-card details { margin-top: 17px; border-top: 1px solid var(--border); padding-top: 13px; }
        .blog-card summary, .guide-card summary, .faq-list summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--primary); font-size: 13px; font-weight: 850; cursor: pointer; list-style: none; }
        .blog-card summary::-webkit-details-marker, .guide-card summary::-webkit-details-marker, .faq-list summary::-webkit-details-marker { display: none; }
        details[open] summary svg { transform: rotate(90deg); }
        .blog-card ul, .guide-card ol { display: grid; gap: 8px; margin: 14px 0 0; padding-left: 20px; color: var(--text-sub); font-size: 13px; line-height: 1.55; }
        .glossary-letters { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 14px; margin-bottom: 8px; scrollbar-width: none; }
        .glossary-letters::-webkit-scrollbar { display: none; }
        .glossary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .glossary-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg); }
        .glossary-item strong { font-size: 14px; }
        .glossary-item p { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; margin-top: 4px; color: var(--text-sub); font-size: 12px; line-height: 1.5; }
        .glossary-item > svg { flex: 0 0 auto; color: var(--primary); }
        .glossary-item:hover { border-color: var(--primary); transform: translateY(-1px); }
        .resource-notice { margin: 0 0 16px; padding: 11px 14px; border: 1px solid rgba(182,84,55,0.24); border-radius: 8px; color: var(--text-sub); background: var(--primary-bg); font-size: 12px; }
        .resource-notice.success { border-color: rgba(20,174,92,0.28); background: rgba(20,174,92,0.10); color: var(--success-green); }
        .faq-list { display: grid; gap: 9px; }
        .faq-list details { padding: 16px 18px; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg); }
        .faq-list summary { color: var(--text-main); font-size: 14px; }
        .faq-list details p { padding-top: 12px; color: var(--text-sub); font-size: 13px; line-height: 1.7; }
        .resource-empty, .resource-empty-role { padding: 32px; border: 1px dashed var(--border); border-radius: 12px; text-align: center; color: var(--text-sub); }
        .resource-empty { margin-top: 20px; }
        .resource-empty svg, .resource-empty-role > svg { color: var(--primary); margin-bottom: 10px; }
        .resource-empty h3 { margin-bottom: 5px; color: var(--text-main); }
        .resource-empty p { font-size: 13px; }
        .resource-empty-role { display: grid; grid-template-columns: auto 1fr auto; gap: 20px; align-items: center; text-align: left; background: var(--card-bg); }
        .resource-empty-role h2 { margin: 5px 0 7px; color: var(--text-main); font-size: 22px; }
        .resource-empty-role p { font-size: 13px; line-height: 1.65; }
        .contact-options { margin-bottom: 22px; }
        .contact-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr); gap: 22px; align-items: start; }
        .contact-form h2 { margin: 6px 0 20px; font-size: 22px; }
        .contact-form { display: grid; gap: 15px; }
        .contact-form label { display: grid; gap: 6px; }
        .contact-form label > span { color: var(--text-main); font-size: 12px; font-weight: 800; }
        .contact-form input, .contact-form select, .contact-form textarea { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-main); font: inherit; font-size: 13px; outline: none; }
        .contact-form input:focus, .contact-form select:focus, .contact-form textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }
        .contact-form textarea { resize: vertical; line-height: 1.55; }
        .contact-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .contact-aside { display: grid; gap: 12px; }
        .contact-aside > div { display: flex; gap: 12px; align-items: flex-start; padding: 17px; border: 1px solid var(--border); border-radius: 10px; background: var(--card-bg); }
        .contact-aside svg { flex: 0 0 auto; color: var(--primary); }
        .contact-aside span { display: grid; gap: 4px; }
        .contact-aside strong { font-size: 13px; }
        .contact-aside a { color: var(--primary); font-size: 13px; font-weight: 750; }
        .contact-aside p { color: var(--text-sub); font-size: 12px; line-height: 1.55; }
        .resource-bottom-cta { padding: 0 24px 58px; }
        .resource-bottom-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 26px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
        .resource-bottom-cta p { max-width: 680px; }
        @media (max-width: 980px) {
          .resource-card-grid, .resource-three-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .resource-split, .contact-layout { grid-template-columns: 1fr; }
          .resource-nav { top: 72px; }
        }
        @media (max-width: 700px) {
          .resource-hero { padding: 40px 18px 38px; }
          .resource-hero h1 { font-size: 32px; }
          .resource-hero p { font-size: 14px; }
          .resource-hero-mark { right: -24px; width: 130px; }
          .resource-section { padding: 40px 18px; }
          .resource-nav-inner { padding-left: 18px; padding-right: 18px; }
          .resource-heading-row { align-items: stretch; flex-direction: column; }
          .resource-search { width: 100%; }
          .resource-card-grid, .resource-two-grid, .resource-three-grid, .glossary-grid { grid-template-columns: 1fr; }
          .release-item { grid-template-columns: 1fr; gap: 8px; }
          .release-date { padding-top: 0; }
          .resource-section-heading h2, .resource-bottom-cta h2 { font-size: 24px; }
          .resource-empty-role { grid-template-columns: 1fr; text-align: center; }
          .resource-empty-role > svg { margin: 0 auto; }
          .resource-bottom-cta { padding: 0 18px 42px; }
          .resource-bottom-cta-inner { align-items: stretch; flex-direction: column; }
          .resource-bottom-cta .btn { width: 100%; }
        }
        @media (max-width: 460px) {
          .resource-actions { display: grid; }
          .resource-actions .btn { width: 100%; }
          .resource-card { padding: 18px; }
          .contact-two { grid-template-columns: 1fr; }
          .resource-goal { grid-template-columns: auto 1fr; }
          .resource-goal > svg:last-child { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .resource-card, .resource-goal { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
