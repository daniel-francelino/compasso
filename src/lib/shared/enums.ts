import type { ValueOf } from "@/lib/shared/utils";

export const ProfileStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
  Suspended: "suspended",
} as const;
export type ProfileStatus = ValueOf<typeof ProfileStatus>;

export const ProfileKind = {
  Internal: "internal",
  External: "external",
} as const;
export type ProfileKind = ValueOf<typeof ProfileKind>;

export const AuditActorKind = {
  Internal: "internal",
  External: "external",
  System: "system",
} as const;
export type AuditActorKind = ValueOf<typeof AuditActorKind>;

export const Space = {
  Marketing: "marketing",
  Cms: "cms",
  Site: "site",
  Portal: "portal",
  Shared: "shared",
} as const;
export type Space = ValueOf<typeof Space>;

export const InvitationStatus = {
  Pending: "pending",
  Accepted: "accepted",
  Revoked: "revoked",
  Expired: "expired",
} as const;
export type InvitationStatus = ValueOf<typeof InvitationStatus>;

export const BrandMemberStatus = {
  Active: "active",
  Revoked: "revoked",
} as const;
export type BrandMemberStatus = ValueOf<typeof BrandMemberStatus>;

export const Platform = {
  Instagram: "instagram",
  Facebook: "facebook",
  Linkedin: "linkedin",
  Tiktok: "tiktok",
  Youtube: "youtube",
  X: "x",
  Pinterest: "pinterest",
  Threads: "threads",
  Email: "email",
  Blog: "blog",
  Other: "other",
} as const;
export type Platform = ValueOf<typeof Platform>;

export const NotificationSeverity = {
  Info: "info",
  Warning: "warning",
  Urgent: "urgent",
} as const;
export type NotificationSeverity = ValueOf<typeof NotificationSeverity>;

export const NotificationStatus = {
  Active: "active",
  Resolved: "resolved",
} as const;
export type NotificationStatus = ValueOf<typeof NotificationStatus>;

export const EmailStatus = {
  Queued: "queued",
  Sent: "sent",
  Failed: "failed",
} as const;
export type EmailStatus = ValueOf<typeof EmailStatus>;

export const SettingKey = {
  Approvals: "policies.approvals",
  Calendar: "policies.calendar",
  Uploads: "policies.uploads",
  Urls: "policies.urls",
  Retention: "policies.retention",
  Invitations: "policies.invitations",
  Security: "policies.security",
  Email: "policies.email",
} as const;
export type SettingKey = ValueOf<typeof SettingKey>;

export const MediaScope = {
  Site: "site",
  Brand: "brand",
} as const;
export type MediaScope = ValueOf<typeof MediaScope>;

export const MediaVersionStatus = {
  Pending: "pending",
  Processing: "processing",
  Available: "available",
  Failed: "failed",
} as const;
export type MediaVersionStatus = ValueOf<typeof MediaVersionStatus>;

export const EditorialStatus = {
  Draft: "draft",
  InProduction: "in_production",
  InternalReview: "internal_review",
  AwaitingApproval: "awaiting_approval",
  ChangesRequested: "changes_requested",
  Approved: "approved",
  Cancelled: "cancelled",
} as const;
export type EditorialStatus = ValueOf<typeof EditorialStatus>;

export const PublicationStatus = {
  Unplanned: "unplanned",
  Planned: "planned",
  PublishedManually: "published_manually",
  Cancelled: "cancelled",
} as const;
export type PublicationStatus = ValueOf<typeof PublicationStatus>;

export const ContentFormat = {
  Image: "image",
  Carousel: "carousel",
  Video: "video",
  Text: "text",
  Story: "story",
  Reel: "reel",
  Article: "article",
  Other: "other",
} as const;
export type ContentFormat = ValueOf<typeof ContentFormat>;

export const ApprovalRequestStatus = {
  Pending: "pending",
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Superseded: "superseded",
  Cancelled: "cancelled",
} as const;
export type ApprovalRequestStatus = ValueOf<typeof ApprovalRequestStatus>;

export const ApprovalOutcome = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
} as const;
export type ApprovalOutcome = ValueOf<typeof ApprovalOutcome>;

export const CommentVisibility = {
  Internal: "internal",
  External: "external",
} as const;
export type CommentVisibility = ValueOf<typeof CommentVisibility>;

