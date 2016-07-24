// Required Modules
let helpers = require( './helpers' );
let sync = require( './sync' );
let net = require( 'net' );
let multicastDNS = require( 'multicast-dns' );
let ip = require( 'network-address' );
let fs = require( 'fs' );

// Global functions
let hostIdentifier = helpers.hostIdentifier;
let logger = helpers.logger;
let mdns = multicastDNS();

// Global variables
let host = ip();
let transferPort = null;
let transferId = null;
let servers = {};
let clients = {};

// Global constants
const transferLimit = 3;

/*
** Setup a simple file watch service which sends
** updates regularly
*/
sync.initialize();

// announce ourself on the wire if we have open connections left
function announceSelf() {
    // If we've run out of connections, skip
    if( Object.keys( clients ).length > transferLimit ) return;

    mdns.query( {
        answers: [
            {
                name: '*',
                type: 'SRV',
                data: {
                    target: host,
                    port: transferPort
                }
            }
        ]
    } );
}

// Fired when we first connect to a new host
function initialTransferConnection( remoteHost, remotePort ) {
    let remoteId = hostIdentifier( remoteHost, remotePort );

    // don't connect to self
    if( remoteId === transferId ) return;

    // If we've already connected to the host, skip
    if( servers[ remoteId ] ) return;

    // If we've run out of connections, skip
    if( Object.keys( servers ).length > transferLimit ) return;

    /*
    ** Establish handshake with transfer server of the announcement
    */
    logger( `Connecting to transfer server: ${ remoteId }` );

    // Get a socket
    let sock = servers[ remoteId ] = net.connect( remotePort, remoteHost );

    // Error handlers
    sock.on( 'error', err => sock.destroy( err ) );
    sock.on( 'close', () => delete servers[ remoteId ] );

    /*
    ** When we connect to a server, it will send an initial image,
    ** the processing of the initial image happens over here.
    */
    sock.on( 'data', handleRequest.bind( undefined, sock ) );
}

// HandleRequest from a peer
function handleRequest( sock, data ) {
    logger( data );

    // Handle the requests
    data = JSON.parse( data.toString() );

    let remoteId = hostIdentifier( data.host, data.port );

    if( data.type === 'initial' ) {
        logger( `Initial Image request from ${ remoteId }` );

        let peerIndex = data.data;
        let { missingFiles, extraFiles }= sync.sync( peerIndex );

        // Request missing files from the host
        if( missingFiles.length > 0 ) {
            logger( `Requesting for missing files from ${ remoteId }` );
            sock.write( JSON.stringify( { type: 'get', data: missingFiles, host: host, port: transferPort } ) );
        }

        // Send extra files to the host
        if( extraFiles.length > 0 ) {
            logger( `Sending extra files to ${ remoteId }`);

            for( file of extraFiles ) {
                sock.write( JSON.stringify( { type: 'put', data: [ file, "" ], host: host, port: transferPort } ) );
            }
        }
    } else if( data.type === 'get' ) {
        logger( `Get` );
    } else if( data.type === 'put' ) {
        logger( `Put` );
    }
}

/*
** Setup a file transfer server
*/
let transferServer = net.createServer( function( sock ) {
    sock.on( 'error', err => sock.destroy( err ) );
    sock.on( 'data', handleRequest.bind( undefined, sock ) ); // Send the socket along
} );

transferServer.on( 'listening', function() {
    transferPort = transferServer.address().port;
    transferId = hostIdentifier( host, transferPort );
    logger( `Transfer server: ${ transferId } is listening` );

    /*
    ** Setup the discovery server
    */
    let discoveryServer = net.createServer( function( sock ) {
        sock.on( 'error', err => sock.destroy( err ) );
    } );

    // This function runs when the discovery server is setup
    discoveryServer.on( 'listening', function() {
        let discoveryId = hostIdentifier( host, discoveryServer.address().port );
        logger( `Discovery server: ${ discoveryId } is listening` );

        // Fired when a we recieve a discovery announcement from any host,
        // including ourselves
        mdns.on( 'query', function( query ) {
            for( let answer of query.answers ) {
                // Bootstrap a connection with the host
                if( answer.name === '*' && answer.type === 'SRV' ) {
                    initialTransferConnection( answer.data.target, answer.data.port );
                }
            }
        } );

        // Announce our existence every 5s
        setInterval( announceSelf, 5000 );
    } );

    discoveryServer.listen( 0 );
} );

transferServer.on( 'connection', function ( sock ) {
    let remoteId = hostIdentifier( helpers.simpleHost( sock.remoteAddress ), sock.remotePort );

    // Whenever a peer gets connected to our transfer server, we send it the first image
    logger( `Connected to peer: ${ remoteId }` );
    sock.write( JSON.stringify( { type: 'initial', data: sync.getIndex(), host: host, port: transferPort } ) );
    clients[ remoteId ] = sock;
} );

transferServer.listen( 0 );
