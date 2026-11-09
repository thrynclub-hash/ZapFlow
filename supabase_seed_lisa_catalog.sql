-- ========================================================
-- ZapFlow — Importação do Catálogo da Lisa La Bella
-- Gerado automaticamente a partir das exportações do Bling
-- ========================================================

DO $$
DECLARE
  v_client_id UUID;
  v_prod_id UUID;
BEGIN
  -- 1. Localiza a Lisa La Bella (ou primeiro cliente ativo com nome semelhante)
  SELECT id INTO v_client_id FROM clients WHERE name ILIKE '%Lisa%' LIMIT 1;
  
  IF v_client_id IS NULL THEN
    SELECT id INTO v_client_id FROM clients ORDER BY created_at ASC LIMIT 1;
  END IF;

  RAISE NOTICE 'Importando produtos para o cliente ID: %', v_client_id;


  -- --------------------------------------------------------
  -- Produto: Kit 3 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual - Branco+Preto (PR0-0014-028)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0014-028';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 3 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual - Branco+Preto',
      'PR0-0014-028',
      'PR0-0014-028',
      0,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom1.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom2.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom3.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom4.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom5.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom6.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_vitrine1.jpg?ts=1789080469']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 3 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual - Branco+Preto',
      price = 0,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom1.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom2.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom3.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom4.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom5.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_zoom6.jpg?ts=1789080469', 'https://static.zattini.com.br/produtos/kit-3-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/28/PR0-0014-028/PR0-0014-028_vitrine1.jpg?ts=1789080469']
    WHERE id = v_prod_id;
  END IF;
  
  -- --------------------------------------------------------
  -- Produto: Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto (PR0-0012-006)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0012-006';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto',
      'PR0-0012-006',
      'PR0-0012-006',
      0,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom1.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom2.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom3.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom4.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_vitrine1.jpg?ts=1793749451']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto',
      price = 0,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom1.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom2.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom3.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_zoom4.jpg?ts=1793749451', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/06/PR0-0012-006/PR0-0012-006_vitrine1.jpg?ts=1793749451']
    WHERE id = v_prod_id;
  END IF;
  
  -- --------------------------------------------------------
  -- Produto: Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto+Cinza (PR0-0012-172)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0012-172';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto+Cinza',
      'PR0-0012-172',
      'PR0-0012-172',
      0,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom1.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom2.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom3.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom4.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom5.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom6.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_vitrine1.jpg?ts=1793749457']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 2 Camisetas Dry Uv Masculina Blusa Camisa Basica - Preto+Cinza',
      price = 0,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom1.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom2.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom3.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom4.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom5.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_zoom6.jpg?ts=1793749457', 'https://static.zattini.com.br/produtos/kit-2-camisetas-dry-uv-masculina-blusa-camisa-basica/72/PR0-0012-172/PR0-0012-172_vitrine1.jpg?ts=1793749457']
    WHERE id = v_prod_id;
  END IF;
  
  -- --------------------------------------------------------
  -- Produto: Kit 2 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual (PR0-0015-014)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0015-014';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 2 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual',
      'PR0-0015-014',
      'PR0-0015-014',
      60.75,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom1.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom2.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom3.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom4.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom5.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom6.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_vitrine1.jpg?ts=1793784538']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 2 Camisetas Masculina Segunda Pele Manga Longa Suplex Esportiva Casual',
      price = 60.75,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom1.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom2.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom3.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom4.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom5.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_zoom6.jpg?ts=1793784538', 'https://static.zattini.com.br/produtos/kit-2-camisetas-masculina-segunda-pele-manga-longa-suplex-esportiva-casual/14/PR0-0015-014/PR0-0015-014_vitrine1.jpg?ts=1793784538']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0015-014-04', 50)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0015-014-05', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0015-014-03', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0015-014-02', 0)
  ON CONFLICT DO NOTHING;
    
  -- --------------------------------------------------------
  -- Produto: Kit 6 Camisetas Dry UV Masculina Blusa Camisa Fitness Academia BÃ¡sica Lisa (PR0-0008-006)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0008-006';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 6 Camisetas Dry UV Masculina Blusa Camisa Fitness Academia BÃ¡sica Lisa',
      'PR0-0008-006',
      'PR0-0008-006',
      122.97,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom1.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom2.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom3.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom4.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_vitrine1.jpg?ts=1785885230']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 6 Camisetas Dry UV Masculina Blusa Camisa Fitness Academia BÃ¡sica Lisa',
      price = 122.97,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom1.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom2.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom3.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_zoom4.jpg?ts=1785885230', 'https://static.zattini.com.br/produtos/kit-6-camisetas-dry-uv-masculina-blusa-camisa-fitness-academia-basica-lisa/06/PR0-0008-006/PR0-0008-006_vitrine1.jpg?ts=1785885230']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0008-006-04', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0008-006-05', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0008-006-03', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0008-006-02', 50)
  ON CONFLICT DO NOTHING;
    
  -- --------------------------------------------------------
  -- Produto: Short Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida (PR0-0000-018)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0000-018';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Short Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      'PR0-0000-018',
      'PR0-0000-018',
      26.67,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_zoom1.jpg?ts=1791200176', 'https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_zoom2.jpg?ts=1791200176', 'https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_vitrine1.jpg?ts=1791200176']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Short Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      price = 26.67,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_zoom1.jpg?ts=1791200176', 'https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_zoom2.jpg?ts=1791200176', 'https://static.clube.netshoes.com.br/produtos/short-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/18/PR0-0000-018/PR0-0000-018_vitrine1.jpg?ts=1791200176']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0000-018-04', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0000-018-05', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0000-018-03', 50)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0000-018-02', 0)
  ON CONFLICT DO NOTHING;
    
  -- --------------------------------------------------------
  -- Produto: Kit 2 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida (PR0-0007-026)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0007-026';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 2 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      'PR0-0007-026',
      'PR0-0007-026',
      45.93,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom1.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom2.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom3.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom4.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom5.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_vitrine1.jpg?ts=1787179192']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 2 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      price = 45.93,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom1.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom2.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom3.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom4.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_zoom5.jpg?ts=1787179192', 'https://static.clube.netshoes.com.br/produtos/kit-2-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/26/PR0-0007-026/PR0-0007-026_vitrine1.jpg?ts=1787179192']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0007-026-04', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0007-026-05', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0007-026-03', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0007-026-02', 50)
  ON CONFLICT DO NOTHING;
    
  -- --------------------------------------------------------
  -- Produto: Kit 4 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida (PR0-0005-244)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0005-244';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Kit 4 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      'PR0-0005-244',
      'PR0-0005-244',
      84.45,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom1.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom2.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom3.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom4.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom5.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom6.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_vitrine1.jpg?ts=1793786628']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Kit 4 Shorts Masculino Liso BÃ¡sico Bermuda Tactel Ãgua Praia Treino Academia Corrida',
      price = 84.45,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom1.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom2.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom3.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom4.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom5.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_zoom6.jpg?ts=1793786628', 'https://static.clube.netshoes.com.br/produtos/kit-4-shorts-masculino-liso-basico-bermuda-tactel-agua-praia-treino-academia-corrida/44/PR0-0005-244/PR0-0005-244_vitrine1.jpg?ts=1793786628']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0005-244-04', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0005-244-05', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0005-244-03', 50)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0005-244-02', 0)
  ON CONFLICT DO NOTHING;
    
  -- --------------------------------------------------------
  -- Produto: Short Violeta Shock Liso Tactel Masculino (PR0-0000-342)
  -- --------------------------------------------------------
  SELECT id INTO v_prod_id FROM products WHERE client_id = v_client_id AND sku = 'PR0-0000-342';
  
  IF v_prod_id IS NULL THEN
    INSERT INTO products (
      client_id, name, sku, barcode, price, cost_price, promo_price, 
      is_promo, stock_qty, category, images
    ) VALUES (
      v_client_id,
      'Short Violeta Shock Liso Tactel Masculino',
      'PR0-0000-342',
      'PR0-0000-342',
      26.67,
      0,
      NULL,
      FALSE,
      50,
      'Moda Masculina',
      ARRAY['https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom1.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom2.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom3.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_vitrine1.jpg?ts=1787656593']
    ) RETURNING id INTO v_prod_id;
  ELSE
    UPDATE products SET
      name = 'Short Violeta Shock Liso Tactel Masculino',
      price = 26.67,
      cost_price = 0,
      promo_price = NULL,
      is_promo = FALSE,
      stock_qty = 50,
      category = 'Moda Masculina',
      images = ARRAY['https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom1.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom2.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_zoom3.jpg?ts=1787656593', 'https://static.clube.netshoes.com.br/produtos/short-violeta-shock-liso-tactel-masculino/42/PR0-0000-342/PR0-0000-342_vitrine1.jpg?ts=1787656593']
    WHERE id = v_prod_id;
  END IF;
  
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'G', 'PR0-0000-342-04', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'GG', 'PR0-0000-342-05', 50)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'M', 'PR0-0000-342-03', 0)
  ON CONFLICT DO NOTHING;
    
  INSERT INTO product_variants (product_id, client_id, color, size, sku, stock_quantity)
  VALUES (v_prod_id, v_client_id, '', 'P', 'PR0-0000-342-02', 0)
  ON CONFLICT DO NOTHING;
    
  RAISE NOTICE 'Catálogo da Lisa importado com sucesso!';
END $$;
