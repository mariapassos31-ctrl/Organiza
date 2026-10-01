-- Controle de envio do resumo semanal por e-mail (toda sexta, escala da
-- semana seguinte) — evita reenviar a mesma semana se o agendador checar
-- mais de uma vez na janela (sexta 17h a domingo) ou o servidor reiniciar.
CREATE TABLE IF NOT EXISTS "escala_ti"."resumo_semanal_enviado" (
  dt_semana  DATE PRIMARY KEY,
  dt_enviado TIMESTAMPTZ NOT NULL DEFAULT now()
);
