import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useEntity } from '../context/EntityContext';

export interface UserSettings {
    quote_validity_days: number;
    commission_rate: number;
    service_commission_rate: number;
    product_commission_rate: number;
    automation_financial_reminders?: boolean;
    automation_financial_time?: string; // HH:mm
    automation_financial_prompt?: string;
    automation_financial_template?: string;
    automation_birthday_reminders?: boolean;
    automation_birthday_time?: string; // HH:mm
    automation_birthday_prompt?: string;
    automation_birthday_template?: string;
    automation_overdue_reminders?: boolean;
    automation_overdue_time?: string; // HH:mm
    automation_overdue_prompt?: string;
    automation_overdue_template?: string;
}

export function useSettings() {
    const { user } = useAuth();
    const { currentEntity } = useEntity();

    const [settings, setSettings] = useState<UserSettings>({
        quote_validity_days: 7,
        commission_rate: 0,
        service_commission_rate: 0,
        product_commission_rate: 0,
        automation_financial_reminders: false,
        automation_financial_time: '08:00',
        automation_birthday_reminders: false,
        automation_birthday_time: '09:00',
        automation_overdue_reminders: false,
        automation_overdue_time: '10:00'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && currentEntity) {
            fetchSettings();
        } else {
            setSettings({
                quote_validity_days: 7,
                commission_rate: 0,
                service_commission_rate: 0,
                product_commission_rate: 0,
                automation_financial_reminders: false,
                automation_financial_time: '08:00',
                automation_birthday_reminders: false,
                automation_birthday_time: '09:00',
                automation_overdue_reminders: false,
                automation_overdue_time: '10:00'
            });
        }
    }, [user, currentEntity]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            if (currentEntity.type === 'company') {
                const { data, error } = await supabase
                    .from('companies')
                    .select('settings')
                    .eq('id', currentEntity.id)
                    .single();

                if (error) {
                    console.error('Error fetching company settings:', error);
                }

                if (data?.settings && Object.keys(data.settings).length > 0) {
                    const s = data.settings;
                    setSettings({
                        quote_validity_days: s.quote_validity_days ?? 7,
                        commission_rate: s.commission_rate ?? 0,
                        service_commission_rate: s.service_commission_rate ?? 0,
                        product_commission_rate: s.product_commission_rate ?? 0,
                        automation_financial_reminders: s.automation_financial_reminders ?? false,
                        automation_financial_time: s.automation_financial_time ?? '08:00',
                        automation_financial_prompt: s.automation_financial_prompt ?? '',
                        automation_financial_template: s.automation_financial_template ?? '',
                        automation_birthday_reminders: s.automation_birthday_reminders ?? false,
                        automation_birthday_time: s.automation_birthday_time ?? '09:00',
                        automation_birthday_prompt: s.automation_birthday_prompt ?? '',
                        automation_birthday_template: s.automation_birthday_template ?? '',
                        automation_overdue_reminders: s.automation_overdue_reminders ?? false,
                        automation_overdue_time: s.automation_overdue_time ?? '10:00',
                        automation_overdue_prompt: s.automation_overdue_prompt ?? '',
                        automation_overdue_template: s.automation_overdue_template ?? ''
                    });
                } else {
                    setSettings({
                        quote_validity_days: 7,
                        commission_rate: 0,
                        service_commission_rate: 0,
                        product_commission_rate: 0,
                        automation_financial_reminders: false,
                        automation_financial_time: '08:00',
                        automation_birthday_reminders: false,
                        automation_birthday_time: '09:00',
                        automation_overdue_reminders: false,
                        automation_overdue_time: '10:00'
                    });
                }
            } else {
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
                        product_commission_rate: data.product_commission_rate ?? 0,
                        automation_financial_reminders: data.automation_financial_reminders ?? false,
                        automation_financial_time: data.automation_financial_time ?? '08:00',
                        automation_financial_prompt: data.automation_financial_prompt ?? '',
                        automation_financial_template: data.automation_financial_template ?? '',
                        automation_birthday_reminders: data.automation_birthday_reminders ?? false,
                        automation_birthday_time: data.automation_birthday_time ?? '09:00',
                        automation_birthday_prompt: data.automation_birthday_prompt ?? '',
                        automation_birthday_template: data.automation_birthday_template ?? '',
                        automation_overdue_reminders: data.automation_overdue_reminders ?? false,
                        automation_overdue_time: data.automation_overdue_time ?? '10:00',
                        automation_overdue_prompt: data.automation_overdue_prompt ?? '',
                        automation_overdue_template: data.automation_overdue_template ?? ''
                    });
                } else {
                    setSettings({
                        quote_validity_days: 7,
                        commission_rate: 0,
                        service_commission_rate: 0,
                        product_commission_rate: 0,
                        automation_financial_reminders: false,
                        automation_financial_time: '08:00',
                        automation_birthday_reminders: false,
                        automation_birthday_time: '09:00',
                        automation_overdue_reminders: false,
                        automation_overdue_time: '10:00'
                    });
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
                await fetchSettings(); // Refresh to ensure state is sync
            } else {
                const { error } = await supabase
                    .from('user_settings')
                    .update(newSettings)
                    .eq('user_id', user!.id);

                if (error) throw error;
                await fetchSettings();
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
                    product_commission_rate: personalData.product_commission_rate,
                    automation_financial_reminders: personalData.automation_financial_reminders,
                    automation_financial_time: personalData.automation_financial_time,
                    automation_financial_prompt: personalData.automation_financial_prompt,
                    automation_financial_template: personalData.automation_financial_template,
                    automation_birthday_reminders: personalData.automation_birthday_reminders,
                    automation_birthday_time: personalData.automation_birthday_time,
                    automation_birthday_prompt: personalData.automation_birthday_prompt,
                    automation_birthday_template: personalData.automation_birthday_template,
                    automation_overdue_reminders: personalData.automation_overdue_reminders,
                    automation_overdue_time: personalData.automation_overdue_time,
                    automation_overdue_prompt: personalData.automation_overdue_prompt,
                    automation_overdue_template: personalData.automation_overdue_template
                };
                return await updateSettings(newSettings);
            }
            return { error: 'No personal settings found' };
        } catch (error) {
            console.error('Error cloning settings:', error);
            return { error };
        }
    };

    return { settings, loading, updateSettings, clonePersonalSettings };
}
