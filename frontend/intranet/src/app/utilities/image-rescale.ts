export function generateSquareThumbnailBase64(source: HTMLImageElement, targetSize: number): string {
    let canvas = document.createElement("canvas");

    canvas.width = targetSize;
    canvas.height = targetSize;

    let renderContext = canvas.getContext('2d')!;
    let aspect = source.naturalWidth / source.naturalHeight;
    
    if (aspect > 1) {
        renderContext.drawImage(source, -Math.abs(1-aspect) * targetSize/2, 0, targetSize * aspect, targetSize);
    } else {
        renderContext.drawImage(source, 0, -Math.abs(1-1/aspect) * targetSize/2, targetSize, targetSize / aspect);
    }

    return canvas.toDataURL('image/jpeg', 0.8);
}