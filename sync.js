// Import modules
let fs = require( 'fs' );
let path = require( 'path' );
let hashFiles = require( 'hash-files' );
let helpers = require( './helpers' );

// Global constants
const ALGORITHM = 'sha256';
const syncDir = './dir';
const ENCODING = 'utf-8';

// The fileIndex which stores all the files
let fileIndex = {};

// Get the filePath
function filePath( fileName ) {
  return path.join( syncDir, fileName );
}

// File Watcher service
function initializeWatch() {
  fs.watch( syncDir, function() {
    // TODO: This could made faster using a patch-diff system
    readDir();
  } );
}

// Function to read all files in dir and add it to Index
function readDir() {
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
  // initializeWatch();
}

// Add a file to the localIndex
function addToIndex( hash, fileName, fileContents ) {
  if( !fileIndex[ fileName ] ) {
    helpers.logger( `FILEINDEX: Adding ${ fileName } to local Index.`, 5 );
    fileIndex[ fileName ] = hash;

    // Only write if fileContents is provided
    if( fileContents ) {
      fs.writeFile( filePath( fileName ), fileContents, () => helpers.logger( `${ fileName } written to local dir.`, 5 ) );
    }
  } else {
    if( fileIndex[ fileName ] === hash ) {
      helpers.logger( `LOCALINDEX: ${ fileName } is identical to index copy, skipping add`, 5 );
    } else {
      helpers.logger( `LOCALINDEX: ${ fileName } is not identical to index copy, updating index`)
      fileIndex[ fileName ] = hash;

      // Only write if fileContents is provided
      if( fileContents ) {
        fs.writeFile( filePath( fileName ), fileContents, () => helpers.logger( `${ fileName } written to local dir.`, 11 ) );
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
