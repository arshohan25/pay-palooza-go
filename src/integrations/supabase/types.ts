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
      chat_conversations: {
        Row: {
          admin_id: string | null
          created_at: string
          group_icon: string | null
          id: string
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
      merchant_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          merchant_id: string
          secret_key: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id: string
          secret_key: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          merchant_id?: string
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
        ]
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
          sort_order: number | null
          subtitle: string | null
          title: string
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
          sort_order?: number | null
          subtitle?: string | null
          title: string
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
          sort_order?: number | null
          subtitle?: string | null
          title?: string
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
      support_conversations: {
        Row: {
          admin_last_read_at: string | null
          assigned_agent_id: string | null
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
          first_login_at: string | null
          has_changed_password: boolean
          has_completed_profile: boolean
          has_logged_in: boolean
          id: string
          is_available: boolean | null
          last_active_at: string | null
          notes: string | null
          password_changed_at: string | null
          temp_password: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          display_name: string
          first_login_at?: string | null
          has_changed_password?: boolean
          has_completed_profile?: boolean
          has_logged_in?: boolean
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          notes?: string | null
          password_changed_at?: string | null
          temp_password?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          display_name?: string
          first_login_at?: string | null
          has_changed_password?: boolean
          has_completed_profile?: boolean
          has_logged_in?: boolean
          id?: string
          is_available?: boolean | null
          last_active_at?: string | null
          notes?: string | null
          password_changed_at?: string | null
          temp_password?: string | null
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
      admin_disburse_funds: {
        Args: {
          p_amount: number
          p_description?: string
          p_target_phone: string
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
      create_direct_chat_request: {
        Args: { p_other_user_id: string }
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
      expire_stale_payment_sessions: { Args: never; Returns: number }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_chat_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      normalize_bd_phone: { Args: { p_raw: string }; Returns: string }
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
      resolve_transfer_recipient: {
        Args: { p_flow: string; p_identifier: string }
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
      treasury_debit_for_addmoney: {
        Args: { p_amount: number; p_user_id: string }
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
      ],
    },
  },
} as const
