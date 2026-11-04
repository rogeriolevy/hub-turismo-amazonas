CREATE INDEX tours_public_experience_search
  ON tours(company_id,city,name,id)
  WHERE published=1;

CREATE INDEX guides_public_experience_search
  ON guides(company_id,name,id)
  WHERE published=1;
