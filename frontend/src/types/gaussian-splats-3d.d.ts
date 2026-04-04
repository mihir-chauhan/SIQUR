declare module "@mkkellogg/gaussian-splats-3d" {
  import type { Scene, WebGLRenderer, Camera } from "three";

  interface ViewerOptions {
    scene?: Scene;
    renderer?: WebGLRenderer;
    camera?: Camera;
    selfDrivenMode?: boolean;
    useBuiltInControls?: boolean;
    [key: string]: unknown;
  }

  interface AddSplatSceneOptions {
    showLoadingUI?: boolean;
    [key: string]: unknown;
  }

  class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(url: string, options?: AddSplatSceneOptions): Promise<void>;
    update(): void;
    render(): void;
    dispose(): void;
  }

  export { Viewer };
  export default { Viewer };
}
