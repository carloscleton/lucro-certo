import { supabase } from './supabase';
import { r2Storage } from './r2';

export type StorageProvider = 'supabase' | 'r2';

let cachedProvider: StorageProvider | null = null;

export const storageService = {
    /**
     * Get the current storage provider from app_settings
     */
    async getProvider(): Promise<StorageProvider> {
        // FORÇANDO SUPABASE PARA RESOLVER O ERRO IMEDIATAMENTE
        return 'supabase';
    },

    /**
     * Clear the cached provider to force a fresh fetch
     */
    async clearCache() {
        cachedProvider = null;
    },

    /**
     * Upload a file to the active storage provider
     */
    async upload(file: File | Blob, bucket: string, path: string): Promise<{ publicUrl: string; path: string }> {
        const provider = await this.getProvider();

        if (provider === 'r2') {
            // Map Supabase bucket to R2 prefix
            const r2Path = `${bucket}/${path}`;
            const fileToUpload = file instanceof File
                ? file
                : new File([file], path.split('/').pop() || 'file', { type: file.type });

            return r2Storage.upload(fileToUpload, r2Path);
        } else {
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(path, file, { upsert: true });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(path);

            return { publicUrl, path: data.path };
        }
    },

    /**
     * Delete a file from the active storage provider
     */
    async delete(bucket: string, path: string): Promise<void> {
        const provider = await this.getProvider();

        if (provider === 'r2') {
            const r2Path = `${bucket}/${path}`;
            await r2Storage.delete(r2Path);
        } else {
            const { error } = await supabase.storage
                .from(bucket)
                .remove([path]);

            if (error) {
                console.error(`Error deleting from Supabase storage (${bucket}/${path}):`, error);
            }
        }
    },

    /**
     * List files in a prefix/folder
     */
    async list(bucket: string, prefix: string): Promise<any[]> {
        const provider = await this.getProvider();

        if (provider === 'r2') {
            const r2Prefix = `${bucket}/${prefix}`;
            const files = await r2Storage.list(r2Prefix);

            // Map R2 file objects to something similar to Supabase structure
            return files.map(f => ({
                name: f.Key.replace(`${bucket}/${prefix}`, '').replace(/^\//, ''),
                id: f.ETag,
                updated_at: f.LastModified
            }));
        } else {
            const { data, error } = await supabase.storage
                .from(bucket)
                .list(prefix);

            if (error) throw error;
            return data || [];
        }
    },

    /**
     * Delete multiple files
     */
    async deleteMultiple(bucket: string, paths: string[]): Promise<void> {
        if (!paths || paths.length === 0) return;

        const provider = await this.getProvider();

        if (provider === 'r2') {
            const r2Paths = paths.map(p => {
                // If path already contains bucket prefix, don't add it again
                return p.startsWith(`${bucket}/`) ? p : `${bucket}/${p}`;
            });
            await r2Storage.deleteMultiple(r2Paths);
        } else {
            const { error } = await supabase.storage
                .from(bucket)
                .remove(paths);

            if (error) {
                console.error(`Error deleting multiple files from Supabase (${bucket}):`, error);
            }
        }
    }
};
