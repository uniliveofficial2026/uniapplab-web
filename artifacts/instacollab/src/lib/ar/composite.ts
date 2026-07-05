type SegmentationScratch = {
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  maskImageData: ImageData | null;
  bgCanvas: HTMLCanvasElement;
  bgCtx: CanvasRenderingContext2D;
  personCanvas: HTMLCanvasElement;
  personCtx: CanvasRenderingContext2D;
  maskWidth: number;
  maskHeight: number;
};

let segmentationScratch: SegmentationScratch | null = null;

function getSegmentationScratch(maskWidth: number, maskHeight: number): SegmentationScratch {
  if (
    !segmentationScratch ||
    segmentationScratch.maskWidth !== maskWidth ||
    segmentationScratch.maskHeight !== maskHeight
  ) {
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) throw new Error('Mask canvas unavailable');

    const bgCanvas = document.createElement('canvas');
    const personCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');
    const personCtx = personCanvas.getContext('2d');
    if (!bgCtx || !personCtx) throw new Error('Composite canvas unavailable');

    segmentationScratch = {
      maskCanvas,
      maskCtx,
      maskImageData: null,
      bgCanvas,
      bgCtx,
      personCanvas,
      personCtx,
      maskWidth,
      maskHeight,
    };
  }

  if (
    !segmentationScratch.maskImageData ||
    segmentationScratch.maskImageData.width !== maskWidth ||
    segmentationScratch.maskImageData.height !== maskHeight
  ) {
    segmentationScratch.maskImageData = segmentationScratch.maskCtx.createImageData(maskWidth, maskHeight);
  }

  return segmentationScratch;
}

export function drawVideoFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mirror: boolean,
  width: number,
  height: number,
) {
  ctx.save();
  if (mirror) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();
}

export function updateMaskCanvas(
  scratch: SegmentationScratch,
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  mirror: boolean,
) {
  const imageData =
    scratch.maskImageData ?? scratch.maskCtx.createImageData(maskWidth, maskHeight);
  scratch.maskImageData = imageData;
  const pixels = maskWidth * maskHeight;
  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      const srcX = mirror ? maskWidth - 1 - x : x;
      const alpha = Math.round(Math.min(1, Math.max(0, mask[y * maskWidth + srcX] ?? 0)) * 255);
      const offset = (y * maskWidth + x) * 4;
      imageData.data[offset] = 255;
      imageData.data[offset + 1] = 255;
      imageData.data[offset + 2] = 255;
      imageData.data[offset + 3] = alpha;
    }
  }
  scratch.maskCtx.putImageData(imageData, 0, 0);
}

export function drawSegmentationComposite(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  mirror: boolean,
  width: number,
  height: number,
  mask: Float32Array,
  maskWidth: number,
  maskHeight: number,
  paintBackground: (bgCtx: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  if (!maskWidth || !maskHeight) {
    drawVideoFrame(ctx, video, mirror, width, height);
    return;
  }

  const scratch = getSegmentationScratch(maskWidth, maskHeight);
  updateMaskCanvas(scratch, mask, maskWidth, maskHeight, mirror);

  if (scratch.bgCanvas.width !== width || scratch.bgCanvas.height !== height) {
    scratch.bgCanvas.width = width;
    scratch.bgCanvas.height = height;
    scratch.personCanvas.width = width;
    scratch.personCanvas.height = height;
  }

  paintBackground(scratch.bgCtx, width, height);
  ctx.drawImage(scratch.bgCanvas, 0, 0);

  scratch.personCtx.clearRect(0, 0, width, height);
  drawVideoFrame(scratch.personCtx, video, mirror, width, height);
  scratch.personCtx.globalCompositeOperation = 'destination-in';
  scratch.personCtx.drawImage(scratch.maskCanvas, 0, 0, width, height);
  scratch.personCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(scratch.personCanvas, 0, 0);
}
