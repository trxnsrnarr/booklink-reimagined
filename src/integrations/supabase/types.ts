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
      ad_rewards: {
        Row: {
          count: number
          id: string
          reward_date: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          reward_date?: string
          user_id: string
        }
        Update: {
          count?: number
          id?: string
          reward_date?: string
          user_id?: string
        }
        Relationships: []
      }
      author_earnings: {
        Row: {
          balance: number
          total_earned: number
          updated_at: string
          user_id: string
          withdrawn: number
        }
        Insert: {
          balance?: number
          total_earned?: number
          updated_at?: string
          user_id: string
          withdrawn?: number
        }
        Update: {
          balance?: number
          total_earned?: number
          updated_at?: string
          user_id?: string
          withdrawn?: number
        }
        Relationships: [
          {
            foreignKeyName: "author_earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapter_likes: {
        Row: {
          chapter_id: string
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: []
      }
      chapter_unlocks: {
        Row: {
          author_id: string | null
          author_share: number
          chapter_id: string
          coin_paid: number
          created_at: string
          id: string
          platform_share: number
          story_id: string
          user_id: string
        }
        Insert: {
          author_id?: string | null
          author_share?: number
          chapter_id: string
          coin_paid?: number
          created_at?: string
          id?: string
          platform_share?: number
          story_id: string
          user_id: string
        }
        Update: {
          author_id?: string | null
          author_share?: number
          chapter_id?: string
          coin_paid?: number
          created_at?: string
          id?: string
          platform_share?: number
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_unlocks_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_unlocks_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_unlocks_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          chapter_payment_status: string
          coin_price: number
          content: string
          created_at: string
          id: string
          is_premium: boolean
          order_index: number
          reader_count: number
          story_id: string
          title: string
          word_count: number
        }
        Insert: {
          chapter_payment_status?: string
          coin_price?: number
          content?: string
          created_at?: string
          id?: string
          is_premium?: boolean
          order_index?: number
          reader_count?: number
          story_id: string
          title: string
          word_count?: number
        }
        Update: {
          chapter_payment_status?: string
          coin_price?: number
          content?: string
          created_at?: string
          id?: string
          is_premium?: boolean
          order_index?: number
          reader_count?: number
          story_id?: string
          title?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_packages: {
        Row: {
          bonus_coin: number
          coin_amount: number
          created_at: string
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price_idr: number
          sort_order: number
        }
        Insert: {
          bonus_coin?: number
          coin_amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price_idr: number
          sort_order?: number
        }
        Update: {
          bonus_coin?: number
          coin_amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price_idr?: number
          sort_order?: number
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          chapter_id: string | null
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          likes_count: number
          parent_id: string | null
          story_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          story_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          likes_count?: number
          parent_id?: string | null
          story_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          last_sender_id: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          last_sender_id?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          last_sender_id?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followers_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followers_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      libraries: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libraries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          added_at: string
          id: string
          library_id: string
          story_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          library_id: string
          story_id: string
        }
        Update: {
          added_at?: string
          id?: string
          library_id?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_library_id_fkey"
            columns: ["library_id"]
            isOneToOne: false
            referencedRelation: "libraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_items_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          coin_balance: number
          created_at: string
          display_name: string | null
          id: string
          is_verified: boolean
          updated_at: string
          username: string
          vip_until: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          coin_balance?: number
          created_at?: string
          display_name?: string | null
          id: string
          is_verified?: boolean
          updated_at?: string
          username: string
          vip_until?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          coin_balance?: number
          created_at?: string
          display_name?: string | null
          id?: string
          is_verified?: boolean
          updated_at?: string
          username?: string
          vip_until?: string | null
        }
        Relationships: []
      }
      reading_progress: {
        Row: {
          chapter_id: string
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          story_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          author_avatar: string | null
          author_id: string | null
          author_name: string
          comments_count: number
          cover_gradient: string | null
          cover_url: string | null
          created_at: string
          favorite_count: number
          genre: string
          id: string
          is_premium: boolean
          is_recommended: boolean
          is_trending: boolean
          is_vip: boolean
          likes_count: number
          slug: string
          status: string
          synopsis: string | null
          tags: string[] | null
          title: string
          unlock_count: number
          updated_at: string
          views: number
          vip_payment_status: string
        }
        Insert: {
          author_avatar?: string | null
          author_id?: string | null
          author_name: string
          comments_count?: number
          cover_gradient?: string | null
          cover_url?: string | null
          created_at?: string
          favorite_count?: number
          genre: string
          id?: string
          is_premium?: boolean
          is_recommended?: boolean
          is_trending?: boolean
          is_vip?: boolean
          likes_count?: number
          slug: string
          status?: string
          synopsis?: string | null
          tags?: string[] | null
          title: string
          unlock_count?: number
          updated_at?: string
          views?: number
          vip_payment_status?: string
        }
        Update: {
          author_avatar?: string | null
          author_id?: string | null
          author_name?: string
          comments_count?: number
          cover_gradient?: string | null
          cover_url?: string | null
          created_at?: string
          favorite_count?: number
          genre?: string
          id?: string
          is_premium?: boolean
          is_recommended?: boolean
          is_trending?: boolean
          is_vip?: boolean
          likes_count?: number
          slug?: string
          status?: string
          synopsis?: string | null
          tags?: string[] | null
          title?: string
          unlock_count?: number
          updated_at?: string
          views?: number
          vip_payment_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_likes: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_purchases: {
        Row: {
          created_at: string
          id: string
          price: number
          theme_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number
          theme_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          theme_id?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_idr: number
          bonus_coin: number
          coin_amount: number
          created_at: string
          id: string
          meta: Json | null
          midtrans_response: Json | null
          order_id: string
          paid_at: string | null
          payment_type: string | null
          ref_id: string | null
          snap_token: string | null
          status: string
          tx_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_idr: number
          bonus_coin?: number
          coin_amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          midtrans_response?: Json | null
          order_id: string
          paid_at?: string | null
          payment_type?: string | null
          ref_id?: string | null
          snap_token?: string | null
          status?: string
          tx_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_idr?: number
          bonus_coin?: number
          coin_amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          midtrans_response?: Json | null
          order_id?: string
          paid_at?: string | null
          payment_type?: string | null
          ref_id?: string | null
          snap_token?: string | null
          status?: string
          tx_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_info: Json
          amount_coin: number
          created_at: string
          id: string
          method: string
          note: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_info: Json
          amount_coin: number
          created_at?: string
          id?: string
          method: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_info?: Json
          amount_coin?: number
          created_at?: string
          id?: string
          method?: string
          note?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ad_reward: { Args: never; Returns: Json }
      create_pending_transaction: {
        Args: {
          _amount_idr: number
          _bonus_coin: number
          _coin_amount: number
          _order_id: string
          _user_id: string
        }
        Returns: string
      }
      create_pending_transaction_v2: {
        Args: {
          _amount_idr: number
          _bonus_coin: number
          _coin_amount: number
          _meta: Json
          _order_id: string
          _ref_id: string
          _tx_type: string
          _user_id: string
        }
        Returns: string
      }
      fulfill_transaction: {
        Args: {
          _midtrans: Json
          _order_id: string
          _payment_type: string
          _status: string
        }
        Returns: Json
      }
      get_or_create_conversation: { Args: { _other: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_vip: { Args: { _user_id: string }; Returns: boolean }
      mark_conversation_read: { Args: { _conv: string }; Returns: number }
      process_withdrawal: {
        Args: { _id: string; _note: string; _status: string }
        Returns: Json
      }
      purchase_theme: {
        Args: { _price: number; _theme_id: string }
        Returns: Json
      }
      recompute_story_comments_count: {
        Args: { _story: string }
        Returns: undefined
      }
      record_chapter_view: { Args: { _chapter_id: string }; Returns: undefined }
      record_reading_progress: {
        Args: { _chapter_id: string }
        Returns: undefined
      }
      request_withdrawal: {
        Args: { _account_info: Json; _amount_coin: number; _method: string }
        Returns: Json
      }
      toggle_chapter_like: { Args: { _chapter_id: string }; Returns: Json }
      toggle_comment_like: { Args: { _comment_id: string }; Returns: Json }
      toggle_story_like: { Args: { _story_id: string }; Returns: Json }
      unlock_chapter: { Args: { _chapter_id: string }; Returns: Json }
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
