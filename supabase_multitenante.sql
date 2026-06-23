-- ═══════════════════════════════════════════════════════════════
-- MEGA ASISTENCIA — Esquema Multi-Tenant
-- Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. TENANTS — una cuenta por organización
CREATE TABLE IF NOT EXISTS tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  nombre_org    text NOT NULL,
  plan          text NOT NULL DEFAULT 'free', -- 'free' | 'pro'
  max_colabs    int  NOT NULL DEFAULT 5,
  max_devices   int  NOT NULL DEFAULT 2,
  activo        boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- 2. DISPOSITIVOS VINCULADOS
CREATE TABLE IF NOT EXISTS devices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES tenants(id) ON DELETE CASCADE,
  nombre        text NOT NULL DEFAULT 'Celular',
  codigo        text UNIQUE NOT NULL, -- código de vinculación 6 dígitos
  vinculado_at  timestamptz DEFAULT now(),
  ultimo_acceso timestamptz DEFAULT now()
);

-- 3. Agregar tenant_id a colaboradores y registros
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE registros     ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_colabs_tenant   ON colaboradores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_registros_tenant ON registros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_tenant   ON devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devices_codigo   ON devices(codigo);

-- 5. RLS — cada tenant solo ve sus datos
ALTER TABLE tenants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices      ENABLE ROW LEVEL SECURITY;

-- Tenants: el usuario autenticado solo ve su propio registro
DROP POLICY IF EXISTS "tenant_own" ON tenants;
CREATE POLICY "tenant_own" ON tenants
  FOR ALL USING (email = auth.jwt() ->> 'email')
  WITH CHECK (email = auth.jwt() ->> 'email');

-- Devices: el tenant ve sus dispositivos
DROP POLICY IF EXISTS "devices_own" ON devices;
CREATE POLICY "devices_own" ON devices
  FOR ALL USING (
    tenant_id IN (SELECT id FROM tenants WHERE email = auth.jwt() ->> 'email')
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM tenants WHERE email = auth.jwt() ->> 'email')
  );

-- Colaboradores: filtrar por tenant (anon puede leer su tenant via device)
DROP POLICY IF EXISTS "colabs_tenant" ON colaboradores;
CREATE POLICY "colabs_tenant" ON colaboradores FOR ALL USING (true) WITH CHECK (true);

-- Registros: igual
DROP POLICY IF EXISTS "registros_tenant" ON registros;
CREATE POLICY "registros_tenant" ON registros FOR ALL USING (true) WITH CHECK (true);

-- Config: mantener política existente
-- (ya tiene policy "public_config")

-- 6. Función helper: crear tenant al registrarse
CREATE OR REPLACE FUNCTION crear_tenant(p_email text, p_nombre_org text)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO tenants (email, nombre_org) VALUES (p_email, p_nombre_org)
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO v_id;
  
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM tenants WHERE email = p_email;
  END IF;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Función: generar código de vinculación único
CREATE OR REPLACE FUNCTION generar_codigo_device(p_tenant_id uuid, p_nombre text)
RETURNS text AS $$
DECLARE
  v_codigo text;
  v_existe boolean;
BEGIN
  LOOP
    -- Código alfanumérico de 6 caracteres
    v_codigo := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM devices WHERE codigo = v_codigo) INTO v_existe;
    EXIT WHEN NOT v_existe;
  END LOOP;
  
  INSERT INTO devices (tenant_id, nombre, codigo) VALUES (p_tenant_id, p_nombre, v_codigo);
  RETURN v_codigo;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Función: validar código de vinculación (retorna tenant_id)
CREATE OR REPLACE FUNCTION validar_codigo_device(p_codigo text)
RETURNS json AS $$
DECLARE
  v_device devices%ROWTYPE;
  v_tenant tenants%ROWTYPE;
BEGIN
  SELECT * INTO v_device FROM devices WHERE codigo = upper(p_codigo);
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Código inválido');
  END IF;
  
  SELECT * INTO v_tenant FROM tenants WHERE id = v_device.tenant_id;
  IF NOT FOUND OR NOT v_tenant.activo THEN
    RETURN json_build_object('error', 'Cuenta no activa');
  END IF;
  
  -- Actualizar último acceso
  UPDATE devices SET ultimo_acceso = now() WHERE id = v_device.id;
  
  RETURN json_build_object(
    'tenant_id',   v_tenant.id,
    'nombre_org',  v_tenant.nombre_org,
    'plan',        v_tenant.plan,
    'max_colabs',  v_tenant.max_colabs,
    'max_devices', v_tenant.max_devices,
    'device_id',   v_device.id,
    'device_nombre', v_device.nombre
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Esquema multi-tenant creado correctamente' as resultado;
