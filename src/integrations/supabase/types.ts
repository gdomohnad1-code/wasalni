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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ad_events: {
        Row: {
          ad_id: string
          created_at: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          ad_id: string
          created_at?: string
          event_type: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          ad_id?: string
          created_at?: string
          event_type?: Database["public"]["Enums"]["ad_event_type"]
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_events_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_credentials: {
        Row: {
          email: string
          password: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          email: string
          password: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          email?: string
          password?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_emails: {
        Row: {
          created_at: string
          created_by: string | null
          default_permission: Database["public"]["Enums"]["admin_permission"]
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_permission?: Database["public"]["Enums"]["admin_permission"]
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_permission?: Database["public"]["Enums"]["admin_permission"]
          email?: string
          id?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission: Database["public"]["Enums"]["admin_permission"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["admin_permission"]
          user_id?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          auto_rotate: boolean
          created_at: string
          created_by: string | null
          daily_end_hour: number | null
          daily_start_hour: number | null
          description: string | null
          end_at: string | null
          external_link: string | null
          id: string
          is_sponsored: boolean
          max_impressions_per_user: number | null
          media_type: Database["public"]["Enums"]["ad_media_type"]
          media_url: string | null
          placements: Database["public"]["Enums"]["ad_placement"][]
          priority: number
          qr_data: string | null
          sponsor_name: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["ad_status"]
          target_area_lat: number | null
          target_area_lng: number | null
          target_area_radius_m: number | null
          target_audience: Database["public"]["Enums"]["ad_audience"]
          target_cities: string[]
          target_max_rides: number | null
          target_min_rides: number | null
          title: string
          type: Database["public"]["Enums"]["ad_type"]
          updated_at: string
        }
        Insert: {
          auto_rotate?: boolean
          created_at?: string
          created_by?: string | null
          daily_end_hour?: number | null
          daily_start_hour?: number | null
          description?: string | null
          end_at?: string | null
          external_link?: string | null
          id?: string
          is_sponsored?: boolean
          max_impressions_per_user?: number | null
          media_type?: Database["public"]["Enums"]["ad_media_type"]
          media_url?: string | null
          placements?: Database["public"]["Enums"]["ad_placement"][]
          priority?: number
          qr_data?: string | null
          sponsor_name?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          target_area_lat?: number | null
          target_area_lng?: number | null
          target_area_radius_m?: number | null
          target_audience?: Database["public"]["Enums"]["ad_audience"]
          target_cities?: string[]
          target_max_rides?: number | null
          target_min_rides?: number | null
          title: string
          type?: Database["public"]["Enums"]["ad_type"]
          updated_at?: string
        }
        Update: {
          auto_rotate?: boolean
          created_at?: string
          created_by?: string | null
          daily_end_hour?: number | null
          daily_start_hour?: number | null
          description?: string | null
          end_at?: string | null
          external_link?: string | null
          id?: string
          is_sponsored?: boolean
          max_impressions_per_user?: number | null
          media_type?: Database["public"]["Enums"]["ad_media_type"]
          media_url?: string | null
          placements?: Database["public"]["Enums"]["ad_placement"][]
          priority?: number
          qr_data?: string | null
          sponsor_name?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["ad_status"]
          target_area_lat?: number | null
          target_area_lng?: number | null
          target_area_radius_m?: number | null
          target_audience?: Database["public"]["Enums"]["ad_audience"]
          target_cities?: string[]
          target_max_rides?: number | null
          target_min_rides?: number | null
          title?: string
          type?: Database["public"]["Enums"]["ad_type"]
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          ride_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          ride_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          ride_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          admin_response: string | null
          category: string
          created_at: string
          id: string
          message: string
          priority: Database["public"]["Enums"]["complaint_priority"]
          responded_at: string | null
          responded_by: string | null
          ride_id: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          category: string
          created_at?: string
          id?: string
          message: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          responded_at?: string | null
          responded_by?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          category?: string
          created_at?: string
          id?: string
          message?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          responded_at?: string | null
          responded_by?: string | null
          ride_id?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      driver_alerts: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          lat: number | null
          lng: number | null
          message: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          ride_id: string | null
          type: Database["public"]["Enums"]["driver_alert_type"]
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          type: Database["public"]["Enums"]["driver_alert_type"]
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          ride_id?: string | null
          type?: Database["public"]["Enums"]["driver_alert_type"]
        }
        Relationships: []
      }
      driver_commissions: {
        Row: {
          amount: number
          batch_id: string | null
          created_at: string
          driver_id: string
          id: string
          paid_at: string | null
          paid_by: string | null
          ride_id: string
          status: Database["public"]["Enums"]["commission_status"]
        }
        Insert: {
          amount: number
          batch_id?: string | null
          created_at?: string
          driver_id: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          ride_id: string
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Update: {
          amount?: number
          batch_id?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          paid_at?: string | null
          paid_by?: string | null
          ride_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
        }
        Relationships: []
      }
      driver_documents: {
        Row: {
          account_status: Database["public"]["Enums"]["driver_account_status"]
          approved: boolean
          car_license_url: string | null
          car_model: string | null
          car_photo_url: string | null
          car_plate: string | null
          car_type: string | null
          change_request_message: string | null
          created_at: string
          driver_id: string
          driver_license_url: string | null
          dues_since: string | null
          fields_to_fix: string[]
          id: string
          id_card_back_url: string | null
          id_card_front_url: string | null
          is_online: boolean
          last_reminder_at: string | null
          next_attempt_at: string | null
          rejection_count: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string | null
          submitted_at: string | null
          suspension_reason: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          approved?: boolean
          car_license_url?: string | null
          car_model?: string | null
          car_photo_url?: string | null
          car_plate?: string | null
          car_type?: string | null
          change_request_message?: string | null
          created_at?: string
          driver_id: string
          driver_license_url?: string | null
          dues_since?: string | null
          fields_to_fix?: string[]
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          is_online?: boolean
          last_reminder_at?: string | null
          next_attempt_at?: string | null
          rejection_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          submitted_at?: string | null
          suspension_reason?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          approved?: boolean
          car_license_url?: string | null
          car_model?: string | null
          car_photo_url?: string | null
          car_plate?: string | null
          car_type?: string | null
          change_request_message?: string | null
          created_at?: string
          driver_id?: string
          driver_license_url?: string | null
          dues_since?: string | null
          fields_to_fix?: string[]
          id?: string
          id_card_back_url?: string | null
          id_card_front_url?: string | null
          is_online?: boolean
          last_reminder_at?: string | null
          next_attempt_at?: string | null
          rejection_count?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string | null
          submitted_at?: string | null
          suspension_reason?: string | null
        }
        Relationships: []
      }
      driver_location_history: {
        Row: {
          driver_id: string
          id: number
          lat: number
          lng: number
          recorded_at: string
          ride_id: string | null
          speed: number | null
        }
        Insert: {
          driver_id: string
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          ride_id?: string | null
          speed?: number | null
        }
        Update: {
          driver_id?: string
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          ride_id?: string | null
          speed?: number | null
        }
        Relationships: []
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          current_ride_id: string | null
          driver_id: string
          heading: number | null
          in_zone: boolean
          last_geofence_id: string | null
          lat: number
          lng: number
          presence: Database["public"]["Enums"]["driver_presence"]
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          current_ride_id?: string | null
          driver_id: string
          heading?: number | null
          in_zone?: boolean
          last_geofence_id?: string | null
          lat: number
          lng: number
          presence?: Database["public"]["Enums"]["driver_presence"]
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          current_ride_id?: string | null
          driver_id?: string
          heading?: number | null
          in_zone?: boolean
          last_geofence_id?: string | null
          lat?: number
          lng?: number
          presence?: Database["public"]["Enums"]["driver_presence"]
          speed?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      geofences: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          polygon: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          polygon: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          polygon?: Json
          updated_at?: string
        }
        Relationships: []
      }
      influencer_redemptions: {
        Row: {
          created_at: string
          discount_amount: number
          event_type: Database["public"]["Enums"]["influencer_event_type"]
          id: string
          influencer_id: string
          reward_amount: number
          ride_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          event_type: Database["public"]["Enums"]["influencer_event_type"]
          id?: string
          influencer_id: string
          reward_amount?: number
          ride_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          event_type?: Database["public"]["Enums"]["influencer_event_type"]
          id?: string
          influencer_id?: string
          reward_amount?: number
          ride_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_redemptions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_redemptions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          reward_type: Database["public"]["Enums"]["influencer_reward_type"]
          reward_value: number
          updated_at: string
          user_discount_value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          reward_type?: Database["public"]["Enums"]["influencer_reward_type"]
          reward_value?: number
          updated_at?: string
          user_discount_value?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          reward_type?: Database["public"]["Enums"]["influencer_reward_type"]
          reward_value?: number
          updated_at?: string
          user_discount_value?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      pricing_settings: {
        Row: {
          commission_rate: number
          id: string
          multipliers: Json
          multistop_hourly: number
          multistop_min: number
          oneway_base: number
          oneway_base_km: number
          oneway_per_km: number
          roundtrip_base: number
          roundtrip_base_km: number
          roundtrip_per_km: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_rate?: number
          id?: string
          multipliers?: Json
          multistop_hourly?: number
          multistop_min?: number
          oneway_base?: number
          oneway_base_km?: number
          oneway_per_km?: number
          roundtrip_base?: number
          roundtrip_base_km?: number
          roundtrip_per_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_rate?: number
          id?: string
          multipliers?: Json
          multistop_hourly?: number
          multistop_min?: number
          oneway_base?: number
          oneway_base_km?: number
          oneway_per_km?: number
          roundtrip_base?: number
          roundtrip_base_km?: number
          roundtrip_per_km?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          emergency_contacts: string[]
          full_name: string
          id: string
          phone: string | null
          rating: number | null
          referral_code: string | null
          referred_by: string | null
          referred_by_influencer: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          emergency_contacts?: string[]
          full_name?: string
          id: string
          phone?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_influencer?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          emergency_contacts?: string[]
          full_name?: string
          id?: string
          phone?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          referred_by_influencer?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_influencer_fkey"
            columns: ["referred_by_influencer"]
            isOneToOne: false
            referencedRelation: "influencer_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referred_by_influencer_fkey"
            columns: ["referred_by_influencer"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          ac_preference: string
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          custom_price: number | null
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          driver_rating_comment: string | null
          duration_min: number | null
          id: string
          landmark_note: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          price: number
          pricing_mode: string
          rating: number | null
          rating_comment: string | null
          ride_type: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          round_trip: boolean | null
          silent_ride: boolean
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
        }
        Insert: {
          ac_preference?: string
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          custom_price?: number | null
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          driver_rating_comment?: string | null
          duration_min?: number | null
          id?: string
          landmark_note?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price: number
          pricing_mode?: string
          rating?: number | null
          rating_comment?: string | null
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          round_trip?: boolean | null
          silent_ride?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
        }
        Update: {
          ac_preference?: string
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          custom_price?: number | null
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          driver_rating_comment?: string | null
          duration_min?: number | null
          id?: string
          landmark_note?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price?: number
          pricing_mode?: string
          rating?: number | null
          rating_comment?: string | null
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id?: string
          round_trip?: boolean | null
          silent_ride?: boolean
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          ride_id: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          type: Database["public"]["Enums"]["tx_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          ride_id?: string | null
          type?: Database["public"]["Enums"]["tx_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          amount: number
          created_at: string
          driver_id: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          driver_id: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          driver_id?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      influencer_stats: {
        Row: {
          active: boolean | null
          code: string | null
          created_at: string | null
          id: string | null
          name: string | null
          phone: string | null
          reward_type:
            | Database["public"]["Enums"]["influencer_reward_type"]
            | null
          reward_value: number | null
          rides_count: number | null
          signups_count: number | null
          total_discounts: number | null
          total_rewards: number | null
          user_discount_value: number | null
          users_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      ads_tick: { Args: never; Returns: Json }
      apply_influencer_code: { Args: { p_code: string }; Returns: Json }
      detect_idle_drivers: { Args: { p_minutes?: number }; Returns: number }
      driver_accept_ride: { Args: { p_ride_id: string }; Returns: boolean }
      has_admin_permission: {
        Args: {
          _perm: Database["public"]["Enums"]["admin_permission"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_all_overdue_paid: {
        Args: { p_min_amount?: number }
        Returns: number
      }
      mark_driver_paid: { Args: { p_driver_id: string }; Returns: number }
      point_in_polygon: {
        Args: { p_lat: number; p_lng: number; p_polygon: Json }
        Returns: boolean
      }
      trigger_driver_sos: {
        Args: { p_lat?: number; p_lng?: number; p_message?: string }
        Returns: string
      }
      update_driver_location: {
        Args: {
          p_accuracy?: number
          p_heading?: number
          p_lat: number
          p_lng: number
          p_presence?: Database["public"]["Enums"]["driver_presence"]
          p_ride_id?: string
          p_speed?: number
        }
        Returns: undefined
      }
    }
    Enums: {
      ad_audience: "riders" | "drivers" | "both"
      ad_event_type: "impression" | "click" | "conversion"
      ad_media_type: "image" | "video" | "gif" | "link" | "qr"
      ad_placement:
        | "home"
        | "book"
        | "waiting_driver"
        | "driver_app"
        | "pre_confirm"
        | "post_ride"
      ad_status: "draft" | "scheduled" | "active" | "paused" | "ended"
      ad_type:
        | "banner"
        | "popup"
        | "video"
        | "story"
        | "notification"
        | "fullscreen"
        | "reward"
      admin_permission:
        | "super_admin"
        | "assigner"
        | "full_control"
        | "viewer"
        | "notifications"
        | "collections"
      app_role: "rider" | "driver" | "admin"
      commission_status: "unpaid" | "paid"
      complaint_priority: "low" | "medium" | "high" | "urgent"
      complaint_status: "new" | "in_progress" | "resolved" | "closed"
      driver_account_status:
        | "active"
        | "suspended"
        | "banned"
        | "pending"
        | "rejected"
        | "changes_requested"
      driver_alert_type: "sos" | "idle" | "out_of_zone" | "speeding"
      driver_presence: "available" | "busy" | "offline"
      influencer_event_type: "signup" | "first_ride" | "ride_use"
      influencer_reward_type:
        | "discount"
        | "credit"
        | "ride_percentage"
        | "fixed_bonus"
      ride_status:
        | "searching"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      ride_type: "private" | "shared" | "package" | "female" | "vip"
      tx_type: "topup" | "ride_payment" | "refund" | "referral_bonus"
      withdrawal_status: "pending" | "approved" | "rejected"
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
      ad_audience: ["riders", "drivers", "both"],
      ad_event_type: ["impression", "click", "conversion"],
      ad_media_type: ["image", "video", "gif", "link", "qr"],
      ad_placement: [
        "home",
        "book",
        "waiting_driver",
        "driver_app",
        "pre_confirm",
        "post_ride",
      ],
      ad_status: ["draft", "scheduled", "active", "paused", "ended"],
      ad_type: [
        "banner",
        "popup",
        "video",
        "story",
        "notification",
        "fullscreen",
        "reward",
      ],
      admin_permission: [
        "super_admin",
        "assigner",
        "full_control",
        "viewer",
        "notifications",
        "collections",
      ],
      app_role: ["rider", "driver", "admin"],
      commission_status: ["unpaid", "paid"],
      complaint_priority: ["low", "medium", "high", "urgent"],
      complaint_status: ["new", "in_progress", "resolved", "closed"],
      driver_account_status: [
        "active",
        "suspended",
        "banned",
        "pending",
        "rejected",
        "changes_requested",
      ],
      driver_alert_type: ["sos", "idle", "out_of_zone", "speeding"],
      driver_presence: ["available", "busy", "offline"],
      influencer_event_type: ["signup", "first_ride", "ride_use"],
      influencer_reward_type: [
        "discount",
        "credit",
        "ride_percentage",
        "fixed_bonus",
      ],
      ride_status: [
        "searching",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      ride_type: ["private", "shared", "package", "female", "vip"],
      tx_type: ["topup", "ride_payment", "refund", "referral_bonus"],
      withdrawal_status: ["pending", "approved", "rejected"],
    },
  },
} as const
