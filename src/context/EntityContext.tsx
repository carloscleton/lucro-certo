import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export type EntityType = 'personal' | 'company';

export interface Entity {
    type: EntityType;
    id?: string; // null for personal
    name: string;
    role?: 'owner' | 'admin' | 'member';
    whatsapp_instance_limit?: number;
    logo_url?: string;
    legal_name?: string;
    cnpj?: string;
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    settings?: any;
    fiscal_module_enabled?: boolean;
    payments_module_enabled?: boolean;
    crm_module_enabled?: boolean;
}

interface EntityContextType {
    currentEntity: Entity;
    availableEntities: Entity[];
    switchEntity: (entity: Entity) => void;
    refresh: () => Promise<void>;
    isLoading: boolean;
}

const EntityContext = createContext<EntityContextType>({
    currentEntity: { type: 'personal', name: 'Pessoal' },
    availableEntities: [],
    switchEntity: () => { },
    refresh: async () => { },
    isLoading: true,
});

export function EntityProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [currentEntity, setCurrentEntity] = useState<Entity>({ type: 'personal', name: 'Pessoal' });
    const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCompanies = async () => {
        if (!user) {
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
            setIsLoading(false);
            return;
        }

        try {
            // Fetch companies via membership to ensure we get all companies the user is part of
            const { data, error } = await supabase
                .from('company_members')
                .select(`
                    company:companies (
                        id,
                        trade_name,
                        legal_name,
                        cnpj,
                        whatsapp_instance_limit,
                        logo_url,
                        street,
                        number,
                        complement,
                        neighborhood,
                        city,
                        state,
                        zip_code,
                        settings,
                        fiscal_module_enabled,
                        payments_module_enabled,
                        crm_module_enabled
                    ),
                    role,
                    status
                `)
                .eq('user_id', user.id);

            if (error) throw error;

            // Map nested result to Entity
            const companies: Entity[] = (data || [])
                .filter((item: any) => item.company && item.status === 'active') // Filter active only for UI
                .map((item: any) => ({
                    type: 'company',
                    id: item.company.id,
                    name: item.company.trade_name,
                    role: item.role,
                    whatsapp_instance_limit: item.company.whatsapp_instance_limit || 1,
                    logo_url: item.company.logo_url,
                    legal_name: item.company.legal_name,
                    cnpj: item.company.cnpj,
                    street: item.company.street,
                    number: item.company.number,
                    complement: item.company.complement,
                    neighborhood: item.company.neighborhood,
                    city: item.company.city,
                    state: item.company.state,
                    zip_code: item.company.zip_code,
                    settings: item.company.settings,
                    fiscal_module_enabled: item.company.fiscal_module_enabled,
                    payments_module_enabled: item.company.payments_module_enabled,
                    crm_module_enabled: item.company.crm_module_enabled
                }));

            // Always include Personal option with user's settings
            const personalOption: Entity = {
                type: 'personal',
                name: 'Pessoal',
                settings: user ? (await supabase.from('profiles').select('settings').eq('id', user.id).maybeSingle()).data?.settings : {}
            };
            const allEntities = [personalOption, ...companies];
            setAvailableEntities(allEntities);

            // Update current entity if it already exists to get latest settings
            setCurrentEntity(prev => {
                if (prev.type === 'personal') {
                    // Decide if we should auto-switch to first company
                    if (companies.length > 0 && prev.name === 'Pessoal') {
                        return companies[0];
                    }
                    return prev;
                }
                const updated = companies.find(c => c.id === prev.id);
                if (updated) {
                    return updated;
                }
                return prev;
            });

        } catch (err) {
            console.error('Error fetching companies for entity selector:', err);
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();

        if (user) {
            // Realtime subscription for company updates (e.g. permission changes)
            const channel = supabase
                .channel('entity-updates')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'companies'
                }, () => {
                    fetchCompanies();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [user]);

    const switchEntity = (entity: Entity) => {
        setCurrentEntity(entity);
        // Persist preference logically if needed, for now just state
    };

    return (
        <EntityContext.Provider value={{ currentEntity, availableEntities, switchEntity, refresh: fetchCompanies, isLoading }}>
            {children}
        </EntityContext.Provider>
    );
}

export const useEntity = () => useContext(EntityContext);
