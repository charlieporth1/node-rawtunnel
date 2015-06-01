assert = require("assert");

var net = require("net");

var targets = process.argv.slice(2);

function genData(n) {
    var ary = [];
    for(var i=0;i<n;i++) {
        ary.push(i);
    }
    return ary.join(":");
}

// args: "IP:PORT IP:PORT IP:PORT .."
targets.forEach( function(tgt) {
    var pair = tgt.split(":");
    var host = pair[0];
    var port = parseInt(pair[1]);

    var co = net.connect( { "host":host,"port":port } );
    co.count = 1
    co.on( "connect", function() {
        for(var i=0;i<10;i++) {
            co.write( genData(30) );
        }
    });
    co.on( "data", function(d) {
        console.log( "data:",d.length);
        co.write( genData(co.count) );
        co.count ++;
        var maxcnt = 3000;
        if( co.count > maxcnt ) co.count = maxcnt;
    });
    co.on( "error", function(e) {
        console.log( "error:", e );
    });
});
