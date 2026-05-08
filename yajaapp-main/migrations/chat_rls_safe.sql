-- Script seguro para aplicar migraciones de chat (maneja tabla existente)

-- Verificar si la tabla existe y su estructura
DO $$
BEGIN
    -- Si la tabla existe, verificar si tiene las columnas correctas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_conversations') THEN
        RAISE NOTICE 'Tabla chat_conversations ya existe, verificando estructura...';
        
        -- Verificar columnas necesarias
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'chat_conversations' AND column_name = 'type') THEN
            RAISE EXCEPTION 'La tabla chat_conversations existe pero no tiene la columna type. Haz DROP TABLE chat_conversations; y ejecuta el script completo.';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'chat_conversations' AND column_name = 'ride_id') THEN
            RAISE EXCEPTION 'La tabla chat_conversations existe pero no tiene la columna ride_id. Haz DROP TABLE chat_conversations; y ejecuta el script completo.';
        END IF;
        
        RAISE NOTICE 'Estructura de tabla correcta, continuando...';
    ELSE
        -- Crear tabla si no existe
        CREATE TABLE chat_conversations (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN ('ride', 'driver_admin', 'passenger_admin')),
          ride_id UUID REFERENCES ride_requests(id) ON DELETE CASCADE,
          driver_id UUID REFERENCES "Driver"(id) ON DELETE CASCADE,
          passenger_id UUID REFERENCES road_assist_users(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE 'Tabla chat_conversations creada exitosamente';
    END IF;
END $$;

-- Agregar columnas a chat_messages si no existen
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'conversation_id') THEN
        ALTER TABLE chat_messages ADD COLUMN conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;
        RAISE NOTICE 'Columna conversation_id agregada a chat_messages';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_messages' AND column_name = 'read_by_passenger') THEN
        ALTER TABLE chat_messages ADD COLUMN read_by_passenger BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Columna read_by_passenger agregada a chat_messages';
    END IF;
END $$;

-- Políticas RLS (se recrearán si ya existen)
DROP POLICY IF EXISTS "Admin can view all conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Driver can view own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Passenger can view own conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can update their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON chat_messages;

-- Habilitar RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Crear políticas
CREATE POLICY "Admin can view all conversations" ON chat_conversations
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Driver can view own conversations" ON chat_conversations
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'driver' AND
    (
      (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
      (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
    )
  );

CREATE POLICY "Passenger can view own conversations" ON chat_conversations
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'passenger' AND
    (
      (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
      (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
    )
  );

CREATE POLICY "Users can view messages in their conversations" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN TRUE
        WHEN auth.jwt() ->> 'role' = 'driver' THEN
          (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
        WHEN auth.jwt() ->> 'role' = 'passenger' THEN
          (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
        ELSE FALSE
      END
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN TRUE
        WHEN auth.jwt() ->> 'role' = 'driver' THEN
          (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
        WHEN auth.jwt() ->> 'role' = 'passenger' THEN
          (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
        ELSE FALSE
      END
    )
  );

-- Políticas de UPDATE para conversaciones
CREATE POLICY "Users can update their conversations" ON chat_conversations
  FOR UPDATE USING (
    CASE
      WHEN auth.jwt() ->> 'role' = 'admin' THEN TRUE
      WHEN auth.jwt() ->> 'role' = 'driver' THEN
        (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
        (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
      WHEN auth.jwt() ->> 'role' = 'passenger' THEN
        (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
        (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
      ELSE FALSE
    END
  );

-- Políticas de UPDATE para mensajes
CREATE POLICY "Users can update messages in their conversations" ON chat_messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE
      CASE
        WHEN auth.jwt() ->> 'role' = 'admin' THEN TRUE
        WHEN auth.jwt() ->> 'role' = 'driver' THEN
          (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
        WHEN auth.jwt() ->> 'role' = 'passenger' THEN
          (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
          (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
        ELSE FALSE
      END
    )
  );

SELECT '✅ Migración de estructura completada exitosamente' as status;
