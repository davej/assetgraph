/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    urlTools = require('urltools'),
    AssetGraph = require('../../lib/AssetGraph');

describe('relations/HtmlEmbed', function () {
    it('should handle a test case with an existing <embed src="..."> element', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/relations/HtmlEmbed/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', 'HtmlEmbed');
                expect(assetGraph, 'to contain asset', 'Flash');
                expect(assetGraph, 'to contain relation', {type: 'HtmlEmbed', href: 'foo.swf'});
                assetGraph.findAssets({type: 'Html'})[0].url = urlTools.resolveUrl(assetGraph.root, 'foo/index.html');
                expect(assetGraph, 'to contain relation', {type: 'HtmlEmbed', href: '../foo.swf'});
            })
            .run(done);
    });
});
