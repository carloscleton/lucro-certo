import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3.341.0"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner@3.341.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
        const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
        const R2_BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME')
        const R2_ENDPOINT = Deno.env.get('R2_ENDPOINT') // https://<account_id>.r2.cloudflarestorage.com

        if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_ENDPOINT) {
            throw new Error('Configurações de R2 ausentes no servidor (Deno Env)')
        }

        const s3Client = new S3Client({
            region: "auto",
            endpoint: R2_ENDPOINT,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
        })

        const { action, fileName, contentType } = await req.json()

        if (action === 'get_upload_url') {
            const command = new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileName,
                ContentType: contentType,
            })

            const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })

            return new Response(JSON.stringify({ uploadUrl: signedUrl }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        if (action === 'delete_file') {
            const command = new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileName,
            })

            await s3Client.send(command)

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        if (action === 'list_files') {
            const { prefix } = await req.json()
            const { ListObjectsV2Command } = await import("https://esm.sh/@aws-sdk/client-s3@3.341.0")
            const command = new ListObjectsV2Command({
                Bucket: R2_BUCKET_NAME,
                Prefix: prefix,
            })

            const { Contents } = await s3Client.send(command)

            return new Response(JSON.stringify({ files: Contents || [] }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        if (action === 'delete_multiple') {
            const { fileKeys } = await req.json()
            const { DeleteObjectsCommand } = await import("https://esm.sh/@aws-sdk/client-s3@3.341.0")
            const command = new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: {
                    Objects: fileKeys.map((key: string) => ({ Key: key })),
                },
            })

            await s3Client.send(command)

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        return new Response(JSON.stringify({ error: 'Ação inválida' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
        })
    }
})
