const ALLOWED_METHODS = new Set([
    'setSize',
    'setPixelRatio',
    'setClearColor',
    'clear',
    'compile',
    'dispose',
    'setScissorTest',
    'setViewport',
    'setRenderTarget'
]);

export default ALLOWED_METHODS;