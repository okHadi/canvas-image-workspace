declare module "imagetracerjs" {
  interface Options {
    pathomit?: number
    colorsampling?: number
    numberofcolors?: number
    mincolorratio?: number
    colorquantcycles?: number
    ltres?: number
    qtres?: number
    scale?: number
    simplifytolerance?: number
    roundcoords?: number
    lcpr?: number
    qcpr?: number
    desc?: boolean
    viewbox?: boolean
    blurradius?: number
    blurdelta?: number
    strokewidth?: number
    linefilter?: boolean
    pal?: Array<{ r: number; g: number; b: number; a: number }>
  }

  function imageToSVG(
    url: string,
    callback: (svgString: string) => void,
    options?: string | Options
  ): void

  function imagedataToSVG(
    imageData: ImageData,
    options?: string | Options
  ): string

  export { imageToSVG, imagedataToSVG, Options }
}
