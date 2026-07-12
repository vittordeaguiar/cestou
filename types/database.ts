export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      group_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          group_id: string;
          id: string;
          invited_by: string | null;
          status: Database["public"]["Enums"]["group_invite_status"];
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          group_id: string;
          id?: string;
          invited_by?: string | null;
          status?: Database["public"]["Enums"]["group_invite_status"];
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          group_id?: string;
          id?: string;
          invited_by?: string | null;
          status?: Database["public"]["Enums"]["group_invite_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          role: Database["public"]["Enums"]["group_member_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["group_member_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["group_member_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: { created_at: string; id: string; name: string; updated_at: string };
        Insert: { created_at?: string; id?: string; name: string; updated_at?: string };
        Update: { created_at?: string; id?: string; name?: string; updated_at?: string };
        Relationships: [];
      };
      list_items: {
        Row: {
          category: Database["public"]["Enums"]["item_category"] | null;
          created_at: string;
          created_by: string | null;
          id: string;
          list_id: string;
          name: string;
          purchased: boolean;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["item_category"] | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          list_id: string;
          name: string;
          purchased?: boolean;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["item_category"] | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          list_id?: string;
          name?: string;
          purchased?: boolean;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          created_at: string;
          group_id: string;
          id: string;
          status: Database["public"]["Enums"]["list_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          group_id: string;
          id?: string;
          status?: Database["public"]["Enums"]["list_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          group_id?: string;
          id?: string;
          status?: Database["public"]["Enums"]["list_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      price_estimates: {
        Row: {
          calculated_at: string;
          created_at: string;
          created_by: string | null;
          id: string;
          items_not_found: string[];
          list_id: string;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          calculated_at?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          items_not_found?: string[];
          list_id: string;
          total_amount: number;
          updated_at?: string;
        };
        Update: {
          calculated_at?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          items_not_found?: string[];
          list_id?: string;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: { created_at: string; display_name: string | null; id: string; updated_at: string };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      accept_group_invite: {
        Args: { target_invite_id: string };
        Returns: string;
      };
      cancel_group_invite: {
        Args: { target_invite_id: string };
        Returns: undefined;
      };
      create_group: {
        Args: { group_name: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      create_group_invite: {
        Args: {
          invitation_expires_at: string;
          invited_email: string;
          target_group_id: string;
        };
        Returns: Database["public"]["Tables"]["group_invites"]["Row"];
      };
      transfer_group_ownership: {
        Args: { target_group_id: string; target_user_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      group_invite_status: "pending" | "accepted" | "revoked" | "expired";
      group_member_role: "owner" | "member";
      item_category: "mercado" | "farmacia" | "outro";
      list_status: "active" | "archived";
    };
    CompositeTypes: Record<never, never>;
  };
};
