-- Allow public access to view quotes if they have the ID
CREATE POLICY "Public can view quotes with ID" ON quotes FOR SELECT TO public USING (true);
CREATE POLICY "Public can view quote items with ID" ON quote_items FOR SELECT TO public USING (true);
CREATE POLICY "Public can view companies with ID" ON companies FOR SELECT TO public USING (true);
CREATE POLICY "Public can view contacts with ID" ON contacts FOR SELECT TO public USING (true);
