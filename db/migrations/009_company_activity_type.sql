ALTER TABLE companies ADD COLUMN activity_type TEXT NOT NULL DEFAULT 'hotel'
  CHECK(activity_type IN (
    'hotel','pousada','albergue_hostel','alojamento_floresta','flat_aparthotel',
    'hotel_fazenda','resort','cama_cafe','camping','outro_hospedagem',
    'passeios','navegacao_fluvial','transporte_aereo','transportadora_turistica','outro_operador'
  ));

UPDATE companies SET activity_type = CASE
  WHEN kind = 'operator' THEN 'passeios'
  ELSE 'hotel'
END;
