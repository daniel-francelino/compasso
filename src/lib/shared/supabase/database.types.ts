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
      audit_write: {
        Args: { p_org: string | null; p_brand: string | null; p_action: string | null; p_entity_type: string | null; p_entity_id: string | null; p_metadata: Json | null }
        Returns: undefined
      }
      has_action: {
        Args: { p_action: string | null }
        Returns: boolean
      }
      is_admin: {
        Args: never
        Returns: boolean
      }
      my_actions: {
        Args: never
        Returns: string[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
