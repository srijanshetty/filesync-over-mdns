// Import modules
let fs = require( 'fs' );
let path = require( 'path' );
let hashFiles = require( 'hash-files' );
let helpers = require( './helpers' );
let events = require( 'events' );

// Global constants
const ALGORITHM = 'sha256';
const syncDir = './dir';
const ENCODING = 'utf-8';

// The fileIndex which stores all the files
let fileIndex = {};

// Event emitter so that the application can respond to events
let fileEvents = new events.EventEmitter();

// Get the filePath
function filePath( fileName ) {
  return path.join( syncDir, fileName );
}

// This helps throttle events on the same file
let fsTimeout = {};

// File Watcher service
function initializeWatch() {
  fs.watch( syncDir, ( eventType, fileName ) => {
    // TODO: This could made faster using a patch-diff system

    /*
     ** The timeout makes sure that we don't handle multiple
     ** events originating from the same eventTYpe, fileName pari
    */
    if( !fsTimeout[ eventType + fileName ] ) {
      setTimeout( () => {
        fsTimeout[ eventType + fileName ] = null;

        // TODO: handle removes
        if( eventType === 'change' ) {
          let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filePath( fileName ) ] } );
          let fileContents = fs.readFileSync( filePath( fileName ), ENCODING );
          addToIndex( hash, fileName, fileContents );
        }
      }, 5000 );
    }
  } );
}

// Function to read all files in dir and add it to Index
function readDir( readFile ) {
  let fileNames = fs.readdirSync( syncDir );
  for( fileName of fileNames ) {
    let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filePath( fileName ) ] } );
    addToIndex( hash, fileName );
  }
}

// Initialize the syncing process
function initialize() {
  // Add files to the syncDir
  readDir();

  // Initialize the file sync service
  initializeWatch();

  // return the eventEmitter
  return fileEvents;
}

// Add a file to the localIndex
function addToIndex( hash, fileName, fileContents ) {
  if( !fileIndex[ fileName ] ) {
    helpers.logger( `FILEINDEX: Adding ${ fileName } to local Index.`, 5 );
    fileIndex[ fileName ] = hash;

    // Only write if fileContents is provided
    if( fileContents ) {
      fs.writeFile( filePath( fileName ), fileContents, () => helpers.logger( `${ fileName } written to local dir.`, 11 ) );

      // fire an event if the file updates
      fileEvents.emit( 'UPDATE', hash, fileName, fileContents );

    }
  } else {
    if( fileIndex[ fileName ] === hash ) {
      helpers.logger( `LOCALINDEX: ${ fileName } is identical to index copy, skipping add`, 11 );
    } else {
      helpers.logger( `LOCALINDEX: ${ fileName } is not identical to index copy, updating index`)
      fileIndex[ fileName ] = hash;

      // Only write if fileContents is provided
      if( fileContents ) {
        fs.writeFile( filePath( fileName ), fileContents, () => helpers.logger( `${ fileName } written to local dir.`, 11 ) );

        // fire an event if the file updates
        fileEvents.emit( 'UPDATE', hash, fileName, fileContents );
      }
    }
  }
};

// Get the name of the file from the localIndex
function getFromIndex( fileName ) {
  let hash = fileIndex[ fileName ];
  let fileContents = null;

  // Fetch the contents if the file exists
  if( hash ) {
    fileContents = fs.readFileSync( filePath( fileName ), ENCODING );
  }

  return { hash, fileContents };
}

// Syncronize a peer's index with our index
function syncWithIndex( peerIndex ) {
  return( {
    missingFiles: Object.keys( peerIndex ).filter( fileName => !fileIndex[ fileName ] ),
    extraFiles: Object.keys( fileIndex ).filter( fileName => !peerIndex[ fileName ] )
  } );
}

// Export functions
module.exports = {
  initialize,
  addToIndex,
  getFromIndex,
  syncWithIndex,
  getIndex: () => fileIndex,
};
