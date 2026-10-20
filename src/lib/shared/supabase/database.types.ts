export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          admin_only: boolean
          description: string
          key: string
          module: string
          portal: boolean
          requires: string[]
        }
        Insert: {
          admin_only?: boolean
          description: string
          key: string
          module: string
          portal?: boolean
          requires?: string[]
        }
        Update: {
          admin_only?: boolean
          description?: string
          key?: string
          module?: string
          portal?: boolean
          requires?: string[]
        }
        Relationships: []
      }
      approval_decisions: {
        Row: {
          comment: string | null
          decided_at: string
          decided_by: string
          id: string
          outcome: string
          request_id: string
          revision_id: string
        }
        Insert: {
          comment?: string | null
          decided_at?: string
          decided_by: string
          id?: string
          outcome: string
          request_id: string
          revision_id: string
        }
        Update: {
          comment?: string | null
          decided_at?: string
          decided_by?: string
          id?: string
          outcome?: string
          request_id?: string
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_decisions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_decisions_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          brand_id: string
          cancelled_reason: string | null
          decided_at: string | null
          due_date: string | null
          id: string
          item_id: string
          message: string | null
          requested_at: string
          requested_by: string | null
          revision_id: string
          stage: string
          status: string
          viewed_at: string | null
        }
        Insert: {
          brand_id: string
          cancelled_reason?: string | null
          decided_at?: string | null
          due_date?: string | null
          id?: string
          item_id: string
          message?: string | null
          requested_at?: string
          requested_by?: string | null
          revision_id: string
          stage?: string
          status?: string
          viewed_at?: string | null
        }
        Update: {
          brand_id?: string
          cancelled_reason?: string | null
          decided_at?: string | null
          due_date?: string | null
          id?: string
          item_id?: string
          message?: string | null
          requested_at?: string
          requested_by?: string | null
          revision_id?: string
          stage?: string
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_item_id_brand_id_fkey"
            columns: ["item_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "approval_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_revision_id_variant_id_fkey"
            columns: ["revision_id", "item_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id", "item_id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          brand_id: string | null
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          occurred_at: string
          organization_id: string
          request_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind?: string
          brand_id?: string | null
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id: string
          request_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          brand_id?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          occurred_at?: string
          organization_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_members: {
        Row: {
          brand_id: string
          can_decide: boolean
          granted_at: string
          granted_by: string | null
          kind: string
          revoked_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          brand_id: string
          can_decide?: boolean
          granted_at?: string
          granted_by?: string | null
          kind: string
          revoked_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          can_decide?: boolean
          granted_at?: string
          granted_by?: string | null
          kind?: string
          revoked_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_members_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          logo_media_version_id: string | null
          name: string
          objectives: string | null
          organization_id: string
          references_notes: string | null
          target_audience: string | null
          timezone: string
          tone_of_voice: string | null
          updated_at: string
          version: number
          visual_identity: Json
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_media_version_id?: string | null
          name: string
          objectives?: string | null
          organization_id: string
          references_notes?: string | null
          target_audience?: string | null
          timezone: string
          tone_of_voice?: string | null
          updated_at?: string
          version?: number
          visual_identity?: Json
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          logo_media_version_id?: string | null
          name?: string
          objectives?: string | null
          organization_id?: string
          references_notes?: string | null
          target_audience?: string | null
          timezone?: string
          tone_of_voice?: string | null
          updated_at?: string
          version?: number
          visual_identity?: Json
        }
        Relationships: [
          {
            foreignKeyName: "brands_client_id_organization_id_fkey"
            columns: ["client_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_logo_media_version_id_fkey"
            columns: ["logo_media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notes: {
        Row: {
          all_day: boolean
          archived_at: string | null
          brand_id: string
          client_visible: boolean
          converted_at: string | null
          converted_item_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          ends_at: string | null
          event_type: string | null
          id: string
          internal_notes: string | null
          kind: string
          location: string | null
          note_date: string
          repeat: string
          starts_at: string | null
          timezone: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          all_day?: boolean
          archived_at?: string | null
          brand_id: string
          client_visible?: boolean
          converted_at?: string | null
          converted_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          internal_notes?: string | null
          kind: string
          location?: string | null
          note_date: string
          repeat?: string
          starts_at?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          all_day?: boolean
          archived_at?: string | null
          brand_id?: string
          client_visible?: boolean
          converted_at?: string | null
          converted_item_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          ends_at?: string | null
          event_type?: string | null
          id?: string
          internal_notes?: string | null
          kind?: string
          location?: string | null
          note_date?: string
          repeat?: string
          starts_at?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_notes_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_notes_converted_item_id_brand_id_fkey"
            columns: ["converted_item_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "calendar_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          archived_at: string | null
          brand_id: string
          created_at: string
          external_id: string | null
          id: string
          notes: string | null
          platform: string
          profile_name: string
          profile_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          brand_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          platform: string
          profile_name: string
          profile_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          brand_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          platform?: string
          profile_name?: string
          profile_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role_title: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          name: string
          organization_id: string
          owner_user_id: string | null
          tags: string[]
          updated_at: string
          version: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          name: string
          organization_id: string
          owner_user_id?: string | null
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          brand_id: string
          created_at: string
          deleted_at: string | null
          id: string
          item_id: string
          revision_id: string | null
          visibility: string
        }
        Insert: {
          author_id: string
          body: string
          brand_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          revision_id?: string | null
          visibility: string
        }
        Update: {
          author_id?: string
          body?: string
          brand_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          revision_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_item_id_brand_id_fkey"
            columns: ["item_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "comments_revision_id_variant_id_fkey"
            columns: ["revision_id", "item_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id", "item_id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          consent_at: string
          created_at: string
          email: string | null
          handled_by: string | null
          id: string
          internal_note: string | null
          message: string
          name: string
          phone: string | null
          site_id: string
          source_slug: string | null
          status: string
        }
        Insert: {
          consent_at: string
          created_at?: string
          email?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          message: string
          name: string
          phone?: string | null
          site_id: string
          source_slug?: string | null
          status?: string
        }
        Update: {
          consent_at?: string
          created_at?: string
          email?: string | null
          handled_by?: string | null
          id?: string
          internal_note?: string | null
          message?: string
          name?: string
          phone?: string | null
          site_id?: string
          source_slug?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_messages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_channels: {
        Row: {
          brand_id: string
          caption: Json | null
          channel_id: string
          content_item_id: string
          created_at: string
          format: string
          id: string
          planned_at: string | null
          planned_timezone: string | null
          position: number
          publication_status: string
          published_at: string | null
          published_evidence_media_version_id: string | null
          published_note: string | null
          published_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand_id: string
          caption?: Json | null
          channel_id: string
          content_item_id: string
          created_at?: string
          format: string
          id?: string
          planned_at?: string | null
          planned_timezone?: string | null
          position?: number
          publication_status?: string
          published_at?: string | null
          published_evidence_media_version_id?: string | null
          published_note?: string | null
          published_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand_id?: string
          caption?: Json | null
          channel_id?: string
          content_item_id?: string
          created_at?: string
          format?: string
          id?: string
          planned_at?: string | null
          planned_timezone?: string | null
          position?: number
          publication_status?: string
          published_at?: string | null
          published_evidence_media_version_id?: string | null
          published_note?: string | null
          published_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_variants_channel_id_brand_id_fkey"
            columns: ["channel_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "content_variants_content_item_id_brand_id_fkey"
            columns: ["content_item_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id", "brand_id"]
          },
          {
            foreignKeyName: "content_variants_published_evidence_media_version_id_fkey"
            columns: ["published_evidence_media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          approval_due_date: string | null
          approved_revision_id: string | null
          assignee_id: string | null
          brand_id: string
          briefing: Json | null
          call_to_action: string | null
          cancelled_at: string | null
          caption: Json | null
          created_at: string
          created_by: string | null
          current_revision_id: string | null
          editorial_status: string
          id: string
          internal_notes: string | null
          objective: string | null
          objective_kind: string | null
          plan_approved_revision_id: string | null
          plan_media: Json
          plan_required: boolean
          plan_summary: string | null
          production_due_date: string | null
          tags: string[]
          title: string
          updated_at: string
          version: number
          working_media: Json
        }
        Insert: {
          approval_due_date?: string | null
          approved_revision_id?: string | null
          assignee_id?: string | null
          brand_id: string
          briefing?: Json | null
          call_to_action?: string | null
          cancelled_at?: string | null
          caption?: Json | null
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          editorial_status?: string
          id?: string
          internal_notes?: string | null
          objective?: string | null
          objective_kind?: string | null
          plan_approved_revision_id?: string | null
          plan_media?: Json
          plan_required: boolean
          plan_summary?: string | null
          production_due_date?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          version?: number
          working_media?: Json
        }
        Update: {
          approval_due_date?: string | null
          approved_revision_id?: string | null
          assignee_id?: string | null
          brand_id?: string
          briefing?: Json | null
          call_to_action?: string | null
          cancelled_at?: string | null
          caption?: Json | null
          created_at?: string
          created_by?: string | null
          current_revision_id?: string | null
          editorial_status?: string
          id?: string
          internal_notes?: string | null
          objective?: string | null
          objective_kind?: string | null
          plan_approved_revision_id?: string | null
          plan_media?: Json
          plan_required?: boolean
          plan_summary?: string | null
          production_due_date?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          version?: number
          working_media?: Json
        }
        Relationships: [
          {
            foreignKeyName: "content_items_approved_revision_id_id_fkey"
            columns: ["approved_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "content_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_current_revision_id_id_fkey"
            columns: ["current_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id", "item_id"]
          },
          {
            foreignKeyName: "content_items_plan_approved_revision_id_id_fkey"
            columns: ["plan_approved_revision_id", "id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id", "item_id"]
          },
        ]
      }
      content_revision_media: {
        Row: {
          alt_text: string | null
          media_version_id: string
          position: number
          revision_id: string
        }
        Insert: {
          alt_text?: string | null
          media_version_id: string
          position: number
          revision_id: string
        }
        Update: {
          alt_text?: string | null
          media_version_id?: string
          position?: number
          revision_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_revision_media_media_version_id_fkey"
            columns: ["media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_revision_media_revision_id_fkey"
            columns: ["revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_revisions: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          revision_no: number
          snapshot: Json
          stage: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          revision_no: number
          snapshot: Json
          stage?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          revision_no?: number
          snapshot?: Json
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_revisions_item_id_brand_id_fkey"
            columns: ["item_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id", "brand_id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          next_attempt_at: string
          payload: Json
          status: string
          template: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload: Json
          status?: string
          template: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          next_attempt_at?: string
          payload?: Json
          status?: string
          template?: string
          to_email?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          grants: Json
          id: string
          invited_by: string | null
          organization_id: string
          revoked_at: string | null
          role_id: string
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at: string
          grants?: Json
          id?: string
          invited_by?: string | null
          organization_id: string
          revoked_at?: string | null
          role_id: string
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          grants?: Json
          id?: string
          invited_by?: string | null
          organization_id?: string
          revoked_at?: string | null
          role_id?: string
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          display_name: string
          id: string
          organization_id: string
          scope: string
          size_bytes: number
          tags: string[]
          trashed_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          display_name: string
          id?: string
          organization_id: string
          scope: string
          size_bytes?: number
          tags?: string[]
          trashed_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          current_version_id?: string | null
          display_name?: string
          id?: string
          organization_id?: string
          scope?: string
          size_bytes?: number
          tags?: string[]
          trashed_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_current_version_fkey"
            columns: ["current_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_collection_items: {
        Row: {
          asset_id: string
          collection_id: string
        }
        Insert: {
          asset_id: string
          collection_id: string
        }
        Update: {
          asset_id?: string
          collection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_collection_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "media_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      media_collections: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          scope: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          scope: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_collections_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_collections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_collections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "media_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      media_share_events: {
        Row: {
          asset_id: string | null
          created_at: string
          id: number
          share_id: string
          type: string
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: never
          share_id: string
          type: string
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: never
          share_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_share_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_share_events_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "media_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      media_share_grants: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          share_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          share_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          share_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_share_grants_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "media_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      media_shares: {
        Row: {
          allow_download: boolean
          asset_id: string | null
          brand_id: string | null
          collection_id: string | null
          created_at: string
          created_by: string | null
          download_count: number
          expires_at: string | null
          failed_attempts: number
          has_password: boolean | null
          id: string
          include_subcollections: boolean
          label: string
          last_accessed_at: string | null
          locked_until: string | null
          max_downloads: number | null
          message: string | null
          organization_id: string
          password_hash: string | null
          pinned_version_id: string | null
          revoked_at: string | null
          scope: string
          status: string
          token: string
        }
        Insert: {
          allow_download?: boolean
          asset_id?: string | null
          brand_id?: string | null
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          download_count?: number
          expires_at?: string | null
          failed_attempts?: number
          has_password?: boolean | null
          id?: string
          include_subcollections?: boolean
          label: string
          last_accessed_at?: string | null
          locked_until?: string | null
          max_downloads?: number | null
          message?: string | null
          organization_id: string
          password_hash?: string | null
          pinned_version_id?: string | null
          revoked_at?: string | null
          scope: string
          status?: string
          token?: string
        }
        Update: {
          allow_download?: boolean
          asset_id?: string | null
          brand_id?: string | null
          collection_id?: string | null
          created_at?: string
          created_by?: string | null
          download_count?: number
          expires_at?: string | null
          failed_attempts?: number
          has_password?: boolean | null
          id?: string
          include_subcollections?: boolean
          label?: string
          last_accessed_at?: string | null
          locked_until?: string | null
          max_downloads?: number | null
          message?: string | null
          organization_id?: string
          password_hash?: string | null
          pinned_version_id?: string | null
          revoked_at?: string | null
          scope?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_shares_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "media_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_shares_pinned_version_id_fkey"
            columns: ["pinned_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_upload_sessions: {
        Row: {
          author_id: string
          created_at: string
          expires_at: string
          id: string
          idempotency_key: string
          purpose: string
          reserved_bytes: number
          status: string
          version_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          expires_at: string
          id?: string
          idempotency_key: string
          purpose: string
          reserved_bytes: number
          status?: string
          version_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          idempotency_key?: string
          purpose?: string
          reserved_bytes?: number
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_upload_sessions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_upload_sessions_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_usages: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          media_version_id: string
          usage_ref_id: string
          usage_type: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_version_id: string
          usage_ref_id: string
          usage_type: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_version_id?: string
          usage_ref_id?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_usages_media_version_id_fkey"
            columns: ["media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      media_versions: {
        Row: {
          asset_id: string
          checksum: string | null
          created_at: string
          derivative_bytes: number
          display_key: string | null
          duration_ms: number | null
          failure_reason: string | null
          height: number | null
          id: string
          mime_type: string
          original_filename: string
          original_purged_at: string | null
          public_published_at: string | null
          purge_keep_preview: boolean
          purge_requested_at: string | null
          size_bytes: number
          status: string
          storage_key: string
          thumb_key: string | null
          uploaded_by: string | null
          version_no: number
          width: number | null
        }
        Insert: {
          asset_id: string
          checksum?: string | null
          created_at?: string
          derivative_bytes?: number
          display_key?: string | null
          duration_ms?: number | null
          failure_reason?: string | null
          height?: number | null
          id?: string
          mime_type: string
          original_filename: string
          original_purged_at?: string | null
          public_published_at?: string | null
          purge_keep_preview?: boolean
          purge_requested_at?: string | null
          size_bytes: number
          status?: string
          storage_key: string
          thumb_key?: string | null
          uploaded_by?: string | null
          version_no: number
          width?: number | null
        }
        Update: {
          asset_id?: string
          checksum?: string | null
          created_at?: string
          derivative_bytes?: number
          display_key?: string | null
          duration_ms?: number | null
          failure_reason?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          original_filename?: string
          original_purged_at?: string | null
          public_published_at?: string | null
          purge_keep_preview?: boolean
          purge_requested_at?: string | null
          size_bytes?: number
          status?: string
          storage_key?: string
          thumb_key?: string | null
          uploaded_by?: string | null
          version_no?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_kinds: {
        Row: {
          available: boolean
          default_email: boolean
          default_lead_days: number[] | null
          kind: string
          portal: boolean
          required_action: string
          schedulable: boolean
          severity: string
          title: string
        }
        Insert: {
          available?: boolean
          default_email?: boolean
          default_lead_days?: number[] | null
          kind: string
          portal?: boolean
          required_action: string
          schedulable?: boolean
          severity?: string
          title: string
        }
        Update: {
          available?: boolean
          default_email?: boolean
          default_lead_days?: number[] | null
          kind?: string
          portal?: boolean
          required_action?: string
          schedulable?: boolean
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_kinds_required_action_fkey"
            columns: ["required_action"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["key"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          email: boolean
          enabled: boolean
          kind: string
          lead_days: number[] | null
          user_id: string
        }
        Insert: {
          email?: boolean
          enabled?: boolean
          kind: string
          lead_days?: number[] | null
          user_id: string
        }
        Update: {
          email?: boolean
          enabled?: boolean
          kind?: string
          lead_days?: number[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "notification_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          brand_id: string | null
          created_at: string
          dedupe_key: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          ref_id: string | null
          ref_type: string | null
          severity: string
          snoozed_until: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          brand_id?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          brand_id?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          ref_id?: string | null
          ref_type?: string | null
          severity?: string
          snoozed_until?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "notification_kinds"
            referencedColumns: ["kind"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
          version: number
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
          version?: number
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          created_at: string
          default_timezone: string
          id: string
          legal_name: string | null
          logo_media_version_id: string | null
          name: string
          tax_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          default_timezone?: string
          id?: string
          legal_name?: string | null
          logo_media_version_id?: string | null
          name: string
          tax_id?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          default_timezone?: string
          id?: string
          legal_name?: string | null
          logo_media_version_id?: string | null
          name?: string
          tax_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "organizations_logo_media_version_fkey"
            columns: ["logo_media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          profile_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          profile_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          profile_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          kind: string
          locale: string
          role_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          kind?: string
          locale?: string
          role_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          kind?: string
          locale?: string
          role_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_actions: {
        Row: {
          action_key: string
          role_id: string
        }
        Insert: {
          action_key: string
          role_id: string
        }
        Update: {
          action_key?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_actions_action_key_fkey"
            columns: ["action_key"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "role_actions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          role_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          role_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_value?: Json | null
          old_value?: Json | null
          role_id?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          key: string
          name: string
          portal_only: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key: string
          name: string
          portal_only?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          key?: string
          name?: string
          portal_only?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      site_case_study_authorizations: {
        Row: {
          authorized_at: string
          authorized_by: string
          brand_id: string
          consent_note: string
          id: string
          page_id: string
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          authorized_at?: string
          authorized_by: string
          brand_id: string
          consent_note: string
          id?: string
          page_id: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          authorized_at?: string
          authorized_by?: string
          brand_id?: string
          consent_note?: string
          id?: string
          page_id?: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_case_study_authorizations_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_case_study_authorizations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_case_study_authorizations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_case_study_authorizations_withdrawn_by_fkey"
            columns: ["withdrawn_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_entries: {
        Row: {
          content: Json
          id: string
          kind: string
          site_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
          version: number
          visible: boolean
        }
        Insert: {
          content: Json
          id?: string
          kind: string
          site_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          visible?: boolean
        }
        Update: {
          content?: Json
          id?: string
          kind?: string
          site_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "site_entries_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_page_revisions: {
        Row: {
          cancelled_at: string | null
          content: Json
          id: string
          live_from: string | null
          note: string | null
          page_id: string
          published_at: string
          published_by: string | null
          revision_no: number
          source_revision_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          content: Json
          id?: string
          live_from?: string | null
          note?: string | null
          page_id: string
          published_at?: string
          published_by?: string | null
          revision_no: number
          source_revision_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          content?: Json
          id?: string
          live_from?: string | null
          note?: string | null
          page_id?: string
          published_at?: string
          published_by?: string | null
          revision_no?: number
          source_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_page_revisions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "site_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_page_revisions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_page_revisions_source_revision_id_fkey"
            columns: ["source_revision_id"]
            isOneToOne: false
            referencedRelation: "site_page_revisions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          created_at: string
          draft_content: Json
          id: string
          is_system: boolean
          kind: string
          published_revision_id: string | null
          site_id: string
          slug: string
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          draft_content?: Json
          id?: string
          is_system?: boolean
          kind: string
          published_revision_id?: string | null
          site_id: string
          slug: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          draft_content?: Json
          id?: string
          is_system?: boolean
          kind?: string
          published_revision_id?: string | null
          site_id?: string
          slug?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_published_revision_id_fkey"
            columns: ["published_revision_id"]
            isOneToOne: false
            referencedRelation: "site_page_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_pages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_redirects: {
        Row: {
          created_at: string
          created_by: string | null
          from_path: string
          id: string
          permanent: boolean
          site_id: string
          to_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_path: string
          id?: string
          permanent?: boolean
          site_id: string
          to_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_path?: string
          id?: string
          permanent?: boolean
          site_id?: string
          to_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_redirects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_redirects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          published_settings: Json | null
          published_settings_at: string | null
          settings: Json
          settings_version: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          published_settings?: Json | null
          published_settings_at?: string | null
          settings?: Json
          settings_version?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          published_settings?: Json | null
          published_settings_at?: string | null
          settings?: Json
          settings_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token_hash: string | null}; Returns: Json }
      approver_is_valid: {
        Args: { p_brand: string | null, p_user: string | null}
        Returns: boolean
      }
      approver_options: { Args: { p_brand: string | null}; Returns: Json }
      assert_action: { Args: { p_action: string | null}; Returns: undefined }
      assert_brand_access: { Args: { p_brand: string | null}; Returns: undefined }
      audit_list: {
        Args: { p_export?: boolean | null, p_filters: Json | null, p_page: number | null}
        Returns: Json
      }
      audit_write: {
        Args: {          p_action: string | null,          p_brand: string | null,          p_entity_id: string | null,          p_entity_type: string | null,          p_metadata: Json | null,          p_org: string | null}
        Returns: undefined
      }
      brand_approver_ids: { Args: { p_brand: string | null}; Returns: string[] }
      brand_delete: { Args: { p_brand: string | null}; Returns: undefined }
      brand_has_history: { Args: { p_brand: string | null}; Returns: boolean }
      brand_logo_keys: {
        Args: { p_brands: string[] | null}
        Returns: {
          brand_id: string
          thumb_key: string
        }[]
      }
      brand_member_set: {
        Args: {          p_brand: string | null,          p_can_decide: boolean | null,          p_kind: string | null,          p_status: string | null,          p_user: string | null}
        Returns: undefined
      }
      brand_save: { Args: { p_brand: Json | null}; Returns: Json }
      brand_set_archived: {
        Args: { p_archived: boolean | null, p_brand: string | null}
        Returns: Json
      }
      brand_set_logo: {
        Args: { p_brand: string | null, p_version: string | null}
        Returns: Json
      }
      calendar_event_notify: {
        Args: {          p_change: string | null,          p_note: Database["public"]["Tables"]["calendar_notes"]["Row"] | null}
        Returns: undefined
      }
      calendar_event_when: {
        Args: { p_note: Database["public"]["Tables"]["calendar_notes"]["Row"] | null}
        Returns: string
      }
      calendar_note_archive: { Args: { p_note: string | null}; Returns: undefined }
      calendar_note_days: {
        Args: {          p_end_date: string | null,          p_from: string | null,          p_note_date: string | null,          p_repeat: string | null,          p_to: string | null,          p_zone: string | null}
        Returns: string[]
      }
      calendar_note_get: { Args: { p_note: string | null}; Returns: Json }
      calendar_note_save: { Args: { p_note: Json | null}; Returns: Json }
      calendar_range_ok: {
        Args: { p_from: string | null, p_to: string | null}
        Returns: boolean
      }
      can_access_brand: { Args: { p_brand: string | null}; Returns: boolean }
      can_view_client: { Args: { p_client: string | null}; Returns: boolean }
      can_view_media_asset: { Args: { p_asset: string | null}; Returns: boolean }
      cancel_request: {
        Args: { p_reason: string | null, p_request: string | null}
        Returns: undefined
      }
      channel_delete: { Args: { p_channel: string | null}; Returns: undefined }
      channel_is_used: { Args: { p_channel: string | null}; Returns: boolean }
      channel_save: { Args: { p_channel: Json | null}; Returns: Json }
      channel_set_archived: {
        Args: { p_archived: boolean | null, p_channel: string | null}
        Returns: Json
      }
      client_contact_delete: { Args: { p_contact: string | null}; Returns: undefined }
      client_contact_save: { Args: { p_contact: Json | null}; Returns: Json }
      client_delete: { Args: { p_client: string | null}; Returns: undefined }
      client_save: {
        Args: { p_client: Json | null, p_create_brand?: boolean | null}
        Returns: Json
      }
      client_set_archived: {
        Args: {          p_archive_brands?: boolean | null,          p_archived: boolean | null,          p_client: string | null}
        Returns: Json
      }
      comment_add: {
        Args: { p_body: string | null, p_item: string | null, p_visibility: string | null}
        Returns: Json
      }
      comment_delete: { Args: { p_comment: string | null}; Returns: undefined }
      comment_list: { Args: { p_item: string | null}; Returns: Json }
      content_cancel_pending_requests: {
        Args: { p_item: string | null, p_reason: string | null}
        Returns: undefined
      }
      content_channel_cancel: {
        Args: { p_channel_row: string | null, p_reason: string | null}
        Returns: undefined
      }
      content_channels_signature: { Args: { p_item: string | null}; Returns: Json }
      content_check_channel: {
        Args: { p_brand: string | null, p_channel: string | null}
        Returns: undefined
      }
      content_check_media: {
        Args: { p_brand: string | null, p_media: Json | null}
        Returns: undefined
      }
      content_item_cancel: {
        Args: { p_item: string | null, p_reason: string | null}
        Returns: undefined
      }
      content_item_delete: { Args: { p_item: string | null}; Returns: undefined }
      content_item_is_ready: { Args: { p_item: string | null}; Returns: boolean }
      content_item_save: { Args: { p_item: Json | null}; Returns: Json }
      content_move: {
        Args: {          p_expected_version: number | null,          p_item: string | null,          p_to_status: string | null}
        Returns: Json
      }
      content_normalize_media: { Args: { p_media: Json | null}; Returns: Json }
      content_plan_signature: { Args: { p_item: string | null}; Returns: Json }
      current_organization_id: { Args: never; Returns: string }
      dashboard_attention: { Args: { p_brands?: string[] | null}; Returns: Json }
      dashboard_my_items: { Args: never; Returns: Json }
      dashboard_status_counts: { Args: { p_brands?: string[] | null}; Returns: Json }
      editorial_transition_allowed: {
        Args: { p_from: string | null, p_to: string | null}
        Returns: boolean
      }
      generate_due_notifications: { Args: never; Returns: Json }
      has_action: { Args: { p_action: string | null}; Returns: boolean }
      invitation_create: {
        Args: {          p_email: string | null,          p_expires_at: string | null,          p_grants: Json | null,          p_role: string | null,          p_token_hash: string | null}
        Returns: Json
      }
      invitation_revoke: { Args: { p_invitation: string | null}; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_external_brand_member: {
        Args: { p_brand: string | null, p_must_decide?: boolean | null}
        Returns: boolean
      }
      list_calendar_entries: {
        Args: {          p_assignee?: string | null,          p_brands?: string[] | null,          p_channels?: string[] | null,          p_editorial?: string[] | null,          p_from: string | null,          p_notes?: string[] | null,          p_publication?: string[] | null,          p_to: string | null}
        Returns: Json
      }
      mark_published: {
        Args: {          p_channel_row: string | null,          p_evidence_media_version: string | null,          p_note: string | null,          p_published_at: string | null,          p_url: string | null}
        Returns: Json
      }
      media_assert_asset_access: {
        Args: { p_asset: string | null}
        Returns: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          current_version_id: string | null
          display_name: string
          id: string
          organization_id: string
          scope: string
          size_bytes: number
          tags: string[]
          trashed_at: string | null
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "media_assets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      media_collection_delete: {
        Args: { p_collection: string | null}
        Returns: undefined
      }
      media_collection_move_items: {
        Args: { p_assets: string[] | null, p_collection: string | null}
        Returns: undefined
      }
      media_collection_save: { Args: { p_collection: Json | null}; Returns: Json }
      media_confirm_upload: {
        Args: {          p_checksum: string | null,          p_derivative_bytes?: number | null,          p_duration: number | null,          p_height: number | null,          p_version: string | null,          p_width: number | null}
        Returns: Json
      }
      media_delete_permanently: { Args: { p_asset: string | null}; Returns: Json }
      media_expire_sessions: { Args: never; Returns: Json }
      media_mark_failed: {
        Args: { p_reason: string | null, p_version: string | null}
        Returns: Json
      }
      media_policy_mb: {
        Args: { p_default: number | null, p_name: string | null}
        Returns: number
      }
      media_publish_derivative: { Args: { p_version: string | null}; Returns: Json }
      media_purge_confirm: { Args: { p_ids: string[] | null}; Returns: number }
      media_purge_pending: { Args: never; Returns: Json }
      media_replace_version: {
        Args: { p_asset: string | null, p_version: string | null}
        Returns: Json
      }
      media_request_upload: {
        Args: {          p_asset?: string | null,          p_brand: string | null,          p_filename: string | null,          p_idempotency_key: string | null,          p_mime: string | null,          p_scope: string | null,          p_size: number | null}
        Returns: Json
      }
      media_set_trashed: {
        Args: { p_asset: string | null, p_trashed: boolean | null}
        Returns: Json
      }
      media_share_assert_scope: {
        Args: { p_brand: string | null, p_scope: string | null}
        Returns: undefined
      }
      media_share_create: { Args: { p_input: Json | null}; Returns: Json }
      media_share_files: {
        Args: { p_share: string | null}
        Returns: {
          asset_id: string
          display_key: string
          filename: string
          height: number
          mime: string
          size_bytes: number
          storage_key: string
          thumb_key: string
          title: string
          version_id: string
          width: number
        }[]
      }
      media_share_gate: {
        Args: { p_grant: string | null, p_token: string | null}
        Returns: string
      }
      media_share_list: {
        Args: { p_kind: string | null, p_target: string | null}
        Returns: Json
      }
      media_share_public_file: {
        Args: {          p_asset: string | null,          p_grant: string | null,          p_mode: string | null,          p_token: string | null}
        Returns: Json
      }
      media_share_public_open: {
        Args: { p_grant: string | null, p_token: string | null}
        Returns: Json
      }
      media_share_public_unlock: {
        Args: { p_password: string | null, p_token: string | null}
        Returns: Json
      }
      media_share_revoke: { Args: { p_share: string | null}; Returns: undefined }
      media_share_targets: { Args: never; Returns: Json }
      media_share_update: { Args: { p_input: Json | null}; Returns: undefined }
      media_storage_keys: { Args: never; Returns: Json }
      media_storage_summary: { Args: never; Returns: Json }
      media_storage_used: { Args: never; Returns: number }
      media_update: { Args: { p_asset: Json | null}; Returns: Json }
      media_version_in_use: { Args: { p_version: string | null}; Returns: boolean }
      media_withdraw_derivative: { Args: { p_version: string | null}; Returns: Json }
      my_actions: { Args: never; Returns: string[] }
      notification_date_text: { Args: { p_date: string | null}; Returns: string }
      notification_kind_save: {
        Args: {          p_default_email: boolean | null,          p_default_lead_days: number[] | null,          p_kind: string | null}
        Returns: undefined
      }
      notification_lead_days: {
        Args: { p_kind: string | null, p_user: string | null}
        Returns: number[]
      }
      notify_scan_content: { Args: never; Returns: undefined }
      notify_scan_invitations: { Args: never; Returns: undefined }
      notify_users: {
        Args: {          p_body: string | null,          p_brand: string | null,          p_dedupe_key: string | null,          p_kind: string | null,          p_link: string | null,          p_recipients?: string[] | null,          p_ref_id: string | null,          p_ref_type: string | null,          p_title: string | null}
        Returns: undefined
      }
      organization_save: { Args: { p_organization: Json | null}; Returns: Json }
      organization_setting_save: {
        Args: { p_expected_version: number | null, p_key: string | null, p_value: Json | null}
        Returns: Json
      }
      person_names: { Args: { p_ids: string[] | null}; Returns: Json }
      plan_approval_required: { Args: never; Returns: boolean }
      portal_add_comment: {
        Args: { p_body: string | null, p_item: string | null}
        Returns: Json
      }
      portal_assert_member: { Args: { p_brand: string | null}; Returns: undefined }
      portal_brand_logo_keys: {
        Args: { p_brands: string[] | null}
        Returns: {
          brand_id: string
          thumb_key: string
        }[]
      }
      portal_decide_approval: {
        Args: { p_comment: string | null, p_outcome: string | null, p_request: string | null}
        Returns: Json
      }
      portal_get_approval: { Args: { p_request: string | null}; Returns: Json }
      portal_get_brand: { Args: { p_brand: string | null}; Returns: Json }
      portal_list_approvals: {
        Args: {          p_brand: string | null,          p_page: number | null,          p_page_size: number | null,          p_status: string | null}
        Returns: Json
      }
      portal_list_brands: { Args: never; Returns: Json }
      portal_list_calendar: {
        Args: { p_brand: string | null, p_from: string | null, p_to: string | null}
        Returns: Json
      }
      portal_list_comments: { Args: { p_item: string | null}; Returns: Json }
      portal_list_pending: { Args: { p_brand: string | null}; Returns: Json }
      portal_media_urls: {
        Args: { p_revision: string | null, p_version_ids: string[] | null}
        Returns: Json
      }
      portal_record_view: { Args: { p_request: string | null}; Returns: undefined }
      portal_request_row: {
        Args: {          p_request: Database["public"]["Tables"]["approval_requests"]["Row"] | null}
        Returns: Json
      }
      profile_set_access: {
        Args: { p_profile: string | null, p_role?: string | null, p_status: string | null}
        Returns: undefined
      }
      publish_content: {
        Args: { p_expected_version: number | null, p_item: string | null}
        Returns: Json
      }
      publish_site_page: {
        Args: {          p_expected_hash: string | null,          p_note: string | null,          p_page: string | null,          p_resolved: Json | null}
        Returns: Json
      }
      publish_site_settings: {
        Args: { p_expected_version: number | null, p_resolved: Json | null}
        Returns: Json
      }
      reopen_content: {
        Args: { p_item: string | null, p_reason: string | null, p_scope?: string | null}
        Returns: Json
      }
      reschedule_channel: {
        Args: {          p_channel_row: string | null,          p_expected_version: number | null,          p_planned_at: string | null,          p_timezone: string | null}
        Returns: Json
      }
      reschedule_production_deadline: {
        Args: { p_date: string | null, p_expected_version: number | null, p_item: string | null}
        Returns: Json
      }
      resolve_notifications: {
        Args: { p_ref_id: string | null, p_ref_type: string | null}
        Returns: undefined
      }
      role_delete: { Args: { p_role: string | null}; Returns: undefined }
      role_save: { Args: { p_role: Json | null}; Returns: Json }
      send_approval_reminder: {
        Args: { p_request: string | null}
        Returns: undefined
      }
      site_case_study_authorize: {
        Args: { p_brand: string | null, p_consent_note: string | null, p_page: string | null}
        Returns: undefined
      }
      site_case_study_withdraw: { Args: { p_page: string | null}; Returns: undefined }
      site_contact_submit: {
        Args: { p_payload: Json | null, p_site: string | null}
        Returns: undefined
      }
      site_contact_update: {
        Args: { p_message: string | null, p_note: string | null, p_status: string | null}
        Returns: undefined
      }
      site_draft_snapshot: { Args: { p_page: string | null}; Returns: Json }
      site_ensure: { Args: never; Returns: string }
      site_entry_delete: { Args: { p_entry: string | null}; Returns: undefined }
      site_entry_save: { Args: { p_entry: Json | null}; Returns: Json }
      site_media_ids: { Args: { p_content: Json | null}; Returns: string[] }
      site_media_in_use: { Args: { p_version: string | null}; Returns: boolean }
      site_media_info: { Args: { p_ids: string[] | null}; Returns: Json }
      site_overview: { Args: never; Returns: Json }
      site_page_delete: { Args: { p_page: string | null}; Returns: undefined }
      site_page_save: {
        Args: { p_expected_version?: number | null, p_page: Json | null}
        Returns: Json
      }
      site_pages_overview: { Args: never; Returns: Json }
      site_publish_page_row: {
        Args: {          p_note: string | null,          p_page: Database["public"]["Tables"]["site_pages"]["Row"] | null,          p_resolved: Json | null,          p_source: string | null}
        Returns: number
      }
      site_published_page: { Args: { p_slug: string | null}; Returns: Json }
      site_published_settings: { Args: never; Returns: Json }
      site_published_sitemap: { Args: never; Returns: Json }
      site_redirect_check: {
        Args: { p_from: string | null, p_site: string | null, p_to: string | null}
        Returns: undefined
      }
      site_redirect_delete: { Args: { p_redirect: string | null}; Returns: undefined }
      site_redirect_save: { Args: { p_redirect: Json | null}; Returns: Json }
      site_rollback: {
        Args: { p_page: string | null, p_revision: string | null}
        Returns: Json
      }
      site_settings_save: {
        Args: { p_expected_version: number | null, p_group: string | null, p_value: Json | null}
        Returns: Json
      }
      submit_for_approval: {
        Args: {          p_due_date: string | null,          p_expected_version: number | null,          p_item: string | null,          p_message: string | null}
        Returns: Json
      }
      unpublish_site_page: { Args: { p_page: string | null}; Returns: undefined }
      user_can_work_on_brand: {
        Args: { p_brand: string | null, p_user: string | null}
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
