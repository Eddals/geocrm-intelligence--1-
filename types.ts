
export enum PipelineStage {
  NEW = 'Novo',
  ANALYSIS = 'Em Análise',
  CONTACT = 'Em Contato',
  QUALIFIED = 'Qualificado',
  WAITING = 'Aguardando',
  CLOSED = 'Fechado',
  LOST = 'Perdido'
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  dueDate: string;
}

export interface LeadHistory {
  date: string;
  description: string;
  type: 'creation' | 'status_change' | 'update' | 'email_sent';
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  address: string;
  city: string;
  lat: number;
  lng: number;
  status: PipelineStage;
  source: 'Manual' | 'Google Maps' | 'Instagram' | 'Ads';
  value: number; // Potential value based on User Sector
  tags: string[];
  tasks: Task[];
  notes: string;
  history: LeadHistory[];
  lastContact?: string;
  createdAt: string; 
  enriched: boolean;
  
  // New AI Enrichment Fields
  contactRole?: string;
  approachMessage?: string;
  leadPriority?: 'High' | 'Medium' | 'Low';
  
  // Social & Web
  website?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  
  // Reputation & Visuals
  rating?: number; // 1 to 5 stars
  imageUrl?: string; // Photo of building or logo
  
  // Scraper Data (New)
  openingHours?: string;
  description?: string;

  // External Map reference
  mapsUri?: string;
}

// Map/Grounding specific types (lightweight lead shape for grounded searches)
export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  twitter?: string;
}

export interface GroundedLead {
  id: string; // generated client-side
  name: string;
  address: string;
  phone?: string;
  website?: string;
  owner?: string;
  description: string;
  socials?: SocialLinks;
  mapsUri?: string; // Verified link from grounding
  rating?: number;
}

export interface SearchState {
  niche: string;
  location: string;
  isLocating: boolean;
  isLoading: boolean;
  error: string | null;
  results: GroundedLead[];
  rawResponse?: string;
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

export interface Stats {
  totalLeads: number;
  newLeadsToday: number;
  leadsInContact: number;
  leadsConverted: number;
  conversionRate: number;
  totalPipelineValue: number;
  topCity: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: 'ON_CREATE' | 'ON_MOVE_STAGE' | 'ON_HIGH_VALUE';
  action: 'ENRICH_DATA' | 'SEND_EMAIL' | 'ADD_TAG_VIP' | 'NOTIFY_WIN';
}

export type UserRole = 'admin' | 'manager' | 'sales';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  avatar?: string;
}

export interface AppSettings {
  userName: string;
  userEmail: string;
  userAvatar: string;
  companySector: string;
  businessSummary?: string;
  userRole?: string;
  subscriptionPlan?: PlanTier;
  
  companyName: string;
  emailNotifications: boolean;
  autoEnrichment: boolean;
  highValueThreshold: number;
  openAiKey: string; 

  // Contact & Socials for Email Signature
  contactPhone?: string;
  socialLinkedin?: string;
  socialInstagram?: string;
  socialWebsite?: string;
  
  // Branding
  brandColor?: string;

  // SMTP Settings
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
}

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export type ViewMode = 'dashboard' | 'pipeline' | 'map' | 'discovery' | 'email-automation' | 'settings' | 'calendar';

export type EmailTone = 'formal' | 'friendly' | 'persuasive' | 'urgent' | 'consultative';

export type EmailFocus = 'meeting' | 'sales' | 'followup' | 'case_study' | 'partnership';

export type PlanTier = 'Start' | 'Pro' | 'Growth' | 'Enterprise';
