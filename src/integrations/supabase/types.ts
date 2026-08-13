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
          slots: Json
          team_ovr: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chemistry?: number
          created_at?: string
          formation?: string
          slots?: Json
          team_ovr?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chemistry?: number
          created_at?: string
          formation?: string
          slots?: Json
          team_ovr?: number
          updated_at?: string
          user_id?: string
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
      [_ in never]: never
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      poker_join: { Args: { _tournament_id: string }; Returns: Json }
      poker_sync_chips: {
        Args: { _stacks: Json; _tournament_id: string }
        Returns: undefined
      }
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
      set_tournament_schedule: {
        Args: { _scheduled_at: string; _tournament_id: string }
        Returns: undefined
      }
      settle_match: { Args: { _match_id: string }; Returns: undefined }
      slot_pick_bonus: { Args: { _multiplier: number }; Returns: Json }
      slot_spin: { Args: { _bet: number }; Returns: Json }
      sync_match_elo: { Args: { _match_id: string }; Returns: undefined }
      wallet_apply: {
        Args: {
          _delta_dollars?: number
          _delta_slot_czk?: number
          _reason?: string
        }
        Returns: Json
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
