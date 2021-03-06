const expect = require('../unexpected-with-plugins');
const AssetGraph = require('../../lib/AssetGraph');

describe('bundleWebpack', function () {
    it('should create a bundle consisting of a single file', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/simple/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        expect(assetGraph, 'to contain asset', { type: 'JavaScript', isLoaded: true });
        expect(assetGraph, 'to contain relations', { type: 'HtmlScript', from: { url: /index\.html$/} }, 1);
        expect(assetGraph, 'to contain asset', {
            type: 'JavaScript',
            fileName: /bundle/
        });
        expect(assetGraph.findRelations({
            from: { url: /index\.html$/ },
            to: { fileName: /bundle/ }
        })[0].to.text, 'to contain', 'alert(\'main!\');');
    });

    it('should create a bundle consisting of a single file with a different publicPath', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/publicPath/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        expect(assetGraph, 'to contain asset', { type: 'JavaScript', isLoaded: true });
        expect(assetGraph, 'to contain relations', { type: 'HtmlScript', from: { url: /index\.html$/} }, 1);
        expect(assetGraph, 'to contain asset', {
            type: 'JavaScript',
            fileName: /bundle/
        });
        expect(assetGraph.findRelations({
            from: { url: /index\.html$/ },
            to: { fileName: /bundle/ }
        })[0].to.text, 'to contain', 'alert(\'main!\');');
    });

    it('should discover relations in the bundle', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/relationInBundle/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        expect(assetGraph, 'to contain asset', { type: 'Json', isLoaded: true });
        expect(assetGraph, 'to contain relation', { type: 'JavaScriptStaticUrl', to: { fileName: /^[a-f0-9]{32}\.json$/ } });
    });

    it('should pick up source maps from webpack', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/sourceMaps/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate()
            .applySourceMaps();

        let alertInScriptWithoutExistingSourceMap;
        let firstGetBoundingClientRectNode;
        require('estraverse').traverse(assetGraph.findAssets({fileName: 'bundle.js'})[0].parseTree, {
            enter(node) {
                if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'alert' &&
                    node.arguments.length === 1 && node.arguments[0].value === 'noExistingSourceMap') {

                    alertInScriptWithoutExistingSourceMap = alertInScriptWithoutExistingSourceMap || node;
                } else if (node.type === 'Identifier' && node.name === 'getBoundingClientRect') {
                    firstGetBoundingClientRectNode = firstGetBoundingClientRectNode || node;
                }
            }
        });
        expect(alertInScriptWithoutExistingSourceMap, 'to satisfy', {
            loc: {
                source: assetGraph.root + 'noExistingSourceMap.js',
                start: {
                    line: 3
                }
            }
        });
        expect(firstGetBoundingClientRectNode, 'to satisfy', {
            loc: {
                source: assetGraph.root + 'jquery-1.10.1.js',
                start: {
                    line: 9591
                }
            }
        });
    });

    it('should pick up CSS assets in the output bundles', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/css/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .applySourceMaps();

        expect(assetGraph, 'to contain asset', { type: 'Css', isLoaded: true });
        expect(assetGraph, 'to contain relation', {type: 'HtmlStyle', href: '/dist/main.css', from: { type: 'Html' }, to: { type: 'Css' }});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain', '<link rel="stylesheet" href="/dist/main.css');
    });

    it('should not build unused bundles', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/namedUnusedBundles/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack();

        expect(assetGraph, 'to contain asset', { fileName: 'bundle.main.js', isLoaded: true })
            .and('to contain no asset', { fileName: 'bundle.unused.js' });
    });

    it('should work with the commons chunk plugin', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/commonschunk/'});
        await assetGraph.loadAssets('index.html', 'secondary.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        expect(assetGraph, 'to contain relation', { from: { fileName: 'index.html' }, to: { fileName: 'bundle.main.js' } })
            .and('to contain relation', { from: { fileName: 'index.html' }, to: { fileName: 'common.js' } });
        expect(assetGraph, 'to contain relation', { from: { fileName: 'secondary.html' }, to: { fileName: 'bundle.secondary.js' } })
            .and('to contain relation', { from: { fileName: 'secondary.html' }, to: { fileName: 'common.js' } });
        expect(assetGraph.findAssets({fileName: 'common.js'})[0].text, 'to contain', "alert('dep!')");
    });

    it('should work with the commons chunk plugin when only one bundle is built', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/commonschunk/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        expect(assetGraph, 'to contain relation', { from: { fileName: 'index.html' }, to: { fileName: 'bundle.main.js' } })
            .and('to contain relation', { from: { fileName: 'index.html' }, to: { fileName: 'common.js' } });

        // Note: When building the multi-entry point app with the commons chunk plugin one page at a time like this,
        // we will end up with a common bundle that only contains the webpack loader. The common dependency ends
        // up in the "main" bundle. This is expected -- if you'd like the commons chunk bundle to actually work
        // as intended, build the entire app in one go:
        expect(assetGraph, 'to contain asset', { fileName: 'common.js' });
        expect(assetGraph.findAssets({fileName: 'bundle.main.js'})[0].text, 'to contain', "alert('dep!')");
    });

    it('should support code splitting via require.ensure', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/codeSplit/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({followRelations: {type: AssetGraph.query.not('SourceMapSource')}});

        // Webpack 1: 1.bundle.js
        // Webpack 2: 0.bundle.js
        expect(assetGraph, 'to contain asset', { fileName: 'bundle.js'})
            .and('to contain asset', { fileName: /^[01]\.bundle\.js$/});
        expect(assetGraph, 'to contain relation', { from: { fileName: 'index.html' }, to: { fileName: 'bundle.js' } })
            .and('to contain relation', { from: { fileName: 'bundle.js' }, to: { fileName: /^[01]\.bundle\.js$/ } });
    });

    it('should support code splitting via require.ensure and wildcards', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/wildcardCodeSplit/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({
                followRelations: {type: AssetGraph.query.not('SourceMapSource')}
            });

        expect(assetGraph, 'to contain relations', 'JavaScriptStaticUrl', 4);

        const mainBundle = assetGraph.findAssets({fileName: 'bundle.js'})[0];
        expect(mainBundle.text, 'to contain', '\'/dist/1.bundle.js\'.toString(\'url\')')
            .and('to contain', '__webpack_require__.e(ids[1], ids[2]).then');
    });

    it('should support code splitting via require.ensure and wildcards when chunkFilename is used', async function () {
        // The presence of
        //   { output: { ... chunkFilename: 'js/bundle.[name].[chunkhash:8].js' } }
        // in the webpack config makes the dynamic loader come out as:
        //   script.src = __webpack_require__.p + "js/bundle." + ({}[chunkId]||chunkId) + "." + {"0":"4939bbe4","1":"a614fb6c"}[chunkId] + ".js";
        // instead of per usual:
        //   script.src = __webpack_require__.p + "" + chunkId + ".bundle.js";

        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/bundleWebpack/wildcardCodeSplitWithChunkfilename/'});
        await assetGraph.loadAssets('index.html')
            .bundleWebpack()
            .populate({
                followRelations: {type: AssetGraph.query.not('SourceMapSource')}
            });

        expect(assetGraph, 'to contain relations', 'JavaScriptStaticUrl', 4);

        const mainBundle = assetGraph.findAssets({fileName: 'bundle.js'})[0];
        expect(mainBundle.text, 'to match',  /'\/dist\/bundle\.1\.[a-f0-9]+\.js'\.toString\('url'\)/);
    });
});
