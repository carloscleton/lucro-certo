import https from 'https';
import fs from 'fs';

const url = 'https://oncddbarrtxalsmzravk.supabase.co/storage/v1/object/public/social_media_assets/landing_banners/banner_image_url_1780521682926.jpeg';
const path = './scratch/temp_banner.jpeg';

https.get(url, (res) => {
    const fileStream = fs.createWriteStream(path);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Download completed');
        const stats = fs.statSync(path);
        console.log('File size:', stats.size, 'bytes');
    });
});
