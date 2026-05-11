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
          created_at: string
          driver_id: string
          driver_license_url: string | null
          dues_since: string | null
          id: string
          is_online: boolean
          last_reminder_at: string | null
          rejection_reason: string | null
          suspension_reason: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          approved?: boolean
          car_license_url?: string | null
          car_model?: string | null
          car_photo_url?: string | null
          car_plate?: string | null
          created_at?: string
          driver_id: string
          driver_license_url?: string | null
          dues_since?: string | null
          id?: string
          is_online?: boolean
          last_reminder_at?: string | null
          rejection_reason?: string | null
          suspension_reason?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["driver_account_status"]
          approved?: boolean
          car_license_url?: string | null
          car_model?: string | null
          car_photo_url?: string | null
          car_plate?: string | null
          created_at?: string
          driver_id?: string
          driver_license_url?: string | null
          dues_since?: string | null
          id?: string
          is_online?: boolean
          last_reminder_at?: string | null
          rejection_reason?: string | null
          suspension_reason?: string | null
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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          rating: number | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          wallet_balance: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          wallet_balance?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          rating?: number | null
          referral_code?: string | null
          referred_by?: string | null
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
        ]
      }
      rides: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          distance_km: number | null
          driver_id: string | null
          duration_min: number | null
          id: string
          pickup_address: string
          pickup_lat: number | null
          pickup_lng: number | null
          price: number
          rating: number | null
          rating_comment: string | null
          ride_type: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          round_trip: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"]
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          duration_min?: number | null
          id?: string
          pickup_address: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price: number
          rating?: number | null
          rating_comment?: string | null
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id: string
          round_trip?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"]
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          distance_km?: number | null
          driver_id?: string | null
          duration_min?: number | null
          id?: string
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lng?: number | null
          price?: number
          rating?: number | null
          rating_comment?: string | null
          ride_type?: Database["public"]["Enums"]["ride_type"]
          rider_id?: string
          round_trip?: boolean | null
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
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
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
      driver_account_status: "active" | "suspended" | "banned"
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
      driver_account_status: ["active", "suspended", "banned"],
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
