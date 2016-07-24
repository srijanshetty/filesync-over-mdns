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

    if( data.type === 'INITIAL' ) {
        logger( `INITIAL: Initial Image request from ${ remoteId }` );

        let peerIndex = data.data;
        let { missingFiles, extraFiles } = sync.syncWithIndex( peerIndex );

        // Request missing files from the host
        if( missingFiles.length > 0 ) {
            logger( `INITIAL: Requesting for missing files from ${ remoteId }` );
            sock.write( JSON.stringify( { type: 'GET', data: missingFiles, host: host, port: transferPort } ) );
        }

        // Send extra files to the host
        if( extraFiles.length > 0 ) {
            logger( `INITIAL: Sending extra files to ${ remoteId }` );

            let payload = [];
            for( let fileName of extraFiles ) {
                let { hash, fileContents } = sync.getFromIndex( fileName );
                payload.push( [ hash, fileName, fileContents ] );
            }
            sock.write( JSON.stringify( { type: 'PUT', data: payload, host: host, port: transferPort } ) );
        }
    } else if( data.type === 'GET' ) {
        // We have gotten a GET request from a peer, we'll send it the file
        let fileNames = data.data;

        logger( `GET: ${ fileNames } from local index` );

        // Send PUTs for all the hashes that we get
        let payload = [];
        for( let fileName of fileNames ) {
            let { hash, fileContents } = sync.getFromIndex( fileName );
            payload.push( [ hash, fileName, fileContents ] );
        }
        sock.write( JSON.stringify( { type: 'PUT', data: payload, host: host, port: transferPort } ) );
    } else if( data.type === 'PUT' ) {
        // We have gotten a PUT request, we store the file to our sync dir
        let payload = data.data;

        for( let item of payload ) {
            let hash = item[ 0 ];
            let fileName = item[ 1 ];
            let fileContents = item[ 2 ];

            // Add to local Index
            logger( `PUT: ${ fileName } to local index` );
            sync.addToIndex( hash, fileName, fileContents );
        }
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
    sock.write( JSON.stringify( { type: 'INITIAL', data: sync.getIndex(), host: host, port: transferPort } ) );
    clients[ remoteId ] = sock;
} );

transferServer.listen( 0 );
