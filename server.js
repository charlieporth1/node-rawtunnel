require("assert");

var net = require("net");
var msgpack = require("msgpack");

var control_port = 7770;

var g_tunnels = [];
                 
var g_idgen = 0;
function getNewId() {
    g_idgen ++;
    return g_idgen;
}

function Tunnel(p) {
    this.server = null;
    this.portnum = p;
    this.connections = []; // store all sockets from a server
    this.stats = []
}

function addTunnel(portnum, ctrl_conn ) {
    var tun = new Tunnel(portnum);
    
    var sv = net.createServer( function(conn) {
        conn.id = getNewId();
        console.log("Connection for tunnel from remote:", conn.remoteAddress, conn.localAddress, "newid:", conn.id );
        ctrl_conn.newRemoteConnection(portnum,conn.id);
        conn.stats = { "recvbytes":0, "sendbytes":0 };
        conn.on( "data", function(d) {
            conn.stats.recvbytes += d.length;
            ctrl_conn.receiveRemoteData(portnum,conn.id,d);
        });
        conn.on( "error", function(e) {
            ctrl_conn.receiveRemoteError(portnum,conn.id,e);
        });
        tun.connections.push(conn);
    });

    sv.listen( portnum, "0.0.0.0" );
    tun.server = sv;
    tun.finish = function() {
        tun.server.close();
        tun.connections.forEach( function(co) {
            co.destroy();
        });
        tun.connections = [];
    }
    tun.receiveTargetData = function( cid, buf ) {
        tun.connections.forEach( function(co) {
            if( co.id == cid ) {
                co.stats.sendbytes += buf.length;                
                co.write(buf);
            }
        });
    }
    tun.receiveTargetError = function( cid, data ) {
        tun.connections.forEach( function(co) {
            if( co.id == cid ) {
                co.destroy();
            }
        });
    };
    tun.getStats = function() {
        var out = [];
        tun.connections.forEach( function(co) {
            co.stats.id = co.id;
            out.push( co.stats );
        });
        return out;
    }

    tun.error = null;
    sv.on("error",function(e){
        console.log("tun error:",e);
        tun.error = e;
    });
    return tun;
}

// main server
var server = net.createServer( function(conn) {
    console.log("Connection from " + conn.remoteAddress );

    // init
    conn.authorized = false;
    conn.tunnels = [];    
    var o = [ "hello", "world" ];
    conn.write( msgpack.pack(o) );    

    conn.receiveRemoteData = function( portnum, cid, data ) {
//        console.log( "receiveRemoteData from port:", portnum, "cid:",cid, " datalen:", data.length );
        var dataary = [];
        for(var i=0;i<data.length;i++) dataary[i] = data[i];
        var o = [ "data", portnum,cid,  dataary ];
        conn.write( msgpack.pack(o));
    }
    conn.newRemoteConnection = function( portnum, cid ) {
        console.log( "newRemoteConnection: portnum:", portnum, "cid:",cid );
        var o = [ "accept", portnum, cid ];
        conn.write( msgpack.pack(o));
    }
    conn.receiveRemoteError = function( portnum, cid, e ) {
        console.log( "receiveRemoteError: portnum",portnum, "cid:",cid, "e:",e);
        var o = [ "error", portnum, cid, e ];
        conn.write(msgpack.pack(o));
    }
    
    var ms = new msgpack.Stream(conn);
    ms.addListener( "msg", function(m) {
//        console.log( "received message:", m );
        var cmd = m[0];
        
        if( cmd == "echo" ) {
            var rest = m.slice(1,1+m.length);
            conn.write( msgpack.pack( ["echo"].concat(rest)) );            
        } else if( cmd == "tunnel" ) { // create a new tunnel port. arg=["add", PORTNUM] ret=["OK"] or ["ERROR"]
            var portnum = m[1];
            var tun = addTunnel( portnum, conn );
            console.log("new tunnel:", tun );
            conn.tunnels.push(tun);
            g_tunnels.push(tun);
        } else if( cmd == "list" ) {
            var out = [];
            conn.tunnels.forEach( function(tun) {
                out.push( { "port" : tun.portnum, "error" : tun.error, "stats" : tun.getStats() } );
            });
            conn.write( msgpack.pack( ["list"].concat(out)));
        } else if( cmd == "data" ) { // [ "data", portnum, cid, data ]
            var portnum = m[1];
            var cid = m[2];
            var dataary = m[3];
//            console.log( "recv data command. type:", typeof(dataary), "len:", dataary.length, "127,8:", dataary[127], dataary[128] );
            var buf = new Buffer( dataary.length );
            for(var i=0;i<dataary.length;i++) buf[i] = dataary[i];
            conn.tunnels.forEach( function(tun) {
                tun.receiveTargetData(cid,buf);                    
            });
        } else if( cmd == "error" ) { // [ "error", portnum, cid, errorobj ]
            var portnum = m[1];
            var cid = m[2];
            var e = m[3];
            conn.tunnels.forEach( function(tun) {
                tun.receiveTargetError(cid,e);
            });
        }
    });

    conn.on("close", function() {
        console.log( "Control conection closed: ", conn.remoteAddress );
        conn.tunnels.forEach( function(tun) {
            tun.finish();
        });
    });

    
});

server.listen( control_port, "0.0.0.0" );

function statLog() {
    g_tunnels.forEach( function(t) {
        var stat = {
            "portnum": t.portnum,
            "connections": t.connections.length,
            "stats": t.getStats() 
        };
        console.log(stat);
    });
}

setInterval( statLog, 2000 );



console.log( "TCP server listening!" );
