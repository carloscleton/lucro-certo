import { API_BASE_URL } from '../lib/constants';
import { supabase } from '../lib/supabase';

export interface SendWhatsAppParams {
    instanceName: string;
    number: string;
    text: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image' | 'video';
    mimetype?: string;
    fileName?: string;
    companyId?: string;
    token?: string;
}

export const whatsappService = {
    async sendMessage({ instanceName, number, text, mediaUrl, mediaType, mimetype, fileName, companyId, token }: SendWhatsAppParams) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length === 10 || cleanNumber.length === 11) {
            cleanNumber = '55' + cleanNumber;
        }
        if (cleanNumber.startsWith('55') && cleanNumber.length === 13) {
            const ddd = parseInt(cleanNumber.substring(2, 4), 10);
            if (ddd > 28) {
                cleanNumber = cleanNumber.substring(0, 4) + cleanNumber.substring(5);
            }
        }
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }

            const response = await fetch(`${API_BASE_URL}/whatsapp/send`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    instanceName,
                    number: cleanNumber,
                    text,
                    mediaUrl,
                    mediaType,
                    mimetype,
                    fileName,
                    companyId,
                    token
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail?.message || 'Falha ao enviar mensagem via WhatsApp.');
            }

            return await response.json();
        } catch (error: any) {
            console.error('WhatsApp Service Error:', error);
            throw error;
        }
    }
};
