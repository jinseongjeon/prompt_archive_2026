
/**
 * Optimizes an image file by resizing and converting it to WebP format.
 * @param file The original image file.
 * @param maxWidth Maximum width of the output image.
 * @param quality Quality of the WebP output (0 to 1).
 * @returns A promise that resolves to a Base64 string of the optimized WebP image.
 */
export const optimizeImage = (file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context is not available'));
                    return;
                }

                // Draw and resize
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to WebP Base64
                const optimizedBase64 = canvas.toDataURL('image/webp', quality);
                resolve(optimizedBase64);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
