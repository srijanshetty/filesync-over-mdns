// Import modules
let fs = require( 'fs' );
let path = require( 'path' );
let hashFiles = require( 'hash-files' );
let helpers = require( './helpers' );

// Global constants
const ALGORITHM = 'sha256';
const syncDir = './dir';

// The fileIndex which stores all the files
let fileIndex = {};

// Initialize the syncing process
function initialize() {
  let files = fs.readdirSync( syncDir );
  for( file of files ) {
    addToSyncDir( path.join( syncDir, file ) );
  }
}

// Add a file to the fileHash and send it across the socket
function addToSyncDir( filename, sock ) {
  let hash = hashFiles.sync( { algorithm: ALGORITHM, files: [ filename ] } );

  // TODO: Send files to the socket or not depending on which socket
  if( !fileIndex[ hash ] ) {
    helpers.logger( `Adding ${filename} to local dir.` );
    fileIndex[ hash ] = filename;
  } else {
    helpers.logger( `${filename} already exists locally.` );
  }

  helpers.logger( JSON.stringify( fileIndex) );
};

// Export functions
module.exports = {
  initialize: initialize,
  addToSyncDir: addToSyncDir,
};
