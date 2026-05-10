// Auto-generated Supabase types from live OpenAPI schema
// Generated: 2025-06-17
// Tables: 22

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      Driver: {
        Row: {
          access_code: string | null
          accumulated_work_minutes: number
          admin_notes: string | null
          approval_status: string
          approved_docs: Json | null
          bank_account: string | null
          bank_clabe: string | null
          bank_holder: string | null
          bank_name: string | null
          city_id: string | null
          city_name: string | null
          commission_rate: number
          created_at: string
          curp: string | null
          cutoff_days: number
          doc_expiries: Json | null
          doc_id_url: string | null
          doc_insurance_url: string | null
          doc_license_url: string | null
          doc_urls: Json | null
          doc_vehicle_url: string | null
          email: string | null
          full_name: string
          id: string
          last_cutoff_date: string | null
          last_disconnect_reason: string | null
          last_seen_at: string | null
          latitude: number | null
          license_plate: string
          longitude: number | null
          online_since: string | null
          passenger_rating: number
          password: string | null
          phone: string | null
          photo_url: string | null
          push_subscription: Json | null
          rating: number
          rating_count: number
          rejected_docs: Json | null
          rejection_reason: string | null
          rest_required_until: string | null
          service_type_ids: Json | null
          service_type_names: Json | null
          status: string
          suspended_until: string | null
          suspension_reason: string | null
          total_earnings: number
          total_rides: number
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_year: string | null
          vehicles: Json | null
        }
        Insert: {
          access_code?: string | null
          accumulated_work_minutes?: number
          admin_notes?: string | null
          approval_status?: string
          approved_docs?: Json | null
          bank_account?: string | null
          bank_clabe?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          city_id?: string | null
          city_name?: string | null
          commission_rate?: number
          created_at?: string
          curp?: string | null
          cutoff_days?: number
          doc_expiries?: Json | null
          doc_id_url?: string | null
          doc_insurance_url?: string | null
          doc_license_url?: string | null
          doc_urls?: Json | null
          doc_vehicle_url?: string | null
          email?: string | null
          full_name: string
          id?: string
          last_cutoff_date?: string | null
          last_disconnect_reason?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          license_plate: string
          longitude?: number | null
          online_since?: string | null
          passenger_rating?: number
          password?: string | null
          phone?: string | null
          photo_url?: string | null
          push_subscription?: Json | null
          rating?: number
          rating_count?: number
          rejected_docs?: Json | null
          rejection_reason?: string | null
          rest_required_until?: string | null
          service_type_ids?: Json | null
          service_type_names?: Json | null
          status?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          total_earnings?: number
          total_rides?: number
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vehicles?: Json | null
        }
        Update: {
          access_code?: string | null
          accumulated_work_minutes?: number
          admin_notes?: string | null
          approval_status?: string
          approved_docs?: Json | null
          bank_account?: string | null
          bank_clabe?: string | null
          bank_holder?: string | null
          bank_name?: string | null
          city_id?: string | null
          city_name?: string | null
          commission_rate?: number
          created_at?: string
          curp?: string | null
          cutoff_days?: number
          doc_expiries?: Json | null
          doc_id_url?: string | null
          doc_insurance_url?: string | null
          doc_license_url?: string | null
          doc_urls?: Json | null
          doc_vehicle_url?: string | null
          email?: string | null
          full_name?: string
          id?: string
          last_cutoff_date?: string | null
          last_disconnect_reason?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          license_plate?: string
          longitude?: number | null
          online_since?: string | null
          passenger_rating?: number
          password?: string | null
          phone?: string | null
          photo_url?: string | null
          push_subscription?: Json | null
          rating?: number
          rating_count?: number
          rejected_docs?: Json | null
          rejection_reason?: string | null
          rest_required_until?: string | null
          service_type_ids?: Json | null
          service_type_names?: Json | null
          status?: string
          suspended_until?: string | null
          suspension_reason?: string | null
          total_earnings?: number
          total_rides?: number
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_year?: string | null
          vehicles?: Json | null
        }
      }
      admin_users: {
        Row: {
          allowed_pages: string[] | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          password: string
          password_hash: string | null
          role: string | null
        }
        Insert: {
          allowed_pages?: string[] | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          password: string
          password_hash?: string | null
          role?: string | null
        }
        Update: {
          allowed_pages?: string[] | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          password?: string
          password_hash?: string | null
          role?: string | null
        }
      }
      announcements: {
        Row: {
          body: string
          created_by_name: string | null
          expires_at: string | null
          filter_city_id: string | null
          filter_city_name: string | null
          filter_service_type_id: string | null
          filter_service_type_name: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          show_from: string | null
          target_audience: string | null
          title: string
        }
        Insert: {
          body: string
          created_by_name?: string | null
          expires_at?: string | null
          filter_city_id?: string | null
          filter_city_name?: string | null
          filter_service_type_id?: string | null
          filter_service_type_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          show_from?: string | null
          target_audience?: string | null
          title: string
        }
        Update: {
          body?: string
          created_by_name?: string | null
          expires_at?: string | null
          filter_city_id?: string | null
          filter_city_name?: string | null
          filter_service_type_id?: string | null
          filter_service_type_name?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          show_from?: string | null
          target_audience?: string | null
          title?: string
        }
      }
      app_settings: {
        Row: {
          accent_color: string | null
          accept_cars: boolean | null
          accept_motos: boolean | null
          allow_driver_cancel: boolean | null
          allow_passenger_cancel: boolean | null
          auction_max_drivers: number | null
          auction_max_retries: number | null
          auction_mode_enabled: boolean | null
          auction_primary_radius_km: number | null
          auction_secondary_radius_km: number | null
          auction_timeout_seconds: number | null
          driver_offer_timeout_seconds: number | null
          auto_primary_radius_km: number | null
          auto_secondary_radius_km: number | null
          auto_assign_nearest_driver: boolean | null
          base_fare: number | null
          city_traffic_factor: number | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          currency: string | null
          currency_symbol: string | null
          cutoff_interval_days: number | null
          destination_required: boolean | null
          driver_app_instructions: string | null
          driver_inactivity_timeout_minutes: number | null
          driver_location_update_interval_seconds: number | null
          driver_required_docs: Json | null
          driver_vehicle_docs: Json | null
          eta_modal_duration_seconds: number | null
          eta_speed_kmh: number | null
          eta_update_interval_seconds: number | null
          features_enabled: Json | null
          google_maps_api_key: string | null
          id: string
          landing_config: Json | null
          logo_url: string | null
          low_acceptance_rate_offer_reduction_pct: number | null
          low_acceptance_rate_threshold: number | null
          maps_provider: string | null
          max_concurrent_rides: number | null
          minimum_ride_amount: number | null
          nav_config: Json | null
          notes: string | null
          notification_interval_seconds: number | null
          notification_sound_type: string | null
          notification_volume: number | null
          payment_gateway: Json | null
          payment_methods: Json | null
          payment_timeout_hours: number | null
          pending_payment_methods: Json | null
          platform_commission_pct: number | null
          price_per_hour: number | null
          price_per_km: number | null
          price_per_minute: number | null
          primary_color: string | null
          promotions: Json | null
          rating_window_minutes: number | null
          rejection_count_threshold: number | null
          rejection_rate_warning_threshold: number | null
          require_admin_approval_to_start: boolean | null
          require_email_verification: boolean | null
          search_phase_seconds: number | null
          secondary_color: string | null
          service_flow_update_minutes: number | null
          show_driver_photo_to_passenger: boolean | null
          show_passenger_phone_to_driver: boolean | null
          soft_block_low_acceptance_rate_enabled: boolean | null
          support_whatsapp_message: string | null
          support_whatsapp_number: string | null
          total_search_window_seconds: number | null
          timezone: string | null
          updated_at: string | null
          version: number | null
          wallet_min_balance: number | null
          welcome_message: string | null
          work_break_duration_minutes: number | null
          work_break_interval_minutes: number | null
          work_long_break_duration_minutes: number | null
          work_long_rest_minutes: number | null
          work_max_hours: number | null
          work_rest_ratio: number | null
          work_rest_trigger_minutes: number | null
        }
        Insert: {
          accent_color?: string | null
          accept_cars?: boolean | null
          accept_motos?: boolean | null
          allow_driver_cancel?: boolean | null
          allow_passenger_cancel?: boolean | null
          auction_max_drivers?: number | null
          auction_max_retries?: number | null
          auction_mode_enabled?: boolean | null
          auction_primary_radius_km?: number | null
          auction_secondary_radius_km?: number | null
          auction_timeout_seconds?: number | null
          driver_offer_timeout_seconds?: number | null
          auto_primary_radius_km?: number | null
          auto_secondary_radius_km?: number | null
          auto_assign_nearest_driver?: boolean | null
          base_fare?: number | null
          city_traffic_factor?: number | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          cutoff_interval_days?: number | null
          destination_required?: boolean | null
          driver_app_instructions?: string | null
          driver_inactivity_timeout_minutes?: number | null
          driver_location_update_interval_seconds?: number | null
          driver_required_docs?: Json | null
          driver_vehicle_docs?: Json | null
          eta_modal_duration_seconds?: number | null
          eta_speed_kmh?: number | null
          eta_update_interval_seconds?: number | null
          features_enabled?: Json | null
          google_maps_api_key?: string | null
          id?: string
          landing_config?: Json | null
          logo_url?: string | null
          low_acceptance_rate_offer_reduction_pct?: number | null
          low_acceptance_rate_threshold?: number | null
          maps_provider?: string | null
          max_concurrent_rides?: number | null
          minimum_ride_amount?: number | null
          nav_config?: Json | null
          notes?: string | null
          notification_interval_seconds?: number | null
          notification_sound_type?: string | null
          notification_volume?: number | null
          payment_gateway?: Json | null
          payment_methods?: Json | null
          payment_timeout_hours?: number | null
          pending_payment_methods?: Json | null
          platform_commission_pct?: number | null
          price_per_hour?: number | null
          price_per_km?: number | null
          price_per_minute?: number | null
          primary_color?: string | null
          promotions?: Json | null
          rating_window_minutes?: number | null
          rejection_count_threshold?: number | null
          rejection_rate_warning_threshold?: number | null
          require_admin_approval_to_start?: boolean | null
          require_email_verification?: boolean | null
          search_phase_seconds?: number | null
          secondary_color?: string | null
          service_flow_update_minutes?: number | null
          show_driver_photo_to_passenger?: boolean | null
          show_passenger_phone_to_driver?: boolean | null
          soft_block_low_acceptance_rate_enabled?: boolean | null
          support_whatsapp_message?: string | null
          support_whatsapp_number?: string | null
          total_search_window_seconds?: number | null
          timezone?: string | null
          updated_at?: string | null
          version?: number | null
          wallet_min_balance?: number | null
          welcome_message?: string | null
          work_break_duration_minutes?: number | null
          work_break_interval_minutes?: number | null
          work_long_break_duration_minutes?: number | null
          work_long_rest_minutes?: number | null
          work_max_hours?: number | null
          work_rest_ratio?: number | null
          work_rest_trigger_minutes?: number | null
        }
        Update: {
          accent_color?: string | null
          accept_cars?: boolean | null
          accept_motos?: boolean | null
          allow_driver_cancel?: boolean | null
          allow_passenger_cancel?: boolean | null
          auction_max_drivers?: number | null
          auction_max_retries?: number | null
          auction_mode_enabled?: boolean | null
          auction_primary_radius_km?: number | null
          auction_secondary_radius_km?: number | null
          auction_timeout_seconds?: number | null
          driver_offer_timeout_seconds?: number | null
          auto_primary_radius_km?: number | null
          auto_secondary_radius_km?: number | null
          auto_assign_nearest_driver?: boolean | null
          base_fare?: number | null
          city_traffic_factor?: number | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          currency?: string | null
          currency_symbol?: string | null
          cutoff_interval_days?: number | null
          destination_required?: boolean | null
          driver_app_instructions?: string | null
          driver_inactivity_timeout_minutes?: number | null
          driver_location_update_interval_seconds?: number | null
          driver_required_docs?: Json | null
          driver_vehicle_docs?: Json | null
          eta_modal_duration_seconds?: number | null
          eta_speed_kmh?: number | null
          eta_update_interval_seconds?: number | null
          features_enabled?: Json | null
          google_maps_api_key?: string | null
          id?: string
          landing_config?: Json | null
          logo_url?: string | null
          low_acceptance_rate_offer_reduction_pct?: number | null
          low_acceptance_rate_threshold?: number | null
          maps_provider?: string | null
          max_concurrent_rides?: number | null
          minimum_ride_amount?: number | null
          nav_config?: Json | null
          notes?: string | null
          notification_interval_seconds?: number | null
          notification_sound_type?: string | null
          notification_volume?: number | null
          payment_gateway?: Json | null
          payment_methods?: Json | null
          payment_timeout_hours?: number | null
          pending_payment_methods?: Json | null
          platform_commission_pct?: number | null
          price_per_hour?: number | null
          price_per_km?: number | null
          price_per_minute?: number | null
          primary_color?: string | null
          promotions?: Json | null
          rating_window_minutes?: number | null
          rejection_count_threshold?: number | null
          rejection_rate_warning_threshold?: number | null
          require_admin_approval_to_start?: boolean | null
          require_email_verification?: boolean | null
          search_phase_seconds?: number | null
          secondary_color?: string | null
          service_flow_update_minutes?: number | null
          show_driver_photo_to_passenger?: boolean | null
          show_passenger_phone_to_driver?: boolean | null
          soft_block_low_acceptance_rate_enabled?: boolean | null
          support_whatsapp_message?: string | null
          support_whatsapp_number?: string | null
          total_search_window_seconds?: number | null
          timezone?: string | null
          updated_at?: string | null
          version?: number | null
          wallet_min_balance?: number | null
          welcome_message?: string | null
          work_break_duration_minutes?: number | null
          work_break_interval_minutes?: number | null
          work_long_break_duration_minutes?: number | null
          work_long_rest_minutes?: number | null
          work_max_hours?: number | null
          work_rest_ratio?: number | null
          work_rest_trigger_minutes?: number | null
        }
      }
      bonus_logs: {
        Row: {
          achieved_value: number | null
          approved_by: string | null
          bonus_amount: number
          city_name: string | null
          condition_type: string | null
          condition_value: number | null
          driver_id: string
          driver_name: string
          id: string
          notes: string | null
          period_end: string | null
          period_label: string | null
          period_start: string | null
          rule_id: string
          rule_name: string | null
          service_type_name: string | null
          status: string | null
        }
        Insert: {
          achieved_value?: number | null
          approved_by?: string | null
          bonus_amount: number
          city_name?: string | null
          condition_type?: string | null
          condition_value?: number | null
          driver_id: string
          driver_name: string
          id?: string
          notes?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          rule_id: string
          rule_name?: string | null
          service_type_name?: string | null
          status?: string | null
        }
        Update: {
          achieved_value?: number | null
          approved_by?: string | null
          bonus_amount?: number
          city_name?: string | null
          condition_type?: string | null
          condition_value?: number | null
          driver_id?: string
          driver_name?: string
          id?: string
          notes?: string | null
          period_end?: string | null
          period_label?: string | null
          period_start?: string | null
          rule_id?: string
          rule_name?: string | null
          service_type_name?: string | null
          status?: string | null
        }
      }
      bonus_rules: {
        Row: {
          bonus_amount: number
          city_id: string | null
          city_name: string | null
          condition_type: string
          condition_value: number
          id: string
          is_active: boolean | null
          name: string
          period: string | null
          service_type_id: string | null
          service_type_name: string | null
        }
        Insert: {
          bonus_amount: number
          city_id?: string | null
          city_name?: string | null
          condition_type: string
          condition_value: number
          id?: string
          is_active?: boolean | null
          name: string
          period?: string | null
          service_type_id?: string | null
          service_type_name?: string | null
        }
        Update: {
          bonus_amount?: number
          city_id?: string | null
          city_name?: string | null
          condition_type?: string
          condition_value?: number
          id?: string
          is_active?: boolean | null
          name?: string
          period?: string | null
          service_type_id?: string | null
          service_type_name?: string | null
        }
      }
      cancellation_policies: {
        Row: {
          applies_to_status: Json | null
          description: string | null
          fee_amount: number
          fee_type: string | null
          free_cancellation_minutes: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          applies_to_status?: Json | null
          description?: string | null
          fee_amount: number
          fee_type?: string | null
          free_cancellation_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          applies_to_status?: Json | null
          description?: string | null
          fee_amount?: number
          fee_type?: string | null
          free_cancellation_minutes?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
      }
      cash_cutoffs: {
        Row: {
          created_by_name: string | null
          cutoff_date: string
          driver_payouts: number | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          platform_commission: number | null
          total_revenue: number | null
          total_rides: number | null
        }
        Insert: {
          created_by_name?: string | null
          cutoff_date: string
          driver_payouts?: number | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          platform_commission?: number | null
          total_revenue?: number | null
          total_rides?: number | null
        }
        Update: {
          created_by_name?: string | null
          cutoff_date?: string
          driver_payouts?: number | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          platform_commission?: number | null
          total_revenue?: number | null
          total_rides?: number | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          message: string
          read_by_admin: boolean | null
          read_by_driver: boolean | null
          ride_id: string
          sender_name: string | null
          sender_role: string | null
        }
        Insert: {
          id?: string
          message: string
          read_by_admin?: boolean | null
          read_by_driver?: boolean | null
          ride_id: string
          sender_name?: string | null
          sender_role?: string | null
        }
        Update: {
          id?: string
          message?: string
          read_by_admin?: boolean | null
          read_by_driver?: boolean | null
          ride_id?: string
          sender_name?: string | null
          sender_role?: string | null
        }
      }
      cities: {
        Row: {
          center_lat: number | null
          center_lon: number | null
          country: string | null
          geofence_radius_km: number | null
          id: string
          is_active: boolean | null
          name: string
          state: string | null
        }
        Insert: {
          center_lat?: number | null
          center_lon?: number | null
          country?: string | null
          geofence_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          state?: string | null
        }
        Update: {
          center_lat?: number | null
          center_lon?: number | null
          country?: string | null
          geofence_radius_km?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          state?: string | null
        }
      }
      companies: {
        Row: {
          billing_type: string | null
          contacto: string | null
          correo_facturacion: string | null
          credito_usado: number | null
          direccion_fiscal: string | null
          folio_fields: Json | null
          folio_secundario_fields: Json | null
          id: string
          is_active: boolean | null
          limite_credito: number | null
          limite_por_servicio: number | null
          notas: string | null
          parent_company_id: string | null
          parent_company_name: string | null
          razon_social: string
          rfc: string | null
          sub_company_limit: number | null
          survey_id: string | null
          survey_title: string | null
          tax_pct: number | null
          telefono: string | null
          zone_prices: Json | null
        }
        Insert: {
          billing_type?: string | null
          contacto?: string | null
          correo_facturacion?: string | null
          credito_usado?: number | null
          direccion_fiscal?: string | null
          folio_fields?: Json | null
          folio_secundario_fields?: Json | null
          id?: string
          is_active?: boolean | null
          limite_credito?: number | null
          limite_por_servicio?: number | null
          notas?: string | null
          parent_company_id?: string | null
          parent_company_name?: string | null
          razon_social: string
          rfc?: string | null
          sub_company_limit?: number | null
          survey_id?: string | null
          survey_title?: string | null
          tax_pct?: number | null
          telefono?: string | null
          zone_prices?: Json | null
        }
        Update: {
          billing_type?: string | null
          contacto?: string | null
          correo_facturacion?: string | null
          credito_usado?: number | null
          direccion_fiscal?: string | null
          folio_fields?: Json | null
          folio_secundario_fields?: Json | null
          id?: string
          is_active?: boolean | null
          limite_credito?: number | null
          limite_por_servicio?: number | null
          notas?: string | null
          parent_company_id?: string | null
          parent_company_name?: string | null
          razon_social?: string
          rfc?: string | null
          sub_company_limit?: number | null
          survey_id?: string | null
          survey_title?: string | null
          tax_pct?: number | null
          telefono?: string | null
          zone_prices?: Json | null
        }
      }
      driver_notificaciones: {
        Row: {
          body: string
          driver_ids: Json | null
          driver_names: Json | null
          filter_city: string | null
          filter_service_type: string | null
          id: string
          recipient_count: number | null
          sent_by: string | null
          tag: string | null
          title: string
        }
        Insert: {
          body: string
          driver_ids?: Json | null
          driver_names?: Json | null
          filter_city?: string | null
          filter_service_type?: string | null
          id?: string
          recipient_count?: number | null
          sent_by?: string | null
          tag?: string | null
          title: string
        }
        Update: {
          body?: string
          driver_ids?: Json | null
          driver_names?: Json | null
          filter_city?: string | null
          filter_service_type?: string | null
          id?: string
          recipient_count?: number | null
          sent_by?: string | null
          tag?: string | null
          title?: string
        }
      }
      geo_zones: {
        Row: {
          color: string | null
          coordinates: Json
          id: string
          is_active: boolean | null
          name: string
          prioridad: number | null
          tarifa_base: number | null
          tarifa_fija: number | null
          tarifa_por_km: number | null
          tipo_tarifa: string | null
          service_tariff_priority: string | null
          company_tariff_priority: string | null
        }
        Insert: {
          color?: string | null
          coordinates: Json
          id?: string
          is_active?: boolean | null
          name: string
          prioridad?: number | null
          tarifa_base?: number | null
          tarifa_fija?: number | null
          tarifa_por_km?: number | null
          tipo_tarifa?: string | null
          service_tariff_priority?: string | null
          company_tariff_priority?: string | null
        }
        Update: {
          color?: string | null
          coordinates?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          prioridad?: number | null
          tarifa_base?: number | null
          tarifa_fija?: number | null
          tarifa_por_km?: number | null
          tipo_tarifa?: string | null
          service_tariff_priority?: string | null
          company_tariff_priority?: string | null
        }
      }
      invoices: {
        Row: {
          company_id: string
          company_name: string
          id: string
          invoice_number: string | null
          notes: string | null
          paid_at: string | null
          period_from: string | null
          period_to: string | null
          ride_count: number | null
          ride_ids: Json | null
          service_ids: Json | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_pct: number | null
          total: number | null
        }
        Insert: {
          company_id: string
          company_name: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          ride_count?: number | null
          ride_ids?: Json | null
          service_ids?: Json | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_pct?: number | null
          total?: number | null
        }
        Update: {
          company_id?: string
          company_name?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_at?: string | null
          period_from?: string | null
          period_to?: string | null
          ride_count?: number | null
          ride_ids?: Json | null
          service_ids?: Json | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_pct?: number | null
          total?: number | null
        }
      }
      red_zones: {
        Row: {
          active_days: Json | null
          active_hours_end: string | null
          active_hours_start: string | null
          coordinates: Json
          id: string
          is_active: boolean | null
          name: string
          reason: string | null
          use_schedule: boolean | null
        }
        Insert: {
          active_days?: Json | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          coordinates: Json
          id?: string
          is_active?: boolean | null
          name: string
          reason?: string | null
          use_schedule?: boolean | null
        }
        Update: {
          active_days?: Json | null
          active_hours_end?: string | null
          active_hours_start?: string | null
          coordinates?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          reason?: string | null
          use_schedule?: boolean | null
        }
      }
      ride_requests: {
        Row: {
          _admin_edit: boolean | null
          admin_rating: number | null
          admin_rating_comment: string | null
          arrived_at: string | null
          assignment_mode: string | null
          auction_driver_ids: string[] | null
          auction_expires_at: string | null
          cancellation_fee: number | null
          cancellation_reason: string | null
          cancelled_by: string | null
          city_id: string | null
          city_name: string | null
          commission_rate: number | null
          company_id: string | null
          company_name: string | null
          company_price: number | null
          completed_at: string | null
          custom_field_answers: Json | null
          distance_km: number | null
          driver_earnings: number | null
          driver_id: string | null
          driver_name: string | null
          driver_rating_comment: string | null
          driver_rating_for_passenger: number | null
          dropoff_address: string | null
          dropoff_lat: number | null
          dropoff_lon: number | null
          duration_minutes: number | null
          en_route_at: string | null
          estimated_price: number | null
          extra_charges: Json | null
          extra_company_cost: number | null
          final_price: number | null
          gasoline_liters: number | null
          geo_zone_id: string | null
          geo_zone_name: string | null
          id: string
          in_progress_at: string | null
          is_gasoline: boolean | null
          is_red_zone_blocked: boolean | null
          notes: string | null
          paid_by: string | null
          passenger_name: string
          passenger_phone: string | null
          passenger_rating_comment: string | null
          passenger_rating_for_driver: number | null
          passenger_user_id: string | null
          payment_confirmed_by_driver: boolean | null
          payment_method: string | null
          payment_reported_unpaid: boolean | null
          payment_status: string | null
          pickup_address: string
          pickup_lat: number | null
          pickup_lon: number | null
          platform_commission: number | null
          proof_photo_required: boolean | null
          proof_photo_url: string | null
          questionnaire_answers: Json | null
          rating_window_expires_at: string | null
          requested_at: string | null
          require_admin_approval: boolean | null
          ride_type: string | null
          scheduled_time: string | null
          service_id: string | null
          service_type_id: string | null
          service_type_name: string | null
          show_phone_to_driver: boolean | null
          status: string | null
        }
        Insert: {
          _admin_edit?: boolean | null
          admin_rating?: number | null
          admin_rating_comment?: string | null
          arrived_at?: string | null
          assignment_mode?: string | null
          auction_driver_ids?: string[] | null
          auction_expires_at?: string | null
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          city_id?: string | null
          city_name?: string | null
          commission_rate?: number | null
          company_id?: string | null
          company_name?: string | null
          company_price?: number | null
          completed_at?: string | null
          custom_field_answers?: Json | null
          distance_km?: number | null
          driver_earnings?: number | null
          driver_id?: string | null
          driver_name?: string | null
          driver_rating_comment?: string | null
          driver_rating_for_passenger?: number | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lon?: number | null
          duration_minutes?: number | null
          en_route_at?: string | null
          estimated_price?: number | null
          extra_charges?: Json | null
          extra_company_cost?: number | null
          final_price?: number | null
          gasoline_liters?: number | null
          geo_zone_id?: string | null
          geo_zone_name?: string | null
          id?: string
          in_progress_at?: string | null
          is_gasoline?: boolean | null
          is_red_zone_blocked?: boolean | null
          notes?: string | null
          paid_by?: string | null
          passenger_name: string
          passenger_phone?: string | null
          passenger_rating_comment?: string | null
          passenger_rating_for_driver?: number | null
          passenger_user_id?: string | null
          payment_confirmed_by_driver?: boolean | null
          payment_method?: string | null
          payment_reported_unpaid?: boolean | null
          payment_status?: string | null
          pickup_address: string
          pickup_lat?: number | null
          pickup_lon?: number | null
          platform_commission?: number | null
          proof_photo_required?: boolean | null
          proof_photo_url?: string | null
          questionnaire_answers?: Json | null
          rating_window_expires_at?: string | null
          requested_at?: string | null
          require_admin_approval?: boolean | null
          ride_type?: string | null
          scheduled_time?: string | null
          service_id?: string | null
          service_type_id?: string | null
          service_type_name?: string | null
          show_phone_to_driver?: boolean | null
          status?: string | null
        }
        Update: {
          _admin_edit?: boolean | null
          admin_rating?: number | null
          admin_rating_comment?: string | null
          arrived_at?: string | null
          assignment_mode?: string | null
          auction_driver_ids?: string[] | null
          auction_expires_at?: string | null
          cancellation_fee?: number | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          city_id?: string | null
          city_name?: string | null
          commission_rate?: number | null
          company_id?: string | null
          company_name?: string | null
          company_price?: number | null
          completed_at?: string | null
          custom_field_answers?: Json | null
          distance_km?: number | null
          driver_earnings?: number | null
          driver_id?: string | null
          driver_name?: string | null
          driver_rating_comment?: string | null
          driver_rating_for_passenger?: number | null
          dropoff_address?: string | null
          dropoff_lat?: number | null
          dropoff_lon?: number | null
          duration_minutes?: number | null
          en_route_at?: string | null
          estimated_price?: number | null
          extra_charges?: Json | null
          extra_company_cost?: number | null
          final_price?: number | null
          gasoline_liters?: number | null
          geo_zone_id?: string | null
          geo_zone_name?: string | null
          id?: string
          in_progress_at?: string | null
          is_gasoline?: boolean | null
          is_red_zone_blocked?: boolean | null
          notes?: string | null
          paid_by?: string | null
          passenger_name?: string
          passenger_phone?: string | null
          passenger_rating_comment?: string | null
          passenger_rating_for_driver?: number | null
          passenger_user_id?: string | null
          payment_confirmed_by_driver?: boolean | null
          payment_method?: string | null
          payment_reported_unpaid?: boolean | null
          payment_status?: string | null
          pickup_address?: string
          pickup_lat?: number | null
          pickup_lon?: number | null
          platform_commission?: number | null
          proof_photo_required?: boolean | null
          proof_photo_url?: string | null
          questionnaire_answers?: Json | null
          rating_window_expires_at?: string | null
          requested_at?: string | null
          require_admin_approval?: boolean | null
          ride_type?: string | null
          scheduled_time?: string | null
          service_id?: string | null
          service_type_id?: string | null
          service_type_name?: string | null
          show_phone_to_driver?: boolean | null
          status?: string | null
        }
      }
      road_assist_users: {
        Row: {
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          password: string | null
          pending_balance: number | null
          phone: string
          photo_url: string | null
          push_subscription: Json | null
          rating: number | null
          rating_count: number | null
          reset_token: string | null
          reset_token_expires: string | null
          wallet_balance: number | null
          wallet_transactions: Json | null
        }
        Insert: {
          email: string
          full_name: string
          id?: string
          is_active?: boolean | null
          password?: string | null
          pending_balance?: number | null
          phone: string
          photo_url?: string | null
          push_subscription?: Json | null
          rating?: number | null
          rating_count?: number | null
          reset_token?: string | null
          reset_token_expires?: string | null
          wallet_balance?: number | null
          wallet_transactions?: Json | null
        }
        Update: {
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          password?: string | null
          pending_balance?: number | null
          phone?: string
          photo_url?: string | null
          push_subscription?: Json | null
          rating?: number | null
          rating_count?: number | null
          reset_token?: string | null
          reset_token_expires?: string | null
          wallet_balance?: number | null
          wallet_transactions?: Json | null
        }
      }
      service_types: {
        Row: {
          advance_assignment_minutes: number | null
          base_price: number
          category: string | null
          color: string | null
          corporate_driver_pct: number | null
          custom_fields: Json | null
          description: string | null
          icon: string | null
          icon_url: string | null
          id: string
          is_active: boolean | null
          max_passengers: number | null
          minimum_fare: number | null
          name: string
          pay_full_to_driver: boolean | null
          price_per_km: number
          price_per_minute: number | null
          questionnaire: Json | null
          require_proof_photo: boolean | null
          service_extras: Json | null
          surge_multiplier: number | null
        }
        Insert: {
          advance_assignment_minutes?: number | null
          base_price: number
          category?: string | null
          color?: string | null
          corporate_driver_pct?: number | null
          custom_fields?: Json | null
          description?: string | null
          icon?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          max_passengers?: number | null
          minimum_fare?: number | null
          name: string
          pay_full_to_driver?: boolean | null
          price_per_km: number
          price_per_minute?: number | null
          questionnaire?: Json | null
          require_proof_photo?: boolean | null
          service_extras?: Json | null
          surge_multiplier?: number | null
        }
        Update: {
          advance_assignment_minutes?: number | null
          base_price?: number
          category?: string | null
          color?: string | null
          corporate_driver_pct?: number | null
          custom_fields?: Json | null
          description?: string | null
          icon?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean | null
          max_passengers?: number | null
          minimum_fare?: number | null
          name?: string
          pay_full_to_driver?: boolean | null
          price_per_km?: number
          price_per_minute?: number | null
          questionnaire?: Json | null
          require_proof_photo?: boolean | null
          service_extras?: Json | null
          surge_multiplier?: number | null
        }
      }
      sos_alerts: {
        Row: {
          admin_notes: string | null
          driver_id: string
          driver_name: string
          id: string
          latitude: number | null
          longitude: number | null
          message: string | null
          ride_id: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          driver_id: string
          driver_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          ride_id?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          driver_id?: string
          driver_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          ride_id?: string | null
          status?: string | null
        }
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: string | null
          description: string
          driver_id: string | null
          driver_name: string | null
          id: string
          passenger_name: string | null
          passenger_phone: string | null
          passenger_user_id: string | null
          priority: string | null
          ride_id: string | null
          service_id: string | null
          status: string | null
          subject: string
          submitted_by: string | null
          ticket_number: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: string | null
          description: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          passenger_name?: string | null
          passenger_phone?: string | null
          passenger_user_id?: string | null
          priority?: string | null
          ride_id?: string | null
          service_id?: string | null
          status?: string | null
          subject: string
          submitted_by?: string | null
          ticket_number?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: string | null
          description?: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          passenger_name?: string | null
          passenger_phone?: string | null
          passenger_user_id?: string | null
          priority?: string | null
          ride_id?: string | null
          service_id?: string | null
          status?: string | null
          subject?: string
          submitted_by?: string | null
          ticket_number?: string | null
        }
      }
      survey_responses: {
        Row: {
          answers: Json | null
          company_id: string | null
          company_name: string | null
          completed_at: string | null
          driver_id: string | null
          driver_name: string | null
          id: string
          passenger_name: string | null
          ride_id: string
          service_id: string | null
          signature_name: string | null
          signature_url: string | null
          survey_id: string
          survey_title: string | null
        }
        Insert: {
          answers?: Json | null
          company_id?: string | null
          company_name?: string | null
          completed_at?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          passenger_name?: string | null
          ride_id: string
          service_id?: string | null
          signature_name?: string | null
          signature_url?: string | null
          survey_id: string
          survey_title?: string | null
        }
        Update: {
          answers?: Json | null
          company_id?: string | null
          company_name?: string | null
          completed_at?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          passenger_name?: string | null
          ride_id?: string
          service_id?: string | null
          signature_name?: string | null
          signature_url?: string | null
          survey_id?: string
          survey_title?: string | null
        }
      }
      surveys: {
        Row: {
          company_ids: Json | null
          company_names: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          questions: Json | null
          require_signature: boolean | null
          title: string
        }
        Insert: {
          company_ids?: Json | null
          company_names?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          questions?: Json | null
          require_signature?: boolean | null
          title: string
        }
        Update: {
          company_ids?: Json | null
          company_names?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          questions?: Json | null
          require_signature?: boolean | null
          title?: string
        }
      }
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
