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
      agents: {
        Row: {
          activated_at: string | null
          business_name: string | null
          commission_earned: number
          created_at: string
          customers_onboarded: number
          distributor_id: string | null
          id: string
          max_float: number
          nid_number: string | null
          status: Database["public"]["Enums"]["agent_status"]
          territory_code: string | null
          trade_license: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          business_name?: string | null
          commission_earned?: number
          created_at?: string
          customers_onboarded?: number
          distributor_id?: string | null
          id?: string
          max_float?: number
          nid_number?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory_code?: string | null
          trade_license?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          business_name?: string | null
          commission_earned?: number
          created_at?: string
          customers_onboarded?: number
          distributor_id?: string | null
          id?: string
          max_float?: number
          nid_number?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          territory_code?: string | null
          trade_license?: string | null
          updated_at?: string
          user_id?: string
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
          max_amount?: number | null
          min_amount?: number | null
          platform_share?: number | null
          txn_type?: string
        }
        Relationships: []
      }
      fraud_alerts: {
        Row: {
          assigned_to: string | null
          created_at: string
          details: Json | null
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          rule_triggered: string
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          rule_triggered: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          rule_triggered?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          transaction_id?: string | null
          user_id?: string
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
      merchants: {
        Row: {
          bank_account_number: string | null
          bank_name: string | null
          bank_routing: string | null
          business_name: string
          category: Database["public"]["Enums"]["merchant_category"]
          created_at: string
          id: string
          mdr_rate: number
          qr_code_data: string | null
          settlement_frequency: string
          status: Database["public"]["Enums"]["agent_status"]
          trade_license: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          business_name: string
          category?: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          id?: string
          mdr_rate?: number
          qr_code_data?: string | null
          settlement_frequency?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trade_license?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bank_account_number?: string | null
          bank_name?: string | null
          bank_routing?: string | null
          business_name?: string
          category?: Database["public"]["Enums"]["merchant_category"]
          created_at?: string
          id?: string
          mdr_rate?: number
          qr_code_data?: string | null
          settlement_frequency?: string
          status?: Database["public"]["Enums"]["agent_status"]
          trade_license?: string | null
          updated_at?: string
          user_id?: string
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
      orders: {
        Row: {
          created_at: string
          estimated_delivery: string | null
          id: string
          items: Json
          notes: string | null
          order_num: string
          payment_method: string
          shipping_address: string | null
          shipping_city: string | null
          shipping_name: string | null
          shipping_phone: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_num?: string
          payment_method?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_num?: string
          payment_method?: string
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_name?: string | null
          shipping_phone?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string
          referral_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone: string
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string
          referral_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
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
      support_conversations: {
        Row: {
          admin_last_read_at: string | null
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
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_chargeback: {
        Args: {
          p_amount: number
          p_reason: string
          p_reference_txn_id?: string
          p_target_user_id: string
        }
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
      check_referral_milestones: {
        Args: { p_referee_id: string }
        Returns: undefined
      }
      generate_referral_code: { Args: never; Returns: string }
      generate_short_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_transaction: {
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
      transfer_money:
        | {
            Args: {
              p_amount: number
              p_description?: string
              p_fee?: number
              p_recipient_name?: string
              p_recipient_phone: string
              p_reference?: string
              p_type?: Database["public"]["Enums"]["txn_type"]
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount: number
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
        | {
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
      ],
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
      ],
    },
  },
} as const
