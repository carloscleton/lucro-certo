import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export interface UserSettings {
    quote_validity_days: number;
    commission_rate: number;
    service_commission_rate: number;
    product_commission_rate: number;
}

export function useSettings() {
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const [settings, setSettings] = useState<UserSettings>({
        quote_validity_days: 7,
        commission_rate: 0,
        service_commission_rate: 0,
        product_commission_rate: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && currentEntity) {
            fetchSettings();
        } else {
            // Reset to defaults on logout
            setSettings({
                quote_validity_days: 7,
                commission_rate: 0,
                service_commission_rate: 0,
                product_commission_rate: 0
            });
        }
    }, [user, currentEntity]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            if (currentEntity.type === 'company') {
                console.log('DEBUG: Fetching settings for company:', currentEntity.id);
                // 1. Fetch Company Settings
                const { data, error } = await supabase
                    .from('companies')
                    .select('settings')
                    .eq('id', currentEntity.id)
                    .single();

                if (error) {
                    console.error('DEBUG: Error fetching company settings:', error);
                }

                console.log('DEBUG: Company data received:', data);

                if (data?.settings && Object.keys(data.settings).length > 0) {
                    const s = data.settings;
                    console.log('DEBUG: Applying settings from company:', s);
                    setSettings({
                        quote_validity_days: s.quote_validity_days ?? 7,
                        commission_rate: s.commission_rate ?? 0,
                        service_commission_rate: s.service_commission_rate ?? 0,
                        product_commission_rate: s.product_commission_rate ?? 0
                    });
                } else {
                    console.log('DEBUG: No company settings found, using defaults.');
                    // Default values if company has no settings (or RLS blocked reading)
                    setSettings({
                        quote_validity_days: 7,
                        commission_rate: 0,
                        service_commission_rate: 0,
                        product_commission_rate: 0
                    });
                }
            } else {
                // 2. Fetch Personal Settings
                console.log('DEBUG: Fetching settings for personal context');

                const { data, error } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user!.id)
                    .single();

                if (data) {
                    setSettings({
                        quote_validity_days: data.quote_validity_days ?? 7,
                        commission_rate: data.commission_rate ?? 0,
                        service_commission_rate: data.service_commission_rate ?? 0,
                        product_commission_rate: data.product_commission_rate ?? 0
                    });
                } else {
                    // Default personal settings
                    setSettings({
                        quote_validity_days: 7,
                        commission_rate: 0,
                        service_commission_rate: 0,
                        product_commission_rate: 0
                    });

                    // Auto-create personal record if missing (only for personal context)
                    if (!error || error.code === 'PGRST116') {
                        await supabase.from('user_settings').insert([{ user_id: user!.id }]);
                    }
                }
            }
        } catch (error) {
            console.error('Error in fetchSettings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings: Partial<UserSettings>) => {
        try {
            if (currentEntity.type === 'company') {
                // Merge with existing settings in JSONB
                const { data: currentData } = await supabase
                    .from('companies')
                    .select('settings')
                    .eq('id', currentEntity.id)
                    .single();

                const existingSettings = currentData?.settings || {};
                const updatedJson = { ...existingSettings, ...newSettings };

                const { error } = await supabase
                    .from('companies')
                    .update({ settings: updatedJson })
                    .eq('id', currentEntity.id);

                if (error) throw error;
            } else {
                // Personal context - update user_settings
                const { error } = await supabase
                    .from('user_settings')
                    .update(newSettings)
                    .eq('user_id', user!.id);

                if (error) throw error;
            }

            setSettings(prev => ({ ...prev, ...newSettings }));
            return { error: null };
        } catch (error) {
            console.error('Error updating settings:', error);
            return { error };
        }
    };

    const clonePersonalSettings = async () => {
        if (currentEntity.type !== 'company') return { error: 'Not in company context' };

        try {
            const { data: personalData, error: personalError } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user!.id)
                .single();

            if (personalError) throw personalError;

            if (personalData) {
                const newSettings = {
                    quote_validity_days: personalData.quote_validity_days,
                    commission_rate: personalData.commission_rate,
                    service_commission_rate: personalData.service_commission_rate,
                    product_commission_rate: personalData.product_commission_rate
                };
                return await updateSettings(newSettings);
            }
            return { error: 'No personal settings found' };
        } catch (error) {
            console.error('Error cloning settings:', error);
            return { error };
        }
    };

    return {
        settings,
        loading,
        updateSettings,
        clonePersonalSettings
    };
}
