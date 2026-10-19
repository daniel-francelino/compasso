export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      actions: {
        Row: {
          key: string
          module: string
          description: string
          admin_only: boolean
          portal: boolean
          requires: string[]
        }
        Insert: {
          key: string
          module: string
          description: string
          admin_only?: boolean
          portal?: boolean
          requires?: string[]
        }
        Update: {
          key?: string
          module?: string
          description?: string
          admin_only?: boolean
          portal?: boolean
          requires?: string[]
        }
        Relationships: [

        ]
      }
      approval_decisions: {
        Row: {
          id: string
          request_id: string
          revision_id: string
          decided_by: string
          outcome: string
          comment: string | null
          decided_at: string
        }
        Insert: {
          id?: string
          request_id: string
          revision_id: string
          decided_by: string
          outcome: string
          comment?: string | null
          decided_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          revision_id?: string
          decided_by?: string
          outcome?: string
          comment?: string | null
          decided_at?: string
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
          }
        ]
      }
      approval_requests: {
        Row: {
          id: string
          brand_id: string
          item_id: string
          revision_id: string
          approver_user_id: string
          status: string
          requested_by: string | null
          requested_at: string
          due_date: string | null
          message: string | null
          viewed_at: string | null
          decided_at: string | null
          cancelled_reason: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          item_id: string
          revision_id: string
          approver_user_id: string
          status?: string
          requested_by?: string | null
          requested_at?: string
          due_date?: string | null
          message?: string | null
          viewed_at?: string | null
          decided_at?: string | null
          cancelled_reason?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          item_id?: string
          revision_id?: string
          approver_user_id?: string
          status?: string
          requested_by?: string | null
          requested_at?: string
          due_date?: string | null
          message?: string | null
          viewed_at?: string | null
          decided_at?: string | null
          cancelled_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_item_id_brand_id_fkey"
            columns: ["brand_id","item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id","brand_id"]
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
            columns: ["item_id","revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id","item_id"]
          }
        ]
      }
      audit_events: {
        Row: {
          id: number
          organization_id: string
          brand_id: string | null
          actor_id: string | null
          actor_kind: string
          action: string
          entity_type: string
          entity_id: string | null
          metadata: Json
          request_id: string | null
          occurred_at: string
        }
        Insert: {
          id?: number
          organization_id: string
          brand_id?: string | null
          actor_id?: string | null
          actor_kind?: string
          action: string
          entity_type: string
          entity_id?: string | null
          metadata?: Json
          request_id?: string | null
          occurred_at?: string
        }
        Update: {
          id?: number
          organization_id?: string
          brand_id?: string | null
          actor_id?: string | null
          actor_kind?: string
          action?: string
          entity_type?: string
          entity_id?: string | null
          metadata?: Json
          request_id?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      brand_members: {
        Row: {
          brand_id: string
          user_id: string
          kind: string
          can_decide: boolean
          status: string
          granted_by: string | null
          granted_at: string
          revoked_at: string | null
        }
        Insert: {
          brand_id: string
          user_id: string
          kind: string
          can_decide?: boolean
          status?: string
          granted_by?: string | null
          granted_at?: string
          revoked_at?: string | null
        }
        Update: {
          brand_id?: string
          user_id?: string
          kind?: string
          can_decide?: boolean
          status?: string
          granted_by?: string | null
          granted_at?: string
          revoked_at?: string | null
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
          }
        ]
      }
      brands: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          name: string
          description: string | null
          target_audience: string | null
          tone_of_voice: string | null
          objectives: string | null
          references_notes: string | null
          visual_identity: Json
          timezone: string
          version: number
          archived_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          logo_media_version_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          client_id: string
          name: string
          description?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          objectives?: string | null
          references_notes?: string | null
          visual_identity?: Json
          timezone: string
          version?: number
          archived_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          logo_media_version_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string
          name?: string
          description?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          objectives?: string | null
          references_notes?: string | null
          visual_identity?: Json
          timezone?: string
          version?: number
          archived_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          logo_media_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brands_client_id_organization_id_fkey"
            columns: ["organization_id","client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id","organization_id"]
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
          }
        ]
      }
      calendar_notes: {
        Row: {
          id: string
          brand_id: string
          kind: string
          title: string
          description: string | null
          note_date: string
          repeat: string
          converted_item_id: string | null
          converted_at: string | null
          archived_at: string | null
          version: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          kind: string
          title: string
          description?: string | null
          note_date: string
          repeat?: string
          converted_item_id?: string | null
          converted_at?: string | null
          archived_at?: string | null
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          kind?: string
          title?: string
          description?: string | null
          note_date?: string
          repeat?: string
          converted_item_id?: string | null
          converted_at?: string | null
          archived_at?: string | null
          version?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
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
            columns: ["brand_id","converted_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id","brand_id"]
          },
          {
            foreignKeyName: "calendar_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      channels: {
        Row: {
          id: string
          brand_id: string
          platform: string
          profile_name: string
          profile_url: string | null
          external_id: string | null
          notes: string | null
          version: number
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          brand_id: string
          platform: string
          profile_name: string
          profile_url?: string | null
          external_id?: string | null
          notes?: string | null
          version?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          brand_id?: string
          platform?: string
          profile_name?: string
          profile_url?: string | null
          external_id?: string | null
          notes?: string | null
          version?: number
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          }
        ]
      }
      client_contacts: {
        Row: {
          id: string
          client_id: string
          name: string
          email: string | null
          phone: string | null
          role_title: string | null
          is_primary: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          name: string
          email?: string | null
          phone?: string | null
          role_title?: string | null
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          role_title?: string | null
          is_primary?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      clients: {
        Row: {
          id: string
          organization_id: string
          name: string
          owner_user_id: string | null
          internal_notes: string | null
          tags: string[]
          version: number
          archived_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          owner_user_id?: string | null
          internal_notes?: string | null
          tags?: string[]
          version?: number
          archived_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          owner_user_id?: string | null
          internal_notes?: string | null
          tags?: string[]
          version?: number
          archived_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
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
          }
        ]
      }
      comments: {
        Row: {
          id: string
          brand_id: string
          item_id: string
          revision_id: string | null
          author_id: string
          visibility: string
          body: string
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          item_id: string
          revision_id?: string | null
          author_id: string
          visibility: string
          body: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          item_id?: string
          revision_id?: string | null
          author_id?: string
          visibility?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
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
            columns: ["brand_id","item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id","brand_id"]
          },
          {
            foreignKeyName: "comments_revision_id_variant_id_fkey"
            columns: ["item_id","revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id","item_id"]
          }
        ]
      }
      contact_messages: {
        Row: {
          id: string
          site_id: string
          name: string
          email: string | null
          phone: string | null
          message: string
          source_slug: string | null
          consent_at: string
          status: string
          internal_note: string | null
          handled_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          name: string
          email?: string | null
          phone?: string | null
          message: string
          source_slug?: string | null
          consent_at: string
          status?: string
          internal_note?: string | null
          handled_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          name?: string
          email?: string | null
          phone?: string | null
          message?: string
          source_slug?: string | null
          consent_at?: string
          status?: string
          internal_note?: string | null
          handled_by?: string | null
          created_at?: string
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
          }
        ]
      }
      content_channels: {
        Row: {
          id: string
          brand_id: string
          content_item_id: string
          channel_id: string
          format: string
          publication_status: string
          planned_at: string | null
          planned_timezone: string | null
          caption: Json | null
          published_at: string | null
          published_url: string | null
          published_note: string | null
          published_evidence_media_version_id: string | null
          version: number
          created_at: string
          updated_at: string
          position: number
        }
        Insert: {
          id?: string
          brand_id: string
          content_item_id: string
          channel_id: string
          format: string
          publication_status?: string
          planned_at?: string | null
          planned_timezone?: string | null
          caption?: Json | null
          published_at?: string | null
          published_url?: string | null
          published_note?: string | null
          published_evidence_media_version_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          position?: number
        }
        Update: {
          id?: string
          brand_id?: string
          content_item_id?: string
          channel_id?: string
          format?: string
          publication_status?: string
          planned_at?: string | null
          planned_timezone?: string | null
          caption?: Json | null
          published_at?: string | null
          published_url?: string | null
          published_note?: string | null
          published_evidence_media_version_id?: string | null
          version?: number
          created_at?: string
          updated_at?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_variants_channel_id_brand_id_fkey"
            columns: ["brand_id","channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id","brand_id"]
          },
          {
            foreignKeyName: "content_variants_content_item_id_brand_id_fkey"
            columns: ["brand_id","content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id","brand_id"]
          },
          {
            foreignKeyName: "content_variants_published_evidence_media_version_id_fkey"
            columns: ["published_evidence_media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          }
        ]
      }
      content_items: {
        Row: {
          id: string
          brand_id: string
          title: string
          objective: string | null
          briefing: Json | null
          internal_notes: string | null
          assignee_id: string | null
          tags: string[]
          production_due_date: string | null
          version: number
          cancelled_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          objective_kind: string | null
          caption: Json | null
          call_to_action: string | null
          working_media: Json
          editorial_status: string
          approval_due_date: string | null
          current_revision_id: string | null
          approved_revision_id: string | null
        }
        Insert: {
          id?: string
          brand_id: string
          title: string
          objective?: string | null
          briefing?: Json | null
          internal_notes?: string | null
          assignee_id?: string | null
          tags?: string[]
          production_due_date?: string | null
          version?: number
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          objective_kind?: string | null
          caption?: Json | null
          call_to_action?: string | null
          working_media?: Json
          editorial_status?: string
          approval_due_date?: string | null
          current_revision_id?: string | null
          approved_revision_id?: string | null
        }
        Update: {
          id?: string
          brand_id?: string
          title?: string
          objective?: string | null
          briefing?: Json | null
          internal_notes?: string | null
          assignee_id?: string | null
          tags?: string[]
          production_due_date?: string | null
          version?: number
          cancelled_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          objective_kind?: string | null
          caption?: Json | null
          call_to_action?: string | null
          working_media?: Json
          editorial_status?: string
          approval_due_date?: string | null
          current_revision_id?: string | null
          approved_revision_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_approved_revision_id_id_fkey"
            columns: ["id","approved_revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id","item_id"]
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
            columns: ["id","current_revision_id"]
            isOneToOne: false
            referencedRelation: "content_revisions"
            referencedColumns: ["id","item_id"]
          }
        ]
      }
      content_revision_media: {
        Row: {
          revision_id: string
          media_version_id: string
          position: number
          alt_text: string | null
        }
        Insert: {
          revision_id: string
          media_version_id: string
          position: number
          alt_text?: string | null
        }
        Update: {
          revision_id?: string
          media_version_id?: string
          position?: number
          alt_text?: string | null
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
          }
        ]
      }
      content_revisions: {
        Row: {
          id: string
          item_id: string
          brand_id: string
          revision_no: number
          snapshot: Json
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          brand_id: string
          revision_no: number
          snapshot: Json
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          brand_id?: string
          revision_no?: number
          snapshot?: Json
          created_by?: string | null
          created_at?: string
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
            columns: ["item_id","brand_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id","brand_id"]
          }
        ]
      }
      email_outbox: {
        Row: {
          id: string
          to_email: string
          template: string
          payload: Json
          status: string
          attempts: number
          last_error: string | null
          next_attempt_at: string
          created_at: string
        }
        Insert: {
          id?: string
          to_email: string
          template: string
          payload: Json
          status?: string
          attempts?: number
          last_error?: string | null
          next_attempt_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          to_email?: string
          template?: string
          payload?: Json
          status?: string
          attempts?: number
          last_error?: string | null
          next_attempt_at?: string
          created_at?: string
        }
        Relationships: [

        ]
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role_id: string
          grants: Json
          token_hash: string
          status: string
          expires_at: string
          invited_by: string | null
          accepted_by: string | null
          accepted_at: string | null
          revoked_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          email: string
          role_id: string
          grants?: Json
          token_hash: string
          status?: string
          expires_at: string
          invited_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          email?: string
          role_id?: string
          grants?: Json
          token_hash?: string
          status?: string
          expires_at?: string
          invited_by?: string | null
          accepted_by?: string | null
          accepted_at?: string | null
          revoked_at?: string | null
          created_at?: string
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
          }
        ]
      }
      media_assets: {
        Row: {
          id: string
          organization_id: string
          scope: string
          brand_id: string | null
          display_name: string
          tags: string[]
          current_version_id: string | null
          size_bytes: number
          version: number
          trashed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          scope: string
          brand_id?: string | null
          display_name: string
          tags?: string[]
          current_version_id?: string | null
          size_bytes?: number
          version?: number
          trashed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          scope?: string
          brand_id?: string | null
          display_name?: string
          tags?: string[]
          current_version_id?: string | null
          size_bytes?: number
          version?: number
          trashed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
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
          }
        ]
      }
      media_collection_items: {
        Row: {
          collection_id: string
          asset_id: string
        }
        Insert: {
          collection_id: string
          asset_id: string
        }
        Update: {
          collection_id?: string
          asset_id?: string
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
          }
        ]
      }
      media_collections: {
        Row: {
          id: string
          organization_id: string
          scope: string
          brand_id: string | null
          parent_id: string | null
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          scope: string
          brand_id?: string | null
          parent_id?: string | null
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          scope?: string
          brand_id?: string | null
          parent_id?: string | null
          name?: string
          created_at?: string
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
          }
        ]
      }
      media_share_events: {
        Row: {
          id: number
          share_id: string
          type: string
          asset_id: string | null
          created_at: string
        }
        Insert: {
          id?: number
          share_id: string
          type: string
          asset_id?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          share_id?: string
          type?: string
          asset_id?: string | null
          created_at?: string
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
          }
        ]
      }
      media_share_grants: {
        Row: {
          id: string
          share_id: string
          token_hash: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          share_id: string
          token_hash: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          share_id?: string
          token_hash?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_share_grants_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "media_shares"
            referencedColumns: ["id"]
          }
        ]
      }
      media_shares: {
        Row: {
          id: string
          token: string
          organization_id: string
          scope: string
          brand_id: string | null
          label: string
          message: string | null
          asset_id: string | null
          pinned_version_id: string | null
          collection_id: string | null
          include_subcollections: boolean
          allow_download: boolean
          expires_at: string | null
          password_hash: string | null
          has_password: boolean | null
          max_downloads: number | null
          download_count: number
          failed_attempts: number
          locked_until: string | null
          status: string
          created_by: string | null
          created_at: string
          revoked_at: string | null
          last_accessed_at: string | null
        }
        Insert: {
          id?: string
          token?: string
          organization_id: string
          scope: string
          brand_id?: string | null
          label: string
          message?: string | null
          asset_id?: string | null
          pinned_version_id?: string | null
          collection_id?: string | null
          include_subcollections?: boolean
          allow_download?: boolean
          expires_at?: string | null
          password_hash?: string | null
          has_password?: boolean | null
          max_downloads?: number | null
          download_count?: number
          failed_attempts?: number
          locked_until?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          revoked_at?: string | null
          last_accessed_at?: string | null
        }
        Update: {
          id?: string
          token?: string
          organization_id?: string
          scope?: string
          brand_id?: string | null
          label?: string
          message?: string | null
          asset_id?: string | null
          pinned_version_id?: string | null
          collection_id?: string | null
          include_subcollections?: boolean
          allow_download?: boolean
          expires_at?: string | null
          password_hash?: string | null
          has_password?: boolean | null
          max_downloads?: number | null
          download_count?: number
          failed_attempts?: number
          locked_until?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          revoked_at?: string | null
          last_accessed_at?: string | null
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
          }
        ]
      }
      media_upload_sessions: {
        Row: {
          id: string
          version_id: string
          author_id: string
          purpose: string
          reserved_bytes: number
          status: string
          idempotency_key: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          version_id: string
          author_id: string
          purpose: string
          reserved_bytes: number
          status?: string
          idempotency_key: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          version_id?: string
          author_id?: string
          purpose?: string
          reserved_bytes?: number
          status?: string
          idempotency_key?: string
          expires_at?: string
          created_at?: string
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
          }
        ]
      }
      media_usages: {
        Row: {
          id: string
          media_version_id: string
          usage_type: string
          usage_ref_id: string
          alt_text: string | null
          created_at: string
        }
        Insert: {
          id?: string
          media_version_id: string
          usage_type: string
          usage_ref_id: string
          alt_text?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          media_version_id?: string
          usage_type?: string
          usage_ref_id?: string
          alt_text?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_usages_media_version_id_fkey"
            columns: ["media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          }
        ]
      }
      media_versions: {
        Row: {
          id: string
          asset_id: string
          version_no: number
          storage_key: string
          thumb_key: string | null
          display_key: string | null
          original_filename: string
          mime_type: string
          size_bytes: number
          derivative_bytes: number
          width: number | null
          height: number | null
          duration_ms: number | null
          checksum: string | null
          status: string
          failure_reason: string | null
          public_published_at: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          asset_id: string
          version_no: number
          storage_key: string
          thumb_key?: string | null
          display_key?: string | null
          original_filename: string
          mime_type: string
          size_bytes: number
          derivative_bytes?: number
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          checksum?: string | null
          status?: string
          failure_reason?: string | null
          public_published_at?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          asset_id?: string
          version_no?: number
          storage_key?: string
          thumb_key?: string | null
          display_key?: string | null
          original_filename?: string
          mime_type?: string
          size_bytes?: number
          derivative_bytes?: number
          width?: number | null
          height?: number | null
          duration_ms?: number | null
          checksum?: string | null
          status?: string
          failure_reason?: string | null
          public_published_at?: string | null
          uploaded_by?: string | null
          created_at?: string
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
          }
        ]
      }
      notification_kinds: {
        Row: {
          kind: string
          title: string
          required_action: string
          severity: string
          default_lead_days: number[] | null
          schedulable: boolean
          portal: boolean
          default_email: boolean
          available: boolean
        }
        Insert: {
          kind: string
          title: string
          required_action: string
          severity?: string
          default_lead_days?: number[] | null
          schedulable?: boolean
          portal?: boolean
          default_email?: boolean
          available?: boolean
        }
        Update: {
          kind?: string
          title?: string
          required_action?: string
          severity?: string
          default_lead_days?: number[] | null
          schedulable?: boolean
          portal?: boolean
          default_email?: boolean
          available?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_kinds_required_action_fkey"
            columns: ["required_action"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["key"]
          }
        ]
      }
      notification_preferences: {
        Row: {
          user_id: string
          kind: string
          enabled: boolean
          email: boolean
          lead_days: number[] | null
        }
        Insert: {
          user_id: string
          kind: string
          enabled?: boolean
          email?: boolean
          lead_days?: number[] | null
        }
        Update: {
          user_id?: string
          kind?: string
          enabled?: boolean
          email?: boolean
          lead_days?: number[] | null
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
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          kind: string
          brand_id: string | null
          title: string
          body: string | null
          link: string | null
          ref_type: string | null
          ref_id: string | null
          severity: string
          status: string
          dedupe_key: string
          read_at: string | null
          snoozed_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          brand_id?: string | null
          title: string
          body?: string | null
          link?: string | null
          ref_type?: string | null
          ref_id?: string | null
          severity?: string
          status?: string
          dedupe_key: string
          read_at?: string | null
          snoozed_until?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          kind?: string
          brand_id?: string | null
          title?: string
          body?: string | null
          link?: string | null
          ref_type?: string | null
          ref_id?: string | null
          severity?: string
          status?: string
          dedupe_key?: string
          read_at?: string | null
          snoozed_until?: string | null
          created_at?: string
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
          }
        ]
      }
      organization_settings: {
        Row: {
          key: string
          value: Json
          version: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value: Json
          version?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          version?: number
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      organizations: {
        Row: {
          id: string
          name: string
          legal_name: string | null
          tax_id: string | null
          default_timezone: string
          logo_media_version_id: string | null
          contact_email: string | null
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          legal_name?: string | null
          tax_id?: string | null
          default_timezone?: string
          logo_media_version_id?: string | null
          contact_email?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          legal_name?: string | null
          tax_id?: string | null
          default_timezone?: string
          logo_media_version_id?: string | null
          contact_email?: string | null
          version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_logo_media_version_fkey"
            columns: ["logo_media_version_id"]
            isOneToOne: false
            referencedRelation: "media_versions"
            referencedColumns: ["id"]
          }
        ]
      }
      profile_audit: {
        Row: {
          id: number
          actor_id: string | null
          profile_id: string
          action: string
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          profile_id: string
          action: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          profile_id?: string
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Relationships: [

        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          status: string
          kind: string
          role_id: string | null
          locale: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          status?: string
          kind?: string
          role_id?: string | null
          locale?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          status?: string
          kind?: string
          role_id?: string | null
          locale?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          }
        ]
      }
      role_actions: {
        Row: {
          role_id: string
          action_key: string
        }
        Insert: {
          role_id: string
          action_key: string
        }
        Update: {
          role_id?: string
          action_key?: string
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
          }
        ]
      }
      role_audit: {
        Row: {
          id: number
          actor_id: string | null
          role_id: string | null
          action: string
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          role_id?: string | null
          action: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          role_id?: string | null
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Relationships: [

        ]
      }
      roles: {
        Row: {
          id: string
          key: string
          name: string
          description: string | null
          is_system: boolean
          portal_only: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          name: string
          description?: string | null
          is_system?: boolean
          portal_only?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          name?: string
          description?: string | null
          is_system?: boolean
          portal_only?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [

        ]
      }
      site_case_study_authorizations: {
        Row: {
          id: string
          page_id: string
          brand_id: string
          authorized_by: string
          authorized_at: string
          consent_note: string
          withdrawn_at: string | null
          withdrawn_by: string | null
        }
        Insert: {
          id?: string
          page_id: string
          brand_id: string
          authorized_by: string
          authorized_at?: string
          consent_note: string
          withdrawn_at?: string | null
          withdrawn_by?: string | null
        }
        Update: {
          id?: string
          page_id?: string
          brand_id?: string
          authorized_by?: string
          authorized_at?: string
          consent_note?: string
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
          }
        ]
      }
      site_entries: {
        Row: {
          id: string
          site_id: string
          kind: string
          content: Json
          sort_order: number
          visible: boolean
          version: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          site_id: string
          kind: string
          content: Json
          sort_order?: number
          visible?: boolean
          version?: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          kind?: string
          content?: Json
          sort_order?: number
          visible?: boolean
          version?: number
          updated_by?: string | null
          updated_at?: string
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
          }
        ]
      }
      site_page_revisions: {
        Row: {
          id: string
          page_id: string
          revision_no: number
          content: Json
          note: string | null
          published_by: string | null
          published_at: string
          live_from: string | null
          cancelled_at: string | null
          source_revision_id: string | null
        }
        Insert: {
          id?: string
          page_id: string
          revision_no: number
          content: Json
          note?: string | null
          published_by?: string | null
          published_at?: string
          live_from?: string | null
          cancelled_at?: string | null
          source_revision_id?: string | null
        }
        Update: {
          id?: string
          page_id?: string
          revision_no?: number
          content?: Json
          note?: string | null
          published_by?: string | null
          published_at?: string
          live_from?: string | null
          cancelled_at?: string | null
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
          }
        ]
      }
      site_pages: {
        Row: {
          id: string
          site_id: string
          kind: string
          slug: string
          status: string
          draft_content: Json
          published_revision_id: string | null
          is_system: boolean
          version: number
          updated_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          site_id: string
          kind: string
          slug: string
          status?: string
          draft_content?: Json
          published_revision_id?: string | null
          is_system?: boolean
          version?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          kind?: string
          slug?: string
          status?: string
          draft_content?: Json
          published_revision_id?: string | null
          is_system?: boolean
          version?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
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
          }
        ]
      }
      site_redirects: {
        Row: {
          id: string
          site_id: string
          from_path: string
          to_path: string
          permanent: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          site_id: string
          from_path: string
          to_path: string
          permanent?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          site_id?: string
          from_path?: string
          to_path?: string
          permanent?: boolean
          created_by?: string | null
          created_at?: string
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
          }
        ]
      }
      sites: {
        Row: {
          id: string
          organization_id: string
          name: string
          settings: Json
          settings_version: number
          published_settings: Json | null
          published_settings_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          settings?: Json
          settings_version?: number
          published_settings?: Json | null
          published_settings_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          settings?: Json
          settings_version?: number
          published_settings?: Json | null
          published_settings_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      accept_invitation: {
        Args: { p_token_hash: string | null }
        Returns: Json
      }
      approver_is_valid: {
        Args: { p_brand: string | null; p_user: string | null }
        Returns: boolean
      }
      approver_options: {
        Args: { p_brand: string | null }
        Returns: Json
      }
      assert_action: {
        Args: { p_action: string | null }
        Returns: undefined
      }
      assert_brand_access: {
        Args: { p_brand: string | null }
        Returns: undefined
      }
      audit_list: {
        Args: { p_filters: Json | null; p_page: number | null; p_export?: boolean | null }
        Returns: Json
      }
      audit_write: {
        Args: { p_org: string | null; p_brand: string | null; p_action: string | null; p_entity_type: string | null; p_entity_id: string | null; p_metadata: Json | null }
        Returns: undefined
      }
      brand_delete: {
        Args: { p_brand: string | null }
        Returns: undefined
      }
      brand_has_history: {
        Args: { p_brand: string | null }
        Returns: boolean
      }
      brand_logo_keys: {
        Args: { p_brands: string[] | null }
        Returns: { brand_id: string; thumb_key: string }[]
      }
      brand_member_set: {
        Args: { p_brand: string | null; p_user: string | null; p_kind: string | null; p_can_decide: boolean | null; p_status: string | null }
        Returns: undefined
      }
      brand_save: {
        Args: { p_brand: Json | null }
        Returns: Json
      }
      brand_set_archived: {
        Args: { p_brand: string | null; p_archived: boolean | null }
        Returns: Json
      }
      brand_set_logo: {
        Args: { p_brand: string | null; p_version: string | null }
        Returns: Json
      }
      calendar_note_archive: {
        Args: { p_note: string | null }
        Returns: undefined
      }
      calendar_note_get: {
        Args: { p_note: string | null }
        Returns: Json
      }
      calendar_note_save: {
        Args: { p_note: Json | null }
        Returns: Json
      }
      calendar_range_ok: {
        Args: { p_from: string | null; p_to: string | null }
        Returns: boolean
      }
      can_access_brand: {
        Args: { p_brand: string | null }
        Returns: boolean
      }
      can_view_client: {
        Args: { p_client: string | null }
        Returns: boolean
      }
      can_view_media_asset: {
        Args: { p_asset: string | null }
        Returns: boolean
      }
      cancel_request: {
        Args: { p_request: string | null; p_reason: string | null }
        Returns: undefined
      }
      channel_delete: {
        Args: { p_channel: string | null }
        Returns: undefined
      }
      channel_is_used: {
        Args: { p_channel: string | null }
        Returns: boolean
      }
      channel_save: {
        Args: { p_channel: Json | null }
        Returns: Json
      }
      channel_set_archived: {
        Args: { p_channel: string | null; p_archived: boolean | null }
        Returns: Json
      }
      client_contact_delete: {
        Args: { p_contact: string | null }
        Returns: undefined
      }
      client_contact_save: {
        Args: { p_contact: Json | null }
        Returns: Json
      }
      client_delete: {
        Args: { p_client: string | null }
        Returns: undefined
      }
      client_save: {
        Args: { p_client: Json | null; p_create_brand?: boolean | null }
        Returns: Json
      }
      client_set_archived: {
        Args: { p_client: string | null; p_archived: boolean | null; p_archive_brands?: boolean | null }
        Returns: Json
      }
      comment_add: {
        Args: { p_item: string | null; p_visibility: string | null; p_body: string | null }
        Returns: Json
      }
      comment_delete: {
        Args: { p_comment: string | null }
        Returns: undefined
      }
      comment_list: {
        Args: { p_item: string | null }
        Returns: Json
      }
      content_cancel_pending_requests: {
        Args: { p_item: string | null; p_reason: string | null }
        Returns: undefined
      }
      content_channel_cancel: {
        Args: { p_channel_row: string | null; p_reason: string | null }
        Returns: undefined
      }
      content_channels_signature: {
        Args: { p_item: string | null }
        Returns: Json
      }
      content_check_channel: {
        Args: { p_brand: string | null; p_channel: string | null }
        Returns: undefined
      }
      content_check_media: {
        Args: { p_brand: string | null; p_media: Json | null }
        Returns: undefined
      }
      content_item_cancel: {
        Args: { p_item: string | null; p_reason: string | null }
        Returns: undefined
      }
      content_item_delete: {
        Args: { p_item: string | null }
        Returns: undefined
      }
      content_item_is_ready: {
        Args: { p_item: string | null }
        Returns: boolean
      }
      content_item_save: {
        Args: { p_item: Json | null }
        Returns: Json
      }
      content_move: {
        Args: { p_item: string | null; p_to_status: string | null; p_expected_version: number | null }
        Returns: Json
      }
      content_normalize_media: {
        Args: { p_media: Json | null }
        Returns: Json
      }
      current_organization_id: {
        Args: never
        Returns: string
      }
      dashboard_attention: {
        Args: { p_brands?: string[] | null }
        Returns: Json
      }
      dashboard_my_items: {
        Args: never
        Returns: Json
      }
      dashboard_status_counts: {
        Args: { p_brands?: string[] | null }
        Returns: Json
      }
      editorial_transition_allowed: {
        Args: { p_from: string | null; p_to: string | null }
        Returns: boolean
      }
      generate_due_notifications: {
        Args: never
        Returns: Json
      }
      has_action: {
        Args: { p_action: string | null }
        Returns: boolean
      }
      invitation_create: {
        Args: { p_email: string | null; p_role: string | null; p_grants: Json | null; p_token_hash: string | null; p_expires_at: string | null }
        Returns: Json
      }
      invitation_revoke: {
        Args: { p_invitation: string | null }
        Returns: undefined
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
      is_external_brand_member: {
        Args: { p_brand: string | null; p_must_decide?: boolean | null }
        Returns: boolean
      }
      list_calendar_entries: {
        Args: { p_from: string | null; p_to: string | null; p_brands?: string[] | null; p_channels?: string[] | null; p_assignee?: string | null; p_editorial?: string[] | null; p_publication?: string[] | null; p_notes?: string[] | null }
        Returns: Json
      }
      mark_published: {
        Args: { p_channel_row: string | null; p_published_at: string | null; p_url: string | null; p_evidence_media_version: string | null; p_note: string | null }
        Returns: Json
      }
      media_assert_asset_access: {
        Args: { p_asset: string | null }
        Returns: string
      }
      media_collection_delete: {
        Args: { p_collection: string | null }
        Returns: undefined
      }
      media_collection_move_items: {
        Args: { p_collection: string | null; p_assets: string[] | null }
        Returns: undefined
      }
      media_collection_save: {
        Args: { p_collection: Json | null }
        Returns: Json
      }
      media_confirm_upload: {
        Args: { p_version: string | null; p_checksum: string | null; p_width: number | null; p_height: number | null; p_duration: number | null; p_derivative_bytes?: number | null }
        Returns: Json
      }
      media_delete_permanently: {
        Args: { p_asset: string | null }
        Returns: Json
      }
      media_expire_sessions: {
        Args: never
        Returns: Json
      }
      media_mark_failed: {
        Args: { p_version: string | null; p_reason: string | null }
        Returns: Json
      }
      media_policy_mb: {
        Args: { p_name: string | null; p_default: number | null }
        Returns: number
      }
      media_publish_derivative: {
        Args: { p_version: string | null }
        Returns: Json
      }
      media_replace_version: {
        Args: { p_asset: string | null; p_version: string | null }
        Returns: Json
      }
      media_request_upload: {
        Args: { p_scope: string | null; p_brand: string | null; p_filename: string | null; p_size: number | null; p_mime: string | null; p_idempotency_key: string | null; p_asset?: string | null }
        Returns: Json
      }
      media_set_trashed: {
        Args: { p_asset: string | null; p_trashed: boolean | null }
        Returns: Json
      }
      media_share_assert_scope: {
        Args: { p_scope: string | null; p_brand: string | null }
        Returns: undefined
      }
      media_share_create: {
        Args: { p_input: Json | null }
        Returns: Json
      }
      media_share_files: {
        Args: { p_share: string | null }
        Returns: { asset_id: string; version_id: string; title: string; filename: string; mime: string; size_bytes: number; width: number; height: number; storage_key: string; thumb_key: string; display_key: string }[]
      }
      media_share_gate: {
        Args: { p_token: string | null; p_grant: string | null }
        Returns: string
      }
      media_share_list: {
        Args: { p_kind: string | null; p_target: string | null }
        Returns: Json
      }
      media_share_public_file: {
        Args: { p_token: string | null; p_grant: string | null; p_asset: string | null; p_mode: string | null }
        Returns: Json
      }
      media_share_public_open: {
        Args: { p_token: string | null; p_grant: string | null }
        Returns: Json
      }
      media_share_public_unlock: {
        Args: { p_token: string | null; p_password: string | null }
        Returns: Json
      }
      media_share_revoke: {
        Args: { p_share: string | null }
        Returns: undefined
      }
      media_share_targets: {
        Args: never
        Returns: Json
      }
      media_share_update: {
        Args: { p_input: Json | null }
        Returns: undefined
      }
      media_storage_keys: {
        Args: never
        Returns: Json
      }
      media_storage_summary: {
        Args: never
        Returns: Json
      }
      media_storage_used: {
        Args: never
        Returns: number
      }
      media_update: {
        Args: { p_asset: Json | null }
        Returns: Json
      }
      media_version_in_use: {
        Args: { p_version: string | null }
        Returns: boolean
      }
      media_withdraw_derivative: {
        Args: { p_version: string | null }
        Returns: Json
      }
      my_actions: {
        Args: never
        Returns: string[]
      }
      notification_date_text: {
        Args: { p_date: string | null }
        Returns: string
      }
      notification_kind_save: {
        Args: { p_kind: string | null; p_default_lead_days: number[] | null; p_default_email: boolean | null }
        Returns: undefined
      }
      notification_lead_days: {
        Args: { p_user: string | null; p_kind: string | null }
        Returns: number[]
      }
      notify_scan_content: {
        Args: never
        Returns: undefined
      }
      notify_scan_invitations: {
        Args: never
        Returns: undefined
      }
      notify_users: {
        Args: { p_kind: string | null; p_brand: string | null; p_title: string | null; p_body: string | null; p_link: string | null; p_ref_type: string | null; p_ref_id: string | null; p_dedupe_key: string | null; p_recipients?: string[] | null }
        Returns: undefined
      }
      organization_save: {
        Args: { p_organization: Json | null }
        Returns: Json
      }
      organization_setting_save: {
        Args: { p_key: string | null; p_value: Json | null; p_expected_version: number | null }
        Returns: Json
      }
      person_names: {
        Args: { p_ids: string[] | null }
        Returns: Json
      }
      portal_add_comment: {
        Args: { p_item: string | null; p_body: string | null }
        Returns: Json
      }
      portal_assert_member: {
        Args: { p_brand: string | null }
        Returns: undefined
      }
      portal_brand_logo_keys: {
        Args: { p_brands: string[] | null }
        Returns: { brand_id: string; thumb_key: string }[]
      }
      portal_decide_approval: {
        Args: { p_request: string | null; p_outcome: string | null; p_comment: string | null }
        Returns: Json
      }
      portal_get_approval: {
        Args: { p_request: string | null }
        Returns: Json
      }
      portal_get_brand: {
        Args: { p_brand: string | null }
        Returns: Json
      }
      portal_list_approvals: {
        Args: { p_brand: string | null; p_status: string | null; p_page: number | null; p_page_size: number | null }
        Returns: Json
      }
      portal_list_brands: {
        Args: never
        Returns: Json
      }
      portal_list_calendar: {
        Args: { p_brand: string | null; p_from: string | null; p_to: string | null }
        Returns: Json
      }
      portal_list_comments: {
        Args: { p_item: string | null }
        Returns: Json
      }
      portal_list_pending: {
        Args: { p_brand: string | null }
        Returns: Json
      }
      portal_media_urls: {
        Args: { p_revision: string | null; p_version_ids: string[] | null }
        Returns: Json
      }
      portal_record_view: {
        Args: { p_request: string | null }
        Returns: undefined
      }
      portal_request_row: {
        Args: { p_request: string | null }
        Returns: Json
      }
      profile_set_access: {
        Args: { p_profile: string | null; p_status: string | null; p_role?: string | null }
        Returns: undefined
      }
      publish_site_page: {
        Args: { p_page: string | null; p_note: string | null; p_resolved: Json | null; p_expected_hash: string | null }
        Returns: Json
      }
      publish_site_settings: {
        Args: { p_resolved: Json | null; p_expected_version: number | null }
        Returns: Json
      }
      reassign_approver: {
        Args: { p_request: string | null; p_new_approver: string | null }
        Returns: Json
      }
      reopen_content: {
        Args: { p_item: string | null; p_reason: string | null }
        Returns: Json
      }
      reschedule_channel: {
        Args: { p_channel_row: string | null; p_planned_at: string | null; p_timezone: string | null; p_expected_version: number | null }
        Returns: Json
      }
      reschedule_production_deadline: {
        Args: { p_item: string | null; p_date: string | null; p_expected_version: number | null }
        Returns: Json
      }
      resolve_notifications: {
        Args: { p_ref_type: string | null; p_ref_id: string | null }
        Returns: undefined
      }
      role_delete: {
        Args: { p_role: string | null }
        Returns: undefined
      }
      role_save: {
        Args: { p_role: Json | null }
        Returns: Json
      }
      send_approval_reminder: {
        Args: { p_request: string | null }
        Returns: undefined
      }
      site_case_study_authorize: {
        Args: { p_page: string | null; p_brand: string | null; p_consent_note: string | null }
        Returns: undefined
      }
      site_case_study_withdraw: {
        Args: { p_page: string | null }
        Returns: undefined
      }
      site_contact_submit: {
        Args: { p_site: string | null; p_payload: Json | null }
        Returns: undefined
      }
      site_contact_update: {
        Args: { p_message: string | null; p_status: string | null; p_note: string | null }
        Returns: undefined
      }
      site_draft_snapshot: {
        Args: { p_page: string | null }
        Returns: Json
      }
      site_ensure: {
        Args: never
        Returns: string
      }
      site_entry_delete: {
        Args: { p_entry: string | null }
        Returns: undefined
      }
      site_entry_save: {
        Args: { p_entry: Json | null }
        Returns: Json
      }
      site_media_ids: {
        Args: { p_content: Json | null }
        Returns: string[]
      }
      site_media_in_use: {
        Args: { p_version: string | null }
        Returns: boolean
      }
      site_media_info: {
        Args: { p_ids: string[] | null }
        Returns: Json
      }
      site_overview: {
        Args: never
        Returns: Json
      }
      site_page_delete: {
        Args: { p_page: string | null }
        Returns: undefined
      }
      site_page_save: {
        Args: { p_page: Json | null; p_expected_version?: number | null }
        Returns: Json
      }
      site_pages_overview: {
        Args: never
        Returns: Json
      }
      site_publish_page_row: {
        Args: { p_page: string | null; p_resolved: Json | null; p_note: string | null; p_source: string | null }
        Returns: number
      }
      site_published_page: {
        Args: { p_slug: string | null }
        Returns: Json
      }
      site_published_settings: {
        Args: never
        Returns: Json
      }
      site_published_sitemap: {
        Args: never
        Returns: Json
      }
      site_redirect_check: {
        Args: { p_site: string | null; p_from: string | null; p_to: string | null }
        Returns: undefined
      }
      site_redirect_delete: {
        Args: { p_redirect: string | null }
        Returns: undefined
      }
      site_redirect_save: {
        Args: { p_redirect: Json | null }
        Returns: Json
      }
      site_rollback: {
        Args: { p_page: string | null; p_revision: string | null }
        Returns: Json
      }
      site_settings_save: {
        Args: { p_group: string | null; p_value: Json | null; p_expected_version: number | null }
        Returns: Json
      }
      submit_for_approval: {
        Args: { p_item: string | null; p_approver: string | null; p_due_date: string | null; p_message: string | null; p_expected_version: number | null }
        Returns: Json
      }
      unpublish_site_page: {
        Args: { p_page: string | null }
        Returns: undefined
      }
      user_can_work_on_brand: {
        Args: { p_user: string | null; p_brand: string | null }
        Returns: boolean
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
