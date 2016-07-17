// Required Modules
let helpers = require( './helpers' );
let net = require( 'net' );
let multicastDNS = require( 'multicast-dns' );
let ip = require( 'network-address' );

// Global functions
let hostIdentifier = helpers.hostIdentifier;
let logger = helpers.logger;
let mdns = multicastDNS();

// Global variables
let host = ip();
let files = [ 'srijan', 'shetty' ];
let connections = {};

// Global constants
const limit = 3;
const syncDir = './sync';

// HandleRequest from a peer
function handleRequest( data ) {
    logger( data );
    data = JSON.parse( data.toString() );
}

/*
** Setup a file transfer server
*/
let server = net.createServer( function( sock ) {
    sock.on( 'error', err => sock.destroy( err ) );
    sock.on( 'data', handleRequest );
} );

// This function runs when the TCP server is setup
server.on( 'listening', function() {
    let port = server.address().port;
    let id = hostIdentifier( host, port );

    logger( `${hostIdentifier( host, port )} is listening` );

    /*
    ** Connect to a new host when it announces itself
    ** one the wire
    */

    // Fired when we first connect to a new host
    function initialConnection( host, port ) {
        let remoteId = hostIdentifier( host, port );

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

    // Fired when a new host arrives on the wire, we connect to the host
    mdns.on( 'query', function( query ) {
        for( let answer of query.answers ) {
            // connect to the host and send it files
            if( answer.name === '*' && answer.type === 'SRV' ) {
                initialConnection( answer.data.target, answer.data.port );
            }
        }
    } );

    /*
    ** Keep announcing ourself on the wire
    */

    function announceSelf() {
        // If the number of peers is less than the limit, keep on trying
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

    // Announce our existence every 5s
    setInterval( announceSelf, 5000 );
} );

// server.on( 'connection', function ( sock ) {
//     let host = sock.remoteAddress;
//     let port = sock.remotePort;
//     let remoteId = hostIdentifier( host, port ;
//
//     logger( `Connected to peer: ${remoteId}` );
// } );

server.listen( 0 );
