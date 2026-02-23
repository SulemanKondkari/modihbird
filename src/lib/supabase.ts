import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://urgbvmqmnlvvfhjpacqa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyZ2J2bXFtbmx2dmZoanBhY3FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MjgwMDcsImV4cCI6MjA4NzQwNDAwN30.cY-ikGTX4jMc68QUYa1qNooARJSsp-cYoUAr8wrIRfk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
