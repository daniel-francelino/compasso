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
    }
    Views: { [_ in never]: never }
    Functions: {
      accept_invitation: {
        Args: { p_token_hash: string | null }
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
      can_access_brand: {
        Args: { p_brand: string | null }
        Returns: boolean
      }
      can_view_client: {
        Args: { p_client: string | null }
        Returns: boolean
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
      current_organization_id: {
        Args: never
        Returns: string
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
      my_actions: {
        Args: never
        Returns: string[]
      }
      notification_kind_save: {
        Args: { p_kind: string | null; p_default_lead_days: number[] | null; p_default_email: boolean | null }
        Returns: undefined
      }
      notification_lead_days: {
        Args: { p_user: string | null; p_kind: string | null }
        Returns: number[]
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
      profile_set_access: {
        Args: { p_profile: string | null; p_status: string | null; p_role?: string | null }
        Returns: undefined
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
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
