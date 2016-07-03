// var helpers = require( 'helpers' );
// let helpers = require( './helpers' );
let net = require( 'net' );
let multicastDNS = require( 'multicast-dns' );
let ip = require( 'network-address' );

const limit = 10;

let mdns = multicastDNS();
let name = 'application';
let connections = {};
let files = [ 'srijan', 'shetty' ];

let server = net.createServer( function( sock ) {
    sock.on( 'error', err => sock.destroy( err ) );

    // TODO: Handle data events, initial, transfer
    sock.on( 'data', data => console.log( data ) );
} );

// Log out messages to the console
function logger( message ) {
    let host = ip();
    let port = server.address().port;

    console.log( '[ %s::%s ] %s', host, port, message );
}

server.on( 'listening', function() {
    let host = ip();
    let port = server.address().port;
    let id = host + '::' + port;

    logger( 'Server is listening' );

    // connect to the host and give it an update
    function initialConnection( host, port ) {
        let remoteId = host + '::' + port;

        // don't connect to self
        if( remoteId === id ) return;

        // If we've already connected to the host, skip
        if( connections[ remoteId ] ) return;

        // Get a socket to the host
        let sock = connections[ remoteId ] = net.connect( port, host );
        sock.on( 'error', err => sock.destroy( err ) );
        sock.on( 'close', () => delete connections[ remoteId] );

        logger( `Connecting to peer: ${remoteId}` );

        // send files to the host
        // TODO: sendInitialFileList( sock );
        sock.write( JSON.stringify( { type: 'initial', data: files } ) );
    }

    // Announce the existence of our peer
    function announceSelf() {
        // If the number of peers is less than the limit,
        // keep on trying
        if( Object.keys( connections ).length > limit )
            return;

        mdns.query( {
            answers: [
                {
                    name: '*',
                    type: 'SRV',
                    data: {
                        target: host,
                        port: port
                    }
                }
            ]
        } );
    }

    // Only respond to queries for our channel
    mdns.on( 'query', function( query ) {
        for( let answer of query.answers ) {
            // connect to the host and send it files
            if( answer.name === '*' && answer.type === 'SRV' ) {
                initialConnection( answer.data.target, answer.data.port );
            }
        }
    } );

    // Announce our existence every 5s
    setInterval( announceSelf, 5000 );
} );

// server.on( 'connection', function ( sock ) {
//     let host = sock.remoteAddress;
//     let port = sock.remotePort;
//     let remoteId = host + '::' + port;
//
//     logger( `Connected to peer: ${remoteId}` );
// } );

server.listen( 0 );
