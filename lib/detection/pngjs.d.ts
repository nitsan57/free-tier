declare module "pngjs" {
  export interface PNGOptions {
    width?: number;
    height?: number;
    fill?: boolean;
  }

  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    static sync: {
      read(buffer: Buffer, options?: PNGOptions): PNG;
      write(png: PNG): Buffer;
    };
    constructor(options?: PNGOptions);
  }
}
