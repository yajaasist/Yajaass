// Script para migrar mensajes de chat existentes al nuevo sistema
// Ejecutar una vez después de aplicar la migración SQL

console.log('🚀 Script de migración de chats');
console.log('');
console.log('📋 INSTRUCCIONES PARA MIGRACIÓN MANUAL:');
console.log('');
console.log('1. Aplica el SQL en Supabase (migrations/chat_rls.sql)');
console.log('2. Ejecuta esta consulta SQL para migrar mensajes existentes:');
console.log('');
console.log(`-- Migrar mensajes existentes a conversaciones
INSERT INTO chat_conversations (type, ride_id, driver_id, passenger_id)
SELECT 'ride', cm.ride_id, rr.driver_id, rr.passenger_user_id
FROM chat_messages cm
JOIN ride_requests rr ON cm.ride_id = rr.id
WHERE cm.conversation_id IS NULL
GROUP BY cm.ride_id, rr.driver_id, rr.passenger_user_id;

-- Actualizar mensajes con conversation_id
UPDATE chat_messages
SET conversation_id = c.id,
    read_by_passenger = COALESCE(read_by_passenger, false)
FROM chat_conversations c
WHERE chat_messages.ride_id = c.ride_id
  AND chat_messages.conversation_id IS NULL;

-- Verificar migración
SELECT 'Conversaciones creadas:' as info, COUNT(*) as count FROM chat_conversations
UNION ALL
SELECT 'Mensajes migrados:' as info, COUNT(*) as count FROM chat_messages WHERE conversation_id IS NOT NULL;`);
console.log('');
console.log('✅ Una vez ejecutado el SQL arriba, la migración estará completa.');
console.log('🎉 ¡Sistema de chats listo para producción!');