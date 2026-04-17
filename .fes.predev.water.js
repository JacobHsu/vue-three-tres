import { defineBuildConfig } from '@fesjs/fes'

export default defineBuildConfig({
    layout: {
        title: 'TvT.js',
        navigation: 'top',
        multiTabs: false,
        isFixedHeader: true,
        sideWidth: 0,
        logo: 'logo.png',
        menus: [
            {
                name: 'preview',
                path: '/',
                title: 'Demo',
            },
        ],
    },
    viteOption: {
        server: {
            proxy: {
                '/api.icegl': {
                    target: 'https://www.icegl.cn/',
                    changeOrigin: true,
                    rewrite: (path) => path.replace(/^\/api.icegl/, ''),
                },
                '/tianditu.map': {
                    target: 'https://t0.tianditu.gov.cn/',
                    changeOrigin: true,
                    headers: {
                        Origin: 'opensource.icegl.cn',
                        Referer: 'http://opensource.icegl.cn',
                    },
                    rewrite: (path) => path.replace(/^\/tianditu.map/, ''),
                },
            },
        },
    },
})
