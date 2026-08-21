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
      ai_gif_requests: {
        Row: {
          created_at: string
          id: string
          moderation_status: string
          output_path: string | null
          prompt: string
          source_path: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          moderation_status?: string
          output_path?: string | null
          prompt?: string
          source_path: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          moderation_status?: string
          output_path?: string | null
          prompt?: string
          source_path?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      arcade_inventory: {
        Row: {
          created_at: string
          equipped: boolean
          id: string
          item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipped?: boolean
          id?: string
          item_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipped?: boolean
          id?: string
          item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "arcade_items"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_items: {
        Row: {
          created_at: string
          icon: string
          id: string
          key: string
          name: string
          rarity: string
          slot: string
          value_points: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          key: string
          name: string
          rarity: string
          slot: string
          value_points?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          key?: string
          name?: string
          rarity?: string
          slot?: string
          value_points?: number
        }
        Relationships: []
      }
      arcade_listings: {
        Row: {
          buyer_id: string | null
          created_at: string
          id: string
          inventory_id: string
          item_id: string
          price: number
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          inventory_id: string
          item_id: string
          price: number
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          inventory_id?: string
          item_id?: string
          price?: number
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_listings_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "arcade_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arcade_listings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "arcade_items"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_matches: {
        Row: {
          crate_opened: boolean
          created_at: string
          id: string
          player_a: string
          player_b: string | null
          score_a: number
          score_b: number
          winner_id: string | null
        }
        Insert: {
          crate_opened?: boolean
          created_at?: string
          id?: string
          player_a: string
          player_b?: string | null
          score_a?: number
          score_b?: number
          winner_id?: string | null
        }
        Update: {
          crate_opened?: boolean
          created_at?: string
          id?: string
          player_a?: string
          player_b?: string | null
          score_a?: number
          score_b?: number
          winner_id?: string | null
        }
        Relationships: []
      }
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
      call_participants: {
        Row: {
          call_id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_id: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      call_rooms: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          group_id: string | null
          id: string
          kind: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          kind: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          group_id?: string | null
          id?: string
          kind?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_rooms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dm_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          id: string
          payload: Json
          recipient_id: string | null
          sender_id: string
          signal_type: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          sender_id: string
          signal_type: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          payload?: Json
          recipient_id?: string | null
          sender_id?: string
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      case_opening_history: {
        Row: {
          case_cost: number
          case_id: string
          created_at: string
          id: string
          rarity: string
          reward_czk: number
          reward_label: string
          user_id: string
        }
        Insert: {
          case_cost: number
          case_id: string
          created_at?: string
          id?: string
          rarity: string
          reward_czk: number
          reward_label: string
          user_id: string
        }
        Update: {
          case_cost?: number
          case_id?: string
          created_at?: string
          id?: string
          rarity?: string
          reward_czk?: number
          reward_label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_opening_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_opening_stock_cases: {
        Row: {
          accent: string
          active: boolean
          cost: number
          description: string
          id: string
          name: string
          sector: string
        }
        Insert: {
          accent?: string
          active?: boolean
          cost: number
          description: string
          id: string
          name: string
          sector: string
        }
        Update: {
          accent?: string
          active?: boolean
          cost?: number
          description?: string
          id?: string
          name?: string
          sector?: string
        }
        Relationships: []
      }
      case_opening_stock_companies: {
        Row: {
          company_name: string
          company_tier: number
          id: number
          rarity_note: string
          sector: string
          ticker: string
        }
        Insert: {
          company_name: string
          company_tier: number
          id?: number
          rarity_note: string
          sector: string
          ticker: string
        }
        Update: {
          company_name?: string
          company_tier?: number
          id?: number
          rarity_note?: string
          sector?: string
          ticker?: string
        }
        Relationships: []
      }
      case_opening_stock_history: {
        Row: {
          case_cost: number
          case_id: string
          company_name: string
          created_at: string
          id: string
          rarity: string
          rarity_score: number
          sector: string
          serial: string
          share_count: number
          ticker: string
          user_id: string
        }
        Insert: {
          case_cost: number
          case_id: string
          company_name: string
          created_at?: string
          id?: string
          rarity: string
          rarity_score: number
          sector: string
          serial: string
          share_count: number
          ticker: string
          user_id: string
        }
        Update: {
          case_cost?: number
          case_id?: string
          company_name?: string
          created_at?: string
          id?: string
          rarity?: string
          rarity_score?: number
          sector?: string
          serial?: string
          share_count?: number
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_opening_stock_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_opening_stock_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_stock_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_stock_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_opening_stock_inventory: {
        Row: {
          case_id: string
          company_id: number
          company_name: string
          created_at: string
          id: string
          rarity: string
          rarity_score: number
          sector: string
          serial: string
          share_count: number
          ticker: string
          user_id: string
        }
        Insert: {
          case_id: string
          company_id: number
          company_name: string
          created_at?: string
          id?: string
          rarity: string
          rarity_score: number
          sector: string
          serial: string
          share_count: number
          ticker: string
          user_id: string
        }
        Update: {
          case_id?: string
          company_id?: number
          company_name?: string
          created_at?: string
          id?: string
          rarity?: string
          rarity_score?: number
          sector?: string
          serial?: string
          share_count?: number
          ticker?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_opening_stock_inventory_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_opening_stock_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_stock_inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "case_opening_stock_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_stock_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_opening_stock_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_chat: {
        Row: {
          content: string | null
          created_at: string
          emoji: string | null
          id: string
          nickname: string
          room: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nickname: string
          room: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nickname?: string
          room?: string
          user_id?: string
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
      daily_bonus_claims: {
        Row: {
          last_claim_at: string
          user_id: string
        }
        Insert: {
          last_claim_at?: string
          user_id: string
        }
        Update: {
          last_claim_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      dm_group_members: {
        Row: {
          group_id: string
          is_admin: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          is_admin?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          is_admin?: boolean
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dm_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "dm_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      fc_cards: {
        Row: {
          alt_positions: string[]
          attrs: Json
          base_rating: number | null
          campaign: string | null
          card_type: string
          club: string
          created_at: string
          def: number
          dri: number
          id: string
          image_url: string | null
          key: string
          league: string
          name: string
          nation: string
          pac: number
          pas: number
          phy: number
          player_id: string | null
          playstyles: string[]
          playstyles_plus: string[]
          position: string
          quick_sell: number
          rarity: string
          rating: number
          roles: string[]
          sho: number
        }
        Insert: {
          alt_positions?: string[]
          attrs?: Json
          base_rating?: number | null
          campaign?: string | null
          card_type?: string
          club: string
          created_at?: string
          def?: number
          dri?: number
          id?: string
          image_url?: string | null
          key: string
          league?: string
          name: string
          nation: string
          pac?: number
          pas?: number
          phy?: number
          player_id?: string | null
          playstyles?: string[]
          playstyles_plus?: string[]
          position: string
          quick_sell?: number
          rarity?: string
          rating: number
          roles?: string[]
          sho?: number
        }
        Update: {
          alt_positions?: string[]
          attrs?: Json
          base_rating?: number | null
          campaign?: string | null
          card_type?: string
          club?: string
          created_at?: string
          def?: number
          dri?: number
          id?: string
          image_url?: string | null
          key?: string
          league?: string
          name?: string
          nation?: string
          pac?: number
          pas?: number
          phy?: number
          player_id?: string | null
          playstyles?: string[]
          playstyles_plus?: string[]
          position?: string
          quick_sell?: number
          rarity?: string
          rating?: number
          roles?: string[]
          sho?: number
        }
        Relationships: [
          {
            foreignKeyName: "fc_cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "fc_players"
            referencedColumns: ["id"]
          },
        ]
      }
      fc_challenges: {
        Row: {
          created_at: string
          host_id: string
          host_ready: boolean
          id: string
          mode: string
          opponent_id: string | null
          opponent_ready: boolean
          ovr_cap: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          host_id: string
          host_ready?: boolean
          id?: string
          mode?: string
          opponent_id?: string | null
          opponent_ready?: boolean
          ovr_cap?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          host_id?: string
          host_ready?: boolean
          id?: string
          mode?: string
          opponent_id?: string | null
          opponent_ready?: boolean
          ovr_cap?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fc_clubs: {
        Row: {
          badge: string
          club_name: string
          coins: number
          created_at: string
          event_tokens: number
          kit: string
          last_daily_spin_at: string | null
          luck_meter: number
          spin_tokens: number
          stadium: string
          starter_granted: boolean
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          badge?: string
          club_name: string
          coins?: number
          created_at?: string
          event_tokens?: number
          kit?: string
          last_daily_spin_at?: string | null
          luck_meter?: number
          spin_tokens?: number
          stadium?: string
          starter_granted?: boolean
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          badge?: string
          club_name?: string
          coins?: number
          created_at?: string
          event_tokens?: number
          kit?: string
          last_daily_spin_at?: string | null
          luck_meter?: number
          spin_tokens?: number
          stadium?: string
          starter_granted?: boolean
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      fc_coin_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          currency: string
          id: string
          meta: Json
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          currency?: string
          id?: string
          meta?: Json
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          currency?: string
          id?: string
          meta?: Json
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      fc_packs: {
        Row: {
          created_at: string
          id: string
          opened: boolean
          pack_type: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opened?: boolean
          pack_type?: string
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opened?: boolean
          pack_type?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      fc_players: {
        Row: {
          alt_positions: string[]
          club: string
          created_at: string
          id: string
          key: string
          league: string
          name: string
          nation: string
          preferred_foot: string
          primary_position: string
          skills: number
          weak_foot: number
        }
        Insert: {
          alt_positions?: string[]
          club: string
          created_at?: string
          id?: string
          key: string
          league: string
          name: string
          nation: string
          preferred_foot?: string
          primary_position: string
          skills?: number
          weak_foot?: number
        }
        Update: {
          alt_positions?: string[]
          club?: string
          created_at?: string
          id?: string
          key?: string
          league?: string
          name?: string
          nation?: string
          preferred_foot?: string
          primary_position?: string
          skills?: number
          weak_foot?: number
        }
        Relationships: []
      }
      fc_spin_probabilities: {
        Row: {
          id: string
          max_rating: number
          min_rating: number
          rarity: string
          spin_type: string
          weight: number
        }
        Insert: {
          id?: string
          max_rating?: number
          min_rating?: number
          rarity: string
          spin_type: string
          weight: number
        }
        Update: {
          id?: string
          max_rating?: number
          min_rating?: number
          rarity?: string
          spin_type?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "fc_spin_probabilities_spin_type_fkey"
            columns: ["spin_type"]
            isOneToOne: false
            referencedRelation: "fc_spin_types"
            referencedColumns: ["key"]
          },
        ]
      }
      fc_spin_transactions: {
        Row: {
          card_id: string | null
          created_at: string
          duplicate: boolean
          id: string
          pity_used: boolean
          rarity: string
          spin_type: string
          user_id: string
        }
        Insert: {
          card_id?: string | null
          created_at?: string
          duplicate?: boolean
          id?: string
          pity_used?: boolean
          rarity: string
          spin_type: string
          user_id: string
        }
        Update: {
          card_id?: string | null
          created_at?: string
          duplicate?: boolean
          id?: string
          pity_used?: boolean
          rarity?: string
          spin_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fc_spin_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "fc_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      fc_spin_types: {
        Row: {
          cooldown_hours: number | null
          cost_coins: number
          cost_event_tokens: number
          cost_tokens: number
          enabled: boolean
          key: string
          label: string
          pity_threshold: number
          sort_order: number
        }
        Insert: {
          cooldown_hours?: number | null
          cost_coins?: number
          cost_event_tokens?: number
          cost_tokens?: number
          enabled?: boolean
          key: string
          label: string
          pity_threshold?: number
          sort_order?: number
        }
        Update: {
          cooldown_hours?: number | null
          cost_coins?: number
          cost_event_tokens?: number
          cost_tokens?: number
          enabled?: boolean
          key?: string
          label?: string
          pity_threshold?: number
          sort_order?: number
        }
        Relationships: []
      }
      fc_squad_players: {
        Row: {
          created_at: string
          id: string
          is_captain: boolean
          position: string
          slot_key: string
          squad_role: string
          squad_user_id: string
          updated_at: string
          user_card_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_captain?: boolean
          position: string
          slot_key: string
          squad_role?: string
          squad_user_id: string
          updated_at?: string
          user_card_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_captain?: boolean
          position?: string
          slot_key?: string
          squad_role?: string
          squad_user_id?: string
          updated_at?: string
          user_card_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fc_squad_players_card_fk"
            columns: ["user_card_id"]
            isOneToOne: false
            referencedRelation: "fc_user_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fc_squad_players_squad_fk"
            columns: ["squad_user_id"]
            isOneToOne: false
            referencedRelation: "fc_squads"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fc_squads: {
        Row: {
          chemistry: number
          created_at: string
          formation: string
          id: string
          is_active: boolean
          name: string
          slots: Json
          team_ovr: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          chemistry?: number
          created_at?: string
          formation?: string
          id?: string
          is_active?: boolean
          name?: string
          slots?: Json
          team_ovr?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          chemistry?: number
          created_at?: string
          formation?: string
          id?: string
          is_active?: boolean
          name?: string
          slots?: Json
          team_ovr?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      fc_user_cards: {
        Row: {
          card_id: string
          created_at: string
          favorite: boolean
          id: string
          locked: boolean
          source: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          favorite?: boolean
          id?: string
          locked?: boolean
          source?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          favorite?: boolean
          id?: string
          locked?: boolean
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fc_user_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "fc_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      match_elo_applications: {
        Row: {
          applied_at: string
          match_id: string
        }
        Insert: {
          applied_at?: string
          match_id: string
        }
        Update: {
          applied_at?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_elo_applications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_notification_jobs: {
        Row: {
          channel: string
          created_at: string
          dedupe_key: string
          error_message: string | null
          id: string
          match_id: string
          match_scheduled_at: string | null
          opponent: string | null
          scheduled_for: string
          sent_at: string | null
          sport: string | null
          status: string
          user_id: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          dedupe_key: string
          error_message?: string | null
          id?: string
          match_id: string
          match_scheduled_at?: string | null
          opponent?: string | null
          scheduled_for: string
          sent_at?: string | null
          sport?: string | null
          status?: string
          user_id: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          dedupe_key?: string
          error_message?: string | null
          id?: string
          match_id?: string
          match_scheduled_at?: string | null
          opponent?: string | null
          scheduled_for?: string
          sent_at?: string | null
          sport?: string | null
          status?: string
          user_id?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_notification_jobs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_notification_preferences: {
        Row: {
          reminder_minutes: number
          sms_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          reminder_minutes?: number
          sms_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          reminder_minutes?: number
          sms_enabled?: boolean
          updated_at?: string
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
          match_format: string
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
          team_a_players: Json
          team_a_ref: string | null
          team_b: string
          team_b_players: Json
          team_b_ref: string | null
          tournament_id: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          bets?: Json
          bets_locked_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          match_format?: string
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
          team_a_players?: Json
          team_a_ref?: string | null
          team_b: string
          team_b_players?: Json
          team_b_ref?: string | null
          tournament_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          bets?: Json
          bets_locked_at?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          match_format?: string
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
          team_a_players?: Json
          team_a_ref?: string | null
          team_b?: string
          team_b_players?: Json
          team_b_ref?: string | null
          tournament_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          tournament_id: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          tournament_id?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          tournament_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_verifications: {
        Row: {
          phone_public: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          phone_public?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          phone_public?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      poker_seats: {
        Row: {
          chips: number
          created_at: string
          id: string
          nickname: string
          seat_no: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          chips?: number
          created_at?: string
          id?: string
          nickname: string
          seat_no: number
          tournament_id: string
          user_id: string
        }
        Update: {
          chips?: number
          created_at?: string
          id?: string
          nickname?: string
          seat_no?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poker_seats_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "poker_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      poker_tournaments: {
        Row: {
          buy_in: number
          created_at: string
          created_by: string
          hand: Json | null
          id: string
          max_players: number
          name: string
          starting_chips: number
          status: string
          updated_at: string
        }
        Insert: {
          buy_in: number
          created_at?: string
          created_by: string
          hand?: Json | null
          id?: string
          max_players?: number
          name: string
          starting_chips?: number
          status?: string
          updated_at?: string
        }
        Update: {
          buy_in?: number
          created_at?: string
          created_by?: string
          hand?: Json | null
          id?: string
          max_players?: number
          name?: string
          starting_chips?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          arcade_points: number
          avatar_path: string | null
          balance: number
          created_at: string
          elo: number
          id: string
          nickname: string
          slot_czk: number
          updated_at: string
        }
        Insert: {
          arcade_points?: number
          avatar_path?: string | null
          balance?: number
          created_at?: string
          elo?: number
          id: string
          nickname: string
          slot_czk?: number
          updated_at?: string
        }
        Update: {
          arcade_points?: number
          avatar_path?: string | null
          balance?: number
          created_at?: string
          elo?: number
          id?: string
          nickname?: string
          slot_czk?: number
          updated_at?: string
        }
        Relationships: []
      }
      roulette_bets: {
        Row: {
          amount: number
          bet_type: string
          bet_value: string | null
          created_at: string
          id: string
          nickname: string
          payout: number | null
          round_no: number
          settled: boolean
          user_id: string
        }
        Insert: {
          amount: number
          bet_type: string
          bet_value?: string | null
          created_at?: string
          id?: string
          nickname: string
          payout?: number | null
          round_no: number
          settled?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          bet_type?: string
          bet_value?: string | null
          created_at?: string
          id?: string
          nickname?: string
          payout?: number | null
          round_no?: number
          settled?: boolean
          user_id?: string
        }
        Relationships: []
      }
      roulette_rounds: {
        Row: {
          created_at: string
          result: number
          round_no: number
        }
        Insert: {
          created_at?: string
          result: number
          round_no: number
        }
        Update: {
          created_at?: string
          result?: number
          round_no?: number
        }
        Relationships: []
      }
      roulette_settlement_ledger: {
        Row: {
          paid: number
          result: number
          round_no: number
          settled_at: string
        }
        Insert: {
          paid?: number
          result: number
          round_no: number
          settled_at?: string
        }
        Update: {
          paid?: number
          result?: number
          round_no?: number
          settled_at?: string
        }
        Relationships: []
      }
      slot_bonus_sessions: {
        Row: {
          base_bet: number | null
          created_at: string
          multiplier: number | null
          options: Json
          pending_pick: boolean
          spins_remaining: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_bet?: number | null
          created_at?: string
          multiplier?: number | null
          options?: Json
          pending_pick?: boolean
          spins_remaining?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_bet?: number | null
          created_at?: string
          multiplier?: number | null
          options?: Json
          pending_pick?: boolean
          spins_remaining?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      slot_sessions: {
        Row: {
          bet_amount: number
          completed_at: string | null
          created_at: string
          id: string
          result: Json | null
          status: string
          user_id: string
        }
        Insert: {
          bet_amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          result?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          result?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      slot_variant_bonus_sessions: {
        Row: {
          bonus_total: number
          collector: number
          free_spins_remaining: number
          game_id: string
          mode: string
          multiplier: number
          retriggers: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_total?: number
          collector?: number
          free_spins_remaining?: number
          game_id: string
          mode: string
          multiplier?: number
          retriggers?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_total?: number
          collector?: number
          free_spins_remaining?: number
          game_id?: string
          mode?: string
          multiplier?: number
          retriggers?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_variant_bonus_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_variant_bonus_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      telegram_link_sessions: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          telegram_chat_id: number | null
          token: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          telegram_chat_id?: number | null
          token: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          telegram_chat_id?: number | null
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_verifications: {
        Row: {
          created_at: string
          notifications_enabled: boolean
          phone_hash: string
          phone_last4: string
          phone_number: string | null
          phone_public: boolean
          telegram_chat_id: number | null
          telegram_user_id: number
          telegram_username: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          notifications_enabled?: boolean
          phone_hash: string
          phone_last4: string
          phone_number?: string | null
          phone_public?: boolean
          telegram_chat_id?: number | null
          telegram_user_id: number
          telegram_username?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          notifications_enabled?: boolean
          phone_hash?: string
          phone_last4?: string
          phone_number?: string | null
          phone_public?: boolean
          telegram_chat_id?: number | null
          telegram_user_id?: number
          telegram_username?: string | null
          user_id?: string
          verified_at?: string
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
      user_locations: {
        Row: {
          accuracy_m: number | null
          enabled: boolean
          latitude: number
          longitude: number
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          accuracy_m?: number | null
          enabled?: boolean
          latitude: number
          longitude: number
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          accuracy_m?: number | null
          enabled?: boolean
          latitude?: number
          longitude?: number
          updated_at?: string
          user_id?: string
          visibility?: string
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
      venues: {
        Row: {
          address: string | null
          booking_url: string | null
          city: string
          created_at: string
          hours: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          map_url: string | null
          name: string
          note: string
          phone: string | null
          sort_order: number
          sports: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_url?: string | null
          city: string
          created_at?: string
          hours?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name: string
          note?: string
          phone?: string | null
          sort_order?: number
          sports?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_url?: string | null
          city?: string
          created_at?: string
          hours?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name?: string
          note?: string
          phone?: string | null
          sort_order?: number
          sports?: string
          updated_at?: string
        }
        Relationships: []
      }
      wallet_betting_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          match_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          match_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          match_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_betting_ledger_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_betting_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profile_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_betting_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_bonus_claims: {
        Row: {
          last_claim_at: string | null
          user_id: string
        }
        Insert: {
          last_claim_at?: string | null
          user_id: string
        }
        Update: {
          last_claim_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      profile_public: {
        Row: {
          arcade_points: number | null
          avatar_path: string | null
          created_at: string | null
          elo: number | null
          id: string | null
          nickname: string | null
          updated_at: string | null
        }
        Insert: {
          arcade_points?: number | null
          avatar_path?: string | null
          created_at?: string | null
          elo?: number | null
          id?: string | null
          nickname?: string | null
          updated_at?: string | null
        }
        Update: {
          arcade_points?: number | null
          avatar_path?: string | null
          created_at?: string | null
          elo?: number | null
          id?: string | null
          nickname?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_remove_bet: {
        Args: { _bet_id: string; _match_id: string }
        Returns: undefined
      }
      advance_bracket_from: { Args: { _match_id: string }; Returns: undefined }
      arcade_buy_listing: { Args: { _listing_id: string }; Returns: Json }
      arcade_cancel_listing: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      arcade_equip: {
        Args: { _equip: boolean; _inventory_id: string }
        Returns: undefined
      }
      arcade_list_item: {
        Args: { _inventory_id: string; _price: number }
        Returns: string
      }
      arcade_open_crate: { Args: { _match_id: string }; Returns: Json }
      arcade_report_match: {
        Args: { _opponent: string; _score_a: number; _score_b: number }
        Returns: string
      }
      call_participant_snapshot: {
        Args: { _call_id: string }
        Returns: {
          joined_at: string
          nickname: string
          user_id: string
        }[]
      }
      case_opening_open: { Args: { _case_id: string }; Returns: Json }
      case_opening_stock_inventory_summary: { Args: never; Returns: Json }
      case_opening_stock_open: { Args: { _case_id: string }; Returns: Json }
      confirm_match: {
        Args: { _confirm: boolean; _match_id: string }
        Returns: undefined
      }
      create_call: {
        Args: { _group_id?: string; _peer_id?: string }
        Returns: string
      }
      create_dm_group: {
        Args: { _member_ids: string[]; _name: string }
        Returns: string
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
      daily_bonus_claim: { Args: never; Returns: Json }
      daily_bonus_spin: { Args: never; Returns: Json }
      daily_bonus_status: { Args: never; Returns: Json }
      fc_club_get: { Args: never; Returns: Json }
      fc_club_rename: { Args: { _name: string }; Returns: undefined }
      fc_create_challenge: {
        Args: { _mode: string; _opponent: string; _ovr_cap: number }
        Returns: string
      }
      fc_grant_pack: {
        Args: { _pack_type: string; _source?: string }
        Returns: string
      }
      fc_open_pack: { Args: { _pack_id: string }; Returns: Json }
      fc_quick_sell: { Args: { _user_card_id: string }; Returns: Json }
      fc_respond_challenge: {
        Args: { _accept: boolean; _challenge_id: string }
        Returns: undefined
      }
      fc_save_squad: {
        Args: {
          _chemistry: number
          _formation: string
          _slots: Json
          _team_ovr: number
        }
        Returns: undefined
      }
      fc_seed_card: {
        Args: {
          _alt?: string[]
          _card_type?: string
          _club: string
          _def: number
          _dri: number
          _key: string
          _league: string
          _name: string
          _nation: string
          _pac: number
          _pas: number
          _phy: number
          _playstyles?: string[]
          _pos: string
          _rarity: string
          _rating: number
          _roles?: string[]
          _sho: number
        }
        Returns: string
      }
      fc_seed_catalog: { Args: never; Returns: number }
      fc_set_card_flags: {
        Args: { _favorite: boolean; _locked: boolean; _user_card_id: string }
        Returns: undefined
      }
      fc_set_ready: {
        Args: { _challenge_id: string; _ready: boolean }
        Returns: undefined
      }
      fc_spin: { Args: { _spin_type: string }; Returns: Json }
      fc_squad_create: {
        Args: { _formation?: string; _name?: string }
        Returns: Json
      }
      fc_squad_get_active: { Args: never; Returns: Json }
      fc_squad_match_readiness: { Args: { _squad_id: string }; Returns: Json }
      fc_squad_metrics: { Args: { _squad_id: string }; Returns: Json }
      fc_squad_save: {
        Args: {
          _expected_version: number
          _formation: string
          _name: string
          _players: Json
          _squad_id: string
        }
        Returns: Json
      }
      generate_tournament_notifications: { Args: never; Returns: number }
      get_my_betting_ledger: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          created_at: string
          id: string
          kind: string
          match_id: string
          user_id: string
        }[]
      }
      get_my_match_notification_jobs: {
        Args: never
        Returns: {
          id: string
          match_id: string
          match_scheduled_at: string
          opponent: string
          scheduled_for: string
          sport: string
          status: string
          venue_address: string
          venue_name: string
        }[]
      }
      get_my_wallet: { Args: never; Returns: Json }
      get_public_user_location: {
        Args: { _user_id: string }
        Returns: {
          accuracy_m: number
          latitude: number
          longitude: number
          stale: boolean
          updated_at: string
          user_id: string
        }[]
      }
      get_public_verified_phone: {
        Args: { _user_id: string }
        Returns: {
          phone_number: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_call_participant: {
        Args: { _call_id: string; _user_id?: string }
        Returns: boolean
      }
      is_dm_group_member: {
        Args: { _group_id: string; _user_id?: string }
        Returns: boolean
      }
      join_call: { Args: { _call_id: string }; Returns: boolean }
      leave_call: { Args: { _call_id: string }; Returns: boolean }
      notify_win: {
        Args: { _body: string; _kind: string; _title: string; _user_id: string }
        Returns: undefined
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
      place_market_bet: {
        Args: {
          _amount: number
          _locked_odds: number
          _market_id: string
          _match_id: string
          _note: string
          _option_id: string
          _pick: string
        }
        Returns: Json
      }
      poker_action: {
        Args: { _action: string; _amount?: number; _tournament_id: string }
        Returns: Json
      }
      poker_board_from_deck: { Args: { _deck: Json }; Returns: Json }
      poker_cancel_tournament: {
        Args: { _tournament_id: string }
        Returns: Json
      }
      poker_cash_out: { Args: { _tournament_id: string }; Returns: Json }
      poker_create_tournament: {
        Args: {
          _buy_in: number
          _max_players: number
          _name: string
          _starting_chips: number
        }
        Returns: string
      }
      poker_eval7: { Args: { _cards: Json }; Returns: Json }
      poker_finish_hand: { Args: { _hand: Json }; Returns: Json }
      poker_join: { Args: { _tournament_id: string }; Returns: Json }
      poker_list_tournaments: { Args: never; Returns: Json[] }
      poker_next_player: {
        Args: { _from: number; _players: Json }
        Returns: number
      }
      poker_post: {
        Args: { _amount: number; _hand: Json; _idx: number }
        Returns: Json
      }
      poker_public_hand: { Args: { _hand: Json; _uid: string }; Returns: Json }
      poker_score5: { Args: { _cards: Json }; Returns: Json }
      poker_start_hand: { Args: { _tournament_id: string }; Returns: Json }
      poker_sync_chips: {
        Args: { _stacks: Json; _tournament_id: string }
        Returns: undefined
      }
      poker_tick: { Args: { _tournament_id: string }; Returns: Json }
      roulette_cancel_bets: { Args: { _round_no: number }; Returns: Json }
      roulette_place_bet: {
        Args: {
          _amount: number
          _bet_type: string
          _bet_value: string
          _round_no: number
        }
        Returns: Json
      }
      roulette_result: { Args: { _round_no: number }; Returns: number }
      roulette_settle: { Args: { _round_no: number }; Returns: Json }
      save_match_score: {
        Args: {
          _ended_at?: string
          _match_id: string
          _score_a: number
          _score_b: number
          _sets?: Json
        }
        Returns: {
          bets: Json
          bets_locked_at: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          ended_at: string | null
          id: string
          match_format: string
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
          team_a_players: Json
          team_a_ref: string | null
          team_b: string
          team_b_players: Json
          team_b_ref: string | null
          tournament_id: string | null
          updated_at: string
          venue_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "matches"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      schedule_match_sms_reminder: {
        Args: { _match_id: string }
        Returns: number
      }
      set_phone_public: { Args: { _enabled: boolean }; Returns: boolean }
      set_tournament_schedule: {
        Args: { _scheduled_at: string; _tournament_id: string }
        Returns: undefined
      }
      settle_match: { Args: { _match_id: string }; Returns: undefined }
      slot_epic_spin: {
        Args: { _bet?: number; _game_id: string }
        Returns: Json
      }
      slot_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          best_multiplier: number
          best_win: number
          nickname: string
          spins: number
          user_id: string
        }[]
      }
      slot_pick_bonus: { Args: { _multiplier: number }; Returns: Json }
      slot_spin: { Args: { _bet: number }; Returns: Json }
      slot_variant_spin: {
        Args: { _bet?: number; _game_id: string }
        Returns: Json
      }
      sync_match_elo: { Args: { _match_id: string }; Returns: undefined }
      telegram_bind_chat: {
        Args: { _telegram_chat_id: number; _token: string }
        Returns: boolean
      }
      telegram_complete_link: {
        Args: {
          _phone_hash: string
          _phone_last4: string
          _telegram_chat_id: number
          _telegram_user_id: number
          _telegram_username: string
          _token: string
        }
        Returns: string
      }
      telegram_pending_token: {
        Args: { _telegram_chat_id: number }
        Returns: string
      }
      telegram_start_link: {
        Args: never
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      wallet_apply: {
        Args: {
          _delta_dollars?: number
          _delta_slot_czk?: number
          _reason?: string
        }
        Returns: Json
      }
      wallet_betting_credit: {
        Args: {
          _amount: number
          _match_id?: string
          _reason?: string
          _user_id: string
        }
        Returns: number
      }
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
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "high_roller"
        | "case_opener"
        | "restricted"
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "high_roller",
        "case_opener",
        "restricted",
      ],
    },
  },
} as const
