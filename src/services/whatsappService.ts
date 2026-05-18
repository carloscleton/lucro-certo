import { API_BASE_URL } from '../lib/constants';

export interface SendWhatsAppParams {
    instanceName: string;
    number: string;
    text: string;
    mediaUrl?: string;
    mediaType?: 'document' | 'image' | 'video';
    mimetype?: string;
    fileName?: string;
}

export const whatsappService = {
    async sendMessage({ instanceName, number, text, mediaUrl, mediaType, mimetype, fileName }: SendWhatsAppParams) {
        let cleanNumber = number.replace(/\D/g, '');
        if (cleanNumber.length === 10 || cleanNumber.length === 11) {
            cleanNumber = '55' + cleanNumber;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/whatsapp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instanceName,
                    number: cleanNumber,
                    text,
                    mediaUrl,
                    mediaType,
                    mimetype,
                    fileName
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
