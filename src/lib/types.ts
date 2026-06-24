import type { Platform } from '@/lib/platforms';

export type ClientStatus = 'active' | 'paused' | 'completed';
export type ProjectStatus = 'active' | 'on-hold' | 'completed';
export type DeliverableStatus = 'not_started' | 'in_progress' | 'delivered';
export type LeadStage = 'new' | 'contacted' | 'discovery' | 'proposal' | 'negotiating' | 'won' | 'lost';
export type LeadSource = 'referral' | 'website' | 'outbound' | 'other';
export type ExpenseCategory = 'servers' | 'software' | 'contractor' | 'marketing' | 'other';
export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface Client {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  status: ClientStatus;
  monthly_value: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Project {
  id: number;
  client_id: number;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  server_ip: string | null;
  repo_url: string | null;
  deploy_command: string | null;
  stack_notes: string | null;
  hourly_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: number;
  project_id: number;
  title: string;
  status: DeliverableStatus;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  client_id: number;
  project_id: number | null;
  content: string;
  created_at: string;
}

export type LostReason = 'too_expensive' | 'competitor' | 'timing' | 'ghosted' | 'other';

export interface Lead {
  id: number;
  business_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  source: LeadSource;
  estimated_value: number | null;
  stage: LeadStage;
  lost_reason: LostReason | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
  converted_client_id: number | null;
}

export interface LeadStageHistory {
  id: number;
  lead_id: number;
  stage: LeadStage;
  entered_at: string;
}

export interface LeadNote {
  id: number;
  lead_id: number;
  content: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  client_id: number;
  invoice_number: string;
  status: InvoiceStatus;
  due_date: string;
  sent_at: string | null;
  paid_at: string | null;
  stripe_payment_link: string | null;
  stripe_payment_id: string | null;
  is_recurring: number;
  recurrence_day: number | null;
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Expense {
  id: number;
  client_id: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export interface Endpoint {
  id: number;
  name: string;
  url: string;
  check_interval_seconds: number;
  slow_threshold_ms: number;
  is_active: number;
  created_at: string;
}

export interface HealthCheck {
  id: number;
  endpoint_id: number;
  status_code: number | null;
  response_time_ms: number;
  is_healthy: number;
  checked_at: string;
}

export interface Incident {
  id: number;
  endpoint_id: number;
  started_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
}

export type AlertType = 'server_down' | 'server_recovered' | 'morning_briefing' | 'disk_warning' | 'client_health_warning' | 'invoice_overdue' | 'deliverable_overdue' | 'follow_up_due' | 'contract_expiring';

export interface AlertSent {
  id: number;
  alert_type: AlertType;
  reference_id: number | null;
  message: string;
  sent_at: string;
}

export interface DiskReport {
  id: number;
  endpoint_id: number;
  mount_point: string;
  total_gb: number;
  used_gb: number;
  percent_used: number;
  reported_at: string;
}

export interface TimeEntry {
  id: number;
  project_id: number;
  deliverable_id: number | null;
  description: string | null;
  duration_minutes: number;
  entry_date: string;
  hourly_rate: number;
  is_invoiced: number;
  invoice_id: number | null;
  created_at: string;
}

export type ClientHealthStatus = 'healthy' | 'at_risk' | 'needs_attention';

export interface ClientHealth {
  clientId: number;
  clientName: string;
  score: number;
  status: ClientHealthStatus;
  payment: number;
  balance: number;
  engagement: number;
}

export type NotificationType =
  | 'server_down'
  | 'server_recovered'
  | 'client_health_critical'
  | 'invoice_overdue'
  | 'invoice_paid'
  | 'deliverable_overdue'
  | 'follow_up_due'
  | 'lead_stage_changed'
  | 'time_invoiced'
  | 'proposal_accepted'
  | 'contract_expiring';

export type EmailDelivery = 'immediate' | 'digest' | 'none';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string | null;
  link: string | null;
  is_read: number;
  created_at: string;
}

export interface NotificationPreference {
  id: number;
  notification_type: NotificationType;
  email_delivery: EmailDelivery;
}

export type PostStatus = 'draft' | 'scheduled' | 'posted' | 'archived';
export type VariantStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

export interface Post {
  id: number;
  title: string;
  idea: string | null;
  image_path: string | null;
  status: PostStatus;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostVariant {
  id: number;
  post_id: number;
  platform: Platform;
  content: string;
  enabled: number;
  status: VariantStatus;
  published_at: string | null;
  platform_post_id: string | null;
  error: string | null;
}

export interface PostWithVariants extends Post {
  variants: PostVariant[];
}

export type MediaType = 'podcast' | 'radio' | 'video' | 'interview' | 'other';
export type MediaSource = 'upload' | 'transcript' | 'local';
export type MediaStatus = 'queued' | 'transcribing' | 'extracting' | 'ready' | 'error';
export type ClipStatus = 'suggested' | 'cut' | 'discarded';

export interface MediaItem {
  id: number;
  title: string;
  media_type: MediaType;
  source: MediaSource;
  filename: string | null;
  original_name: string | null;
  mime_type: string | null;
  size: number;
  duration_seconds: number | null;
  transcript: string | null;
  segments: string | null;
  status: MediaStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface MediaClip {
  id: number;
  media_item_id: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  transcript_excerpt: string | null;
  reason: string | null;
  clip_filename: string | null;
  status: ClipStatus;
  created_at: string;
}

export interface MediaItemWithClips extends MediaItem {
  clips: MediaClip[];
}

/** A transcript segment with timing, as produced by Whisper. */
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export type KbSourceType = 'website' | 'pdf' | 'html' | 'text' | 'book' | 'system';

export interface KbDocument {
  id: number;
  title: string;
  source_type: KbSourceType;
  source_url: string | null;
  content: string;
  char_count: number;
  created_at: string;
}

export interface KbChunk {
  id: number;
  kb_document_id: number;
  chunk_index: number;
  text: string;
  embedding: string | null;
  created_at: string;
}

export type GenContentType =
  | 'blog_article'
  | 'email'
  | 'email_sequence'
  | 'campaign_plan'
  | 'social_linkedin'
  | 'social_twitter'
  | 'social_facebook';

export type LengthPreference = 'short' | 'medium' | 'long';
export type RetrievalMode = 'none' | 'keyword' | 'vector';

export interface Generation {
  id: number;
  content_type: GenContentType;
  topic: string;
  length: LengthPreference;
  source_ids: string | null;
  source_count: number;
  retrieval_mode: RetrievalMode;
  avatar_id: number | null;
  result: string;
  created_at: string;
}

export interface Avatar {
  id: number;
  name: string;
  summary: string | null;
  description: string | null;
  tone: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}
