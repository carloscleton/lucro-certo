import fs from 'fs';

function getJpegSize(filePath) {
    const buffer = fs.readFileSync(filePath);
    let i = 2;
    while (i < buffer.length) {
        if (buffer[i] === 0xFF) {
            const marker = buffer[i + 1];
            if (marker === 0xC0 || marker === 0xC2) {
                // SOF0 or SOF2
                const height = buffer.readUInt16BE(i + 5);
                const width = buffer.readUInt16BE(i + 7);
                return { width, height };
            }
            i += 2 + buffer.readUInt16BE(i + 2);
        } else {
            i++;
        }
    }
    return null;
}

const size = getJpegSize('./scratch/temp_banner.jpeg');
console.log('JPEG size:', size);
