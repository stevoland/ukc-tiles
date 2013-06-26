var mapnik = require('mapnik'),
    mercator = require('./utils/sphericalmercator'),
    mappool = require('./utils/pool.js'),
    http = require('http'),
    parseXYZ = require('./utils/tile.js').parseXYZ,
    path = require('path');

var TMS_SCHEME = false;

// create a pool of 5 maps to manage concurrency under load
var maps = mappool.create_pool(5);

var stylesheet = path.resolve(__dirname, 'stylesheet.xml');

var port = '8000';

var aquire = function (id, options, callback) {
    methods = {
        create: function (cb) {
                var obj = new mapnik.Map(options.width || 256, options.height || 256);
                obj.load(id, {strict: true}, function (err, obj) {
                    if (options.bufferSize) {
                        obj.bufferSize = options.bufferSize;
                    }
                    cb(err,obj);
                });
            },
            destroy: function (obj) {
                delete obj;
            }
    };
    maps.acquire(id, methods, function (err, obj) {
      callback(err, obj);
    });
};


http.createServer(function (req, res) {
    parseXYZ(req, TMS_SCHEME, function (err, params) {
            /*var p0 = [params.x * 256, (params.y + 1) * 256];
            var p1 = [(params.x + 1) * 256, params.y * 256];

            // Convert to LatLong (EPSG:4326)
            var l0 = mercator.px_to_ll(p0, params.z);
            var l1 = mercator.px_to_ll(p1, params.z);*/



            res.writeHead(200, {
              'Content-Type': 'text/plain'
            });
            res.end('');
            return;
        if (err) {
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(err.message);
        } else {

            aquire(stylesheet, {}, function (err, map) {
                if (err) {
                    process.nextTick(function () {
                        maps.release(stylesheet, map);
                    });
                    res.writeHead(500, {
                      'Content-Type': 'text/plain'
                    });
                    res.end(err.message);
                } else {

                    // bbox for x,y,z
                    var bbox = mercator.xyz_to_envelope(params.x, params.y, params.z, TMS_SCHEME);
                    map.extent = bbox;
                    var im = new mapnik.Image(map.width, map.height);
                    map.render(im, function (err, im) {
                        process.nextTick(function () {
                            maps.release(stylesheet, map);
                        });
                        if (err) {
                            res.writeHead(500, {
                              'Content-Type': 'text/plain'
                            });
                            res.end(err.message);
                        } else {
                            res.writeHead(200, {
                              'Content-Type': 'image/png'
                            });
                            res.end(im.encodeSync('png'));
                        }
                    });
                }
            });
        }
    });

}).listen(port);


console.log('Test server listening on port %d', port);
