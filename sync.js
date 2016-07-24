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
    addToSyncDirLocal( fileName );
  }
}

// Initialize the syncing process
function initialize() {
  // Add files to the syncDir
  readDir();

  // Initialize the file sync service
  // initializeWatch();
}

function filePath( fileName ) {
  return path.join( syncDir, fileName );
}

// Local add, we don't write contents
function addToSyncDirLocal( fileName ) {
  let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filePath( fileName ) ] } );

  if( !fileIndex[ hash ] ) {
    helpers.logger( `LOCALINDEX: Adding ${ fileName } to local Index.`, 5 );
    fileIndex[ hash ] = fileName;
  } else {
    helpers.logger( `LOCALINDEX: ${ fileName } is a copy of another file.`, 5 );
  }
}

// Add a file to the localIndex
function addToSyncDir( hash, fileName, fileContents ) {
  if( !fileIndex[ hash ] ) {
    helpers.logger( `FILEINDEX: Adding ${ fileName } to local Index.`, 5 );
    fileIndex[ hash ] = fileName;
    fs.writeFile( filePath( fileName ), fileContents, () => helpers.logger( `${ fileName } written to local dir.`, 5 ) );
  } else {
    helpers.logger( `FILEINDEX: ${ fileName } is a copy of another file.`, 5 );
  }
};

// Get the name of the file from the localIndex
function getFile( hash ) {
  let fileName = fileIndex[ hash ];
  let fileContents = null;

  // Fetch the contents if the file exists
  if( fileName )
    fileContents = fs.readFileSync( filePath( fileName ), ENCODING );

  return { fileName, fileContents };
}

// Syncronize a peer's index with our index
function sync( peerIndex ) {
  return( {
    missingHashes: Object.keys( peerIndex ).filter( hash => !fileIndex[ hash ] ),
    extraHashes: Object.keys( fileIndex ).filter( hash => !peerIndex[ hash ] )
  } );
}

// Export functions
module.exports = {
  initialize: initialize,
  addToSyncDir: addToSyncDir,
  getIndex: () => fileIndex,
  getFile: getFile,
  sync: sync
};
