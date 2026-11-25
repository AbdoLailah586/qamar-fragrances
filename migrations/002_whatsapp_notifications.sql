CREATE TABLE IF NOT EXISTS whatsapp_notifications (
  id VARCHAR(120) PRIMARY KEY,
  order_id VARCHAR(120),
  order_number VARCHAR(120),
  phone VARCHAR(40) NOT NULL,
  notification_type VARCHAR(60) NOT NULL DEFAULT 'custom',
  message_text TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sender_email VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whatsapp_notifications_created_idx ON whatsapp_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_notifications_order_idx ON whatsapp_notifications(order_id);
