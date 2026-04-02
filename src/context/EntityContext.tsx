import { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
    cpf?: string;
    entity_type?: 'PF' | 'PJ';
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
    has_social_copilot?: boolean;
    automations_module_enabled?: boolean;
    has_lead_radar?: boolean;
    loyalty_module_enabled?: boolean;
    status?: string;
    subscription_status?: string;
    subscription_plan?: string;
    trial_ends_at?: string;
    created_at?: string;
    phone?: string;
    associated_company_id?: string; // Links personal context to its main billing company
    currency?: string;
}

interface EntityContextType {
    currentEntity: Entity;
    availableEntities: Entity[];
    switchEntity: (entity: Entity) => void;
    refresh: () => Promise<void>;
    isLoading: boolean;
}

const EntityContext = createContext<EntityContextType>({
    currentEntity: { type: 'personal', name: 'Pessoal', status: 'active' },
    availableEntities: [],
    switchEntity: () => { },
    refresh: async () => { },
    isLoading: true,
});

const STORAGE_KEY = 'lucro-certo:selected-entity';

export function EntityProvider({ children }: { children: ReactNode }) {
    const { user, profile } = useAuth();
    const [currentEntity, setCurrentEntity] = useState<Entity>({ type: 'personal', name: 'Pessoal', status: 'active' });
    const [availableEntities, setAvailableEntities] = useState<Entity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCompanies = async () => {
        if (!user) {
            setAvailableEntities([{ type: 'personal', name: 'Pessoal', status: 'active' }]);
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
                        cpf,
                        entity_type,
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
                        crm_module_enabled,
                        has_social_copilot,
                        automations_module_enabled,
                        has_lead_radar,
                        loyalty_module_enabled,
                        status,
                        subscription_status,
                        subscription_plan,
                        trial_ends_at,
                        created_at,
                        phone,
                        currency
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
                    cpf: item.company.cpf,
                    entity_type: item.company.entity_type,
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
                    crm_module_enabled: item.company.crm_module_enabled,
                    has_social_copilot: item.company.has_social_copilot,
                    automations_module_enabled: item.company.automations_module_enabled,
                    has_lead_radar: item.company.has_lead_radar,
                    loyalty_module_enabled: item.company.loyalty_module_enabled,
                    status: item.company.status,
                    subscription_status: item.company.subscription_status,
                    subscription_plan: item.company.subscription_plan,
                    trial_ends_at: item.company.trial_ends_at,
                    created_at: item.company.created_at,
                    phone: item.company.phone,
                    currency: item.company.currency
                }));

            // Base creation date for personal context (use profile or auth user as fallback)
            // Use user.created_at if profile.created_at is not available (common in local devs)
            const baseCreatedAt = profile?.created_at || user?.created_at;
            
            // Calculate if account is within 7 days
            let isActuallyNew = false;
            if (baseCreatedAt) {
                const createdDate = new Date(baseCreatedAt).getTime();
                const now = new Date().getTime();
                const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
                isActuallyNew = (now - createdDate) < sevenDaysInMs;
            }


            // Always include Personal option with user's settings
            const personalOption: Entity = {
                type: 'personal',
                id: 'personal',
                name: 'Pessoal',
                status: profile?.status || 'active',
                settings: profile?.settings || {},
                // Include trial and creation info for badges
                subscription_plan: profile?.settings?.subscription_plan || (isActuallyNew ? 'trial' : undefined),
                trial_ends_at: profile?.settings?.trial_ends_at || (baseCreatedAt ? new Date(new Date(baseCreatedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined),
                created_at: baseCreatedAt,
                phone: profile?.phone,
                associated_company_id: profile?.company_id
            };
            
            const allEntities = [personalOption, ...companies];
            setAvailableEntities(allEntities);

            // Restaurar preferência salva do localStorage
            const savedKey = localStorage.getItem(STORAGE_KEY);

            setCurrentEntity(prev => {
                // Determine the best entity to return
                let bestMatch: Entity | null = null;

                // 1. Try to maintain current selection with fresh data
                if (prev.type === 'company') {
                    bestMatch = companies.find(c => c.id === prev.id) || null;
                } else {
                    bestMatch = personalOption;
                }

                // 2. If no current selection (or lost), check saved preference
                if (!bestMatch && savedKey) {
                    if (savedKey === 'personal') {
                        bestMatch = personalOption;
                    } else {
                        bestMatch = companies.find(c => c.id === savedKey) || null;
                    }
                }

                // 3. Auto-switch logic (only if no active preference)
                if (!savedKey && companies.length > 0 && !bestMatch) {
                    bestMatch = companies[0];
                }

                return bestMatch || personalOption;
            });

        } catch (err) {
            console.error('Error fetching companies for entity selector:', err);
            setAvailableEntities([{ type: 'personal', name: 'Pessoal' }]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchCompanies();
        } else {
            // Se deslogar, reseta TUDO imediatamente
            setCurrentEntity({ type: 'personal', name: 'Pessoal', status: 'active' });
            setAvailableEntities([{ type: 'personal', name: 'Pessoal', status: 'active' }]);
            localStorage.removeItem(STORAGE_KEY);
            setIsLoading(false);
        }
    }, [user, profile]);

    const switchEntity = (entity: Entity) => {
        setCurrentEntity(entity);
        // Persistir preferência do usuário no localStorage
        const key = entity.type === 'personal' ? 'personal' : entity.id;
        localStorage.setItem(STORAGE_KEY, key || 'personal');
    };

    const entityValue = useMemo(() => ({
        currentEntity,
        availableEntities,
        switchEntity,
        refresh: fetchCompanies,
        isLoading
    }), [currentEntity, availableEntities, isLoading]);

    return (
        <EntityContext.Provider value={entityValue}>
            {children}
        </EntityContext.Provider>
    );
}

export const useEntity = () => useContext(EntityContext);
