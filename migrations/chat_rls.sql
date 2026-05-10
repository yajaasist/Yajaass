-- Crear nueva tabla para chats independientes
CREATE TABLE chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('ride', 'driver_admin', 'passenger_admin')),
  ride_id UUID REFERENCES ride_requests(id) ON DELETE CASCADE, -- Solo para type='ride'
  driver_id UUID REFERENCES Driver(id) ON DELETE CASCADE, -- Para 'ride' y 'driver_admin'
  passenger_id UUID REFERENCES road_assist_users(id) ON DELETE CASCADE, -- Para 'ride' y 'passenger_admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modificar tabla chat_messages para usar conversation_id
ALTER TABLE chat_messages ADD COLUMN conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN read_by_passenger BOOLEAN DEFAULT FALSE;

-- Políticas RLS para chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Admin puede ver todas las conversaciones
CREATE POLICY "Admin can view all conversations" ON chat_conversations
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Driver puede ver conversaciones de sus viajes y con admin
CREATE POLICY "Driver can view own conversations" ON chat_conversations
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'driver' AND
    (
      (type = 'ride' AND driver_id = (auth.jwt() ->> 'user_id')::UUID) OR
      (type = 'driver_admin' AND driver_id = (auth.jwt() ->> 'user_id')::UUID)
    )
  );

-- Passenger puede ver conversaciones de sus viajes y con admin
CREATE POLICY "Passenger can view own conversations" ON chat_conversations
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'passenger' AND
    (
      (type = 'ride' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID) OR
      (type = 'passenger_admin' AND passenger_id = (auth.jwt() ->> 'user_id')::UUID)
    )
  );

-- Políticas RLS para chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Usar la política de conversaciones para mensajes
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

-- Políticas de inserción
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