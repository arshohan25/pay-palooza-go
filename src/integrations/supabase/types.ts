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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_approval_requests: {
        Row: {
          action_type: string
          created_at: string
          decision_notes: string | null
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          decision_notes?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          payload?: Json
          reason: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          decision_notes?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_brand_settings: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          is_active: boolean
          setting_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          setting_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_bulk_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          reason: string
          requested_by: string
          result: Json
          rollback_payload: Json
          status: string
          target_segment_id: string | null
          target_user_ids: string[]
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          reason: string
          requested_by?: string
          result?: Json
          rollback_payload?: Json
          status?: string
          target_segment_id?: string | null
          target_user_ids?: string[]
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          reason?: string
          requested_by?: string
          result?: Json
          rollback_payload?: Json
          status?: string
          target_segment_id?: string | null
          target_user_ids?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      admin_canned_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          label: string
          sort_order: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      admin_dashboard_layouts: {
        Row: {
          created_at: string
          department: string
          favorite_modules: string[]
          id: string
          layout: Json
          owner_user_id: string
          role_key: string | null
          saved_filters: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          favorite_modules?: string[]
          id?: string
          layout?: Json
          owner_user_id?: string
          role_key?: string | null
          saved_filters?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          favorite_modules?: string[]
          id?: string
          layout?: Json
          owner_user_id?: string
          role_key?: string | null
          saved_filters?: Json
          updated_at?: string
        }
        Relationships: []
      }
      admin_evidence_vault: {
        Row: {
          case_title: string
          case_type: string
          created_at: string
          created_by: string
          evidence_hash: string | null
          evidence_type: string
          id: string
          notes: string | null
          related_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_title: string
          case_type?: string
          created_at?: string
          created_by?: string
          evidence_hash?: string | null
          evidence_type?: string
          id?: string
          notes?: string | null
          related_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_title?: string
          case_type?: string
          created_at?: string
          created_by?: string
          evidence_hash?: string | null
          evidence_type?: string
          id?: string
          notes?: string | null
          related_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_launch_calendar: {
        Row: {
          business_impact: string | null
          created_at: string
          created_by: string
          dependency_status: string
          feature_key: string
          id: string
          launch_notes: string | null
          live_date: string | null
          owner: string | null
          preview_date: string | null
          rollback_plan: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          business_impact?: string | null
          created_at?: string
          created_by?: string
          dependency_status?: string
          feature_key: string
          id?: string
          launch_notes?: string | null
          live_date?: string | null
          owner?: string | null
          preview_date?: string | null
          rollback_plan?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          business_impact?: string | null
          created_at?: string
          created_by?: string
          dependency_status?: string
          feature_key?: string
          id?: string
          launch_notes?: string | null
          live_date?: string | null
          owner?: string | null
          preview_date?: string | null
          rollback_plan?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_notifications: {
        Row: {
          admin_id: string
          body: string
          category: string
          created_at: string
          id: string
          metadata: Json | null
          sent_count: number | null
          target_area: string | null
          target_roles: string[] | null
          target_user: string | null
          title: string
        }
        Insert: {
          admin_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sent_count?: number | null
          target_area?: string | null
          target_roles?: string[] | null
          target_user?: string | null
          title: string
        }
        Update: {
          admin_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sent_count?: number | null
          target_area?: string | null
          target_roles?: string[] | null
          target_user?: string | null
          title?: string
        }
        Relationships: []
      }
      admin_security_policies: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          name: string
          policy_key: string
          settings: Json
          severity: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name: string
          policy_key: string
          settings?: Json
          severity?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          name?: string
          policy_key?: string
          settings?: Json
          severity?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_sensitive_access_logs: {
        Row: {
          actor_id: string
          created_at: string
          data_type: string
          id: string
          metadata: Json
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string
          created_at?: string
          data_type: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          data_type?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_user_notes: {
        Row: {
          assigned_staff_id: string | null
          created_at: string
          created_by: string
          follow_up_at: string | null
          id: string
          note: string
          note_type: string
          status: string
          target_user_id: string
          updated_at: string
        }
        Insert: {
          assigned_staff_id?: string | null
          created_at?: string
          created_by?: string
          follow_up_at?: string | null
          id?: string
          note: string
          note_type?: string
          status?: string
          target_user_id: string
          updated_at?: string
        }
        Update: {
          assigned_staff_id?: string | null
          created_at?: string
          created_by?: string
          follow_up_at?: string | null
          id?: string
          note?: string
          note_type?: string
          status?: string
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_segments: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          estimated_count: number
          id: string
          name: string
          rules: Json
          segment_key: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_count?: number
          id?: string
          name: string
          rules?: Json
          segment_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          estimated_count?: number
          id?: string
          name?: string
          rules?: Json
          segment_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      agent_ratings: {
        Row: {
          agent_id: string
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_ratings_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          activated_at: string | null
          address: string | null
          avg_rating: number | null
          business_name: string | null
          commission_earned: number
          created_at: string
          customers_onboarded: number
          distributor_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          max_float: number
          nid_number: string | null
          status: Database["public"]["Enums"]["agent_status"]
          territory_code: string | null
          total_ratings: number | null
          trade_license: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          address?: string | null
          avg_rating?: number | null
          business_name?: string | null
          commission_earned?: number
          created_at?: string
          customers_onboarded?: number
          distributor_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_float?: number
          nid_number?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory_code?: string | null
          total_ratings?: number | null
          trade_license?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          address?: string | null
          avg_rating?: number | null
          business_name?: string | null
          commission_earned?: number
          created_at?: string
          customers_onboarded?: number
          distributor_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          max_float?: number
          nid_number?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory_code?: string | null
          total_ratings?: number | null
          trade_license?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_auto_rewards: {
        Row: {
          claimed_at: string | null
          created_at: string
          description: string | null
          details: Json | null
          expires_at: string | null
          id: string
          reward_type: string
          segment: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          details?: Json | null
          expires_at?: string | null
          id?: string
          reward_type?: string
          segment?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          description?: string | null
          details?: Json | null
          expires_at?: string | null
          id?: string
          reward_type?: string
          segment?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aml_rules: {
        Row: {
          action: string
          condition_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          rule_name: string
          threshold: number
          time_window_minutes: number | null
          trigger_count: number
          updated_at: string
        }
        Insert: {
          action?: string
          condition_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          rule_name: string
          threshold?: number
          time_window_minutes?: number | null
          trigger_count?: number
          updated_at?: string
        }
        Update: {
          action?: string
          condition_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          rule_name?: string
          threshold?: number
          time_window_minutes?: number | null
          trigger_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
        }
        Relationships: []
      }
      biller_api_configs: {
        Row: {
          api_base_url: string | null
          biller_code: string
          category: string
          config: Json
          created_at: string
          display_name: string
          id: string
          is_enabled: boolean
          last_tested: string | null
          sort_order: number
          test_status: string | null
          updated_at: string
        }
        Insert: {
          api_base_url?: string | null
          biller_code: string
          category?: string
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_enabled?: boolean
          last_tested?: string | null
          sort_order?: number
          test_status?: string | null
          updated_at?: string
        }
        Update: {
          api_base_url?: string | null
          biller_code?: string
          category?: string
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_enabled?: boolean
          last_tested?: string | null
          sort_order?: number
          test_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blacklist_entries: {
        Row: {
          blocked_by: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          reason: string | null
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          blocked_by: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          blocked_by?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          reason?: string | null
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          cashback_ids: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          promo_ids: string[] | null
          starts_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cashback_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          promo_ids?: string[] | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cashback_ids?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          promo_ids?: string[] | null
          starts_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cashback_rules: {
        Row: {
          cashback_type: string
          cashback_value: number
          created_at: string
          created_by: string | null
          daily_limit: number | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_amount: number | null
          max_cashback: number | null
          min_amount: number | null
          name: string
          starts_at: string | null
          txn_type: string
          updated_at: string
        }
        Insert: {
          cashback_type?: string
          cashback_value?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_cashback?: number | null
          min_amount?: number | null
          name: string
          starts_at?: string | null
          txn_type: string
          updated_at?: string
        }
        Update: {
          cashback_type?: string
          cashback_value?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_cashback?: number | null
          min_amount?: number | null
          name?: string
          starts_at?: string | null
          txn_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      changelog_entries: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          admin_id: string | null
          created_at: string
          group_icon: string | null
          id: string
          metadata: Json | null
          name: string | null
          status: string
          type: Database["public"]["Enums"]["chat_type"]
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          group_icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          status?: string
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          group_icon?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          status?: string
          type?: Database["public"]["Enums"]["chat_type"]
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_encrypted: boolean
          message_type: Database["public"]["Enums"]["chat_message_type"]
          metadata: Json | null
          sender_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          message_type?: Database["public"]["Enums"]["chat_message_type"]
          metadata?: Json | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          message_type?: Database["public"]["Enums"]["chat_message_type"]
          metadata?: Json | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_payment_methods: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_enabled: boolean | null
          key: string
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          key: string
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_enabled?: boolean | null
          key?: string
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      commission_logs: {
        Row: {
          agent_amount: number
          agent_id: string | null
          company_amount: number
          created_at: string
          distributor_amount: number
          distributor_id: string | null
          id: string
          master_distributor_amount: number
          master_distributor_id: string | null
          tier_id: string | null
          total_fee: number
          transaction_id: string | null
          txn_amount: number
          txn_type: string
        }
        Insert: {
          agent_amount?: number
          agent_id?: string | null
          company_amount?: number
          created_at?: string
          distributor_amount?: number
          distributor_id?: string | null
          id?: string
          master_distributor_amount?: number
          master_distributor_id?: string | null
          tier_id?: string | null
          total_fee?: number
          transaction_id?: string | null
          txn_amount: number
          txn_type: string
        }
        Update: {
          agent_amount?: number
          agent_id?: string | null
          company_amount?: number
          created_at?: string
          distributor_amount?: number
          distributor_id?: string | null
          id?: string
          master_distributor_amount?: number
          master_distributor_id?: string | null
          tier_id?: string | null
          total_fee?: number
          transaction_id?: string | null
          txn_amount?: number
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_logs_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "commission_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_tiers: {
        Row: {
          agent_rate: number
          company_rate: number | null
          created_at: string
          distributor_rate: number
          fee_config_id: string | null
          id: string
          is_active: boolean
          master_distributor_rate: number
          max_amount: number | null
          min_amount: number
          updated_at: string
        }
        Insert: {
          agent_rate?: number
          company_rate?: number | null
          created_at?: string
          distributor_rate?: number
          fee_config_id?: string | null
          id?: string
          is_active?: boolean
          master_distributor_rate?: number
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Update: {
          agent_rate?: number
          company_rate?: number | null
          created_at?: string
          distributor_rate?: number
          fee_config_id?: string | null
          id?: string
          is_active?: boolean
          master_distributor_rate?: number
          max_amount?: number | null
          min_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_tiers_fee_config_id_fkey"
            columns: ["fee_config_id"]
            isOneToOne: false
            referencedRelation: "fee_config"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          discount_amount: number
          flow: string
          id: string
          redeemed_at: string
          txn_id: string | null
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_amount?: number
          flow: string
          id?: string
          redeemed_at?: string
          txn_id?: string | null
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_amount?: number
          flow?: string
          id?: string
          redeemed_at?: string
          txn_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_flow: string | null
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          merchant_id: string | null
          min_order_amount: number | null
          per_user_limit: number | null
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          applicable_flow?: string | null
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          merchant_id?: string | null
          min_order_amount?: number | null
          per_user_limit?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          applicable_flow?: string | null
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          merchant_id?: string | null
          min_order_amount?: number | null
          per_user_limit?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      courier_providers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          tracking_url_template: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          tracking_url_template?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          tracking_url_template?: string | null
        }
        Relationships: []
      }
      deleted_users: {
        Row: {
          avatar_url: string | null
          balance_at_deletion: number | null
          balance_recovered: number | null
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          id: string
          kyc_data: Json | null
          name: string | null
          notifications: Json | null
          other_data: Json | null
          phone: string | null
          profile_data: Json | null
          referrals: Json | null
          roles: Json | null
          support_conversations: Json | null
          transactions: Json | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          balance_at_deletion?: number | null
          balance_recovered?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          kyc_data?: Json | null
          name?: string | null
          notifications?: Json | null
          other_data?: Json | null
          phone?: string | null
          profile_data?: Json | null
          referrals?: Json | null
          roles?: Json | null
          support_conversations?: Json | null
          transactions?: Json | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          balance_at_deletion?: number | null
          balance_recovered?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          id?: string
          kyc_data?: Json | null
          name?: string | null
          notifications?: Json | null
          other_data?: Json | null
          phone?: string | null
          profile_data?: Json | null
          referrals?: Json | null
          roles?: Json | null
          support_conversations?: Json | null
          transactions?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          address_line: string
          area: string | null
          city: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          phone: string
          postal_code: string | null
          recipient_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          area?: string | null
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone: string
          postal_code?: string | null
          recipient_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          area?: string | null
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone?: string
          postal_code?: string | null
          recipient_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          cities: string[]
          courier_provider_id: string | null
          created_at: string | null
          delivery_fee: number
          estimated_days: string | null
          id: string
          is_active: boolean | null
          zone_name: string
        }
        Insert: {
          cities?: string[]
          courier_provider_id?: string | null
          created_at?: string | null
          delivery_fee?: number
          estimated_days?: string | null
          id?: string
          is_active?: boolean | null
          zone_name: string
        }
        Update: {
          cities?: string[]
          courier_provider_id?: string | null
          created_at?: string | null
          delivery_fee?: number
          estimated_days?: string | null
          id?: string
          is_active?: boolean | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_courier_provider_id_fkey"
            columns: ["courier_provider_id"]
            isOneToOne: false
            referencedRelation: "courier_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_accounts: {
        Row: {
          account_name: string | null
          account_number: string
          bank_name: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          method: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          method: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          method?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      device_registrations: {
        Row: {
          created_at: string
          device_fingerprint: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_fingerprint: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_fingerprint?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      disputes: {
        Row: {
          assigned_to: string | null
          complainant_id: string
          created_at: string
          description: string | null
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          subject: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          complainant_id: string
          created_at?: string
          description?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          subject: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          complainant_id?: string
          created_at?: string
          description?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          subject?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      distributors: {
        Row: {
          business_name: string
          commission_rate: number
          created_at: string
          id: string
          max_float: number
          parent_id: string | null
          status: Database["public"]["Enums"]["agent_status"]
          territory: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          commission_rate?: number
          created_at?: string
          id?: string
          max_float?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          commission_rate?: number
          created_at?: string
          id?: string
          max_float?: number
          parent_id?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributors_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "distributors"
            referencedColumns: ["id"]
          },
        ]
      }
      donation_cause_funds: {
        Row: {
          balance: number
          cause_icon: string | null
          cause_name: string
          created_at: string
          donor_count: number
          id: string
          total_raised: number
          updated_at: string
        }
        Insert: {
          balance?: number
          cause_icon?: string | null
          cause_name: string
          created_at?: string
          donor_count?: number
          id?: string
          total_raised?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          cause_icon?: string | null
          cause_name?: string
          created_at?: string
          donor_count?: number
          id?: string
          total_raised?: number
          updated_at?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          cause_icon: string | null
          cause_name: string
          created_at: string | null
          id: string
          is_anonymous: boolean
          message: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          cause_icon?: string | null
          cause_name: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          cause_icon?: string | null
          cause_name?: string
          created_at?: string | null
          id?: string
          is_anonymous?: boolean
          message?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      dps_missed_payments: {
        Row: {
          amount: number
          created_at: string | null
          due_date: string
          id: string
          repaid: boolean | null
          repaid_at: string | null
          schedule_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          due_date: string
          id?: string
          repaid?: boolean | null
          repaid_at?: string | null
          schedule_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          due_date?: string
          id?: string
          repaid?: boolean | null
          repaid_at?: string | null
          schedule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dps_missed_payments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "savings_auto_save"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_locks: {
        Row: {
          created_at: string
          expires_at: string | null
          feature: string
          id: string
          is_active: boolean
          locked_at: string
          locked_by: string
          reason: string | null
          target_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          feature: string
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by: string
          reason?: string | null
          target_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          feature?: string
          id?: string
          is_active?: boolean
          locked_at?: string
          locked_by?: string
          reason?: string | null
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_config: {
        Row: {
          agent_commission: number | null
          created_at: string
          distributor_commission: number | null
          effective_from: string
          effective_to: string | null
          fee_type: string
          fee_value: number
          id: string
          is_active: boolean
          master_distributor_commission: number | null
          max_amount: number | null
          min_amount: number | null
          platform_share: number | null
          txn_type: string
        }
        Insert: {
          agent_commission?: number | null
          created_at?: string
          distributor_commission?: number | null
          effective_from?: string
          effective_to?: string | null
          fee_type?: string
          fee_value: number
          id?: string
          is_active?: boolean
          master_distributor_commission?: number | null
          max_amount?: number | null
          min_amount?: number | null
          platform_share?: number | null
          txn_type: string
        }
        Update: {
          agent_commission?: number | null
          created_at?: string
          distributor_commission?: number | null
          effective_from?: string
          effective_to?: string | null
          fee_type?: string
          fee_value?: number
          id?: string
          is_active?: boolean
          master_distributor_commission?: number | null
          max_amount?: number | null
          min_amount?: number | null
          platform_share?: number | null
          txn_type?: string
        }
        Relationships: []
      }
      festival_themes: {
        Row: {
          accent_color: string | null
          banner_gradient: string | null
          body_pattern: string | null
          created_at: string
          created_by: string | null
          emoji: string
          ends_at: string | null
          greeting_text: string
          id: string
          is_active: boolean
          name: string
          overlay_effect: string
          preset_key: string
          starts_at: string | null
          theme_palette: Json | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          banner_gradient?: string | null
          body_pattern?: string | null
          created_at?: string
          created_by?: string | null
          emoji?: string
          ends_at?: string | null
          greeting_text?: string
          id?: string
          is_active?: boolean
          name: string
          overlay_effect?: string
          preset_key?: string
          starts_at?: string | null
          theme_palette?: Json | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          banner_gradient?: string | null
          body_pattern?: string | null
          created_at?: string
          created_by?: string | null
          emoji?: string
          ends_at?: string | null
          greeting_text?: string
          id?: string
          is_active?: boolean
          name?: string
          overlay_effect?: string
          preset_key?: string
          starts_at?: string | null
          theme_palette?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      flash_sales: {
        Row: {
          created_at: string | null
          ends_at: string
          id: string
          is_active: boolean | null
          product_id: string
          sale_price: number
          starts_at: string
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          id?: string
          is_active?: boolean | null
          product_id: string
          sale_price: number
          starts_at: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          sale_price?: number
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_alerts: {
        Row: {
          assigned_to: string | null
          assigned_to_team_member: string | null
          created_at: string
          details: Json | null
          escalated_at: string | null
          escalation_level: number
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          rule_triggered: string
          severity: Database["public"]["Enums"]["alert_severity"]
          sla_deadline: string | null
          status: Database["public"]["Enums"]["alert_status"]
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_team_member?: string | null
          created_at?: string
          details?: Json | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          rule_triggered: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_team_member?: string | null
          created_at?: string
          details?: Json | null
          escalated_at?: string | null
          escalation_level?: number
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          rule_triggered?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          sla_deadline?: string | null
          status?: Database["public"]["Enums"]["alert_status"]
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_assigned_to_team_member_fkey"
            columns: ["assigned_to_team_member"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_auto_rule_logs: {
        Row: {
          action_taken: string
          created_at: string
          id: string
          metric_value: number
          rule_id: string
          user_id: string
        }
        Insert: {
          action_taken: string
          created_at?: string
          id?: string
          metric_value?: number
          rule_id: string
          user_id: string
        }
        Update: {
          action_taken?: string
          created_at?: string
          id?: string
          metric_value?: number
          rule_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_auto_rule_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "fraud_auto_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_auto_rules: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          lock_duration: string
          metric: string
          name: string
          threshold: number
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lock_duration?: string
          metric: string
          name: string
          threshold?: number
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          lock_duration?: string
          metric?: string
          name?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      fund_requests: {
        Row: {
          account_holder: string | null
          account_number: string | null
          admin_note: string | null
          amount: number
          bank_name: string | null
          created_at: string
          id: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_method: string | null
          status: string
          transaction_id: string | null
          transaction_id_proof: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string
          id?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_method?: string | null
          status?: string
          transaction_id?: string | null
          transaction_id_proof?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          id?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_method?: string | null
          status?: string
          transaction_id?: string | null
          transaction_id_proof?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_requests_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_cards: {
        Row: {
          brand: string
          code: string
          created_at: string
          denomination: number
          expires_at: string
          id: string
          purchased_at: string
          purchaser_id: string
          recipient_phone: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          brand: string
          code?: string
          created_at?: string
          denomination: number
          expires_at?: string
          id?: string
          purchased_at?: string
          purchaser_id: string
          recipient_phone?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          brand?: string
          code?: string
          created_at?: string
          denomination?: number
          expires_at?: string
          id?: string
          purchased_at?: string
          purchaser_id?: string
          recipient_phone?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_feature_toggles: {
        Row: {
          created_at: string
          description: string | null
          feature_key: string
          id: string
          is_enabled: boolean
          label: string
          sort_order: number
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_key: string
          id?: string
          is_enabled?: boolean
          label: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_key?: string
          id?: string
          is_enabled?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: []
      }
      gold_holdings: {
        Row: {
          avg_buy_price: number
          created_at: string
          grams: number
          id: string
          karat: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_buy_price?: number
          created_at?: string
          grams?: number
          id?: string
          karat?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_buy_price?: number
          created_at?: string
          grams?: number
          id?: string
          karat?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          coverage_amount: number
          created_at: string
          duration_months: number
          expires_at: string | null
          id: string
          plan_name: string
          plan_type: string
          premium: number
          purchased_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          coverage_amount: number
          created_at?: string
          duration_months: number
          expires_at?: string | null
          id?: string
          plan_name: string
          plan_type: string
          premium: number
          purchased_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          coverage_amount?: number
          created_at?: string
          duration_months?: number
          expires_at?: string | null
          id?: string
          plan_name?: string
          plan_type?: string
          premium?: number
          purchased_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: {
          applicant_email: string | null
          applicant_name: string
          applicant_phone: string
          cover_note: string | null
          created_at: string | null
          id: string
          job_id: string
          resume_url: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          applicant_email?: string | null
          applicant_name: string
          applicant_phone: string
          cover_note?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          resume_url?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          applicant_email?: string | null
          applicant_name?: string
          applicant_phone?: string
          cover_note?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          resume_url?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          created_at: string | null
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          location: string | null
          requirements: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          requirements?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          requirements?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      kyc_verifications: {
        Row: {
          created_at: string
          date_of_birth: string | null
          face_match_result: string | null
          face_match_score: number | null
          full_name: string | null
          id: string
          nid_back_url: string | null
          nid_front_url: string | null
          nid_number: string | null
          nid_photo_url: string | null
          ocr_raw_data: Json | null
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          selfie_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          face_match_result?: string | null
          face_match_score?: number | null
          full_name?: string | null
          id?: string
          nid_back_url?: string | null
          nid_front_url?: string | null
          nid_number?: string | null
          nid_photo_url?: string | null
          ocr_raw_data?: Json | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          face_match_result?: string | null
          face_match_score?: number | null
          full_name?: string | null
          id?: string
          nid_back_url?: string | null
          nid_front_url?: string | null
          nid_number?: string | null
          nid_photo_url?: string | null
          ocr_raw_data?: Json | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          selfie_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lea_reports: {
        Row: {
          authority: string
          generated_at: string
          generated_by: string
          id: string
          issue_date: string
          phone: string
          reference_no: string
          report_id: string
          sections_included: string[]
          summary: Json | null
          target_user_id: string | null
        }
        Insert: {
          authority: string
          generated_at?: string
          generated_by: string
          id?: string
          issue_date: string
          phone: string
          reference_no: string
          report_id: string
          sections_included?: string[]
          summary?: Json | null
          target_user_id?: string | null
        }
        Update: {
          authority?: string
          generated_at?: string
          generated_by?: string
          id?: string
          issue_date?: string
          phone?: string
          reference_no?: string
          report_id?: string
          sections_included?: string[]
          summary?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          admin_notes: string | null
          amount: number
          applied_at: string
          created_at: string
          emi_amount: number
          id: string
          interest_rate: number
          notes: string | null
          repaid_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          tenure_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          applied_at?: string
          created_at?: string
          emi_amount?: number
          id?: string
          interest_rate?: number
          notes?: string | null
          repaid_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenure_days: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          applied_at?: string
          created_at?: string
          emi_amount?: number
          id?: string
          interest_rate?: number
          notes?: string | null
          repaid_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          tenure_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      merchant_api_keys: {
        Row: {
          api_key: string
          app_password: string | null
          created_at: string
          environment: string
          id: string
          ip_whitelist_enabled: boolean
          is_active: boolean
          merchant_id: string
          permissions: string[]
          rate_limit_per_minute: number
          rotation_expires_at: string | null
          secret_key: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key: string
          app_password?: string | null
          created_at?: string
          environment?: string
          id?: string
          ip_whitelist_enabled?: boolean
          is_active?: boolean
          merchant_id: string
          permissions?: string[]
          rate_limit_per_minute?: number
          rotation_expires_at?: string | null
          secret_key: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          app_password?: string | null
          created_at?: string
          environment?: string
          id?: string
          ip_whitelist_enabled?: boolean
          is_active?: boolean
          merchant_id?: string
          permissions?: string[]
          rate_limit_per_minute?: number
          rotation_expires_at?: string | null
          secret_key?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_api_logs: {
        Row: {
          action: string
          api_key_id: string
          created_at: string
          error_message: string | null
          id: string
          ip_address: string | null
          merchant_id: string
          response_time_ms: number
          status_code: number
          user_agent: string | null
        }
        Insert: {
          action?: string
          api_key_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          merchant_id: string
          response_time_ms?: number
          status_code?: number
          user_agent?: string | null
        }
        Update: {
          action?: string
          api_key_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          merchant_id?: string
          response_time_ms?: number
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_api_logs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_api_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          id: string
          merchant_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          merchant_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          id?: string
          merchant_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_api_requests_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_applications: {
        Row: {
          admin_notes: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_routing: string | null
          business_address: string | null
          business_name: string
          category: string
          contact_email: string | null
          contact_number: string | null
          created_at: string | null
          id: string
          owner_name: string | null
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          trade_license: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          business_address?: string | null
          business_name: string
          category?: string
          contact_email?: string | null
          contact_number?: string | null
          created_at?: string | null
          id?: string
          owner_name?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trade_license?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          business_address?: string | null
          business_name?: string
          category?: string
          contact_email?: string | null
          contact_number?: string | null
          created_at?: string | null
          id?: string
          owner_name?: string | null
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          trade_license?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      merchant_apply_config: {
        Row: {
          allowed_areas: string[]
          allowed_roles: string[]
          allowed_user_ids: string[]
          blocked_user_ids: string[]
          id: string
          mode: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed_areas?: string[]
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          blocked_user_ids?: string[]
          id?: string
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed_areas?: string[]
          allowed_roles?: string[]
          allowed_user_ids?: string[]
          blocked_user_ids?: string[]
          id?: string
          mode?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      merchant_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      merchant_idempotency_keys: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          merchant_id: string
          session_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          merchant_id: string
          session_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          merchant_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_idempotency_keys_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_idempotency_keys_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "merchant_payment_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_ip_whitelist: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          label: string | null
          merchant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          label?: string | null
          merchant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          label?: string | null
          merchant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_ip_whitelist_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payment_sessions: {
        Row: {
          amount: number
          api_key_id: string
          callback_url: string | null
          cancel_url: string | null
          completed_at: string | null
          created_at: string
          currency: string
          customer_phone: string | null
          description: string | null
          expires_at: string
          id: string
          merchant_id: string
          metadata: Json | null
          payer_user_id: string | null
          payment_link_id: string | null
          reference: string | null
          status: string
          success_url: string | null
          updated_at: string
          webhook_attempts: number
          webhook_delivered: boolean
          webhook_next_retry_at: string | null
        }
        Insert: {
          amount: number
          api_key_id: string
          callback_url?: string | null
          cancel_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_phone?: string | null
          description?: string | null
          expires_at?: string
          id?: string
          merchant_id: string
          metadata?: Json | null
          payer_user_id?: string | null
          payment_link_id?: string | null
          reference?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
          webhook_attempts?: number
          webhook_delivered?: boolean
          webhook_next_retry_at?: string | null
        }
        Update: {
          amount?: number
          api_key_id?: string
          callback_url?: string | null
          cancel_url?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: string
          customer_phone?: string | null
          description?: string | null
          expires_at?: string
          id?: string
          merchant_id?: string
          metadata?: Json | null
          payer_user_id?: string | null
          payment_link_id?: string | null
          reference?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
          webhook_attempts?: number
          webhook_delivered?: boolean
          webhook_next_retry_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_sessions_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "merchant_api_keys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_sessions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_payment_sessions_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_payouts: {
        Row: {
          account_holder: string | null
          account_number: string | null
          admin_note: string | null
          amount: number
          bank_name: string | null
          created_at: string
          credited_txn_id: string | null
          destination_user_id: string | null
          id: string
          merchant_id: string
          payout_method: string
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount: number
          bank_name?: string | null
          created_at?: string
          credited_txn_id?: string | null
          destination_user_id?: string | null
          id?: string
          merchant_id: string
          payout_method?: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount?: number
          bank_name?: string | null
          created_at?: string
          credited_txn_id?: string | null
          destination_user_id?: string | null
          id?: string
          merchant_id?: string
          payout_method?: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payouts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_products: {
        Row: {
          badge: string | null
          badge_color: string | null
          brand: string | null
          category: string
          created_at: string
          description: string | null
          emoji: string
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean
          merchant_id: string
          name: string
          original_price: number | null
          price: number
          rating: number
          review_count: number
          sku: string | null
          stock: number
          tags: string[] | null
          updated_at: string
          video_url: string | null
          weight_grams: number | null
        }
        Insert: {
          badge?: string | null
          badge_color?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          merchant_id: string
          name: string
          original_price?: number | null
          price?: number
          rating?: number
          review_count?: number
          sku?: string | null
          stock?: number
          tags?: string[] | null
          updated_at?: string
          video_url?: string | null
          weight_grams?: number | null
        }
        Update: {
          badge?: string | null
          badge_color?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          emoji?: string
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          merchant_id?: string
          name?: string
          original_price?: number | null
          price?: number
          rating?: number
          review_count?: number
          sku?: string | null
          stock?: number
          tags?: string[] | null
          updated_at?: string
          video_url?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_refunds: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          customer_name: string | null
          customer_user_id: string | null
          id: string
          merchant_id: string
          order_id: string | null
          order_num: string | null
          reason: string
          refund_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          customer_name?: string | null
          customer_user_id?: string | null
          id?: string
          merchant_id: string
          order_id?: string | null
          order_num?: string | null
          reason: string
          refund_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          customer_name?: string | null
          customer_user_id?: string | null
          id?: string
          merchant_id?: string
          order_id?: string | null
          order_num?: string | null
          reason?: string
          refund_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_refunds_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_staff: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          merchant_id: string
          name: string
          phone: string
          role: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          name: string
          phone: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
          name?: string
          phone?: string
          role?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_staff_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          bank_routing: string | null
          bank_statement_url: string | null
          business_kyc_rejection_reason: string | null
          business_kyc_reviewed_at: string | null
          business_kyc_reviewed_by: string | null
          business_kyc_status: string
          business_name: string
          category: Database["public"]["Enums"]["merchant_category"]
          commission_rate: number
          created_at: string
          id: string
          mdr_rate: number
          nid_back_url: string | null
          nid_front_url: string | null
          qr_code_data: string | null
          settlement_frequency: string
          status: Database["public"]["Enums"]["agent_status"]
          trade_license: string | null
          trade_license_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          bank_statement_url?: string | null
          business_kyc_rejection_reason?: string | null
          business_kyc_reviewed_at?: string | null
          business_kyc_reviewed_by?: string | null
          business_kyc_status?: string
          business_name: string
          category?: Database["public"]["Enums"]["merchant_category"]
          commission_rate?: number
          created_at?: string
          id?: string
          mdr_rate?: number
          nid_back_url?: string | null
          nid_front_url?: string | null
          qr_code_data?: string | null
          settlement_frequency?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trade_license?: string | null
          trade_license_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          bank_statement_url?: string | null
          business_kyc_rejection_reason?: string | null
          business_kyc_reviewed_at?: string | null
          business_kyc_reviewed_by?: string | null
          business_kyc_status?: string
          business_name?: string
          category?: Database["public"]["Enums"]["merchant_category"]
          commission_rate?: number
          created_at?: string
          id?: string
          mdr_rate?: number
          nid_back_url?: string | null
          nid_front_url?: string | null
          qr_code_data?: string | null
          settlement_frequency?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trade_license?: string | null
          trade_license_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mfs_incoming_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          matched_request_id: string | null
          provider: string
          raw_payload: Json | null
          sender_number: string | null
          status: string
          txn_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          matched_request_id?: string | null
          provider: string
          raw_payload?: Json | null
          sender_number?: string | null
          status?: string
          txn_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          matched_request_id?: string | null
          provider?: string
          raw_payload?: Json | null
          sender_number?: string | null
          status?: string
          txn_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfs_incoming_payments_matched_request_id_fkey"
            columns: ["matched_request_id"]
            isOneToOne: false
            referencedRelation: "fund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          merchant_id: string | null
          order_id: string
          platform_fee: number
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          status: string
          subtotal: number
          unit_price: number
          variant_id: string | null
          variant_label: string | null
          vendor_commission: number
        }
        Insert: {
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id: string
          platform_fee?: number
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          status?: string
          subtotal: number
          unit_price: number
          variant_id?: string | null
          variant_label?: string | null
          vendor_commission?: number
        }
        Update: {
          created_at?: string
          id?: string
          merchant_id?: string | null
          order_id?: string
          platform_fee?: number
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          status?: string
          subtotal?: number
          unit_price?: number
          variant_id?: string | null
          variant_label?: string | null
          vendor_commission?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_discount: number | null
          coupon_id: string | null
          courier_provider_id: string | null
          created_at: string
          delivery_address_id: string | null
          delivery_fee: number | null
          escrow_released_at: string | null
          escrow_status: string | null
          estimated_delivery: string | null
          id: string
          items: Json
          merchant_id: string | null
          notes: string | null
          order_num: string
          payment_method: string
          shipping_address: string | null
          shipping_city: string | null
          shipping_name: string | null
          shipping_phone: string | null
          status: string
          total: number
          total_platform_fee: number | null
          total_vendor_commission: number | null
          tracking_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_discount?: number | null
          coupon_id?: string | null
          courier_provider_id?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_fee?: number | null
          escrow_released_at?: string | null
          escrow_status?: string | null
          estimated_delivery?: string | null
          id?: string
          items?: Json
          merchant_id?: string | null
          notes?: string | null
          order_num?: string
          payment_method?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          total?: number
          total_platform_fee?: number | null
          total_vendor_commission?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_discount?: number | null
          coupon_id?: string | null
          courier_provider_id?: string | null
          created_at?: string
          delivery_address_id?: string | null
          delivery_fee?: number | null
          escrow_released_at?: string | null
          escrow_status?: string | null
          estimated_delivery?: string | null
          id?: string
          items?: Json
          merchant_id?: string | null
          notes?: string | null
          order_num?: string
          payment_method?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          total?: number
          total_platform_fee?: number | null
          total_vendor_commission?: number | null
          tracking_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_courier_provider_id_fkey"
            columns: ["courier_provider_id"]
            isOneToOne: false
            referencedRelation: "courier_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
          verified: boolean
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          purpose?: string
          verified?: boolean
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json
          created_at: string
          display_name: string
          id: string
          is_enabled: boolean
          provider: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_enabled?: boolean
          provider: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_enabled?: boolean
          provider?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_links: {
        Row: {
          amount: number | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          merchant_code: string | null
          merchant_id: string | null
          note: string | null
          short_code: string
          title: string
          used_count: number
        }
        Insert: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          merchant_code?: string | null
          merchant_id?: string | null
          note?: string | null
          short_code: string
          title: string
          used_count?: number
        }
        Update: {
          amount?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          merchant_code?: string | null
          merchant_id?: string | null
          note?: string | null
          short_code?: string
          title?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_sessions: {
        Row: {
          amount: number
          callback_url: string | null
          completed_at: string | null
          created_at: string
          fee: number
          id: string
          metadata: Json | null
          provider: string
          provider_payment_id: string | null
          provider_trx_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          callback_url?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number
          id?: string
          metadata?: Json | null
          provider: string
          provider_payment_id?: string | null
          provider_trx_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          callback_url?: string | null
          completed_at?: string | null
          created_at?: string
          fee?: number
          id?: string
          metadata?: Json | null
          provider?: string
          provider_payment_id?: string | null
          provider_trx_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pin_change_history: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          device_info: string | null
          id: string
          ip_address: unknown
          method: string
          user_id: string
        }
        Insert: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          user_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          ip_address?: unknown
          method?: string
          user_id?: string
        }
        Relationships: []
      }
      pin_reset_attempts: {
        Row: {
          attempted_at: string
          id: string
          phone: string
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: string
          phone: string
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: string
          phone?: string
          success?: boolean
        }
        Relationships: []
      }
      platform_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          message: string
          priority: number
          starts_at: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          priority?: number
          starts_at?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          priority?: number
          starts_at?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_banks: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          short_code: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          short_code: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          short_code?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      platform_treasury: {
        Row: {
          balance: number
          id: string
          total_commissions_paid: number
          total_disbursed: number
          total_earnings: number
          updated_at: string
        }
        Insert: {
          balance?: number
          id?: string
          total_commissions_paid?: number
          total_disbursed?: number
          total_earnings?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          id?: string
          total_commissions_paid?: number
          total_disbursed?: number
          total_earnings?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          images: string[] | null
          is_verified_purchase: boolean
          is_visible: boolean
          order_id: string | null
          product_id: string
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean
          is_visible?: boolean
          order_id?: string | null
          product_id: string
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          images?: string[] | null
          is_verified_purchase?: boolean
          is_visible?: boolean
          order_id?: string | null
          product_id?: string
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          price_adjustment: number
          product_id: string
          sku: string | null
          stock: number
          variant_name: string
          variant_value: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_adjustment?: number
          product_id: string
          sku?: string | null
          stock?: number
          variant_name: string
          variant_value: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price_adjustment?: number
          product_id?: string
          sku?: string | null
          stock?: number
          variant_name?: string
          variant_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          created_at: string
          deactivated_at: string | null
          deactivated_by: string | null
          email: string | null
          id: string
          kyc_exempt: boolean
          name: string | null
          phone: string
          referral_code: string | null
          scheduled_deletion_at: string | null
          status: string
          status_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          id?: string
          kyc_exempt?: boolean
          name?: string | null
          phone: string
          referral_code?: string | null
          scheduled_deletion_at?: string | null
          status?: string
          status_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          deactivated_at?: string | null
          deactivated_by?: string | null
          email?: string | null
          id?: string
          kyc_exempt?: boolean
          name?: string | null
          phone?: string
          referral_code?: string | null
          scheduled_deletion_at?: string | null
          status?: string
          status_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          badge_text: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          gradient_from: string | null
          gradient_to: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          link_url: string | null
          media_type: string | null
          media_url: string | null
          placement: string
          sort_order: number | null
          subtitle: string | null
          title: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          placement?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          gradient_from?: string | null
          gradient_to?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          placement?: string
          sort_order?: number | null
          subtitle?: string | null
          title?: string | null
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          applies_to: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_amount: number | null
          starts_at: string | null
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          applies_to?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          applies_to?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number | null
          starts_at?: string | null
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      recharge_api_configs: {
        Row: {
          api_base_url: string | null
          config: Json
          created_at: string
          display_name: string
          id: string
          is_enabled: boolean
          last_tested: string | null
          operator: string
          test_status: string | null
          updated_at: string
        }
        Insert: {
          api_base_url?: string | null
          config?: Json
          created_at?: string
          display_name: string
          id?: string
          is_enabled?: boolean
          last_tested?: string | null
          operator: string
          test_status?: string | null
          updated_at?: string
        }
        Update: {
          api_base_url?: string | null
          config?: Json
          created_at?: string
          display_name?: string
          id?: string
          is_enabled?: boolean
          last_tested?: string | null
          operator?: string
          test_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recharge_packs: {
        Row: {
          badge: string | null
          cashback: number | null
          created_at: string
          details: string
          highlight: boolean
          id: string
          is_active: boolean
          name: string
          operator: string
          price: number
          sort_order: number
          sub_category: string | null
          tag: string | null
          type: string
          updated_at: string
          validity: string
        }
        Insert: {
          badge?: string | null
          cashback?: number | null
          created_at?: string
          details: string
          highlight?: boolean
          id?: string
          is_active?: boolean
          name: string
          operator: string
          price: number
          sort_order?: number
          sub_category?: string | null
          tag?: string | null
          type?: string
          updated_at?: string
          validity: string
        }
        Update: {
          badge?: string | null
          cashback?: number | null
          created_at?: string
          details?: string
          highlight?: boolean
          id?: string
          is_active?: boolean
          name?: string
          operator?: string
          price?: number
          sort_order?: number
          sub_category?: string | null
          tag?: string | null
          type?: string
          updated_at?: string
          validity?: string
        }
        Relationships: []
      }
      recurring_donations: {
        Row: {
          amount: number
          cause_icon: string | null
          cause_name: string
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          is_anonymous: boolean
          last_run_at: string | null
          message: string | null
          next_run_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          cause_icon?: string | null
          cause_name: string
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          is_anonymous?: boolean
          last_run_at?: string | null
          message?: string | null
          next_run_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          cause_icon?: string | null
          cause_name?: string
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          is_anonymous?: boolean
          last_run_at?: string | null
          message?: string | null
          next_run_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          milestone: string
          referral_id: string
          referrer_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          milestone: string
          referral_id: string
          referrer_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          milestone?: string
          referral_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          milestone_1_paid: boolean
          milestone_2_paid: boolean
          milestone_3_paid: boolean
          referee_id: string
          referral_code: string
          referrer_id: string
          status: string
          total_rewarded: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_1_paid?: boolean
          milestone_2_paid?: boolean
          milestone_3_paid?: boolean
          referee_id: string
          referral_code: string
          referrer_id: string
          status?: string
          total_rewarded?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          milestone_1_paid?: boolean
          milestone_2_paid?: boolean
          milestone_3_paid?: boolean
          referee_id?: string
          referral_code?: string
          referrer_id?: string
          status?: string
          total_rewarded?: number
          updated_at?: string
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          details: string | null
          id: string
          order_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          order_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          details?: string | null
          id?: string
          order_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          short_code: string
          user_id: string
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          short_code: string
          user_id: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          short_code?: string
          user_id?: string
        }
        Relationships: []
      }
      savings_auto_save: {
        Row: {
          amount: number
          created_at: string
          duration: string | null
          ends_at: string | null
          frequency: string
          goal_id: string | null
          id: string
          is_active: boolean
          last_missed_at: string | null
          last_run_at: string | null
          missed_count: number | null
          next_run_at: string
          settled: boolean
          strategy: string | null
          total_installments: number | null
          total_paid: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          duration?: string | null
          ends_at?: string | null
          frequency?: string
          goal_id?: string | null
          id?: string
          is_active?: boolean
          last_missed_at?: string | null
          last_run_at?: string | null
          missed_count?: number | null
          next_run_at?: string
          settled?: boolean
          strategy?: string | null
          total_installments?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          duration?: string | null
          ends_at?: string | null
          frequency?: string
          goal_id?: string | null
          id?: string
          is_active?: boolean
          last_missed_at?: string | null
          last_run_at?: string | null
          missed_count?: number | null
          next_run_at?: string
          settled?: boolean
          strategy?: string | null
          total_installments?: number | null
          total_paid?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_auto_save_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_deposits: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "savings_deposits_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "savings_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_goals: {
        Row: {
          created_at: string
          emoji: string
          id: string
          name: string
          saved_amount: number
          status: string
          target_amount: number
          updated_at: string
          user_id: string
          withdrawn_amount: number | null
          withdrawn_at: string | null
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          name: string
          saved_amount?: number
          status?: string
          target_amount?: number
          updated_at?: string
          user_id: string
          withdrawn_amount?: number | null
          withdrawn_at?: string | null
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          name?: string
          saved_amount?: number
          status?: string
          target_amount?: number
          updated_at?: string
          user_id?: string
          withdrawn_amount?: number | null
          withdrawn_at?: string | null
        }
        Relationships: []
      }
      settlements: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          commission_amount: number
          created_at: string
          entity_id: string
          entity_name: string | null
          entity_phone: string | null
          entity_type: string
          fee_amount: number
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          period_end: string
          period_start: string
          settled_at: string | null
          settled_by: string | null
          settlement_ref: string | null
          status: string
          txn_count: number
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          commission_amount?: number
          created_at?: string
          entity_id: string
          entity_name?: string | null
          entity_phone?: string | null
          entity_type: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          period_end: string
          period_start: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_ref?: string | null
          status?: string
          txn_count?: number
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          commission_amount?: number
          created_at?: string
          entity_id?: string
          entity_name?: string | null
          entity_phone?: string | null
          entity_type?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          period_end?: string
          period_start?: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_ref?: string | null
          status?: string
          txn_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      spending_budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          is_recurring: boolean
          last_reset_month: string | null
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_recurring?: boolean
          last_reset_month?: string | null
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_recurring?: boolean
          last_reset_month?: string | null
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stock_holdings: {
        Row: {
          avg_buy_price: number
          created_at: string
          current_price: number
          id: string
          last_price_update: string | null
          name: string
          quantity: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_buy_price?: number
          created_at?: string
          current_price?: number
          id?: string
          last_price_update?: string | null
          name?: string
          quantity?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_buy_price?: number
          created_at?: string
          current_price?: number
          id?: string
          last_price_update?: string | null
          name?: string
          quantity?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_complaints: {
        Row: {
          assigned_to: string | null
          complaint_number: string
          conversation_id: string
          created_at: string
          description: string
          id: string
          priority: string
          raised_by: string
          resolution_notes: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          complaint_number: string
          conversation_id: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          raised_by: string
          resolution_notes?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          complaint_number?: string
          conversation_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          raised_by?: string
          resolution_notes?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          admin_last_read_at: string | null
          assigned_agent_id: string | null
          complaint_number: string | null
          created_at: string
          id: string
          rating: number | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
          user_last_read_at: string | null
        }
        Insert: {
          admin_last_read_at?: string | null
          assigned_agent_id?: string | null
          complaint_number?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
          user_last_read_at?: string | null
        }
        Update: {
          admin_last_read_at?: string | null
          assigned_agent_id?: string | null
          complaint_number?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
          user_last_read_at?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          expires_at: string | null
          id: string
          is_deleted: boolean
          is_encrypted: boolean
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          read_at?: string | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_deleted?: boolean
          is_encrypted?: boolean
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_access_permissions: {
        Row: {
          can_add: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          granted_by: string | null
          id: string
          section: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          section: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_add?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          section?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string | null
          created_by: string | null
          department: string | null
          display_name: string
          email: string | null
          first_login_at: string | null
          has_changed_password: boolean
          has_completed_profile: boolean
          has_logged_in: boolean
          id: string
          is_available: boolean | null
          last_active_at: string | null
          notes: string | null
          password_changed_at: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          display_name: string
          email?: string | null
          first_login_at?: string | null
          has_changed_password?: boolean
          has_completed_profile?: boolean
          has_logged_in?: boolean
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          notes?: string | null
          password_changed_at?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          display_name?: string
          email?: string | null
          first_login_at?: string | null
          has_changed_password?: boolean
          has_completed_profile?: boolean
          has_logged_in?: boolean
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          notes?: string | null
          password_changed_at?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      transaction_limits: {
        Row: {
          applies_to: string
          id: string
          is_active: boolean
          max_amount: number
          max_count: number
          period: string
          txn_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applies_to?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          max_count?: number
          period: string
          txn_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applies_to?: string
          id?: string
          is_active?: boolean
          max_amount?: number
          max_count?: number
          period?: string
          txn_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      transaction_safety_rules: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_enabled: boolean | null
          label: string
          rule_key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_enabled?: boolean | null
          label: string
          rule_key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_enabled?: boolean | null
          label?: string
          rule_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          commission: number
          created_at: string
          description: string | null
          fee: number
          id: string
          recipient_name: string | null
          recipient_phone: string | null
          reference: string | null
          short_id: string
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          commission?: number
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          reference?: string | null
          short_id?: string
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          commission?: number
          created_at?: string
          description?: string | null
          fee?: number
          id?: string
          recipient_name?: string | null
          recipient_phone?: string | null
          reference?: string | null
          short_id?: string
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      transfer_rate_limits: {
        Row: {
          created_at: string
          id: string
          rpc_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rpc_name?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rpc_name?: string
          user_id?: string
        }
        Relationships: []
      }
      treasury_ledger: {
        Row: {
          actor_id: string | null
          amount: number
          balance_after: number
          counterparty_role: string | null
          counterparty_user_id: string | null
          created_at: string
          description: string | null
          id: string
          reference: string | null
          type: Database["public"]["Enums"]["treasury_ledger_type"]
        }
        Insert: {
          actor_id?: string | null
          amount: number
          balance_after: number
          counterparty_role?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type: Database["public"]["Enums"]["treasury_ledger_type"]
        }
        Update: {
          actor_id?: string | null
          amount?: number
          balance_after?: number
          counterparty_role?: string | null
          counterparty_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reference?: string | null
          type?: Database["public"]["Enums"]["treasury_ledger_type"]
        }
        Relationships: []
      }
      user_feature_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          feature_key: string
          group_type: string | null
          group_value: string | null
          id: string
          user_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          feature_key: string
          group_type?: string | null
          group_value?: string | null
          id?: string
          user_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          feature_key?: string
          group_type?: string | null
          group_value?: string | null
          id?: string
          user_id?: string | null
          visibility?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          screen: string | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          screen?: string | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          screen?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_limit_overrides: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_amount: number | null
          max_count: number | null
          period: string
          reason: string | null
          set_by: string
          target_user_id: string
          txn_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_count?: number | null
          period: string
          reason?: string | null
          set_by: string
          target_user_id: string
          txn_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          max_count?: number | null
          period?: string
          reason?: string | null
          set_by?: string
          target_user_id?: string
          txn_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          granted_at: string | null
          id: string
          permission: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          granted_at?: string | null
          id?: string
          permission: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          granted_at?: string | null
          id?: string
          permission?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_quick_action_order: {
        Row: {
          action_order: string[]
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_order: string[]
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_order?: string[]
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          reason: string | null
          reward_type: string
          reward_value: Json
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          reward_type: string
          reward_value?: Json
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          reason?: string | null
          reward_type?: string
          reward_value?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_commission_overrides: {
        Row: {
          category: string
          commission_rate: number
          created_at: string
          id: string
          merchant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          commission_rate: number
          created_at?: string
          id?: string
          merchant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          commission_rate?: number
          created_at?: string
          id?: string
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_commission_overrides_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_earnings_ledger: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          gross_amount: number
          id: string
          merchant_id: string
          net_amount: number
          order_id: string | null
          released_at: string | null
          status: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          created_at?: string
          gross_amount: number
          id?: string
          merchant_id: string
          net_amount: number
          order_id?: string | null
          released_at?: string | null
          status?: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          gross_amount?: number
          id?: string
          merchant_id?: string
          net_amount?: number
          order_id?: string | null
          released_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_earnings_ledger_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_stores: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          merchant_id: string
          rating: number
          review_count: number
          slug: string
          social_links: Json | null
          store_name: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          merchant_id: string
          rating?: number
          review_count?: number
          slug: string
          social_links?: Json | null
          store_name: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          merchant_id?: string
          rating?: number
          review_count?: number
          slug?: string
          social_links?: Json | null
          store_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_stores_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_wallets: {
        Row: {
          available_balance: number
          lifetime_earnings: number
          lifetime_withdrawn: number
          merchant_id: string
          pending_balance: number
          updated_at: string
        }
        Insert: {
          available_balance?: number
          lifetime_earnings?: number
          lifetime_withdrawn?: number
          merchant_id: string
          pending_balance?: number
          updated_at?: string
        }
        Update: {
          available_balance?: number
          lifetime_earnings?: number
          lifetime_withdrawn?: number
          merchant_id?: string
          pending_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_wallets_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "merchant_products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_approve_fund_request: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: Json
      }
      admin_chargeback: {
        Args: {
          p_amount: number
          p_reason: string
          p_reference_txn_id?: string
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_disburse_funds: {
        Args: {
          p_amount: number
          p_description?: string
          p_target_phone: string
        }
        Returns: Json
      }
      admin_reject_fund_request: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: Json
      }
      admin_reset_all_milestones: {
        Args: { p_referral_id: string }
        Returns: Json
      }
      admin_reverse_chargeback: {
        Args: { p_chargeback_txn_id: string; p_reason: string }
        Returns: Json
      }
      admin_toggle_referral_milestone: {
        Args: { p_action: string; p_milestone: number; p_referral_id: string }
        Returns: Json
      }
      admin_user_metrics: { Args: never; Returns: Json }
      apply_loan: {
        Args: {
          p_amount: number
          p_emi_amount: number
          p_interest_rate: number
          p_tenure_days: number
        }
        Returns: string
      }
      approve_business_kyc: {
        Args: { p_commission_rate?: number; p_merchant_id: string }
        Returns: Json
      }
      approve_vendor_payout: {
        Args: { p_note?: string; p_payout_id: string }
        Returns: Json
      }
      buy_gold: {
        Args: {
          p_grams: number
          p_karat: string
          p_pin?: string
          p_price_per_gram: number
        }
        Returns: Json
      }
      buy_stock:
        | {
            Args: {
              p_name: string
              p_price: number
              p_quantity: number
              p_symbol: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_name: string
              p_pin?: string
              p_price: number
              p_quantity: number
              p_symbol: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_name?: string
              p_price: number
              p_quantity: number
              p_symbol: string
            }
            Returns: Json
          }
      calculate_commission: {
        Args: { p_amount: number; p_txn_type: string }
        Returns: Json
      }
      cancel_goal: { Args: { p_goal_id: string }; Returns: Json }
      cancel_order_escrow: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
      check_merchant_apply_access: {
        Args: { p_user_id: string }
        Returns: Json
      }
      check_referral_milestones: {
        Args: { p_referee_id: string }
        Returns: undefined
      }
      create_direct_chat_request: {
        Args: { p_metadata?: Json; p_other_user_id: string }
        Returns: string
      }
      credit_cashback: {
        Args: {
          p_amount: number
          p_description?: string
          p_reference?: string
          p_user_id: string
        }
        Returns: Json
      }
      credit_vendor_earnings: {
        Args: {
          p_category?: string
          p_gross_amount: number
          p_merchant_id: string
          p_order_id: string
        }
        Returns: Json
      }
      disburse_loan: {
        Args: { p_admin_id: string; p_loan_id: string }
        Returns: undefined
      }
      donation_leaderboard: {
        Args: { p_cause?: string }
        Returns: {
          cause_name: string
          donation_count: number
          donor_name: string
          total_amount: number
        }[]
      }
      expire_stale_payment_sessions: { Args: never; Returns: number }
      expire_stale_promotions: { Args: never; Returns: undefined }
      find_chat_user_by_phone: { Args: { p_phone: string }; Returns: Json }
      generate_referral_code: { Args: never; Returns: string }
      generate_short_id: { Args: never; Returns: string }
      generate_wallet_id_from_phone: {
        Args: { p_phone: string }
        Returns: string
      }
      get_blocked_user_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          name: string
          phone: string
          user_id: string
        }[]
      }
      get_chat_participant_profiles: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          name: string
          phone: string
          user_id: string
        }[]
      }
      get_data_quality_samples: {
        Args: { p_check: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      get_effective_commission_rate: {
        Args: { p_category: string; p_merchant_id: string }
        Returns: number
      }
      get_merchant_customers: {
        Args: { p_merchant_id: string }
        Returns: {
          customer_name: string
          customer_phone: string
          customer_user_id: string
          last_order_at: string
          order_count: number
          tier: string
          total_spent: number
        }[]
      }
      get_nearby_agents: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: {
          address: string
          agent_id: string
          avg_rating: number
          business_name: string
          distance_km: number
          latitude: number
          longitude: number
          territory_code: string
          total_ratings: number
        }[]
      }
      get_public_merchants: {
        Args: never
        Returns: {
          business_name: string
          category: string
          created_at: string
          id: string
          qr_code_data: string
          status: string
          user_id: string
        }[]
      }
      get_public_session_info: { Args: { p_session_id: string }; Returns: Json }
      get_shop_products: {
        Args: never
        Returns: {
          badge: string
          badge_color: string
          category: string
          created_at: string
          description: string
          emoji: string
          id: string
          image_url: string
          images: string[]
          is_active: boolean
          merchant_id: string
          name: string
          original_price: number
          price: number
          rating: number
          review_count: number
          stock: number
          updated_at: string
          vendor_name: string
          video_url: string
        }[]
      }
      get_staff_merchant_access: {
        Args: { p_user_id: string }
        Returns: {
          business_name: string
          merchant_id: string
          staff_role: string
        }[]
      }
      get_user_feature_visibility: {
        Args: { p_feature_key: string; p_user_id: string }
        Returns: string
      }
      get_user_performance_stats: {
        Args: never
        Returns: {
          created_at: string
          last_active: string
          monthly_txns: number
          name: string
          phone: string
          total_txns: number
          total_volume: number
          txn_breakdown: Json
          user_id: string
        }[]
      }
      get_user_usage_badge: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_command_staff: { Args: { _user_id?: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_phone_registered: { Args: { p_phone: string }; Returns: boolean }
      normalize_bd_phone: { Args: { p_raw: string }; Returns: string }
      notify_insurance_expiry: { Args: never; Returns: number }
      place_shop_order: {
        Args: {
          p_coupon_discount?: number
          p_coupon_id?: string
          p_delivery_fee?: number
          p_items: Json
          p_payment_method?: string
          p_shipping_address: string
          p_shipping_city: string
          p_shipping_name: string
          p_shipping_phone: string
        }
        Returns: Json
      }
      process_donation: {
        Args: {
          p_amount: number
          p_cause_icon?: string
          p_cause_name: string
          p_frequency?: string
          p_is_anonymous?: boolean
          p_is_recurring?: boolean
          p_message?: string
        }
        Returns: Json
      }
      process_merchant_payout: {
        Args: { p_action: string; p_admin_note?: string; p_payout_id: string }
        Returns: Json
      }
      process_merchant_refund: {
        Args: { p_action: string; p_admin_note?: string; p_refund_id: string }
        Returns: Json
      }
      record_coupon_redemption: {
        Args: {
          p_code: string
          p_discount: number
          p_flow: string
          p_txn_id: string
        }
        Returns: Json
      }
      record_transaction:
        | {
            Args: {
              p_amount: number
              p_cashback?: number
              p_fee?: number
              p_metadata?: Json
              p_note?: string
              p_recipient?: string
              p_type: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_fee?: number
              p_recipient_name?: string
              p_recipient_phone?: string
              p_reference?: string
              p_type: Database["public"]["Enums"]["txn_type"]
            }
            Returns: Json
          }
      redeem_gift_card: { Args: { p_code: string }; Returns: Json }
      reject_business_kyc: {
        Args: { p_merchant_id: string; p_reason: string }
        Returns: Json
      }
      reject_vendor_payout: {
        Args: { p_payout_id: string; p_reason: string }
        Returns: Json
      }
      release_escrow: { Args: { p_order_id: string }; Returns: Json }
      release_vendor_earnings: { Args: { p_order_id: string }; Returns: Json }
      repay_loan: { Args: { p_loan_id: string }; Returns: undefined }
      repay_loan_partial: {
        Args: { p_amount: number; p_loan_id: string }
        Returns: Json
      }
      request_vendor_payout: { Args: { p_amount: number }; Returns: Json }
      require_kyc_verified: { Args: { p_user_id: string }; Returns: undefined }
      resolve_payment_merchant: {
        Args: { p_identifier: string }
        Returns: Json
      }
      resolve_transfer_recipient: {
        Args: { p_flow: string; p_identifier: string }
        Returns: Json
      }
      savings_deposit: {
        Args: { p_amount: number; p_goal_id: string; p_source?: string }
        Returns: Json
      }
      sell_gold: {
        Args: {
          p_grams: number
          p_karat: string
          p_pin?: string
          p_price_per_gram: number
        }
        Returns: Json
      }
      sell_stock: {
        Args: {
          p_pin?: string
          p_price: number
          p_quantity: number
          p_symbol: string
        }
        Returns: Json
      }
      set_kyc_exempt: {
        Args: { exempt: boolean; target_user_id: string }
        Returns: undefined
      }
      settle_matured_dps: { Args: { p_plan_id: string }; Returns: Json }
      submit_addmoney_request: {
        Args: {
          p_amount: number
          p_proof_url?: string
          p_source_method?: string
          p_transaction_id_proof?: string
        }
        Returns: Json
      }
      submit_business_kyc: {
        Args: {
          p_bank_account_holder: string
          p_bank_account_number: string
          p_bank_name: string
          p_bank_statement_url: string
          p_business_name: string
          p_category: string
          p_nid_back_url: string
          p_nid_front_url: string
          p_trade_license: string
          p_trade_license_url: string
        }
        Returns: Json
      }
      submit_withdraw_request: {
        Args: {
          p_account_holder: string
          p_account_number: string
          p_amount: number
          p_bank_name: string
        }
        Returns: Json
      }
      transfer_money: {
        Args: {
          p_amount: number
          p_commission?: number
          p_description?: string
          p_fee?: number
          p_recipient_name?: string
          p_recipient_phone: string
          p_recipient_type?: Database["public"]["Enums"]["txn_type"]
          p_reference?: string
          p_type?: Database["public"]["Enums"]["txn_type"]
        }
        Returns: Json
      }
      treasury_debit_for_addmoney: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      validate_and_apply_coupon: {
        Args: { p_cart_total: number; p_code: string; p_merchant_id?: string }
        Returns: Json
      }
      withdraw_completed_goal: { Args: { p_goal_id: string }; Returns: Json }
    }
    Enums: {
      agent_status: "pending" | "active" | "suspended" | "terminated"
      alert_severity: "low" | "medium" | "high" | "critical"
      alert_status: "open" | "investigating" | "resolved" | "false_positive"
      app_role:
        | "customer"
        | "agent"
        | "merchant"
        | "distributor"
        | "super_distributor"
        | "admin"
        | "compliance"
        | "finance"
        | "support"
        | "operations"
        | "marketing"
        | "hr"
        | "audit"
        | "risk"
        | "developer"
        | "manager"
      chat_message_type: "text" | "money" | "voice" | "image" | "order"
      chat_type: "direct" | "group"
      dispute_status: "open" | "under_review" | "resolved" | "rejected"
      merchant_category:
        | "retail"
        | "restaurant"
        | "grocery"
        | "pharmacy"
        | "transport"
        | "education"
        | "utility"
        | "other"
      treasury_ledger_type:
        | "disburse"
        | "earning"
        | "commission_paid"
        | "user_addmoney"
        | "initial_deposit"
      txn_status: "pending" | "completed" | "failed" | "reversed"
      txn_type:
        | "send"
        | "cashout"
        | "payment"
        | "recharge"
        | "paybill"
        | "addmoney"
        | "receive"
        | "cashin"
        | "banktransfer"
        | "chargeback"
        | "deposit"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["pending", "active", "suspended", "terminated"],
      alert_severity: ["low", "medium", "high", "critical"],
      alert_status: ["open", "investigating", "resolved", "false_positive"],
      app_role: [
        "customer",
        "agent",
        "merchant",
        "distributor",
        "super_distributor",
        "admin",
        "compliance",
        "finance",
        "support",
        "operations",
        "marketing",
        "hr",
        "audit",
        "risk",
        "developer",
        "manager",
      ],
      chat_message_type: ["text", "money", "voice", "image", "order"],
      chat_type: ["direct", "group"],
      dispute_status: ["open", "under_review", "resolved", "rejected"],
      merchant_category: [
        "retail",
        "restaurant",
        "grocery",
        "pharmacy",
        "transport",
        "education",
        "utility",
        "other",
      ],
      treasury_ledger_type: [
        "disburse",
        "earning",
        "commission_paid",
        "user_addmoney",
        "initial_deposit",
      ],
      txn_status: ["pending", "completed", "failed", "reversed"],
      txn_type: [
        "send",
        "cashout",
        "payment",
        "recharge",
        "paybill",
        "addmoney",
        "receive",
        "cashin",
        "banktransfer",
        "chargeback",
        "deposit",
      ],
    },
  },
} as const
