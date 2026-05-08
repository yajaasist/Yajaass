/**
 * ═══════════════════════════════════════════════════════════════════════════
 * YAJA Admin Panel - Supabase Service
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Centralizado servicio para todas las operaciones de base de datos.
 * Proporciona métodos reutilizables para CRUD en todas las tablas.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// 🔧 Getter dinámico para cliente Supabase (se reinicializa en cada llamada)
function getSupabaseClient(useServiceRole: boolean = true) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (useServiceRole && !supabaseServiceKey) {
    console.error('[SUPABASE_SERVICE] ⚠️ SUPABASE_SERVICE_ROLE_KEY is NOT set — falling back to anon key. Write operations WILL fail due to RLS. Add this env var in Vercel Dashboard → Settings → Environment Variables.');
  }

  const key = useServiceRole && supabaseServiceKey ? supabaseServiceKey : supabaseAnonKey;

  return createClient<Database>(supabaseUrl, key);
}

// Cliente para operaciones públicas (mantener para compatibilidad)
export const supabaseClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Función para obtener cliente con service role
export const getSupabaseServerClient = () => getSupabaseClient(true);
export const getSupabaseAnonClient = () => getSupabaseClient(false);

// Para compatibilidad backward - retorna cliente dinámico
export const supabaseServer = getSupabaseClient(true);

/**
 * Service genérico para operaciones CRUD en Supabase
 */
export class SupabaseService {
  private table: string;

  constructor(tableName: string) {
    this.table = tableName;
  }

  // Getter dinámico para el cliente (se reinicializa en cada llamada)
  private getClient() {
    return getSupabaseServerClient();
  }

  // Dynamic table names are used intentionally; cast query builder to avoid never inference.
  private fromTable() {
    return this.getClient().from(this.table as any) as any;
  }

  /**
   * Obtener todos los registros con filtros opcionales
   */
  async getAll(filters?: Record<string, any>, options?: any) {
    try {
      let query = this.fromTable().select(options?.select || '*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error(`Error fetching from ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Obtener un registro por ID
   */
  async getById(id: string, options?: any) {
    try {
      const { data, error } = await this.fromTable()
        .select(options?.select || '*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error(`Error fetching single from ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Crear nuevo registro
   */
  async create(data: any, options?: any) {
    try {
      const { data: created, error } = await this.fromTable()
        .insert([data])
        .select(options?.select || '*');

      if (error) throw error;
      return { data: created?.[0], success: true };
    } catch (error) {
      console.error(`Error creating in ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Actualizar registro
   */
  async update(id: string, data: any, options?: any) {
    try {
      const { data: updated, error } = await this.fromTable()
        .update(data)
        .eq('id', id)
        .select(options?.select || '*');

      if (error) throw error;
      return { data: updated?.[0], success: true };
    } catch (error) {
      console.error(`Error updating in ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Eliminar registro
   */
  async delete(id: string) {
    try {
      const { error } = await this.fromTable()
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error(`Error deleting from ${this.table}:`, error);
      return { error, success: false };
    }
  }

  /**
   * Búsqueda con texto
   */
  async search(searchTerm: string, columns: string[]) {
    try {
      let query = this.fromTable().select('*');

      columns.forEach((col, index) => {
        if (index === 0) {
          query = query.ilike(col, `%${searchTerm}%`);
        } else {
          query = query.or(`${col}.ilike.%${searchTerm}%`);
        }
      });

      const { data, error } = await query;

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error(`Error searching in ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Contar registros con filtros
   */
  async count(filters?: Record<string, any>) {
    try {
      let query = this.fromTable().select('id', { count: 'exact', head: true });

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        });
      }

      const { count, error } = await query;

      if (error) throw error;
      return { count: count || 0, success: true };
    } catch (error) {
      console.error(`Error counting in ${this.table}:`, error);
      return { count: 0, error, success: false };
    }
  }

  /**
   * Operación en lote
   */
  async batchCreate(dataArray: any[]) {
    try {
      const { data, error } = await this.fromTable()
        .insert(dataArray)
        .select('*');

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error(`Error batch creating in ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }

  /**
   * Ejecutar consulta personalizada
   */
  async query(filters: any, options?: any) {
    try {
      let query = this.fromTable().select(options?.select || '*');

      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // Para operadores especiales: { field: ['in', [1, 2, 3]] }
          const [operator, val] = value;
          if (operator === 'in') {
            query = query.in(key, val);
          } else if (operator === 'gt') {
            query = query.gt(key, val);
          } else if (operator === 'lt') {
            query = query.lt(key, val);
          }
        } else {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error(`Error querying ${this.table}:`, error);
      return { data: null, error, success: false };
    }
  }
}

/**
 * Servicios específicos para cada tabla
 */
export const cityService = new SupabaseService('cities');
export const driverService = new SupabaseService('Driver');
export const companyService = new SupabaseService('companies');
export const rideRequestService = new SupabaseService('ride_requests');
export const serviceTypeService = new SupabaseService('service_types');
export const invoiceService = new SupabaseService('invoices');
export const bonusRuleService = new SupabaseService('bonus_rules');
export const bonusLogService = new SupabaseService('bonus_logs');
export const geoZoneService = new SupabaseService('geo_zones');
export const redZoneService = new SupabaseService('red_zones');
export const sosAlertService = new SupabaseService('sos_alerts');
export const supportTicketService = new SupabaseService('support_tickets');
export const surveyService = new SupabaseService('surveys');
export const surveyResponseService = new SupabaseService('survey_responses');
export const driverNotificationService = new SupabaseService('driver_notificaciones');
export const chatMessageService = new SupabaseService('chat_messages');
export const cancellationPolicyService = new SupabaseService('cancellation_policies');
export const appSettingsService = new SupabaseService('app_settings');
export const adminUserService = new SupabaseService('admin_users');
export const announcementService = new SupabaseService('announcements');
export const cashCutoffService = new SupabaseService('cash_cutoffs');
export const roadAssistUserService = new SupabaseService('road_assist_users');

export default supabaseServer;