export const DashboardReason = {
  ApprovalOverdue: "approval_overdue",
  ChangesRequested: "changes_requested",
  ProductionOverdue: "production_overdue",
  PlannedDatePassed: "planned_date_passed",
  ApproverWithoutAccess: "approver_without_access",
} as const;
export type DashboardReason = ValueOf<typeof DashboardReason>;

export const CalendarView = {
  Month: "month",
  Week: "week",
  List: "list",
} as const;
export type CalendarView = ValueOf<typeof CalendarView>;

export const CalendarEntryKind = {
  Publication: "publication",
  Published: "published",
  ApprovalDeadline: "approval_deadline",
  ProductionDeadline: "production_deadline",
} as const;
export type CalendarEntryKind = ValueOf<typeof CalendarEntryKind>;

export const CalendarAlert = {
  TooManyOnDay: "too_many_on_day",
  TooClose: "too_close",
  NotApprovedYet: "not_approved_yet",
  DatePassed: "date_passed",
} as const;
export type CalendarAlert = ValueOf<typeof CalendarAlert>;

export const SectionKind = {
  Hero: "hero",
  ServicesGrid: "services_grid",
  PortfolioGrid: "portfolio_grid",
  Testimonials: "testimonials",
  RichText: "rich_text",
  ImageText: "image_text",
  Gallery: "gallery",
  Faq: "faq",
  ContactForm: "contact_form",
} as const;
export type SectionKind = ValueOf<typeof SectionKind>;

export const LinkKind = {
  Page: "page",
  Anchor: "anchor",
  CaseStudy: "case_study",
  Url: "url",
  Whatsapp: "whatsapp",
  Email: "email",
  Phone: "phone",
} as const;
export type LinkKind = ValueOf<typeof LinkKind>;

export const SitePageKind = {
  Home: "home",
  About: "about",
  Services: "services",
  Portfolio: "portfolio",
  CaseStudy: "case_study",
  Contact: "contact",
  BlogPost: "blog_post",
  Generic: "generic",
} as const;
export type SitePageKind = ValueOf<typeof SitePageKind>;

export const SitePageStatus = {
  Draft: "draft",
  Published: "published",
  Unpublished: "unpublished",
} as const;
export type SitePageStatus = ValueOf<typeof SitePageStatus>;

export const SiteEntryKind = {
  Service: "service",
  Testimonial: "testimonial",
} as const;
export type SiteEntryKind = ValueOf<typeof SiteEntryKind>;

export const SiteSettingsGroup = {
  Contacts: "contacts",
  Social: "social",
  Languages: "languages",
  SeoDefaults: "seo_defaults",
  Navigation: "navigation",
  MessageTemplates: "message_templates",
  Announcement: "announcement",
} as const;
export type SiteSettingsGroup = ValueOf<typeof SiteSettingsGroup>;

export const ContactMessageStatus = {
  New: "new",
  Answered: "answered",
  Discarded: "discarded",
} as const;
export type ContactMessageStatus = ValueOf<typeof ContactMessageStatus>;

export const SectionBackground = {
  Ivory: "ivory",
  Cream: "cream",
  Peach: "peach",
} as const;
export type SectionBackground = ValueOf<typeof SectionBackground>;

export const SectionSpacing = {
  Small: "s",
  Medium: "m",
  Large: "l",
} as const;
export type SectionSpacing = ValueOf<typeof SectionSpacing>;

export const SectionAccent = {
  Violet: "violet",
  Coral: "coral",
  Orchid: "orchid",
} as const;
export type SectionAccent = ValueOf<typeof SectionAccent>;

export const PublicSiteState = {
  None: "none",
  Ok: "ok",
  Redirect: "redirect",
  NotFound: "not_found",
} as const;
export type PublicSiteState = ValueOf<typeof PublicSiteState>;

export const ProblemSeverity = {
  Error: "error",
  Warning: "warning",
} as const;
export type ProblemSeverity = ValueOf<typeof ProblemSeverity>;

export const PortfolioSource = {
  All: "all",
  Manual: "manual",
} as const;
export type PortfolioSource = ValueOf<typeof PortfolioSource>;

export const ImageSide = {
  Left: "left",
  Right: "right",
} as const;
export type ImageSide = ValueOf<typeof ImageSide>;
