
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_analyses": {
                  Row: {
                    "created_at": string,"id": string,"input_snapshot": NonNullable<Json>,"model": string,"output": NonNullable<Json>,"snapshot_hash": string,"store_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"input_snapshot": NonNullable<Json>,"model": string,"output": NonNullable<Json>,"snapshot_hash": string,"store_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"input_snapshot"?: NonNullable<Json>,"model"?: string,"output"?: NonNullable<Json>,"snapshot_hash"?: string,"store_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_analyses_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_analyses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_usage": {
                  Row: {
                    "created_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"assets": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"name": string,"qty": number,"store_id": string,"unit_price": number,"useful_life_months": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"id"?: string,"name": string,"qty"?: number,"store_id": string,"unit_price": number,"useful_life_months": number
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"name"?: string,"qty"?: number,"store_id"?: string,"unit_price"?: number,"useful_life_months"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "assets_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"materials": {
                  Row: {
                    "category": string,"created_at": string,"grams_per_sdm": number | null,"id": string,"name": string,"purchase_price": number,"purchase_qty": number,"purchase_unit": string,"store_id": string,"waste_pct": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"grams_per_sdm"?: number | null,"id"?: string,"name": string,"purchase_price": number,"purchase_qty": number,"purchase_unit": string,"store_id": string,"waste_pct"?: number
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"grams_per_sdm"?: number | null,"id"?: string,"name"?: string,"purchase_price"?: number,"purchase_qty"?: number,"purchase_unit"?: string,"store_id"?: string,"waste_pct"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "materials_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"operating_expenses": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"frequency": string,"id": string,"name": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"frequency": string,"id"?: string,"name": string,"store_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"frequency"?: string,"id"?: string,"name"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "operating_expenses_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"product_channel_prices": {
                  Row: {
                    "channel_id": string,"competitor_price": number | null,"created_at": string,"est_monthly_sales": number,"id": string,"price": number,"product_id": string,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "channel_id": string,"competitor_price"?: number | null,"created_at"?: string,"est_monthly_sales"?: number,"id"?: string,"price": number,"product_id": string,"store_id": string
                  }
                  Update: {
                    "channel_id"?: string,"competitor_price"?: number | null,"created_at"?: string,"est_monthly_sales"?: number,"id"?: string,"price"?: number,"product_id"?: string,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_channel_prices_channel_id_store_id_fkey"
      columns: ["channel_id","store_id"]
isOneToOne: false
      referencedRelation: "sales_channels"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "product_channel_prices_product_id_store_id_fkey"
      columns: ["product_id","store_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "product_channel_prices_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"product_materials": {
                  Row: {
                    "basis": string,"channel_id": string | null,"created_at": string,"id": string,"material_id": string,"product_id": string,"qty": number,"store_id": string,"unit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "basis"?: string,"channel_id"?: string | null,"created_at"?: string,"id"?: string,"material_id": string,"product_id": string,"qty": number,"store_id": string,"unit": string
                  }
                  Update: {
                    "basis"?: string,"channel_id"?: string | null,"created_at"?: string,"id"?: string,"material_id"?: string,"product_id"?: string,"qty"?: number,"store_id"?: string,"unit"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "product_materials_channel_id_store_id_fkey"
      columns: ["channel_id","store_id"]
isOneToOne: false
      referencedRelation: "sales_channels"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "product_materials_material_id_store_id_fkey"
      columns: ["material_id","store_id"]
isOneToOne: false
      referencedRelation: "materials"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "product_materials_product_id_store_id_fkey"
      columns: ["product_id","store_id"]
isOneToOne: false
      referencedRelation: "products"
      referencedColumns: ["id","store_id"]
    },{
      foreignKeyName: "product_materials_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"products": {
                  Row: {
                    "category": string | null,"created_at": string,"id": string,"is_active": boolean,"name": string,"store_id": string,"target_margin_pct": number | null,"yield_qty": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name": string,"store_id": string,"target_margin_pct"?: number | null,"yield_qty"?: number
                  }
                  Update: {
                    "category"?: string | null,"created_at"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"store_id"?: string,"target_margin_pct"?: number | null,"yield_qty"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "products_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"id": string,"locale": string | null,"plan": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"id": string,"locale"?: string | null,"plan"?: string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"id"?: string,"locale"?: string | null,"plan"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sales_channels": {
                  Row: {
                    "commission_pct": number,"created_at": string,"fixed_fee": number,"id": string,"name": string,"sort_order": number,"store_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "commission_pct"?: number,"created_at"?: string,"fixed_fee"?: number,"id"?: string,"name": string,"sort_order"?: number,"store_id": string
                  }
                  Update: {
                    "commission_pct"?: number,"created_at"?: string,"fixed_fee"?: number,"id"?: string,"name"?: string,"sort_order"?: number,"store_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sales_channels_store_id_fkey"
      columns: ["store_id"]
isOneToOne: false
      referencedRelation: "stores"
      referencedColumns: ["id"]
    }
                  ]
                },"stores": {
                  Row: {
                    "business_type": string,"created_at": string,"id": string,"name": string,"operating_days_per_month": number,"owner_id": string,"target_margin_pct": number,"target_market": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "business_type": string,"created_at"?: string,"id"?: string,"name": string,"operating_days_per_month"?: number,"owner_id": string,"target_margin_pct"?: number,"target_market"?: string | null
                  }
                  Update: {
                    "business_type"?: string,"created_at"?: string,"id"?: string,"name"?: string,"operating_days_per_month"?: number,"owner_id"?: string,"target_margin_pct"?: number,"target_market"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "stores_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_ai_usage":
{ Args: { "p_limit": number,"p_since": string,"p_user_id": string }; Returns: string
                           },
"create_store":
{ Args: { "p_business_type": string,"p_default_channel_name"?: string,"p_name": string,"p_operating_days": number,"p_target_margin": number,"p_target_market"?: string }; Returns: string
                           },
"is_store_owner":
{ Args: { "sid": string }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
