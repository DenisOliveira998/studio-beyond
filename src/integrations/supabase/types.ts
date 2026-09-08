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
      author_applications: {
        Row: {
          artist_name: string
          bio: string
          created_at: string
          curator_note: string | null
          decided_at: string | null
          email: string
          field: string
          id: string
          message: string | null
          portfolio: string
          samples: number
          status: string
          user_id: string | null
        }
        Insert: {
          artist_name: string
          bio?: string
          created_at?: string
          curator_note?: string | null
          decided_at?: string | null
          email: string
          field?: string
          id?: string
          message?: string | null
          portfolio?: string
          samples?: number
          status?: string
          user_id?: string | null
        }
        Update: {
          artist_name?: string
          bio?: string
          created_at?: string
          curator_note?: string | null
          decided_at?: string | null
          email?: string
          field?: string
          id?: string
          message?: string | null
          portfolio?: string
          samples?: number
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          artist_name: string
          artist_slug: string
          created_at: string
          donor_id: string | null
          donor_name: string
          id: string
          work_slug: string
        }
        Insert: {
          amount: number
          artist_name?: string
          artist_slug?: string
          created_at?: string
          donor_id?: string | null
          donor_name?: string
          id?: string
          work_slug: string
        }
        Update: {
          amount?: number
          artist_name?: string
          artist_slug?: string
          created_at?: string
          donor_id?: string | null
          donor_name?: string
          id?: string
          work_slug?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          suspended: boolean
        }
        Insert: {
          created_at?: string
          email?: string
          id: string
          name?: string
          suspended?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          suspended?: boolean
        }
        Relationships: []
      }
      staff_emails: {
        Row: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          email: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          email?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      work_views: {
        Row: {
          updated_at: string
          views: number
          work_slug: string
        }
        Insert: {
          updated_at?: string
          views?: number
          work_slug: string
        }
        Update: {
          updated_at?: string
          views?: number
          work_slug?: string
        }
        Relationships: []
      }
      works: {
        Row: {
          artist_name: string
          artist_slug: string
          author_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          curator_note: string | null
          excerpt: string
          id: string
          medium: string
          published_at: string | null
          slug: string
          status: string
          tags: string | null
          title: string
        }
        Insert: {
          artist_name?: string
          artist_slug?: string
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          curator_note?: string | null
          excerpt?: string
          id?: string
          medium?: string
          published_at?: string | null
          slug: string
          status?: string
          tags?: string | null
          title: string
        }
        Update: {
          artist_name?: string
          artist_slug?: string
          author_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          curator_note?: string | null
          excerpt?: string
          id?: string
          medium?: string
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string | null
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_profile: {
        Args: { p_name?: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      decide_application: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
      }
      decide_work: {
        Args: { p_id: string; p_note?: string; p_status: string }
        Returns: undefined
      }
      donation_totals: {
        Args: never
        Returns: {
          supporters: number
          total: number
          work_slug: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      platform_totals: {
        Args: never
        Returns: {
          donation_count: number
          total_donations: number
          total_views: number
        }[]
      }
      register_work_view: { Args: { p_slug: string }; Returns: number }
      set_user_role: {
        Args: {
          p_replace?: boolean
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "curator" | "author" | "vip" | "reader"
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
    Enums: {
      app_role: ["admin", "curator", "author", "vip", "reader"],
    },
  },
} as const
