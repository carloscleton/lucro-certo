import { supabase } from './supabase';

export const r2Storage = {
    async upload(file: File, path: string): Promise<{ publicUrl: string, path: string }> {
        // 1. Get pre-signed URL from Edge Function
        const { data, error } = await supabase.functions.invoke('r2-storage', {
            body: {
                action: 'get_upload_url',
                fileName: path,
                contentType: file.type
            }
        });

        if (error || !data.uploadUrl) {
            throw new Error(error?.message || 'Falha ao gerar URL de upload R2');
        }

        // 2. Upload directly to R2
        const uploadResponse = await fetch(data.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });

        if (!uploadResponse.ok) {
            throw new Error('Falha ao enviar arquivo para o Cloudflare R2');
        }

        // 3. Return the public URL
        // In R2, usually you have a custom domain or the public bucket URL
        const R2_PUBLIC_DOMAIN = import.meta.env.VITE_R2_PUBLIC_DOMAIN || '';
        const publicUrl = `${R2_PUBLIC_DOMAIN}/${path}`;

        return { publicUrl, path };
    },

    async delete(path: string): Promise<void> {
        const { error } = await supabase.functions.invoke('r2-storage', {
            body: {
                action: 'delete_file',
                fileName: path
            }
        });

        if (error) {
            console.error('Falha ao deletar arquivo no R2:', error);
        }
    },

    async list(prefix: string): Promise<any[]> {
        const { data, error } = await supabase.functions.invoke('r2-storage', {
            body: {
                action: 'list_files',
                prefix
            }
        });

        if (error) {
            console.error('Falha ao listar arquivos no R2:', error);
            return [];
        }

        return data.files || [];
    },

    async deleteMultiple(fileKeys: string[]): Promise<void> {
        if (!fileKeys || fileKeys.length === 0) return;

        const { error } = await supabase.functions.invoke('r2-storage', {
            body: {
                action: 'delete_multiple',
                fileKeys
            }
        });

        if (error) {
            console.error('Falha ao deletar múltiplos arquivos no R2:', error);
        }
    }
};
