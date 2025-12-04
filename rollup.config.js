import resolve from '@rollup/plugin-node-resolve';
import terser  from '@rollup/plugin-terser';

const config =[
    {
        input: 'src/index.js',
        external: ['three', 'three/webgpu','three/src/math/MathUtils.js','@sridhar-mani/dsa-js' ],
        output:{
            file: 'dist/index.js',
            format: 'es',
            sourcemap:true
        },
        plugins:[resolve()]
    },
    {
         input: 'src/index.js',
        external: ['three', 'three/webgpu','three/src/math/MathUtils.js','@sridhar-mani/dsa-js' ],   output:{
            file: 'dist/index.min.js',
            format: 'es',
            sourcemap:true
        },
        plugins: [resolve(),terser()]
    },{
                input: 'src/WorkerHyb.js',
        external: ['three', 'three/webgpu','@sridhar-mani/dsa-js' ],   
        output:{
            file: 'dist/workerhyb.js',
            format: 'es',
            sourcemap:true
        },
        plugins: [ resolve() ]
    },{
                input: 'src/MainThreadProxy.js',
        external: ['three', 'three/webgpu','@sridhar-mani/dsa-js' ],   
        output:{
            file: 'dist/mainthreadproxy.js',
            format: 'es',
            sourcemap:true
        },
        plugins: [ resolve() ]
    }
];

export default config;