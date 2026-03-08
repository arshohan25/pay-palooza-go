DROP POLICY "Public read payment session by id" ON merchant_payment_sessions;
CREATE POLICY "Anyone can read payment sessions" ON merchant_payment_sessions FOR SELECT USING (true);