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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_nickname: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          match_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_nickname?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          match_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_nickname?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          match_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          nickname: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          nickname: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          nickname?: string
          user_id?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          bets: Json
          bets_locked_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          owner_id: string
          round: number | null
          scheduled_at: string | null
          score_a: number
          score_b: number
          sets: Json
          slot: number | null
          sport: string
          started_at: string
          team_a: string
          team_a_ref: string | null
          team_b: string
          team_b_ref: string | null
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          bets?: Json
          bets_locked_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_id: string
          round?: number | null
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          sets?: Json
          slot?: number | null
          sport: string
          started_at?: string
          team_a: string
          team_a_ref?: string | null
          team_b: string
          team_b_ref?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          bets?: Json
          bets_locked_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          owner_id?: string
          round?: number | null
          scheduled_at?: string | null
          score_a?: number
          score_b?: number
          sets?: Json
          slot?: number | null
          sport?: string
          started_at?: string
          team_a?: string
          team_a_ref?: string | null
          team_b?: string
          team_b_ref?: string | null
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          balance: number
          created_at: string
          id: string
          nickname: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          balance?: number
          created_at?: string
          id: string
          nickname: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          balance?: number
          created_at?: string
          id?: string
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tournament_teams: {
        Row: {
          created_at: string
          id: string
          name: string
          players: string[]
          seed: number
          tournament_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          players?: string[]
          seed?: number
          tournament_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          players?: string[]
          seed?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string
          format: string
          id: string
          name: string
          scheduled_at: string | null
          sport: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          format: string
          id?: string
          name: string
          scheduled_at?: string | null
          sport: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          format?: string
          id?: string
          name?: string
          scheduled_at?: string | null
          sport?: string
          status?: string
          updated_at?: string
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
      admin_remove_bet: {
        Args: { _bet_id: string; _match_id: string }
        Returns: undefined
      }
      advance_bracket_from: { Args: { _match_id: string }; Returns: undefined }
      confirm_match: {
        Args: { _confirm: boolean; _match_id: string }
        Returns: undefined
      }
      create_tournament:
        | {
            Args: {
              _format: string
              _name: string
              _sport: string
              _teams: string[]
            }
            Returns: string
          }
        | {
            Args: {
              _format: string
              _name: string
              _players: Json
              _sport: string
              _teams: string[]
            }
            Returns: string
          }
        | {
            Args: {
              _format: string
              _name: string
              _players: Json
              _scheduled_at: string
              _sport: string
              _teams: string[]
            }
            Returns: string
          }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_bet: {
        Args: {
          _amount: number
          _match_id: string
          _note: string
          _pick: string
        }
        Returns: Json
      }
      set_tournament_schedule: {
        Args: { _scheduled_at: string; _tournament_id: string }
        Returns: undefined
      }
      settle_match: { Args: { _match_id: string }; Returns: undefined }
      withdraw_bet: { Args: { _match_id: string }; Returns: Json }
      write_audit: {
        Args: {
          _action: string
          _details: Json
          _entity_id: string
          _entity_type: string
          _match_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
